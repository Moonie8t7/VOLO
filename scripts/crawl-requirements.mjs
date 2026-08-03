#!/usr/bin/env node
/**
 * Harvests the Requirements table for every catalogued mod through the Nexus
 * GraphQL API and stores it in nexus/catalog.json as req arrays.
 *
 *   node scripts/crawl-requirements.mjs [--max-requests N]
 *
 * Requirements are the most load-order-valuable data on Nexus: "requires X" is
 * a hard load-after edge, and mod authors maintain these tables themselves.
 * The v1 endpoint the main crawler uses does not expose them; the GraphQL API
 * does, and it accepts aliased queries, so one request covers fifty mods.
 *
 * A mod is checked when it has a req key, so reruns only visit new arrivals.
 * External requirements (tools and off-site links) are kept but flagged; only
 * Nexus-mod requirements become load order edges downstream.
 */

import fs from 'fs';
import path from 'path';

const GAME_ID = 3474;
const ENDPOINT = 'https://api.nexusmods.com/v2/graphql';
const CATALOG = path.join('nexus', 'catalog.json');
const BATCH = 50;
const DELAY_MS = 500;
const DAILY_BUFFER = 25;

try {
  for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
    }
  }
} catch {}

const KEY = process.env.NEXUS_API_KEY;
if (!KEY) {
  console.error('NEXUS_API_KEY is not set.');
  process.exit(2);
}
// One catalogue writer at a time; concurrent flushes crash each other.
try {
  const held = JSON.parse(fs.readFileSync(path.join('nexus', '.lock'), 'utf8'));
  if (Date.now() - held.at < 3 * 3600_000) {
    console.log(`another nexus job appears to be running (pid ${held.pid}); exiting`);
    process.exit(0);
  }
} catch {}
fs.writeFileSync(path.join('nexus', '.lock'), JSON.stringify({ pid: process.pid, at: Date.now() }));
process.on('exit', () => { try { fs.unlinkSync(path.join('nexus', '.lock')); } catch {} });
process.on('SIGINT', () => process.exit(130));
process.on('SIGTERM', () => process.exit(143));

if (!fs.existsSync(CATALOG)) {
  console.error('No nexus/catalog.json yet. Run scripts/crawl-nexus.mjs first.');
  process.exit(2);
}

const argMax = process.argv.indexOf('--max-requests');
const MAX_REQUESTS = argMax !== -1 ? Number(process.argv[argMax + 1]) : Infinity;

const catalog = JSON.parse(fs.readFileSync(CATALOG, 'utf8'));
const pending = Object.entries(catalog.mods)
  .filter(([, m]) => m.name && m.status === 'published' && !('req' in m))
  .map(([id]) => Number(id));

console.log(`mods needing a requirements check: ${pending.length}`);
if (!pending.length) process.exit(0);

const sleep = ms => new Promise(r => setTimeout(r, ms));
let requestsMade = 0;
let dailyRemaining = Infinity;

/**
 * Antivirus scanners on Windows briefly lock freshly written files, which
 * surfaces as UNKNOWN errors on the next write. Writing to a temp file and
 * renaming over the target, with retries, rides through the lock window and
 * never leaves a torn file for readers.
 */
function safeWrite(file, data) {
  const tmp = file + '.tmp';
  for (let attempt = 0; ; attempt++) {
    try {
      fs.writeFileSync(tmp, data);
      fs.renameSync(tmp, file);
      return;
    } catch (err) {
      if (attempt >= 5) throw err;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 300 * (attempt + 1));
    }
  }
}

function flush() {
  safeWrite(CATALOG, JSON.stringify(catalog) + '\n');
}

let stored = 0, withReqs = 0, edges = 0;

for (let i = 0; i < pending.length; i += BATCH) {
  if (requestsMade >= MAX_REQUESTS) { console.log('request budget reached'); break; }
  if (dailyRemaining <= DAILY_BUFFER) { console.log('daily quota nearly spent, stopping'); break; }

  const slice = pending.slice(i, i + BATCH);
  const query = '{ ' + slice.map(id =>
    `m${id}: mod(gameId: ${GAME_ID}, modId: ${id}) { modId modRequirements { nexusRequirements { nodes { modName modId notes externalRequirement url } } } }`,
  ).join(' ') + ' }';

  let res;
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        apikey: KEY,
        'Content-Type': 'application/json',
        'User-Agent': 'VOLO/1.0 (volobg3.com; load order tool)',
        'Application-Name': 'VOLO',
        'Application-Version': '1.0.0',
      },
      body: JSON.stringify({ query }),
      signal: AbortSignal.timeout(60_000),
    });
  } catch (err) {
    console.log(`batch at ${i}: network error (${err.message}), stopping`);
    break;
  }
  requestsMade++;
  const daily = res.headers.get('x-rl-daily-remaining');
  if (daily !== null) dailyRemaining = Number(daily);

  if (res.status === 429) { console.log('throttled, stopping for this run'); break; }
  if (!res.ok) { console.log(`batch at ${i}: status ${res.status}, stopping`); break; }

  const body = await res.json();
  for (const id of slice) {
    const node = body.data?.[`m${id}`];
    const nodes = node?.modRequirements?.nexusRequirements?.nodes ?? [];
    const req = nodes.map(r => {
      const entry = { name: r.modName };
      if (r.modId && !r.externalRequirement) entry.id = Number(r.modId);
      if (r.externalRequirement) entry.external = true;
      if (r.notes) entry.notes = r.notes;
      if (r.externalRequirement && r.url) entry.url = r.url;
      return entry;
    });
    catalog.mods[id].req = req;
    stored++;
    if (req.length) { withReqs++; edges += req.filter(r => !r.external).length; }
  }

  flush();
  await sleep(DELAY_MS);
}

flush();
console.log(`checked ${stored} mods in ${requestsMade} requests`);
console.log(`${withReqs} declare requirements, ${edges} nexus-mod dependency edges captured`);
const remaining = pending.length - stored;
if (remaining > 0) console.log(`${remaining} still to check on the next run`);
