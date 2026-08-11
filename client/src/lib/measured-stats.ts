/**
 * The arithmetic behind every measurement the site quotes, done once.
 *
 * Three places talk about the held-out evaluation: the measured page, the
 * sceptical part of the about page, and the README that scripts/sync-figures
 * rewrites. Each hand-derived copy of these figures has gone stale at least
 * once, and a page arguing for honest measurement cannot contradict its own
 * table. So the prose interpolates from here and nothing is typed twice.
 */

import measured from './measured.json';

export type MeasuredOrder = (typeof measured.orders)[number];

const held = measured.orders.map(o => o.held);

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);

/** One decimal, which is all the precision the corpus supports. */
export const pct = (v: number) => (Math.round(v * 10) / 10).toFixed(1);

/** Sample standard deviation of the per-order scores. */
const spread = (() => {
  if (held.length < 2) return 0;
  const m = mean(held);
  return Math.sqrt(held.reduce((a, b) => a + (b - m) ** 2, 0) / (held.length - 1));
})();

export const ORDERS = measured.orders;
export const EVALUATED = measured.orders.length;

/** Orders left out of the score because VOLO produced them. */
export const SELF_SORTED = 'selfSorted' in measured ? (measured.selfSorted as number) : 0;

export const HELD_OUT = pct(mean(held));
export const RANDOM = pct(mean(ORDERS.map(o => o.random)));

/**
 * The same average with each order counted by its size. Someone running 900
 * mods is not well served by a mean in which a 41-mod list weighs the same.
 */
export const WEIGHTED = pct(
  ORDERS.reduce((a, o) => a + o.held * o.mods, 0) / ORDERS.reduce((a, o) => a + o.mods, 0),
);

/**
 * How far the headline can be expected to move on its own, as the standard
 * error of the mean. It is the honest answer to "is 61 percent really 61
 * percent", and it shrinks only with the square root of the corpus, which is
 * why one more submission changes so little and a hundred change everything.
 */
export const ERROR = pct(spread / Math.sqrt(EVALUATED || 1));

/**
 * Orders needed before the headline is steady to within half a point, rounded
 * to something a person would say out loud. Half a point is the threshold at
 * which the measurement can tell two candidate rule sets apart; below that the
 * corpus is the thing being measured, not the sorter.
 */
export const TARGET = Math.max(60, Math.round(((spread / 0.5) ** 2) / 10) * 10);

/**
 * Whether the corpus has reached it. The pages branch on this so the claim
 * about how much evidence there is changes when the evidence does, instead of
 * waiting for somebody to notice that "the corpus is small" stopped being true.
 */
export const ENOUGH = EVALUATED >= TARGET;

/** Orders the sort did no better on than a shuffle. Quoted, never rounded away. */
export const BELOW_CHANCE = ORDERS.filter(o => o.held <= o.random).length;

/** The extremes of the corpus, for the sentence about weighting by size. */
export const SMALLEST = Math.min(...ORDERS.map(o => o.mods));
export const LARGEST = Math.max(...ORDERS.map(o => o.mods));

/** Newest arrivals first. The corpus that predates the intake form has no date. */
export const byRecency = [...ORDERS].sort((a, b) => {
  if (a.date !== b.date) return (b.date ?? '').localeCompare(a.date ?? '');
  return a.name.localeCompare(b.name);
});

/**
 * Where the sort helped most, as points gained over a random shuffle of the
 * same list. Agreement on its own is not the interesting quantity: an order
 * whose random baseline is 55 has a far easier job than one sitting at 46.
 */
export const byLift = [...ORDERS]
  .map(o => ({ ...o, lift: o.held - o.random }))
  .sort((a, b) => b.lift - a.lift);
