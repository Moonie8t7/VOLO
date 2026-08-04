#!/usr/bin/env node
/**
 * Builds a compact name-to-group map from the Nexus catalogue, for mods the
 * masterlist has never seen.
 *
 * The rule stands: where the community has placed a mod, Nexus never
 * overrides it. The catalogue's categories describe what a mod is for people
 * browsing the site, and 286 of them disagree with where the community
 * actually loads the mod. This map is only consulted when there is no
 * community evidence at all, where the alternative is no category whatsoever.
 *
 * Output is keyed by normalised name because most exports without masterlist
 * matches also lack UUIDs. Names shared by several mods with conflicting
 * categories are resolved by endorsement count, the same popularity signal
 * the crawl is prioritised by.
 *
 *   node scripts/build-nexus-categories.mjs
 */

import fs from 'fs';
import path from 'path';

const CATALOG = path.join('nexus', 'catalog.json');
const OUT = path.join('public', 'nexus-categories.json');

/** Nexus category names to masterlist group vocabulary. Identity unless listed. */
const CATEGORY_TO_GROUP = {
  "Baldur's Gate 3": null,
  'Character Customisation': 'Character Customization',
  'Maps': 'Environment',
  'Photo Mode': 'Utilities',
};

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

if (!fs.existsSync(CATALOG)) {
  console.log(`no ${CATALOG}; keeping the existing category map`);
  process.exit(0);
}

const catalog = JSON.parse(fs.readFileSync(CATALOG, 'utf8'));
const masterlist = JSON.parse(fs.readFileSync(path.join('masterlist', 'bg3-masterlist.json'), 'utf8'));
const vocabulary = new Set(masterlist.groups.map((g) => g.name));

const groups = [];
const groupIndex = new Map();
const indexOf = (group) => {
  if (!groupIndex.has(group)) {
    groupIndex.set(group, groups.length);
    groups.push(group);
  }
  return groupIndex.get(group);
};

let skippedCategory = 0;
let unmappable = 0;
const best = new Map();

for (const mod of Object.values(catalog.mods)) {
  if (!mod.name || !mod.category) continue;
  const mapped = CATEGORY_TO_GROUP[mod.category] === undefined
    ? mod.category
    : CATEGORY_TO_GROUP[mod.category];
  if (mapped === null) { skippedCategory++; continue; }
  if (!vocabulary.has(mapped)) { unmappable++; continue; }

  const key = norm(mod.name);
  if (!key) continue;
  const rivals = best.get(key);
  const score = mod.endorsements ?? 0;
  if (!rivals || score > rivals.score) best.set(key, { group: mapped, score });
}

const names = {};
for (const [key, { group }] of best) names[key] = indexOf(group);

const out = {
  generated: catalog.generated,
  source: 'Nexus Mods',
  groups,
  names,
};

fs.writeFileSync(OUT, JSON.stringify(out));
const size = fs.statSync(OUT).size;
console.log(
  `wrote ${OUT}: ${Object.keys(names).length} names across ${groups.length} groups, ` +
  `${Math.round(size / 1024)}kb (${skippedCategory} skipped as base-game category, ` +
  `${unmappable} with no matching group)`,
);
