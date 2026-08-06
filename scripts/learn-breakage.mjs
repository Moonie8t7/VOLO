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
 */

import fs from 'fs';
import path from 'path';

const CORPUS = 'Load Orders - Public Submitted';
const SEPARATOR_RE = /[-=_~]{4,}|^\s*[\]>]\s*\S|^\s*\|.*\|\s*$/;

const ml = JSON.parse(fs.readFileSync('masterlist/bg3-masterlist.json', 'utf8'));
const groupOf = new Map(ml.plugins.map(p => [p.uuid, p.group]));
const nameOf = new Map(ml.plugins.map(p => [p.uuid, p.name]));
const workingInstalls = new Map(ml.plugins.map(p => [p.uuid, p.evidence?.workingInstalls ?? 0]));

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

/** Build the strong working consensus at category level. */
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

const MIN_N = 500, MIN_RATE = 0.75;
const consensus = new Map(); // "A|B" where A before B is the strong convention
for (const [k, ab] of wins) {
  const [a, b] = k.split('|');
  const ba = wins.get(key(b, a)) || 0;
  const total = ab + ba;
  if (total >= MIN_N && ab / total >= MIN_RATE) consensus.set(k, { rate: ab / total, n: total });
}
console.log(`strong working conventions (>=${MIN_RATE * 100}% over >=${MIN_N} pairs): ${consensus.size}`);

/** Score one order against the three signals. */
function assess(f) {
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
      if (['GustavDev', 'GustavX', 'Gustav', 'Shared', 'SharedDev', 'Honour', 'HonourX'].includes(d.Name)) continue;
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
}

console.log('\nfile                                            mods  conv.viol  unvetted  missing deps');
const rows = [];
for (const f of files) {
  const label = isBroken(f) ? 'BROKEN ' : isWorking(f) ? 'working' : 'other  ';
  const r = assess(f);
  if (!r) continue;
  rows.push({ label, ...r });
  console.log(
    `${label} ${f.slice(0, 42).padEnd(44)}${String(r.mods).padStart(5)}   ${(100 * r.violationRate).toFixed(1).padStart(6)}%   ${(100 * r.unvettedShare).toFixed(0).padStart(5)}%   ${r.missingDeps.length}`,
  );
}

const mean = (set, k) => set.length ? set.reduce((a, b) => a + b[k], 0) / set.length : 0;
const broken = rows.filter(r => r.label === 'BROKEN ');
const working = rows.filter(r => r.label === 'working');
console.log('\n=== SEPARATION ===');
console.log(`convention violations   broken ${(100 * mean(broken, 'violationRate')).toFixed(1)}%   working ${(100 * mean(working, 'violationRate')).toFixed(1)}%`);
console.log(`unvetted mods           broken ${(100 * mean(broken, 'unvettedShare')).toFixed(0)}%   working ${(100 * mean(working, 'unvettedShare')).toFixed(0)}%`);

console.log('\n=== WHAT THE BROKEN ORDERS SPECIFICALLY DO ===');
for (const r of broken) {
  console.log(`\n${r.file}`);
  for (const [v, n] of r.topViolations) console.log(`  ${n} pairs: ${v}`);
  for (const m of r.missingDeps.slice(0, 5)) console.log(`  missing dependency: ${m}`);
  console.log(`  ${r.unvettedCount} mods never seen in any working order`);
}
