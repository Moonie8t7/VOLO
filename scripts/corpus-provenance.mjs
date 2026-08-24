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
export function judge({ declared, agreementWithVolo, nearest }) {
  if (declared === 'volo') return true;
  if (echoesNeighbour(agreementWithVolo, nearest)) return true;
  if (declared === 'self') return false;
  return typeof agreementWithVolo === 'number'
    && agreementWithVolo >= VOLO_MATCH_THRESHOLD;
}

/** How much of its mods an order must share to be the same order again. */
export const NEIGHBOUR_SIMILARITY = 0.85;

/** How far agreement must climb between two of them to be VOLO's doing. */
export const NEIGHBOUR_JUMP = 0.15;

/**
 * Whether this order is a near-copy of one already here that agrees with VOLO
 * far more than the original did.
 *
 * The declared answer cannot catch this, and is not meant to. Someone sorts
 * with VOLO, plays it, exports from BG3 Mod Manager and submits, and answers
 * that they arranged it themselves. They are not lying: they did arrange it,
 * and taking the tool's advice is the point of the tool. But the sequence is
 * VOLO's, and counting it as a second opinion is how a sorter starts marking
 * its own homework.
 *
 * The corpus separates the two cases cleanly. Somebody refining their own order
 * over several days resubmits with agreement moving by at most 0.08. The known
 * echo moved 0.642 to 0.928 on 94.7 percent the same mods, submitted the same
 * day. The test is deliberately directional: the copy that agrees more is the
 * one that went through VOLO, so the original is never flagged by its own echo.
 */
export function echoesNeighbour(agreementWithVolo, nearest) {
  return typeof agreementWithVolo === 'number'
    && typeof nearest?.agreementWithVolo === 'number'
    && nearest.similarity >= NEIGHBOUR_SIMILARITY
    && agreementWithVolo - nearest.agreementWithVolo > NEIGHBOUR_JUMP;
}

/**
 * The longest submitter note kept, in characters.
 *
 * The same limit functions/api/submit.js applies when it writes the note into
 * the issue, so the corpus never cuts something the issue kept whole. It still
 * has work to do: an issue opened by hand never passes through that endpoint,
 * and a GitHub issue body holds sixteen times this.
 *
 * A note that hits it is truncated and said to be, because a silently
 * shortened sentence reads as a complete one and can reverse its own meaning.
 * The longest anyone has written is 645 characters.
 */
export const NOTE_MAX = 4000;

/**
 * Lines the tooling wrote into the Notes box, rather than the submitter.
 *
 * GitHub fills an empty field with "_No response_", the site signs what it
 * forwards, and one order was reprocessed by hand with a line saying so. None
 * of that is what a person typed, and keeping it would mean every silent
 * submission carries a note that says nothing.
 *
 * Matched by phrase rather than by "any line in italics" on purpose. The
 * general rule also eats a line holding nothing but a pak name, because pak
 * names are full of underscores, and losing a submitter's words is worse than
 * keeping one of our own footers. A new footer has to be added here.
 */
const MACHINE_LINE =
  /^\s*_(?:No response|Submitted through [^\n_]*|Reprocessed after [^\n_]*)_\s*$/;

/**
 * The Notes field of a submission issue, or null when nobody wrote one.
 *
 * What a submitter says about their own order is the only part of a submission
 * nothing else records. Issue #130 reported that one mod interferes with
 * another, which no amount of reading the order itself would reveal, and until
 * this existed that sentence lived only in the issue thread.
 *
 * Personal paths are stripped here as well as at intake. The note is free text
 * from a stranger and lands in a file published under CC0, so it gets the same
 * treatment as the order: see client/src/lib/scrub.ts for why this pattern is
 * repeated rather than shared, and scripts/smoke-test.mjs for the check that
 * every copy stays in step.
 */
export function noteFromIssueBody(body) {
  const section = String(body ?? '')
    .match(/^###[ \t]+Notes[ \t]*$([\s\S]*?)(?=^###[ \t]|$(?![\s\S]))/m);
  if (!section) return null;

  const written = section[1]
    .split('\n')
    .filter(line => !MACHINE_LINE.test(line))
    .join('\n')
    .trim();
  if (!written) return null;

  const scrubbed = written
    .replace(/(?<![A-Za-z0-9])[A-Za-z]:\\(?:[^\\\t"\r\n]*\\)*([^\\\t"\r\n]+)/g, '$1')
    .replace(/(?<![A-Za-z0-9])\/(?:home|Users)\/[^/\t"\r\n]+\/(?:[^/\t"\r\n]*\/)*([^/\t"\r\n]+)/g, '$1');

  return scrubbed.length > NOTE_MAX
    ? `${scrubbed.slice(0, NOTE_MAX)} [truncated]`
    : scrubbed;
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
