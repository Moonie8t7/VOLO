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
 * Every mod contributes every name the crawlers have seen it under: the
 * current listing name, older names and slugs recorded before a rename, and
 * on mod.io the nameId slug, which usually still carries the title the mod
 * was created under because renaming the listing does not rename the URL.
 * Installed paks keep the name they shipped under, which makes old names
 * exactly what stale paks match. A current display name always outranks an
 * old name; the precedence order is spelled out above `claim`.
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

/*
 * Precedence when the same key is claimed twice, strongest first:
 *
 *   1. a current Nexus display name
 *   2. a current mod.io display name
 *   3. a Nexus alias
 *   4. a mod.io alias or slug
 *
 * Current names outrank old ones absolutely, not by a score margin: a stale
 * alias of a 100,000-subscriber mod must not shadow the current title of a
 * small one. Nexus outranks mod.io at equal standing because its curated
 * category tree is the richer signal. Popularity only breaks ties inside one
 * level.
 */
const best = new Map();
const claim = (name, group, source, tier, score) => {
  if (!vocabulary.has(group)) return;
  const key = norm(name);
  if (!key) return;
  const rival = best.get(key);
  if (!rival || tier > rival.tier || (tier === rival.tier && score > rival.score)) {
    best.set(key, { group, source, tier, score });
  }
};

/** Every name a mod has answered to, claimed at the right precedence level. */
function claimVariants(m, group, source, primaryTier, variantTier, score, slug) {
  claim(m.name, group, source, primaryTier, score);
  for (const alias of m.aliases ?? []) claim(alias, group, source, variantTier, score);
  if (slug && norm(slug) !== norm(m.name)) claim(slug, group, source, variantTier, score);
}

const nexusCatalog = readJson(NEXUS_CATALOG);
for (const m of Object.values(nexusCatalog?.mods ?? {})) {
  if (!m.name || !m.category) continue;
  const mapped = NEXUS_CATEGORY_TO_GROUP[m.category] === undefined
    ? m.category
    : NEXUS_CATEGORY_TO_GROUP[m.category];
  if (mapped) claimVariants(m, mapped, 'nexus', 3, 1, m.endorsements ?? 0, null);
}

const modioCatalog = readJson(MODIO_CATALOG);
for (const m of Object.values(modioCatalog?.mods ?? {})) {
  if (!m.name || !m.tags?.length || m.status !== 'published') continue;
  const tags = new Set(m.tags);
  // Armor and Weapons together mark a mixed gear pack, which belongs
  // with Equipment rather than either single type. Overhaul still
  // outranks the combination.
  const hit = !tags.has('Overhaul') && tags.has('Armor') && tags.has('Weapons')
    ? [null, 'Equipment']
    : MODIO_TAG_TO_GROUP.find(([tag]) => tags.has(tag));
  if (hit) claimVariants(m, hit[1], 'modio', 2, 0, m.subscribers ?? m.downloads ?? 0, m.nameId);
}

const nexusNames = {};
const modioNames = {};
for (const [key, { group, source }] of best) {
  (source === 'nexus' ? nexusNames : modioNames)[key] = indexOf(group);
}

let aliased = 0;
for (const [alias, listing] of LISTING_ALIASES) {
  const aliasKey = norm(alias);
  const listingKey = norm(listing);
  if (best.has(aliasKey)) continue;
  const target = best.get(listingKey);
  if (target) {
    (target.source === 'nexus' ? nexusNames : modioNames)[aliasKey] = indexOf(target.group);
    aliased++;
  } else {
    console.warn(`alias target not in any catalogue: "${listing}"`);
  }
}

/**
 * How much of what is published VOLO has actually seen.
 *
 * The masterlist only holds mods that appear in an order somebody submitted,
 * so the gap between it and the two catalogues is the honest size of what the
 * corpus has never met. Counted here because this is the only script that
 * reads both catalogues; the sceptical section of the about page renders it.
 *
 * A mod on both platforms is one mod, matched on name, so the two totals are
 * not added. Nexus counts every published listing, categorised or not: the
 * question is how many mods exist, not how many could be filed.
 */
const publishedNames = (catalog) => new Set(
  Object.values(catalog?.mods ?? {})
    .filter((m) => m.name && m.status === 'published')
    .map((m) => norm(m.name))
    .filter(Boolean),
);
const nexusPublished = publishedNames(nexusCatalog);
const modioPublished = publishedNames(modioCatalog);

const out = {
  generated: new Date().toISOString(),
  groups,
  catalogue: {
    nexus: nexusPublished.size,
    modio: modioPublished.size,
    distinct: new Set([...nexusPublished, ...modioPublished]).size,
  },
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
console.log(
  `published listings: ${out.catalogue.nexus} on Nexus, ${out.catalogue.modio} on mod.io, ` +
  `${out.catalogue.distinct} distinct`,
);
