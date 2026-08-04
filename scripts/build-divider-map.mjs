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

const byGroup = {};
for (const [group, code] of Object.entries(GROUP_TO_CODE)) {
  const hit = data.separators.find(s => s.name.includes(` ${code} `));
  if (!hit) {
    console.error(`no divider found for ${group} (code ${code})`);
    process.exit(1);
  }
  const num = parseFloat((hit.name.match(/([0-9]+(?:.[0-9]+)?)/) || [])[1]);
  byGroup[group] = { uuid: hit.uuid, name: hit.name, num };
}

/**
 * The whole taxonomy in Astra's own sequence, not just one divider per group.
 * The sub-dividers are the point: they distinguish a Warlock subclass from a
 * Wizard one, a library from the patcher that must follow it, and they tell a
 * player where to put a mod rather than merely what kind of mod it is.
 */
const all = data.separators
  .map(s => {
    const m = s.name.match(/([0-9]+(?:.[0-9]+)?)/);
    return m ? { num: parseFloat(m[1]), uuid: s.uuid, name: s.name } : null;
  })
  .filter(Boolean)
  .sort((a, b) => a.num - b.num);

const out = {
  credit: data.credit,
  creditUrl: data.creditUrl,
  uuids: data.separators.map(s => s.uuid),
  names: Object.fromEntries(data.separators.map(s => [s.uuid, s.name])),
  all,
  byGroup,
};

fs.writeFileSync(TARGET, JSON.stringify(out, null, 1) + '\n');
console.log(`wrote ${TARGET}: ${out.uuids.length} dividers (${all.length} numbered), ${Object.keys(byGroup).length} group mappings`);
