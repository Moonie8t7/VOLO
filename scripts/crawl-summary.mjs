#!/usr/bin/env node
/**
 * One readable summary of what the catalogues and masterlist now hold.
 *
 *   node scripts/crawl-summary.mjs
 *
 * Written for the run summary on a workflow page, so a glance answers the only
 * question that matters after a scheduled crawl: did it actually do anything?
 * Prints markdown; safe to append to GITHUB_STEP_SUMMARY.
 */

import fs from 'fs';
import path from 'path';

const read = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };
const n = v => (typeof v === 'number' ? v.toLocaleString('en-GB') : v);

const nexus = read(path.join('nexus', 'catalog.json'));
const modio = read(path.join('modio', 'catalog.json'));
const masterlist = read(path.join('masterlist', 'bg3-masterlist.json'));

const rows = [];

if (nexus) {
  const mods = Object.values(nexus.mods ?? {});
  const withReq = mods.filter(m => m.req?.length).length;
  rows.push(['Nexus catalogue', `${n(mods.length)} mods`, `${n(withReq)} with a requirements table`]);
} else {
  rows.push(['Nexus catalogue', 'not present', 'no API key, or the crawl has never run']);
}

if (modio) {
  const mods = Object.values(modio.mods ?? {});
  const flagged = mods.filter(m => m.hasDependencies).length;
  const fetched = mods.filter(m => m.dependsOn?.length).length;
  const outstanding = flagged - fetched;
  rows.push([
    'mod.io catalogue',
    `${n(mods.length)} mods`,
    outstanding > 0
      ? `${n(fetched)} of ${n(flagged)} dependency lists, ${n(outstanding)} still to fetch`
      : `all ${n(flagged)} dependency lists fetched`,
  ]);
} else {
  rows.push(['mod.io catalogue', 'not present', 'no API key, or the crawl has never run']);
}

if (masterlist) {
  const plugins = masterlist.plugins ?? [];
  const unsorted = plugins.filter(p => p.group === 'unsorted').length;
  const edges = plugins.reduce((sum, p) => sum + (p.dependencies?.length ?? 0), 0);
  rows.push([
    'Masterlist',
    `${n(plugins.length)} mods`,
    `${n(unsorted)} uncategorised, ${n(edges)} load-after edges`,
  ]);
}

const lines = [
  '### Catalogue crawl',
  '',
  '| | | |',
  '|---|---|---|',
  ...rows.map(r => `| **${r[0]}** | ${r[1]} | ${r[2]} |`),
  '',
];

if (masterlist?.generated) lines.push(`Masterlist generated ${masterlist.generated}.`, '');

console.log(lines.join('\n'));
