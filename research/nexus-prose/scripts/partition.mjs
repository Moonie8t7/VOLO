/**
 * Which side of the experiment a description belongs to.
 *
 * Splitting by description is not enough on its own. Authors paste the same
 * instruction across their whole collection: one caveat about Wild Shapes
 * appears on seventeen different mods, and the same War Caster wording on
 * several more. Those are different descriptions, so a per-description split
 * happily puts one copy in development and another in test, and a parser tuned
 * on the first scores perfectly on the second while having learned nothing.
 *
 * So descriptions sharing a normalised segment are joined into one cluster and
 * the whole cluster goes to one side.
 *
 * Only segments that could teach a parser something are allowed to join. The
 * danger is materially equivalent load order evidence appearing on both sides,
 * not any text at all appearing twice, and joining on any repeat is transitive:
 * one translator's install steps, a donation footer and a maintenance notice
 * welded 400 descriptions into a single component, 310 of the 343 segments
 * holding it together carrying no ordering language whatsoever. Restricting the
 * join to signal-bearing text takes the largest component from 400 to 52 and
 * the descriptions forced out of the test half from 1,200 to 269, without
 * weakening the protection that matters.
 *
 * Any cluster touching a description that has already been read during the
 * research goes to development, whatever the hash says.
 */

import { rng, signalsOf } from './strata.mjs';

/** Text reduced to what a paste would keep: no case, punctuation, links or ids. */
export function normaliseSegment(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/<[a-z_]+>/gi, ' ')
    .replace(/\d+/g, ' ')
    .replace(/[^a-z]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Union-find over description ids. */
function unionFind() {
  const parent = new Map();
  const find = x => {
    if (!parent.has(x)) parent.set(x, x);
    let r = x;
    while (parent.get(r) !== r) r = parent.get(r);
    while (parent.get(x) !== r) { const n = parent.get(x); parent.set(x, r); x = n; }
    return r;
  };
  return {
    find,
    union: (a, b) => {
      const ra = find(a);
      const rb = find(b);
      if (ra !== rb) parent.set(ra, rb);
    },
  };
}

/**
 * Assign every description to development or test.
 *
 * `bySegment` maps a normalised segment to the descriptions carrying it. Only
 * segments long enough to be a real paste are used to join: a shared "requires
 * script extender" is not evidence that two pages are the same material.
 */
export function partition({ descriptions, bySegment, alreadyRead, seed, testShare = 0.3, minJoinLength = 40 }) {
  const uf = unionFind();
  for (const id of descriptions) uf.find(id);

  let joins = 0;
  let skippedGeneric = 0;
  for (const [text, ids] of bySegment) {
    if (text.length < minJoinLength) continue;
    if (ids.size < 2) continue;
    /* Repeated prose that carries no discovery signal cannot teach a parser
     * how to recognise ordering evidence, so it does not bind the two pages. */
    if (!signalsOf(text).length) { skippedGeneric++; continue; }
    const list = [...ids];
    for (let i = 1; i < list.length; i++) { uf.union(list[0], list[i]); joins++; }
  }

  /* Clusters that must be development, because part of them has been read. */
  const forced = new Set();
  for (const id of alreadyRead) if (descriptions.has(id)) forced.add(uf.find(id));

  const split = new Map();
  const clusterOf = new Map();
  for (const id of descriptions) {
    const root = uf.find(id);
    clusterOf.set(id, root);
    if (forced.has(root)) { split.set(id, 'development'); continue; }
    const r = rng(seed ^ (root * 2654435761));
    r();
    split.set(id, r() < testShare ? 'test' : 'development');
  }

  const clusters = new Map();
  for (const [id, root] of clusterOf) {
    if (!clusters.has(root)) clusters.set(root, []);
    clusters.get(root).push(id);
  }
  const multi = [...clusters.values()].filter(c => c.length > 1);

  return {
    split,
    clusterOf,
    stats: {
      descriptions: descriptions.size,
      joins,
      clusters: clusters.size,
      multiDescriptionClusters: multi.length,
      largestCluster: multi.reduce((n, c) => Math.max(n, c.length), 0),
      descriptionsInMultiClusters: multi.reduce((n, c) => n + c.length, 0),
      skippedGenericDuplicates: skippedGeneric,
      forcedClusters: forced.size,
      /* Forced by contamination, not merely assigned to development. Reporting
       * the latter under this name once made a 70/30 split look like a 73
       * percent contamination event. */
      forcedDescriptions: [...split.entries()]
        .filter(([id, side]) => side === 'development' && forced.has(uf.find(id))).length,
      inDevelopment: [...split.values()].filter(v => v === 'development').length,
      inTest: [...split.values()].filter(v => v === 'test').length,
    },
  };
}
