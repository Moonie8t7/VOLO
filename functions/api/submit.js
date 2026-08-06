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
 */

const REPO = 'Moonie8t7/VOLO';
const MAX_BODY = 2 * 1024 * 1024;

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
      .replace(/\/(?:home|Users)\/[^/\t"\r\n]+\/(?:[^/\t"\r\n]*\/)*([^/\t"\r\n]+)/g, '$1')
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
  if (trimmed.startsWith('<?xml')) {
    const modules = (trimmed.match(/ModuleShortDesc/g) ?? []).length;
    if (!trimmed.includes('ModuleSettings') || modules < 5 || modules > 10000) {
      return json(400, { error: 'That does not look like a modsettings.lsx with mods in it.' });
    }
  } else {
    let entries;
    try {
      const data = JSON.parse(order);
      entries = Array.isArray(data) ? data : (data.Order ?? data.Mods ?? null);
    } catch {
      return json(400, { error: 'The load order is not valid JSON. Export it from the site first.' });
    }
    if (!Array.isArray(entries) || entries.length < 5 || entries.length > 5000) {
      return json(400, { error: 'The load order needs at least five mods.' });
    }
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

  const body = [
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
    '```json',
    order.replace(/`/g, "'").trim(),
    '```',
    '',
    '### Notes',
    '',
    clean(notes, 4000) || '_No response_',
    '',
    '_Submitted through volobg3.com_',
  ].join('\n');

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
