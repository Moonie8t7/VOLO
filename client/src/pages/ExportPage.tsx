/**
 * Export: writes the sorted order back out in the format the user needs.
 *
 * Names the import it came from, because the session can outlive the file the
 * user has in mind.
 */

import { useState } from 'react';
import { Link } from 'wouter';
import { Download, Copy, Check, ArrowRight, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useStore } from '@/lib/store';
import {
  EXPORT_FORMATS, exportOrder, dividerPlan, download, type ExportFormat,
} from '@/lib/exporter';
import { countWordCap } from '@/lib/words';
import dividers from '@/lib/dividers.json';

/**
 * Formats that go back into the game, as opposed to into a spreadsheet.
 *
 * These two are shown as the choice; the rest fold away behind a disclosure.
 * Presenting six as peers buried the one almost everybody wants, and gave the
 * one that can overwrite a live game file the same weight as CSV.
 */
const GOES_BACK_INTO_THE_GAME = (id: ExportFormat) => id === 'bg3mm' || id === 'modsettings';

const MIME: Record<string, string> = {
  json: 'application/json',
  csv: 'text/csv',
  txt: 'text/plain',
  md: 'text/markdown',
  lsx: 'application/xml',
};

/** "just now", "12 minutes ago", "yesterday". Null when we do not know. */
function ageOf(iso: string | null): string | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  const mins = Math.round(ms / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'yesterday' : `${days} days ago`;
}

/** An import older than this probably predates whatever the user is doing now. */
const STALE_AFTER_MS = 60 * 60_000;

export default function ExportPage() {
  const { result, sourceName, importedAt, sections } = useStore();
  const importedAge = ageOf(importedAt);
  const staleImport = importedAt
    ? Date.now() - new Date(importedAt).getTime() > STALE_AFTER_MS
    : false;
  const [format, setFormat] = useState<ExportFormat>('bg3mm');
  const [copied, setCopied] = useState(false);
  const [insertDividers, setInsertDividers] = useState(false);

  if (!result) {
    return (
      <div className="p-8 min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-card">
        <div className="text-center max-w-md">
          <h1 className="text-3xl font-display font-bold text-gradient-bg3">Nothing to export</h1>
          <p className="text-muted-foreground mt-3 font-body">
            Import and sort a load order first.
          </p>
          <Link href="/import">
            <Button size="lg" className="mt-6">
              Import a load order
              <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const spec = EXPORT_FORMATS.find(f => f.id === format)!;
  const plan = dividerPlan(result, sections);
  const content = exportOrder(result, format, {
    insertDividers: insertDividers && format === 'bg3mm',
    sections,
  });

  // Imports without a UUID column (TSV, plain text) leave gaps BG3MM cannot
  // match. The masterlist recovers many; count what is still missing.
  const missingUuids = result.mods.filter(
    m => m.uuid.startsWith('name:') && !result.placements.get(m.uuid)?.resolvedUuid,
  ).length;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="p-8 overflow-auto min-h-screen bg-gradient-to-br from-background via-background to-card">
      <div className="max-w-4xl mx-auto space-y-8">
        <header>
          <h1 className="text-4xl font-display font-bold text-gradient-bg3">Export</h1>
          <p className="text-muted-foreground mt-2 font-body">
            {result.mods.length} mods, ready to go back into BG3 Mod Manager.
          </p>
        </header>

        {/*
          Says out loud which import this came from.

          Someone who has picked a different file elsewhere, on the Submit
          page for instance, would otherwise export whatever the session still
          held and find out only when their mod manager reports mods they do
          not have installed. Relevant mainly when remembering is switched on,
          since the order can then be days old.
        */}
        <Alert className={staleImport ? 'border-destructive/40 bg-destructive/10' : 'border-primary/30 bg-primary/5'}>
          <AlertDescription className="font-body flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <span>
              Exporting <strong>{sourceName || 'the order you imported'}</strong>
              {importedAge && <>, imported {importedAge}</>}.
              {staleImport && ' Check this is the order you meant.'}
            </span>
            <Link href="/import" className="underline hover:text-foreground text-sm shrink-0">
              Import a different file
            </Link>
          </AlertDescription>
        </Alert>

        <Alert className="border-primary/30 bg-primary/5">
          <AlertDescription className="font-body">
            In BG3 Mod Manager: <strong>File, then Import Order from File</strong>, pick the
            downloaded file, then save your load order.
          </AlertDescription>
        </Alert>

        <Card className="border-ornate shadow-bg3">
          <CardHeader>
            <CardTitle className="font-display">Format</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {(format === 'bg3mm' || format === 'modsettings') && missingUuids > 0 && (
              <Alert className="border-destructive/40 bg-destructive/10">
                <AlertDescription className="font-body text-sm">
                  Your import had no UUIDs, and {missingUuids}{' '}
                  {missingUuids === 1 ? 'mod is' : 'mods are'} still missing one
                  after matching against the masterlist.{' '}
                  {format === 'modsettings'
                    ? 'A modsettings.lsx cannot represent them, so they are left out of this file.'
                    : 'BG3MM pairs entries with installed mods by UUID, so it may not reorder those.'}{' '}
                  Exporting from BG3MM as JSON, or importing the game's own
                  modsettings.lsx, avoids this.
                </AlertDescription>
              </Alert>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              {EXPORT_FORMATS.filter(f => GOES_BACK_INTO_THE_GAME(f.id)).map(f => (
                <button
                  key={f.id}
                  onClick={() => setFormat(f.id)}
                  className={`text-left rounded-lg border p-4 transition-colors ${
                    format === f.id
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <p className="font-medium font-subheader">{f.label}</p>
                  <p className="text-xs text-muted-foreground mt-1 font-body">{f.hint}</p>
                </button>
              ))}
            </div>

            <details className="group">
              <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground font-body">
                Other formats, for spreadsheets and posts
              </summary>
              <div className="grid gap-3 sm:grid-cols-2 mt-3">
                {EXPORT_FORMATS.filter(f => !GOES_BACK_INTO_THE_GAME(f.id)).map(f => (
                  <button
                    key={f.id}
                    onClick={() => setFormat(f.id)}
                    className={`text-left rounded-lg border p-4 transition-colors ${
                      format === f.id
                        ? 'border-primary bg-primary/10'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <p className="font-medium font-subheader">{f.label}</p>
                    <p className="text-xs text-muted-foreground mt-1 font-body">{f.hint}</p>
                  </button>
                ))}
              </div>
            </details>

            {format === 'modsettings' && (
              <Alert className="border-destructive/40 bg-destructive/10">
                <AlertDescription className="font-body text-sm space-y-2">
                  <p>
                    This file replaces the game's own load order.{' '}
                    <strong>Back up the original before overwriting it</strong>:
                    make a copy of modsettings.lsx, found at
                  </p>
                  <p className="font-mono text-xs break-all">
                    %LocalAppData%\Larian Studios\Baldur's Gate 3\PlayerProfiles\Public\modsettings.lsx
                  </p>
                  <p>
                    Then swap in the downloaded file, keeping the name
                    modsettings.lsx, while the game and any mod manager are
                    closed. Written for BG3 Patch 8. If anything misbehaves,
                    restore your backup.
                  </p>
                </AlertDescription>
              </Alert>
            )}

            {format === 'bg3mm' && (
              <div className="border border-border/40 bg-black/25 p-4 space-y-2">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={insertDividers}
                    onChange={e => setInsertDividers(e.target.checked)}
                    className="mt-1 h-4 w-4 accent-[#D7A869]"
                  />
                  <span className="text-sm font-body">
                    {plan.carried
                      ? 'Keep my section dividers, putting each one back above the category it was heading.'
                      : 'Insert load order dividers at each category boundary, so the order arrives in BG3MM already sectioned.'}
                  </span>
                </label>
                {insertDividers && plan.carried > 0 && (
                  <p className="text-xs text-muted-foreground pl-7">
                    Your own dividers, the ones that came in with this order, so
                    BG3MM already has them.{' '}
                    {plan.placeable < plan.carried ? (
                      <>
                        {countWordCap(plan.placeable)} of your {countWordCap(plan.carried)} go
                        back. The rest headed mods that ended up spread across
                        several categories, and a divider in the wrong place
                        mislabels everything under it, so those are left out.
                      </>
                    ) : (
                      <>All {countWordCap(plan.carried)} go back.</>
                    )}
                  </p>
                )}
                {insertDividers && plan.carried === 0 && (
                  <p className="text-xs text-muted-foreground pl-7">
                    This order arrived without dividers, so these are Astra's
                    Load Order Dividers. The paks must be installed or BG3MM
                    will list them as missing.{' '}
                    <a href="/downloads/astras-dividers.zip" className="underline hover:text-foreground">
                      Download the divider paks
                    </a>
                    .{' '}
                    {dividers.credit}{' '}
                    <a href={dividers.creditUrl} target="_blank" rel="noreferrer" className="underline hover:text-foreground">
                      Astralities on Nexus
                    </a>
                    .
                  </p>
                )}
              </div>
            )}

            <div className="flex gap-3">
              <Button
                size="lg"
                className="flex-1"
                onClick={() =>
                  download(
                    content,
                    format === 'modsettings' ? 'modsettings.lsx' : `volo-load-order.${spec.ext}`,
                    MIME[spec.ext] ?? 'text/plain',
                  )
                }
              >
                <Download className="mr-2 h-4 w-4" aria-hidden="true" />
                {format === 'modsettings' ? 'Download modsettings.lsx' : `Download .${spec.ext}`}
              </Button>
              <Button size="lg" variant="outline" onClick={copy}>
                {copied ? <Check className="mr-2 h-4 w-4" aria-hidden="true" /> : <Copy className="mr-2 h-4 w-4" aria-hidden="true" />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>

            <p className="text-xs text-muted-foreground font-body">
              The save dialog makes this look like a download, but the file is
              built inside this page and written straight to your disk. Nothing
              is fetched from a server and your list is not sent to one.
            </p>

            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Preview</p>
              <pre className="max-h-72 overflow-auto border border-border bg-card/50 p-4 text-xs font-mono">
                {content.slice(0, 4000)}
                {content.length > 4000 ? '\n(preview truncated)' : ''}
              </pre>
            </div>
          </CardContent>
        </Card>

        <Card className="border-ornate shadow-bg3">
          <CardHeader>
            <CardTitle className="font-display flex items-center gap-2">
              <Heart className="h-5 w-5 text-destructive/80" aria-hidden="true" />
              Share it back
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 font-body">
            <p className="text-sm text-muted-foreground">
              Once you have actually played on this order, submitting it teaches VOLO.
              Working orders sharpen where mods belong; broken ones sharpen the warnings.
              Every future user sorts against what you verified.
            </p>
            <Link href="/submit">
              <Button>
                Submit this load order
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
