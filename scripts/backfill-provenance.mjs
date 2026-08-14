#!/usr/bin/env node
/**
 * Gives every corpus order a provenance record, including the ones that predate
 * the question.
 *
 *   node scripts/backfill-provenance.mjs [--write]
 *
 * Provenance decides whether an order is allowed to teach VOLO about sequence.
 * An order VOLO sorted proves the mods exist and that somebody ran them, and
 * proves nothing about the order, because the order is VOLO's own answer coming
 * back. Intake has recorded that judgement on every submission for a while.
 *
 * Fifteen orders have no record at all. They arrived before the question was
 * asked, mostly in the founding import, and the miner treats a missing record as
 * independent. That default is almost certainly right, and it is still a default:
 * nothing distinguishes "measured and found independent" from "never looked at",
 * so the corpus cannot answer which orders have actually been checked.
 *
 * This measures them and writes the answer down. `declared` is recorded as
 * unknown rather than guessed, because nobody can now say what those submitters
 * would have answered, and the judge already treats unknown as "decide on the
 * evidence" rather than as either reply.
 *
 * Prints what it would write and exits. Pass --write to apply it.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import { build } from 'esbuild';
import {
  readProvenance, writeProvenance, judge, VOLO_MATCH_THRESHOLD,
} from './corpus-provenance.mjs';

const CORPUS = 'Load Orders - Public Submitted';
const WRITE = process.argv.includes('--write');

const bundle = path.join(os.tmpdir(), `volo-backfill-${process.pid}.mjs`);
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
fs.rmSync(bundle, { force: true });

const masterlist = JSON.parse(fs.readFileSync('masterlist/bg3-masterlist.json', 'utf8'));
const provenance = readProvenance();

/**
 * How much of the submitted sequence VOLO already agrees with.
 *
 * The same pairwise concordance intake measures, so a backfilled figure and a
 * recorded one mean the same thing and can sit in the same file. Measured
 * against today's masterlist rather than the one that existed when the order
 * arrived, which is stated in the record: for these orders no such masterlist
 * was ever built, so there is no earlier figure to prefer.
 */
function agreementAgainst(mods, list) {
  const rank = new Map(mods.map((m, i) => [m.uuid, i]));
  const sorted = sortLoadOrder(mods, list).mods.map(m => m.uuid);
  const seq = sorted.filter(u => rank.has(u)).map(u => rank.get(u));
  let concordant = 0, total = 0;
  for (let i = 0; i < seq.length; i++) {
    for (let j = i + 1; j < seq.length; j++) {
      total++;
      if (seq[i] < seq[j]) concordant++;
    }
  }
  return total ? concordant / total : null;
}

/**
 * The same measurement, against a masterlist this order did not help build.
 *
 * Intake measures an arriving order before admitting it, so its figure is
 * honestly held out. A backfilled order is already in the corpus, so measuring
 * it in place asks how well VOLO agrees with something VOLO was taught by, and
 * the answer flatters it. New8.json scored 0.981 in place and 0.774 once its own
 * contribution was removed. The first reading is above the threshold that
 * withdraws an order's positional evidence, so taking it at face value would
 * have thrown away a 297-mod order's sections on the strength of the order
 * having been listened to.
 *
 * Expensive: it rebuilds the masterlist from the rest of the corpus. Only run
 * for orders the cheap in-place reading already condemns, which is what makes
 * the cost bearable.
 */
function heldOutAgreement(file, mods) {
  const full = path.join(CORPUS, file);
  /*
   * Parked beside the repository rather than in the system temp directory. The
   * checkout can sit on a different drive from %TEMP%, and a rename across
   * devices fails outright on Windows, which took the order out of the corpus in
   * the same breath as failing to measure it.
   */
  const parkDir = path.join(process.cwd(), '.volo-holdout');
  fs.mkdirSync(parkDir, { recursive: true });
  const parked = path.join(parkDir, path.basename(file));
  fs.renameSync(full, parked);
  try {
    execSync('node scripts/mine-corpus.mjs', { stdio: 'ignore' });
    const without = JSON.parse(fs.readFileSync('masterlist/bg3-masterlist.json', 'utf8'));
    return agreementAgainst(mods, without);
  } finally {
    fs.renameSync(parked, full);
    fs.rmSync(parkDir, { recursive: true, force: true });
  }
}

/** Compared by name, because identity is resolved per file and only the miner reconciles it. */
const norm = name => String(name).toLowerCase().replace(/[^a-z0-9]/g, '');

const files = fs.readdirSync(CORPUS).filter(f => f !== 'provenance.json');
const sets = new Map();
const parsedBy = new Map();
for (const file of files) {
  const parsed = parseLoadOrder(fs.readFileSync(path.join(CORPUS, file), 'utf8'), file);
  if (!parsed.mods.length) continue;
  parsedBy.set(file, parsed);
  sets.set(file, new Set(parsed.mods.map(m => norm(m.name)).filter(Boolean)));
}

/** The recorded order this one most resembles, whichever direction it lies in. */
function nearestTo(file) {
  const mine = sets.get(file);
  if (!mine) return null;
  let best = null;
  for (const [other, theirs] of sets) {
    if (other === file) continue;
    let shared = 0;
    for (const name of mine) if (theirs.has(name)) shared++;
    const similarity = shared / (mine.size + theirs.size - shared);
    if (!best || similarity > best.similarity) {
      best = { file: other, similarity, agreementWithVolo: provenance[other]?.agreementWithVolo };
    }
  }
  return best;
}

const missing = files.filter(f => !provenance[f]);
console.log(`corpus orders: ${files.length}`);
console.log(`with a provenance record: ${files.length - missing.length}`);
console.log(`without one: ${missing.length}\n`);

const written = [];
/** Set when a held-out measurement has left the masterlist rebuilt without one order. */
let rebuiltMasterlist = false;
for (const file of missing) {
  const parsed = parsedBy.get(file);
  if (!parsed) {
    console.log(`${file}\n  unreadable, skipped\n`);
    continue;
  }
  const inPlace = agreementAgainst(parsed.mods, masterlist);
  const nearest = nearestTo(file);
  const declared = 'unknown';

  /*
   * Only re-measure what the cheap reading condemns. Everything else is already
   * comfortably below the threshold, and removing the order could only lower the
   * figure further, so a held-out reading cannot change those verdicts.
   */
  let agreement = inPlace;
  let heldOut = null;
  if (inPlace !== null && inPlace >= VOLO_MATCH_THRESHOLD) {
    heldOut = heldOutAgreement(file, parsed.mods);
    agreement = heldOut;
    rebuiltMasterlist = true;
  }

  const sortedByVolo = judge({ declared, agreementWithVolo: agreement, nearest });

  console.log(file);
  console.log(`  mods ${parsed.mods.length}, agreement in place ${inPlace === null ? 'n/a' : inPlace.toFixed(3)}`);
  if (heldOut !== null) {
    console.log(`  above the threshold, so measured again without itself: ${heldOut.toFixed(3)}`);
  }
  if (nearest) {
    console.log(`  nearest ${nearest.file} at ${nearest.similarity.toFixed(3)} similarity`);
  }
  console.log(`  sortedByVolo ${sortedByVolo}\n`);

  written.push({
    file,
    entry: {
      declared,
      agreementWithVolo: agreement === null ? null : Math.round(agreement * 1000) / 1000,
      sortedByVolo,
      // Says the figure was taken later rather than on arrival, so it is not
      // read as the arrival-time measurement the other records hold.
      backfilled: true,
    },
  });
}

const flagged = written.filter(w => w.entry.sortedByVolo);
console.log(`would write ${written.length} record(s); ${flagged.length} judged VOLO-sorted`);
for (const f of flagged) console.log(`  VOLO-sorted: ${f.file}`);

if (WRITE) {
  for (const { file, entry } of written) writeProvenance(file, entry);
  console.log(`\nwritten to ${path.join(CORPUS, 'provenance.json')}`);
} else if (written.length) {
  console.log('\ndry run. pass --write to apply.');
}

/*
 * A held-out measurement leaves the masterlist built from everything except one
 * order. Restoring the order puts the corpus back; only mining again puts the
 * masterlist back, and leaving it wrong would hand the next command a tree that
 * quietly disagrees with the corpus beside it.
 */
if (rebuiltMasterlist) {
  console.log('\nrebuilding the masterlist from the whole corpus again');
  execSync('node scripts/mine-corpus.mjs', { stdio: 'ignore' });
}
