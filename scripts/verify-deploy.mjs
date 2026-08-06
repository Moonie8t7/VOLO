#!/usr/bin/env node
/**
 * Verifies a deployment actually serves its own assets, and repairs the edge
 * cache when it does not.
 *
 *   node scripts/verify-deploy.mjs [url] [--expect <string>]
 *
 * Checks whatever the live page references rather than whatever the local
 * build produced. The host runs its own build, which regenerates the masterlist
 * and so yields different content hashes; waiting for local filenames to appear
 * meant waiting forever. Pass --expect to also assert the served bundle
 * contains a string unique to the change being shipped.
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

const SITE = process.argv[2] ?? 'https://volobg3.com';
const ATTEMPTS = 20;
const GAP_MS = 15_000;

const EXPECTED_TYPE = { css: 'text/css', js: 'javascript' };

const sleep = ms => new Promise(r => setTimeout(r, ms));

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

const expect = process.argv.includes('--expect')
  ? process.argv[process.argv.indexOf('--expect') + 1]
  : null;

/** Asset paths the live page actually asks for. */
async function liveAssets() {
  const html = await fetch(`${SITE}/?deploy-check=${Date.now()}`, {
    headers: { 'Cache-Control': 'no-cache' },
    signal: AbortSignal.timeout(20_000),
  }).then(r => r.text());
  return [...new Set([...html.matchAll(/\/assets\/[A-Za-z0-9._-]+/g)].map(m => m[0]))];
}

let unique = [];
for (let i = 1; i <= ATTEMPTS; i++) {
  unique = await liveAssets().catch(() => []);
  if (!unique.length) {
    console.log(`attempt ${i}: no assets referenced yet`);
    await sleep(GAP_MS);
    continue;
  }
  if (!expect) break;

  const js = unique.find(a => a.endsWith('.js'));
  const body = js
    ? await fetch(SITE + js, { signal: AbortSignal.timeout(30_000) }).then(r => r.text()).catch(() => '')
    : '';
  if (body.includes(expect)) break;
  console.log(`attempt ${i}: live bundle does not contain "${expect}" yet`);
  if (i === ATTEMPTS) {
    console.error(`gave up waiting for "${expect}" to appear`);
    process.exit(1);
  }
  await sleep(GAP_MS);
}

console.log(`live page references ${unique.length} assets:`);
for (const a of unique) console.log(`  ${a}`);

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

/**
 * Routing, which nothing local can check.
 *
 * public/404.html turns off the host's fallback to index.html, so every real
 * route depends on having been prerendered to a file of its own. Miss one and
 * that page is simply gone in production while everything still passes locally,
 * because vite preview answers any unknown path with index.html. This is the
 * only place the arrangement is exercised against the real host.
 */
const ROUTES = [
  '/', '/import', '/optimise', '/optimizer', '/export',
  '/submit', '/masterlist', '/measured', '/about', '/donations', '/support',
];

console.log('\nroutes:');
for (const route of ROUTES) {
  const res = await fetch(SITE + route, {
    headers: { 'Cache-Control': 'no-cache' },
    signal: AbortSignal.timeout(20_000),
  }).catch(() => null);

  if (res?.status === 200) {
    console.log(`  ok    ${route} 200`);
  } else {
    failures++;
    console.log(`  FAIL  ${route} answered ${res ? res.status : 'no response'}`);
  }
}

const missing = `/definitely-not-a-page-${Date.now()}`;
const res404 = await fetch(SITE + missing, {
  headers: { 'Cache-Control': 'no-cache' },
  signal: AbortSignal.timeout(20_000),
}).catch(() => null);

if (res404?.status === 404) {
  console.log('  ok    unknown paths answer 404');
} else {
  failures++;
  console.log(`  FAIL  unknown path answered ${res404 ? res404.status : 'no response'}, expected 404`);
}

console.log(failures ? `\n${failures} checks failed\n` : '\nDeployment verified.\n');
process.exit(failures ? 1 : 0);
