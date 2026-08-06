/**
 * Submits a load order to VOLO's intake queue through the site's own
 * endpoint, so contributors do not need a GitHub account. The endpoint opens
 * the same labelled issue the GitHub form would; everything downstream is
 * identical.
 */

/**
 * Cloudflare Turnstile site key. Empty means no challenge is rendered and the
 * endpoint (whose secret would also be unset) skips verification. Fill both
 * to turn bot protection on; neither half works alone.
 */
export const TURNSTILE_SITE_KEY = '0x4AAAAAAEGIQn-dVyznAC5a';

export interface SubmissionPayload {
  /** The order as BG3MM JSON, the format the intake pipeline validates. */
  order: string;
  verdict: 'working' | 'broken';
  notes?: string;
  patch?: string;
  /**
   * Whether VOLO produced this order.
   *
   * An order VOLO sorted and someone played is real evidence that the mods work
   * together, and no evidence at all about the sequence, which VOLO chose.
   * Unanswered is left undefined rather than assumed either way.
   */
  sortedByVolo?: 'volo' | 'self';
  turnstileToken?: string;
}

export interface SubmissionResult {
  url: string;
  number: number;
}

export async function submitOrder(payload: SubmissionPayload): Promise<SubmissionResult> {
  let res: Response;
  try {
    res = await fetch('/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new Error('Could not reach the submission endpoint. The GitHub form below still works.');
  }

  let data: { url?: string; number?: number; error?: string } = {};
  try {
    data = await res.json();
  } catch {
    // A non-JSON answer means the endpoint is absent; the error below covers it.
  }

  if (!res.ok || !data.url) {
    throw new Error(data.error ?? 'Submitting through the site is unavailable right now. The GitHub form below still works.');
  }
  return { url: data.url, number: data.number ?? 0 };
}

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, opts: { sitekey: string; callback: (token: string) => void }) => string;
    };
  }
}

/** Loads the Turnstile widget into el and resolves tokens through onToken. */
export function mountTurnstile(el: HTMLElement, onToken: (token: string) => void): void {
  if (!TURNSTILE_SITE_KEY) return;
  const render = () => window.turnstile?.render(el, { sitekey: TURNSTILE_SITE_KEY, callback: onToken });
  if (window.turnstile) {
    render();
    return;
  }
  const script = document.createElement('script');
  script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
  script.async = true;
  script.onload = render;
  document.head.appendChild(script);
}
