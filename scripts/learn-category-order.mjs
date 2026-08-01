#!/usr/bin/env node
/**
 * Learns the category order from load orders known to work.
 *
 * Earlier attempt derived the order from where section headers sat, which failed
 * because categories are not contiguous blocks: people write Classes, then
 * Equipment, then Classes again, so a category has no single position.
 *
 * This does not care about contiguity. Every mod carries the category of the
 * header above it, and every pair of mods in a working order is one observation
 * of "a category A mod came before a category B mod". A single order with 400
 * mods yields around 80,000 observations instead of 18.
 *
 *   node scripts/learn-category-order.mjs
 */

import fs from 'fs';
import path from 'path';

const CORPUS = 'Load Orders - Public Submitted';
const SEPARATOR_RE = /[-=_~]{4,}|^\s*[\]>]\s*\S|^\s*\|.*\|\s*$/;

const SYNONYMS = {
  'top of load order': 'Top of Load Order', 'bottom of load order': 'Bottom of Load Order',
  'loaders': 'Utilities', 'utilities': 'Utilities', 'utility': 'Utilities', 'developer': 'Utilities',
  'resources': 'Resources', 'libraries': 'Resources', 'library': 'Resources',
  'frameworks': 'Resources', 'framework': 'Resources',
  'user interface': 'User Interface', 'ui': 'User Interface', 'interface': 'User Interface', 'hud': 'User Interface',
  'gameplay': 'Gameplay', 'tweaks': 'Gameplay', 'combat': 'Gameplay', 'cheats': 'Gameplay',
  'mechanics': 'Gameplay', 'quality of life': 'Gameplay', 'qol': 'Gameplay', 'balance': 'Gameplay',
  'classes': 'Classes', 'class': 'Classes', 'subclasses': 'Classes', 'subclass': 'Classes',
  'feats': 'Classes', 'deities': 'Classes', 'religion': 'Classes', 'backgrounds': 'Classes',
  'sorcerer': 'Classes', 'druid': 'Classes', 'wizard': 'Classes', 'cleric': 'Classes',
  'warlock': 'Classes', 'fighter': 'Classes', 'rogue': 'Classes', 'bard': 'Classes',
  'paladin': 'Classes', 'ranger': 'Classes', 'monk': 'Classes', 'barbarian': 'Classes',
  'races': 'Races', 'race': 'Races', 'subraces': 'Races',
  'spells': 'Spells', 'spell': 'Spells', 'magic': 'Spells', 'cantrips': 'Spells',
  'equipment': 'Equipment', 'gear': 'Equipment', 'items': 'Equipment',
  'consumables': 'Equipment', 'containers': 'Equipment',
  'armor': 'Armor', 'armour': 'Armor',
  'weapons': 'Weapons', 'weapon': 'Weapons',
  'accessories': 'Accessories', 'accesories': 'Accessories', 'jewelry': 'Accessories',
  'jewellery': 'Accessories', 'cloaks': 'Accessories',
  'clothing': 'Clothing', 'clothes': 'Clothing', 'outfits': 'Clothing', 'camp': 'Clothing',
  'camp clothes': 'Clothing',
  'dyes': 'Dyes', 'dye': 'Dyes',
  'character customization': 'Character Customization', 'character creator': 'Character Customization',
  'character creation': 'Character Customization', 'cc': 'Character Customization',
  'presets': 'Character Customization', 'cosmetics': 'Character Customization',
  'makeup': 'Character Customization', 'tattoos': 'Character Customization',
  'cosmetic colors': 'Character Customization',
  'bodies': 'Bodies', 'body': 'Bodies',
  'heads': 'Heads', 'head': 'Heads', 'faces': 'Heads', 'eyes': 'Heads',
  'hair': 'Hair', 'hairstyles': 'Hair', 'beards': 'Hair',
  'companions': 'Companions', 'companion edits': 'Companions', 'origins': 'Companions',
  'npc': 'NPC', 'npcs': 'NPC', 'characters': 'NPC',
  'quests': 'Quests', 'quest': 'Quests',
  'environment': 'Environment', 'lighting': 'Environment',
  'animations': 'Animations', 'animation': 'Animations',
  'visuals': 'Visuals', 'vfx': 'Visuals', 'textures': 'Visuals', 'skins': 'Visuals',
  'dice': 'Dice', 'dices': 'Dice',
  'audio': 'Audio', 'sound': 'Audio', 'music': 'Audio',
  'miscellaneous': 'Miscellaneous', 'misc': 'Miscellaneous', 'other': 'Miscellaneous',
  'custom': 'Miscellaneous',
  'bug fixes': 'Bug Fixes', 'bugfixes': 'Bug Fixes', 'fixes': 'Bug Fixes', 'fix': 'Bug Fixes',
  'patches': 'Bug Fixes', 'patch': 'Bug Fixes', 'compatibility': 'Bug Fixes',
  'compatibility patches': 'Bug Fixes',
};

function canonical(name) {
  const piped = name.match(/\|([^|]{2,60})\|/);
  const bracketed = name.match(/\]\s*([^[\]]{2,60})\s*\[/);
  const raw = piped ? piped[1] : bracketed ? bracketed[1]
    : name.replace(/[-=_~*#>\][|]{1,}/g, ' ').replace(/\s+/g, ' ').trim();
  return SYNONYMS[raw.toLowerCase().replace(/[^a-z ]/g, '').trim()] ?? null;
}

function readOrder(f) {
  const raw = fs.readFileSync(path.join(CORPUS, f), 'utf8');
  if (f.endsWith('.tsv')) {
    const lines = raw.split(/\r?\n/).filter(Boolean);
    const hdr = lines[0].split('\t').map(h => h.trim());
    return lines.slice(1).map(l => { const c = l.split('\t'); return Object.fromEntries(hdr.map((h, i) => [h, c[i]])); });
  }
  let j; try { j = JSON.parse(raw); } catch { return null; }
  return Array.isArray(j.Order) ? j.Order : Array.isArray(j.Mods) ? j.Mods : Array.isArray(j) ? j : null;
}

// current_ prefixed orders were personally played by the maintainer, so they
// count as verified working alongside the working_ submissions.
const isWorking = f => /^working_/i.test(f) || /^current_/i.test(f);

// Label every mod with the section it sits under, per file.
const labelledOrders = [];
for (const f of fs.readdirSync(CORPUS).sort()) {
  if (!isWorking(f)) continue;
  const entries = readOrder(f);
  if (!entries) continue;
  let current = null;
  const seq = [];
  for (const e of entries) {
    const n = e?.Name;
    if (!n) continue;
    if (SEPARATOR_RE.test(n)) { current = canonical(n) ?? current; continue; }
    if (current) seq.push(current);
  }
  if (seq.length > 20) labelledOrders.push({ file: f, seq });
}

console.log(`working orders with labelled mods: ${labelledOrders.length}`);
labelledOrders.forEach(o => console.log(`  ${o.file.slice(0, 44).padEnd(46)} ${o.seq.length} labelled mods`));

// Aggregate every mod pair to category level.
const wins = new Map();   // "A|B" -> times an A mod preceded a B mod
const pairFiles = new Map();
const key = (a, b) => `${a}|${b}`;

for (const { file, seq } of labelledOrders) {
  const seen = new Set();
  for (let i = 0; i < seq.length; i++) {
    for (let j = i + 1; j < seq.length; j++) {
      const a = seq[i], b = seq[j];
      if (a === b) continue;
      wins.set(key(a, b), (wins.get(key(a, b)) || 0) + 1);
      seen.add(a < b ? key(a, b) : key(b, a));
    }
  }
  for (const k of seen) {
    if (!pairFiles.has(k)) pairFiles.set(k, new Set());
    pairFiles.get(k).add(file);
  }
}

const categories = [...new Set(labelledOrders.flatMap(o => o.seq))];

/** Win rate of a over b, and how much evidence sits behind it. */
function rate(a, b) {
  const ab = wins.get(key(a, b)) || 0;
  const ba = wins.get(key(b, a)) || 0;
  const total = ab + ba;
  const k = a < b ? key(a, b) : key(b, a);
  return { ab, ba, total, rate: total ? ab / total : 0.5, files: (pairFiles.get(k) || new Set()).size };
}

/**
 * Rank by Copeland score: how many head to head comparisons each category wins,
 * weighted by how much evidence sits behind each one.
 *
 * Averaging win rates was wrong. Each category is compared against a different
 * subset of opponents, so the averages are not on the same scale, and the result
 * contradicted its own strongest pairs. Copeland asks only "who beats whom",
 * which is the question an ordering actually answers.
 */
const MIN_SUPPORT = 50;
const scored = categories.map(c => {
  let score = 0, comparisons = 0;
  for (const other of categories) {
    if (other === c) continue;
    const r = rate(c, other);
    if (r.total < MIN_SUPPORT) continue;
    comparisons++;
    // Margin above a coin flip, weighted by evidence. A 90 percent win on 10,000
    // observations should outrank a 60 percent win on 60.
    score += (r.rate - 0.5) * Math.log10(r.total);
  }
  return { category: c, score, comparisons };
}).sort((a, b) => b.score - a.score);

console.log('\n=== LEARNED ORDER (higher score means it tends to load earlier) ===');
console.log('rank  category                        score  compared against');
scored.forEach((s, i) => {
  console.log(`${String(i + 1).padStart(4)}  ${s.category.padEnd(29)} ${s.score >= 0 ? ' ' : ''}${s.score.toFixed(2)}  ${s.comparisons}`);
});

console.log('\n=== EVIDENCE FOR EACH ADJACENT PAIR ===');
let agreed = 0, contested = 0, thin = 0;
for (let i = 0; i < scored.length - 1; i++) {
  const a = scored[i].category, b = scored[i + 1].category;
  const r = rate(a, b);
  const pct = Math.round(100 * r.rate);
  let verdict;
  if (r.total < 50) { verdict = 'thin'; thin++; }
  else if (pct >= 75) { verdict = 'agreed'; agreed++; }
  else if (pct >= 55) { verdict = 'leaning'; agreed++; }
  else { verdict = 'contested'; contested++; }
  console.log(`  ${a.padEnd(27)} before ${b.padEnd(27)} ${String(pct).padStart(3)}%  n=${String(r.total).padStart(6)}  files=${r.files}  ${verdict}`);
}
console.log(`\nadjacent pairs: ${agreed} supported, ${contested} contested, ${thin} thin`);

fs.writeFileSync(
  path.join('masterlist', 'learned-order.json'),
  JSON.stringify({ order: scored.map(s => s.category), detail: scored }, null, 2) + '\n',
);
console.log('wrote masterlist/learned-order.json');
