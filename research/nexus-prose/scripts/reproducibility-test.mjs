#!/usr/bin/env node
/**
 * Does the same seed give the same sample, whatever order the files arrive in?
 *
 *   node reproducibility-test.mjs <cacheDir>
 *
 * A seed and a digest prove nothing if the sampler consumes candidates in
 * whatever order the filesystem hands them over. readdirSync makes no promise
 * about ordering, and a different machine, filesystem or locale can enumerate a
 * directory differently, which would quietly produce a different sample from
 * the same recorded seed.
 *
 * So the draw is run twice, the second time with discovery deliberately
 * reversed and shuffled, and the two samples must be identical.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { segments } from './segment.mjs';
import { STRATA, signalsOf, primaryStratum, rng } from './strata.mjs';
import { partition, normaliseSegment } from './partition.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUTDIR = path.resolve(HERE, '..');
const CACHE = process.argv[2];
const SEED = Number(process.argv[3] ?? 20260822);
if (!CACHE || !fs.existsSync(CACHE)) {
  console.error('usage: reproducibility-test.mjs <descriptionCacheDir> [seed]');
  process.exit(2);
}

const scrub = s => String(s ?? '')
  .replace(/(?<![A-Za-z0-9])[A-Za-z]:\\(?:Users|Documents and Settings)\\[^\\\t"\r\n]+/gi, '<WINDOWS_USER_PATH>')
  .replace(/(?<![A-Za-z0-9])[A-Za-z]:\\(?:[^\\\t"\r\n]*\\)+[^\\\t"\r\n]+/g, '<WINDOWS_PATH>')
  .replace(/(?:\/home\/|\/Users\/)[A-Za-z0-9._-]+\//g, '<HOME>/');

const discover = () => {
  const out = [];
  const walk = d => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p); else if (e.name.endsWith('.json')) out.push(p);
    }
  };
  walk(CACHE);
  return out;
};

const alreadyRead = new Set(
  JSON.parse(fs.readFileSync(path.join(OUTDIR, 'known-development-sources.json'), 'utf8'))
    .descriptions.map(d => d.nexusId));

/** The whole draw, from a given file list. Mirrors build-sample.mjs. */
function draw(files) {
  const sorted = [...files].sort();
  const all = [];
  const descriptions = new Set();
  const bySegment = new Map();
  for (const f of sorted) {
    let rec;
    try { rec = JSON.parse(fs.readFileSync(f, 'utf8')); } catch { continue; }
    const segs = segments(rec.description);
    descriptions.add(rec.id);
    for (const [i, seg] of segs.entries()) {
      const text = scrub(seg.text);
      if (text.length < 15 || text.length > 600) continue;
      const key = normaliseSegment(text);
      if (key) {
        if (!bySegment.has(key)) bySegment.set(key, new Set());
        bySegment.get(key).add(rec.id);
      }
      all.push({ id: rec.id, i, text });
    }
  }
  const { split } = partition({ descriptions, bySegment, alreadyRead, seed: SEED });

  const pools = new Map(STRATA.map(s => [s.id, []]));
  for (const a of all) pools.get(primaryStratum(a.text)).push(a);

  const DRAW = { background: 1200 };
  const picked = [];
  for (const s of STRATA) {
    const pool = pools.get(s.id);
    const take = Math.min(DRAW[s.id] ?? 150, pool.length);
    const r = rng(SEED + [...s.id].reduce((acc, c) => acc + c.charCodeAt(0), 0));
    const idx = pool.map((_, i) => i);
    for (let i = idx.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    for (const i of idx.slice(0, take)) {
      const p = pool[i];
      picked.push(`${s.id}|${p.id}|${p.i}|${split.get(p.id)}`);
    }
  }
  return picked;
}

const files = discover();
const forward = draw(files);

/* Reversed, then shuffled with a different seed, so nothing about the order of
 * discovery is shared with the first run. */
const jumbled = [...files].reverse();
const r = rng(999983);
for (let i = jumbled.length - 1; i > 0; i--) {
  const j = Math.floor(r() * (i + 1));
  [jumbled[i], jumbled[j]] = [jumbled[j], jumbled[i]];
}
const scrambled = draw(jumbled);

const digest = a => crypto.createHash('sha256').update(a.join('\n')).digest('hex');
const same = digest(forward) === digest(scrambled);

console.log(`files discovered      : ${files.length}`);
console.log(`sample size           : ${forward.length}`);
console.log(`forward-order digest  : ${digest(forward).slice(0, 32)}`);
console.log(`scrambled-order digest: ${digest(scrambled).slice(0, 32)}`);
console.log('');
if (same) {
  console.log('ok    the sample does not depend on the order files are discovered in');
  process.exit(0);
}
const a = new Set(forward);
const differing = scrambled.filter(x => !a.has(x));
console.log(`FAIL  ${differing.length} drawn items differ between the two orders`);
for (const d of differing.slice(0, 5)) console.log(`        ${d}`);
process.exit(1);
