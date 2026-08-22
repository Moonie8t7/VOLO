/**
 * Every description whose prose has already been read during this research.
 *
 * These cannot serve as held-out evidence: their sentences shaped the schema,
 * the refusal patterns and the regression cases, so a parser built afterwards
 * has effectively already seen them. Recording which they are is the only way
 * the test half means anything.
 *
 * Deliberately generous. Anything the old run surfaced is included whether or
 * not a particular sentence was displayed, because the set as a whole is what
 * the design was reacting to.
 */

import fs from 'fs';
import path from 'path';

const RESEARCH = 'd:/Dev/VOLO/research/nexus-prose';

const ids = new Map();
const note = (id, why) => {
  const n = Number(id);
  if (!Number.isFinite(n)) return;
  if (!ids.has(n)) ids.set(n, new Set());
  ids.get(n).add(why);
};

/* Everything the invalidated run produced. */
for (const line of fs.readFileSync(path.join(RESEARCH, 'old-extraction.jsonl'), 'utf8').split('\n')) {
  if (!line.trim()) continue;
  const r = JSON.parse(line);
  note(r.nexusId, 'surfaced by the invalidated extractor');
  if (r.targetId) note(r.targetId, 'named as a target by the invalidated extractor');
}

/* Mods discussed by name while designing the schema and the regression suite. */
const BY_NAME = {
  744: 'worked example throughout, and a segmenter test',
  1186: 'the corroborating pair with 744',
  87: 'named as a requirement target in the worked example',
  97: 'named as a requirement target in the worked example',
  213: "Tav's Hair Salon, the requirement alias case",
  6643: 'Scantily Outfit Separator, the requirement alias case',
  24474: "Keileon's dividers, read while designing identity handling",
  24316: 'the VOLO page itself, read repeatedly',
};
for (const [id, why] of Object.entries(BY_NAME)) note(id, why);

/* The regression cases, by the page each was taken from. */
const REG = JSON.parse(fs.readFileSync(path.join(RESEARCH, 'regression-cases.json'), 'utf8'));
const pages = REG.map(r => r.page).filter(Boolean);

const out = {
  note: 'Descriptions already read during this research. They are forced into the development half, and any duplicate cluster touching one goes with them. A parser designed after reading these cannot be evaluated on them.',
  generated: '2026-08-22',
  regressionPages: pages,
  descriptions: [...ids.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([id, why]) => ({ nexusId: id, reasons: [...why] })),
};

fs.writeFileSync(path.join(RESEARCH, 'known-development-sources.json'), `${JSON.stringify(out, null, 2)}\n`);
console.log(`descriptions marked as already read: ${out.descriptions.length}`);
console.log(`regression pages named: ${pages.length}`);
