/**
 * Turns a sorted order back into something BG3 Mod Manager will accept.
 *
 * The round trip matters more than it looks: if the export doesn't import
 * cleanly into BG3MM the whole tool is a toy. `bg3mm` reproduces the exact
 * shape BG3MM's own "export order" writes.
 */

import type { Mod, SortResult } from './types';

export type ExportFormat = 'bg3mm' | 'json' | 'csv' | 'txt' | 'markdown';

export const EXPORT_FORMATS: { id: ExportFormat; label: string; hint: string; ext: string }[] = [
  { id: 'bg3mm', label: 'BG3 Mod Manager', hint: 'Import straight back into BG3MM', ext: 'json' },
  { id: 'json', label: 'JSON (full)', hint: 'Everything VOLO knows, for tools', ext: 'json' },
  { id: 'csv', label: 'CSV', hint: 'Spreadsheets', ext: 'csv' },
  { id: 'txt', label: 'Plain text', hint: 'Readable list', ext: 'txt' },
  { id: 'markdown', label: 'Markdown', hint: 'Paste into Reddit or Discord', ext: 'md' },
];

const escapeCsv = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

export function exportOrder(result: SortResult, format: ExportFormat): string {
  const { mods, placements } = result;

  switch (format) {
    case 'bg3mm':
      return JSON.stringify(
        { Order: mods.map(m => ({ UUID: realUuid(m), Name: m.name })) },
        null, 2,
      );

    case 'json':
      return JSON.stringify(
        {
          generator: 'VOLO',
          generated: new Date().toISOString(),
          stats: result.stats,
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
        `${mods.length} mods, sorted by [VOLO](https://volo.tools).`,
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

/** Strip the synthetic key we generate for entries that arrived without a UUID. */
const realUuid = (m: Mod) => (m.uuid.startsWith('name:') ? '' : m.uuid);

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
