/**
 * Turns a sorted order back into something BG3 Mod Manager will accept.
 *
 * The round trip matters more than it looks: if the export doesn't import
 * cleanly into BG3MM the whole tool is a toy. `bg3mm` reproduces the exact
 * shape BG3MM's own "export order" writes.
 */

import type { Mod, SortResult } from './types';
import dividers from './dividers.json';

export interface ExportOptions {
  /**
   * Insert Astra's Load Order Dividers above each category in the BG3MM
   * export. One divider per group, and only for groups present in the order.
   * The divider paks must be installed for BG3MM to resolve the entries.
   */
  insertDividers?: boolean;
}

export type ExportFormat = 'bg3mm' | 'modsettings' | 'json' | 'csv' | 'txt' | 'markdown';

export const EXPORT_FORMATS: { id: ExportFormat; label: string; hint: string; ext: string }[] = [
  { id: 'bg3mm', label: 'BG3 Mod Manager', hint: 'Import straight back into BG3MM', ext: 'json' },
  { id: 'modsettings', label: 'Game modsettings.lsx', hint: "Replace the game's own load order file", ext: 'lsx' },
  { id: 'json', label: 'JSON (full)', hint: 'Everything VOLO knows, for tools', ext: 'json' },
  { id: 'csv', label: 'CSV', hint: 'Spreadsheets', ext: 'csv' },
  { id: 'txt', label: 'Plain text', hint: 'Readable list', ext: 'txt' },
  { id: 'markdown', label: 'Markdown', hint: 'Paste into Reddit or Discord', ext: 'md' },
];

/**
 * The base-game modules every Patch 8 modsettings.lsx lists before the mods.
 * Values taken verbatim from a real Patch 8 file; the game requires them and
 * they never appear in VOLO's mod list because the parser strips them.
 */
const ENGINE_PREAMBLE = [
  { folder: 'GustavDev', name: 'GustavDev', uuid: '28ac9ce2-2aba-8cda-b3b5-6e922f71b6b8', version64: '145242591228395316' },
  { folder: 'GustavX', name: 'GustavX', uuid: 'cb555efe-2d9e-131f-8195-a89329d218ea', version64: '145241946983300916' },
  { folder: 'HonourX', name: 'HonourX', uuid: '767d0062-d82c-279c-e16b-dfee7fe94cdd', version64: '36028797026107188' },
];

const escapeXml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const escapeCsv = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

export function exportOrder(result: SortResult, format: ExportFormat, options: ExportOptions = {}): string {
  const { mods, placements } = result;

  // Prefer the mod's own UUID; fall back to one the masterlist recovered for
  // imports that arrived without UUIDs. Synthetic name: keys never leak out.
  const realUuid = (m: Mod): string => {
    if (!m.uuid.startsWith('name:')) return m.uuid;
    return placements.get(m.uuid)?.resolvedUuid ?? '';
  };

  switch (format) {
    case 'bg3mm': {
      const entries: { UUID: string; Name: string }[] = [];
      const usedDividers = new Set<string>();
      for (const m of mods) {
        if (options.insertDividers) {
          const group = placements.get(m.uuid)?.group;
          const divider = group
            ? (dividers.byGroup as Record<string, { uuid: string; name: string } | undefined>)[group]
            : undefined;
          if (divider && !usedDividers.has(divider.uuid)) {
            usedDividers.add(divider.uuid);
            entries.push({ UUID: divider.uuid, Name: divider.name });
          }
        }
        entries.push({ UUID: realUuid(m), Name: m.name });
      }
      return JSON.stringify({ Order: entries }, null, 2);
    }

    case 'modsettings': {
      // Mirrors the structure the game writes, attribute order included.
      // Mods without a UUID cannot be represented and are left out; the UI
      // counts them so the user is not surprised.
      const shortDesc = (e: {
        folder: string; name: string; uuid: string;
        md5?: string; publishHandle?: string; version64?: string;
      }) => [
        '            <node id="ModuleShortDesc">',
        `              <attribute id="Folder" type="LSString" value="${escapeXml(e.folder)}" />`,
        `              <attribute id="MD5" type="LSString" value="${escapeXml(e.md5 ?? '')}" />`,
        `              <attribute id="Name" type="LSString" value="${escapeXml(e.name)}" />`,
        `              <attribute id="PublishHandle" type="uint64" value="${e.publishHandle ?? '0'}" />`,
        `              <attribute id="UUID" type="guid" value="${e.uuid}" />`,
        `              <attribute id="Version64" type="int64" value="${e.version64 ?? '36028797018963968'}" />`,
        '            </node>',
      ].join('\n');

      const nodes = ENGINE_PREAMBLE.map(shortDesc);
      for (const m of mods) {
        const uuid = realUuid(m);
        if (!uuid) continue;
        nodes.push(shortDesc({
          folder: m.folder ?? m.name,
          name: m.name,
          uuid,
          md5: m.md5,
          publishHandle: m.publishHandle,
          version64: m.version64,
        }));
      }

      return [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<save>',
        '  <version major="4" minor="7" revision="1" build="3" />',
        '  <region id="ModuleSettings">',
        '    <node id="root">',
        '      <children>',
        '        <node id="Mods">',
        '          <children>',
        ...nodes,
        '          </children>',
        '        </node>',
        '      </children>',
        '    </node>',
        '  </region>',
        '</save>',
        '',
      ].join('\n');
    }

    case 'json':
      return JSON.stringify(
        {
          generator: 'VOLO',
          generated: new Date().toISOString(),
          // Plain-language stats. "Dependency rules" are declared requirements
          // where both mods are present, enforced as load-before constraints.
          stats: {
            mods: result.stats.total,
            movedBySort: result.stats.moved,
            knownToMasterlist: result.stats.knownToMasterlist,
            dependencyRulesApplied: result.stats.hardEdges,
            notYetCategorised: result.stats.unsorted,
          },
          mods: mods.map((m, i) => ({
            index: i,
            uuid: realUuid(m),
            name: m.name,
            author: m.author,
            version: m.version,
            group: placements.get(m.uuid)?.group,
          })),
        },
        null, 2,
      );

    case 'csv': {
      const rows = [['Index', 'Name', 'UUID', 'Group', 'Author', 'Version']];
      mods.forEach((m, i) => rows.push([
        String(i), m.name, realUuid(m),
        placements.get(m.uuid)?.group ?? '', m.author ?? '', m.version ?? '',
      ]));
      return rows.map(r => r.map(escapeCsv).join(',')).join('\n');
    }

    case 'txt':
      return mods.map((m, i) => `${String(i + 1).padStart(3)}. ${m.name}`).join('\n');

    case 'markdown': {
      const lines = [
        '# Load order',
        '',
        `${mods.length} mods, sorted by [VOLO](https://volobg3.com).`,
        '',
      ];
      let group = '';
      mods.forEach(m => {
        const g = placements.get(m.uuid)?.group ?? 'unsorted';
        if (g !== group) { group = g; lines.push('', `### ${g}`, ''); }
        lines.push(`- ${m.name}${m.author ? `, ${m.author}` : ''}`);
      });
      return lines.join('\n');
    }
  }
}

export function download(content: string, filename: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
