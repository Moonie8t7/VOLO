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

/**
 * GitHub's own attachment hosts, the only places an order is ever fetched
 * from. The issue body is public text anyone can write, so an unrestricted
 * fetch would let a stranger point this workflow at any address it can reach.
 */
const ATTACHMENT_URL =
  /https:\/\/(?:github\.com\/user-attachments\/(?:files|assets)|user-images\.githubusercontent\.com|objects\.githubusercontent\.com)\/[^\s)"'\]]+/g;

/** A fetched attachment larger than this is not a load order. */
const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;

/** Below this an order teaches nothing worth the round trip. */
const MIN_ENTRIES = 5;

/**
 * Above this it is not a load order, whatever it claims to be.
 *
 * The endpoint caps entries too, but an issue opened by hand with a file
 * attached never passes through it, and the agreement measure compares every
 * pair: 6,000 entries is 18 million comparisons and finishes in under a
 * second, while 300,000 is 45 billion and holds a runner until Actions kills
 * it six hours later. Every other submission queues behind that on the shared
 * concurrency group, so one request would buy a day of silence. The largest
 * order ever submitted is 1,068 entries, so this leaves room for a list five
 * times bigger than anyone has actually played.
 */
const MAX_ENTRIES = 6000;

/**
 * Set when the order came from staging, carrying the entry count the site
 * recorded at submission. A fetch that returns a truncated body still parses,
 * and a short order looks like a legitimate small one, so the count is the
 * only thing that catches it.
 */
let staged = null;

async function fetchAttachment(url) {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(30_000),
    // An attachment link is a redirect to storage, and following it off
    // GitHub's hosts would defeat the allowlist above.
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`attachment fetch failed: ${res.status}`);
  if (!ATTACHMENT_URL.test(new URL(res.url).origin + new URL(res.url).pathname)) {
    ATTACHMENT_URL.lastIndex = 0;
    throw new Error('attachment redirected off GitHub');
  }
  ATTACHMENT_URL.lastIndex = 0;
  const size = Number(res.headers.get('content-length') ?? 0);
  if (size > MAX_ATTACHMENT_BYTES) throw new Error('attachment is too large to be a load order');
  const text = await res.text();
  if (text.length > MAX_ATTACHMENT_BYTES) throw new Error('attachment is too large to be a load order');
  return text;
}

/**
 * Step 2: the order itself, from wherever the submitter actually put it.
 *
 * Every candidate is tried in turn rather than trusting the first, because the
 * two ways this failed in the wild both looked like a populated fence. The
 * template invites dragging the export in, and GitHub turns that into a
 * markdown link, so the fence held `[MainOrder.json](https://...)`; another
 * submitter typed "See notes" in the box and attached the file below it. Both
 * parsed as an order and both failed, while the real order sat one candidate
 * further down the list.
 */
/**
 * Entries in an order as the submitting site counted them, or null.
 *
 * Deliberately counts rows rather than mods, mirroring functions/api/submit.js,
 * so the two ends of the transport are comparing the same quantity. The parsed
 * mod count is a different number and using it here rejected a real order:
 * see the truncation check below.
 */
function countRawEntries(text) {
  const trimmed = text.trim();
  if (trimmed.startsWith('<?xml')) return (trimmed.match(/ModuleShortDesc/g) ?? []).length;
  try {
    const data = JSON.parse(trimmed);
    const entries = Array.isArray(data) ? data : (data.Order ?? data.Mods ?? null);
    return Array.isArray(entries) ? entries.length : null;
  } catch {
    return null;
  }
}

async function orderCandidates() {
  const candidates = [];

  /*
   * A staged order comes first and alone. The site writes orders too large for
   * an issue body to storage and leaves this pointer, so when one is present
   * it is the submission, and falling back to anything else in the body would
   * mean landing an excerpt in place of the real list. The URL is matched
   * against this site's own route rather than scanned out of free text: the
   * body is public, and any URL a stranger writes would otherwise be fetched.
   */
  const pointer = body.match(
    /^Stored order:\s*(https:\/\/(?:volobg3\.com|[a-z0-9-]+\.pages\.dev)\/api\/submission\/[0-9a-f]{32})\s*$/m,
  );
  if (pointer) {
    const expectedEntries = Number((body.match(/^Entries:\s*(\d+)\s*$/m) ?? [])[1] ?? 0);
    const expectedDigest = (body.match(/^SHA-256:\s*([0-9a-f]{64})\s*$/m) ?? [])[1] ?? '';
    candidates.push(async () => {
      const res = await fetch(pointer[1], { signal: AbortSignal.timeout(30_000) });
      if (!res.ok) throw new Error(`staged order fetch failed: ${res.status}`);
      const text = await res.text();
      if (text.length > MAX_ATTACHMENT_BYTES) throw new Error('staged order is too large to be a load order');
      if (expectedDigest) {
        const actual = crypto.createHash('sha256').update(text).digest('hex');
        if (actual !== expectedDigest) {
          throw new Error('staged order does not match the checksum recorded when it was submitted');
        }
      }
      staged = {
        expectedEntries,
        digestVerified: Boolean(expectedDigest),
        rawEntries: countRawEntries(text),
      };
      return text;
    });
    return candidates;
  }

  const fence = body.match(/```(?:json)?\s*\n([\s\S]*?)```/);
  if (fence && fence[1].trim().length > 2) candidates.push(async () => fence[1]);

  for (const url of body.match(ATTACHMENT_URL) ?? []) {
    candidates.push(() => fetchAttachment(url));
  }

  // Last resort: the body may simply contain raw JSON.
  const braced = body.match(/\{[\s\S]*\}/);
  if (braced) candidates.push(async () => braced[0]);
  return candidates;
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
    .replace(/(?<![A-Za-z0-9])\/(?:home|Users)\/[^/\t"\r\n]+\/(?:[^/\t"\r\n]*\/)*([^/\t"\r\n]+)/g, '$1');
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

/*
 * The parser is the judge of which candidate held the order: a fence full of
 * prose and a fence holding a link both look populated, and only parsing tells
 * them apart from the real thing.
 */
let orderText = null;
let parsed = null;
const attempts = [];
for (const candidate of await orderCandidates()) {
  let text;
  try {
    text = stripLocalPaths(await candidate());
  } catch (err) {
    attempts.push(err.message);
    continue;
  }
  if (!text) continue;
  const result = parseLoadOrder(text, 'submission.json');
  if (result.mods.length > MAX_ENTRIES) {
    attempts.push(`${result.mods.length.toLocaleString()} entries, over the ${MAX_ENTRIES.toLocaleString()} limit`);
    continue;
  }
  if (!result.errors.length && result.mods.length >= MIN_ENTRIES) {
    /*
     * A staged order that arrives short was truncated in transit, and landing
     * it would quietly replace someone's list with the part that survived.
     *
     * Only reached when no checksum was recorded, because a checksum that
     * matches has already proved the bytes arrived whole and this can then
     * only be wrong. It counts rows rather than mods for the same reason: the
     * parser drops separators and engine modules, so a 958 entry order
     * carrying 119 hand-written section headers read as 839 and was refused
     * as truncated while its checksum matched exactly. Those headers are the
     * strongest evidence the corpus has, which made it the worst possible
     * order to turn away.
     */
    if (staged && !staged.digestVerified && staged.expectedEntries && staged.rawEntries !== null
      && staged.rawEntries < staged.expectedEntries * 0.9) {
      attempts.push(
        `staged order looks truncated: ${staged.rawEntries} entries read, ${staged.expectedEntries} were submitted`,
      );
      continue;
    }
    orderText = text;
    parsed = result;
    break;
  }
  attempts.push(result.errors[0] ?? `only ${result.mods.length} mods could be read`);
}

if (!parsed) {
  finish(false, [
    '## Submission rejected',
    '',
    attempts.length
      ? 'No load order could be read from this issue. What was tried:'
      : 'No load order found in the issue. Paste the export, or attach the file and leave the box empty.',
    ...attempts.map(a => `- ${a}`),
    '',
    'Attach the exported file to the issue, or paste its contents. Five mods is the minimum.',
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
