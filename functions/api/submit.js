/**
 * Accepts a load order submission from the site and opens the labelled GitHub
 * issue the intake workflow already processes. The site still sorts entirely
 * client side; this endpoint exists so submitting does not require a GitHub
 * account. The issue body reproduces the submit-load-order template's output
 * format, because scripts/process-submission.mjs parses that shape.
 *
 * Environment (Cloudflare Pages settings):
 *   SUBMIT_GITHUB_TOKEN  fine-grained token with Issues read and write on the
 *                        repo. Required; without it the endpoint answers 503
 *                        and the site falls back to the GitHub form.
 *   TURNSTILE_SECRET     Cloudflare Turnstile secret key. Optional; token
 *                        verification runs only when set.
 *   SUBMISSIONS          R2 bucket binding. Optional; without it a load order
 *                        too large for an issue body is refused instead of
 *                        being staged.
 */

const REPO = 'Moonie8t7/VOLO';
const MAX_BODY = 2 * 1024 * 1024;

/**
 * The largest issue body worth attempting.
 *
 * GitHub rejects a body over 65,536 characters outright, and the failure
 * surfaces to the submitter as a bare API error. A 900 mod export is several
 * times that, so the orders most worth having were the ones that could not be
 * sent. The margin covers GitHub counting differently to us and a body whose
 * characters are not all one byte.
 */
const MAX_ISSUE_BODY = 60_000;

/**
 * Kept in step with MAX_ENTRIES in scripts/process-submission.mjs, where the
 * same bound stops one hostile attachment pinning a runner for six hours.
 */
const MAX_ENTRIES = 6000;

/** Hex, because a key travels through an issue body and a URL path. */
const stagingKey = () =>
  [...crypto.getRandomValues(new Uint8Array(16))]
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

async function sha256Hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

const json = (status, data) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export async function onRequestPost({ request, env }) {
  if (!env.SUBMIT_GITHUB_TOKEN) {
    return json(503, { error: 'Submissions through the site are not switched on yet.' });
  }

  const length = Number(request.headers.get('content-length') ?? 0);
  if (length > MAX_BODY) return json(413, { error: 'Submission too large.' });

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json(400, { error: 'Malformed request.' });
  }

  const { order: rawOrder, verdict, notes, patch, sortedByVolo, turnstileToken } = payload ?? {};

  /*
   * Scrubbed again here, having already been scrubbed in the browser.
   *
   * This is the last point before the order becomes a public GitHub issue,
   * which is permanent. A cached copy of the app could be months old, and a
   * request can be made without the app at all, so the guarantee cannot rest on
   * the client having done it. Kept in step with client/src/lib/scrub.ts by a
   * check in scripts/smoke-test.mjs.
   */
  const order = typeof rawOrder === 'string'
    ? rawOrder
      .replace(/(?<![A-Za-z0-9])[A-Za-z]:\\(?:[^\\\t"\r\n]*\\)*([^\\\t"\r\n]+)/g, '$1')
      .replace(/(?<![A-Za-z0-9])\/(?:home|Users)\/[^/\t"\r\n]+\/(?:[^/\t"\r\n]*\/)*([^/\t"\r\n]+)/g, '$1')
    : rawOrder;
  if (verdict !== 'working' && verdict !== 'broken') {
    return json(400, { error: 'Say whether the order worked.' });
  }
  if (typeof order !== 'string' || order.trim().length < 20) {
    return json(400, { error: 'No load order in the submission.' });
  }

  // Sanity check the order without trusting it: BG3MM JSON or the game's own
  // modsettings.lsx, a recognisable list, plausible size. Full validation
  // happens in the intake workflow with the app's own parser.
  const trimmed = order.trim();
  // Carried into the issue body when the order is staged, so intake can check
  // what it fetched is the whole thing rather than a truncated response.
  let entryCount = 0;
  let formatLabel = 'BG3MM JSON';
  if (trimmed.startsWith('<?xml')) {
    const modules = (trimmed.match(/ModuleShortDesc/g) ?? []).length;
    if (!trimmed.includes('ModuleSettings') || modules < 5 || modules > MAX_ENTRIES) {
      return json(400, { error: 'That does not look like a modsettings.lsx with mods in it.' });
    }
    entryCount = modules;
    formatLabel = 'modsettings.lsx';
  } else {
    let entries;
    try {
      const data = JSON.parse(order);
      entries = Array.isArray(data) ? data : (data.Order ?? data.Mods ?? null);
    } catch {
      return json(400, { error: 'The load order is not valid JSON. Export it from the site first.' });
    }
    if (!Array.isArray(entries) || entries.length < 5) {
      return json(400, { error: 'The load order needs at least five mods.' });
    }
    if (entries.length > MAX_ENTRIES) {
      return json(400, { error: `That is ${entries.length.toLocaleString()} entries. The limit is ${MAX_ENTRIES.toLocaleString()}.` });
    }
    entryCount = entries.length;
  }

  if (env.TURNSTILE_SECRET) {
    const form = new FormData();
    form.set('secret', env.TURNSTILE_SECRET);
    form.set('response', turnstileToken ?? '');
    form.set('remoteip', request.headers.get('cf-connecting-ip') ?? '');
    const check = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: form,
    });
    const outcome = await check.json();
    if (!outcome.success) {
      return json(403, { error: 'Could not verify you are human. Reload the page and try again.' });
    }
  }

  const status = verdict === 'working'
    ? 'Working, I have played on it'
    : 'Not working, it has problems';
  // Backtick fences delimit the order in the issue body, so they cannot be
  // allowed inside free text. Real BG3MM JSON never contains them.
  const clean = (s, max) =>
    typeof s === 'string' ? s.replace(/`/g, "'").slice(0, max).trim() : '';

  /*
   * An order VOLO sorted, played and sent back is not a second opinion: its
   * sequence is VOLO's own. Recorded so the miner can use it for which mods
   * exist and ignore it for where they go. Unanswered stays unknown, because
   * guessing either way is worse than measuring it at intake.
   */
  const arrangement = sortedByVolo === 'volo'
    ? 'I sorted it with VOLO'
    : sortedByVolo === 'self'
      ? 'I arranged it myself'
      : '_No response_';

  const head = [
    '### Does this load order work?',
    '',
    status,
    '',
    '### How was it arranged?',
    '',
    arrangement,
    '',
    '### BG3 patch',
    '',
    clean(patch, 60) || '_No response_',
    '',
    '### The load order',
    '',
  ];
  const tail = [
    '',
    '### Notes',
    '',
    clean(notes, 4000) || '_No response_',
    '',
    '_Submitted through volobg3.com_',
  ];

  const inlineBody = [...head, '```json', trimmed.replace(/`/g, "'"), '```', ...tail].join('\n');

  /*
   * Small orders stay inline, which is most of them, and the issue then holds
   * the whole thing where anyone can read it. Only what will not fit is staged
   * in R2 and referenced, because the alternative was refusing the largest
   * orders outright, and those are the ones the corpus learns most from.
   *
   * The excerpt below is deliberately not a fenced block. Intake tries every
   * candidate until one parses, so a JSON-shaped excerpt would parse first and
   * land a truncated order as though it were the whole list.
   */
  let body = inlineBody;
  const tooBig = inlineBody.length > MAX_ISSUE_BODY
    || new TextEncoder().encode(inlineBody).length > MAX_ISSUE_BODY;

  if (tooBig) {
    if (!env.SUBMISSIONS) {
      return json(413, {
        error: 'This order is too large to submit through the site. Attach the exported file to a GitHub issue instead.',
      });
    }
    const key = stagingKey();
    const digest = await sha256Hex(trimmed);
    try {
      await env.SUBMISSIONS.put(key, trimmed, {
        httpMetadata: { contentType: 'text/plain; charset=utf-8' },
      });
    } catch {
      return json(502, { error: 'Could not stage the order. Try again in a moment.' });
    }
    const url = new URL(request.url);
    const excerpt = trimmed
      .split('\n')
      .map(l => (l.match(/"Name"\s*:\s*"([^"]{1,60})"/) ?? [])[1])
      .filter(Boolean)
      .slice(0, 8)
      .join(', ');
    body = [
      ...head,
      `Stored order: ${url.origin}/api/submission/${key}`,
      `Entries: ${entryCount}`,
      `Format: ${formatLabel}`,
      `SHA-256: ${digest}`,
      '',
      excerpt ? `First entries: ${excerpt}` : 'Too large to inline.',
      ...tail,
    ].join('\n');
  }

  const res = await fetch(`https://api.github.com/repos/${REPO}/issues`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.SUBMIT_GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'volo-site-submissions',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify({
      title: 'Load order submission',
      body,
      labels: ['load-order-submission'],
    }),
  });

  if (!res.ok) {
    return json(502, { error: `The submission queue refused this one (${res.status}). Try the GitHub form instead.` });
  }

  const issue = await res.json();
  return json(201, { url: issue.html_url, number: issue.number });
}
