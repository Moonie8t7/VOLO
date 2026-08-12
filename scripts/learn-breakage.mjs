#!/usr/bin/env node
/**
 * What do the broken load orders do that the working ones never do?
 *
 * Three candidate breakage signals, each checked against the working corpus as
 * a control, because a signal that fires equally on working orders explains
 * nothing:
 *
 *   1. Convention violations: category pairs ordered against a strong working
 *      consensus (at least 75 percent agreement over at least 500 observed
 *      pairs).
 *   2. Unvetted mods: mods that appear in a broken order and in no working
 *      order anywhere in the corpus.
 *   3. Missing declared dependencies, where metadata is present to check.
 *
 * The measurement is exported as well as printed, because the answer belongs
 * in the coverage report where somebody sees it. Left only here it was run
 * once, and the finding that the first of those three signals points the
 * wrong way went unrecorded.
 *
 * This file no longer reads the corpus. It used to keep a private copy of the
 * reader, the separator rule and the identity rule, and all three drifted from
 * the miner's. It could not parse modsettings.lsx at all, so four submitted
 * orders were silently invisible to every number below; it identified mods by
 * the UUID field alone, so a thin export or a TSV contributed nothing; it
 * counted divider paks as mods; and it read declared dependencies with the same
 * character-by-character loop that cost the miner a third of its requirements.
 * Three of the six figures it published were wrong as a result.
 *
 * The miner has already read, identified and cleaned every order by the time it
 * asks for this measurement, so it passes that in. There is one reader in this
 * project now, and one rule for what counts as a mod.
 */

import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

const MIN_N = 500, MIN_RATE = 0.75;

/**
 * Measure all three signals.
 *
 * @param plugins the masterlist entries, so a mine can measure the masterlist
 *   it has just built rather than the previous one.
 * @param orders  one entry per corpus order: `{ file, label, mods }`, where each
 *   mod is `{ uuid, name, deps: [{ uuid, name }] }`. Dividers, separators and
 *   engine modules are expected to be gone already, and every uuid is expected
 *   to be the identity the masterlist uses.
 */
export function measureBreakage(plugins, orders) {
  const groupOf = new Map(plugins.map(p => [p.uuid, p.group]));
  const workingInstalls = new Map(plugins.map(p => [p.uuid, p.evidence?.workingInstalls ?? 0]));

  const wins = new Map();
  const key = (a, b) => `${a}|${b}`;
  const placed = mods => mods
    .map(m => groupOf.get(m.uuid))
    .filter(g => g && g !== 'unsorted' && g !== 'Miscellaneous');

  for (const order of orders) {
    if (order.label !== 'working') continue;
    const cats = placed(order.mods);
    for (let i = 0; i < cats.length; i++) {
      for (let j = i + 1; j < cats.length; j++) {
        if (cats[i] === cats[j]) continue;
        wins.set(key(cats[i], cats[j]), (wins.get(key(cats[i], cats[j])) || 0) + 1);
      }
    }
  }

  const consensus = new Map(); // "A|B" where A before B is the strong convention
  for (const [k, ab] of wins) {
    const [a, b] = k.split('|');
    const ba = wins.get(key(b, a)) || 0;
    const total = ab + ba;
    if (total >= MIN_N && ab / total >= MIN_RATE) consensus.set(k, { rate: ab / total, n: total });
  }

  /** Score one order against the three signals. */
  const assess = order => {
    const mods = order.mods;

    // 1. convention violations, counted per offending mod pair category
    const seq = mods.map(m => ({ uuid: m.uuid, g: groupOf.get(m.uuid) }))
      .filter(m => m.g && m.g !== 'unsorted' && m.g !== 'Miscellaneous');
    const violations = new Map();
    let checked = 0, violated = 0;
    for (let i = 0; i < seq.length; i++) {
      for (let j = i + 1; j < seq.length; j++) {
        const a = seq[i].g, b = seq[j].g;
        if (a === b) continue;
        // convention says b should come before a, but here a came first
        if (consensus.has(key(b, a))) {
          violated++;
          violations.set(`${a} loading before ${b}`, (violations.get(`${a} loading before ${b}`) || 0) + 1);
        }
        if (consensus.has(key(a, b)) || consensus.has(key(b, a))) checked++;
      }
    }

    // 2. mods never seen in any working order
    const unvetted = mods.filter(m => (workingInstalls.get(m.uuid) ?? 0) === 0);

    // 3. missing declared dependencies
    const present = new Set(mods.map(m => m.uuid));
    const byName = new Map(mods.map(m => [String(m.name).toLowerCase().replace(/[^a-z0-9]/g, ''), m]));
    const missing = [];
    for (const m of mods) {
      for (const d of m.deps ?? []) {
        if (!d?.name) continue;
        // A requirement stated by name only is still checkable against the
        // order in front of us, and the TSV exports state most of theirs that
        // way. Requiring a uuid here is what made this signal read zero.
        const held = d.uuid
          ? present.has(d.uuid)
          : byName.has(String(d.name).toLowerCase().replace(/[^a-z0-9]/g, ''));
        if (!held) missing.push(`${m.name} needs ${d.name}`);
      }
    }

    return {
      file: order.file, mods: mods.length,
      violationRate: checked ? violated / checked : 0,
      topViolations: [...violations.entries()].sort((x, y) => y[1] - x[1]).slice(0, 4),
      unvettedShare: mods.length ? unvetted.length / mods.length : 0,
      unvettedCount: unvetted.length,
      missingDeps: missing,
    };
  };

  const rows = orders.map(order => ({
    label: order.label === 'broken' ? 'BROKEN ' : order.label === 'working' ? 'working' : 'other  ',
    ...assess(order),
  }));

  const mean = (set, k) => (set.length ? set.reduce((a, b) => a + b[k], 0) / set.length : 0);
  const broken = rows.filter(r => r.label === 'BROKEN ');
  const working = rows.filter(r => r.label === 'working');

  return {
    conventions: consensus.size,
    rows,
    broken,
    working,
    separation: {
      violationRate: { broken: mean(broken, 'violationRate'), working: mean(working, 'violationRate') },
      unvettedShare: { broken: mean(broken, 'unvettedShare'), working: mean(working, 'unvettedShare') },
      missingDeps: {
        broken: mean(broken.map(r => ({ n: r.missingDeps.length })), 'n'),
        working: mean(working.map(r => ({ n: r.missingDeps.length })), 'n'),
      },
      counts: { broken: broken.length, working: working.length },
    },
  };
}

/*
 * Run directly, this can only say where the answer lives. Measuring needs the
 * corpus read and identified, and doing that here is what put four wrong
 * numbers into a published file. The miner runs this on every build.
 */
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const report = path.join('masterlist', 'coverage-report.md');
  console.log('This measurement runs inside scripts/mine-corpus.mjs, which supplies the');
  console.log('orders it has already read and identified. Run:\n');
  console.log('  node scripts/mine-corpus.mjs\n');
  console.log(`and read "What the broken orders do differently" in ${report}.`);
  if (fs.existsSync(report)) {
    const text = fs.readFileSync(report, 'utf8');
    const at = text.indexOf('## What the broken orders do differently');
    if (at !== -1) console.log(`\n${text.slice(at, text.indexOf('\n## ', at + 5))}`);
  }
}
