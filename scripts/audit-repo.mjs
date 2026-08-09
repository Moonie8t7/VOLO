#!/usr/bin/env node
/**
 * Audits every tracked file. Nothing is skipped.
 *
 *   node scripts/audit-repo.mjs
 *
 * Run as part of the test suite, because the failures it catches are the kind
 * nothing else notices: a schema the data promises but does not ship, a link
 * that stopped resolving, a credential pasted into a config, a submitter's
 * account name riding along inside a load order. Each of those has actually
 * happened in this repository.
 *
 * Coverage is reported rather than claimed, so a check that silently stops
 * examining files is visible as a drop in the count.
 *
 * Exit codes: 0 clean, 1 problems found.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const files = execSync('git ls-files', { encoding: 'utf8' }).split('\n').filter(Boolean);

/**
 * Punctuation the house style does not use.
 *
 * Written as escapes so this file contains none of the characters it hunts.
 * The first version held them literally, along with a literal NUL in the
 * binary check below, and that NUL made the auditor classify itself as binary
 * and skip its own audit. A checker that exempts itself is not a checker.
 */
const TELLS = {
  '\u2014': 'em dash',
  '\u2013': 'en dash',
  '\u201c': 'curly quote',
  '\u201d': 'curly quote',
  '\u2018': 'curly quote',
  '\u2019': 'curly apostrophe',
};

/**
 * The only characters outside ASCII that project-authored text may use.
 *
 * Everything this project writes is English prose and code, so a character
 * from outside that range is almost always damage: a keyboard slip, a paste
 * that carried its own punctuation, or a glyph from another script entirely.
 * A stray CJK character reached a documentation file and was caught by eye
 * rather than by anything here, which is the wrong way round. Each exception
 * below is deliberate and says why it exists; the punctuation tells above are
 * non-ASCII too, so they keep their own message rather than falling through
 * to this one.
 */
const ALLOWED_NON_ASCII = new Map([
  ['·', 'middle dot, separating links and splitting divider names'],
  ['✒', "black nib, opening every one of Astra's divider names"],
  ['︎', 'text variation selector, following that nib'],
  ['❧', "rotated floral heart, closing those divider names"],
]);

const SECRETS = [
  [/\bghp_[A-Za-z0-9]{20,}/, 'GitHub token'],
  [/\bgithub_pat_[A-Za-z0-9_]{20,}/, 'GitHub fine-grained token'],
  [/\bAKIA[0-9A-Z]{16}\b/, 'AWS access key'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'private key'],
  [/\bxox[baprs]-[A-Za-z0-9-]{10,}/, 'Slack token'],
  [/(?:api[_-]?key|secret|password)\s*[:=]\s*['"][^'"\s]{16,}['"]/i, 'assigned credential'],
];

/**
 * The lookbehinds match the scrubbers in client/src/lib/scrub.ts: a URL whose
 * path contains /Users/ is an address, not a person, and an auditor that
 * flags what the scrubber correctly leaves alone teaches people to ignore it.
 */
const PERSONAL = [
  [/(?<![A-Za-z0-9])[A-Za-z]:\\Users\\[A-Za-z0-9._-]+/, 'Windows user path'],
  [/(?<![A-Za-z0-9])\/(?:home|Users)\/[A-Za-z0-9._-]+\//, 'Unix home path'],
];

/**
 * Files reproducing somebody else's text verbatim.
 *
 * Mod names, descriptions and submitted orders carry whatever punctuation their
 * authors used, and altering a mod name breaks the match against what a user
 * has installed. House style applies to prose this project writes, not to data
 * it faithfully repeats.
 */
const VERBATIM = /^(Load Orders - Public Submitted|nexus\/|modio\/|masterlist\/(bg3-masterlist|external-categories)\.json|public\/(bg3-masterlist|external-categories)\.json)/;

/** Test fixtures deliberately contain the shapes the scrubbers must catch. */
const FIXTURES = /^scripts\/(smoke-test|audit-repo)\.mjs$/;

const stats = { tracked: files.length, binary: 0, text: 0, json: 0, markdown: 0, links: 0 };
const problems = [];
const note = (file, kind, detail = '') => problems.push({ file, kind, detail });

for (const file of files) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    note(file, 'unreadable');
    continue;
  }

  if (text.indexOf('\u0000') !== -1) { stats.binary++; continue; }
  stats.text++;

  /*
   * Stray control bytes in a text file. Four pattern tables in this repository
   * were corrupted by regex source passing through a string literal, which
   * turns a word boundary into a backspace byte, and the rules silently
   * matched nothing for months. Tab, newline and carriage return are text;
   * nothing else below 0x20 is.
   */
  const control = text.match(/[\u0001-\u0008\u000b\u000c\u000e-\u001f]/);
  if (control) {
    note(file, 'control character', `code ${control[0].charCodeAt(0)}`);
  }

  if (path.extname(file) === '.json') {
    stats.json++;
    try {
      JSON.parse(text);
    } catch (err) {
      note(file, 'invalid JSON', err.message.slice(0, 60));
    }
  }

  for (const [re, label] of SECRETS) if (re.test(text)) note(file, 'possible secret', label);

  if (!FIXTURES.test(file)) {
    for (const [re, label] of PERSONAL) {
      const hit = text.match(re);
      if (hit) note(file, 'personal data', `${label}: ${hit[0].slice(0, 40)}`);
    }
  }

  if (!VERBATIM.test(file)) {
    for (const [ch, label] of Object.entries(TELLS)) {
      if (text.includes(ch)) note(file, 'punctuation', label);
    }

    // Reported once per character rather than once per occurrence: a paste
    // that brought the wrong alphabet brings a lot of it.
    if (!FIXTURES.test(file)) {
      const strays = new Set(
        [...text].filter(ch =>
          ch.charCodeAt(0) > 127 && !ALLOWED_NON_ASCII.has(ch) && !(ch in TELLS)),
      );
      for (const ch of strays) {
        note(file, 'non-ascii', `${JSON.stringify(ch)} (U+${ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')})`);
      }
    }
  }

  if (path.extname(file) === '.md') {
    stats.markdown++;
    for (const m of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
      const target = m[1].split('#')[0];
      if (!target || /^(https?:|mailto:)/.test(target)) continue;
      stats.links++;
      if (!fs.existsSync(path.join(path.dirname(file), target))) note(file, 'broken link', target);
    }
  }

  // A schema the data promises must exist, or every consumer's tooling breaks.
  const declared = text.match(/"\$schema"\s*:\s*"(\.[^"]+)"/);
  if (declared && !fs.existsSync(path.join(path.dirname(file), declared[1]))) {
    note(file, 'missing schema', declared[1]);
  }
}

console.log('repository audit');
console.log(`  tracked files    ${stats.tracked}`);
console.log(`  binary skipped   ${stats.binary}`);
console.log(`  text audited     ${stats.text}`);
console.log(`  json parsed      ${stats.json}`);
console.log(`  markdown checked ${stats.markdown} (${stats.links} internal links)`);

if (!problems.length) {
  console.log('\n  ok    no problems across any tracked file');
  process.exit(0);
}

console.log(`\n  ${problems.length} problem(s):`);
for (const p of problems) console.log(`  FAIL  ${p.file}  ${p.kind}  ${p.detail}`);
process.exit(1);
