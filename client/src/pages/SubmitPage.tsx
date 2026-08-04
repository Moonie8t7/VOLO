import { useEffect, useRef, useState } from 'react';
import { Link } from 'wouter';
import { Check, Heart, Upload, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Textarea } from '@/components/ui/textarea';
import { useStore } from '@/lib/store';
import { parseLoadOrder } from '@/lib/parser';
import { submitOrder, mountTurnstile, TURNSTILE_SITE_KEY } from '@/lib/submit';

/** The GitHub fallback, for people who prefer submitting under their own name. */
const SUBMIT_URL =
  'https://github.com/Moonie8t7/VOLO/issues/new?template=submit-load-order.yml';

interface PreparedOrder {
  /** What gets submitted: the raw file when it keeps fidelity, else converted. */
  text: string;
  count: number;
  format: string;
  label: string;
}

/**
 * Raw JSON and modsettings.lsx are submitted untouched, because the raw file
 * carries things a converted list loses: divider entries, section headers,
 * dependency and version metadata. Other formats are converted to the BG3MM
 * shape the pipeline validates.
 */
function prepare(raw: string, filename: string): PreparedOrder | { error: string } {
  const parsed = parseLoadOrder(raw, filename);
  if (parsed.errors.length) return { error: parsed.errors[0] };
  if (parsed.mods.length < 5) {
    return { error: `Only ${parsed.mods.length} mods could be read; five is the minimum.` };
  }
  const trimmed = raw.trim();
  const keepRaw = trimmed.startsWith('{') || trimmed.startsWith('[') || trimmed.startsWith('<?xml');
  const text = keepRaw
    ? raw
    : JSON.stringify({
        Order: parsed.mods.map(m => ({
          UUID: m.uuid.startsWith('name:') ? '' : m.uuid,
          Name: m.name,
        })),
      }, null, 2);
  return { text, count: parsed.mods.length, format: parsed.format, label: filename };
}

export default function SubmitPage() {
  const { mods, sourceName, masterlist } = useStore();

  const [order, setOrder] = useState<PreparedOrder | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [pasted, setPasted] = useState('');
  const [verdict, setVerdict] = useState<'working' | 'broken' | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submittedUrl, setSubmittedUrl] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const turnstileRef = useRef<HTMLDivElement>(null);
  const turnstileToken = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (turnstileRef.current) {
      mountTurnstile(turnstileRef.current, token => { turnstileToken.current = token; });
    }
  }, []);

  const useSession = () => {
    const ordered = [...mods].sort((a, b) => a.originalIndex - b.originalIndex);
    setOrder({
      text: JSON.stringify({
        Order: ordered.map(m => ({
          UUID: m.uuid.startsWith('name:') ? '' : m.uuid,
          Name: m.name,
        })),
      }, null, 2),
      count: ordered.length,
      format: 'imported order',
      label: sourceName || 'the order you imported',
    });
    setOrderError(null);
  };

  const useText = (raw: string, filename: string) => {
    const result = prepare(raw, filename);
    if ('error' in result) {
      setOrder(null);
      setOrderError(result.error);
    } else {
      setOrder(result);
      setOrderError(null);
    }
  };

  const onFile = (file: File) => {
    file.text().then(text => useText(text, file.name));
  };

  const submit = async () => {
    if (!order || !verdict) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const { url } = await submitOrder({
        order: order.text,
        verdict,
        notes: notes.trim() || undefined,
        patch: masterlist?.gamePatch ?? undefined,
        turnstileToken: turnstileToken.current,
      });
      setSubmittedUrl(url);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Submission failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const githubFallback = async () => {
    if (order) {
      try { await navigator.clipboard.writeText(order.text); } catch {
        // Clipboard can be refused; the form accepts attachments regardless.
      }
    }
    window.open(SUBMIT_URL, '_blank', 'noopener');
  };

  return (
    <div className="p-8 overflow-auto min-h-screen bg-gradient-to-br from-background via-background to-card">
      <div className="max-w-3xl mx-auto space-y-8">
        <header>
          <h1 className="text-4xl font-display font-bold text-gradient-bg3">Submit a load order</h1>
          <p className="text-muted-foreground mt-2 font-body">
            Orders you have actually played on are what VOLO learns from.
            Working orders sharpen where mods belong; broken ones sharpen the
            warnings. No account needed.
          </p>
        </header>

        {submittedUrl ? (
          <Card className="border-ornate shadow-bg3">
            <CardContent className="pt-6 font-body space-y-3">
              <p className="font-subheader text-lg flex items-center gap-2">
                <Check className="h-5 w-5 text-primary" />
                Submitted. Thank you.
              </p>
              <p className="text-sm text-muted-foreground">
                Your order joins the public queue, gets validated against the
                corpus, and the masterlist learns from it once a human approves
                the change.{' '}
                <a href={submittedUrl} target="_blank" rel="noreferrer" className="underline hover:text-foreground">
                  Follow it here
                </a>
                .
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="border-ornate shadow-bg3">
              <CardHeader>
                <CardTitle className="font-display">The order</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 font-body">
                {order ? (
                  <Alert className="border-primary/30 bg-primary/5">
                    <AlertDescription className="font-body flex items-center justify-between gap-4">
                      <span>
                        {order.count} mods from <strong>{order.label}</strong> ({order.format})
                      </span>
                      <button
                        onClick={() => setOrder(null)}
                        className="text-xs underline hover:text-foreground shrink-0"
                      >
                        change
                      </button>
                    </AlertDescription>
                  </Alert>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">
                      The most useful submission is the untouched file you
                      played with: a BG3 Mod Manager export or the game's own
                      modsettings.lsx, exactly as it is.
                    </p>

                    {mods.length >= 5 && (
                      <Button variant="outline" onClick={useSession}>
                        <ArrowRight className="mr-2 h-4 w-4" />
                        Use the order imported here ({mods.length} mods)
                      </Button>
                    )}

                    <label
                      className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
                        block transition-colors border-border hover:border-primary/50"
                    >
                      <input
                        type="file"
                        accept=".json,.lsx,.txt,.tsv,.csv"
                        className="hidden"
                        onChange={e => { if (e.target.files?.[0]) onFile(e.target.files[0]); }}
                      />
                      <Upload className="h-8 w-8 mx-auto mb-2 text-primary/70" />
                      <span className="font-subheader">Choose the load order file</span>
                      <span className="block text-xs text-muted-foreground mt-1">
                        BG3MM export (.json), modsettings.lsx, .csv, .tsv or .txt
                      </span>
                    </label>

                    <div>
                      <label htmlFor="pasted-submission" className="block text-sm font-medium mb-2 font-subheader">
                        Or paste it
                      </label>
                      <Textarea
                        id="pasted-submission"
                        value={pasted}
                        onChange={e => setPasted(e.target.value)}
                        placeholder={'{"Order": [...]}'}
                        className="font-mono text-xs h-24"
                      />
                      <Button
                        variant="outline"
                        className="mt-2"
                        disabled={!pasted.trim()}
                        onClick={() => useText(pasted, 'pasted')}
                      >
                        Use pasted order
                      </Button>
                    </div>
                  </>
                )}

                {orderError && <p className="text-sm text-destructive">{orderError}</p>}
              </CardContent>
            </Card>

            <Card className="border-ornate shadow-bg3">
              <CardHeader>
                <CardTitle className="font-display flex items-center gap-2">
                  <Heart className="h-5 w-5 text-destructive/80" />
                  The verdict
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 font-body">
                <div className="flex flex-col gap-2">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="verdict"
                      checked={verdict === 'working'}
                      onChange={() => setVerdict('working')}
                      className="h-4 w-4 accent-[#D7A869]"
                    />
                    <span className="text-sm">It worked, I have played on it</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="verdict"
                      checked={verdict === 'broken'}
                      onChange={() => setVerdict('broken')}
                      className="h-4 w-4 accent-[#D7A869]"
                    />
                    <span className="text-sm">It had problems</span>
                  </label>
                </div>

                <Textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder={
                    verdict === 'broken'
                      ? 'What went wrong? That detail is the most valuable part.'
                      : 'Anything worth knowing (optional)'
                  }
                  className="font-body text-sm h-20"
                />

                <div ref={turnstileRef} className={TURNSTILE_SITE_KEY ? '' : 'hidden'} />

                <Button onClick={submit} disabled={!order || !verdict || submitting} size="lg">
                  {submitting ? 'Submitting' : 'Submit this load order'}
                </Button>

                {submitError && <p className="text-sm text-destructive">{submitError}</p>}

                <p className="text-xs text-muted-foreground">
                  Goes to VOLO's public submission queue on GitHub, where every
                  order is validated and reviewed before the masterlist changes.
                  Prefer doing it yourself?{' '}
                  <button onClick={githubFallback} className="underline hover:text-foreground">
                    Open the GitHub form
                  </button>
                  , which copies your selected order to the clipboard first.
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
