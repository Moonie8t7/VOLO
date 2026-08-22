/**
 * Split a mod description into the units an author actually writes advice in.
 *
 * The previous pass split on sentence punctuation, which is an engineering
 * convenience rather than a unit of meaning. Descriptions are written as
 * headings, bullets, table rows and line-separated instructions, and advice
 * routinely spans what a full stop would call two sentences, or occupies a
 * bullet with no full stop at all. Splitting that way creates a recall problem
 * nobody can see, because the evidence never becomes a candidate.
 *
 * A segment keeps its raw source, its offsets, the heading above it and any
 * mod links inside it, because cleaning BBCode destroys exactly the
 * relationships that decide what a sentence refers to.
 */

/** BBCode and HTML block boundaries, in the forms Nexus descriptions use. */
const BLOCK_SPLIT = /(?:<br\s*\/?>\s*){2,}|\n{2,}|(?=\[\*\])|(?:<\/(?:p|div|li|tr|h[1-6])>)|(?:\[\/(?:list|table|quote)\])/gi;

const HEADING = /\[(?:b|size|h[1-6])[^\]]*\]([^[]{2,80})\[\/(?:b|size|h[1-6])\]|<h[1-6][^>]*>([^<]{2,80})<\/h[1-6]>/i;
const MOD_LINK = /nexusmods\.com\/baldursgate3\/mods\/(\d+)/gi;

export function clean(raw) {
  return String(raw ?? '')
    .replace(/\[url=([^\]]+)\]([^[]*)\[\/url\]/gi, '$2')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/\[\*\]/g, ' ')
    .replace(/\[\/?[a-z][^\]]*\]/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Segments of one description, in order, each carrying where it came from.
 *
 * Offsets are into the raw description, so any segment can be widened back out
 * to as much surrounding source as a reader needs.
 */
export function segments(description) {
  const raw = String(description ?? '');
  const out = [];
  let cursor = 0;
  let heading = '';

  const pieces = [];
  let last = 0;
  for (const m of raw.matchAll(BLOCK_SPLIT)) {
    if (m.index > last) pieces.push([last, m.index]);
    last = m.index + (m[0]?.length ?? 0);
  }
  if (last < raw.length) pieces.push([last, raw.length]);

  for (const [start, end] of pieces) {
    const source = raw.slice(start, end);
    const text = clean(source);
    cursor = end;
    if (!text) continue;

    /* A short bold or sized run on its own is a heading for what follows. */
    const h = source.match(HEADING);
    if (h && text.length <= 80 && clean(h[1] ?? h[2] ?? '') === text) {
      heading = text;
      continue;
    }

    out.push({
      start,
      end,
      heading,
      text,
      source,
      links: [...new Set([...source.matchAll(MOD_LINK)].map(m => Number(m[1])))],
    });
  }
  return out;
}

/** Raw source around a segment, for a reader who needs more than the segment. */
export function excerpt(description, seg, pad = 700) {
  const raw = String(description ?? '');
  return clean(raw.slice(Math.max(0, seg.start - pad), Math.min(raw.length, seg.end + pad)));
}
