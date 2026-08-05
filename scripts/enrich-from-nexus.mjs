#!/usr/bin/env node
/**
 * Joins the Nexus catalogue against the masterlist and reports what it can add.
 *
 *   node scripts/enrich-from-nexus.mjs
 *
 * Reads:  nexus/catalog.json, masterlist/bg3-masterlist.json
 * Writes: nexus/enrichment.json  (uuid keyed, ready for the miner to consume)
 *         nexus/enrichment-report.md
 *
 * The join problem: the masterlist keys mods by BG3 UUID, which lives inside
 * the pak and is unknown to Nexus. Nexus keys by mod ID. The only bridge is the
 * name, so every match carries a confidence: exact on a normalised name is
 * high, fuzzy similarity is scored, and anything below threshold is left
 * unmatched rather than guessed.
 *
 * Nothing here writes to the masterlist. The output is a proposal file plus a
 * human-readable report; wiring it into the miner as an evidence tier is a
 * separate, reviewable step.
 */

import fs from 'fs';
import path from 'path';

const CATALOG = path.join('nexus', 'catalog.json');
const MASTERLIST = path.join('masterlist', 'bg3-masterlist.json');

if (!fs.existsSync(CATALOG)) {
  console.error('No nexus/catalog.json yet. Run scripts/bulk-list-nexus.mjs first.');
  process.exit(2);
}

const catalog = JSON.parse(fs.readFileSync(CATALOG, 'utf8'));
const masterlist = JSON.parse(fs.readFileSync(MASTERLIST, 'utf8'));

/** Nexus category names to the masterlist vocabulary. */
const CATEGORY_MAP = {
  'Armour': 'Armor',
  'Armour and Clothing': 'Armor',
  'Audio': 'Audio',
  'Animations': 'Animations',
  'Bugfixes': 'Bug Fixes',
  'Bug Fixes': 'Bug Fixes',
  'Characters': 'NPC',
  'Character Customisation': 'Character Customization',
  'Character Customization': 'Character Customization',
  'Cheats and God Items': 'Gameplay',
  'Classes': 'Classes',
  'Clothing': 'Clothing',
  'Companions': 'Companions',
  'Crafting': 'Gameplay',
  'Dice': 'Dice',
  'Environment': 'Environment',
  'Gameplay': 'Gameplay',
  'Items': 'Equipment',
  'Libraries': 'Resources',
  'Magic - Spells and Enchantments': 'Spells',
  'Miscellaneous': null,
  'Modders Resources': 'Resources',
  'Models and Textures': 'Visuals',
  'NPCs': 'NPC',
  'Patches': 'Bug Fixes',
  'Quests': 'Quests',
  'Races': 'Races',
  'User Interface': 'User Interface',
  'Utilities': 'Utilities',
  'Visuals and Graphics': 'Visuals',
  'Weapons': 'Weapons',
};

const norm = s => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** Dice coefficient on character bigrams; cheap and adequate for mod names. */
function similarity(a, b) {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const grams = new Map();
  for (let i = 0; i < a.length - 1; i++) {
    const g = a.slice(i, i + 2);
    grams.set(g, (grams.get(g) || 0) + 1);
  }
  let hits = 0;
  for (let i = 0; i < b.length - 1; i++) {
    const g = b.slice(i, i + 2);
    const n = grams.get(g) || 0;
    if (n > 0) { grams.set(g, n - 1); hits++; }
  }
  return (2 * hits) / (a.length + b.length - 2);
}

// Index the catalogue by normalised name. Collisions keep the more popular mod,
// since that is the likelier referent of an ambiguous name.
const byNorm = new Map();
for (const [id, m] of Object.entries(catalog.mods)) {
  if (!m.name || m.status !== 'published') continue;
  const key = norm(m.name);
  if (!key) continue;
  const existing = byNorm.get(key);
  if (!existing || (m.endorsements ?? 0) > (existing.mod.endorsements ?? 0)) {
    byNorm.set(key, { id: Number(id), mod: m });
  }
}
const catalogEntries = [...byNorm.entries()].map(([key, v]) => ({ key, ...v }));

const FUZZY_THRESHOLD = 0.9;

const enrichment = {};
let exact = 0, fuzzy = 0, unmatched = 0;
const fills = [];
const disagreements = [];

for (const plugin of masterlist.plugins) {
  const key = norm(plugin.name);
  if (!key) { unmatched++; continue; }

  let match = byNorm.get(key) ? { ...byNorm.get(key), confidence: 1, kind: 'exact' } : null;

  if (!match) {
    let best = null, bestScore = 0;
    for (const entry of catalogEntries) {
      if (Math.abs(entry.key.length - key.length) > key.length * 0.4) continue;
      const score = similarity(key, entry.key);
      if (score > bestScore) { bestScore = score; best = entry; }
    }
    if (best && bestScore >= FUZZY_THRESHOLD) {
      match = { ...best, confidence: Math.round(bestScore * 100) / 100, kind: 'fuzzy' };
    }
  }

  if (!match) { unmatched++; continue; }
  if (match.kind === 'exact') exact++; else fuzzy++;

  const suggestedGroup = CATEGORY_MAP[match.mod.category] ?? null;
  enrichment[plugin.uuid] = {
    nexusId: match.id,
    nexusName: match.mod.name,
    matchKind: match.kind,
    matchConfidence: match.confidence,
    nexusCategory: match.mod.category,
    suggestedGroup,
    adult: match.mod.adult,
    endorsements: match.mod.endorsements,
  };

  if (suggestedGroup && plugin.group === 'unsorted') {
    fills.push({ name: plugin.name, group: suggestedGroup, kind: match.kind });
  }
  if (
    suggestedGroup &&
    plugin.group !== 'unsorted' &&
    plugin.group !== suggestedGroup &&
    plugin.evidence?.source !== 'curated'
  ) {
    disagreements.push({
      name: plugin.name, ours: plugin.group, nexus: suggestedGroup,
      source: plugin.evidence?.source,
    });
  }
}

// Requirements harvested from the GraphQL side become load-after proposals.
// An edge is only proposed when the requiring mod matched the masterlist; the
// required side resolves to a uuid when it also matched, and otherwise stays a
// name so the report can show what a fuller catalogue would resolve.
const uuidByNexusId = new Map(
  Object.entries(enrichment).map(([uuid, e]) => [e.nexusId, uuid]),
);
let depEdges = 0, depResolved = 0;
for (const [uuid, e] of Object.entries(enrichment)) {
  const req = catalog.mods[e.nexusId]?.req;
  if (!Array.isArray(req) || !req.length) continue;
  const proposals = [];
  for (const r of req) {
    if (r.external || !r.id) continue;
    const targetUuid = uuidByNexusId.get(r.id) ?? null;
    const p = { name: r.name, nexusId: r.id };
    if (targetUuid) { p.uuid = targetUuid; depResolved++; }
    if (r.notes) p.notes = r.notes;
    proposals.push(p);
    depEdges++;
  }
  if (proposals.length) e.requires = proposals;
}

fs.writeFileSync(path.join('nexus', 'enrichment.json'), JSON.stringify(enrichment, null, 1) + '\n');

const unmappedCategories = [...new Set(
  Object.values(catalog.mods)
    .filter(m => m.name && m.status === 'published')
    .map(m => m.category)
    .filter(c => c && !(c in CATEGORY_MAP)),
)];

const report = `# Nexus enrichment report

Catalogue scanned through id ${catalog.provenance?.scannedThrough ?? '?'} of ${catalog.provenance?.newestKnownId ?? '?'}${catalog.provenance?.complete ? ' (complete)' : ' (crawl still in progress)'}.

## Join results

| | |
|---|---|
| Masterlist mods | ${masterlist.plugins.length} |
| Matched exactly by name | ${exact} |
| Matched fuzzily (>= ${FUZZY_THRESHOLD}) | ${fuzzy} |
| Unmatched | ${unmatched} |

## What the match would add

- ${fills.length} currently unsorted mods would receive a category from their
  Nexus listing.
- ${disagreements.length} mods have a Nexus category that disagrees with the
  masterlist group. Disagreement is information, not an instruction; each needs
  a look before anything changes.
- ${depEdges} dependency edges from author-maintained Requirements tables land
  on matched masterlist mods, ${depResolved} of them resolved to a uuid on both
  ends and usable as load-after constraints today.

### Sample category fills

${fills.slice(0, 20).map(f => `- ${f.name}: ${f.group} (${f.kind} match)`).join('\n') || '_none_'}

### Sample disagreements

${disagreements.slice(0, 15).map(d => `- ${d.name}: ours ${d.ours} (${d.source}), Nexus says ${d.nexus}`).join('\n') || '_none_'}

## Unmapped Nexus categories

These appear in the catalogue but have no entry in CATEGORY_MAP yet:

${unmappedCategories.map(c => `- ${c}`).join('\n') || '_none_'}
`;

fs.writeFileSync(path.join('nexus', 'enrichment-report.md'), report);

console.log(`matched: ${exact} exact, ${fuzzy} fuzzy, ${unmatched} unmatched of ${masterlist.plugins.length}`);
console.log(`category fills available for unsorted mods: ${fills.length}`);
console.log(`disagreements needing review: ${disagreements.length}`);
console.log('wrote nexus/enrichment.json and nexus/enrichment-report.md');
