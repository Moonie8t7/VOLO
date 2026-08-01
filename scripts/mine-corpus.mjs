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
 * The base-game packages carry the game build they were shipped with, so a full
 * BG3MM export tells us which patch the load order was actually built against.
 * 4.7.x is Patch 7, 4.8.x is Patch 8. Worth capturing because BG3 patches break
 * compatibility outright, and a single-game tool can afford to model that rather
 * than abstract it away.
 */
function compareBuilds(a = '0', b = '0') {
  const pa = String(a).split('.').map(Number);
  const pb = String(b).split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff) return diff;
  }
  return 0;
}

/** Highest base-game build referenced anywhere in one exported order. */
function detectGameBuild(entries) {
  let best = null;
  for (const entry of entries) {
    for (const dep of entry?.Dependencies ?? []) {
      if (!ENGINE_MASTERS.has(dep?.Name)) continue;
      const build = dep?.Version?.Version;
      if (build && (!best || compareBuilds(build, best) > 0)) best = build;
    }
  }
  return best;
}

/** "4.8.700.7143220" -> "Patch 8". Anything unexpected is reported verbatim. */
function patchLabel(build) {
  if (!build) return null;
  const [major, minor] = String(build).split('.');
  if (major === '4' && minor) return `Patch ${String(minor)[0]}`;
  return build;
}

/**
 * Canonical group order. `after` encodes the load-order relation the way LOOT
 * does. Each group loads after the ones named. Derived from the section
 * headers modders actually wrote in their own working orders.
 */
/**
 * Categories use the community "Sorting Category Empty Mods" vocabulary, so the
 * names match the separators people already put in their load orders.
 *
 * The ORDER is learned from the submitted working load orders, not invented.
 * scripts/learn-category-order.mjs aggregates every mod pair in every working
 * order to category level (tens of thousands of observations per pair) and
 * ranks categories by weighted head to head wins. This sequence is that
 * ranking, with exactly two definitional overrides: Top of Load Order is
 * pinned first and Bottom of Load Order is pinned last.
 *
 * Some of it contradicts tidy doctrine, for example Spells precede Classes at
 * 80 percent across 11,833 observed pairs. The data wins: these orders are the
 * verified article, and doctrine is what produced an ordering that scored
 * barely above random. Re-run the learner as submissions arrive and update
 * this list when the evidence shifts.
 *
 * Real dependencies are hard edges in the sorter and can never be violated by
 * group order, so trusting the learned sequence cannot break a dependency
 * chain.
 */
const GROUPS = [
  { name: 'Top of Load Order',       after: [],                            description: 'Explicit head marker' },
  { name: 'User Interface',          after: ['Top of Load Order'],         description: 'Interface frameworks, hotbar, tooltips and menus' },
  { name: 'Visuals',                 after: ['User Interface'],            description: 'Textures and visual effects' },
  { name: 'Weapons',                 after: ['Visuals'],                   description: 'Weapons' },
  { name: 'Dyes',                    after: ['Weapons'],                   description: 'Dyes and colour options' },
  { name: 'Clothing',                after: ['Dyes'],                      description: 'Outfits and camp clothing' },
  { name: 'Character Customization', after: ['Clothing'],                  description: 'Creation options, presets, makeup and tattoos' },
  { name: 'Resources',               after: ['Character Customization'],   description: 'Shared libraries and frameworks other mods depend on' },
  { name: 'Equipment',               after: ['Resources'],                 description: 'General gear, consumables and containers' },
  { name: 'Armor',                   after: ['Equipment'],                 description: 'Armour sets and pieces' },
  { name: 'Utilities',               after: ['Armor'],                     description: 'Loaders, mod fixers and script extender support' },
  { name: 'Races',                   after: ['Utilities'],                 description: 'Races, subraces and lineages' },
  { name: 'Animations',              after: ['Races'],                     description: 'Animation replacements and additions' },
  { name: 'Spells',                  after: ['Animations'],                description: 'Spell additions and overhauls' },
  { name: 'Classes',                 after: ['Spells'],                    description: 'Classes, subclasses and feats' },
  { name: 'Bodies',                  after: ['Classes'],                   description: 'Body models and skins' },
  { name: 'Miscellaneous',           after: ['Bodies'],                    description: 'Everything without a better home' },
  { name: 'Bug Fixes',               after: ['Miscellaneous'],             description: 'Fixes and compatibility patches' },
  { name: 'Gameplay',                after: ['Bug Fixes'],                 description: 'Rules, mechanics, combat and progression' },
  { name: 'Accessories',             after: ['Gameplay'],                  description: 'Jewellery, cloaks and trinkets' },
  { name: 'Quests',                  after: ['Accessories'],               description: 'New and altered quests' },
  { name: 'Environment',             after: ['Quests'],                    description: 'World, lighting and level changes' },
  { name: 'Audio',                   after: ['Environment'],               description: 'Sound and music' },
  { name: 'Hair',                    after: ['Audio'],                     description: 'Hairstyles and beards' },
  { name: 'Heads',                   after: ['Hair'],                      description: 'Heads, faces and eyes' },
  { name: 'Dice',                    after: ['Heads'],                     description: 'Dice skins' },
  { name: 'Companions',              after: ['Dice'],                      description: 'Companion edits and new party members' },
  { name: 'NPC',                     after: ['Companions'],                description: 'Non-companion character changes' },
  { name: 'Bottom of Load Order',    after: ['NPC'],                       description: 'Explicit tail marker' },
  { name: 'unsorted',                after: ['NPC'],                       description: 'Not yet categorised by the community' },
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
  [/^bg3se|script\s*extender|^norbyte/i,                          'Utilities'],
  [/native\s*mod\s*loader|^nativemodloader|^mod\s*fixer|modfixer/i, 'Utilities'],
  [/^impui|improvedui/i,                                          'User Interface'],
  [/^communitylibrary|community\s*library/i,                      'Resources'],
  [/^volitioncabinet/i,                                           'Resources'],
  [/^aahzlib|material\s*library|^tagframework/i,                  'Resources'],
  [/compatibility\s*framework|^compatibilityframework/i,          'Resources'],
  [/mod\s*configuration\s*menu|^bg3mcm/i,                         'Resources'],
  [/item\s*shipment\s*framework/i,                                'Resources'],
];

/**
 * Section header text (lowercased) -> canonical group.
 *
 * Deliberately omits "core", "essentials" and "script extender". In submitted
 * orders those headers mean "important to me" or "requires SE", not "load early",
 * and mis-sort badly. Real infrastructure is caught by CURATED above.
 */
const SECTION_TO_GROUP = {
  'top of load order': 'Top of Load Order', 'bottom of load order': 'Bottom of Load Order',
  'loaders': 'Utilities', 'utilities': 'Utilities', 'utility': 'Utilities',
  'libraries': 'Resources', 'library': 'Resources', 'resources': 'Resources',
  'frameworks': 'Resources', 'framework': 'Resources',
  'gameplay': 'Gameplay', 'tweaks': 'Gameplay', 'combat': 'Gameplay', 'cheats': 'Gameplay',
  'mechanics': 'Gameplay', 'quality of life': 'Gameplay', 'qol': 'Gameplay', 'balance': 'Gameplay',
  'classes': 'Classes', 'subclasses': 'Classes', 'class': 'Classes', 'feats': 'Classes',
  'deities': 'Classes', 'backgrounds': 'Classes', 'religion': 'Classes',
  'sorcerer': 'Classes', 'druid': 'Classes', 'wizard': 'Classes', 'cleric': 'Classes',
  'warlock': 'Classes', 'fighter': 'Classes', 'rogue': 'Classes', 'bard': 'Classes',
  'paladin': 'Classes', 'ranger': 'Classes', 'monk': 'Classes', 'barbarian': 'Classes',
  'races': 'Races', 'race': 'Races', 'subraces': 'Races',
  'spells': 'Spells', 'spell': 'Spells', 'magic': 'Spells', 'cantrips': 'Spells',
  'gear': 'Equipment', 'items': 'Equipment', 'equipment': 'Equipment',
  'consumables': 'Equipment', 'containers': 'Equipment',
  'armor': 'Armor', 'armour': 'Armor',
  'weapons': 'Weapons', 'weapon': 'Weapons',
  'jewelry': 'Accessories', 'jewellery': 'Accessories', 'accesories': 'Accessories',
  'accessories': 'Accessories', 'cloaks': 'Accessories',
  'character creator': 'Character Customization', 'character creation': 'Character Customization',
  'character customization': 'Character Customization', 'cc': 'Character Customization',
  'tattoos': 'Character Customization', 'presets': 'Character Customization',
  'cosmetics': 'Character Customization', 'makeup': 'Character Customization',
  'cosmetic colors': 'Character Customization',
  'bodies': 'Bodies', 'body': 'Bodies', 'skins': 'Bodies',
  'heads': 'Heads', 'head': 'Heads', 'eyes': 'Heads', 'faces': 'Heads',
  'hair': 'Hair', 'hairstyles': 'Hair', 'beards': 'Hair',
  'clothing': 'Clothing', 'clothes': 'Clothing', 'outfits': 'Clothing',
  'camp clothes': 'Clothing', 'camp': 'Clothing',
  'dyes': 'Dyes', 'dye': 'Dyes',
  'companions': 'Companions', 'companion edits': 'Companions', 'origins': 'Companions',
  'npcs': 'NPC', 'npc': 'NPC', 'characters': 'NPC',
  'quests': 'Quests', 'quest': 'Quests',
  'environment': 'Environment', 'lighting': 'Environment',
  'animations': 'Animations', 'animation': 'Animations',
  'user interface': 'User Interface', 'ui': 'User Interface', 'interface': 'User Interface',
  'hud': 'User Interface',
  'textures': 'Visuals', 'visuals': 'Visuals', 'vfx': 'Visuals',
  'dices': 'Dice', 'dice': 'Dice',
  'audio': 'Audio', 'sound': 'Audio', 'music': 'Audio',
  'other': 'Miscellaneous', 'miscellaneous': 'Miscellaneous', 'misc': 'Miscellaneous',
  'patches': 'Bug Fixes', 'patch': 'Bug Fixes', 'compatibility': 'Bug Fixes',
  'compatibility patches': 'Bug Fixes',
  'fixes': 'Bug Fixes', 'fix': 'Bug Fixes', 'bugfixes': 'Bug Fixes', 'bug fixes': 'Bug Fixes',
};

/** Fallback name patterns when a mod sits under no section header. */
const NAME_PATTERNS = [
  [/script\s*extender|nativemodloader|native mod loader|^bg3se|^mod\s*fixer/i, 'Utilities'],
  [/improvedui|^impui|hotbar|tooltip|sidebar|inventory ui|\bui\b|interface|topbar|context menu/i, 'User Interface'],
  [/communitylibrary|community library|volitioncabinet|materiallibrary|material library|^lib[A-Z]|modders?\s*resource|compatibilityframework|compatibility framework|mod configuration menu|^bg3mcm|framework$|framework\b/i, 'Resources'],
  [/\bspell|cantrip|\bmagic\b/i, 'Spells'],
  [/subclass|\bclass\b|\bfeat\b|deity|deities/i, 'Classes'],
  [/\brace\b|subrace|tiefling|githyanki|dragonborn|drow\b/i, 'Races'],
  [/hair|beard/i, 'Hair'],
  [/\bheads?\b|\beyes?\b|\bfaces?\b/i, 'Heads'],
  [/\bbod(y|ies)\b|skin\s*tone/i, 'Bodies'],
  [/tattoo|makeup|preset|character\s*creat/i, 'Character Customization'],
  [/\bdyes?\b/i, 'Dyes'],
  [/outfit|clothing|clothes|camp\s*(clothes|outfit)/i, 'Clothing'],
  [/armou?r/i, 'Armor'],
  [/weapon|\bswords?\b|\bblades?\b|\bbows?\b|dagger/i, 'Weapons'],
  [/jewel|amulet|\brings?\b|cloak|earring/i, 'Accessories'],
  [/equipment|\bgear\b|basket.*equipment|container/i, 'Equipment'],
  [/companion|astarion|shadowheart|karlach|lae.?zel|halsin|minthara/i, 'Companions'],
  [/\bnpcs?\b/i, 'NPC'],
  [/\bquests?\b/i, 'Quests'],
  [/animation/i, 'Animations'],
  [/\bdice\b/i, 'Dice'],
  [/audio|sound|music|voice/i, 'Audio'],
  [/texture|colou?rs?\b|vfx|visual/i, 'Visuals'],
  [/\bpatch(es)?\b|compatibility|\bfix(es)?\b|hotfix/i, 'Bug Fixes'],
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
  orders.push({ file, label: labelOf(file), entries, gameBuild: detectGameBuild(entries) });
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
      seenIn: new Set(), seenInWorking: 0, lastGameBuild: null,
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
    if (order.gameBuild && compareBuilds(order.gameBuild, r.lastGameBuild ?? '0') > 0) {
      r.lastGameBuild = order.gameBuild;
    }
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
  if (r.lastGameBuild) plugin.lastSeenGameBuild = r.lastGameBuild;
  plugin.evidence = {
    source: confidence,
    installs: r.seenIn.size,
    workingInstalls: r.seenInWorking,
  };
  plugins.push(plugin);
}

plugins.sort((a, b) =>
  b.evidence.installs - a.evidence.installs || a.name.localeCompare(b.name));

// Every distinct base-game build the corpus was built against, newest first.
const builds = [...new Set(orders.map(o => o.gameBuild).filter(Boolean))]
  .sort((a, b) => compareBuilds(b, a));
const newestBuild = builds[0] ?? null;

const masterlist = {
  $schema: './masterlist.schema.json',
  version: '2.0.0',
  generated: new Date().toISOString(),
  generator: 'scripts/mine-corpus.mjs',
  // The BG3 build this masterlist is calibrated against. Patches change what is
  // compatible, so consumers need to know how current the data is.
  gameBuild: newestBuild,
  gamePatch: patchLabel(newestBuild),
  gameBuildsObserved: builds,
  provenance: {
    ordersAnalysed: orders.length,
    working: orders.filter(o => o.label === 'working').length,
    broken: orders.filter(o => o.label === 'broken').length,
    unlabelled: orders.filter(o => o.label === 'unlabelled').length,
    ordersWithKnownBuild: orders.filter(o => o.gameBuild).length,
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

## Game version

Calibrated against **${masterlist.gamePatch ?? 'unknown'}** (build \`${masterlist.gameBuild ?? 'unknown'}\`).

BG3 patches change what is compatible, so the build a load order was made on
matters. Full BG3MM exports record it on the base-game packages, which is where
this comes from. Only ${masterlist.provenance.ordersWithKnownBuild} of ${orders.length} orders carry it, because the short
export format omits dependency metadata entirely.

Builds observed across the corpus, newest first:

${builds.length ? builds.map(b => `- \`${b}\` (${patchLabel(b)})`).join('\n') : '_none recorded_'}

${plugins.filter(p => p.lastSeenGameBuild).length} mods record the newest build they were seen on, which is what would let
the tool flag a mod as last verified on an older patch.

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
console.log(`game:      ${masterlist.gamePatch ?? 'unknown'} (build ${masterlist.gameBuild ?? 'unknown'}), ${builds.length} builds seen`);
console.log(`\nwrote ${OUT_DIR}/bg3-masterlist.json`);
console.log(`wrote ${OUT_DIR}/coverage-report.md`);
