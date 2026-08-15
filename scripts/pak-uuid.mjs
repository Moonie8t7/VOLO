#!/usr/bin/env node
/**
 * Read a BG3 .pak's meta.lsx and print the mod's identity.
 *
 *   node pak-uuid.mjs <file.pak> [...]
 *
 * The UUID is the only identity that cannot be typed wrong, and a curated rule
 * naming somebody else's mod should use it rather than a name that two mods
 * might answer to. KAVT ships its pak as unique_tav.pak, which is exactly the
 * collision this avoids.
 *
 * LSPK v18: a header pointing at an LZ4-compressed file table, each entry 272
 * bytes, and file bodies that may themselves be LZ4. Only the byte ranges
 * needed are read, because these paks reach 600MB.
 */

import fs from 'fs';
import zlib from 'zlib';

/** LZ4 block decompression. No dependency exists here and the format is small. */
function lz4(src, expected) {
  const out = Buffer.alloc(expected);
  let s = 0, d = 0;
  while (s < src.length) {
    const token = src[s++];
    let literals = token >> 4;
    if (literals === 15) {
      let n;
      do { n = src[s++]; literals += n; } while (n === 255);
    }
    src.copy(out, d, s, s + literals);
    s += literals; d += literals;
    if (s >= src.length) break;
    const offset = src[s] | (src[s + 1] << 8);
    s += 2;
    let match = token & 0x0f;
    if (match === 15) {
      let n;
      do { n = src[s++]; match += n; } while (n === 255);
    }
    match += 4;
    let from = d - offset;
    for (let i = 0; i < match; i++) out[d++] = out[from++];
  }
  return out;
}

function readMeta(file) {
  const fd = fs.openSync(file, 'r');
  const read = (len, pos) => { const b = Buffer.alloc(len); fs.readSync(fd, b, 0, len, pos); return b; };
  try {
    const head = read(40, 0);
    if (head.slice(0, 4).toString() !== 'LSPK') return { error: 'not an LSPK archive' };
    const version = head.readUInt32LE(4);
    if (version !== 18) return { error: `unsupported pak version ${version}` };

    const listOffset = Number(head.readBigUInt64LE(8));
    const counts = read(8, listOffset);
    const numFiles = counts.readUInt32LE(0);
    const listCompressed = counts.readUInt32LE(4);

    const ENTRY = 272;
    const table = lz4(read(listCompressed, listOffset + 8), numFiles * ENTRY);

    for (let i = 0; i < numFiles; i++) {
      const at = i * ENTRY;
      const name = table.slice(at, at + 256).toString('latin1').replace(/\0.*$/, '');
      if (!/(^|\/)meta\.lsx$/i.test(name)) continue;

      const offset = table.readUInt32LE(at + 256) | (table.readUInt16LE(at + 260) * 0x100000000);
      const flags = table.readUInt8(at + 263);
      const onDisk = table.readUInt32LE(at + 264);
      const raw = table.readUInt32LE(at + 268);

      const body = read(onDisk, offset);
      const method = flags & 0x0f;
      /* 0 none, 1 zlib, 2 lz4. Both compressed forms appear across these paks. */
      const xml = method === 2 ? lz4(body, raw).toString('utf8')
        : method === 1 ? zlib.inflateSync(body).toString('utf8')
          : method === 0 ? body.toString('utf8')
            : null;
      if (xml === null) return { error: `meta.lsx uses compression method ${method}` };

      const attr = id => (xml.match(new RegExp(`<attribute id="${id}"[^>]*value="([^"]*)"`, 'i')) ?? [])[1];
      return {
        path: name,
        name: attr('Name'),
        folder: attr('Folder'),
        uuid: attr('UUID'),
        author: attr('Author'),
        version: attr('Version64') ?? attr('Version'),
      };
    }
    return { error: 'no meta.lsx in the archive' };
  } finally {
    fs.closeSync(fd);
  }
}

for (const file of process.argv.slice(2)) {
  const r = readMeta(file);
  const label = file.split(/[\\/]/).pop();
  if (r.error) console.log(`  ${label.padEnd(42)} ${r.error}`);
  else console.log(`  ${String(r.name ?? '?').slice(0, 40).padEnd(42)} ${r.uuid}   folder=${r.folder}`);
}
