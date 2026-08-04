#!/usr/bin/env node
/**
 * Verifies a deployment actually serves its own assets, and repairs the edge
 * cache when it does not.
 *
 *   node scripts/verify-deploy.mjs [url]
 *
 * Why this exists: Cloudflare Pages answers a request for a missing file with
 * index.html and a 200 status. During the seconds where a new index.html is
 * live but an asset has not propagated, a request for that asset therefore
 * gets HTML, and our own /assets/* cache rule tells the edge to keep that
 * answer. The browser then refuses the file for its MIME type and the site
 * loads unstyled or not at all. It happened twice on 2026-08-04.
 *
 * Fetching an asset that is cached wrong with a cache-busting query forces a
 * fresh origin fetch, which replaces the poisoned entry, so this script both
 * detects the fault and clears it. Run it after every deploy.
 *
 * Exit codes: 0 verified, 1 still wrong after retries, 2 usage or network.
 */

import fs from 'fs';

const SITE = process.argv[2] ?? 'https://volobg3.com';
const DIST = 'dist/index.html';
const ATTEMPTS = 20;
const GAP_MS = 15_000;

const EXPECTED_TYPE = { css: 'text/css', js: 'javascript' };

const sleep = ms => new Promise(r => setTimeout(r, ms));

if (!fs.existsSync(DIST)) {
  console.error(`no ${DIST}; run npm run build first`);
  process.exit(2);
}

const localAssets = [...fs.readFileSync(DIST, 'utf8').matchAll(/\/assets\/[A-Za-z0-9._-]+/g)]
  .map(m => m[0]);
const unique = [...new Set(localAssets)];
if (!unique.length) {
  console.error('no /assets/ references found in the built index.html');
  process.exit(2);
}
console.log(`expecting ${unique.length} assets:`);
for (const a of unique) console.log(`  ${a}`);

/** Browser-like requests, because the edge caches variants separately. */
const VARIANTS = [
  { label: 'plain', headers: {} },
  {
    label: 'cors',
    headers: {
      Origin: SITE,
      Referer: `${SITE}/`,
      'Accept-Encoding': 'gzip, deflate, br, zstd',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/151.0.0.0 Safari/537.36',
    },
  },
];

async function typeOf(url, headers) {
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(20_000) });
  return {
    status: res.status,
    type: res.headers.get('content-type') ?? '',
    cache: res.headers.get('cf-cache-status') ?? '',
  };
}

/** Wait until the live index.html references the assets we just built. */
let live = false;
for (let i = 1; i <= ATTEMPTS; i++) {
  const html = await fetch(`${SITE}/?deploy-check=${Date.now()}`, {
    headers: { 'Cache-Control': 'no-cache' },
    signal: AbortSignal.timeout(20_000),
  }).then(r => r.text()).catch(() => '');

  if (unique.every(a => html.includes(a))) { live = true; break; }
  console.log(`attempt ${i}: deployment not live yet`);
  await sleep(GAP_MS);
}

if (!live) {
  console.error('the deployment never went live within the wait window');
  process.exit(1);
}
console.log('deployment is live; checking assets');

let failures = 0;
for (const asset of unique) {
  const ext = asset.split('.').pop();
  const want = EXPECTED_TYPE[ext];
  if (!want) continue;

  for (const variant of VARIANTS) {
    let result = await typeOf(SITE + asset, variant.headers);
    if (!result.type.includes(want)) {
      // Poisoned or not yet propagated. A cache-busting fetch pulls the file
      // from the origin and replaces what the edge is holding.
      console.log(`  repairing ${asset} (${variant.label}): got ${result.type}`);
      await fetch(`${SITE}${asset}?cachebust=${Date.now()}`, {
        headers: { ...variant.headers, 'Cache-Control': 'no-cache' },
        signal: AbortSignal.timeout(20_000),
      }).catch(() => {});
      await sleep(2_000);
      result = await typeOf(SITE + asset, { ...variant.headers, 'Cache-Control': 'no-cache' });
    }

    if (result.type.includes(want)) {
      console.log(`  ok    ${asset} (${variant.label}) ${result.type} ${result.cache}`);
    } else {
      failures++;
      console.log(`  FAIL  ${asset} (${variant.label}) served ${result.type}`);
    }
  }
}

console.log(failures ? `\n${failures} asset checks failed\n` : '\nDeployment verified.\n');
process.exit(failures ? 1 : 0);
