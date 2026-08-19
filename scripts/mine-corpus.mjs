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
import { readProvenance, isVoloSorted } from './corpus-provenance.mjs';
import { loadCuratedRules } from './curated-rules.mjs';
import { measureBreakage } from './learn-breakage.mjs';

const provenance = readProvenance();
const curated = loadCuratedRules();

const CORPUS_DIR = 'Load Orders - Public Submitted';

/**
 * `--out <dir>` writes elsewhere and `--exclude <file>` leaves one order out,
 * so a masterlist can be built that has never seen a given order. That is what
 * makes honest held-out evaluation possible: scoring against orders the
 * masterlist was built from measures memory, not generalisation.
 */
const argOf = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const OUT_DIR = argOf('out', 'masterlist');
const EXCLUDE = argOf('exclude', null);
fs.mkdirSync(OUT_DIR, { recursive: true });

/** Base-game data packages. They appear in Dependencies but are not mods. */
/*
 * Read rather than repeated. This list existed here and in the parser, and the
 * two drifted: the parser learned about MainUI, CrossplayUI and PhotoMode and
 * this one did not, so 32 mods carried a requirement for a base game module
 * and told people it was missing from their load order.
 */
const ENGINE_MASTERS = new Set(
  JSON.parse(fs.readFileSync(path.join('client', 'src', 'lib', 'engine-modules.json'), 'utf8')).modules,
);

/**
 * Astra's Load Order Dividers, recognised by exact UUID. In submitted orders
 * they are entries like any other, so without this they would be mined as
 * mods; instead they vanish from the mod list and their labels become section
 * hints, exactly like hand-typed dashed separators.
 */
const DIVIDERS = (() => {
  try {
    const d = JSON.parse(fs.readFileSync(path.join('masterlist', 'separator-mods.json'), 'utf8'));
    return new Map(d.separators.map(x => [x.uuid, x.name]));
  } catch {
    return new Map();
  }
})();

/** Canonical divider names, so a thin export that lists a divider by name and
 * not by uuid is still read as a skeleton marker rather than as a mod. */
const DIVIDER_NAMES = new Set(DIVIDERS.values());

/** Divider lookup that does not care how an export cased its UUIDs. */
const DIVIDERS_BY_LOWER = new Map([...DIVIDERS].map(([u, n]) => [String(u).toLowerCase(), n]));

/**
 * The canonical divider name for an entry, or null if it is a real mod.
 *
 * The identity is resolved first and the skeleton tested second, which is the
 * opposite of how this once read. Testing `entry.UUID` alone meant a thin
 * export, which writes `"UUID": ""` and lets submitters restyle the names,
 * matched neither the UUID table nor the canonical-name table: one order's 103
 * dividers were mined as mods, and that order's 418 real mods recorded no
 * section and no slot, because the loop never saw a divider to sit them under.
 *
 * Resolving first also closes the hole the other way round. Once a name can
 * resolve to a UUID some other order supplied, a restyled divider name resolves
 * to a real divider UUID, and testing before that happened put 103 divider paks
 * into the masterlist under their true identities. The browser then matched
 * them by name and wrote those UUIDs into the exported order, which is the one
 * outcome that could make BG3 Mod Manager move somebody's actual dividers.
 */
const dividerNameOf = entry => {
  const key = String(keyOf(entry)).toLowerCase();
  if (DIVIDERS_BY_LOWER.has(key)) return DIVIDERS_BY_LOWER.get(key);
  return DIVIDER_NAMES.has(entry.Name) ? entry.Name : null;
};

/**
 * The key a load order entry is recorded under.
 *
 * Thin exports carry names and empty UUID strings; the name is still an
 * observation about a real mod, so it must not be dropped. Such entries key by
 * the `name:` prefix the client also uses for synthetic ids; the two sides
 * normalise differently and are bridged by the client's name index, so only
 * the prefix is shared, not the exact key. A name that strips to nothing under
 * the alphanumeric normalisation, which localisation patches titled entirely
 * in CJK or Cyrillic do, falls back to the lowercased name itself: keying them
 * all as a bare `name:` would pool every such mod into one record.
 */
/**
 * The UUID a pak filename ends with, when it ends with a whole one.
 *
 * Mirrors uuidFromFileName in client/src/lib/parser.ts, deliberately including
 * the rule that only a complete identifier counts: submitted files carry
 * truncated and hand-edited tails, and half a UUID matches nothing while
 * looking like it should.
 */
/**
 * A UUID as an identity: trimmed and lower-cased.
 *
 * Mirrors normaliseUuid in client/src/lib/parser.ts. A UUID is hexadecimal and
 * case means nothing, but every comparison here is an exact string match, so
 * case decides whether two records are the same mod. The filename reader always
 * lower-cased what it found and the UUID field was taken verbatim, so a single
 * exporter writing them upper-case would have agreed with nothing already here.
 * Measured on a real 1,488-mod order: upper-casing its UUIDs produced 1,488
 * identities with none in common with the original.
 */
const normaliseUuid = raw => String(raw ?? '').trim().toLowerCase();

/**
 * Entity decoding for attribute values; &amp; must come last.
 *
 * Mirrors decodeXml in client/src/lib/parser.ts, including the numeric forms.
 * This side decoded the five named entities only, so a name written as
 * `Tav&#39;s Hair` reached the miner with the escape still in it and reached the
 * browser without. The two then disagreed about the mod's name, which is the key
 * every name-based lookup and the `name:` fallback identity are built on.
 *
 * fromCodePoint rather than fromCharCode, because fromCharCode truncates
 * anything above the basic plane and a mod name carrying an emoji would survive
 * as a lone surrogate that matches nothing.
 */
const decodeXml = s =>
  String(s).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, '&');

const uuidFromFileName = fileName => {
  if (!fileName) return undefined;
  const m = String(fileName).match(
    /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\.pak)?$/i,
  );
  return m ? m[1].toLowerCase() : undefined;
};

/**
 * The identity a mod is counted under, from the strongest signal it carries.
 *
 * Three exports of the same load order can describe the same mod three ways.
 * The game's own modsettings.lsx always gives a UUID. BG3MM's full export
 * gives one too. Its load order export writes `"UUID": ""` for anything it has
 * not resolved, and its TSV gives no UUID column at all while naming a pak
 * that ends in one. Reading only the UUID field made the last two into
 * name-keyed rows, so the same mod became two entries depending on which
 * button the submitter pressed: one with twelve working installs, and one seen
 * once in a broken order and reported to users as never verified.
 *
 * A name resolves only to a UUID that some order supplied for that same name,
 * so this can add evidence to an identity the corpus already holds and can
 * never invent one.
 */
const keyOf = entry => {
  const declared = normaliseUuid(entry.UUID);
  if (declared) return declared;
  const fromFile = uuidFromFileName(entry.FileName ?? entry.fileName);
  if (fromFile) return fromFile;
  const named = externalKey(entry.Name) || String(entry.Name).toLowerCase();
  return uuidByName.get(named) ?? `name:${named}`;
};

function dividerSectionLabel(name) {
  const parts = String(name).split(String.fromCharCode(183)).map(p => p.trim());
  if (parts.length < 2) return null;
  return parts.slice(1).join(' ');
}

/**
 * The divider each group opens at, so a group can always name a slot.
 *
 * The dividers are the skeleton of the order whether or not the divider paks
 * are installed; they are positions first and labels second. A mod that only
 * ever resolves to a group still belongs somewhere on that skeleton, and this
 * is where.
 */
const GROUP_DIVIDER = (() => {
  try {
    const d = JSON.parse(fs.readFileSync(path.join('client', 'src', 'lib', 'dividers.json'), 'utf8'));
    // sortNum, not num: a group mapped to a CATEGORY heading sorts at its
    // Other slot, so category-level evidence never outranks an exact slot.
    return new Map(Object.entries(d.byGroup).map(([group, entry]) => [group, entry.sortNum ?? entry.num]));
  } catch {
    return new Map();
  }
})();

/**
 * Nexus and mod.io categories for mods no submitted order contains.
 *
 * The published category is the author's own statement of what the mod is, so
 * it outranks reading the title. It is only ever group-coarse, which puts the
 * mod in the right section but not on a precise slot within it.
 */
const EXTERNAL = (() => {
  try {
    const d = JSON.parse(fs.readFileSync(path.join('masterlist', 'external-categories.json'), 'utf8'));
    return { groups: d.groups, nexus: d.nexus, modio: d.modio, catalogue: d.catalogue };
  } catch {
    return null;
  }
})();

/** Key used by the external catalogues: lowercase, alphanumeric only. */
const externalKey = name => String(name).toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Own-property lookup into a catalogue table. JSON.parse objects inherit
 * Object.prototype, so a mod named "Constructor" would otherwise read the
 * constructor function out of the table and poison whatever consumes it.
 */
const tableGet = (table, key) => (Object.hasOwn(table, key) ? table[key] : undefined);

/**
 * Author -> the one group that author's catalogued mods overwhelmingly sit in.
 *
 * Some mods defeat every name-based tier: "ElectricBlue" says nothing, but its
 * author has ten mods in the catalogues and every one of them is a dice set.
 * The prior only exists for authors with at least three categorised mods, at
 * least eighty percent of them in a single group, so a versatile author
 * contributes nothing and a specialist's habit is allowed to speak.
 */
const AUTHOR_PRIOR = (() => {
  if (!EXTERNAL) return new Map();
  /*
   * One count per distinct mod, not per listing: authors cross-post to both
   * platforms, and counting a mod once per catalogue let an author with two
   * mods clear a threshold that promises three.
   */
  const modsOf = new Map();
  const feed = (author, name) => {
    if (!author || !name) return;
    const key = externalKey(name);
    const idx = tableGet(EXTERNAL.nexus, key) ?? tableGet(EXTERNAL.modio, key);
    if (idx === undefined) return;
    const m = modsOf.get(author) ?? new Map();
    if (!m.has(key)) m.set(key, EXTERNAL.groups[idx]);
    modsOf.set(author, m);
  };
  for (const file of [path.join('nexus', 'catalog.json'), path.join('modio', 'catalog.json')]) {
    try {
      const cat = JSON.parse(fs.readFileSync(file, 'utf8'));
      for (const m of Object.values(cat.mods ?? {})) feed(m.author, m.name);
    } catch {}
  }
  const prior = new Map();
  for (const [author, m] of modsOf) {
    const tally = new Map();
    for (const g of m.values()) tally.set(g, (tally.get(g) || 0) + 1);
    const total = m.size;
    const [best, n] = [...tally.entries()].sort((a, b) => b[1] - a[1])[0];
    if (total >= 3 && n / total >= 0.8) prior.set(author, best);
  }
  return prior;
})();

/** Published category for a mod name, preferring Nexus, or null. */
function groupFromExternal(name) {
  if (!EXTERNAL) return null;
  const key = externalKey(name);
  const index = tableGet(EXTERNAL.nexus, key) ?? tableGet(EXTERNAL.modio, key);
  if (index === undefined) return null;
  const group = EXTERNAL.groups[index];
  return group && group !== 'unsorted' ? group : null;
}

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
 * does: each group loads after the ones named.
 *
 * Categories use the community "Sorting Category Empty Mods" vocabulary, so the
 * names match the separators people already put in their load orders.
 *
 * The ORDER is learned from the submitted working load orders, not invented.
 * scripts/learn-category-order.mjs aggregates every mod pair in every working
 * order to category level (tens of thousands of observations per pair) and
 * searches for the sequence that contradicts the least evidence, counting a
 * contradicted pair by how lopsided it is and how many observations sit behind
 * it. This sequence is that result, with exactly two definitional overrides:
 * Top of Load Order is pinned first and Bottom of Load Order is pinned last.
 *
 * It is generated, not typed. Transcribing it by hand is how it came to
 * contradict 54 of its own 281 pairwise comparisons while a comment above it
 * asked somebody to remember to update it.
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
  { name: 'Top of Load Order',        after: [],                                description: 'Explicit head marker' },
  { name: 'Resources',                after: ['Top of Load Order'],             description: 'Shared libraries and frameworks other mods depend on' },
  { name: 'Utilities',                after: ['Resources'],                     description: 'Loaders, mod fixers and script extender support' },
  { name: 'Visuals',                  after: ['Utilities'],                     description: 'Textures and visual effects' },
  { name: 'Animations',               after: ['Visuals'],                       description: 'Animation replacements and additions' },
  { name: 'User Interface',           after: ['Animations'],                    description: 'Interface frameworks, hotbar, tooltips and menus' },
  { name: 'Clothing',                 after: ['User Interface'],                description: 'Outfits and camp clothing' },
  { name: 'Equipment',                after: ['Clothing'],                      description: 'General gear, consumables and containers' },
  { name: 'Miscellaneous',            after: ['Equipment'],                     description: 'Everything without a better home' },
  { name: 'Spells',                   after: ['Miscellaneous'],                 description: 'Spell additions and overhauls' },
  { name: 'Dyes',                     after: ['Spells'],                        description: 'Dyes and colour options' },
  { name: 'Armor',                    after: ['Dyes'],                          description: 'Armour sets and pieces' },
  { name: 'Weapons',                  after: ['Armor'],                         description: 'Weapons' },
  { name: 'Gameplay',                 after: ['Weapons'],                       description: 'Rules, mechanics, combat and progression' },
  { name: 'Races',                    after: ['Gameplay'],                      description: 'Races, subraces and lineages' },
  { name: 'Classes',                  after: ['Races'],                         description: 'Classes, subclasses and feats' },
  { name: 'Character Customization',  after: ['Classes'],                       description: 'Creation options, presets, makeup and tattoos' },
  { name: 'Bug Fixes',                after: ['Character Customization'],       description: 'Fixes and compatibility patches' },
  { name: 'Accessories',              after: ['Bug Fixes'],                     description: 'Jewellery, cloaks and trinkets' },
  { name: 'Quests',                   after: ['Accessories'],                   description: 'New and altered quests' },
  { name: 'Environment',              after: ['Quests'],                        description: 'World, lighting and level changes' },
  { name: 'Audio',                    after: ['Environment'],                   description: 'Sound and music' },
  { name: 'Heads',                    after: ['Audio'],                         description: 'Heads, faces and eyes' },
  { name: 'Hair',                     after: ['Heads'],                         description: 'Hairstyles and beards' },
  { name: 'Companions',               after: ['Hair'],                          description: 'Companion edits and new party members' },
  { name: 'NPC',                      after: ['Companions'],                    description: 'Non-companion character changes' },
  { name: 'Bodies',                   after: ['NPC'],                           description: 'Body models and skins' },
  { name: 'Dice',                     after: ['Bodies'],                        description: 'Dice skins' },
  { name: 'Bottom of Load Order',     after: ['Dice'],                          description: 'Explicit tail marker' },
  { name: 'unsorted',                 after: ['Dice'],                          description: 'Not yet categorised by the community' },
];

/**
 * Curated overrides. These outrank every other signal.
 *
 * Needed because section headers are unreliable for infrastructure: modders file
 * ImprovedUI under "User Interface" (it is UI, but everything depends on it), and
 * use "Essentials"/"Core" to mean "mods I won't play without" rather than "loads
 * first". Content mods infer fine; the foundation has to be stated.
 */


/**
 * Section header text (lowercased) -> canonical group.
 *
 * Deliberately omits "core", "essentials" and "script extender". In submitted
 * orders those headers mean "important to me" or "requires SE", not "load early",
 * and mis-sort badly. Real infrastructure is caught by CURATED above.
 */
const SECTION_TO_GROUP = {
  'top of load order': 'Top of Load Order', 'bottom of load order': 'Bottom of Load Order',
  'late loaders': 'Bug Fixes',
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
  'dices': 'Dice', 'dice': 'Dice',
  'bodies': 'Bodies', 'body': 'Bodies', 'skins': 'Bodies',
  'heads': 'Heads', 'head': 'Heads', 'eyes': 'Heads', 'faces': 'Heads',
  'hair': 'Hair', 'hairstyles': 'Hair', 'beards': 'Hair',
  'clothing': 'Clothing', 'clothes': 'Clothing', 'outfits': 'Clothing',
  'camp clothes': 'Clothing',
  'dyes': 'Dyes', 'dye': 'Dyes',
  'companions': 'Companions', 'companion edits': 'Companions', 'origins': 'Companions',
  'npcs': 'NPC', 'npc': 'NPC', 'characters': 'NPC',
  'quests': 'Quests', 'quest': 'Quests',
  'environment': 'Environment', 'lighting': 'Environment',
  'animations': 'Animations', 'animation': 'Animations',
  'user interface': 'User Interface', 'ui': 'User Interface', 'interface': 'User Interface',
  'hud': 'User Interface',
  'textures': 'Visuals', 'visuals': 'Visuals', 'vfx': 'Visuals',
  'audio': 'Audio', 'sound': 'Audio', 'music': 'Audio',
  'other': 'Miscellaneous', 'miscellaneous': 'Miscellaneous', 'misc': 'Miscellaneous',
  'patches': 'Bug Fixes', 'patch': 'Bug Fixes', 'compatibility': 'Bug Fixes',
  'compatibility patches': 'Bug Fixes',
  'fixes': 'Bug Fixes', 'fix': 'Bug Fixes', 'bugfixes': 'Bug Fixes',
  'ui mods': 'User Interface', 'library mods': 'Resources',
  'scriptbased mods': 'Gameplay', 'story content': 'Quests',
  'world content': 'Environment', 'skillset': 'Spells',
  'customization': 'Character Customization', 'posing': 'Animations',
  'unique': 'Character Customization',
  'body mods': 'Bodies', 'bug fixes': 'Bug Fixes',
};

/**
 * Fallback name patterns for mods no submitted order has placed.
 *
 * This table has a twin in client/src/lib/optimiser.ts that classifies user
 * imports the corpus has never seen. The smoke test asserts the two are
 * structurally identical, row for row, because they once drifted in nine rows
 * and thirty-eight positions and the same mod sorted differently depending on
 * how it arrived. Change them together.
 *
 * Each entry names the exact divider the mod belongs under.
 * A feat mod is 045 Skillset Feats; calling it "Classes" would file it at the
 * category divider 056 and sort it below every spell and ability mod, which is
 * both wrong and visibly wrong to anyone reading the exported order.
 *
 * First match wins, so the list runs most specific first.
 */
const NAME_PATTERNS = [
  [/script\s*extender|nativemodloader|native mod loader|^bg3se|^mod\s*fixer/i, 'Utilities', 19],
  [/improvedui|^impui/i,                                'User Interface', 1],
  [/hotbar|tooltip|sidebar|inventory ui|\bui\b|interface|topbar|context menu/i, 'User Interface', 5],
  [/volitioncabinet|volition\s*cabinet/i,               'Resources', 7],
  [/communitylibrary|community\s*library/i,             'Resources', 8],
  [/materiallibrary|material\s*library/i,               'Resources', 10],
  [/mod configuration menu|^bg3mcm|\bmcm\b/i,           'Resources', 14],
  // Ahead of the generic framework rule, which would otherwise swallow it.
  [/compatibility\s*framework/i,                        'Bottom of Load Order', 105],
  [/^lib[A-Z]|modders?\s*resource|framework$|framework\b/i, 'Resources', 15],
  [/waypoint/i,                                         'Utilities', 18],
  [/encounter|miniboss/i,                               'Gameplay', 31],
  [/\bfeats?\b/i,                                      'Classes', 45],
  [/\babilit(y|ies)\b/i,                               'Spells', 46],
  [/summon|familiar/i,                                  'Spells', 49],
  [/\bspell|cantrip|\bmagic\b/i,                       'Spells', 47],
  // Astra numbers a sub-slot per class, alphabetically. A name that says both
  // which class and that it is a subclass lands on the exact one; a multi-class
  // pack stays on the 058 parent, where a compilation belongs.
  [/(?=.*subclass)(?=.*barbarian)/i,                    'Classes', 58.01],
  [/(?=.*subclass)(?=.*\bbard\b)/i,                     'Classes', 58.02],
  [/(?=.*subclass)(?=.*cleric)/i,                       'Classes', 58.03],
  [/(?=.*subclass)(?=.*druid)/i,                        'Classes', 58.04],
  [/(?=.*subclass)(?=.*fighter)/i,                      'Classes', 58.05],
  [/(?=.*subclass)(?=.*\bmonk\b)/i,                     'Classes', 58.06],
  [/(?=.*subclass)(?=.*paladin)/i,                      'Classes', 58.07],
  [/(?=.*subclass)(?=.*ranger)/i,                       'Classes', 58.08],
  [/(?=.*subclass)(?=.*rogue)/i,                        'Classes', 58.09],
  [/(?=.*subclass)(?=.*sorcerer)/i,                     'Classes', 58.1],
  [/(?=.*subclass)(?=.*warlock)/i,                      'Classes', 58.11],
  [/(?=.*subclass)(?=.*wizard)/i,                       'Classes', 58.12],
  [/subclass/i,                                         'Classes', 58],
  [/\bclass(es)?\b|deity|deities/i,                    'Classes', 56],
  // Same per-race routing for subraces. Compound races run ahead of the races
  // their names contain, so a half-elf pack is not filed under elves.
  [/(?=.*subrace)(?=.*half.?orc)/i,                     'Races', 53.05],
  [/(?=.*subrace)(?=.*half.?el(f|ves))/i,               'Races', 53.04],
  [/(?=.*subrace)(?=.*dragonborn)/i,                    'Races', 53.11],
  [/(?=.*subrace)(?=.*tiefling)/i,                      'Races', 53.09],
  [/(?=.*subrace)(?=.*gith)/i,                          'Races', 53.1],
  [/(?=.*subrace)(?=.*drow)/i,                          'Races', 53.03],
  [/(?=.*subrace)(?=.*(dwarf|dwarves|duergar))/i,       'Races', 53.07],
  [/(?=.*subrace)(?=.*gnome)/i,                         'Races', 53.08],
  [/(?=.*subrace)(?=.*halfling)/i,                      'Races', 53.06],
  [/(?=.*subrace)(?=.*el(f|ves))/i,                     'Races', 53.02],
  [/(?=.*subrace)(?=.*human)/i,                         'Races', 53.01],
  [/subraces?/i,                                        'Races', 53],
  [/tiefling|githyanki|dragonborn|drow\b/i,             'Races', 52],
  [/\braces?\b/i,                                      'Races', 51],
  [/hair|beard/i,                                       'Hair', 64],
  [/\bheads?\b|\beyes?\b|\bfaces?\b/i,                'Heads', 63],
  [/\bbod(y|ies)\b|skin\s*tone/i,                      'Bodies', 99],
  [/tattoo|makeup|\bscars?\b/i,                        'Character Customization', 100],
  [/\bhorns?\b/i,                                       'Character Customization', 65],
  [/\btails?\b|\bwings?\b/i,                            'Character Customization', 66],
  [/piercing/i,                                         'Character Customization', 67],
  [/preset|character\s*creat/i,                         'Character Customization', 61],
  [/\bdyes?\b/i,                                       'Dyes', 38],
  [/outfit|clothing|clothes|camp\s*(clothes|outfit)/i,  'Clothing', 37],
  [/underwear|lingerie/i,                               'Clothing', 41],
  [/armou?r/i,                                          'Armor', 36],
  [/weapon|\bswords?\b|\bblades?\b|\bbows?\b|dagger/i,  'Weapons', 42],
  [/jewel|amulet|\brings?\b|earring/i,                 'Accessories', 40],
  [/cloak/i,                                            'Accessories', 35],
  [/instrument|\blute\b|\bflute\b/i,                     'Equipment', 39],
  [/equipment|\bgear\b|basket.*equipment|container/i,   'Equipment', 43],
  [/astarion/i,                                         'Companions', 71],
  [/\bgale\b/i,                                        'Companions', 72],
  [/halsin/i,                                           'Companions', 73],
  [/jaheira/i,                                          'Companions', 74],
  [/karlach/i,                                          'Companions', 75],
  [/lae.?zel/i,                                         'Companions', 76],
  [/minsc/i,                                            'Companions', 77],
  [/minthara/i,                                         'Companions', 78],
  [/shadowheart/i,                                      'Companions', 79],
  [/\bwyll\b/i,                                        'Companions', 80],
  [/scratch|owlbear\s*cub/i,                            'Companions', 81],
  [/companion/i,                                        'Companions', 82],
  [/\bnpcs?\b/i,                                       'NPC', 23],
  [/\bquests?\b/i,                                     'Quests', 25],
  [/\bposes?\b/i,                                      'Animations', 86],
  [/animation|\bidles?\b/i,                            'Animations', 83],
  [/\bdice\b/i,                                        'Dice', 90],
  [/audio|sound|music|voice/i,                          'Audio', 92],
  [/\bvfx\b|visual/i,                                  'Visuals', 11],
  [/texture/i,                                          'Visuals', 10],
  [/colou?rs?\b/i,                                      'Visuals', 62],
  [/\bpatch(es)?\b|compatibility|\bfix(es)?\b|hotfix/i, 'Bug Fixes', 98],
];


/**
 * Placement vocabulary taken from Astra's sub-dividers.
 *
 * The divider set names a hundred things our thirty groups do not: a Warlock
 * subclass, a Tiefling subrace, Waypoints, Summons, Instruments, Pose Packs,
 * the Compatibility Framework. Mod names carry those words constantly, so the
 * taxonomy doubles as a classifier for mods no submitted order has placed.
 *
 * Applied only after every other signal has failed, so it can add placements
 * but never overrule a human one. Ordered most specific first: a name holding
 * both "Warlock" and "Armor" is a class mod carrying gear, not the reverse.
 */
const DIVIDER_PATTERNS = [
  [/compatibility\s*framework/i,                        'Bottom of Load Order', 105],
  [/universal\s*patcher|major\s*patch/i,                'Bug Fixes',            94],
  [/appearance\s*edit/i,                                 'Bug Fixes',            104],
  [/volition\s*cabinet|community\s*library/i,           'Resources',            7],
  [/\bshader|texture|material/i,                         'Resources',            9],
  [/\bvfx\b|visual\s*effect/i,                          'Resources',            11],
  [/\bmcm\b|mod\s*configuration/i,                      'Resources',            14],
  [/waypoint/i,                                          'Utilities',            18],
  [/restored\s*content/i,                                'Gameplay',             17],
  [/tutorial\s*chest/i,                                  'Gameplay',             29],
  [/encounter|miniboss/i,                                'Gameplay',             31],
  [/\bdialogue\b|banter/i,                               'NPC',                  22],
  [/astarion|shadowheart|karlach|lae.?zel|\bgale\b|wyll|halsin|minthara|minsc|jaheira|scratch|owlbear\s*cub/i,
                                                         'Companions',           71],
  [/\blocation|\bmap\b/i,                                'Environment',          26],
  [/instrument|\blute\b|\bflute\b/i,                     'Equipment',            39],
  [/jewel|amulet|\bring\b|earring|necklace/i,            'Accessories',          40],
  [/underwear|lingerie/i,                                'Clothing',             41],
  [/\bfeats?\b/i,                                        'Classes',              45],
  [/summon|familiar/i,                                   'Spells',               49],
  [/barbarian|\bbard\b|cleric|druid|fighter|\bmonk\b|paladin|ranger|\brogue\b|sorcerer|warlock|wizard|artificer/i,
                                                         'Classes',              58],
  [/tiefling|githyanki|\bgith\b|dragonborn|halfling|half.?orc|half.?elf|\bdrow\b|\bgnome\b|\bdwarf|\bdwarves\b|\belves\b|\belf\b|aasimar|\borc\b/i,
                                                         'Races',                53],
  [/\bhorns?\b/i,                                        'Character Customization', 65],
  [/\btails?\b|\bwings?\b/i,                             'Character Customization', 66],
  [/piercing/i,                                          'Character Customization', 67],
  [/tattoo|makeup|\bscars?\b/i,                          'Character Customization', 100],
  [/\bpose|\bqsat\b|lighty\s*lights/i,                   'Animations',           86],
  [/\bbody\b|\bbodies\b/i,                               'Bodies',               99],
  [/\beyes?\b|glow\s*eyes|\beotb\b/i,                    'Heads',                96],
];

/** First divider pattern a name matches, or null. */
function dividerGuess(rawName) {
  const name = searchableName(rawName);
  for (const [re, group, num] of DIVIDER_PATTERNS) {
    if (re.test(name)) return { group, num };
  }
  return null;
}

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
  // The game's own modsettings.lsx, submitted raw. The base-game modules it
  // lists are not mods and are dropped here, the same as everywhere else.
  if (raw.trimStart().startsWith('<?xml') && raw.includes('ModuleShortDesc')) {
    const entries = [];
    for (const block of raw.split(/<node\s+id="ModuleShortDesc"/).slice(1)) {
      const scope = block.split('</node>')[0];
      const rec = {};
      for (const m of scope.matchAll(/<attribute\s+id="([^"]+)"[^>]*\bvalue="([^"]*)"/g)) {
        rec[m[1]] = decodeXml(m[2]);
      }
      if (ENGINE_MASTERS.has(rec.Folder) || ENGINE_MASTERS.has(rec.Name)) continue;
      entries.push(rec);
    }
    return entries;
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
  // Anything prefixed current_ is an order the maintainer personally played on,
  // which is the strongest verification we have.
  if (n.startsWith('working_') || n.startsWith('current_')) return 'working';
  return 'unlabelled';
}

/**
 * A separator is a cosmetic divider, not a mod. Modders write them many ways:
 *   ---------------------------|   Spells   |---------------------------
 *   ] Armor [
 *   >             Jewelry
 *
 * The run of dashes has to open the name, close it, or be the whole of it.
 * Matching one anywhere deleted real mods: "Angel Wings And Halos ____ By Ren"
 * carries four underscores in the middle of its title and 264,623 downloads,
 * and every order holding it lost it silently, because a row read as a header
 * never becomes a mod, is never sorted, and is never written back out.
 * Checked against the whole corpus before changing: of 31,363 rows this
 * classifies every one exactly as the looser rule did.
 *
 * Ornaments are read the same way, and were not until an author submitted an
 * order built on 301 of them and was told it contained no section headers. All
 * 301 entered the masterlist as mods with groups and slots, which means this
 * rule failing sorts somebody's dividers as though they were mods and takes
 * their order apart.
 *
 * Kept identical to isSeparator in client/src/lib/parser.ts. The two sides
 * disagreeing means the browser sorts rows the corpus never learned from.
 */

/** Box drawing, blocks, geometric shapes, arrows and dingbats. */
const ORNAMENT = '\\u2190-\\u21FF\\u2500-\\u257F\\u2580-\\u259F\\u25A0-\\u25FF\\u2600-\\u27BF\\u2B00-\\u2BFF';

const SEPARATOR_RE = new RegExp([
  String.raw`^[\s\-=_~]*$`,
  String.raw`^\s*[-=_~]{4,}`,
  String.raw`[-=_~]{4,}\s*$`,
  String.raw`^\s*[\]>]\s*\S`,
  String.raw`^\s*\|.*\|\s*$`,
  /* Three, not two. Two takes "(ornament)(ornament).Lagardia's Arcane Presets",
   * a real mod whose author put a pair of ornaments in front of the title.
   * Four loses the three-character banners the same submitter uses. */
  `^\\s*[${ORNAMENT}]{3,}`,
  `[${ORNAMENT}]{3,}\\s*$`,
  /* One ornament, a slot number, then a middot: the sub-divider shape. */
  `^\\s*[${ORNAMENT}]\\s+\\d{1,4}[a-z]?\\s+[\\u00B7\\u2022\\u2027]\\s`,
].join('|'));

function sectionLabel(name) {
  const piped = name.match(/\|([^|]{2,60})\|/);
  if (piped) return piped[1].trim();
  const bracketed = name.match(/\]\s*([^[\]]{2,60})\s*\[/);
  if (bracketed) return bracketed[1].trim();
  const stripped = name.replace(/[-=_~*#>\]\[|]{1,}/g, ' ').replace(/\s+/g, ' ').trim();
  return stripped.length >= 2 ? stripped : null;
}

/**
 * The group a hand-written section header names.
 *
 * An exact key wins. Failing that the table is scanned in declaration order and
 * the first key appearing anywhere in the label wins, which makes the order of
 * the table part of its meaning: a specific key must be declared before any key
 * it contains. "Dice Skins" reached 'skins' before 'dice' and sent 173 dice
 * sets to Bodies on divider 99 instead of Dice on divider 90; "Late Loaders"
 * reached 'loaders' and became Utilities in one order and Bug Fixes in another
 * from the same submitter.
 *
 * A key that never matches exactly is a liability rather than a convenience.
 * 'camp' was one: no header in the corpus is called that, and as a substring it
 * caught "Camp Environment" and "Camp Companions" and called them Clothing.
 */
function groupForSection(label) {
  if (!label) return null;
  const key = label.toLowerCase().replace(/[^a-z ]/g, '').trim();
  if (SECTION_TO_GROUP[key]) return SECTION_TO_GROUP[key];
  for (const [word, group] of Object.entries(SECTION_TO_GROUP)) {
    if (key.includes(word)) return group;
  }
  return null;
}

/**
 * Mod names as the patterns need to see them.
 *
 * Authors write "FeatsOverhaul" and "Essential_Feats" as often as they write
 * "Extra Feats", and a word boundary matches none of the first two. Splitting
 * camel case and punctuation into spaces costs nothing and recovers them. The
 * mod's real name is never touched, only this throwaway copy used for matching.
 */
function searchableName(name) {
  return String(name)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/[_\-.]+/g, ' ');
}

/** Group and divider for a mod name, or null when nothing matches. */
function groupForName(rawName) {
  const name = searchableName(rawName);
  for (const [re, group, divider] of NAME_PATTERNS) {
    if (re.test(name)) return { group, divider };
  }
  return null;
}

// Main

let externalDependencyStats = { added: 0, fromNexus: 0, fromModio: 0, skippedOptional: 0, cycles: 0 };

const orders = [];
const skipped = [];
const seen = new Set();

for (const file of fs.readdirSync(CORPUS_DIR).sort()) {
  if (EXCLUDE && file === EXCLUDE) { skipped.push([file, 'held out']); continue; }
  const entries = readOrder(file);
  if (!entries || entries.length < 5) { skipped.push([file, 'not a load order']); continue; }
  // Fingerprint by name first: a thin export and a full export of the same
  // order differ in every UUID field but agree on every name, and keying the
  // hash on UUIDs let such a pair through to be counted twice.
  const fp = crypto.createHash('md5')
    .update(entries.map(e => e.Name || e.UUID).join('|')).digest('hex');
  if (seen.has(fp)) { skipped.push([file, 'duplicate of another file']); continue; }
  seen.add(fp);
  orders.push({
    file,
    label: labelOf(file),
    entries,
    gameBuild: detectGameBuild(entries),
    // VOLO's own output coming back proves the mods exist and that someone
    // played them, and proves nothing about the sequence, which is VOLO's.
    positional: !isVoloSorted(file, provenance),
  });
}

/**
 * One vote per person on sequence, however many times they export it.
 *
 * Seven groups of near-identical orders sit in the corpus, seventeen files
 * between them: somebody refines their list and submits again a day later, or
 * submits both a thin and a full export of the same evening. Every copy is real
 * and every copy is honest, and counting each one as another opinion about
 * ordering weights one person four times. Fifty-nine working orders are
 * forty-nine independent ones.
 *
 * Only the sequence is de-duplicated. Presence still counts from every copy,
 * because each one is a person genuinely running those mods together, and the
 * never-verified caution reads presence.
 *
 * Compared by name, since a thin export and a full export of the same order
 * agree on names and barely on identifiers until the vote below has run. The
 * copy with the most mods keeps the vote, ties broken on the filename so a
 * rebuild always chooses the same one, and an order VOLO sorted is never the
 * keeper when an independent copy exists.
 */
const NEAR_DUPLICATE = 0.85;
{
  const names = orders.map(o => new Set(
    o.entries.map(e => externalKey(e?.Name ?? '')).filter(Boolean),
  ));
  const parent = orders.map((_, i) => i);
  const find = i => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < orders.length; i++) {
    for (let j = i + 1; j < orders.length; j++) {
      if (orders[i].label !== orders[j].label) continue;
      let shared = 0;
      for (const n of names[i]) if (names[j].has(n)) shared++;
      const union = names[i].size + names[j].size - shared;
      if (union && shared / union >= NEAR_DUPLICATE) parent[find(i)] = find(j);
    }
  }
  const groups = new Map();
  orders.forEach((_, i) => {
    const root = find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(i);
  });
  let muted = 0;
  for (const members of groups.values()) {
    if (members.length < 2) continue;
    const keeper = members
      .slice()
      .sort((a, b) => Number(orders[b].positional) - Number(orders[a].positional)
        || orders[b].entries.length - orders[a].entries.length
        || orders[a].file.localeCompare(orders[b].file))[0];
    for (const i of members) {
      if (i === keeper || !orders[i].positional) continue;
      orders[i].positional = false;
      orders[i].nearDuplicateOf = orders[keeper].file;
      muted++;
    }
  }
  if (muted) {
    console.log(`near-duplicates: ${muted} order(s) keep their mods but not their sequence`);
  }
}

/**
 * Name to the UUID the corpus most often gives that name.
 *
 * Built from every order before any of them is indexed, because the order the
 * files happen to be read in must not decide which identity wins. Where a name
 * has been seen under more than one UUID the one more entries agree on takes
 * it, and ties break on the UUID itself so a rebuild is deterministic.
 *
 * Only names that some export has actually supplied a UUID for appear here. A
 * mod nobody has ever exported with one stays keyed by its name, which is the
 * honest answer rather than a guess.
 */
const uuidByName = (() => {
  const votes = new Map();
  for (const order of orders) {
    for (const entry of order.entries) {
      const uuid = entry.UUID || uuidFromFileName(entry.FileName ?? entry.fileName);
      if (!uuid || !entry.Name) continue;
      const named = externalKey(entry.Name) || String(entry.Name).toLowerCase();
      if (!named) continue;
      if (!votes.has(named)) votes.set(named, new Map());
      const tally = votes.get(named);
      tally.set(uuid, (tally.get(uuid) ?? 0) + 1);
    }
  }
  const resolved = new Map();
  for (const [named, tally] of votes) {
    /*
     * A real mod outranks a divider for a contested name.
     *
     * Divider votes have to stay in: a restyled divider name is only
     * recognisable as a divider because some other order supplied its UUID,
     * and dropping those votes would put the 103 dividers back among the mods.
     * But if a name is carried by a divider AND by a real mod, resolving it to
     * the divider would make the skeleton test delete a real mod, which is the
     * worse of the two mistakes. No name is contested that way today; this
     * decides it before one is.
     */
    const entries = [...tally];
    const real = entries.filter(([u]) => !DIVIDERS_BY_LOWER.has(String(u).toLowerCase()));
    const pool = real.length && real.length < entries.length ? real : entries;
    resolved.set(named, pool.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0]);
  }
  return resolved;
})();

/**
 * Pak folder to UUID, on the same voting rules as uuidByName.
 *
 * A requirement is sometimes stated as the folder a pak installs into rather
 * than as the mod's display name: BG3MCM for Mod Configuration Menu,
 * VladsGrimoire for VFX_Library_VladsGrimoire. Five declared requirements in
 * the corpus name only the folder, and without this they resolve to nothing.
 */
const uuidByFolder = (() => {
  const votes = new Map();
  for (const order of orders) {
    for (const entry of order.entries) {
      const uuid = entry.UUID || uuidFromFileName(entry.FileName ?? entry.fileName);
      if (!uuid || !entry.Folder) continue;
      const key = externalKey(entry.Folder);
      if (!key) continue;
      if (!votes.has(key)) votes.set(key, new Map());
      const tally = votes.get(key);
      tally.set(uuid, (tally.get(uuid) ?? 0) + 1);
    }
  }
  const resolved = new Map();
  for (const [key, tally] of votes) {
    resolved.set(key, [...tally].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0]);
  }
  return resolved;
})();

/**
 * A mod's declared requirements, whichever shape its export wrote them in.
 *
 * A full JSON export gives an array of objects. BG3 Mod Manager's TSV gives one
 * comma-separated string of names, and `for (const dep of "GustavDev, ImpUI")`
 * iterates characters: `dep.Name` is undefined for every one, so the guard below
 * skipped them all and the requirement never reached the graph. It cost 118 of
 * the 222 requirements the corpus states, silently, in the only path the sorter
 * treats as a hard constraint.
 *
 * The client has read both shapes since it was written; toModRefs in
 * client/src/lib/parser.ts splits on the comma, and the smoke test has carried a
 * TSV fixture asserting it the whole time. This is the miner catching up.
 *
 * Comma is the only delimiter present across all 56 distinct values in the
 * corpus, and no mod name containing a comma appears whole in any of them.
 */
const depsOf = entry => {
  const raw = entry.Dependencies ?? entry.dependencies;
  if (Array.isArray(raw)) return raw;
  if (typeof raw !== 'string') return [];
  return raw
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .map(name => {
      const key = externalKey(name);
      return { Name: name, UUID: uuidByName.get(key) ?? uuidByFolder.get(key) ?? '' };
    });
};

/** uuid -> record */
const mods = new Map();
function record(uuid) {
  if (!mods.has(uuid)) {
    mods.set(uuid, {
      uuid,
      names: new Map(),
      sections: new Map(),
      dividers: new Map(),
      dependencies: new Map(),
      featureFlags: new Set(),
      author: null, version: null, folder: null, description: null, metaFrom: null,
      // Sets of filenames, not counters. An order may list the same mod twice,
      // and counting entries made one order look like two: a mod verified once
      // was reported as verified twice, and a caution that asks to have been
      // seen in two separate orders would have been satisfied by one order
      // listing it twice. What matters is how many orders agree, so count them.
      seenIn: new Set(), seenInWorking: new Set(), seenInBroken: new Set(),
      seenInVoloSorted: new Set(), lastGameBuild: null,
    });
  }
  return mods.get(uuid);
}

/** Divider number from a canonical divider name, e.g. 058.01 -> 58.01. */
function dividerNumber(name) {
  const m = String(name).match(/([0-9]+(?:\.[0-9]+)?)/);
  return m ? parseFloat(m[1]) : null;
}

let separatorCount = 0;

for (const order of orders) {
  let currentSection = null;
  let currentDivider = null;
  for (const entry of order.entries) {
    const name = entry.Name;
    if (!name) continue;

    const dividerName = dividerNameOf(entry);
    if (dividerName !== null) {
      separatorCount++;
      // Submitters sometimes restyle divider names in their manager, so the
      // canonical pak name wins over whatever the order file says.
      currentSection = dividerSectionLabel(dividerName)
        ?? dividerSectionLabel(name)
        ?? currentSection;
      // The divider itself is the finest placement statement available. It
      // can say "a Warlock subclass" where the groups can only say "a class
      // mod", and it fixes where that sits relative to everything else.
      currentDivider = dividerNumber(dividerName) ?? currentDivider;
      continue;
    }

    if (SEPARATOR_RE.test(name)) {
      separatorCount++;
      currentSection = sectionLabel(name);
      // A hand-typed header starts a section the divider paks know nothing
      // about, so the last pak divider must not leak past it: every mod below
      // would be credited to a slot the submitter never put it under.
      currentDivider = null;
      continue;
    }
    const r = record(keyOf(entry));
    r.names.set(name, (r.names.get(name) || 0) + 1);
    r.seenIn.add(order.file);
    if (order.label === 'working') r.seenInWorking.add(order.file);
    if (order.label === 'broken') r.seenInBroken.add(order.file);
    // An order VOLO sorted still proves the mod exists and that somebody ran it,
    // which is why it counts towards presence at all. Recorded separately so a
    // page can say how much of a mod's support is VOLO's own answer returning.
    if (!order.positional) r.seenInVoloSorted.add(order.file);
    if (order.gameBuild && compareBuilds(order.gameBuild, r.lastGameBuild ?? '0') > 0) {
      r.lastGameBuild = order.gameBuild;
    }
    // Section headers and dividers are both statements about where a mod goes,
    // so neither is taken from an order VOLO sorted: it would be reading back
    // its own answer, including any dividers the export inserted.
    if (order.positional) {
      if (currentSection) r.sections.set(currentSection, (r.sections.get(currentSection) || 0) + 1);
      if (currentDivider !== null) r.dividers.set(currentDivider, (r.dividers.get(currentDivider) || 0) + 1);
    }

    /*
     * Author and version come from the best observation, not the first one.
     *
     * These were first-writer-wins over a directory listing, and readdir puts
     * "Not-Working_..." ahead of "working_...", so a broken order's copy of a
     * mod described it for everyone. One row credited two authors who had not
     * touched it since it was adopted, on forty of the corpus's orders.
     *
     * A working order outranks a broken or unlabelled one, then the higher
     * version wins, then file order decides so a rebuild is deterministic.
     * Both fields come from the same winning observation, because an author
     * and a version that describe different releases are worse than either
     * alone.
     *
     * Folder and description are deliberately left first-writer-wins. Folder
     * is identity-bearing: the optimiser matches on it, so choosing a
     * different one here would move dependency resolution, which is not what
     * this is for.
     */
    if (entry.Author || entry.Version) {
      const rank = order.label === 'working' ? 2 : order.label === 'broken' ? 0 : 1;
      const version = entry.Version?.Version
        ?? (typeof entry.Version === 'string' ? entry.Version : null);
      const better = !r.metaFrom
        || rank > r.metaFrom.rank
        || (rank === r.metaFrom.rank && compareBuilds(version ?? '0', r.metaFrom.version ?? '0') > 0);
      if (better) r.metaFrom = { rank, version, author: entry.Author ?? null };
    }
    if (entry.Folder && !r.folder) r.folder = entry.Folder;
    if (entry.Description && !r.description) r.description = entry.Description;

    for (const f of entry.ScriptExtenderData?.FeatureFlags ?? []) r.featureFlags.add(f);

    for (const dep of depsOf(entry)) {
      // Both sides normalised, or a mod declaring a requirement on itself in the
      // other case would not be recognised as itself and would become an edge
      // from a mod to itself, which is a cycle the sorter then has to break.
      //
      // Only when there is a UUID to compare. Normalising turns a missing one
      // into the empty string, so a requirement stated by name alone, on a mod
      // whose own UUID the corpus never supplied, compared equal to itself and
      // was dropped. That silently cost two real edges.
      const depUuid = normaliseUuid(dep?.UUID);
      const selfReference = depUuid !== '' && depUuid === normaliseUuid(entry.UUID);
      if (!dep?.Name || ENGINE_MASTERS.has(dep.Name) || selfReference) continue;
      // Keyed by name when the requirement names a mod the corpus has never
      // supplied a UUID for. Keying those on the empty string collapsed every
      // one of them onto a single entry, which could not happen while the
      // array form was the only shape that got this far: every array-form
      // dependency in the corpus carries a UUID.
      r.dependencies.set(depUuid || `name:${externalKey(dep.Name)}`, dep.Name);
    }
  }
}

/*
 * Settle author and version from whichever observation won above, so every
 * consumer past this point sees one answer rather than a running best.
 */
for (const r of mods.values()) {
  if (!r.metaFrom) continue;
  if (r.metaFrom.author) r.author = r.metaFrom.author;
  if (r.metaFrom.version) r.version = r.metaFrom.version;
}

/*
 * Fold name-keyed records into uuid-keyed ones. A mod submitted once with its
 * uuid and once through a thin export is one mod, not two; the fold only fires
 * when exactly one uuid record owns the name, because a shared name split
 * across two uuids is a fact about the corpus, not a tie to break here.
 */
const mergedInto = new Map();
/** A record key with any name-to-uuid merge applied. */
const canonicalKey = k => mergedInto.get(k) ?? k;
{
  const owners = new Map();
  for (const r of mods.values()) {
    if (r.uuid.startsWith('name:')) continue;
    for (const n of r.names.keys()) {
      const k = externalKey(n);
      // A name that strips to nothing owns nothing; without this, one CJK-named
      // uuid record would absorb every CJK-named thin entry in the corpus.
      if (!k) continue;
      owners.set(k, owners.has(k) && owners.get(k) !== r ? 'ambiguous' : r);
    }
  }
  for (const [key, r] of [...mods.entries()]) {
    if (!key.startsWith('name:')) continue;
    const target = owners.get(key.slice('name:'.length));
    if (!target || target === 'ambiguous') continue;
    mergedInto.set(key, target.uuid);
    for (const [n, c] of r.names) target.names.set(n, (target.names.get(n) || 0) + c);
    for (const [s, c] of r.sections) target.sections.set(s, (target.sections.get(s) || 0) + c);
    for (const [d, c] of r.dividers) target.dividers.set(d, (target.dividers.get(d) || 0) + c);
    for (const [u, n] of r.dependencies) if (!target.dependencies.has(u)) target.dependencies.set(u, n);
    for (const f of r.featureFlags) target.featureFlags.add(f);
    for (const f of r.seenIn) target.seenIn.add(f);
    for (const f of r.seenInWorking) target.seenInWorking.add(f);
    for (const f of r.seenInBroken) target.seenInBroken.add(f);
    for (const f of r.seenInVoloSorted) target.seenInVoloSorted.add(f);
    target.author ??= r.author; target.version ??= r.version;
    target.folder ??= r.folder; target.description ??= r.description;
    if (r.lastGameBuild && compareBuilds(r.lastGameBuild, target.lastGameBuild ?? '0') > 0) {
      target.lastGameBuild = r.lastGameBuild;
    }
    mods.delete(key);
  }
}

/** Resolve each mod to a canonical name + group. */
const plugins = [];
const stats = { fromDivider: 0, curated: 0, fromSection: 0, fromName: 0, inferredHigh: 0, inferredLow: 0, unsorted: 0 };

for (const r of mods.values()) {
  const observed = [...r.names.entries()].sort((a, b) => b[1] - a[1]);
  const name = observed[0][0];

  /*
   * The names this mod has also been seen under.
   *
   * A mod that is renamed keeps being listed under its old name by everyone who
   * has not updated, and the corpus holds both. Only the most frequent survived
   * into the masterlist, so a stale pak matched nothing by name and fell through
   * to whatever the next rule guessed. UUID covers most of these, which is why
   * it was survivable; a thin export has no UUID to fall back on, and that is
   * exactly the case where the name is all there is.
   */
  const alternateNames = observed.slice(1).map(([n]) => n);

  let group = null, confidence = null;
  let dividerFromCurated = null;

  // A curated rule names the divider slot itself, so a person can say
  // "this belongs at 105" and be obeyed exactly.
  for (const rule of curated.placements) {
    if (rule.re.test(name)) {
      group = rule.group;
      dividerFromCurated = rule.divider ?? null;
      confidence = 'curated';
      stats.curated++;
      break;
    }
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
  let dividerFromName = null;
  if (!group) {
    const named = groupForName(name);
    if (named) {
      group = named.group;
      dividerFromName = named.divider;
      confidence = 'name-pattern';
      stats.fromName++;
    }
  }
  // The mod's own listing on Nexus or mod.io. Coarser than a name match, which
  // can hit a precise slot, so it runs second; but it is the author speaking
  // rather than us guessing, so it beats giving up.
  if (!group) {
    const external = groupFromExternal(name);
    if (external) {
      group = external;
      confidence = 'external-category';
      stats.fromExternal = (stats.fromExternal ?? 0) + 1;
    }
  }
  // The author's other catalogued mods. Weaker than the mod's own listing,
  // which is why it runs after; a specialist's habit is real information, but
  // it is about the author, not about this mod.
  if (!group && r.author && AUTHOR_PRIOR.has(r.author)) {
    group = AUTHOR_PRIOR.get(r.author);
    confidence = 'author-catalogue';
    stats.fromAuthor = (stats.fromAuthor ?? 0) + 1;
  }
  // Last resort before giving up: Astra's divider vocabulary. It names a
  // hundred things our groups do not, and mod titles are full of those words.
  // Opt-in: measured at 0.7 points below leaving these mods unplaced, because
  // mods the corpus cannot place tend to sit at the end of real orders anyway.
  // Re-measured after the patterns themselves were repaired, so the figure is
  // now a judgement about the vocabulary rather than about a broken table.
  if (!group && process.env.VOLO_DIVIDER_VOCAB) {
    const guess = dividerGuess(name);
    if (guess) {
      group = guess.group;
      dividerFromName = guess.num;
      confidence = 'divider-vocabulary';
      stats.fromDivider = (stats.fromDivider ?? 0) + 1;
    }
  }
  if (!group) { group = 'unsorted'; confidence = 'none'; stats.unsorted++; }

  const plugin = { name, uuid: r.uuid, group };
  if (alternateNames.length) plugin.alternateNames = alternateNames;
  if (r.folder && r.folder !== name) plugin.folder = r.folder;
  if (r.author) plugin.author = r.author;
  if (r.version) plugin.version = r.version;
  if (r.dependencies.size) {
    plugin.dependencies = [...r.dependencies].map(([uuid, n]) => ({ uuid, name: n }));
  }
  if (r.featureFlags.size) plugin.featureFlags = [...r.featureFlags];
  if (r.lastGameBuild) plugin.lastSeenGameBuild = r.lastGameBuild;
  // The divider this mod was most often filed under by the people who use
  // them. Finer than a group: it distinguishes a Warlock subclass from a
  // Wizard one, and a library from the patcher that has to follow it.
  //
  // Where nobody has filed the mod, the name pattern names a divider itself,
  // which is the difference between placing a feat mod at 045 Skillset Feats
  // and dumping it on the 056 Classes category marker.
  //
  // Failing both, the group still names the slot it opens at, so every
  // categorised mod lands on the skeleton rather than at the end of the order.
  // A curated slot outranks observation. It is the one tier where somebody has
  // stated the constraint, and the corpus filing Compatibility Framework as a
  // library is exactly the case it exists to overrule.
  if (dividerFromCurated !== null) {
    plugin.divider = dividerFromCurated;
  } else if (r.dividers.size) {
    plugin.divider = [...r.dividers.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0];
  } else if (dividerFromName !== null) {
    plugin.divider = dividerFromName;
  } else if (GROUP_DIVIDER.has(group)) {
    plugin.divider = GROUP_DIVIDER.get(group);
  }

  // Curated warnings ride with the mod so the sorter can show them without
  // needing the rules file at runtime.
  const notes = curated.messages.filter(m => m.re.test(name));
  if (notes.length) {
    plugin.messages = notes.map(m => ({ text: m.text, severity: m.severity ?? 'info' }));
  }
  plugin.evidence = {
    source: confidence,
    installs: r.seenIn.size,
    workingInstalls: r.seenInWorking.size,
    // Orders the submitter reported as broken that contain this mod. Together
    // with workingInstalls of zero this is the "never verified anywhere"
    // caution signal, the one thing the broken orders measurably taught us.
    // Counted per order rather than per entry, because the caution asks how
    // many people saw it go wrong, not how many lines it occupied.
    brokenInstalls: r.seenInBroken.size,
    // How much of the above is VOLO's own output coming back. Presence still
    // counts, since the mods were really installed and really played, but a
    // reader deserves to know when the support is partly a reflection.
    voloSortedInstalls: r.seenInVoloSorted.size,
  };
  plugins.push(plugin);
}

/** Sequence edges, held until the corpus witness data exists to arbitrate them. */
const sequenceEdges = [];

/*
 * Orderings an author published for their own mods.
 *
 * Turned into edges between consecutive members the masterlist knows. Only
 * consecutive: the sort is a topological one, so A before B and B before C
 * already gives A before C, and stating every pair would multiply the edges and
 * the ways they can contradict something without adding a constraint.
 *
 * An unknown name is skipped rather than dropped silently at the end. Four of
 * the fifteen mods in the first sequence are not in the corpus at all, and a
 * sequence quietly enforcing two thirds of itself is worse than one that says
 * which parts it could not reach.
 */
{
  const byNormName = new Map();
  for (const p of plugins) {
    const k = externalKey(p.name);
    if (k && !byNormName.has(k)) byNormName.set(k, p);
    for (const alt of p.alternateNames ?? []) {
      const a = externalKey(alt);
      if (a && !byNormName.has(a)) byNormName.set(a, p);
    }
  }

  const unreachable = [];
  for (const seq of curated.sequences ?? []) {
    let previous = null;
    for (const name of seq.order) {
      const row = byNormName.get(externalKey(name));
      if (!row) { unreachable.push(name); continue; }
      if (previous) sequenceEdges.push({ row, before: previous, why: seq.why });
      previous = row;
    }
  }
  if (unreachable.length) {
    console.log(
      `curated sequences: ${unreachable.length} named mod(s) the corpus has never seen: `
      + unreachable.join(', '),
    );
  }
}

/*
 * One author, one spelling.
 *
 * Exports disagree about capitalisation and spacing, so the same person arrives
 * as HyperspaceTowel and Hyperspace Towel, kylin3 and Kylin3. Every row keeps
 * whichever spelling its best observation happened to carry, so one author
 * appears twice wherever authors are listed or counted, and the author-catalogue
 * tier sees two smaller catalogues instead of one.
 *
 * The most frequent spelling wins, which is the same rule the mod name itself
 * uses. Folding for comparison only: what gets published is a spelling some
 * submitter actually wrote, never a lower-cased invention, because this is a
 * real person's name and the project does not restyle those.
 */
{
  const foldAuthor = a => String(a).toLowerCase().replace(/\s+/g, '');
  const spellings = new Map();
  for (const p of plugins) {
    if (!p.author) continue;
    const key = foldAuthor(p.author);
    if (!spellings.has(key)) spellings.set(key, new Map());
    const seen = spellings.get(key);
    seen.set(p.author, (seen.get(p.author) ?? 0) + 1);
  }
  let unified = 0;
  const canonical = new Map();
  for (const [key, seen] of spellings) {
    if (seen.size < 2) continue;
    canonical.set(key, [...seen.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0]);
  }
  for (const p of plugins) {
    if (!p.author) continue;
    const pick = canonical.get(foldAuthor(p.author));
    if (pick && pick !== p.author) { p.author = pick; unified++; }
  }
  if (unified) console.log(`author spellings: ${unified} row(s) moved onto ${canonical.size} canonical name(s)`);
}

/**
 * Neighbour inference for mods nothing else reached.
 *
 * A mod's position in a submitted order is evidence of its category: the mods
 * around it were mostly filed under something, and submitters keep like near
 * like. Each labelled neighbour within six places votes for its own group,
 * weighted by closeness. Only mods labelled by a human signal or a name pattern
 * vote; inferred labels never do, so a wrong inference cannot campaign for
 * more of itself.
 *
 * Validated by replaying each submission as if new and checking predictions
 * against labels the predictor could not see: 89.9 percent right overall, and
 * accuracy rises monotonically with the agreement score, which is what makes
 * that score worth storing as a confidence value. Placements below 0.7
 * agreement or with fewer than three voters stay unsorted; at that level the
 * measured accuracy approaches a coin flip.
 */
const K_NEIGHBOURS = 6;
const MIN_AGREEMENT = 0.7;
const MIN_VOTERS = 3;

/**
 * Neighbour voting reads position directly, so orders VOLO sorted are left out
 * entirely rather than allowed to vote for the placements VOLO already chose.
 */
const uuidSequences = orders
  .filter(o => o.positional)
  .map(o =>
    o.entries
      .filter(e => e?.Name && !SEPARATOR_RE.test(e.Name) && dividerNameOf(e) === null)
      .map(e => canonicalKey(keyOf(e))),
  );
// The voter pool the doc comment above promises: human signals and name
// patterns only. Listing categories and author priors are guesses of their
// own, and a guess must not campaign for more of itself any more than an
// inference may.
const VOTER_SOURCES = new Set(['curated', 'section', 'section-majority', 'name-pattern']);
const voterGroup = new Map(
  plugins.filter(p => p.group !== 'unsorted' && VOTER_SOURCES.has(p.evidence.source))
    .map(p => [p.uuid, p.group]),
);

for (const p of plugins) {
  if (p.group !== 'unsorted') continue;
  const votes = new Map();
  let total = 0;
  let voters = 0;
  for (const seq of uuidSequences) {
    const i = seq.indexOf(p.uuid);
    if (i === -1) continue;
    for (let d = 1; d <= K_NEIGHBOURS; d++) {
      for (const j of [i - d, i + d]) {
        if (j < 0 || j >= seq.length) continue;
        const g = voterGroup.get(seq[j]);
        if (!g) continue;
        votes.set(g, (votes.get(g) || 0) + 1 / d);
        total += 1 / d;
        voters++;
      }
    }
  }
  if (!total || voters < MIN_VOTERS) continue;
  const [best, weight] = [...votes.entries()].sort((a, b) => b[1] - a[1])[0];
  const agreement = weight / total;
  if (agreement < MIN_AGREEMENT) continue;

  p.group = best;
  // Inference runs after the slot has been chosen, so a mod placed here would
  // otherwise keep a group and no position on the skeleton.
  if (p.divider === undefined && GROUP_DIVIDER.has(best)) p.divider = GROUP_DIVIDER.get(best);
  p.evidence.source = 'inferred';
  p.evidence.confidence = Math.round(agreement * 100) / 100;
  stats.unsorted--;
  if (agreement >= 0.85) stats.inferredHigh++; else stats.inferredLow++;
}

/**
 * Which mods this project is willing to say a Nexus listing belongs to.
 *
 * The crawler keeps fuzzy matches as well as exact ones, and it is right to: a
 * near-miss is a reasonable guess at what a mod is. It is not a statement about
 * which mod this is, and the two consumers of the file disagreed about that.
 * The requirement promotion below already took only exact matches, with a
 * comment saying a fuzzy match is fine for a category and not for a constraint.
 * The Script Extender block took every match, so 25 mods were told a listing
 * was theirs on a name similarity of 0.9 or better and nothing else. Two of
 * those were provably the wrong mod, "5.5e Spells" reading the requirements of
 * "5e Spells" by a different author, and nine more matched a sibling or an
 * older version. One rule now, and this is it.
 *
 * Keys that no longer name a plugin are dropped here too. The file is keyed by
 * masterlist uuid and reconciling identities retired some of those, so a stale
 * key would otherwise carry a listing's requirements to nobody.
 */
const nexusMatches = (() => {
  const live = [];
  try {
    const raw = JSON.parse(fs.readFileSync(path.join('nexus', 'enrichment.json'), 'utf8'));
    const known = new Set(plugins.map(p => p.uuid));
    let retired = 0;
    for (const [uuid, e] of Object.entries(raw)) {
      if (e.matchKind !== 'exact') continue;
      if (!known.has(uuid)) { retired++; continue; }
      live.push([uuid, e]);
    }
    /*
     * The enrichment file is keyed by uuid and written by a nightly crawl, so a
     * mod whose identity this mine retires keeps its old key until the crawl
     * next runs. Dropping those is right: the alternative is attaching one mod's
     * Nexus listing to another. But it fails quietly, and a mod losing its
     * listing looks exactly like a mod that never had one, so the count is
     * reported. Zero is the expected reading, and a number that stays high
     * across several runs means the crawl has stopped keeping up.
     */
    if (retired) {
      console.log(`nexus enrichment: ${retired} key(s) name identities this mine retired, dropped`);
    }
  } catch {
    return [];
  }
  return live;
})();

/**
 * Script Extender awareness. BG3SE is a dll, not a pak, so it can never appear
 * in a load order; the only way to warn "this order needs the Script Extender
 * installed" is to know which mods rely on it. Two signals, both already on
 * disk: ScriptExtenderData blocks inside pak metadata, and off-site
 * requirement entries naming the extender in the Nexus catalogue.
 */
{
  const SE_RE = /script.?extender|bg3se/i;
  const catalogPath = path.join('nexus', 'catalog.json');
  let externalSe = new Set();
  if (fs.existsSync(catalogPath)) {
    const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
    for (const [uuid, e] of nexusMatches) {
      const req = catalog.mods?.[e.nexusId]?.req ?? [];
      if (req.some(r => r.external && SE_RE.test(r.name ?? ''))) externalSe.add(uuid);
    }
  }
  let seCount = 0;
  for (const p of plugins) {
    if ((p.featureFlags && p.featureFlags.length) || externalSe.has(p.uuid)) {
      p.usesScriptExtender = true;
      seCount++;
    }
  }
  console.log(`script extender: ${seCount} mods marked as relying on it`);
}

/**
 * Where each mod sits in every order somebody has played on.
 *
 * The arbiter for both kinds of dependency edge below, so it is built once,
 * from whatever orders this run is building from. A held-out evaluation
 * therefore cannot leak the answer into its own training data.
 */
const workingOrders = orders.filter(o => o.label === 'working');

const workingPositions = workingOrders.map(o => {
  const pos = new Map();
  o.entries.forEach((e, i) => {
    if (!e.Name || SEPARATOR_RE.test(e.Name) || dividerNameOf(e) !== null) return;
    const k = canonicalKey(keyOf(e));
    if (!pos.has(k)) pos.set(k, i);
  });
  return pos;
});

/**
 * Positions from the orders allowed to speak about sequence.
 *
 * workingPositions holds every working order, which is right for asking what
 * somebody had installed and wrong for asking what order they put it in. This
 * asked the second question of the first set, so an order VOLO sorted, or the
 * fourth copy of one person's, voted on which of two mods loads first.
 */
const positionalPositions = workingPositions.filter((_, i) => workingOrders[i].positional);

/** How the corpus actually orders one mod against another. */
function orderWitness(dependent, dependency) {
  let before = 0, after = 0;
  for (const pos of positionalPositions) {
    const a = pos.get(canonicalKey(dependent));
    const b = pos.get(canonicalKey(dependency));
    if (a === undefined || b === undefined) continue;
    if (b < a) before++; else after++;
  }
  return { before, after, witnesses: before + after };
}

/**
 * Whether the corpus actively contradicts an ordering claim.
 *
 * Two witnesses is a low bar and deliberately so: this only ever removes a
 * constraint, never adds one, so being wrong costs a claim rather than imposing
 * a false one. Used for catalogue requirements and for curated sequences alike,
 * because a document is a document whoever wrote it.
 */
const corpusOverrules = (dependent, dependency) => {
  const { before, after, witnesses } = orderWitness(dependent, dependency);
  return witnesses >= 2 && after > before;
};

/*
 * A published sequence still answers to the people who played the game.
 *
 * Catalogue requirements have always been arbitrated this way: where working
 * orders consistently load two mods the other way round, the players win over
 * the requirements table. Curated sequences shipped without that guard, which
 * was an oversight rather than a decision, and the BG3 community wiki found it.
 *
 * Its general load order names six user interface mods in order. The corpus
 * disagrees on four of the ten pairs, including the best evidenced one: players
 * put Better Tooltips ahead of Dynamic Sidebar twenty times against nine. A
 * documented convention is still a document, and this one is from October 2024.
 *
 * The same guard leaves an author's own sequence almost untouched, which is the
 * result that makes it safe to apply: nine of the ten Valkrana edges are either
 * corroborated or have too few witnesses to judge, and the one it drops rests on
 * two orders against three.
 */
{
  let applied = 0, overruled = 0;
  for (const { row, before, why } of sequenceEdges) {
    if (corpusOverrules(row.uuid, before.uuid)) { overruled++; continue; }
    (row.loadAfter ??= []).push({ uuid: before.uuid, name: before.name, why });
    applied++;
  }
  console.log(
    `curated sequences: ${applied} ordering edge(s)`
    + (overruled ? `, ${overruled} overruled by the corpus` : ''),
  );
}

/**
 * Promote crawled requirement data into load-after constraints.
 *
 * Dependencies are the only hard evidence the sorter has; everything else is
 * statistical. Submitted exports declare very few, but both catalogues carry
 * author-declared requirements, so the ones that resolve to two mods we know
 * are worth having.
 *
 * Deliberately conservative, because a wrong hard edge forces a wrong order:
 *
 *   - Nexus requirement tables are free text and include optional suggestions
 *     ("Works without, but...", "(Optional) Recommended Installation Tool")
 *     and install tools. Anything whose note reads as optional is dropped.
 *   - Only exact name matches join a mod to its Nexus entry. Fuzzy matches are
 *     fine for a category guess and not fine for a constraint.
 *   - mod.io names must match exactly and unambiguously; a name shared by two
 *     mods is skipped rather than guessed.
 *   - Any edge that would close a cycle is dropped, so the sort can never be
 *     handed an impossible graph.
 */
if (process.env.VOLO_NO_EXTERNAL_DEPS) {
  console.log('external deps: skipped (VOLO_NO_EXTERNAL_DEPS set)');
} else {
  const norm = s => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const OPTIONAL = /optional|recommend|works without|not required|if you |alternative/i;

  const byUuid = new Map(plugins.map(p => [p.uuid, p]));
  const nameToUuid = new Map();
  const ambiguous = new Set();
  for (const p of plugins) {
    const key = norm(p.name);
    if (!key) continue;
    if (nameToUuid.has(key)) ambiguous.add(key);
    else nameToUuid.set(key, p.uuid);
  }
  for (const key of ambiguous) nameToUuid.delete(key);

  /** dependent uuid -> set of uuids that must load before it. */
  const proposed = new Map();
  const add = (dependent, dependency) => {
    if (!dependent || !dependency || dependent === dependency) return;
    if (!proposed.has(dependent)) proposed.set(dependent, new Set());
    proposed.get(dependent).add(dependency);
  };

  const readJson = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };
  const nexusCatalog = readJson(path.join('nexus', 'catalog.json'));
  let fromNexus = 0, skippedOptional = 0;
  if (nexusMatches.length && nexusCatalog) {
    /*
     * One listing can belong to several mods, so the edge goes to all of them.
     *
     * This kept a single uuid per listing and the last one written won, which
     * silently threw away the others: a requirement on VolitionCabinet attached
     * to the copy seen in one order while the copy seen in nineteen went
     * without. Nothing sorted differently because of it, since every affected
     * edge already agreed with the group order, but the constraint was landing
     * on the wrong side of a duplicated mod. Fanning it out costs nothing and
     * stops the outcome depending on iteration order.
     */
    const uuidsByNexusId = new Map();
    for (const [uuid, e] of nexusMatches) {
      if (!uuidsByNexusId.has(e.nexusId)) uuidsByNexusId.set(e.nexusId, []);
      uuidsByNexusId.get(e.nexusId).push(uuid);
    }
    for (const [id, mod] of Object.entries(nexusCatalog.mods)) {
      const dependents = uuidsByNexusId.get(Number(id));
      if (!dependents) continue;
      for (const req of mod.req ?? []) {
        if (req.external) continue;
        if (OPTIONAL.test(req.notes ?? '')) { skippedOptional++; continue; }
        for (const dependency of uuidsByNexusId.get(req.id) ?? []) {
          for (const dependent of dependents) {
            if (dependent === dependency) continue;
            add(dependent, dependency);
            fromNexus++;
          }
        }
      }
    }
  }

  const modioCatalog = readJson(path.join('modio', 'catalog.json'));
  let fromModio = 0;
  if (modioCatalog) {
    const modioIdToUuid = new Map();
    for (const [id, mod] of Object.entries(modioCatalog.mods)) {
      const uuid = nameToUuid.get(norm(mod.name));
      if (uuid) modioIdToUuid.set(Number(id), uuid);
    }
    for (const [id, mod] of Object.entries(modioCatalog.mods)) {
      const dependent = modioIdToUuid.get(Number(id));
      if (!dependent) continue;
      for (const dep of mod.dependsOn ?? []) {
        const dependency = modioIdToUuid.get(dep.id);
        if (dependency) { add(dependent, dependency); fromModio++; }
      }
    }
  }

  /*
   * A catalogue requirement means "install this too", which is not quite the
   * same claim as "load this first". Working orders respect these edges about
   * 85 percent of the time; the rest are cases where the requirement is real
   * but the load position is not. Where the corpus actively contradicts an
   * edge, the people who played the game win over the requirements table.
   *
   * Uses the shared witness count built above.
   */
  const corpusContradicts = corpusOverrules;

  // Existing pak-declared edges seed the graph, so a promoted edge cannot
  // contradict what a mod states about itself.
  const edges = new Map();
  const link = (dependent, dependency) => {
    if (!edges.has(dependency)) edges.set(dependency, new Set());
    edges.get(dependency).add(dependent);
  };
  for (const p of plugins) {
    for (const d of p.dependencies ?? []) if (byUuid.has(d.uuid)) link(p.uuid, d.uuid);
  }

  /** Can `from` already reach `to` following load-before edges? */
  const reaches = (from, to) => {
    const stack = [from];
    const seenNodes = new Set();
    while (stack.length) {
      const node = stack.pop();
      if (node === to) return true;
      if (seenNodes.has(node)) continue;
      seenNodes.add(node);
      for (const next of edges.get(node) ?? []) stack.push(next);
    }
    return false;
  };

  let added = 0, cycles = 0, contradicted = 0;
  // Sorted for determinism: the same corpus must always produce the same list.
  for (const dependent of [...proposed.keys()].sort()) {
    for (const dependency of [...proposed.get(dependent)].sort()) {
      const target = byUuid.get(dependent);
      const source = byUuid.get(dependency);
      if (!target || !source) continue;
      if ((target.dependencies ?? []).some(d => d.uuid === dependency)) continue;
      if (corpusContradicts(dependent, dependency)) { contradicted++; continue; }
      if (reaches(dependent, dependency)) { cycles++; continue; }
      target.dependencies = [...(target.dependencies ?? []), { uuid: dependency, name: source.name }];
      link(dependent, dependency);
      added++;
    }
  }

  externalDependencyStats = { fromNexus, fromModio, skippedOptional, added, cycles, contradicted };
  console.log(
    `external deps: ${added} load-after edges promoted ` +
    `(${fromNexus} nexus candidates, ${fromModio} modio, ` +
    `${skippedOptional} optional skipped, ${contradicted} contradicted by the corpus, ` +
    `${cycles} cycle-forming dropped)`,
  );
}

/*
 * Declared requirements that the corpus says are not load-order constraints.
 *
 * "Requires X" and "must load after X" are different claims, and a pak can
 * only make the first one. They coincide for a library, which has to be parsed
 * before whatever reads it. They come apart for a patcher, which reads the
 * mods it patches and therefore has to load last: Compatibility Framework is
 * declared as a requirement by several mods and placed after every one of them
 * by the players who actually ran the game.
 *
 * Overruling a mod's own metadata takes more evidence than overruling a
 * catalogue's requirements table, so this asks for more witnesses and a clear
 * majority rather than a bare one. Only the ordering claim is dropped. The
 * requirement stands, so a framework that is genuinely absent is still
 * reported as missing.
 */
const DECLARED_MIN_WITNESSES = 3;
const DECLARED_MIN_SHARE = 0.75;

/*
 * Evidence is pooled across everything that requires the same mod, because the
 * question is about that mod rather than about any one pair. Individual pairs
 * are too thin to answer it: Compatibility Framework is required by five mods
 * and no single pairing appears in more than two working orders, while the
 * five together appear in six and agree.
 *
 * A library scores near zero here, since it has to be parsed before anything
 * that reads it and every order will show that. Only something loaded after
 * the mods that require it can reach the threshold.
 */
const pooled = new Map();
for (const p of plugins) {
  for (const d of p.dependencies ?? []) {
    const { before, after, witnesses } = orderWitness(p.uuid, d.uuid);
    if (!witnesses) continue;
    const acc = pooled.get(d.uuid) ?? { before: 0, after: 0, name: d.name, dependents: [] };
    acc.before += before;
    acc.after += after;
    acc.dependents.push(p.name);
    pooled.set(d.uuid, acc);
  }
}

const lateLoaders = [];
for (const [uuid, acc] of pooled) {
  const witnesses = acc.before + acc.after;
  if (witnesses < DECLARED_MIN_WITNESSES) continue;
  if (acc.after / witnesses < DECLARED_MIN_SHARE) continue;
  const plugin = plugins.find(p => p.uuid === uuid);
  if (!plugin) continue;
  /*
   * The flag travels on the mod, not on each pairing, so a dependant nobody
   * has posted an order for is covered too. That is the point: the reports
   * that prompted this were from people whose exact combination the corpus
   * had never seen.
   */
  plugin.loadsAfterDependents = true;
  lateLoaders.push({ name: plugin.name, ...acc, witnesses });
}
lateLoaders.sort((a, b) => a.name.localeCompare(b.name));

/*
 * Requirements the working orders simply do not have.
 *
 * "Requires X" is a claim about installing X, and the corpus can check it the
 * same way it checks the ordering claim: find the orders holding something
 * that requires X, and see how many of them hold X. A library cannot be
 * missing from an order that works, and measured here none of them are, with
 * VolitionCabinet, CommunityLibrary, BG3MCM and the rest at nought absent
 * across every order that needs them.
 *
 * Others are absent most of the time. Some are optional in practice; some are
 * satisfied by a different mod doing the same job, which is invisible from
 * here and stated in the curated tier instead. Either way, telling somebody
 * their load order is critically missing a mod that most working orders do not
 * have is a false alarm, and it was reported as one.
 *
 * This does not silence the warning. It lowers it to what the evidence
 * supports, because a requirement nobody installs is still worth knowing about.
 */
const ABSENT_MIN_WITNESSES = 4;
const ABSENT_MIN_SHARE = 0.6;

const orderHolds = (pos, plugin) => pos.has(canonicalKey(plugin.uuid));

const oftenAbsent = [];
{
  const byUuidAll = new Map(plugins.map(p => [p.uuid, p]));
  const declaredBy = new Map();
  for (const p of plugins) {
    for (const d of p.dependencies ?? []) {
      if (!declaredBy.has(d.uuid)) declaredBy.set(d.uuid, []);
      declaredBy.get(d.uuid).push(p);
    }
  }
  for (const [uuid, dependants] of declaredBy) {
    const required = byUuidAll.get(uuid);
    if (!required) continue;
    let held = 0, absent = 0;
    for (const pos of workingPositions) {
      if (!dependants.some(d => orderHolds(pos, d))) continue;
      if (orderHolds(pos, required)) held++; else absent++;
    }
    const witnesses = held + absent;
    if (witnesses < ABSENT_MIN_WITNESSES) continue;
    if (absent / witnesses < ABSENT_MIN_SHARE) continue;
    required.oftenAbsent = true;
    oftenAbsent.push({ name: required.name, held, absent, witnesses, dependants: dependants.length });
  }
  oftenAbsent.sort((a, b) => b.absent / b.witnesses - a.absent / a.witnesses || a.name.localeCompare(b.name));
}

console.log(
  oftenAbsent.length
    ? `soft requirements: ${oftenAbsent.length} required by mods that work without them`
    : 'soft requirements: none, every declared requirement is present wherever it is needed',
);
for (const r of oftenAbsent) {
  console.log(`  ${r.name}: absent from ${r.absent} of ${r.witnesses} working orders that require it`);
}

if (lateLoaders.length) {
  console.log(
    `declared deps: ${lateLoaders.length} ` +
    `${lateLoaders.length === 1 ? 'mod loads' : 'mods load'} after what requires them`,
  );
  for (const l of lateLoaders) {
    console.log(
      `  ${l.name}: ${l.after}/${l.witnesses} placements are after its dependants ` +
      `(${l.dependents.length} declaring mods)`,
    );
  }
} else {
  console.log('declared deps: no ordering claims contradicted by the corpus');
}

/*
 * Curated requirement aliases, resolved to the mods they name.
 *
 * Checked here rather than where the file is read, because this is the first
 * point that holds a masterlist to check against. An alias naming a mod that
 * does not exist is inert: it reads as a handled case while the requirement
 * goes on matching nothing, which is the failure this whole tier is written to
 * be loud about. So it stops the build rather than shipping quietly.
 */
const requirementAliases = {};
/** Required mod uuid -> uuids of mods that stand in for it. */
const requirementSatisfiedBy = {};
{
  const byNameKey = new Map();
  const byFolderKey = new Map();
  for (const p of plugins) {
    const n = externalKey(p.name);
    if (n && !byNameKey.has(n)) byNameKey.set(n, p);
    const f = externalKey(p.folder ?? '');
    if (f && !byFolderKey.has(f)) byFolderKey.set(f, p);
  }
  const unresolved = [];
  for (const rule of curated.requirementAliases) {
    const target = byNameKey.get(externalKey(rule.mod)) ?? byFolderKey.get(externalKey(rule.mod));
    if (!target) {
      unresolved.push(`"${rule.requirement}" names "${rule.mod}", which is in no load order yet`);
      continue;
    }
    requirementAliases[externalKey(rule.requirement)] = target.uuid;
  }
  if (unresolved.length) {
    throw new Error(
      `curated requirement aliases name mods the masterlist does not have:\n  ${unresolved.join('\n  ')}`,
    );
  }
  console.log(`requirement aliases: ${Object.keys(requirementAliases).length} resolved`);

  // Same check for the stand-ins, where both sides have to exist.
  const missingSide = [];
  for (const rule of curated.requirementSatisfiedBy) {
    const required = byNameKey.get(externalKey(rule.requirement))
      ?? byFolderKey.get(externalKey(rule.requirement));
    const satisfier = byNameKey.get(externalKey(rule.satisfiedBy))
      ?? byFolderKey.get(externalKey(rule.satisfiedBy));
    if (!required) missingSide.push(`"${rule.requirement}" is in no load order yet`);
    else if (!satisfier) missingSide.push(`"${rule.satisfiedBy}" is in no load order yet`);
    else {
      const list = requirementSatisfiedBy[required.uuid] ?? [];
      if (!list.includes(satisfier.uuid)) list.push(satisfier.uuid);
      requirementSatisfiedBy[required.uuid] = list;
    }
  }
  if (missingSide.length) {
    throw new Error(
      `curated stand-ins name mods the masterlist does not have:\n  ${missingSide.join('\n  ')}`,
    );
  }
  console.log(
    `requirement stand-ins: ${Object.keys(requirementSatisfiedBy).length} requirements can be met another way`,
  );
}

/*
 * Requirements naming something nothing here can identify.
 *
 * Every "install X first" VOLO shows rests on knowing what X is. Where a name
 * resolves to no mod, no folder and no alias, the warning is a dead end and
 * nobody finds out, because the string is formatted into a message and
 * dropped. Counting them here is what turns that into work: a name appearing
 * repeatedly is either a mod worth cataloguing or an alias worth writing.
 *
 * Expected to be empty. It is reported either way, so it stays visible when it
 * stops being.
 */
const unidentifiedRequirements = (() => {
  const byNameKey = new Map();
  const byFolderKey = new Map();
  for (const p of plugins) {
    const n = externalKey(p.name);
    if (n && !byNameKey.has(n)) byNameKey.set(n, p);
    const f = externalKey(p.folder ?? '');
    if (f && !byFolderKey.has(f)) byFolderKey.set(f, p);
  }
  const byUuidKey = new Map(plugins.map(p => [p.uuid, p]));
  const counts = new Map();
  const consider = (name, uuid) => {
    if (!name) return;
    // The engine's own modules are requirements of almost everything and are
    // filtered out of load orders on purpose, so they are not blind spots.
    if (ENGINE_MASTERS.has(name)) return;
    const key = externalKey(name);
    if (!key) return;
    if ((uuid && byUuidKey.has(uuid)) || byNameKey.has(key) || byFolderKey.has(key)) return;
    if (Object.hasOwn(requirementAliases, key)) return;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  };
  for (const p of plugins) {
    for (const d of p.dependencies ?? []) consider(d.name, d.uuid);
  }
  for (const order of orders) {
    for (const e of order.entries) {
      for (const d of e.Dependencies ?? []) consider(d.Name ?? d.name, d.UUID ?? d.uuid);
    }
  }
  return [...counts]
    .map(([name, times]) => ({ name, times }))
    .sort((a, b) => b.times - a.times || a.name.localeCompare(b.name));
})();

console.log(
  unidentifiedRequirements.length
    ? `unidentified requirements: ${unidentifiedRequirements.length} names nothing here can resolve`
    : 'unidentified requirements: none, every stated requirement names a mod we know',
);
for (const r of unidentifiedRequirements.slice(0, 15)) {
  console.log(`  ${String(r.times).padStart(3)}x  ${r.name}`);
}

/*
 * How the broken orders differ from the working ones, measured on the
 * masterlist this run just built rather than the one on disk.
 *
 * Reported whatever it finds. The first signal currently separates the wrong
 * way, which is worth recording precisely because nobody would think to look
 * for it, and a script nobody runs is where that finding was living.
 */
/*
 * The orders as this run already understands them, so the breakage measurement
 * cannot disagree with the mine about what a mod is. It used to read the corpus
 * itself and answered differently on all four counts: it could not parse
 * modsettings.lsx, it identified mods by the UUID field alone, it counted
 * divider paks as mods, and it iterated string dependencies character by
 * character. Three of the six figures it published were wrong.
 */
const breakageOrders = orders.map(order => ({
  file: order.file,
  label: order.label,
  mods: order.entries
    .filter(e => e?.Name && !SEPARATOR_RE.test(e.Name) && dividerNameOf(e) === null)
    .map(e => ({
      uuid: canonicalKey(keyOf(e)),
      name: e.Name,
      deps: depsOf(e)
        .filter(d => d?.Name && !ENGINE_MASTERS.has(d.Name))
        .map(d => ({ uuid: d.UUID ? canonicalKey(d.UUID) : '', name: d.Name })),
    })),
}));
const breakage = measureBreakage(plugins, breakageOrders);
console.log(
  `breakage: convention violations broken ${(100 * breakage.separation.violationRate.broken).toFixed(1)}% ` +
  `vs working ${(100 * breakage.separation.violationRate.working).toFixed(1)}%, ` +
  `unvetted mods ${(100 * breakage.separation.unvettedShare.broken).toFixed(0)}% ` +
  `vs ${(100 * breakage.separation.unvettedShare.working).toFixed(0)}% ` +
  `(${breakage.separation.counts.broken} broken orders)`,
);

plugins.sort((a, b) =>
  b.evidence.installs - a.evidence.installs || a.name.localeCompare(b.name));

/** Every distinct base-game build the corpus was built against, newest first. */
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
  /*
   * Pairs that must not be installed together. Hand-written, never mined: the
   * corpus can show that two mods co-occurred in an order that broke, which is
   * not the same as them conflicting, and publishing "A conflicts with B" about
   * someone's work on that basis would be a false claim about a real person.
   */
  incompatible: curated.incompatible,
  /*
   * Names a requirement can use for a mod that none of the mod's own strings
   * match, so the sorter can tell that a requirement is already satisfied by
   * something in the list. Keyed by the same lowercased alphanumeric form every
   * other name lookup uses.
   */
  requirementAliases,
  /*
   * A requirement one of these mods satisfies instead. Different mods doing
   * the same job, which no metadata records, so it is stated by hand.
   */
  requirementSatisfiedBy,
  provenance: {
    ordersAnalysed: orders.length,
    working: orders.filter(o => o.label === 'working').length,
    broken: orders.filter(o => o.label === 'broken').length,
    unlabelled: orders.filter(o => o.label === 'unlabelled').length,
    externalDependencyEdges: externalDependencyStats.added,
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
| load-after edges promoted from catalogues | ${externalDependencyStats.added} |
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
| Nexus or mod.io listing category | ${stats.fromExternal ?? 0} | medium, the author's own words about what the mod is |
| Author's other catalogued mods | ${stats.fromAuthor ?? 0} | medium, a specialist author's habit; needs three catalogued mods with eighty percent in one group |
| Neighbour inference, 0.85 agreement or better | ${stats.inferredHigh} | high, measured 97 percent accurate at this band |
| Neighbour inference, 0.70 to 0.85 | ${stats.inferredLow} | medium, roughly 75 percent accurate, carries a confidence score |
| Uncategorised | ${stats.unsorted} | none, needs community input |

Inferred placements come from where a mod sits in submitted orders: labelled
neighbours within six places vote for their group, weighted by closeness.
Inferred labels never vote for other mods, so an error cannot spread. Each
inferred entry stores its agreement score as \`evidence.confidence\`.

## Group distribution

${GROUPS.map(g => `- \`${g.name}\`: ${byGroup.get(g.name) || 0}`).join('\n')}

## What the broken orders do differently

Three candidate signals, each measured against the working orders as a control,
because a signal firing equally on both explains nothing. The point of putting
it here is that a negative result is worth as much as a positive one and is far
easier to lose.

| Signal | Broken orders | Working orders | Separates? |
|---|---|---|---|
| Category pairs against the working consensus | ${(100 * breakage.separation.violationRate.broken).toFixed(1)}% | ${(100 * breakage.separation.violationRate.working).toFixed(1)}% | ${breakage.separation.violationRate.broken > breakage.separation.violationRate.working ? 'yes' : 'no, and it points the other way'} |
| Mods in no working order anywhere | ${(100 * breakage.separation.unvettedShare.broken).toFixed(0)}% | ${(100 * breakage.separation.unvettedShare.working).toFixed(0)}% | ${breakage.separation.unvettedShare.broken > breakage.separation.unvettedShare.working ? 'yes' : 'no'} |
| Declared dependencies not installed | ${breakage.separation.missingDeps.broken.toFixed(1)} | ${breakage.separation.missingDeps.working.toFixed(1)} | ${breakage.separation.missingDeps.broken > breakage.separation.missingDeps.working ? 'yes' : 'no'} |

Measured over ${breakage.separation.counts.broken} broken and ${breakage.separation.counts.working} working orders, against ${breakage.conventions} category conventions, each held by at least 75 percent of at least 500 observed pairs.

Read the broken column with that first count in mind. A handful of orders
cannot say what breaks a game, and the ordering signal still runs backwards,
which is the strongest argument there is against guessing at a cause from
sequence alone. It runs backwards by less than it used to appear to: this
measurement could not read modsettings.lsx, identified mods by the UUID field
alone and counted dividers as mods, which made the gap look three times wider
than it is.

The third row separates on a difference of a tenth of a requirement per order,
which is not a finding. It reads at all only because the requirements stated in
a TSV are no longer discarded, and it is recorded rather than believed.

Only the middle row feeds anything today. A mod seen in a broken order and in
no working one is reported to the user as a place to start looking, worded as
exactly that rather than as a fault.

## Requirements the corpus overrules

A mod here is loaded after the mods that require it, so requirements naming it
stop being ordering constraints. Right for a patcher, which reads the mods it
patches; wrong for a library, which has to be parsed first. Decided from the
working orders alone, with the evidence pooled across everything that requires
the same mod.

Listed because the decision is otherwise invisible. Dropping a real ordering
constraint would be silent, and this file is regenerated and committed on every
mine, so a change to this list shows up in a diff where somebody sees it.

${lateLoaders.length
  ? ['| Mod | Loaded after its dependants | Mods declaring it |', '|---|---|---|',
     ...lateLoaders.map(l => `| \`${l.name}\` | ${l.after} of ${l.witnesses} placements | ${l.dependents.length} |`)].join('\n')
  : '_none: every declared requirement also holds as a load order_'}

## Requirements the working orders do without

A mod here is declared as a requirement by mods that demonstrably run without
it. Its absence is reported as a warning rather than as a broken load order.
A real library scores nothing in the last column: measured across this corpus,
VolitionCabinet, CommunityLibrary, BG3MCM, BG3AF, BG3SX and Compatibility
Framework are present in every working order that needs them.

${oftenAbsent.length
  ? ['| Requirement | Working orders needing it | Without it | Declaring mods |', '|---|---|---|---|',
     ...oftenAbsent.map(r => `| \`${r.name}\` | ${r.witnesses} | ${r.absent} | ${r.dependants} |`)].join('\n')
  : '_none: every declared requirement is installed wherever it is needed_'}

## Requirements naming something unknown

Every "install X first" rests on knowing what X is. A name that matches no mod,
no folder and no curated alias makes a warning nobody can act on, and the string
would otherwise be formatted into a message and dropped without being counted.

${unidentifiedRequirements.length
  ? unidentifiedRequirements.map(r => `- \`${r.name}\` (${r.times} references)`).join('\n')
  : '_none: every stated requirement names a mod this masterlist knows_'}

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
console.log(`grouped:   ${stats.fromSection} by section header, ${stats.fromName} by name pattern, ${stats.fromExternal ?? 0} by Nexus or mod.io category, ${stats.fromAuthor ?? 0} by author's other mods`);
console.log(`inferred:  ${stats.inferredHigh + stats.inferredLow} from position in submitted orders (${stats.inferredHigh} high confidence), ${stats.unsorted} still unsorted`);
console.log(`skeleton:  ${plugins.filter(p => p.divider !== undefined).length} of ${plugins.length} mods placed on a divider slot`);
console.log(`hard deps: ${withDeps.length} mods with declared dependencies`);
console.log(`game:      ${masterlist.gamePatch ?? 'unknown'} (build ${masterlist.gameBuild ?? 'unknown'}), ${builds.length} builds seen`);
/**
 * A few numbers small enough to bundle.
 *
 * The pages quote the size of the masterlist, and the masterlist itself is
 * megabytes fetched after the page loads, so those figures could only appear
 * once the download finished. Writing them out separately lets the text render
 * with the real numbers immediately, which matters most for the prerendered
 * HTML, where "thousands of mods" would otherwise be what a reader and a
 * search engine got.
 *
 * Only a full run may write it. Held-out evaluation rebuilds the masterlist
 * once per fold with --exclude and --out, and an unconditional write here let
 * the last fold's shrunken figures ship to every page, which is exactly what
 * happened once.
 */
const foldRun = EXCLUDE !== null || OUT_DIR !== 'masterlist';
if (!foldRun) {
  fs.writeFileSync(
    path.join('client', 'src', 'lib', 'masterlist-summary.json'),
    `${JSON.stringify({
      mods: plugins.length,
      placed: plugins.filter(p => p.divider !== undefined).length,
      uncategorised: plugins.filter(p => (p.evidence?.source ?? 'none') === 'none').length,
      gamePatch: masterlist.gamePatch ?? null,
      workingOrders: masterlist.provenance.working,
      orders: masterlist.provenance.ordersAnalysed,
      /*
       * Null until the catalogues are next rebuilt, which is why the pages
       * treat it as optional rather than assuming a number is there.
       */
      catalogue: EXTERNAL?.catalogue ?? null,
    }, null, 2)}\n`,
  );
}

console.log(`\nwrote ${OUT_DIR}/bg3-masterlist.json`);
console.log(foldRun
  ? 'masterlist-summary.json untouched: fold run'
  : 'wrote client/src/lib/masterlist-summary.json');
console.log(`wrote ${OUT_DIR}/coverage-report.md`);
