import { useCallback, useState } from 'react';
import { useLocation } from 'wouter';
import { useDropzone } from 'react-dropzone';
import { Upload, FileJson, AlertCircle, CheckCircle2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useStore } from '@/lib/store';
import { parseLoadOrder } from '@/lib/parser';
import type { ParseResult } from '@/lib/types';

export default function ImportPage() {
  const [, navigate] = useLocation();
  const { importParsed, mods } = useStore();
  const [pasted, setPasted] = useState('');
  const [preview, setPreview] = useState<{ parsed: ParseResult; name: string } | null>(null);

  const ingest = useCallback((content: string, name: string) => {
    const parsed = parseLoadOrder(content, name);
    setPreview({ parsed, name });
    if (parsed.mods.length) importParsed(parsed, name);
  }, [importParsed]);

  const onDrop = useCallback((files: File[]) => {
    const file = files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => ingest(String(reader.result ?? ''), file.name);
    reader.onerror = () =>
      setPreview({
        name: file.name,
        parsed: {
          mods: [], sections: [], format: 'unknown', warnings: [],
          errors: ['Could not read that file.'],
        },
      });
    reader.readAsText(file);
  }, [ingest]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    accept: {
      'application/json': ['.json'],
      'text/plain': ['.txt'],
      'text/csv': ['.csv', '.tsv'],
    },
  });

  const parsed = preview?.parsed;

  return (
    <div className="p-8 overflow-auto bg-gradient-to-br from-background via-background to-card min-h-screen">
      <div className="max-w-4xl mx-auto space-y-8">
        <header>
          <h1 className="text-4xl font-display font-bold text-gradient-bg3">Import your load order</h1>
          <p className="text-muted-foreground mt-2 font-body">
            Export your order from BG3 Mod Manager, then drop the file here.
          </p>
        </header>

        <Alert className="border-primary/30 bg-primary/5">
          <ShieldCheck className="h-4 w-4" />
          <AlertDescription className="font-body">
            Your load order is processed entirely in your browser. It is never uploaded,
            and VOLO has no server that could store it.
          </AlertDescription>
        </Alert>

        <Card className="border-ornate shadow-bg3">
          <CardContent className="pt-6">
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
                isDragActive ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/50'
              }`}
            >
              <input {...getInputProps({ name: 'loadOrderFile', 'aria-label': 'Load order file' })} />
              <Upload className="h-12 w-12 mx-auto mb-4 text-primary/70" />
              <p className="font-subheader text-lg">
                {isDragActive ? 'Drop it' : 'Drag a file here, or click to browse'}
              </p>
              <p className="text-sm text-muted-foreground mt-2 font-body">
                BG3MM export (.json), .csv, .tsv or a plain .txt list
              </p>
            </div>

            <div className="mt-8">
              <label htmlFor="pasted-order" className="block text-sm font-medium mb-2 font-subheader">
                Or paste it directly
              </label>
              <Textarea
                id="pasted-order"
                name="pastedOrder"
                value={pasted}
                onChange={e => setPasted(e.target.value)}
                placeholder={'{"Order": [...]}   or one mod name per line'}
                className="font-mono text-xs h-32"
              />
              <Button
                className="mt-3"
                disabled={!pasted.trim()}
                onClick={() => ingest(pasted, 'pasted.json')}
              >
                Read pasted list
              </Button>
            </div>
          </CardContent>
        </Card>

        {parsed && (
          <Card className="border-ornate shadow-bg3">
            <CardHeader>
              <CardTitle className="font-display flex items-center gap-2">
                {parsed.mods.length
                  ? <CheckCircle2 className="h-5 w-5 text-green-500" />
                  : <AlertCircle className="h-5 w-5 text-destructive" />}
                {parsed.mods.length
                  ? `Read ${parsed.mods.length} mods`
                  : 'Nothing could be read from that file'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 font-body">
              {parsed.mods.length > 0 && (
                <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                  <Stat label="Format" value={parsed.format} />
                  <Stat label="Mods" value={String(parsed.mods.length)} />
                  <Stat label="Sections" value={String(parsed.sections.length)} />
                  <Stat
                    label="With dependencies"
                    value={String(parsed.mods.filter(m => m.dependencies?.length).length)}
                  />
                </dl>
              )}

              {parsed.errors.map((e, i) => (
                <Alert key={i} variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{e}</AlertDescription>
                </Alert>
              ))}

              {parsed.warnings.length > 0 && (
                <details className="text-sm text-muted-foreground">
                  <summary className="cursor-pointer">{parsed.warnings.length} warnings</summary>
                  <ul className="mt-2 space-y-1 pl-4 list-disc">
                    {parsed.warnings.slice(0, 20).map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </details>
              )}

              {parsed.sections.length > 0 && (
                <p className="text-sm text-muted-foreground">
                  Found your own section headers ({parsed.sections.slice(0, 6).map(s => s.label).join(', ')}
                  {parsed.sections.length > 6 ? ', and more' : ''}). VOLO uses these to categorise unknown mods.
                </p>
              )}

              {parsed.mods.length > 0 && (
                <Button size="lg" className="w-full" onClick={() => navigate('/optimise')}>
                  <FileJson className="mr-2 h-4 w-4" />
                  Sort {parsed.mods.length} mods
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {!preview && mods.length > 0 && (
          <p className="text-sm text-muted-foreground font-body">
            You already have {mods.length} mods loaded from a previous session.{' '}
            <button className="underline hover:text-foreground" onClick={() => navigate('/optimise')}>
              Continue where you left off
            </button>
          </p>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs uppercase tracking-wider">{label}</dt>
      <dd className="font-medium mt-0.5">{value}</dd>
    </div>
  );
}
