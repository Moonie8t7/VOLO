#!/usr/bin/env node
/**
 * Segment the description cache, assign strata, and draw a reproducible sample.
 *
 *   node research/nexus-prose/scripts/build-sample.mjs <cacheDir> [seed]
 *
 * Writes the manifest, the drawn segments and the blind annotation view. It
 * writes no conclusions and no counts of evidence: every population below is a
 * count of segments a heuristic matched, which is a different thing, and
 * keeping those apart is the discipline this whole directory exists to enforce.
 *
 * The cache itself is about 98MB and is not committed. The manifest records its
 * digest and the digest of these scripts, so a redraw can be shown to be the
 * same experiment rather than merely a similar one.
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
  console.error('usage: build-sample.mjs <descriptionCacheDir> [seed]');
  process.exit(2);
}

/* How many to draw. Background is far larger because it is 90 percent of the
 * corpus and the question it answers is how much lies outside the signals.
 * At 150, observing zero positives leaves a 95 percent upper bound near two
 * percent, which over 181,000 segments is thousands: not a useful bound. */
const DRAW = {
  explicit_relative: 150,
  absolute_region: 150,
  categorical: 150,
  conditional: 150,
  gate_gap: 150,
  overwrite_conflict: 150,
  background: 1200,
};

/*
 * Identifying paths are replaced, not deleted.
 *
 * The sample is quoted verbatim because a tidied sentence is not the sentence
 * anything has to parse. A path still has to go, so it becomes a placeholder
 * that keeps the shape of the sentence and loses the person: removing the span
 * would change the grammar around it, which is the part being evaluated.
 */
const scrub = s => String(s ?? '')
  .replace(/(?<![A-Za-z0-9])[A-Za-z]:\\(?:Users|Documents and Settings)\\[^\\\t"\r\n]+/gi, '<WINDOWS_USER_PATH>')
  .replace(/(?<![A-Za-z0-9])[A-Za-z]:\\(?:[^\\\t"\r\n]*\\)+[^\\\t"\r\n]+/g, '<WINDOWS_PATH>')
  .replace(/(?:\/home\/|\/Users\/)[A-Za-z0-9._-]+\//g, '<HOME>/');

const files = [];
const walk = d => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p); else if (e.name.endsWith('.json')) files.push(p);
  }
};
walk(CACHE);
files.sort();

const corpusDigest = crypto.createHash('sha256');
for (const f of files) corpusDigest.update(path.basename(f));
const generatorDigest = crypto.createHash('sha256');
for (const s of ['segment.mjs', 'strata.mjs', 'build-sample.mjs']) {
  generatorDigest.update(fs.readFileSync(path.join(HERE, s)));
}

/*
 * First pass: segment everything and record which descriptions share text, so
 * pasted boilerplate cannot be split across the experiment.
 */
const all = [];
const descriptions = new Set();
const bySegment = new Map();
let segmentCount = 0;

for (const f of files) {
  let rec;
  try { rec = JSON.parse(fs.readFileSync(f, 'utf8')); } catch { continue; }
  const segs = segments(rec.description);
  descriptions.add(rec.id);
  for (const [i, seg] of segs.entries()) {
    const text = scrub(seg.text);
    if (text.length < 15 || text.length > 600) continue;
    segmentCount++;
    const key = normaliseSegment(text);
    if (key) {
      if (!bySegment.has(key)) bySegment.set(key, new Set());
      bySegment.get(key).add(rec.id);
    }
    all.push({ rec, i, segs, seg, text, key });
  }
}

const alreadyRead = new Set(
  JSON.parse(fs.readFileSync(path.join(OUTDIR, 'known-development-sources.json'), 'utf8'))
    .descriptions.map(d => d.nexusId));

const { split, clusterOf, stats } = partition({
  descriptions, bySegment, alreadyRead, seed: SEED,
});

const pools = new Map(STRATA.map(s => [s.id, []]));
for (const a of all) {
  const { rec, i, segs, seg, text } = a;
  {
    pools.get(primaryStratum(text)).push({
      nexusId: rec.id,
      mod: rec.name,
      author: rec.author ?? '',
      split: split.get(rec.id),
      cluster: clusterOf.get(rec.id),
      index: i,
      heading: scrub(seg.heading),
      prev: i > 0 ? scrub(segs[i - 1].text).slice(0, 300) : '',
      text,
      next: i + 1 < segs.length ? scrub(segs[i + 1].text).slice(0, 300) : '',
      links: seg.links,
      signals: signalsOf(text),
      start: seg.start,
      end: seg.end,
    });
  }
}

const manifest = {
  seed: SEED,
  corpusDigest: corpusDigest.digest('hex'),
  generatorDigest: generatorDigest.digest('hex'),
  descriptions: files.length,
  segments: segmentCount,
  splitBy: 'duplicate-cluster of descriptions',
  testShare: 0.3,
  partition: stats,
  strata: {},
};

const drawn = [];
for (const s of STRATA) {
  const pool = pools.get(s.id);
  const want = DRAW[s.id] ?? 150;
  const take = Math.min(want, pool.length);
  /* Seeded per stratum, so adding one later does not reshuffle the rest. */
  const r = rng(SEED + [...s.id].reduce((a, c) => a + c.charCodeAt(0), 0));
  const idx = pool.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  const picked = idx.slice(0, take).map(i => pool[i]);

  manifest.strata[s.id] = {
    what: s.what,
    population: pool.length,
    sampled: take,
    selectionProbability: pool.length ? take / pool.length : 0,
    inDevelopment: picked.filter(p => p.split === 'development').length,
    inTest: picked.filter(p => p.split === 'test').length,
  };
  for (const [n, p] of picked.entries()) {
    drawn.push({
      id: `${s.id.toUpperCase().slice(0, 4)}-${String(n + 1).padStart(4, '0')}`,
      primaryStratum: s.id,
      populationSize: pool.length,
      selectionProbability: pool.length ? take / pool.length : 0,
      seed: SEED,
      ...p,
    });
  }
}

fs.writeFileSync(path.join(OUTDIR, 'sampling-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
fs.writeFileSync(path.join(OUTDIR, 'segments-sampled.jsonl'),
  `${drawn.map(d => JSON.stringify(d)).join('\n')}\n`);

/* The annotation view. No output of any parser appears in it. */
const COLS = ['id', 'split', 'primary_stratum', 'all_signals', 'nexus_id', 'source_mod', 'url',
  'heading', 'prev_segment', 'segment', 'next_segment', 'links_in_segment',
  'claim_present', 'claim_count', 'notes'];
const tidy = s => String(s ?? '').replace(/[\t\r\n]+/g, ' ').trim();
const tsv = [COLS.join('\t')];
for (const d of drawn) {
  tsv.push([
    d.id, d.split, d.primaryStratum, d.signals.join(' '), d.nexusId, tidy(d.mod),
    `https://www.nexusmods.com/baldursgate3/mods/${d.nexusId}`,
    tidy(d.heading), tidy(d.prev), tidy(d.text), tidy(d.next),
    d.links.join(' '), '', '', '',
  ].join('\t'));
}
fs.writeFileSync(path.join(OUTDIR, 'annotate-blind.tsv'), `${tsv.join('\n')}\n`);

console.log(`descriptions ${files.length}, segments ${segmentCount}`);
console.log(`seed ${SEED}`);
console.log(`corpus    ${manifest.corpusDigest.slice(0, 32)}...`);
console.log(`generator ${manifest.generatorDigest.slice(0, 32)}...\n`);
console.log('stratum              population  sampled  p(select)   dev  test');
for (const [id, s] of Object.entries(manifest.strata)) {
  console.log(`  ${id.padEnd(20)}${String(s.population).padStart(8)}${String(s.sampled).padStart(9)}`
    + `${s.selectionProbability.toFixed(4).padStart(11)}${String(s.inDevelopment).padStart(6)}${String(s.inTest).padStart(6)}`);
}
const multi = drawn.filter(d => d.signals.length > 1).length;
console.log(`\ndrawn ${drawn.length}; ${multi} matched more than one signal`);
