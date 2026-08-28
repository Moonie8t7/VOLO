#!/usr/bin/env node
/**
 * Explains what is probably wrong with a load order, by comparing it against
 * the orders the community has confirmed working and against the masterlist.
 *
 *   node scripts/diagnose-order.mjs "<order file>"
 *
 * Written for broken submissions: "it did not work" on its own teaches only
 * caution, but the same order read against the corpus often says exactly where
 * it disagrees with orders that do work. Three kinds of finding, strongest
 * first:
 *
 *   1. Declared dependencies loading after the mod that requires them. The mod
 *      metadata states this outright, so it is fact rather than inference.
 *   2. Pairs the working orders contradict. If eight working orders put A
 *      before B and this order has B first, that is a real disagreement with
 *      evidence behind it, not a guess.
 *   3. Mods that appear in no working order at all. Nothing here is proven to
 *      work anywhere, so an unexplained failure starts with these.
 *
 * Output is markdown, for pasting into a submission report.
 */

import { build } from 'esbuild';
import fs from 'fs';
import os from 'os';
import path from 'path';

const CORPUS = 'Load Orders - Public Submitted';
const MASTERLIST = path.join('masterlist', 'bg3-masterlist.json');

/** A contradiction needs this many working orders behind it to be reported. */
const MIN_WITNESSES = 3;
/** And this share of them must agree, so one outlier cannot accuse anyone. */
const MIN_AGREEMENT = 0.8;
/** Findings shown per section, so a report stays readable. */
const MAX_SHOWN = 12;

const args = process.argv.slice(2);
const flag = name => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : null;
};

const target = args.find(a => !a.startsWith('--') && a !== flag('mod'));

/**
 * Diagnose what VOLO would produce from this order, rather than the order as
 * submitted.
 *
 * A placement report attaches an order that works, so diagnosing it finds
 * nothing: the reporter already has the mod in the right place. The thing under
 * suspicion is VOLO's own answer, and this asks the corpus about that instead.
 */
const SORTED = args.includes('--sorted');

/**
 * Narrow every finding to one mod.
 *
 * A placement report names the mod it is about, and a report on a thousand-mod
 * order buries that mod in three hundred other findings. Reported both ways
 * round, because the complaint may be that the mod loads too early or too late
 * and the caller does not have to know which.
 */
const ONLY = flag('mod');

if (!target || !fs.existsSync(target)) {
  console.error('usage: node scripts/diagnose-order.mjs "<order file>" [--sorted] [--mod "<name>"]');
  process.exit(2);
}

const bundle = path.join(os.tmpdir(), `volo-diagnose-${process.pid}.mjs`);
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

const read = file => {
  try {
    return parseLoadOrder(fs.readFileSync(file, 'utf8'), path.basename(file));
  } catch {
    return null;
  }
};

const parsedTarget = read(target);
if (!parsedTarget?.mods.length) {
  console.log('The order could not be read for diagnosis.');
  process.exit(0);
}

const subject = SORTED
  ? { mods: sortLoadOrder(parsedTarget.mods, JSON.parse(fs.readFileSync(MASTERLIST, 'utf8'))).mods }
  : parsedTarget;

/** Working orders carry the naming convention the whole pipeline relies on. */
const isWorking = name => /^(working_|current_)/i.test(name);

const workingOrders = fs.readdirSync(CORPUS)
  .filter(f => isWorking(f) && f !== path.basename(target))
  .map(f => read(path.join(CORPUS, f)))
  .filter(p => p?.mods.length)
  .map(p => p.mods.map(m => m.uuid));

const subjectUuids = subject.mods.map(m => m.uuid);
const nameOf = new Map(subject.mods.map(m => [m.uuid, m.name]));
const positionOf = new Map(subjectUuids.map((u, i) => [u, i]));
const present = new Set(subjectUuids);

const lines = ['### What the corpus says about this order', ''];

if (!workingOrders.length) {
  lines.push('There are no working orders to compare against yet.');
  console.log(lines.join('\n'));
  process.exit(0);
}

/** How much evidence exists at all: a mod nobody has run tells us nothing. */
const seenInWorking = new Map();
for (const seq of workingOrders) {
  for (const uuid of new Set(seq)) {
    if (present.has(uuid)) seenInWorking.set(uuid, (seenInWorking.get(uuid) ?? 0) + 1);
  }
}
const covered = seenInWorking.size;
lines.push(
  `Compared against ${workingOrders.length} working orders. ` +
  `${covered} of ${subjectUuids.length} mods here appear in at least one of them.`,
  '',
);

/** 1. Declared dependencies pointing the wrong way. Stated by the mod itself. */
const depFindings = [];
for (const mod of subject.mods) {
  for (const dep of mod.dependencies ?? []) {
    const depPos = positionOf.get(dep.uuid);
    if (depPos === undefined) continue;
    if (depPos > positionOf.get(mod.uuid)) {
      depFindings.push(`- **${mod.name}** requires **${dep.name}**, which loads after it here.`);
    }
  }
}
if (depFindings.length) {
  lines.push('#### Declared dependencies in the wrong order', '');
  lines.push(...depFindings.slice(0, MAX_SHOWN));
  if (depFindings.length > MAX_SHOWN) lines.push(`- and ${depFindings.length - MAX_SHOWN} more`);
  lines.push('');
}

/**
 * 2. Pairs the working orders order the other way round. Only pairs where both
 * mods are in this order matter, which keeps the comparison cheap.
 */
const pairs = new Map();
for (const seq of workingOrders) {
  const kept = seq.filter(u => present.has(u));
  for (let i = 0; i < kept.length; i++) {
    for (let j = i + 1; j < kept.length; j++) {
      const a = kept[i], b = kept[j];
      if (a === b) continue;
      const key = a < b ? `${a}|${b}` : `${b}|${a}`;
      const rec = pairs.get(key) ?? { lowFirst: 0, highFirst: 0 };
      if (a < b) rec.lowFirst++; else rec.highFirst++;
      pairs.set(key, rec);
    }
  }
}

/**
 * Aggregate by mod rather than listing every pair: one misplaced mod generates
 * hundreds of contradicted pairs, and the mod is the actionable unit.
 */
const against = new Map();
for (let i = 0; i < subjectUuids.length; i++) {
  for (let j = i + 1; j < subjectUuids.length; j++) {
    const a = subjectUuids[i], b = subjectUuids[j];
    const key = a < b ? `${a}|${b}` : `${b}|${a}`;
    const rec = pairs.get(key);
    if (!rec) continue;
    const witnesses = rec.lowFirst + rec.highFirst;
    if (witnesses < MIN_WITNESSES) continue;
    // What the working orders say comes first.
    const cameFirst = rec.lowFirst >= rec.highFirst ? (a < b ? a : b) : (a < b ? b : a);
    const share = Math.max(rec.lowFirst, rec.highFirst) / witnesses;
    if (share < MIN_AGREEMENT) continue;
    // This order has a before b; a contradiction is the corpus saying b first.
    if (cameFirst !== b) continue;
    const entry = against.get(a) ?? { count: 0, best: null };
    entry.count++;
    if (!entry.best || witnesses > entry.best.witnesses) {
      entry.best = { other: b, witnesses, share };
    }
    against.set(a, entry);
  }
}

let ranked = [...against.entries()]
  .sort((x, y) => y[1].count - x[1].count || y[1].best.witnesses - x[1].best.witnesses);

if (ONLY) {
  const norm = s => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
  const wanted = norm(ONLY);
  const matches = [...nameOf.entries()].filter(([, n]) => norm(n) === wanted).map(([u]) => u);
  if (!matches.length) {
    // Said plainly rather than reported as a clean bill of health. An empty
    // result and a mod that is not in the order look identical downstream, and
    // only one of them means nothing is wrong.
    console.log(`### What the corpus says about "${ONLY}"\n`);
    console.log(`That mod is not in ${path.basename(target)}, so there is nothing to compare.`);
    process.exit(0);
  }
  const keep = new Set(matches);
  ranked = ranked.filter(([uuid]) => keep.has(uuid));
  lines[0] = `### What the corpus says about "${nameOf.get(matches[0])}"`;
}

if (ranked.length) {
  lines.push('#### Placements the working orders disagree with', '');
  for (const [uuid, info] of ranked.slice(0, MAX_SHOWN)) {
    const pct = Math.round(info.best.share * 100);
    lines.push(
      `- **${nameOf.get(uuid)}** loads before ${info.count} ` +
      `${info.count === 1 ? 'mod that working orders place' : 'mods that working orders place'} ` +
      `earlier. Clearest case: **${nameOf.get(info.best.other)}** comes first in ` +
      `${pct} percent of the ${info.best.witnesses} working orders holding both.`,
    );
  }
  if (ranked.length > MAX_SHOWN) lines.push(`- and ${ranked.length - MAX_SHOWN} more`);
  lines.push('');
} else {
  lines.push(
    '#### Placements the working orders disagree with',
    '',
    'None. Every pair with enough evidence behind it sits the way working orders sit.',
    '',
  );
}

/** 3. Mods no working order contains. Not proof of fault, but the place to look. */
const unverified = subjectUuids.filter(u => !seenInWorking.has(u));
if (unverified.length) {
  lines.push('#### Mods not present in any working order', '');
  for (const uuid of unverified.slice(0, MAX_SHOWN)) lines.push(`- ${nameOf.get(uuid)}`);
  if (unverified.length > MAX_SHOWN) lines.push(`- and ${unverified.length - MAX_SHOWN} more`);
  lines.push('');
  lines.push(
    'These are unproven rather than guilty: nothing in the corpus shows them ' +
    'working alongside the rest of this order.',
    '',
  );
}

// What the masterlist would do differently, as a summary rather than a list.
if (fs.existsSync(MASTERLIST)) {
  const masterlist = JSON.parse(fs.readFileSync(MASTERLIST, 'utf8'));
  const rank = new Map(masterlist.groups.map((g, i) => [g.name, i]));
  const groupOf = new Map(masterlist.plugins.map(p => [p.uuid, p.group]));
  let inversions = 0;
  for (let i = 1; i < subjectUuids.length; i++) {
    const prev = rank.get(groupOf.get(subjectUuids[i - 1])) ?? Number.MAX_SAFE_INTEGER;
    const curr = rank.get(groupOf.get(subjectUuids[i])) ?? Number.MAX_SAFE_INTEGER;
    if (curr < prev) inversions++;
  }
  lines.push(
    `Against the masterlist's category order, ${inversions} of ` +
    `${Math.max(subjectUuids.length - 1, 1)} adjacent pairs sit out of sequence.`,
  );
}

console.log(lines.join('\n'));
