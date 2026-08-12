#!/usr/bin/env node
/**
 * Re-decides every recorded order's provenance against the current rules.
 *
 *   node scripts/rejudge-provenance.mjs [--write]
 *
 * Provenance is decided once, at intake, and recorded. That is the right place
 * for it: the miner and the evaluation both read the recorded answer, so the
 * decision cannot drift between them. It does mean a rule added later applies
 * only to what arrives after it, and the orders already here keep whatever the
 * old rule said.
 *
 * This re-runs the decision over the whole corpus so a new rule reaches the
 * orders that prompted it. Nothing is measured again: the recorded agreement
 * figures are the ones taken when each order arrived, against the masterlist as
 * it was then, which is the honest comparison. Only the verdict is recomputed.
 *
 * Prints what would change and exits. Pass --write to apply it.
 */

import fs from 'fs';
import path from 'path';
import { build } from 'esbuild';
import os from 'os';
import {
  readProvenance, writeProvenance, judge, NEIGHBOUR_SIMILARITY, NEIGHBOUR_JUMP,
} from './corpus-provenance.mjs';

const CORPUS = 'Load Orders - Public Submitted';
const WRITE = process.argv.includes('--write');

const bundle = path.join(os.tmpdir(), `volo-rejudge-${process.pid}.mjs`);
await build({
  stdin: {
    contents: "export { parseLoadOrder } from './client/src/lib/parser';",
    resolveDir: process.cwd(),
    loader: 'ts',
  },
  bundle: true, format: 'esm', platform: 'node', outfile: bundle, logLevel: 'error',
});
const { parseLoadOrder } = await import(`file://${bundle}`);
fs.rmSync(bundle, { force: true });

const provenance = readProvenance();

/**
 * The mods in each order, compared by name.
 *
 * Not by the uuid the parser assigns. That identity is resolved per file, so a
 * thin export and a full export of the same list agree on almost nothing: the
 * two orders this rule exists to catch share 94.7 percent of their mods by name
 * and 44.1 percent by uuid, because one of them was exported without any. Only
 * the miner reconciles identities across the whole corpus, and this runs before
 * it. The name is the one thing every export method writes.
 */
const norm = name => String(name).toLowerCase().replace(/[^a-z0-9]/g, '');
const sets = new Map();
for (const file of Object.keys(provenance)) {
  const full = path.join(CORPUS, file);
  if (!fs.existsSync(full)) continue;
  const parsed = parseLoadOrder(fs.readFileSync(full, 'utf8'), file);
  if (parsed.mods.length) sets.set(file, new Set(parsed.mods.map(m => norm(m.name)).filter(Boolean)));
}

/** The recorded order this one most resembles, whichever direction it lies in. */
function nearestTo(file) {
  const mine = sets.get(file);
  if (!mine) return null;
  let best = null;
  for (const [other, theirs] of sets) {
    if (other === file) continue;
    let shared = 0;
    for (const uuid of mine) if (theirs.has(uuid)) shared++;
    const similarity = shared / (mine.size + theirs.size - shared);
    if (!best || similarity > best.similarity) {
      best = { file: other, similarity, agreementWithVolo: provenance[other]?.agreementWithVolo };
    }
  }
  return best;
}

const changed = [];
for (const [file, record] of Object.entries(provenance)) {
  const nearest = nearestTo(file);
  const verdict = judge({ ...record, nearest });
  if (verdict !== record.sortedByVolo) changed.push({ file, record, nearest, verdict });
}

console.log(`rules: similarity >= ${NEIGHBOUR_SIMILARITY}, agreement jump > ${NEIGHBOUR_JUMP}`);
console.log(`orders with recorded provenance: ${Object.keys(provenance).length}`);
console.log(`verdicts that change: ${changed.length}\n`);

for (const { file, record, nearest, verdict } of changed) {
  console.log(`${file}`);
  console.log(`  declared ${record.declared}, agreement ${record.agreementWithVolo}`);
  console.log(
    `  nearest  ${nearest.file} at ${nearest.similarity.toFixed(3)} similarity, `
    + `agreement ${nearest.agreementWithVolo}`,
  );
  console.log(`  sortedByVolo ${record.sortedByVolo} -> ${verdict}\n`);
}

if (!changed.length) {
  console.log('nothing to do.');
} else if (WRITE) {
  for (const { file, record, verdict } of changed) {
    writeProvenance(file, { ...record, sortedByVolo: verdict });
  }
  console.log(`written to ${path.join(CORPUS, 'provenance.json')}`);
} else {
  console.log('dry run. pass --write to apply.');
}
