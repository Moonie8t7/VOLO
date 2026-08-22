/**
 * Candidate discovery signals, and the strata drawn from them.
 *
 * Seven, and the last one is the point: without a random sample of segments
 * matching nothing, you can measure how good the signals are and still not know
 * what lies outside them.
 *
 * A segment usually matches several. "If using Mod X, place it below Mod Y
 * because it overwrites the same file" is explicit, conditional and overwrite
 * at once. The primary stratum decides its inclusion probability and must be
 * exactly one, so the sample stays a probability sample; every signal it
 * matched is recorded alongside. Without that, "conditional has X percent
 * precision" would silently mean "conditional statements that did not also
 * match something earlier in this list", which is a different claim.
 */

export const STRATA = [
  {
    id: 'explicit_relative',
    what: 'one thing ordered against another, in any verb',
    re: /\b(?:before|after|above|below|under(?:neath)?|on top of|precede[sd]?|preceding|follows?\s+(?:it|this|that)|comes?\s+(?:after|before)|goes?\s+(?:after|before))\b/i,
  },
  {
    id: 'absolute_region',
    what: 'a position in the order rather than a relation to a mod',
    re: /\b(?:first|last|top|bottom|earliest|latest|near\s+the\s+(?:end|start|top|bottom)|very\s+(?:end|start|top|bottom))\b[^.]{0,40}\b(?:order|list|load)\b|\b(?:order|list)\b[^.]{0,40}\b(?:first|last|top|bottom)\b|\b(?:higher|lower)\b[^.]{0,25}\b(?:order|list|priority)\b/i,
  },
  {
    id: 'categorical',
    what: 'a class of mods against another class',
    re: /\b(?:utility|equipment|armou?r|audio|visual|base|library|framework|patch|texture|hair|head|body|dice|class|race|spell)\s+mods?\b|\bvisual\s+variants?\b|\ball\s+(?:your\s+)?\w+\s+mods\b/i,
  },
  {
    id: 'conditional',
    what: 'a remedy, or advice that depends on something',
    re: /\b(?:if|when|unless|should\s+you|in\s+case)\b[^.]{0,60}\b(?:fix|issue|problem|broken|not\s+work|conflict|crash|missing|order|priority|before|after|above|below)\b/i,
  },
  {
    id: 'gate_gap',
    what: 'inflections the first attempt could not match',
    re: /\b(?:placing|putting|position(?:ed|ing)?|ordering|arrange[ds]?|arranging|sort(?:ed|ing)?|move[ds]?|moving)\b/i,
  },
  {
    id: 'overwrite_conflict',
    what: 'override semantics, kept separate because it is noisy',
    re: /\b(?:overwrit\w*|overrid\w*|supersede\w*|takes?\s+priority|wins?\b|conflicts?\s+with|replaces?)\b/i,
  },
  {
    id: 'background',
    what: 'matched nothing above, sampled so the rest can be estimated',
    re: null,
  },
];

/** Every signal a segment matches, in declaration order. */
export function signalsOf(text) {
  return STRATA.filter(s => s.re && s.re.test(text)).map(s => s.id);
}

/** The one stratum that decides inclusion probability. */
export function primaryStratum(text) {
  const hits = signalsOf(text);
  return hits.length ? hits[0] : 'background';
}

/**
 * Deterministic PRNG, so a sample can be regenerated from its seed alone.
 * Math.random cannot be, and a sample nobody can redraw is not evidence.
 */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a += 0x6D2B79F5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Which half of the experiment a description belongs to.
 *
 * Split by description rather than by segment, because two near-identical
 * bullets from one mod would otherwise land on both sides and a parser tuned on
 * one would look good on the other. Derived from the id, so it is stable as the
 * corpus grows and needs no stored list.
 */
export function splitOf(nexusId, seed, testShare = 0.3) {
  const r = rng(seed ^ (Number(nexusId) * 2654435761));
  r();
  return r() < testShare ? 'test' : 'development';
}
