#!/usr/bin/env node
/**
 * Which descriptions have already been read, and how.
 *
 * Exposure is not one thing. A page whose prose was read cannot be held-out
 * evidence, because its sentences shaped the schema and the refusal patterns.
 * A page that was merely *named* by another page's sentence is different: its
 * identity is known, its prose has never been seen, and excluding it buys no
 * protection while making the held-out set smaller and stranger.
 *
 * So exposure is graded, and only the first two kinds force a description out
 * of the test half.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RESEARCH = path.resolve(HERE, '..');

/** Ordered by severity. TEXT_SEEN and CLAIM_SEEN force development. */
const KINDS = {
  TEXT_SEEN: 'the prose of this description was read during the research',
  CLAIM_SEEN: 'a claim extracted from this description was examined',
  TARGET_ONLY: 'named as a target by another page, prose never read',
  NAME_ONLY: 'the mod name came up, prose never read',
};
const FORCES_DEVELOPMENT = new Set(['TEXT_SEEN', 'CLAIM_SEEN']);

const ids = new Map();
const note = (id, kind, why) => {
  const n = Number(id);
  if (!Number.isFinite(n)) return;
  if (!ids.has(n)) ids.set(n, { kinds: new Set(), reasons: new Set() });
  ids.get(n).kinds.add(kind);
  ids.get(n).reasons.add(why);
};

/* Everything the invalidated extractor surfaced: its sentences were the material
 * the schema and the refusal patterns were written against. */
for (const line of fs.readFileSync(path.join(RESEARCH, 'old-extraction.jsonl'), 'utf8').split('\n')) {
  if (!line.trim()) continue;
  const r = JSON.parse(line);
  note(r.nexusId, 'CLAIM_SEEN', 'a claim from this page was extracted and reviewed');
  /* The target was named inside somebody else's sentence. Its own page was
   * never opened, so it is not contaminated as text. */
  if (r.targetId) note(r.targetId, 'TARGET_ONLY', 'named as a target by another page');
}

/* Pages actually opened and read while designing the schema. */
const READ = {
  744: 'worked example throughout, and a segmenter test',
  1186: 'the corroborating pair with 744',
  213: "Tav's Hair Salon, read while resolving the requirement alias",
  6643: 'Scantily Outfit Separator, read while resolving the requirement alias',
  24474: "Keileon's dividers, read while designing identity handling",
  24316: 'the VOLO page itself, read repeatedly',
};
for (const [id, why] of Object.entries(READ)) note(id, 'TEXT_SEEN', why);

const REG = JSON.parse(fs.readFileSync(path.join(RESEARCH, 'regression-cases.json'), 'utf8'));

const descriptions = [...ids.entries()]
  .map(([nexusId, v]) => {
    /* The most severe kind wins. */
    const kind = ['TEXT_SEEN', 'CLAIM_SEEN', 'TARGET_ONLY', 'NAME_ONLY'].find(k => v.kinds.has(k));
    return { nexusId, exposure: kind, forcesDevelopment: FORCES_DEVELOPMENT.has(kind), reasons: [...v.reasons] };
  })
  .sort((a, b) => a.nexusId - b.nexusId);

const out = {
  note: 'Descriptions already encountered during this research, graded by how. Only TEXT_SEEN and CLAIM_SEEN force the development half: a page merely named by another page has never been read, and excluding it shrinks the held-out set for no protection.',
  kinds: KINDS,
  forcesDevelopment: [...FORCES_DEVELOPMENT],
  regressionPages: REG.map(r => r.page).filter(Boolean),
  descriptions,
};
fs.writeFileSync(path.join(RESEARCH, 'known-development-sources.json'), `${JSON.stringify(out, null, 2)}\n`);

const byKind = {};
for (const d of descriptions) byKind[d.exposure] = (byKind[d.exposure] ?? 0) + 1;
console.log(`descriptions encountered: ${descriptions.length}`);
for (const [k, v] of Object.entries(byKind)) {
  console.log(`  ${String(v).padStart(4)}  ${k.padEnd(12)}${FORCES_DEVELOPMENT.has(k) ? 'forces development' : 'does not force'}`);
}
console.log(`forcing development: ${descriptions.filter(d => d.forcesDevelopment).length}`);
