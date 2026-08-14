/**
 * Hand-written rules: the tier that states a constraint rather than measuring
 * a habit.
 *
 * Everything else in the masterlist is inferred from what players did, which is
 * good at the long tail and blind to sharp edges. A statistic can say a mod
 * usually loads late. Only a person can say two mods must never be installed
 * together, or that a patcher has to run after the thing it patches. LOOT is
 * essentially all of this tier; VOLO had ten regexes buried in a script.
 *
 * The rules live in masterlist/curated-rules.json so that curating does not
 * mean editing code. Patterns are compiled here, and every one must match the
 * examples it carries: three pattern tables in this project have silently
 * stopped matching anything, twice through an escape being eaten, and the
 * examples are what make that loud.
 */

import fs from 'fs';
import path from 'path';

const FILE = path.join('masterlist', 'curated-rules.json');

/**
 * A missing file means no rules yet, and the build proceeds empty. A file that
 * exists but does not parse means somebody's rules are about to be silently
 * dropped, every curated placement with them, and that must stop the build:
 * swallowing it once would have shipped Compatibility Framework as a library
 * again, which is the exact regression this tier exists to prevent.
 */
function read() {
  let text;
  try {
    text = fs.readFileSync(FILE, 'utf8');
  } catch {
    return { placements: [], incompatible: [], messages: [] };
  }
  return JSON.parse(text);
}

/**
 * Compiled rules, with every pattern checked against its own examples.
 *
 * Throws rather than warning. A curated rule that matches nothing is worse than
 * no rule: it looks like the case is handled while the mod falls through to a
 * guess, which is exactly how Compatibility Framework ended up filed as a
 * library and loading far too early.
 */
export function loadCuratedRules() {
  const raw = read();
  const problems = [];

  const placements = (raw.placements ?? []).map(rule => {
    const re = new RegExp(rule.pattern, 'i');
    const missed = (rule.examples ?? []).filter(e => !re.test(e));
    if (!rule.examples?.length) problems.push(`${rule.pattern}: no examples to check against`);
    if (missed.length) problems.push(`${rule.pattern}: does not match ${missed.join(', ')}`);
    return { ...rule, re };
  });

  const messages = (raw.messages ?? []).map(rule => {
    const re = new RegExp(rule.pattern, 'i');
    const missed = (rule.examples ?? []).filter(e => !re.test(e));
    if (!rule.examples?.length) problems.push(`${rule.pattern}: no examples to check against`);
    if (missed.length) problems.push(`${rule.pattern}: does not match ${missed.join(', ')}`);
    if (typeof rule.text !== 'string' || !rule.text.trim()) {
      problems.push(`${rule.pattern}: a message rule with no text warns nobody of nothing`);
    }
    return { ...rule, re };
  });

  /*
   * Incompatibilities have no pattern to compile, but a malformed entry fails
   * just as silently: a pair that never matches is a warning nobody ever sees,
   * shipped in a file that names other people's work.
   */
  const incompatible = (raw.incompatible ?? []).map((rule, i) => {
    const label = `incompatible[${i}]`;
    if (!Array.isArray(rule.mods) || rule.mods.length < 2
      || rule.mods.some(m => typeof m !== 'string' || !m.trim())) {
      problems.push(`${label}: needs at least two mod names or UUIDs`);
    }
    if (typeof rule.why !== 'string' || !rule.why.trim()) {
      problems.push(`${label}: needs a why, because it makes a public claim about someone's work`);
    }
    return rule;
  });

  /*
   * A requirement can name a mod by something none of its own strings match.
   * Mod pages, pak folders and published titles drift apart, and a mod author
   * writing "requires Vlad's Grimoire" is naming the page, not the pak called
   * VFX_Library_VladsGrimoire. Nothing measurable joins those, and guessing by
   * resemblance would invent links between unrelated mods, so this tier is
   * where a person states the equivalence and says how they know.
   *
   * Whether the named mod actually exists is checked in the miner, which is
   * the only place that has the masterlist to check against. An alias to a mod
   * nobody has heard of is inert, and inert rules are what this file exists to
   * make loud.
   */
  const requirementAliases = (raw.requirementAliases ?? []).map((rule, i) => {
    const label = `requirementAliases[${i}]`;
    for (const field of ['requirement', 'mod', 'why']) {
      if (typeof rule[field] !== 'string' || !rule[field].trim()) {
        problems.push(`${label}: needs a ${field}`);
      }
    }
    if (rule.requirement && rule.mod
      && normaliseName(rule.requirement) === normaliseName(rule.mod)) {
      problems.push(`${label}: "${rule.requirement}" already matches "${rule.mod}" without an alias`);
    }
    return rule;
  });

  /*
   * One mod standing in for another. Two mods can do the same job without
   * sharing a name, an author or a line of metadata, so a mod requiring the
   * first is satisfied by the second and nothing in the data says so. Kept
   * apart from an alias, which says two names mean the same mod: these are
   * different mods, and only one of them needs to be installed.
   *
   * Both sides are checked against the masterlist in the miner, for the same
   * reason the aliases are.
   */
  const requirementSatisfiedBy = (raw.requirementSatisfiedBy ?? []).map((rule, i) => {
    const label = `requirementSatisfiedBy[${i}]`;
    for (const field of ['requirement', 'satisfiedBy', 'why']) {
      if (typeof rule[field] !== 'string' || !rule[field].trim()) {
        problems.push(`${label}: needs a ${field}`);
      }
    }
    if (rule.requirement && rule.satisfiedBy
      && normaliseName(rule.requirement) === normaliseName(rule.satisfiedBy)) {
      problems.push(`${label}: a mod cannot stand in for itself`);
    }
    return rule;
  });

  if (problems.length) {
    throw new Error(`curated rules failed validation:\n  ${problems.join('\n  ')}`);
  }

  /*
   * A load order somebody published for their own mods.
   *
   * Every other ordering signal here is inferred from what players did. This is
   * an author saying what the sequence is, which is a different kind of claim
   * and a better one, and until now the file had nowhere to put it: a placement
   * says which shelf a mod belongs on, and says nothing about which of two mods
   * on the same shelf comes first.
   *
   * Recorded as an ordering, deliberately not as a requirement. A published
   * sequence says these load in this order; it does not say the later ones need
   * the earlier ones, and telling somebody a mod is missing on that basis would
   * be inventing a dependency the author never claimed. The person who relayed
   * this one said as much: they did not know whether the mods must be grouped or
   * merely kept in sequence.
   *
   * The source is required. This tier makes public claims about other people's
   * work, and a claim with no link is one nobody can check or correct.
   */
  const sequences = (raw.sequences ?? []).map((rule, i) => {
    const label = `sequences[${i}]`;
    if (!Array.isArray(rule.order) || rule.order.length < 2) {
      problems.push(`${label}: an ordering needs at least two mods`);
    }
    if ((rule.order ?? []).some(n => typeof n !== 'string' || !n.trim())) {
      problems.push(`${label}: every entry must be a mod name`);
    }
    const seen = new Set();
    for (const n of rule.order ?? []) {
      const k = normaliseName(n);
      if (seen.has(k)) problems.push(`${label}: "${n}" appears twice, so its position is undecidable`);
      seen.add(k);
    }
    for (const field of ['why', 'source']) {
      if (typeof rule[field] !== 'string' || !rule[field].trim()) {
        problems.push(`${label}: needs a ${field}`);
      }
    }
    return rule;
  });

  return {
    placements, messages, incompatible, requirementAliases, requirementSatisfiedBy, sequences,
  };
}

/** The one normalisation every name lookup in the project agrees on. */
export const normaliseName = s => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
