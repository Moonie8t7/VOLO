#!/usr/bin/env node
/**
 * Rewrites the figures quoted in README.md and docs/decisions.md from the
 * masterlist and the held-out measurement, so prose cannot drift from data.
 *
 * The corpus grows without a human in the loop: a submission lands, the
 * masterlist regenerates, and every hand-typed copy of its figures is stale
 * by morning. The site's pages already render from generated JSON; this
 * script is the same idea for the two documents that are prose on disk.
 *
 * Every rewrite anchors on the sentence around the number. A missing anchor
 * exits non-zero rather than skipping, because a sync that silently syncs
 * nothing is how figures go stale while looking maintained; the smoke test
 * remains the net underneath, checking the result against the masterlist.
 */

import fs from 'fs';
import path from 'path';

const masterlist = JSON.parse(fs.readFileSync(path.join('masterlist', 'bg3-masterlist.json'), 'utf8'));
const measured = JSON.parse(fs.readFileSync(path.join('client', 'src', 'lib', 'measured.json'), 'utf8'));

const tier = src => masterlist.plugins.filter(p => p.evidence?.source === src).length;
const figures = {
  total: masterlist.plugins.length,
  sections: tier('section') + tier('section-majority'),
  names: tier('name-pattern'),
  listings: tier('external-category'),
  author: tier('author-catalogue'),
  inferred: tier('inferred'),
  curated: tier('curated'),
  none: tier('none'),
  onSlot: masterlist.plugins.filter(p => p.divider !== undefined).length,
};

const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight',
  'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
  'seventeen', 'eighteen', 'nineteen', 'twenty'];
const word = n => WORDS[n] ?? String(n);
const wordCap = n => { const w = word(n); return w.charAt(0).toUpperCase() + w.slice(1); };
const num = n => n.toLocaleString('en-GB');
const pct = v => v.toFixed(1);

const big = measured.orders.filter(o => o.mods > 200);
const bigMean = pct(big.reduce((a, o) => a + o.held, 0) / (big.length || 1));

const problems = [];

/** Replaces exactly one match, or records the miss. EOL-agnostic. */
function rewrite(file, pattern, replacement) {
  const text = fs.readFileSync(file, 'utf8');
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const wired = replacement.replaceAll('\n', eol);
  const next = text.replace(pattern, wired);
  if (next === text && !text.includes(wired)) {
    problems.push(`${file}: no match for ${pattern}`);
    return;
  }
  fs.writeFileSync(file, next);
}

rewrite('README.md',
  /VOLO agrees with them \*\*[\d.]+ percent\*\* of\r?\nthe time against \*\*[\d.]+ percent\*\* for a random shuffle\./,
  `VOLO agrees with them **${pct(measured.heldOut)} percent** of\nthe time against **${pct(measured.random)} percent** for a random shuffle.`);

rewrite('README.md',
  /`masterlist\/bg3-masterlist\.json` covers [\s\S]*?sit on a divider position\./,
  `\`masterlist/bg3-masterlist.json\` covers ${num(figures.total)} mods. ${num(figures.sections)} were\n`
  + `categorised from section headers modders wrote in their own orders,\n`
  + `${num(figures.names)} from name patterns, ${num(figures.listings)} from a Nexus or mod.io listing,\n`
  + `${num(figures.author)} from where their author's other catalogued mods sit, ${num(figures.inferred)} inferred\n`
  + `from their neighbours, ${num(figures.curated)} from curated overrides, and ${num(figures.none)} are not\n`
  + `categorised at all. ${num(figures.onSlot)} of the ${num(figures.total)} sit on a divider position.`);

rewrite('README.md',
  /\w+ working orders is a small corpus/,
  `${wordCap(measured.ordersEvaluated)} working orders is a small corpus`);

rewrite('README.md',
  /[\d,]+ mods have no category from any source\./,
  `${num(figures.none)} mods have no category from any source.`);

rewrite('docs/decisions.md',
  /Current: \*\*[\d.]+ percent held out\*\*, against a [\d.]+ percent random baseline,\r?\nover \w+ distinct working orders\./,
  `Current: **${pct(measured.heldOut)} percent held out**, against a ${pct(measured.random)} percent random baseline,\nover ${word(measured.ordersEvaluated)} distinct working orders.`);

rewrite('docs/decisions.md',
  /the \w+ orders above 200 mods average [\d.]+ on their own/,
  `the ${word(big.length)} orders above 200 mods average ${bigMean} on their own`);

if (problems.length) {
  console.error(`figure sync failed:\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log(`figures synced: ${num(figures.total)} mods, ${measured.ordersEvaluated} orders, `
  + `${pct(measured.heldOut)} held out against ${pct(measured.random)} random`);
