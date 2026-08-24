/**
 * Submit a load order to the public queue. Works standalone: sorting first is
 * not required, and the raw file is preferred over a converted one.
 */

import { useEffect, useRef, useState } from 'react';
import { Link } from 'wouter';
import { Check, Heart, Upload, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useStore } from '@/lib/store';
import type { ImportedSection, Mod } from '@/lib/types';
import { parseLoadOrder } from '@/lib/parser';
import { scrubPersonalPaths } from '@/lib/scrub';
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
 * The BG3MM shape, with the section headers put back where they were.
 *
 * A converted list used to be the mods alone. Section headers are the single
 * strongest placement evidence the corpus has, and the parser separates them
 * from the mods, so converting a TSV threw every one of them away before the
 * order was ever sent. VOLO was degrading the evidence it exists to collect,
 * and only for the people whose manager exports a format it has to convert.
 *
 * Each header goes back above the mod it sat above, written exactly as it
 * arrived, so intake reads the same boundaries the submitter saw.
 */
function toBg3mmOrder(mods: Mod[], sections: ImportedSection[]) {
  const above = new Map<number, ImportedSection[]>();
  for (const section of sections) {
    if (!section.name) continue;
    if (!above.has(section.afterIndex)) above.set(section.afterIndex, []);
    above.get(section.afterIndex)!.push(section);
  }
  const rows: { UUID: string; Name: string }[] = [];
  const header = (s: ImportedSection) => ({ UUID: s.uuid ?? '', Name: s.name! });
  mods.forEach((mod, i) => {
    for (const s of above.get(i) ?? []) rows.push(header(s));
    rows.push({ UUID: mod.uuid.startsWith('name:') ? '' : mod.uuid, Name: mod.name });
  });
  for (const s of above.get(mods.length) ?? []) rows.push(header(s));
  return rows;
}

/**
 * Raw JSON and modsettings.lsx are submitted untouched, because the raw file
 * carries things a converted list loses: dependency and version metadata that
 * no conversion here reproduces. Other formats are converted to the BG3MM
 * shape the pipeline validates, headers included.
 */
function prepare(rawInput: string, filename: string): PreparedOrder | { error: string } {
  // Scrubbed here, before anything is parsed or sent, so a submitter's account
  // name never leaves their machine rather than being removed after it arrives.
  const raw = scrubPersonalPaths(rawInput);
  const parsed = parseLoadOrder(raw, filename);
  if (parsed.errors.length) return { error: parsed.errors[0] };
  if (parsed.mods.length < 5) {
    return { error: `Only ${parsed.mods.length} mods could be read; five is the minimum.` };
  }
  const trimmed = raw.trim();
  const keepRaw = trimmed.startsWith('{') || trimmed.startsWith('[') || trimmed.startsWith('<?xml');
  const text = keepRaw
    ? raw
    : JSON.stringify({ Order: toBg3mmOrder(parsed.mods, parsed.sections) }, null, 2);
  return { text, count: parsed.mods.length, format: parsed.format, label: filename };
}

export default function SubmitPage() {
  const { mods, sections, sourceName } = useStore();

  const [order, setOrder] = useState<PreparedOrder | null>(null);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [pasted, setPasted] = useState('');
  const [verdict, setVerdict] = useState<'working' | 'broken' | null>(null);
  const [arrangement, setArrangement] = useState<'volo' | 'self' | null>(null);
  const [notes, setNotes] = useState('');
  const [patch, setPatch] = useState('');
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
      // Sorted back to the order it was imported in, so the section headers
      // still sit above the mods they were heading.
      text: JSON.stringify({ Order: toBg3mmOrder(ordered, sections) }, null, 2),
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
        // Scrubbed here for the same reason the order is at prepare(): the note
        // box asks what went wrong, which is when somebody pastes a path, and a
        // path removed on arrival has already left the machine.
        notes: scrubPersonalPaths(notes).trim() || undefined,
        patch: scrubPersonalPaths(patch).trim() || undefined,
        sortedByVolo: arrangement ?? undefined,
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
            warnings. You do not need an account for any of it.
          </p>
        </header>

        {submittedUrl ? (
          <Card className="border-ornate shadow-bg3">
            <CardContent className="pt-6 font-body space-y-3">
              <p className="font-subheader text-lg flex items-center gap-2">
                <Check className="h-5 w-5 text-primary" aria-hidden="true" />
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
                        {order.count} mods from <strong>{order.label}</strong> ({order.format}).
                        {' '}This is submitted as it is; it does not change what the
                        Import and Export pages are working on.
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
                      What helps most is an order you have actually played on,
                      working or broken. Send the file as it is, a BG3 Mod
                      Manager export or the game's own modsettings.lsx, rather
                      than tidying it up first: the dividers, section headers
                      and version data are half of what VOLO learns from.
                    </p>

                    {mods.length >= 5 && (
                      <Button variant="outline" onClick={useSession}>
                        <ArrowRight className="mr-2 h-4 w-4" aria-hidden="true" />
                        Use the order imported here ({mods.length} mods)
                      </Button>
                    )}

                    <label
                      className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
                        block transition-colors border-border hover:border-primary/50"
                    >
                      <input
                        type="file"
                        name="submissionFile"
                        aria-label="Load order file to submit"
                        accept=".json,.lsx,.txt,.tsv,.csv"
                        className="hidden"
                        onChange={e => { if (e.target.files?.[0]) onFile(e.target.files[0]); }}
                      />
                      <Upload className="h-8 w-8 mx-auto mb-2 text-primary/70" aria-hidden="true" />
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

                {orderError && (
                  <p className="text-sm text-destructive" role="alert">{orderError}</p>
                )}
              </CardContent>
            </Card>

            <Card className="border-ornate shadow-bg3">
              <CardHeader>
                <CardTitle className="font-display flex items-center gap-2">
                  <Heart className="h-5 w-5 text-destructive/80" aria-hidden="true" />
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

                {/*
                  Asked because VOLO cannot tell on its own. The file goes
                  through BG3 Mod Manager before it comes back, which strips
                  anything VOLO could have written into it.
                */}
                <div className="border-t border-border/40 pt-4 space-y-2">
                  <p className="text-sm">
                    How did this order get its sequence?
                    <span className="block text-xs text-muted-foreground mt-1">
                      An order VOLO sorted still teaches it which mods work
                      together. It cannot teach it where they go, because that
                      part came from VOLO. Saying so keeps the numbers honest.
                    </span>
                  </p>
                  {([
                    ['self', 'I arranged it myself'],
                    ['volo', 'I sorted it with VOLO'],
                  ] as const).map(([value, label]) => (
                    <label key={value} className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="arrangement"
                        checked={arrangement === value}
                        onChange={() => setArrangement(value)}
                        className="h-4 w-4 accent-[#D7A869]"
                      />
                      <span className="text-sm">{label}</span>
                    </label>
                  ))}
                </div>

                {/*
                  Asked rather than assumed. Stamping the masterlist's current
                  calibration patch onto every submission labelled old orders
                  with a version their submitter never claimed.
                */}
                <div className="space-y-1">
                  <label htmlFor="submit-patch" className="text-sm font-medium font-subheader">
                    BG3 patch this order was played on
                    <span className="block text-xs font-normal text-muted-foreground mt-1">
                      Leave it blank if you are not sure.
                    </span>
                  </label>
                  <Input
                    id="submit-patch"
                    value={patch}
                    onChange={e => setPatch(e.target.value)}
                    placeholder="Patch 8"
                    className="font-body text-sm max-w-48"
                  />
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

                {submitError && (
                  <p className="text-sm text-destructive" role="alert">{submitError}</p>
                )}

                <p className="text-xs text-muted-foreground">
                  Goes to VOLO's public submission queue on GitHub, where every
                  order is validated before the masterlist changes. Submitted
                  orders are published under{' '}
                  <a
                    href="https://creativecommons.org/publicdomain/zero/1.0/"
                    target="_blank"
                    rel="noreferrer"
                    className="underline hover:text-foreground"
                  >
                    CC0
                  </a>
                  , so anyone can build on them, the same way you are building
                  on everyone else's. Prefer doing it yourself?{' '}
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
