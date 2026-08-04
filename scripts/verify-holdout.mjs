#!/usr/bin/env node
/**
 * Honest evaluation: how well does VOLO order an order it has never seen?
 *
 *   node scripts/verify-holdout.mjs
 *
 * scripts/verify-order.mjs scores the sorter against the same working orders
 * the masterlist was built from. That is the right measure for comparing two
 * candidate rule sets, because both sides are scored identically, but as an
 * absolute number it flatters us: the masterlist has already read the answer.
 *
 * This rebuilds the masterlist once per working order with that order left
 * out, sorts the held-out order against the result, and reports the gap. The
 * held-out figure is the one to quote publicly, because it is the situation
 * every real user is in.
 *
 * One honesty caveat of its own: the group ordering baked into
 * scripts/mine-corpus.mjs was derived from the whole corpus, so it is not
 * re-learned per fold. A coarse 27-group ranking is unlikely to memorise any
 * single order, but the held-out number below is still very slightly
 * optimistic rather than perfectly clean.
 */

import { build } from 'esbuild';
import { execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const CORPUS = 'Load Orders - Public Submitted';
const bundle = path.join(os.tmpdir(), `volo-holdout-${process.pid}.mjs`);

await build({
  stdin: {
    contents: `
      export { parseLoadOrder } from './client/src/lib/parser';
      export { sortLoadOrder } from './client/src/lib/optimiser';
    `,
    resolveDir: process.cwd(),
    loader: 'ts',
  },
  bundle: true, format: 'esm', platform: 'node', outfile: bundle, logLevel: 'error',
});
const { parseLoadOrder, sortLoadOrder } = await import(`file://${bundle}`);

/** Identical metric to verify-order.mjs, so the two numbers are comparable. */
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
  const a = [...arr];
  let s = seed;
  const rand = () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const isWorking = f => /^working_/i.test(f) || /^current_/i.test(f);
const external = fs.existsSync('masterlist/external-categories.json')
  ? JSON.parse(fs.readFileSync('masterlist/external-categories.json', 'utf8'))
  : null;
// Nexus curates a category tree; mod.io categorises with loosely applied tags.
// Measuring them apart shows whether either is worth consulting at all.
const nexusOnly = external ? { ...external, modio: {} } : null;
const inSampleList = JSON.parse(fs.readFileSync('masterlist/bg3-masterlist.json', 'utf8'));

const files = fs.readdirSync(CORPUS).filter(isWorking).sort();
const rows = [];

for (const file of files) {
  const parsed = parseLoadOrder(fs.readFileSync(path.join(CORPUS, file), 'utf8'), file);
  if (parsed.mods.length < 20) continue;
  const reference = parsed.mods.map(m => m.uuid);

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'volo-fold-'));
  try {
    execSync(
      `node scripts/mine-corpus.mjs --exclude "${file}" --out "${tmp}"`,
      { stdio: 'pipe' },
    );
    const heldList = JSON.parse(fs.readFileSync(path.join(tmp, 'bg3-masterlist.json'), 'utf8'));

    rows.push({
      file,
      mods: parsed.mods.length,
      inSample: agreement(reference, sortLoadOrder(parsed.mods, inSampleList).mods.map(m => m.uuid)),
      heldOut: agreement(reference, sortLoadOrder(parsed.mods, heldList).mods.map(m => m.uuid)),
      heldOutNexus: agreement(
        reference,
        sortLoadOrder(parsed.mods, heldList, nexusOnly).mods.map(m => m.uuid),
      ),
      heldOutExternal: agreement(
        reference,
        sortLoadOrder(parsed.mods, heldList, external).mods.map(m => m.uuid),
      ),
      random: agreement(reference, shuffled(reference)),
      // How much of this order the masterlist recognises once it has not read it.
      known: sortLoadOrder(parsed.mods, heldList).stats.knownToMasterlist / parsed.mods.length,
    });
    process.stderr.write(`.`);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}
process.stderr.write('\n');

const pct = v => (100 * v).toFixed(1).padStart(6);
const mean = k => rows.reduce((a, b) => a + b[k], 0) / (rows.length || 1);

console.log('Held-out evaluation: each order sorted by a masterlist built without it.\n');
console.log('order                                        mods  in-sample  held-out  +nexus  +both  random');
for (const r of rows) {
  console.log(
    `${r.file.slice(0, 42).padEnd(44)}${String(r.mods).padStart(5)}  ${pct(r.inSample)}   ${pct(r.heldOut)} ${pct(r.heldOutNexus)} ${pct(r.heldOutExternal)} ${pct(r.random)}`,
  );
}

console.log('\n=== SUMMARY ===');
console.log(`orders evaluated        ${rows.length}`);
console.log(`in-sample agreement     ${pct(mean('inSample'))}%   (what verify-order reports)`);
console.log(`held-out agreement      ${pct(mean('heldOut'))}%   (what a new user gets)`);
console.log(`held-out + Nexus only   ${pct(mean('heldOutNexus'))}%   (Nexus categories consulted)`);
console.log(`held-out + both         ${pct(mean('heldOutExternal'))}%   (Nexus and mod.io consulted)`);
console.log(`random baseline         ${pct(mean('random'))}%`);

const optimism = mean('inSample') - mean('heldOut');
const best = Math.max(mean('heldOut'), mean('heldOutNexus'), mean('heldOutExternal'));
const lift = best - mean('random');
console.log(`\noptimism of the in-sample figure: ${(100 * optimism).toFixed(1)} points`);
console.log(`honest lift over chance:          ${(100 * lift).toFixed(1)} points`);

fs.rmSync(bundle, { force: true });
