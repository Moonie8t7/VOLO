#!/usr/bin/env node
/**
 * Mines community-submitted BG3 load orders into a LOOT-style masterlist.
 *
 *   node scripts/mine-corpus.mjs
 *
 * Reads:  Load Orders - Public Submitted/*.{json,tsv}
 * Writes: masterlist/bg3-masterlist.json   (the artefact)
 *         masterlist/coverage-report.md    (what we know / don't know)
 *
 * Design notes
 * ------------
 * Groups, not priorities. LOOT moved off numeric priorities because they stop
 * composing at scale; we order groups with `after` edges and keep an integer
 * only as an intra-group tiebreak.
 *
 * Mod names are reproduced exactly as the author wrote them, punctuation and all.
 * They are matched against what users actually have installed, so normalising or
 * "tidying" a name breaks the match and silently drops the mod from sorting.
 *
 * Three tiers of evidence, kept separate so consumers can trust them differently:
 *   1. `dependencies`  declared in the .pak metadata. Hard edges. Trustworthy.
 *   2. `group`         derived from human-authored separator headers. Good.
 *   3. `observations`  co-occurrence counts. Weak prior, needs volume.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const CORPUS_DIR = 'Load Orders - Public Submitted';
const OUT_DIR = 'masterlist';

// Base-game data packages. They appear in Dependencies but are not mods.
const ENGINE_MASTERS = new Set([
  'GustavDev', 'GustavX', 'Gustav', 'Shared', 'SharedDev',
  'Honour', 'HonourX', 'Engine', 'ModBrowser', 'DiceSet_01',
  'DiceSet_02', 'DiceSet_03', 'DiceSet_04', 'DiceSet_06',
]);

/**
 * Canonical group order. `after` encodes the load-order relation the way LOOT
 * does. Each group loads after the ones named. Derived from the section
 * headers modders actually wrote in their own working orders.
 */
const GROUPS = [
  { name: 'core',          after: [],                  description: 'Loaders and script extenders that everything else depends on' },
  { name: 'libraries',     after: ['core'],            description: 'Shared code libraries with no standalone behaviour' },
  { name: 'frameworks',    after: ['libraries'],       description: 'Systems other mods build on (MCM, item shipment, compatibility)' },
  { name: 'gameplay',      after: ['frameworks'],      description: 'Rules, mechanics, combat and progression tweaks' },
  { name: 'classes',       after: ['gameplay'],        description: 'Classes, subclasses, races, feats and deities' },
  { name: 'spells',        after: ['classes'],         description: 'Spell additions and overhauls' },
  { name: 'items',         after: ['spells'],          description: 'Gear, weapons, armour, consumables and containers' },
  { name: 'character',     after: ['items'],           description: 'Character creation: heads, hair, eyes, skins, presets' },
  { name: 'clothing',      after: ['character'],       description: 'Outfits, camp clothing and dyes' },
  { name: 'companions',    after: ['clothing'],        description: 'Companion edits and new party members' },
  { name: 'ui',            after: ['companions'],      description: 'Interface, hotbar, tooltips and menus' },
  { name: 'visual',        after: ['ui'],              description: 'Textures, dice skins and visual effects' },
  { name: 'patches',       after: ['visual'],          description: 'Compatibility patches between other mods' },
  { name: 'fixes',         after: ['patches'],         description: 'Late-loading bug fixes and overrides' },
  { name: 'unsorted',      after: ['fixes'],           description: 'Not yet categorised by the community' },
];

/**
 * Curated overrides. These outrank every other signal.
 *
 * Needed because section headers are unreliable for infrastructure: modders file
 * ImprovedUI under "User Interface" (it is UI, but everything depends on it), and
 * use "Essentials"/"Core" to mean "mods I won't play without" rather than "loads
 * first". Content mods infer fine; the foundation has to be stated.
 */
const CURATED = [
  [/^bg3se|script\s*extender|^norbyte/i,                          'core'],
  [/native\s*mod\s*loader|^nativemodloader|^mod\s*fixer|modfixer/i, 'core'],
  [/^impui|improvedui/i,                                          'core'],
  [/^communitylibrary|community\s*library/i,                      'libraries'],
  [/^volitioncabinet/i,                                           'libraries'],
  [/^aahzlib|material\s*library|^tagframework/i,                  'libraries'],
  [/compatibility\s*framework|^compatibilityframework/i,          'frameworks'],
  [/mod\s*configuration\s*menu|^bg3mcm/i,                         'frameworks'],
  [/item\s*shipment\s*framework/i,                                'frameworks'],
];

/**
 * Section header text (lowercased) -> canonical group.
 *
 * Deliberately omits "core", "essentials" and "script extender". In submitted
 * orders those headers mean "important to me" or "requires SE", not "load early",
 * and mis-sort badly. Real infrastructure is caught by CURATED above.
 */
const SECTION_TO_GROUP = {
  'loaders': 'core',
  'libraries': 'libraries', 'library': 'libraries',
  'frameworks': 'frameworks', 'framework': 'frameworks',
  'gameplay': 'gameplay', 'tweaks': 'gameplay', 'combat': 'gameplay', 'cheats': 'gameplay',
  'mechanics': 'gameplay', 'quality of life': 'gameplay', 'qol': 'gameplay',
  'classes': 'classes', 'subclasses': 'classes', 'class': 'classes', 'feats': 'classes',
  'races': 'classes', 'subraces': 'classes', 'deities': 'classes', 'backgrounds': 'classes',
  'sorcerer': 'classes', 'druid': 'classes', 'wizard': 'classes', 'cleric': 'classes',
  'warlock': 'classes', 'fighter': 'classes', 'rogue': 'classes', 'bard': 'classes',
  'paladin': 'classes', 'ranger': 'classes', 'monk': 'classes', 'barbarian': 'classes',
  'spells': 'spells', 'spell': 'spells', 'magic': 'spells', 'cantrips': 'spells',
  'gear': 'items', 'armor': 'items', 'armour': 'items', 'weapons': 'items',
  'jewelry': 'items', 'jewellery': 'items', 'accesories': 'items', 'accessories': 'items',
  'consumables': 'items', 'containers': 'items', 'items': 'items', 'equipment': 'items',
  'character creator': 'character', 'character creation': 'character', 'cc': 'character',
  'heads': 'character', 'head': 'character', 'hair': 'character', 'eyes': 'character',
  'faces': 'character', 'skins': 'character', 'tattoos': 'character', 'presets': 'character',
  'bodies': 'character', 'cosmetics': 'character', 'makeup': 'character',
  'clothing': 'clothing', 'clothes': 'clothing', 'outfits': 'clothing', 'dyes': 'clothing',
  'camp clothes': 'clothing',
  'companions': 'companions', 'companion edits': 'companions', 'characters': 'companions',
  'npcs': 'companions', 'origins': 'companions',
  'user interface': 'ui', 'ui': 'ui', 'interface': 'ui', 'hud': 'ui',
  'textures': 'visual', 'dices': 'visual', 'dice': 'visual', 'visuals': 'visual',
  'vfx': 'visual', 'lighting': 'visual', 'other': 'unsorted', 'miscellaneous': 'unsorted',
  'misc': 'unsorted',
  'patches': 'patches', 'patch': 'patches', 'compatibility': 'patches',
  'fixes': 'fixes', 'fix': 'fixes', 'bugfixes': 'fixes',
};

/** Fallback name patterns when a mod sits under no section header. */
const NAME_PATTERNS = [
  [/script\s*extender|nativemodloader|native mod loader|^bg3se|improvedui|^impui/i, 'core'],
  [/communitylibrary|community library|volitioncabinet|materiallibrary|material library|^lib[A-Z]|modders?\s*resource/i, 'libraries'],
  [/compatibilityframework|compatibility framework|mod configuration menu|^bg3mcm|framework$|framework\b/i, 'frameworks'],
  [/\bspell|cantrip|\bmagic\b/i, 'spells'],
  [/subclass|\bclass\b|\bfeat\b|\brace\b|deity|deities/i, 'classes'],
  [/hair|beard|head|\beyes?\b|skin\s*tone|tattoo|makeup|preset|face/i, 'character'],
  [/outfit|clothing|clothes|\bdye\b|camp\s*(clothes|outfit)/i, 'clothing'],
  [/armou?r|weapon|jewel|equipment|\bgear\b|basket.*equipment/i, 'items'],
  [/hotbar|tooltip|sidebar|inventory ui|\bui\b|interface|topbar|context menu/i, 'ui'],
  [/texture|\bdice\b|colou?rs?\b|vfx/i, 'visual'],
  [/\bpatch(es)?\b|compatibility/i, 'patches'],
  [/\bfix(es)?\b|hotfix/i, 'fixes'],
];

// Corpus loading

function readOrder(file) {
  const raw = fs.readFileSync(path.join(CORPUS_DIR, file), 'utf8');
  if (file.endsWith('.tsv')) {
    const lines = raw.split(/\r?\n/).filter(Boolean);
    const hdr = lines[0].split('\t').map(h => h.trim());
    return lines.slice(1).map(l => {
      const cells = l.split('\t');
      return Object.fromEntries(hdr.map((h, i) => [h, cells[i]]));
    });
  }
  let json;
  try { json = JSON.parse(raw); } catch { return null; }
  if (Array.isArray(json?.Order)) return json.Order;
  if (Array.isArray(json?.Mods)) return json.Mods;
  if (Array.isArray(json)) return json;
  return null; // not a load order (e.g. the Apps Script export)
}

function labelOf(file) {
  const n = file.toLowerCase();
  if (n.startsWith('not-working') || n.startsWith('not_working')) return 'broken';
  if (n.startsWith('working_') || n.includes('current_working')) return 'working';
  return 'unlabelled';
}

// A separator is a cosmetic divider, not a mod. Modders write them many ways:
//   ---------------------------|   Spells   |---------------------------
//   ] Armor [
//   >             Jewelry
const SEPARATOR_RE = /[-=_~]{4,}|^\s*[\]>]\s*\S|^\s*\|.*\|\s*$/;

function sectionLabel(name) {
  const piped = name.match(/\|([^|]{2,60})\|/);
  if (piped) return piped[1].trim();
  const bracketed = name.match(/\]\s*([^[\]]{2,60})\s*\[/);
  if (bracketed) return bracketed[1].trim();
  const stripped = name.replace(/[-=_~*#>\]\[|]{1,}/g, ' ').replace(/\s+/g, ' ').trim();
  return stripped.length >= 2 ? stripped : null;
}

function groupForSection(label) {
  if (!label) return null;
  const key = label.toLowerCase().replace(/[^a-z ]/g, '').trim();
  if (SECTION_TO_GROUP[key]) return SECTION_TO_GROUP[key];
  for (const [word, group] of Object.entries(SECTION_TO_GROUP)) {
    if (key.includes(word)) return group;
  }
  return null;
}

function groupForName(name) {
  for (const [re, group] of NAME_PATTERNS) if (re.test(name)) return group;
  return null;
}

// Main

const orders = [];
const skipped = [];
const seen = new Set();

for (const file of fs.readdirSync(CORPUS_DIR).sort()) {
  const entries = readOrder(file);
  if (!entries || entries.length < 5) { skipped.push([file, 'not a load order']); continue; }
  const fp = crypto.createHash('md5')
    .update(entries.map(e => e.UUID || e.Name).join('|')).digest('hex');
  if (seen.has(fp)) { skipped.push([file, 'duplicate of another file']); continue; }
  seen.add(fp);
  orders.push({ file, label: labelOf(file), entries });
}

/** uuid -> record */
const mods = new Map();
function record(uuid) {
  if (!mods.has(uuid)) {
    mods.set(uuid, {
      uuid,
      names: new Map(),
      sections: new Map(),
      dependencies: new Map(),
      featureFlags: new Set(),
      author: null, version: null, folder: null, description: null,
      seenIn: new Set(), seenInWorking: 0,
    });
  }
  return mods.get(uuid);
}

let separatorCount = 0;

for (const order of orders) {
  let currentSection = null;
  for (const entry of order.entries) {
    const name = entry.Name;
    if (!name) continue;

    if (SEPARATOR_RE.test(name)) {
      separatorCount++;
      currentSection = sectionLabel(name);
      continue;
    }
    if (!entry.UUID) continue;

    const r = record(entry.UUID);
    r.names.set(name, (r.names.get(name) || 0) + 1);
    r.seenIn.add(order.file);
    if (order.label === 'working') r.seenInWorking++;
    if (currentSection) r.sections.set(currentSection, (r.sections.get(currentSection) || 0) + 1);

    if (entry.Author && !r.author) r.author = entry.Author;
    if (entry.Folder && !r.folder) r.folder = entry.Folder;
    if (entry.Description && !r.description) r.description = entry.Description;
    const v = entry.Version?.Version ?? (typeof entry.Version === 'string' ? entry.Version : null);
    if (v && !r.version) r.version = v;
    for (const f of entry.ScriptExtenderData?.FeatureFlags ?? []) r.featureFlags.add(f);

    for (const dep of entry.Dependencies ?? []) {
      if (!dep?.Name || ENGINE_MASTERS.has(dep.Name) || dep.UUID === entry.UUID) continue;
      r.dependencies.set(dep.UUID, dep.Name);
    }
  }
}

// Resolve each mod to a canonical name + group.
const plugins = [];
const stats = { curated: 0, fromSection: 0, fromName: 0, unsorted: 0 };

for (const r of mods.values()) {
  const name = [...r.names.entries()].sort((a, b) => b[1] - a[1])[0][0];

  let group = null, confidence = null;

  for (const [re, g] of CURATED) {
    if (re.test(name)) { group = g; confidence = 'curated'; stats.curated++; break; }
  }

  if (!group && r.sections.size) {
    const ranked = [...r.sections.entries()]
      .map(([label, n]) => [groupForSection(label), n])
      .filter(([g]) => g);
    if (ranked.length) {
      const tally = new Map();
      for (const [g, n] of ranked) tally.set(g, (tally.get(g) || 0) + n);
      const sorted = [...tally.entries()].sort((a, b) => b[1] - a[1]);
      group = sorted[0][0];
      confidence = sorted.length === 1 ? 'section' : 'section-majority';
      stats.fromSection++;
    }
  }
  if (!group) {
    group = groupForName(name);
    if (group) { confidence = 'name-pattern'; stats.fromName++; }
  }
  if (!group) { group = 'unsorted'; confidence = 'none'; stats.unsorted++; }

  const plugin = { name, uuid: r.uuid, group };
  if (r.folder && r.folder !== name) plugin.folder = r.folder;
  if (r.author) plugin.author = r.author;
  if (r.version) plugin.version = r.version;
  if (r.dependencies.size) {
    plugin.dependencies = [...r.dependencies].map(([uuid, n]) => ({ uuid, name: n }));
  }
  if (r.featureFlags.size) plugin.featureFlags = [...r.featureFlags];
  plugin.evidence = {
    source: confidence,
    installs: r.seenIn.size,
    workingInstalls: r.seenInWorking,
  };
  plugins.push(plugin);
}

plugins.sort((a, b) =>
  b.evidence.installs - a.evidence.installs || a.name.localeCompare(b.name));

const masterlist = {
  $schema: './masterlist.schema.json',
  version: '2.0.0',
  generated: new Date().toISOString(),
  generator: 'scripts/mine-corpus.mjs',
  provenance: {
    ordersAnalysed: orders.length,
    working: orders.filter(o => o.label === 'working').length,
    broken: orders.filter(o => o.label === 'broken').length,
    unlabelled: orders.filter(o => o.label === 'unlabelled').length,
  },
  groups: GROUPS,
  plugins,
};

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUT_DIR, 'bg3-masterlist.json'),
  JSON.stringify(masterlist, null, 2) + '\n');

// Coverage report

const byGroup = new Map();
for (const p of plugins) byGroup.set(p.group, (byGroup.get(p.group) || 0) + 1);
const withDeps = plugins.filter(p => p.dependencies);
const multi = plugins.filter(p => p.evidence.installs > 1);

const report = `# Masterlist coverage report

Generated ${masterlist.generated} by \`scripts/mine-corpus.mjs\`.

## Corpus

| | |
|---|---|
| Load orders analysed | ${orders.length} |
| labelled working | ${masterlist.provenance.working} |
| labelled broken | ${masterlist.provenance.broken} |
| unlabelled | ${masterlist.provenance.unlabelled} |
| Separator headers parsed | ${separatorCount} |
| **Unique mods indexed** | **${plugins.length}** |
| Seen in more than one order | ${multi.length} |
| With declared dependencies | ${withDeps.length} |
| With Script Extender flags | ${plugins.filter(p => p.featureFlags).length} |
| With author metadata | ${plugins.filter(p => p.author).length} |

## How each mod got its group

| Source | Count | Trust |
|---|---|---|
| Curated override | ${stats.curated} | highest, hand-verified infrastructure |
| Human-authored section header | ${stats.fromSection} | high, a modder put it there |
| Name pattern fallback | ${stats.fromName} | medium, needs review |
| Uncategorised | ${stats.unsorted} | none, needs community input |

## Group distribution

${GROUPS.map(g => `- \`${g.name}\`: ${byGroup.get(g.name) || 0}`).join('\n')}

## Known limitations

- **Ordering rules are not derived here.** Pairwise co-occurrence over ${masterlist.provenance.working}
  working orders overfits badly: most pairs reflect one person's arbitrary sequencing
  rather than a real constraint. Only declared \`dependencies\` are emitted as hard
  edges. Revisit once submissions reach ~100 orders.
- **${stats.unsorted} mods are \`unsorted\`.** These need community categorisation.
- **Thin exports dominate.** Most submissions use the \`{UUID, Name}\` format, which
  carries no dependency or version data. Only the full BG3MM export does.

## Files skipped

${skipped.length ? skipped.map(([f, why]) => `- \`${f}\`: ${why}`).join('\n') : '_none_'}
`;

fs.writeFileSync(path.join(OUT_DIR, 'coverage-report.md'), report);

console.log(`corpus:    ${orders.length} orders (${masterlist.provenance.working} working, ${masterlist.provenance.broken} broken, ${masterlist.provenance.unlabelled} unlabelled)`);
console.log(`separators:${String(separatorCount).padStart(5)} headers parsed`);
console.log(`indexed:   ${plugins.length} unique mods`);
console.log(`grouped:   ${stats.fromSection} by section header, ${stats.fromName} by name pattern, ${stats.unsorted} unsorted`);
console.log(`hard deps: ${withDeps.length} mods with declared dependencies`);
console.log(`\nwrote ${OUT_DIR}/bg3-masterlist.json`);
console.log(`wrote ${OUT_DIR}/coverage-report.md`);
