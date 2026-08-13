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

/**
 * current_ prefixed orders were personally played by the maintainer, so they
 * count as verified working alongside the working_ submissions.
 */
const isWorking = f => /^working_/i.test(f) || /^current_/i.test(f);

/** Label every mod with the section it sits under, per file. */
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

/** Aggregate every mod pair to category level. */
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

const MIN_SUPPORT = 50;

/**
 * The two markers are definitions, not findings, so they are never scored.
 *
 * A submitter writing "Top of Load Order" is saying where their order begins.
 * Ranked alongside real categories they placed fourth and sixteenth, on sixteen
 * and five comparisons. Worse, leaving them in as opponents skewed everyone
 * else: sixteen categories could clear the support threshold against the head
 * marker and take a loss from it, while only five ever met the tail marker to
 * win one back.
 */
const SENTINELS = ['Top of Load Order', 'Bottom of Load Order'];
const ranked = categories.filter(c => !SENTINELS.includes(c)).sort();

/**
 * How much evidence an order contradicts, which is the thing being minimised.
 *
 * Every pair with enough support votes on which category comes first, and the
 * strength of that vote is how lopsided it is times how many observations sit
 * behind it. An order that puts the pair the other way round pays that weight.
 */
const disagreement = order => {
  const at = new Map(order.map((c, i) => [c, i]));
  let total = 0;
  for (let i = 0; i < ranked.length; i++) {
    for (let j = i + 1; j < ranked.length; j++) {
      const a = ranked[i], b = ranked[j];
      const r = rate(a, b);
      if (r.total < MIN_SUPPORT) continue;
      if ((at.get(a) < at.get(b)) !== (r.rate > 0.5)) {
        total += Math.abs(r.rate - 0.5) * r.total;
      }
    }
  }
  return total;
};

/**
 * Order the categories by minimising that weight directly.
 *
 * Two ranking rules were tried before this and both lost pairs they should have
 * won, for the same underlying reason: they scored each category in isolation
 * and hoped a good ordering fell out. Averaging win rates compared each category
 * against a different set of opponents, so the averages were not on one scale.
 * Copeland fixed that by counting only who beats whom, and thereby made a pair
 * resting on 118,127 observations weigh exactly as much as one resting on 52; it
 * shipped Character Customization ahead of Classes against a corpus that says
 * the opposite 87.7 percent of the time, and that single pair was 62 percent of
 * all the disagreement left in the result.
 *
 * Scoring an order rather than a category removes the indirection. Start from
 * the best of the two cheap heuristics, then move one category at a time to
 * wherever it costs least, until nothing improves. Ties break on the category
 * name so a rebuild always produces the same file: an earlier version fell
 * through to the order category names happened to appear in while reading the
 * corpus, which let the first file read decide a pair worth 5,405 observations.
 */
const seedBy = score => [...ranked].sort((a, b) => score(b) - score(a) || a.localeCompare(b));
const copeland = c => ranked.reduce((s, o) => {
  if (o === c) return s;
  const r = rate(c, o);
  return r.total < MIN_SUPPORT ? s : s + (r.rate > 0.5 ? 1 : r.rate < 0.5 ? -1 : 0);
}, 0);
const margin = c => ranked.reduce((s, o) => {
  if (o === c) return s;
  const r = rate(c, o);
  return r.total < MIN_SUPPORT ? s : s + (r.rate - 0.5) * r.total;
}, 0);

let best = [seedBy(copeland), seedBy(margin)]
  .reduce((x, y) => (disagreement(y) < disagreement(x) ? y : x));
let bestCost = disagreement(best);

for (let pass = 0; pass < 100; pass++) {
  let improved = false;
  for (const c of [...ranked].sort()) {
    const without = best.filter(x => x !== c);
    let localBest = best, localCost = bestCost;
    for (let i = 0; i <= without.length; i++) {
      const candidate = [...without.slice(0, i), c, ...without.slice(i)];
      const cost = disagreement(candidate);
      if (cost < localCost - 1e-9) { localBest = candidate; localCost = cost; }
    }
    if (localCost < bestCost - 1e-9) { best = localBest; bestCost = localCost; improved = true; }
  }
  if (!improved) break;
}

const order = ['Top of Load Order', ...best, 'Bottom of Load Order'];
const scored = order.map(category => ({
  category,
  copeland: SENTINELS.includes(category) ? null : copeland(category),
  comparisons: SENTINELS.includes(category)
    ? null
    : ranked.filter(o => o !== category && rate(category, o).total >= MIN_SUPPORT).length,
}));

console.log('\n=== LEARNED ORDER (earliest first) ===');
console.log('rank  category                      copeland  compared against');
scored.forEach((s, i) => {
  const c = s.copeland === null ? 'pinned' : String(s.copeland).padStart(6);
  console.log(`${String(i + 1).padStart(4)}  ${s.category.padEnd(29)} ${c}  ${s.comparisons ?? ''}`);
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

/**
 * How well the order VOLO actually ships fits the corpus it claims to learn from.
 *
 * The sequence in scripts/mine-corpus.mjs is a constant on purpose: adopting a
 * new one changes every sort, so it should be a decision somebody makes and
 * measures rather than something that moves under them overnight. The failure
 * mode of a constant is that it quietly stops matching the evidence, which is
 * exactly what happened: it sat unchanged while the corpus grew from nine orders
 * to fifty-nine and ended up contradicting 54 of its own 281 pairwise
 * comparisons. Recording the fit turns that into something a test can see.
 */
const shippedOrder = (() => {
  try {
    const src = fs.readFileSync(path.join('scripts', 'mine-corpus.mjs'), 'utf8');
    const block = src.match(/const GROUPS = \[([\s\S]*?)\n\];/)[1];
    return [...block.matchAll(/name: '([^']+)'/g)].map(m => m[1]);
  } catch {
    return [];
  }
})();

const fitOf = order => {
  const at = new Map(order.map((g, i) => [g, i]));
  let against = 0, weighted = 0, compared = 0;
  for (let i = 0; i < categories.length; i++) {
    for (let j = i + 1; j < categories.length; j++) {
      const a = categories[i], b = categories[j];
      if (!at.has(a) || !at.has(b)) continue;
      const r = rate(a, b);
      if (r.total < MIN_SUPPORT) continue;
      compared++;
      if ((at.get(a) < at.get(b)) !== (r.rate > 0.5)) {
        against++;
        weighted += Math.abs(r.rate - 0.5) * r.total;
      }
    }
  }
  return { compared, against, weighted: Math.round(weighted) };
};

const learnedOrder = scored.map(s => s.category);
const shippedFit = fitOf(shippedOrder);
const learnedFit = fitOf(learnedOrder);
console.log('\n=== FIT AGAINST THE CORPUS (lower is better) ===');
console.log(`  shipped GROUPS  ${shippedFit.against} of ${shippedFit.compared} pairs against the evidence, weighted ${shippedFit.weighted.toLocaleString()}`);
console.log(`  learned here    ${learnedFit.against} of ${learnedFit.compared} pairs against the evidence, weighted ${learnedFit.weighted.toLocaleString()}`);

fs.writeFileSync(
  path.join('masterlist', 'learned-order.json'),
  JSON.stringify({ order: learnedOrder, shippedFit, learnedFit, detail: scored }, null, 2) + '\n',
);
console.log('wrote masterlist/learned-order.json');
