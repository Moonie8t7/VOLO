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
 * the whole cluster goes to one side. Exact-after-normalisation only, which is
 * the minimum that catches known boilerplate; near-duplicate clustering would
 * catch more and is not needed to close this hole.
 *
 * Any cluster touching a description that has already been read during the
 * research goes to development, whatever the hash says.
 */

import { rng } from './strata.mjs';

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
  for (const [text, ids] of bySegment) {
    if (text.length < minJoinLength) continue;
    if (ids.size < 2) continue;
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
      forcedClusters: forced.size,
      forcedDescriptions: [...split.values()].filter(v => v === 'development').length,
    },
  };
}
