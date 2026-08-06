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

/** Empty rather than throwing, so a fresh checkout without the file still builds. */
function read() {
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch {
    return { placements: [], incompatible: [], messages: [] };
  }
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
    if (missed.length) problems.push(`${rule.pattern}: does not match ${missed.join(', ')}`);
    return { ...rule, re };
  });

  if (problems.length) {
    throw new Error(`curated rules do not match their own examples:\n  ${problems.join('\n  ')}`);
  }

  return { placements, messages, incompatible: raw.incompatible ?? [] };
}
