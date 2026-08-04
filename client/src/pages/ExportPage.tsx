import { useState } from 'react';
import { Link } from 'wouter';
import { Download, Copy, Check, ArrowRight, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useStore } from '@/lib/store';
import { EXPORT_FORMATS, exportOrder, download, type ExportFormat } from '@/lib/exporter';
import dividers from '@/lib/dividers.json';

const MIME: Record<string, string> = {
  json: 'application/json',
  csv: 'text/csv',
  txt: 'text/plain',
  md: 'text/markdown',
  lsx: 'application/xml',
};

export default function ExportPage() {
  const { result } = useStore();
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
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const spec = EXPORT_FORMATS.find(f => f.id === format)!;
  const content = exportOrder(result, format, { insertDividers: insertDividers && format === 'bg3mm' });

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
            <div className="grid gap-3 sm:grid-cols-2">
              {EXPORT_FORMATS.map(f => (
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
                    Insert load order dividers at each category boundary, so the
                    order arrives in BG3MM already sectioned.
                  </span>
                </label>
                {insertDividers && (
                  <p className="text-xs text-muted-foreground pl-7">
                    The divider paks must be installed or BG3MM will list them as
                    missing.{' '}
                    <a href="/downloads/astras-dividers.zip" className="underline hover:text-foreground">
                      Download the divider paks
                    </a>
                    ; they are Astra's Load Order Dividers, so if you already
                    have that set installed the exported order works as-is.{' '}
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
                <Download className="mr-2 h-4 w-4" />
                {format === 'modsettings' ? 'Download modsettings.lsx' : `Download .${spec.ext}`}
              </Button>
              <Button size="lg" variant="outline" onClick={copy}>
                {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
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
              <pre className="max-h-72 overflow-auto rounded border border-border bg-card/50 p-4 text-xs font-mono">
                {content.slice(0, 4000)}
                {content.length > 4000 ? '\n(preview truncated)' : ''}
              </pre>
            </div>
          </CardContent>
        </Card>

        <Card className="border-ornate shadow-bg3">
          <CardHeader>
            <CardTitle className="font-display flex items-center gap-2">
              <Heart className="h-5 w-5 text-destructive/80" />
              Share it back
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 font-body">
            <p className="text-sm text-muted-foreground">
              Once you have actually played on this order, submitting it teaches VOLO.
              Working orders sharpen where mods belong; broken ones sharpen the warnings.
              Every future user sorts against what you verified. No account needed.
            </p>
            <Link href="/submit">
              <Button>
                Submit this load order
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
