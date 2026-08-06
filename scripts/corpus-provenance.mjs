/**
 * Whether a submitted load order is VOLO's own output coming back.
 *
 * Someone sorts with VOLO, plays on the result, and submits it. That order
 * looks like a second person agreeing, and contains no independent evidence at
 * all: its sequence is what VOLO already believed. Counted as corroboration it
 * inflates every agreement figure while teaching the masterlist nothing, and
 * the effect compounds, because each round makes the next submission likelier
 * to match.
 *
 * Tagging the exported file cannot solve this. The path a real order takes is
 * VOLO, then BG3 Mod Manager, then play, then export from BG3MM, then submit.
 * BG3MM rewrites the file, so any marker VOLO wrote is gone before the order
 * comes back. Two things are recorded here instead: what the submitter said,
 * and what the sequence itself measures against VOLO's own sort.
 *
 * A flagged order is not discarded. It still proves the mods exist, that
 * someone played this combination, and whether it worked. What it cannot
 * support is anything positional, so the miner keeps the first and ignores the
 * second.
 */

import fs from 'fs';
import path from 'path';

const FILE = path.join('Load Orders - Public Submitted', 'provenance.json');

/**
 * Agreement above which a submission is treated as VOLO's own output.
 *
 * VOLO's sort is deterministic, so its own output returns near-identical rather
 * than merely similar. The masterlist moves between someone exporting and
 * submitting, which is why this is not set at 1. Deliberately high: wrongly
 * discarding a real player's evidence costs more than letting one echo through,
 * and the declared answer is the primary signal in any case.
 */
export const VOLO_MATCH_THRESHOLD = 0.98;

/** The recorded provenance, keyed by corpus filename. Empty when absent. */
export function readProvenance() {
  try {
    const parsed = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    return parsed.orders ?? {};
  } catch {
    return {};
  }
}

/**
 * True when an order should not be used as positional evidence.
 *
 * Absence means independent. Everything in the corpus before this existed was
 * submitted when VOLO could not yet sort anything, and treating unknown orders
 * as suspect would throw away the only evidence the project has.
 */
export function isVoloSorted(filename, provenance = readProvenance()) {
  return provenance[filename]?.sortedByVolo === true;
}

/**
 * Decides provenance from what the submitter said and what the order measures.
 *
 * The declared answer wins in both directions. Someone who says they arranged
 * it themselves is believed even when the sequence happens to match, because
 * VOLO agreeing with a player is the goal rather than a fault, and that
 * agreement rises as the masterlist improves. The measurement only decides the
 * cases where nobody said.
 */
export function judge({ declared, agreementWithVolo }) {
  if (declared === 'volo') return true;
  if (declared === 'self') return false;
  return typeof agreementWithVolo === 'number'
    && agreementWithVolo >= VOLO_MATCH_THRESHOLD;
}

/** Adds or replaces one order's provenance, keeping the file sorted. */
export function writeProvenance(filename, entry) {
  const orders = readProvenance();
  orders[filename] = entry;

  const sorted = Object.fromEntries(Object.entries(orders).sort(([a], [b]) => a.localeCompare(b)));
  fs.writeFileSync(FILE, `${JSON.stringify({
    note: 'How each submitted order reached us. See scripts/corpus-provenance.mjs.',
    orders: sorted,
  }, null, 2)}\n`);
}
