#!/usr/bin/env node
/**
 * Builds the external category map for mods the masterlist has never seen,
 * from both catalogues: Nexus and mod.io. Replaces build-nexus-categories.mjs.
 *
 * Used as the last placement tier before unsorted, never as an override.
 * Held-out evaluation on 2026-08-04 measured listing categories lowering
 * agreement when they competed with community placements: 63.6 percent
 * without them, 63.2 with Nexus, 63.0 with both. A listing says what a mod
 * is, which is a different question from where it loads. Hence the standing
 * rule: where the community has placed a mod, no external source ever
 * overrides it; this map only fills silence, for mods that would otherwise
 * wait unsorted at the end. Between the externals, Nexus wins name ties
 * because its curated category tree is the richer signal; mod.io covers the
 * official in-game catalogue, which includes mods that are not on Nexus at
 * all.
 *
 * Every mod contributes every name it has ever answered to: the current
 * listing name, older names the crawlers saw before a rename, and on mod.io
 * the nameId slug, which the platform freezes at creation and so preserves
 * the original title through any rename. Installed paks keep the name they
 * shipped under, which makes old names exactly what stale paks match. The
 * current display name wins if a key collides.
 *
 * Nexus categorises with a category tree. mod.io categorises with per-game
 * tags that mix real categories with attributes (languages, "Patch 8 Tested",
 * body types, event entries), so tags are resolved through an ordered
 * precedence list where the first category-bearing tag wins.
 *
 *   node scripts/build-external-categories.mjs
 */

import fs from 'fs';
import path from 'path';

const NEXUS_CATALOG = path.join('nexus', 'catalog.json');
const MODIO_CATALOG = path.join('modio', 'catalog.json');
const OUT = path.join('masterlist', 'external-categories.json');

/** Nexus category names to masterlist group vocabulary. Identity unless listed. */
const NEXUS_CATEGORY_TO_GROUP = {
  "Baldur's Gate 3": null,
  'Character Customisation': 'Character Customization',
  'Maps': 'Environment',
  'Photo Mode': 'Utilities',
};

/**
 * mod.io tag precedence: first match wins, so specific content tags must come
 * before broad ones (Armor before Equipment, Subclasses before Spells).
 * Anything not listed is an attribute, not a category, and is ignored.
 */
const MODIO_TAG_TO_GROUP = [
  // Specific, reliably applied tags first.
  ['UI', 'User Interface'],
  ['Dice', 'Dice'],
  ['Hairstyles', 'Hair'],
  ['Heads', 'Heads'],
  // Rare but decisive: an overhaul tagged with every content type it touches
  // is a gameplay package, not a weapons or dyes mod.
  ['Overhaul', 'Gameplay'],
  ['Dyes', 'Dyes'],
  ['Subclasses', 'Classes'],
  ['Feats', 'Classes'],
  ['Classes', 'Classes'],
  ['Races', 'Races'],
  ['Armor', 'Armor'],
  ['Weapons', 'Weapons'],
  ['Spells', 'Spells'],
  ['Summons', 'Spells'],
  ['Consumables', 'Equipment'],
  ['Equipment', 'Equipment'],
  ['Books', 'Miscellaneous'],
  ['Tattoos', 'Character Customization'],
  ['Scars', 'Character Customization'],
  ['Piercings', 'Character Customization'],
  ['Face Paint', 'Character Customization'],
  ['Eye Makeup', 'Character Customization'],
  ['Lip Makeup', 'Character Customization'],
  ['Eye Colors', 'Character Customization'],
  ['Skin Colors', 'Character Customization'],
  ['Hair Colors', 'Hair'],
  ['Horns', 'Character Customization'],
  // Intent tags beat the broad catch-alls below: a pet or encounter mod is
  // usually tagged Quality of Life plus noise, never anything specific.
  ['Cheats', 'Gameplay'],
  ['Rules Changes', 'Gameplay'],
  ['Quality of Life', 'Gameplay'],
  ['Visual Effects', 'Visuals'],
  // Broad tags that get applied to almost anything come last. 'Other
  // Classes' and 'Other Races' are so loosely applied they are ignored.
  ['Customisation', 'Character Customization'],
  ['Other Customisation', 'Character Customization'],
  ['Characters', 'NPC'],
  ['Other characters / NPCs', 'NPC'],
  ['Shadowheart', 'Companions'],
  ['Astarion', 'Companions'],
  ['Karlach', 'Companions'],
  ["Lae'zel", 'Companions'],
  ['Gale', 'Companions'],
  ['Wyll', 'Companions'],
  ['Halsin', 'Companions'],
  ['Minthara', 'Companions'],
  ['Minsc', 'Companions'],
  ['Jaheira', 'Companions'],
  ['The Dark Urge', 'Companions'],
  ['Accessibility', 'Utilities'],
];

/**
 * Pak names that differ from the current listing name, usually because the
 * author renamed the listing after release. Alias -> the listing name whose
 * category applies. Each entry should say why it exists.
 */
const LISTING_ALIASES = [
  // Renamed to "Origin Feats" on mod.io (slug origin-feats, shown as
  // "Initiate Feats - Outdated" in the catalogue); installed paks still
  // carry the original name.
  ['Initiate Feats', 'Initiate Feats - Outdated'],
];

const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const readJson = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };

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

function collect(entries) {
  const best = new Map();
  for (const { name, group, score } of entries) {
    if (!vocabulary.has(group)) continue;
    const key = norm(name);
    if (!key) continue;
    const rival = best.get(key);
    if (!rival || score > rival.score) best.set(key, { group, score });
  }
  const out = {};
  for (const [key, { group }] of best) out[key] = indexOf(group);
  return out;
}

/**
 * One entry per name a mod has answered to. The current display name carries
 * the full score; aliases and the mod.io slug sit half a point below it, so
 * whenever an old title of one mod collides with the current title of
 * another, the current title wins.
 */
function withVariants(m, group, score, slug) {
  const entries = [{ name: m.name, group, score }];
  for (const alias of m.aliases ?? []) entries.push({ name: alias, group, score: score - 0.5 });
  if (slug && norm(slug) !== norm(m.name)) entries.push({ name: slug, group, score: score - 0.5 });
  return entries;
}

const nexusCatalog = readJson(NEXUS_CATALOG);
const nexusNames = nexusCatalog
  ? collect(Object.values(nexusCatalog.mods)
      .filter((m) => m.name && m.category)
      .flatMap((m) => {
        const mapped = NEXUS_CATEGORY_TO_GROUP[m.category] === undefined
          ? m.category
          : NEXUS_CATEGORY_TO_GROUP[m.category];
        return mapped ? withVariants(m, mapped, m.endorsements ?? 0, null) : [];
      }))
  : {};

const modioCatalog = readJson(MODIO_CATALOG);
const modioAll = modioCatalog
  ? collect(Object.values(modioCatalog.mods)
      .filter((m) => m.name && m.tags?.length && m.status === 'published')
      .flatMap((m) => {
        const tags = new Set(m.tags);
        // Armor and Weapons together mark a mixed gear pack, which belongs
        // with Equipment rather than either single type. Overhaul still
        // outranks the combination.
        const hit = !tags.has('Overhaul') && tags.has('Armor') && tags.has('Weapons')
          ? [null, 'Equipment']
          : MODIO_TAG_TO_GROUP.find(([tag]) => tags.has(tag));
        return hit ? withVariants(m, hit[1], m.subscribers ?? m.downloads ?? 0, m.nameId) : [];
      }))
  : {};

/** Nexus wins ties, so mod.io only contributes names Nexus does not know. */
const modioNames = {};
for (const [key, idx] of Object.entries(modioAll)) {
  if (nexusNames[key] === undefined) modioNames[key] = idx;
}

let aliased = 0;
for (const [alias, listing] of LISTING_ALIASES) {
  const aliasKey = norm(alias);
  const listingKey = norm(listing);
  if (nexusNames[aliasKey] !== undefined || modioNames[aliasKey] !== undefined) continue;
  if (nexusNames[listingKey] !== undefined) {
    nexusNames[aliasKey] = nexusNames[listingKey];
    aliased++;
  } else if (modioAll[listingKey] !== undefined) {
    modioNames[aliasKey] = modioAll[listingKey];
    aliased++;
  } else {
    console.warn(`alias target not in any catalogue: "${listing}"`);
  }
}

const out = {
  generated: new Date().toISOString(),
  groups,
  nexus: nexusNames,
  modio: modioNames,
};

fs.writeFileSync(OUT, JSON.stringify(out));
const size = fs.statSync(OUT).size;
console.log(
  `wrote ${OUT}: ${Object.keys(nexusNames).length} nexus names, ` +
  `${Object.keys(modioNames).length} modio-only names, ${groups.length} groups, ` +
  `${Math.round(size / 1024)}kb`,
);
