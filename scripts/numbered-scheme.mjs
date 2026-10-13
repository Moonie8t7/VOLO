/**
 * The numbered load order scheme, scored against every landing and used for
 * nothing else.
 *
 * A category scheme numbered like a library catalogue: hundreds in load
 * order, tens inside them, read from masterlist/numbered-scheme.json. VOLO
 * does not sort by it. Every landed order is scored under it beside VOLO's
 * learned groups, on the same pairs, and the result goes into
 * masterlist/numbered-scheme-log.json. Whether the scheme is ever adopted is
 * decided from that log, not from the proposal that produced it.
 *
 * Why it is numbered: the idea was inspired by a community suggestion for a
 * Dewey style divider pack, with hundreds for families and tens inside them.
 * The suggestion itself is not what is measured here, and nor is Dewey. The
 * notation is all that was kept. Dewey can shelve History after Literature
 * because shelf order is arbitrary; a load order cannot, so the hundreds here
 * are in the order working orders put them, which is what the score checks.
 *
 *   node scripts/numbered-scheme.mjs score <corpus file>
 *   node scripts/numbered-scheme.mjs all
 *   node scripts/numbered-scheme.mjs record <entry.json | corpus file> [issue]
 *   node scripts/numbered-scheme.mjs summary
 */

import fs from 'fs';
import os from 'os';
import path from 'path';

const SCHEME = path.join('masterlist', 'numbered-scheme.json');
const LOG = path.join('masterlist', 'numbered-scheme-log.json');
const CORPUS = 'Load Orders - Public Submitted';

/** The same normalisation every name lookup in the project uses. */
const normalise = s => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * The scheme with its patterns compiled and every reference checked.
 *
 * Throws on a number nothing names or a test table nothing defines, for the
 * same reason the curated rules loader does: a scheme that silently sends a
 * family to a number with no name would score as if it were filed.
 */
export function loadScheme(file = SCHEME) {
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  const problems = [];
  const named = new Set(Object.keys(raw.tens ?? {}).map(Number));
  const tests = {};
  for (const [name, table] of Object.entries(raw.tests ?? {})) {
    tests[name] = table.map((t, i) => {
      let re;
      try { re = new RegExp(t.pattern, 'i'); } catch (e) { problems.push(`tests.${name}[${i}]: ${e.message}`); }
      if (!named.has(t.number)) problems.push(`tests.${name}[${i}]: ${t.number} has no name`);
      return { re, number: t.number };
    });
  }
  const check = (label, rule) => {
    if (typeof rule === 'number') { if (!named.has(rule)) problems.push(`${label}: ${rule} has no name`); return; }
    if (!rule || typeof rule !== 'object') { problems.push(`${label}: not a number or a test reference`); return; }
    if (!tests[rule.tests]) problems.push(`${label}: no test table called ${rule.tests}`);
    if (!named.has(rule.fallback)) problems.push(`${label}: fallback ${rule.fallback} has no name`);
  };
  for (const [g, rule] of Object.entries(raw.groups ?? {})) check(`groups.${g}`, rule);
  for (const [c, rule] of Object.entries(raw.nexusCategories ?? {})) check(`nexusCategories.${c}`, rule);
  if (problems.length) throw new Error(`numbered scheme failed validation:\n  ${problems.join('\n  ')}`);
  return { ...raw, tests };
}

/** Nexus listings by normalised name, for mods VOLO has no group for. */
export function indexNexus(catalog) {
  const index = new Map();
  for (const m of Array.isArray(catalog.mods) ? catalog.mods : Object.values(catalog.mods ?? {})) {
    if (!m.name) continue;
    const k = normalise(m.name);
    if (k && !index.has(k)) index.set(k, m);
  }
  return index;
}

const resolve = (rule, name, scheme) => {
  if (typeof rule === 'number') return rule;
  for (const { re, number } of scheme.tests[rule.tests]) if (re.test(name)) return number;
  return rule.fallback;
};

/**
 * The number a mod gets: VOLO's group picks the hundred for most families, a
 * name test picks the ten, and for the families the scheme splits across
 * hundreds the name test picks the hundred too. A mod VOLO has no group for
 * falls back to its Nexus category; one with neither gets no number.
 */
export function numberFor(plugin, scheme, nexusByKey = new Map()) {
  const name = plugin.name ?? '';
  const group = plugin.group && plugin.group !== 'unsorted' ? plugin.group : null;
  if (group && scheme.groups[group] !== undefined) return resolve(scheme.groups[group], name, scheme);
  const listing = nexusByKey.get(normalise(name)) ?? nexusByKey.get(normalise(plugin.folder));
  if (!listing) return null;
  const rule = scheme.nexusCategories[listing.category];
  return rule === undefined ? null : resolve(rule, name, scheme);
}

/**
 * One order scored two ways on the same pairs.
 *
 * For every pair of mods the player placed, the scheme has an opinion when
 * their numbers differ and VOLO has one when their groups differ. Agreement
 * is how often the opinion matches what the player did. The shared figures
 * are the fair comparison, because they are the same pairs answered twice.
 */
export function scoreOrder(mods, masterlist, scheme, nexusByKey = new Map()) {
  const byUuid = new Map(masterlist.plugins.map(p => [p.uuid, p]));
  const byKey = new Map();
  for (const p of masterlist.plugins) for (const n of [p.name, p.folder, ...(p.alternateNames ?? [])]) { const k = normalise(n); if (k && !byKey.has(k)) byKey.set(k, p); }
  const rank = new Map(masterlist.groups.map((g, i) => [g.name, i]));
  const rows = mods.map(m => {
    const p = byUuid.get(String(m.uuid ?? '').toLowerCase()) ?? byKey.get(normalise(m.name));
    const n = p ? numberFor(p, scheme, nexusByKey) : null;
    const g = p && p.group && p.group !== 'unsorted' ? rank.get(p.group) : undefined;
    return { p, n, g };
  });
  const hundreds = {};
  let known = 0, numbered = 0;
  for (const r of rows) { if (r.p) known++; if (r.n != null) { numbered++; const h = Math.floor(r.n / 100); hundreds[h] = (hundreds[h] || 0) + 1; } }
  let sA = 0, sT = 0, vA = 0, vT = 0, bS = 0, bV = 0, bT = 0;
  for (let a = 0; a < rows.length; a++) for (let b = a + 1; b < rows.length; b++) {
    const x = rows[a], y = rows[b];
    const s = x.n != null && y.n != null && x.n !== y.n;
    const v = x.g !== undefined && y.g !== undefined && x.g !== y.g;
    if (s) { sT++; if (x.n < y.n) sA++; }
    if (v) { vT++; if (x.g < y.g) vA++; }
    if (s && v) { bT++; if (x.n < y.n) bS++; if (x.g < y.g) bV++; }
  }
  const pct = (a, t) => t ? Math.round(1000 * a / t) / 10 : null;
  return {
    mods: rows.length, known, numbered, hundreds,
    scheme: { agree: sA, total: sT, pct: pct(sA, sT) },
    volo: { agree: vA, total: vT, pct: pct(vA, vT) },
    shared: { total: bT, schemePct: pct(bS, bT), voloPct: pct(bV, bT) },
  };
}

export function readLog(file = LOG) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

/** Append one entry, once: a landing that retries must not record twice. */
export function appendLog(entry, file = LOG) {
  const log = readLog(file);
  if (log.entries.some(e => e.file === entry.file)) return false;
  log.entries.push(entry);
  fs.writeFileSync(file, JSON.stringify(log, null, 2) + '\n');
  return true;
}

/** What the log says so far, for the step summary and for a person. */
export function summarise(log) {
  const entries = log.entries;
  const mean = (arr, k) => arr.length ? Math.round(10 * arr.reduce((s, e) => s + (e[k] ?? 0), 0) / arr.length) / 10 : null;
  const part = arr => ({ n: arr.length, scheme: mean(arr, 'scheme'), volo: mean(arr, 'volo'), schemeAhead: arr.filter(e => e.scheme > e.volo).length });
  return { all: part(entries), working: part(entries.filter(e => e.working)), broken: part(entries.filter(e => !e.working)) };
}

const runDirectly = process.argv[1] && path.resolve(process.argv[1]) === path.resolve('scripts/numbered-scheme.mjs');
if (runDirectly) {
  const [command, arg, issue] = process.argv.slice(2);
  const { build } = await import('esbuild');
  const bundle = path.join(os.tmpdir(), `volo-scheme-${process.pid}.mjs`);
  await build({ stdin: { contents: `export { parseLoadOrder } from './client/src/lib/parser';`, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, format: 'esm', platform: 'node', outfile: bundle, logLevel: 'error' });
  const { parseLoadOrder } = await import(`file://${bundle}`);
  fs.rmSync(bundle, { force: true });
  const scheme = loadScheme();
  const masterlist = JSON.parse(fs.readFileSync('masterlist/bg3-masterlist.json', 'utf8'));
  const nexusByKey = indexNexus(JSON.parse(fs.readFileSync('nexus/catalog.json', 'utf8')));
  const scoreFile = file => {
    const name = path.basename(file);
    const parsed = parseLoadOrder(fs.readFileSync(file, 'utf8'), name);
    return { name, parsed, result: scoreOrder(parsed.mods, masterlist, scheme, nexusByKey) };
  };
  const line = (name, r) => `${name}: ${r.mods} mods, ${r.numbered} numbered; scheme ${r.scheme.pct}% on ${r.scheme.total} pairs, VOLO ${r.volo.pct}% on ${r.volo.total}; same ${r.shared.total} pairs: scheme ${r.shared.schemePct}% VOLO ${r.shared.voloPct}%`;

  if (command === 'score' && arg) {
    const { name, result } = scoreFile(fs.existsSync(arg) ? arg : path.join(CORPUS, arg));
    console.log(line(name, result));
  } else if (command === 'all') {
    const { readProvenance, isVoloSorted } = await import('./corpus-provenance.mjs');
    const provenance = readProvenance();
    let n = 0, s = 0, v = 0;
    for (const f of fs.readdirSync(CORPUS).sort()) {
      if (f === 'provenance.json' || !f.startsWith('working') || isVoloSorted(provenance, f)) continue;
      const { result } = scoreFile(path.join(CORPUS, f));
      if (!result.shared.total) continue;
      n++; s += result.shared.schemePct; v += result.shared.voloPct;
    }
    console.log(`${n} independent working orders; mean on shared pairs: scheme ${(s / n).toFixed(1)}%, VOLO ${(v / n).toFixed(1)}%`);
  } else if (command === 'record' && arg) {
    let entry;
    if (arg.endsWith('.json') && fs.existsSync(arg)) {
      entry = JSON.parse(fs.readFileSync(arg, 'utf8'));
    } else {
      const file = fs.existsSync(arg) ? arg : path.join(CORPUS, arg);
      const { name, result } = scoreFile(file);
      entry = {
        date: new Date().toISOString().slice(0, 10), file: name, issue: issue ? Number(issue) : null,
        working: /^working/i.test(name), mods: result.mods, numbered: result.numbered,
        pairs: result.shared.total, scheme: result.shared.schemePct, volo: result.shared.voloPct,
      };
    }
    console.log(appendLog(entry) ? `recorded ${entry.file}` : `${entry.file} already recorded`);
    const s = summarise(readLog());
    console.log(`log: ${s.all.n} orders; scheme ${s.all.scheme}% VOLO ${s.all.volo}% on shared pairs; scheme ahead on ${s.all.schemeAhead}`);
  } else if (command === 'summary') {
    const s = summarise(readLog());
    for (const [k, p] of Object.entries(s)) console.log(`${k.padEnd(8)} n=${p.n} scheme ${p.scheme ?? '-'}% VOLO ${p.volo ?? '-'}% scheme ahead on ${p.schemeAhead}`);
  } else {
    console.log('usage: score <file> | all | record <entry.json | file> [issue] | summary');
    process.exit(2);
  }
}
