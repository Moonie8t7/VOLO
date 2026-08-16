#!/usr/bin/env node
/**
 * Carry one order's provenance record across a rebase onto a moved main.
 *
 *   node scripts/graft-provenance.mjs read  <corpus-filename>              > entry.json
 *   node scripts/graft-provenance.mjs write <corpus-filename> <entry.json>
 *
 * Landing a submission replays it onto whatever main holds by the time the
 * rebuild finishes. That works for the order file, which is new and therefore
 * always applies, and fails for provenance.json, because every submission adds
 * a record to the same sorted map. Two orders landing minutes apart collide on
 * lines neither of them means to disagree about, and `git apply` cannot tell
 * that from a real conflict.
 *
 * Issue #105 was lost exactly that way. It was validated, the submitter was
 * told so, and then #104, submitted five minutes earlier, landed first and
 * rewrote the map underneath it. The patch stopped applying, the run failed
 * after the comment had already gone out, and both safety nets read the comment
 * as proof that the order had been handled.
 *
 * The record is data rather than text, so it is carried by key and written onto
 * whichever version of the file is there. Nothing about the judgement changes:
 * this moves the entry intake already decided, rather than deriving a new one
 * against a masterlist that has since moved.
 */

import fs from 'fs';
import { readProvenance, writeProvenance } from './corpus-provenance.mjs';

const [mode, filename, entryPath] = process.argv.slice(2);

if (!mode || !filename) {
  console.error('usage: graft-provenance.mjs read|write <corpus-filename> [entry.json]');
  process.exit(2);
}

if (mode === 'read') {
  /* `null` rather than a failure when there is no record. Orders predating
   * provenance are legitimately absent, and absence means independent, so a
   * missing entry must not be able to strand a submission. */
  const entry = readProvenance()[filename] ?? null;
  process.stdout.write(`${JSON.stringify(entry)}\n`);
} else if (mode === 'write') {
  if (!entryPath) {
    console.error('write needs the file holding the entry');
    process.exit(2);
  }
  const entry = JSON.parse(fs.readFileSync(entryPath, 'utf8'));
  if (entry === null) {
    console.log(`no provenance recorded for ${filename}, nothing to graft`);
    process.exit(0);
  }
  writeProvenance(filename, entry);
  console.log(`grafted provenance for ${filename}`);
} else {
  console.error(`unknown mode ${mode}`);
  process.exit(2);
}
