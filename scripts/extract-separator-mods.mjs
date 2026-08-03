#!/usr/bin/env node
/**
 * Reads load order divider paks and emits the UUID and name of each.
 *
 * The active set is Astra's Load Order Dividers, made by Astralities for their
 * own playthroughs and used here with permission; credit is required wherever
 * they surface.
 *
 * Why this matters: those paks are widely used to divide a load order into named
 * sections. When a submitted order contains them we can recognise the section
 * boundaries by UUID, exactly, instead of pattern-matching whatever dashes and
 * pipes the submitter happened to type. Exact beats heuristic.
 *
 * A pak is an LSPK archive. For these files the metadata sits in a single LZ4
 * block right after the header, so a minimal block decompressor is enough. We do
 * not need general pak support, and deliberately do not implement it.
 *
 *   node scripts/extract-separator-mods.mjs [dir]
 */

import fs from 'fs';
import path from 'path';

const DEFAULT_DIR = path.join('Supporting Docs', 'Sorting Category Empty Mods');

/**
 * LZ4 block format decompressor.
 *
 * Each sequence is a token byte: high nibble is literal length, low nibble is
 * match length. A nibble of 15 means "read more length bytes until one is not
 * 255". Matches are copied byte by byte from earlier in the output, because
 * overlapping copies are legal and are how LZ4 encodes runs.
 */
function lz4Decompress(src, start, maxOut) {
  const out = Buffer.alloc(maxOut);
  let i = start;
  let o = 0;

  while (i < src.length && o < maxOut) {
    const token = src[i++];

    let literalLen = token >> 4;
    if (literalLen === 15) {
      let more;
      do { more = src[i++]; literalLen += more; } while (more === 255 && i < src.length);
    }

    if (literalLen > 0) {
      if (i + literalLen > src.length) { src.copy(out, o, i, src.length); o += src.length - i; break; }
      src.copy(out, o, i, i + literalLen);
      i += literalLen;
      o += literalLen;
    }

    // A block ends after its final literal run, with no match to follow.
    if (i >= src.length - 1) break;

    const offset = src[i] | (src[i + 1] << 8);
    i += 2;
    if (offset === 0 || offset > o) break; // malformed, stop rather than loop

    let matchLen = token & 0x0f;
    if (matchLen === 15) {
      let more;
      do { more = src[i++]; matchLen += more; } while (more === 255 && i < src.length);
    }
    matchLen += 4; // LZ4 minimum match

    let from = o - offset;
    for (let n = 0; n < matchLen && o < maxOut; n++) out[o++] = out[from++];
  }

  return out.subarray(0, o);
}

/** Pull the mod UUID and name out of a decompressed meta.lsx. */
function parseMeta(xml) {
  const decode = (v) => v
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
  const attr = (id) => {
    const re = new RegExp(`<attribute[^>]*id="${id}"[^>]*value="([^"]*)"`, 'i');
    const m = xml.match(re);
    return m ? decode(m[1]) : null;
  };
  // Some writers put type before value; try the reversed order too.
  const attrAlt = (id) => {
    const re = new RegExp(`<attribute[^>]*value="([^"]*)"[^>]*id="${id}"`, 'i');
    const m = xml.match(re);
    return m ? m[1] : null;
  };
  return {
    uuid: attr('UUID') ?? attrAlt('UUID'),
    name: attr('Name') ?? attrAlt('Name'),
    folder: attr('Folder') ?? attrAlt('Folder'),
  };
}

const dir = process.argv[2] ?? DEFAULT_DIR;
if (!fs.existsSync(dir)) {
  console.error(`Not found: ${dir}`);
  process.exit(1);
}

const results = [];
const failures = [];

for (const file of fs.readdirSync(dir).sort()) {
  if (!file.toLowerCase().endsWith('.pak')) continue;
  const buf = fs.readFileSync(path.join(dir, file));

  if (buf.subarray(0, 4).toString('ascii') !== 'LSPK') {
    failures.push([file, 'not an LSPK archive']);
    continue;
  }

  // The XML begins with a UTF-8 BOM. Some packers store the metadata as plain
  // uncompressed text; others LZ4 it. Try plaintext first, since it is
  // unambiguous, and fall back to walking back to the LZ4 token boundary.
  const bom = buf.indexOf(Buffer.from([0xef, 0xbb, 0xbf]));
  if (bom < 2) { failures.push([file, 'no metadata found']); continue; }

  let xml;
  const xmlStart = buf.indexOf(Buffer.from('<?xml'));
  const xmlEnd = buf.indexOf(Buffer.from('</save>'));
  if (xmlStart !== -1 && xmlEnd > xmlStart) {
    xml = buf.subarray(xmlStart, xmlEnd + 7).toString('utf8');
  } else {
    let tokenAt = bom - 1;
    while (tokenAt > 0 && buf[tokenAt] === 255) tokenAt--;
    if ((buf[tokenAt] >> 4) !== 15) tokenAt = bom - 1;
    while (tokenAt > 0 && (buf[tokenAt] >> 4) !== 15) tokenAt--;
    xml = lz4Decompress(buf, tokenAt, 64 * 1024).toString('utf8');
  }
  const meta = parseMeta(xml);

  if (!meta.uuid) { failures.push([file, 'no UUID in metadata']); continue; }
  results.push({ file, ...meta });
}

console.log(`separator paks read: ${results.length}`);
if (failures.length) {
  console.log(`failed: ${failures.length}`);
  for (const [f, why] of failures) console.log(`  ${f}: ${why}`);
}

console.log('');
for (const r of results) {
  console.log(`${(r.name || '?').padEnd(34)} ${r.uuid}`);
}

fs.mkdirSync('masterlist', { recursive: true });
fs.writeFileSync(
  path.join('masterlist', 'separator-mods.json'),
  JSON.stringify(
    {
      description:
        'Load order divider paks, recognised by UUID so section boundaries ' +
        'are exact on import and insertable on export.',
      source: "Astra's Load Order Dividers",
      credit: 'Made by Astralities, used with permission.',
      creditUrl: 'https://forums.nexusmods.com/profile/106303673-astralities/',
      separators: results.map(r => ({ uuid: r.uuid, name: r.name, folder: r.folder })),
    },
    null, 2,
  ) + '\n',
);
console.log('\nwrote masterlist/separator-mods.json');
