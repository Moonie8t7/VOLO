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
 *   node scripts/learn-breakage.mjs
 *
 * The measurement is exported as well as printed, because the answer belongs
 * in the coverage report where somebody sees it. Left only here it was run
 * once, and the finding that the first of those three signals points the
 * wrong way went unrecorded.
 */

import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

const CORPUS = 'Load Orders - Public Submitted';
const SEPARATOR_RE = /[-=_~]{4,}|^\s*[\]>]\s*\S|^\s*\|.*\|\s*$/;

let groupOf = new Map();
let workingInstalls = new Map();

function readOrder(f) {
  const raw = fs.readFileSync(path.join(CORPUS, f), 'utf8');
  if (f.endsWith('.tsv')) {
    const lines = raw.split(/\r?\n/).filter(Boolean);
    const hdr = lines[0].split('\t').map(h => h.trim());
    return lines.slice(1).map(l => { const c = l.split('\t'); return Object.fromEntries(hdr.map((h, i) => [h, c[i]])); });
  }
  let j; try { j = JSON.parse(raw); } catch { return null; }
  return Array.isArray(j.Order) ? j.Order : Array.isArray(j.Mods) ? j.Mods : Array.isArray(j) ? j : null;
}

const isWorking = f => /^working_/i.test(f) || /^current_/i.test(f);
const isBroken = f => /not[-_]working/i.test(f);

const MIN_N = 500, MIN_RATE = 0.75;
const ENGINE = JSON.parse(
  fs.readFileSync(path.join('client', 'src', 'lib', 'engine-modules.json'), 'utf8'),
).modules;

/**
 * Measure all three signals against the given masterlist entries.
 *
 * Takes the plugins rather than reading the masterlist from disk, so a mine
 * can measure the masterlist it has just built instead of the previous one.
 */
export function measureBreakage(plugins) {
  groupOf = new Map(plugins.map(p => [p.uuid, p.group]));
  workingInstalls = new Map(plugins.map(p => [p.uuid, p.evidence?.workingInstalls ?? 0]));

  const files = fs.readdirSync(CORPUS).sort();
  const wins = new Map();
  const key = (a, b) => `${a}|${b}`;

  for (const f of files) {
    if (!isWorking(f)) continue;
    const entries = readOrder(f);
    if (!entries) continue;
    const cats = entries
      .filter(e => e?.UUID && e?.Name && !SEPARATOR_RE.test(e.Name))
      .map(e => groupOf.get(e.UUID))
      .filter(g => g && g !== 'unsorted' && g !== 'Miscellaneous');
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
  const assess = f => {
    const entries = readOrder(f);
    if (!entries) return null;
    const mods = entries.filter(e => e?.UUID && e?.Name && !SEPARATOR_RE.test(e.Name));

    // 1. convention violations, counted per offending mod pair category
    const seq = mods.map(e => ({ uuid: e.UUID, g: groupOf.get(e.UUID) }))
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
    const unvetted = mods.filter(e => (workingInstalls.get(e.UUID) ?? 0) === 0);

    // 3. missing declared dependencies
    const present = new Set(mods.map(e => e.UUID));
    const missing = [];
    for (const e of mods) {
      for (const d of e.Dependencies ?? []) {
        if (!d?.UUID || !d?.Name) continue;
        if (ENGINE.includes(d.Name)) continue;
        if (!present.has(d.UUID)) missing.push(`${e.Name} needs ${d.Name}`);
      }
    }

    return {
      file: f, mods: mods.length,
      violationRate: checked ? violated / checked : 0,
      topViolations: [...violations.entries()].sort((x, y) => y[1] - x[1]).slice(0, 4),
      unvettedShare: mods.length ? unvetted.length / mods.length : 0,
      unvettedCount: unvetted.length,
      missingDeps: missing,
    };
  };

  const rows = [];
  for (const f of files) {
    const r = assess(f);
    if (!r) continue;
    rows.push({ label: isBroken(f) ? 'BROKEN ' : isWorking(f) ? 'working' : 'other  ', ...r });
  }

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

// Printed only when run directly, so importing it measures without shouting.
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const ml = JSON.parse(fs.readFileSync(path.join('masterlist', 'bg3-masterlist.json'), 'utf8'));
  const out = measureBreakage(ml.plugins);
  console.log(`strong working conventions (>=${MIN_RATE * 100}% over >=${MIN_N} pairs): ${out.conventions}`);
  console.log('\nfile                                            mods  conv.viol  unvetted  missing deps');
  for (const r of out.rows) {
    console.log(
      `${r.label} ${r.file.slice(0, 42).padEnd(44)}${String(r.mods).padStart(5)}   ${(100 * r.violationRate).toFixed(1).padStart(6)}%   ${(100 * r.unvettedShare).toFixed(0).padStart(5)}%   ${r.missingDeps.length}`,
    );
  }
  const s = out.separation;
  console.log('\n=== SEPARATION ===');
  console.log(`convention violations   broken ${(100 * s.violationRate.broken).toFixed(1)}%   working ${(100 * s.violationRate.working).toFixed(1)}%`);
  console.log(`unvetted mods           broken ${(100 * s.unvettedShare.broken).toFixed(0)}%   working ${(100 * s.unvettedShare.working).toFixed(0)}%`);

  console.log('\n=== WHAT THE BROKEN ORDERS SPECIFICALLY DO ===');
  for (const r of out.broken) {
    console.log(`\n${r.file}`);
    for (const [v, n] of r.topViolations) console.log(`  ${n} pairs: ${v}`);
    for (const m of r.missingDeps.slice(0, 5)) console.log(`  missing dependency: ${m}`);
    console.log(`  ${r.unvettedCount} mods never seen in any working order`);
  }
}
