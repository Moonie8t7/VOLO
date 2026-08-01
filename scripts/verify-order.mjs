#!/usr/bin/env node
/**
 * Verifies VOLO's ordering against load orders known to work.
 *
 * This is the "Verified" in Verified Order and Load Optimisation. A submitter
 * says their order works. We sort the same mods ourselves and measure how much
 * we agree with them, pair by pair.
 *
 * The metric is the fraction of mod pairs placed in the same relative order as
 * the working order. Random shuffling scores about 0.5, so anything near that is
 * noise. Perfect agreement is 1.0, but perfect is not the target: a working
 * order is one valid arrangement, not the only one, and a submitter's exact
 * sequence includes plenty of arbitrary choices. What matters is being clearly
 * better than chance, and never worse than leaving the order alone.
 *
 *   node scripts/verify-order.mjs
 */

import { build } from 'esbuild';
import fs from 'fs';
import path from 'path';
import os from 'os';

const CORPUS = 'Load Orders - Public Submitted';
const out = path.join(os.tmpdir(), `volo-verify-${process.pid}.mjs`);

await build({
  stdin: {
    contents: `
      export { parseLoadOrder } from './client/src/lib/parser';
      export { sortLoadOrder } from './client/src/lib/optimiser';
    `,
    resolveDir: process.cwd(),
    loader: 'ts',
  },
  bundle: true, format: 'esm', platform: 'node', outfile: out, logLevel: 'error',
});

const { parseLoadOrder, sortLoadOrder } = await import(`file://${out}`);
const masterlist = JSON.parse(fs.readFileSync('masterlist/bg3-masterlist.json', 'utf8'));

/**
 * Fraction of pairs whose relative order matches the reference.
 * Counts every pair once, so it is Kendall's tau rescaled to 0..1.
 */
function agreement(reference, candidate) {
  const rank = new Map(reference.map((u, i) => [u, i]));
  const seq = candidate.filter(u => rank.has(u)).map(u => rank.get(u));
  let concordant = 0, total = 0;
  for (let i = 0; i < seq.length; i++) {
    for (let j = i + 1; j < seq.length; j++) {
      total++;
      if (seq[i] < seq[j]) concordant++;
    }
  }
  return total ? concordant / total : 0;
}

function shuffled(arr, seed = 7) {
  // Deterministic shuffle so the baseline is reproducible run to run.
  const a = [...arr];
  let s = seed;
  const rand = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// current_ prefixed orders were personally played by the maintainer, so they
// count as verified working alongside the working_ submissions.
const isWorking = f => /^working_/i.test(f) || /^current_/i.test(f);

const rows = [];
for (const file of fs.readdirSync(CORPUS).sort()) {
  const raw = fs.readFileSync(path.join(CORPUS, file), 'utf8');
  const parsed = parseLoadOrder(raw, file);
  if (parsed.mods.length < 20) continue;

  const reference = parsed.mods.map(m => m.uuid);
  const result = sortLoadOrder(parsed.mods, masterlist);

  rows.push({
    file,
    working: isWorking(file),
    mods: parsed.mods.length,
    volo: agreement(reference, result.mods.map(m => m.uuid)),
    random: agreement(reference, shuffled(reference)),
    known: result.stats.knownToMasterlist / parsed.mods.length,
    moved: result.stats.moved / parsed.mods.length,
  });
}

const pct = v => (100 * v).toFixed(1).padStart(5);

console.log('Agreement with the submitted order, pair by pair.');
console.log('VOLO should sit well above random. Closer to 100 is not automatically');
console.log('better: it would mean we only ever reproduce what we were given.\n');
console.log('file                                            mods   VOLO  random  known');
for (const r of rows) {
  console.log(
    `${r.working ? '[w] ' : '    '}${r.file.slice(0, 42).padEnd(44)}${String(r.mods).padStart(5)}  ${pct(r.volo)}  ${pct(r.random)}  ${pct(r.known)}`,
  );
}

const working = rows.filter(r => r.working);
const broken = rows.filter(r => !r.working);
const mean = (set, k) => set.length ? set.reduce((a, b) => a + b[k], 0) / set.length : 0;

console.log('\n=== SUMMARY ===');
console.log(`working orders  n=${working.length}   VOLO ${pct(mean(working, 'volo'))}%   random ${pct(mean(working, 'random'))}%`);
console.log(`other orders    n=${broken.length}   VOLO ${pct(mean(broken, 'volo'))}%   random ${pct(mean(broken, 'random'))}%`);

const lift = mean(working, 'volo') - mean(working, 'random');
console.log(`\nlift over chance on working orders: ${(100 * lift).toFixed(1)} points`);

fs.rmSync(out, { force: true });
