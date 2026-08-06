#!/usr/bin/env node
/**
 * Turns a load order submission into corpus and masterlist changes.
 *
 *   node scripts/process-submission.mjs --body <file> --number <issue> [--report <file>]
 *
 * The body file is the raw text of a submission issue created from the
 * submit-load-order template. The script:
 *
 *   1. pulls the JSON out of the issue body (pasted block or attachment URL)
 *   2. validates it with the same parser the app uses
 *   3. rejects duplicates of orders already in the corpus
 *   4. writes it into the corpus under the naming convention that drives the
 *      working and broken labels
 *   5. regenerates the masterlist, relearns the category order, reruns
 *      verification
 *   6. writes a report of exactly what changed, for the pull request body
 *
 * Exit codes: 0 accepted, 1 rejected (reason on stdout and in the report),
 * 2 usage or environment error. Rejection is not failure; the report says why
 * so the workflow can post it back to the submitter.
 */

import { execSync } from 'child_process';
import { build } from 'esbuild';
import crypto from 'crypto';
import { writeProvenance, judge } from './corpus-provenance.mjs';
import fs from 'fs';
import os from 'os';
import path from 'path';

const CORPUS = 'Load Orders - Public Submitted';

/** Command line */
const args = process.argv.slice(2);
const opt = (name, fallback = null) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
};
const bodyFile = opt('body');
const issueNumber = opt('number');
const reportFile = opt('report', 'submission-report.md');
const gateFile = opt('gate', 'submission-gate.json');

/**
 * How far agreement with working orders may fall before a submission needs a
 * human. Small movements are noise, since adding an order also changes the
 * set being measured; a real regression is much larger than this.
 */
const MAX_AGREEMENT_DROP = 1.0;

if (!bodyFile || !issueNumber || !fs.existsSync(bodyFile)) {
  console.error('usage: node scripts/process-submission.mjs --body <file> --number <issue> [--report <file>]');
  process.exit(2);
}

const body = fs.readFileSync(bodyFile, 'utf8');

/**
 * The gate file tells the workflow what to do with the result: land it
 * straight on main, or open a pull request and wait for a person. Anything
 * that is not a clean, metric-preserving working order waits.
 */
function finish(accepted, lines, gate = {}) {
  const text = lines.join('\n') + '\n';
  fs.writeFileSync(reportFile, text);
  fs.writeFileSync(gateFile, JSON.stringify({ accepted, autoMerge: false, ...gate }, null, 2));
  console.log(text);
  process.exit(accepted ? 0 : 1);
}

/** Pairwise agreement against working orders, the metric the sort is judged on. */
function measureAgreement() {
  let out;
  try {
    out = execSync('node scripts/verify-order.mjs', { encoding: 'utf8' });
  } catch (err) {
    out = err.stdout ?? '';
  }
  const m = out.match(/working orders\s+n=(\d+)\s+VOLO\s+([\d.]+)%/);
  return {
    text: out.slice(out.indexOf('=== SUMMARY ===')),
    orders: m ? Number(m[1]) : null,
    agreement: m ? Number(m[2]) : null,
  };
}

/** Step 1: status, from the dropdown answer the template guarantees. */
const working = /working, i have played on it/i.test(body);
const broken = /not working, it has problems/i.test(body);
if (!working && !broken) {
  finish(false, ['## Submission rejected', '', 'Could not read the working or not working answer from the issue.']);
}

// Step 2: the order itself. Prefer a fenced block; fall back to an attachment.
async function extractOrderText() {
  const fence = body.match(/```(?:json)?\s*\n([\s\S]*?)```/);
  if (fence && fence[1].trim().length > 2) return fence[1];

  const attachment = body.match(
    /https:\/\/(?:github\.com\/user-attachments\/files|user-images\.githubusercontent\.com)[^\s)"']+/,
  );
  if (attachment) {
    const res = await fetch(attachment[0], { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`attachment fetch failed: ${res.status}`);
    return await res.text();
  }
  // Last resort: the body may simply contain raw JSON.
  const braced = body.match(/\{[\s\S]*\}/);
  return braced ? braced[0] : null;
}

/**
 * Strips absolute Windows paths out of a submission.
 *
 * BG3MM writes the full path of a pak into the FileName column for some
 * entries, which carries the submitter's Windows account name with it. The
 * corpus is published under CC0, so anything left here is published under
 * someone's name without them ever choosing to. Only the file name is used.
 *
 * Backslashes only. Allowing forward slashes as well makes "https://host/a/b"
 * match the drive-letter pattern, and rewriting a mod's URL is its own kind of
 * damage. A Windows path uses backslashes; a URL never does.
 */
function stripLocalPaths(text) {
  // Null when nothing was found; the caller reports that more usefully than a
  // TypeError would.
  if (!text) return text;
  return text
    .replace(/(?<![A-Za-z0-9])[A-Za-z]:\\(?:[^\\\t"\r\n]*\\)*([^\\\t"\r\n]+)/g, '$1')
    .replace(/\/(?:home|Users)\/[^/\t"\r\n]+\/(?:[^/\t"\r\n]*\/)*([^/\t"\r\n]+)/g, '$1');
}

let orderText;
try {
  orderText = stripLocalPaths(await extractOrderText());
} catch (err) {
  finish(false, ['## Submission rejected', '', `Could not retrieve the order: ${err.message}`]);
}
if (!orderText) {
  finish(false, ['## Submission rejected', '', 'No load order found in the issue. Paste the JSON or attach the exported file.']);
}

/** Step 3: validate with the app parser, so intake and app agree on formats. */
const bundle = path.join(os.tmpdir(), `volo-intake-${process.pid}.mjs`);
await build({
  stdin: {
    contents: `
      export { parseLoadOrder } from './client/src/lib/parser';
      export { sortLoadOrder } from './client/src/lib/optimiser';
    `,
    resolveDir: process.cwd(),
    loader: 'ts',
  },
  bundle: true, format: 'esm', platform: 'node', outfile: bundle, logLevel: 'error',
});
const { parseLoadOrder, sortLoadOrder } = await import(`file://${bundle}`);
fs.rmSync(bundle, { force: true });

const parsed = parseLoadOrder(orderText, 'submission.json');
if (parsed.errors.length || parsed.mods.length < 5) {
  finish(false, [
    '## Submission rejected',
    '',
    parsed.errors.length ? `Parse errors:` : `Only ${parsed.mods.length} mods could be read; five is the minimum.`,
    ...parsed.errors.map(e => `- ${e}`),
  ]);
}

/** Step 4: reject exact duplicates, using the same fingerprint as the miner. */
const fingerprint = list =>
  crypto.createHash('md5').update(list.map(m => m.uuid || m.name).join('|')).digest('hex');

const submitted = fingerprint(parsed.mods);
for (const f of fs.readdirSync(CORPUS)) {
  let existing;
  try {
    const raw = fs.readFileSync(path.join(CORPUS, f), 'utf8');
    const p = parseLoadOrder(raw, f);
    if (p.mods.length) existing = fingerprint(p.mods);
  } catch { continue; }
  if (existing === submitted) {
    finish(false, ['## Submission rejected', '', `This exact order is already in the corpus as \`${f}\`.`]);
  }
}

/**
 * Step 5: file it. The filename prefix is what labels it for every downstream
 * script, so the convention is the contract.
 */
const stamp = new Date().toISOString().slice(0, 10);
const prefix = working ? 'working' : 'not_working';
const ext = orderText.trimStart().startsWith('<?xml') ? 'lsx' : 'json';
const filename = `${prefix}_issue-${issueNumber}_${stamp}.${ext}`;

const before = JSON.parse(fs.readFileSync('masterlist/bg3-masterlist.json', 'utf8'));
const knownBefore = new Set(before.plugins.map(p => p.uuid));

/**
 * How closely the submitted sequence matches what VOLO would produce for it.
 *
 * The same pairwise measure the evaluation scripts use, so the numbers mean the
 * same thing. Near 1 says the order is VOLO's own output returning, because the
 * sort is deterministic and a person arranging several hundred mods by hand
 * does not reproduce it.
 */
function agreementWithVolo() {
  const reference = parsed.mods.map(m => m.uuid);
  const rank = new Map(reference.map((u, i) => [u, i]));
  const sorted = sortLoadOrder(parsed.mods, before).mods.map(m => m.uuid);
  const seq = sorted.filter(u => rank.has(u)).map(u => rank.get(u));

  let concordant = 0;
  let total = 0;
  for (let i = 0; i < seq.length; i++) {
    for (let j = i + 1; j < seq.length; j++) {
      total++;
      if (seq[i] < seq[j]) concordant++;
    }
  }
  return total ? concordant / total : null;
}

/**
 * What the submitter said about how the order was arranged.
 *
 * Absent when the issue predates the question or nobody answered, which is
 * treated as unknown rather than as either answer.
 */
const declared = /sorted (?:it )?with volo/i.test(body) ? 'volo'
  : /arranged (?:it )?myself|my own order/i.test(body) ? 'self'
    : 'unknown';

const matchesVolo = agreementWithVolo();

/** Measure before the order exists, so its effect on the metric is knowable. */
const baseline = measureAgreement();

fs.writeFileSync(path.join(CORPUS, filename), orderText.trim() + '\n');

// Recorded before mining, so the miner sees it on the very first pass and never
// reads a VOLO-sorted order as evidence of where mods belong.
writeProvenance(filename, {
  declared,
  agreementWithVolo: matchesVolo === null ? null : Math.round(matchesVolo * 1000) / 1000,
  sortedByVolo: judge({ declared, agreementWithVolo: matchesVolo }),
});

// Step 6: regenerate everything and capture the verification numbers.
execSync('node scripts/mine-corpus.mjs', { stdio: 'pipe' });
execSync('node scripts/learn-category-order.mjs', { stdio: 'pipe' });
fs.copyFileSync('masterlist/bg3-masterlist.json', path.join('public', 'bg3-masterlist.json'));
const after = measureAgreement();
const summary = after.text;

const delta = baseline.agreement !== null && after.agreement !== null
  ? Number((after.agreement - baseline.agreement).toFixed(2))
  : null;

/**
 * Auto-merge only what a reviewer would wave through anyway: a working order
 * that leaves agreement intact. Broken orders always wait for a person. Their
 * value is the written explanation of what went wrong, which only a human can
 * act on, and the caution flags they raise are shown to users as warnings.
 */
const metricHeld = delta !== null && delta >= -MAX_AGREEMENT_DROP;
const autoMerge = working && metricHeld;
const gate = {
  working,
  agreementBefore: baseline.agreement,
  agreementAfter: after.agreement,
  delta,
  autoMerge,
  heldBecause: autoMerge
    ? null
    : !working
      ? 'a broken order needs a human read'
      : delta === null
        ? 'the verification numbers could not be read'
        : `agreement fell ${Math.abs(delta)} points`,
};

/**
 * A broken order is worth more than a caution counter: read against the
 * working orders it usually says where it disagrees with orders that run.
 * That diagnosis is what the reviewer and the submitter actually need.
 */
let diagnosis = '';
if (!working) {
  try {
    diagnosis = execSync(
      `node scripts/diagnose-order.mjs ${JSON.stringify(path.join(CORPUS, filename))}`,
      { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 },
    );
  } catch (err) {
    diagnosis = `Diagnosis could not be produced: ${err.message.split('\n')[0]}`;
  }
}

const afterList = JSON.parse(fs.readFileSync('masterlist/bg3-masterlist.json', 'utf8'));
const newMods = afterList.plugins.filter(p => !knownBefore.has(p.uuid));
const newUnsorted = newMods.filter(p => p.group === 'unsorted');
const cautionMods = afterList.plugins.filter(
  p => p.evidence.brokenInstalls > 0 && p.evidence.workingInstalls === 0,
);

finish(true, [
  `## Submission accepted: ${filename}`,
  '',
  `- Status: ${working ? 'working' : 'not working'}`,
  `- Mods in the order: ${parsed.mods.length} (format: ${parsed.format})`,
  `- Section headers found: ${parsed.sections.length}`,
  '',
  '### Masterlist changes',
  '',
  `- Mods known: ${before.plugins.length} to ${afterList.plugins.length} (${newMods.length} new)`,
  `- New mods still uncategorised: ${newUnsorted.length}`,
  `- Mods now seen only in broken orders: ${cautionMods.length}`,
  '',
  '### Effect on the metric',
  '',
  delta === null
    ? '- Agreement could not be measured.'
    : `- Agreement with working orders: ${baseline.agreement}% to ${after.agreement}% ` +
      `(${delta >= 0 ? '+' : ''}${delta})`,
  `- ${autoMerge
    ? 'Within tolerance, so this lands automatically.'
    : `Held for review: ${gate.heldBecause}.`}`,
  '',
  '### Verification after this submission',
  '',
  '```',
  summary.trim(),
  '```',
  '',
  ...(diagnosis ? [diagnosis.trim(), ''] : []),
  newMods.length
    ? '### New mods\n\n' + newMods.slice(0, 30).map(p => `- ${p.name} (${p.group})`).join('\n') +
      (newMods.length > 30 ? `\n- and ${newMods.length - 30} more` : '')
    : 'No new mods; this order refined evidence for mods already known.',
], gate);
