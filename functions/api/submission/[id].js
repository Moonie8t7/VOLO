/**
 * Serves a staged load order back to the intake workflow.
 *
 * An order too large for a GitHub issue body is written to R2 by
 * functions/api/submit.js and referenced from the issue instead. This is the
 * only way back out. The bucket itself stays private: making it public would
 * turn VOLO into an open file host, whereas this route serves exactly one
 * shape of key and nothing else.
 *
 * Objects expire on their own through the bucket's lifecycle rule, so a 404
 * here is the normal fate of anything the workflow never collected.
 *
 * Environment (Cloudflare Pages settings):
 *   SUBMISSIONS  R2 bucket binding.
 */

/** Exactly what stagingKey() produces: 128 bits, lowercase hex. */
const KEY = /^[0-9a-f]{32}$/;

const notFound = () =>
  new Response('Not found.\n', {
    status: 404,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });

export async function onRequestGet({ params, env }) {
  // Checked before storage is touched, and the key is never echoed back: a
  // reflected identifier is how a probe learns which guesses are close.
  if (!KEY.test(String(params.id ?? ''))) return notFound();
  if (!env.SUBMISSIONS) return notFound();

  const object = await env.SUBMISSIONS.get(params.id);
  if (!object) return notFound();

  return new Response(object.body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      // Served to a workflow, never rendered in a browser, and the content is
      // whatever a stranger uploaded.
      'X-Content-Type-Options': 'nosniff',
      'Content-Disposition': 'attachment',
      'Cache-Control': 'no-store',
    },
  });
}
