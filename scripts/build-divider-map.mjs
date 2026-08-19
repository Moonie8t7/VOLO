#!/usr/bin/env node
/**
 * Builds client/src/lib/dividers.json from masterlist/separator-mods.json.
 *
 * Two things the client needs from the divider set:
 *   - every divider uuid, so imports strip them from the mod list and reuse
 *     their labels as section hints
 *   - one divider per masterlist group, so the export can insert a labelled
 *     boundary above each section of the sorted order
 *
 * The group mapping picks the divider whose subject matches the group; each
 * divider is used at most once, which works because every group is contiguous
 * in the sorted output. Astra's own numbering encodes a different overall
 * sequence, which was measured against the verified working orders and lost to
 * the learned order by 2.5 points, so the numbers may appear out of sequence;
 * the divider text still labels each section correctly.
 */

import fs from 'fs';
import path from 'path';

const SOURCE = path.join('masterlist', 'separator-mods.json');
const TARGET = path.join('client', 'src', 'lib', 'dividers.json');

/** Masterlist group to the numeric prefix of its divider. */
const GROUP_TO_CODE = {
  'User Interface': '000',
  'Resources': '006',
  'Visuals': '010',
  'Gameplay': '013',
  'Utilities': '019',
  'Quests': '025',
  'Environment': '030',
  'Equipment': '034',
  'Accessories': '035',
  'Armor': '036',
  'Clothing': '037',
  'Dyes': '038',
  'Weapons': '042',
  'Spells': '047',
  'Races': '051',
  'Classes': '056',
  'Character Customization': '061',
  'Heads': '063',
  'Hair': '064',
  'Companions': '070',
  'Animations': '083',
  'Miscellaneous': '089',
  'Dice': '090',
  'NPC': '091',
  'Audio': '092',
  'Bodies': '099',
  'Bug Fixes': '102',
};

const data = JSON.parse(fs.readFileSync(SOURCE, 'utf8'));

const numOf = name => parseFloat((name.match(/([0-9]+(?:\.[0-9]+)?)/) || [])[1]);

const byGroup = {};
for (const [group, code] of Object.entries(GROUP_TO_CODE)) {
  const hit = data.separators.find(s => s.name.includes(` ${code} `));
  if (!hit) {
    console.error(`no divider found for ${group} (code ${code})`);
    process.exit(1);
  }
  byGroup[group] = { uuid: hit.uuid, name: hit.name, num: numOf(hit.name) };
}

/*
 * Where a group's mods actually sort. A group mapped to a CATEGORY heading
 * must not sort at the heading's number: the heading sits above every
 * subsection, so a mod known only as "User Interface" would outrank ImpUI on
 * its exact curated slot, and the whole point of the skeleton is that exact
 * slots beat category-level evidence. Such a group sorts at its category's
 * "Other" slot instead, the catch-all Astra ends each category with.
 *
 * Two bounds on that. The learned order interleaves groups by borrowing
 * subsection numbers as rank points (Visuals sits on 010 inside the library
 * span), so the Other slot is clamped below the next group's rank point to
 * keep every learned pairwise order intact. And LATE LOADERS has no Other
 * slot because its subsections are patchers that must run last of all, so a
 * heading-mapped group with no Other sorts just after its heading, ahead of
 * the patcher slots.
 *
 * The uuid and name stay on the heading either way: sortNum decides where the
 * pile goes, the heading still labels it.
 */
const numbered = data.separators
  .map(s => ({ num: numOf(s.name), name: s.name }))
  .filter(s => Number.isFinite(s.num))
  .sort((a, b) => a.num - b.num);
const rankPoints = Object.values(byGroup).map(e => e.num).sort((a, b) => a - b);
for (const entry of Object.values(byGroup)) {
  if (!entry.name.includes('· CATEGORY ·')) {
    entry.sortNum = entry.num;
    continue;
  }
  const nextHeading = numbered.find(s => s.num > entry.num && s.name.includes('· CATEGORY ·'));
  const span = numbered.filter(s =>
    s.num > entry.num && (nextHeading === undefined || s.num < nextHeading.num));
  const others = span.filter(s => /· Other ❧/.test(s.name));
  // The category-level Other, not a nested one like Subraces · Other.
  const other = others.length ? others[others.length - 1] : undefined;
  const nextRank = rankPoints.find(n => n > entry.num);
  entry.sortNum = other === undefined
    ? entry.num + 0.5
    : Math.min(other.num, nextRank === undefined ? Infinity : nextRank - 0.5);
}

/**
 * The whole taxonomy in Astra's own sequence, where byGroup above keeps one
 * divider per group. The sub-dividers are the point: they distinguish a
 * Warlock subclass from a Wizard one, a library from the patcher that must
 * follow it, and they tell a player where a mod goes, and what kind it is.
 */
const all = data.separators
  .map(s => ({ num: numOf(s.name), uuid: s.uuid, name: s.name }))
  .filter(s => Number.isFinite(s.num))
  .sort((a, b) => a.num - b.num);

const out = {
  credit: data.credit,
  creditUrl: data.creditUrl,
  uuids: data.separators.map(s => s.uuid),
  names: Object.fromEntries(data.separators.map(s => [s.uuid, s.name])),
  /*
   * Pak filename prefixes, lower-cased once here so neither reader has to
   * remember to fold case. Only the prefix travels: the set name and the
   * author's link are for whoever maintains the list, not for the browser.
   */
  prefixes: (data.prefixes ?? []).map(p => p.prefix.toLowerCase()),
  all,
  byGroup,
};

fs.writeFileSync(TARGET, JSON.stringify(out, null, 1) + '\n');
console.log(`wrote ${TARGET}: ${out.uuids.length} dividers (${all.length} numbered), `
  + `${Object.keys(byGroup).length} group mappings, ${out.prefixes.length} filename prefixes`);
