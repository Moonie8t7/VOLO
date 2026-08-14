/**
 * Parses BG3 load order files entirely in the browser.
 *
 * Formats seen in real community submissions:
 *   {Order: [{UUID, Name}]}        BG3MM "export order", most common, no dependency data
 *   [{Index, FileName, UUID, ...}] BG3MM "export to file", includes dependencies
 *   {Mods: [...]}                  older BG3MM
 *   TSV/CSV                        Index/Name/Author/...
 *   plain text                     one mod per line
 */

import type { ImportedSection, Mod, ParseResult, ModRef } from './types';
import dividers from './dividers.json';
import engineModules from './engine-modules.json';

/**
 * Astra's Load Order Dividers, recognised by exact UUID. They are real paks a
 * user may have installed purely to section their order, so they are stripped
 * from the mod list and their labels reused as section hints, the same way
 * hand-typed dashed separators are.
 */
const DIVIDER_UUIDS = new Set<string>(dividers.uuids);

/** "decorated 047 . Skillset . Spells" style names reduced to their subject. */
function dividerLabel(name: string): string | null {
  const parts = name.split(String.fromCharCode(183)).map(p => p.trim());
  if (parts.length < 2) return null;
  const label = parts.slice(1).join(' ').replace(/[^\w &'()-]+/gu, ' ').replace(/\s+/g, ' ').trim();
  return label.length >= 2 ? label : null;
}

/**
 * Cosmetic dividers modders insert to section their orders. They are not mods,
 * but they ARE the community's own categorisation, so we keep them separately.
 *
 *   ---------------------------|   Spells   |---------------------------
 *   ] Armor [
 *   >             Jewelry
 *
 * The run of dashes has to open the name, close it, or be the whole of it.
 * Matching one anywhere deleted real mods: "Angel Wings And Halos ____ By Ren"
 * carries four underscores in the middle of its title and 264,623 downloads,
 * and every order holding it lost it silently, because a row read as a header
 * never becomes a mod, is never sorted, and is never written back out.
 * Checked against the whole corpus before changing: of 31,363 rows this
 * classifies every one exactly as the looser rule did.
 */
const SEPARATOR_RE = /^[\s\-=_~]*$|^\s*[-=_~]{4,}|[-=_~]{4,}\s*$|^\s*[\]>]\s*\S|^\s*\|.*\|\s*$/;

export function isSeparator(name: string): boolean {
  return SEPARATOR_RE.test(name);
}

/** Pull the human label out of a separator line, if there is one. */
export function sectionLabel(name: string): string | null {
  const piped = name.match(/\|([^|]{2,60})\|/);
  if (piped) return piped[1].trim();
  const bracketed = name.match(/\]\s*([^[\]]{2,60})\s*\[/);
  if (bracketed) return bracketed[1].trim();
  const stripped = name.replace(/[-=_~*#>\][|]{1,}/g, ' ').replace(/\s+/g, ' ').trim();
  return stripped.length >= 2 ? stripped : null;
}

/** Base-game packages that show up as list entries or dependencies but aren't mods. */
const ENGINE_MASTERS = new Set(engineModules.modules);

/**
 * Dependencies arrive as an array of objects in JSON exports, or as one
 * comma-separated string of names in TSV/CSV exports. Both matter: the
 * optimiser resolves name-only references against the mods present, so even
 * the string form yields real ordering constraints.
 */
function toModRefs(raw: unknown): ModRef[] | undefined {
  let refs: ModRef[];
  if (Array.isArray(raw)) {
    refs = raw
      .filter((d): d is Record<string, unknown> => !!d && typeof d === 'object')
      .map(d => ({ uuid: String(d.UUID ?? d.uuid ?? ''), name: String(d.Name ?? d.name ?? '') }));
  } else if (typeof raw === 'string') {
    refs = raw.split(',').map(s => ({ uuid: '', name: s.trim() }));
  } else {
    return undefined;
  }
  refs = refs.filter(d => d.name && !ENGINE_MASTERS.has(d.name));
  return refs.length ? refs : undefined;
}

function versionOf(raw: unknown): string | undefined {
  if (typeof raw === 'string') return raw || undefined;
  if (raw && typeof raw === 'object') {
    const v = (raw as Record<string, unknown>).Version;
    if (typeof v === 'string') return v || undefined;
  }
  return undefined;
}

/** Build a Mod from one entry of any recognised object format. */
function toMod(raw: Record<string, unknown>, index: number): Mod | null {
  const name = String(raw.Name ?? raw.name ?? '').trim();
  if (!name) return null;

  const uuid = normaliseUuid(raw.UUID ?? raw.uuid ?? raw.Uuid);
  const se = raw.ScriptExtenderData as Record<string, unknown> | undefined;
  const flags = Array.isArray(se?.FeatureFlags) ? (se!.FeatureFlags as string[]) : undefined;

  const verObj = raw.Version;
  const versionInt =
    verObj && typeof verObj === 'object' && (verObj as Record<string, unknown>).VersionInt != null
      ? String((verObj as Record<string, unknown>).VersionInt)
      : undefined;

  const fileName = str(raw.FileName ?? raw.fileName);

  return {
    /*
     * A pak filename carries the mod's real UUID, and BG3MM's TSV and CSV
     * exports have no UUID column at all, so without reading it every mod in
     * such a file gets a synthetic key. That key then goes out in the export,
     * where BG3MM cannot match it to anything installed: the mods land in the
     * inactive pane and every dependency declared by UUID reads as missing.
     * Both were reported from a real load order before this looked here.
     *
     * Nameless-but-real mods in hand-written lists still fall back to a
     * synthetic key, so they sort rather than silently collapsing together.
     */
    uuid: uuid || uuidFromFileName(fileName) || `name:${name.toLowerCase()}`,
    name,
    originalIndex: index,
    folder: str(raw.Folder ?? raw.folder),
    author: str(raw.Author ?? raw.author),
    version: versionOf(raw.Version ?? raw.version),
    description: str(raw.Description ?? raw.description),
    fileName,
    dependencies: toModRefs(raw.Dependencies ?? raw.dependencies),
    featureFlags: flags,
    version64: str(raw.Version64) ?? versionInt,
    md5: str(raw.MD5 ?? raw.md5),
    publishHandle: str(raw.PublishHandle),
  };
}

const str = (v: unknown): string | undefined => {
  const s = typeof v === 'string' ? v.trim() : '';
  return s || undefined;
};

/**
 * The UUID a pak filename ends with, when it ends with a whole one.
 *
 * BG3MM names a pak `<folder>_<uuid>.pak`. Only a complete UUID counts:
 * submitted files carry truncated and hand-edited tails as well, and half an
 * identifier matches nothing while looking like it should.
 */
/**
 * A UUID as an identity: trimmed and lower-cased.
 *
 * A UUID is hexadecimal and case carries no meaning, but every comparison in
 * this project is an exact string match, so case decides whether two records are
 * the same mod. The filename reader has always lower-cased what it extracts; the
 * UUID field was only trimmed, so one export writing them upper-case agreed with
 * nothing. Re-parsing a real 1,488-mod order with its UUIDs upper-cased produced
 * 1,488 identities and none of them matched the original.
 *
 * Nothing in the corpus does this today. It is one exporter away from being the
 * whole corpus, and a passing build would not mention it.
 */
function normaliseUuid(raw: unknown): string {
  return String(raw ?? '').trim().toLowerCase();
}

function uuidFromFileName(fileName: string | undefined): string | undefined {
  if (!fileName) return undefined;
  const m = fileName.match(
    /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\.pak)?$/i,
  );
  return m ? m[1].toLowerCase() : undefined;
}

/** Walk a list of raw entries, splitting mods from section headers. */
function collect(entries: unknown[], format: string): ParseResult {
  const mods: Mod[] = [];
  const sections: ImportedSection[] = [];
  const warnings: string[] = [];
  const seen = new Map<string, number>();

  for (const raw of entries) {
    if (!raw || typeof raw !== 'object') continue;
    const rec = raw as Record<string, unknown>;
    const name = String(rec.Name ?? rec.name ?? '').trim();
    if (!name) continue;

    // The base game ships as modules and some managers export them in the
    // list. They are not mods and always load first, so sorting them is
    // wrong; drop them the way the modsettings parser already does.
    if (ENGINE_MASTERS.has(name)) continue;

    /*
     * The identity is settled before the entry is judged, not after.
     *
     * This read only the UUID field, which a thin export leaves empty, so a
     * divider from such a file was taken for a mod and sorted into a group.
     * The pak filename carries the same identifier and toMod already knew how
     * to read it, so the two halves of this file disagreed about what a
     * divider was. Case is folded because an export is free to write a UUID in
     * either, and only this side was ever comparing them verbatim.
     */
    const rawUuid = normaliseUuid(rec.UUID ?? rec.uuid)
      || uuidFromFileName(str(rec.FileName ?? rec.fileName))
      || '';
    if (rawUuid && DIVIDER_UUIDS.has(rawUuid)) {
      // Users can rename dividers in their manager, so prefer the canonical
      // pak name and only then fall back to whatever the file says.
      const canonical = (dividers.names as Record<string, string | undefined>)[rawUuid];
      const label = (canonical ? dividerLabel(canonical) : null) ?? dividerLabel(name);
      // The uuid and the name exactly as written, so the export can hand the
      // user back the dividers they arrived with rather than a different
      // author's set they may not own.
      if (label) sections.push({ label, afterIndex: mods.length, uuid: rawUuid, name });
      continue;
    }

    if (isSeparator(name)) {
      const label = sectionLabel(name);
      // A divider pak from any set, not only the one this project catalogues,
      // is recognised here by its name and still carries a uuid worth keeping.
      if (label) {
        sections.push({
          label,
          afterIndex: mods.length,
          // The text is kept whether or not the row carried a uuid. Only the
          // export needs the pair, and it still tests for both, but a
          // submission has to be able to put a hand-typed header back exactly
          // as it was written, and those are the headers with no uuid at all.
          name,
          ...(rawUuid ? { uuid: rawUuid } : {}),
        });
      }
      continue;
    }

    const mod = toMod(rec, mods.length);
    if (!mod) continue;

    const prior = seen.get(mod.uuid);
    if (prior !== undefined) {
      warnings.push(`Duplicate entry "${mod.name}" appears twice. Keeping the first occurrence.`);
      continue;
    }
    seen.set(mod.uuid, mods.length);
    mods.push(mod);
  }

  return { mods, sections, format, warnings, errors: [] };
}

function parseDelimited(content: string, delim: string, format: string): ParseResult {
  const lines = content.split(/\r?\n/).filter(l => l.trim());
  if (!lines.length) return empty(format, ['File is empty.']);

  const header = lines[0].split(delim).map(h => h.trim().replace(/^"|"$/g, ''));
  const looksLikeHeader = header.some(h => /^(name|uuid|filename|author)$/i.test(h));

  const rows = looksLikeHeader ? lines.slice(1) : lines;
  const keys = looksLikeHeader ? header : ['Name'];

  const entries = rows.map(line => {
    const cells = line.split(delim).map(c => c.trim().replace(/^"|"$/g, ''));
    const rec: Record<string, unknown> = {};
    keys.forEach((k, i) => { rec[k] = cells[i]; });
    return rec;
  });

  return collect(entries, format);
}

function parseText(content: string): ParseResult {
  const entries = content
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#') && !l.startsWith('//'))
    .map(line => {
      // Hand-written and exported lists number their lines: "37. Mod Name".
      // Strip the numbering or nothing matches the masterlist by name.
      let clean = line.replace(/^\d+\s*[.)]\s*/, '');
      // BG3MM's text export appends the pak: "Mod Name (modname_ab12.pak)".
      clean = clean.replace(/\s*\([^()]*\.pak\)\s*$/i, '');
      // "Mod Name [1.0.0]" or "Mod Name (1.0.0)". Only version-shaped
      // suffixes are split off: parentheses are common in real mod names
      // ("ImpUI (ImprovedUI)"), and guessing author strips those.
      const m = clean.match(/^(.+?)\s*[[(](v?[\d.]+)[\])]\s*$/);
      return m ? { Name: m[1].trim(), Version: m[2].trim() } : { Name: clean };
    });
  return collect(entries, 'Plain text');
}

const empty = (format: string, errors: string[]): ParseResult =>
  ({ mods: [], sections: [], format, warnings: [], errors });

/**
 * Entity decoding for attribute values; &amp; must come last.
 *
 * Numeric entities cover decimal and hex, decoded with fromCodePoint because
 * fromCharCode truncates anything above the basic plane: a mod name containing
 * an emoji would round-trip as a lone surrogate and never match anything.
 */
const decodeXml = (s: string) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, '&');

/**
 * modsettings.lsx is the game's own load order file, the one BG3 reads at
 * launch. Every modded install has it regardless of manager, and for users of
 * the official in-game manager it is the only exportable format there is.
 *
 * The file is rigid machine-written XML, so a small attribute walker is enough
 * and works identically in the browser and in node, where DOMParser does not
 * exist. Structure, for reference:
 *
 *   <node id="ModuleShortDesc">
 *     <attribute id="UUID" value="..."/>
 *     <attribute id="Name" value="..."/>
 *     <attribute id="Folder" value="..."/>
 *   </node>
 */
function parseModsettings(content: string): ParseResult {
  const blocks = content.split(/<node\s+id="ModuleShortDesc"/).slice(1);
  if (!blocks.length) {
    return empty('modsettings.lsx', [
      'This looks like a Larian .lsx file, but no mod entries were found in it.',
    ]);
  }

  const entries: Record<string, unknown>[] = [];
  for (const block of blocks) {
    const scope = block.split('</node>')[0];
    const rec: Record<string, unknown> = {};
    for (const m of scope.matchAll(/<attribute\s+id="([^"]+)"[^>]*\bvalue="([^"]*)"/g)) {
      rec[m[1]] = decodeXml(m[2]);
    }
    // The base game ships as modules too; the engine master list already knows
    // their folder names.
    if (typeof rec.Folder === 'string' && ENGINE_MASTERS.has(rec.Folder)) continue;
    if (typeof rec.Name === 'string' && ENGINE_MASTERS.has(rec.Name)) continue;
    entries.push(rec);
  }

  return collect(entries, 'BG3 modsettings.lsx');
}

/**
 * Parse any supported load order file. Never throws. Errors come back on the
 * result so the UI can show them.
 */
export function parseLoadOrder(content: string, filename = ''): ParseResult {
  const trimmed = content.trim();
  if (!trimmed) return empty('unknown', ['File is empty.']);

  const ext = filename.toLowerCase().split('.').pop() ?? '';
  const looksJson = trimmed.startsWith('{') || trimmed.startsWith('[');

  if (ext === 'lsx' || (trimmed.startsWith('<?xml') && trimmed.includes('ModuleShortDesc'))) {
    return parseModsettings(trimmed);
  }

  if (ext === 'json' || looksJson) {
    let data: unknown;
    try {
      data = JSON.parse(trimmed);
    } catch (err) {
      return empty('JSON', [
        `Not valid JSON: ${err instanceof Error ? err.message : 'parse failed'}`,
      ]);
    }

    if (Array.isArray(data)) return collect(data, 'BG3MM export (full metadata)');

    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.Order)) return collect(obj.Order, 'BG3MM load order');
    if (Array.isArray(obj.Mods)) return collect(obj.Mods, 'BG3MM mod list');
    if (Array.isArray(obj.mods)) return collect(obj.mods, 'JSON mod list');
    if (obj.Name || obj.name) return collect([obj], 'Single mod');

    return empty('JSON', [
      'Unrecognised JSON. Expected a BG3 Mod Manager export: an array of mods, ' +
      'or an object with an "Order" or "Mods" array.',
    ]);
  }

  if (ext === 'tsv' || trimmed.includes('\t')) return parseDelimited(content, '\t', 'TSV');
  // A named .txt is a list of names, never CSV: mod names contain commas
  // ("ASE - Gnoll, Harpy, ..."), and splitting on them shreds the names.
  if (ext === 'txt') return parseText(content);
  if (ext === 'csv' || /,.*\n/.test(trimmed)) return parseDelimited(content, ',', 'CSV');
  return parseText(content);
}
