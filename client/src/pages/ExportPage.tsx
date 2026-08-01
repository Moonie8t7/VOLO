import { useState } from 'react';
import { Link } from 'wouter';
import { Download, Copy, Check, ArrowRight, Heart, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useStore } from '@/lib/store';
import { EXPORT_FORMATS, exportOrder, download, type ExportFormat } from '@/lib/exporter';

const MIME: Record<string, string> = {
  json: 'application/json',
  csv: 'text/csv',
  txt: 'text/plain',
  md: 'text/markdown',
};

/**
 * Submissions go through a GitHub issue form. An Action validates the order,
 * adds it to the corpus, regenerates the masterlist and opens a pull request,
 * so the site needs no server of its own. Orders are too large for a URL, so
 * the flow is copy to clipboard, then paste into the form that opens.
 */
const SUBMIT_URL =
  'https://github.com/Moonie8t7/VOLO/issues/new?template=submit-load-order.yml';

export default function ExportPage() {
  const { result } = useStore();
  const [format, setFormat] = useState<ExportFormat>('bg3mm');
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);

  const share = async () => {
    if (!result) return;
    try {
      // Always submit the BG3MM form regardless of the selected export format,
      // because that is the format the intake pipeline validates.
      await navigator.clipboard.writeText(exportOrder(result, 'bg3mm'));
      setShared(true);
      setTimeout(() => setShared(false), 4000);
    } catch {
      // Clipboard can be refused; the form still opens and accepts attachments.
    }
    window.open(SUBMIT_URL, '_blank', 'noopener');
  };

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
  const content = exportOrder(result, format);

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

            <div className="flex gap-3">
              <Button
                size="lg"
                className="flex-1"
                onClick={() =>
                  download(content, `volo-load-order.${spec.ext}`, MIME[spec.ext] ?? 'text/plain')
                }
              >
                <Download className="mr-2 h-4 w-4" />
                Download .{spec.ext}
              </Button>
              <Button size="lg" variant="outline" onClick={copy}>
                {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>

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
              Every future user sorts against what you verified.
            </p>
            <Button onClick={share}>
              {shared ? <Check className="mr-2 h-4 w-4" /> : <ExternalLink className="mr-2 h-4 w-4" />}
              {shared ? 'Copied, paste it into the form' : 'Submit this load order'}
            </Button>
            <p className="text-xs text-muted-foreground">
              Copies the order to your clipboard and opens the submission form on GitHub,
              where you say whether it worked. Submissions are public.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
