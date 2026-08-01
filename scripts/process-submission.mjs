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
import fs from 'fs';
import os from 'os';
import path from 'path';

const CORPUS = 'Load Orders - Public Submitted';

// Command line
const args = process.argv.slice(2);
const opt = (name, fallback = null) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
};
const bodyFile = opt('body');
const issueNumber = opt('number');
const reportFile = opt('report', 'submission-report.md');

if (!bodyFile || !issueNumber || !fs.existsSync(bodyFile)) {
  console.error('usage: node scripts/process-submission.mjs --body <file> --number <issue> [--report <file>]');
  process.exit(2);
}

const body = fs.readFileSync(bodyFile, 'utf8');

function finish(accepted, lines) {
  const text = lines.join('\n') + '\n';
  fs.writeFileSync(reportFile, text);
  console.log(text);
  process.exit(accepted ? 0 : 1);
}

// Step 1: status, from the dropdown answer the template guarantees.
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

let orderText;
try {
  orderText = await extractOrderText();
} catch (err) {
  finish(false, ['## Submission rejected', '', `Could not retrieve the order: ${err.message}`]);
}
if (!orderText) {
  finish(false, ['## Submission rejected', '', 'No load order found in the issue. Paste the JSON or attach the exported file.']);
}

// Step 3: validate with the app parser, so intake and app agree on formats.
const bundle = path.join(os.tmpdir(), `volo-intake-${process.pid}.mjs`);
await build({
  stdin: {
    contents: `export { parseLoadOrder } from './client/src/lib/parser';`,
    resolveDir: process.cwd(),
    loader: 'ts',
  },
  bundle: true, format: 'esm', platform: 'node', outfile: bundle, logLevel: 'error',
});
const { parseLoadOrder } = await import(`file://${bundle}`);
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

// Step 4: reject exact duplicates, using the same fingerprint as the miner.
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

// Step 5: file it. The filename prefix is what labels it for every downstream
// script, so the convention is the contract.
const stamp = new Date().toISOString().slice(0, 10);
const prefix = working ? 'working' : 'not_working';
const filename = `${prefix}_issue-${issueNumber}_${stamp}.json`;

const before = JSON.parse(fs.readFileSync('masterlist/bg3-masterlist.json', 'utf8'));
const knownBefore = new Set(before.plugins.map(p => p.uuid));

fs.writeFileSync(path.join(CORPUS, filename), orderText.trim() + '\n');

// Step 6: regenerate everything and capture the verification numbers.
execSync('node scripts/mine-corpus.mjs', { stdio: 'pipe' });
execSync('node scripts/learn-category-order.mjs', { stdio: 'pipe' });
fs.copyFileSync('masterlist/bg3-masterlist.json', path.join('public', 'bg3-masterlist.json'));
const verify = execSync('node scripts/verify-order.mjs', { encoding: 'utf8' });
const summary = verify.slice(verify.indexOf('=== SUMMARY ==='));

const after = JSON.parse(fs.readFileSync('masterlist/bg3-masterlist.json', 'utf8'));
const newMods = after.plugins.filter(p => !knownBefore.has(p.uuid));
const newUnsorted = newMods.filter(p => p.group === 'unsorted');
const cautionMods = after.plugins.filter(
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
  `- Mods known: ${before.plugins.length} to ${after.plugins.length} (${newMods.length} new)`,
  `- New mods still uncategorised: ${newUnsorted.length}`,
  `- Mods now seen only in broken orders: ${cautionMods.length}`,
  '',
  '### Verification after this submission',
  '',
  '```',
  summary.trim(),
  '```',
  '',
  newMods.length
    ? '### New mods\n\n' + newMods.slice(0, 30).map(p => `- ${p.name} (${p.group})`).join('\n') +
      (newMods.length > 30 ? `\n- and ${newMods.length - 30} more` : '')
    : 'No new mods; this order refined evidence for mods already known.',
]);
