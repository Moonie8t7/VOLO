#!/usr/bin/env node
/**
 * Builds the Nexus catalogue through the sorted GraphQL listing, most endorsed
 * first, so the mods that matter most are covered first and the whole
 * catalogue costs a few hundred requests rather than an id walk of thousands.
 *
 *   node scripts/bulk-list-nexus.mjs             full listing, resumes by offset
 *   node scripts/bulk-list-nexus.mjs --updates   newest updates first, stops on
 *                                                reaching already known state
 *
 * The full pass pages the game's published mods sorted by endorsements. The
 * updates pass pages by update recency and stops as soon as a page contains
 * nothing newer than the last sync, which makes the daily top-up a handful of
 * requests.
 *
 * A lockfile under nexus/ keeps catalogue writers from running concurrently;
 * two writers flushing the same file is how a crawl run and a search run
 * crashed each other on 2026-08-03.
 */

import fs from 'fs';
import path from 'path';

const GAME_ID = '3474';
const ENDPOINT = 'https://api.nexusmods.com/v2/graphql';
const DATA_DIR = 'nexus';
const CATALOG = path.join(DATA_DIR, 'catalog.json');
const STATE = path.join(DATA_DIR, 'listing-state.json');
const LOCK = path.join(DATA_DIR, '.lock');
const PAGE = 50;
const DELAY_MS = 400;
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
if (!KEY) { console.error('NEXUS_API_KEY is not set.'); process.exit(2); }

// One catalogue writer at a time. A stale lock (a crashed run) is reclaimed.
fs.mkdirSync(DATA_DIR, { recursive: true });
try {
  const held = JSON.parse(fs.readFileSync(LOCK, 'utf8'));
  if (Date.now() - held.at < 3 * 3600_000) {
    console.log(`another nexus job appears to be running (pid ${held.pid}); exiting`);
    process.exit(0);
  }
} catch {}
fs.writeFileSync(LOCK, JSON.stringify({ pid: process.pid, at: Date.now() }));
const releaseLock = () => { try { fs.unlinkSync(LOCK); } catch {} };
process.on('exit', releaseLock);
process.on('SIGINT', () => process.exit(130));
process.on('SIGTERM', () => process.exit(143));

const UPDATES_MODE = process.argv.includes('--updates');

const readJson = (f, fb) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return fb; } };
const catalog = readJson(CATALOG, { game: 'baldursgate3', categories: {}, mods: {} });
const state = readJson(STATE, { offset: 0, complete: false, lastSync: null });

const HEADERS = {
  apikey: KEY,
  'Content-Type': 'application/json',
  'User-Agent': 'VOLO/1.0 (volobg3.com; load order tool)',
  'Application-Name': 'VOLO',
  'Application-Version': '1.0.0',
};

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
  catalog.generated = new Date().toISOString();
  safeWrite(CATALOG, JSON.stringify(catalog) + '\n');
  safeWrite(STATE, JSON.stringify(state, null, 2) + '\n');
}

function storeNode(n) {
  const id = Number(n.modId);
  const existing = catalog.mods[id];
  catalog.mods[id] = {
    ...(existing ?? {}),
    name: n.name,
    author: n.uploader?.name ?? existing?.author ?? null,
    category: n.modCategory?.name ?? existing?.category ?? null,
    version: n.version ?? existing?.version ?? null,
    adult: Boolean(n.adultContent),
    status: 'published',
    endorsements: n.endorsements ?? 0,
    downloads: n.downloads ?? 0,
    updated: n.updatedAt ?? existing?.updated ?? null,
  };
  return existing?.updated === n.updatedAt && existing?.name === n.name;
}

const NODE_FIELDS =
  'modId name version adultContent endorsements downloads updatedAt uploader { name } modCategory { name }';

async function page(offset, sortField) {
  const sort = sortField === 'updatedAt'
    ? '[{ updatedAt: { direction: DESC } }]'
    : '[{ endorsements: { direction: DESC } }]';
  const query =
    `{ mods(filter: { gameId: [{ value: ${JSON.stringify(GAME_ID)}, op: EQUALS }] }, ` +
    `sort: ${sort}, count: ${PAGE}, offset: ${offset}) { totalCount nodes { ${NODE_FIELDS} } } }`;

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ query }),
    signal: AbortSignal.timeout(60_000),
  });
  requestsMade++;
  const daily = res.headers.get('x-rl-daily-remaining');
  if (daily !== null) dailyRemaining = Number(daily);
  if (!res.ok) return { status: res.status };
  const body = await res.json();
  if (body.errors) return { status: 500, message: body.errors[0]?.message };
  return { status: 200, ...body.data.mods };
}

let stored = 0;
const startedAt = Date.now();

if (UPDATES_MODE) {
  // Newest updates first; stop at the first page with nothing new for us.
  const since = state.lastSync ? Date.parse(state.lastSync) : 0;
  const syncStartedAt = new Date().toISOString();
  let offset = 0;
  while (true) {
    if (dailyRemaining <= DAILY_BUFFER) { console.log('daily quota nearly spent'); break; }
    const p = await page(offset, 'updatedAt');
    if (p.status !== 200) { console.log(`stopping on status ${p.status} ${p.message ?? ''}`); break; }
    let anyNew = false;
    for (const n of p.nodes) {
      const unchanged = storeNode(n);
      if (!unchanged && Date.parse(n.updatedAt ?? 0) >= since) anyNew = true;
    }
    stored += p.nodes.length;
    offset += PAGE;
    flush();
    if (!anyNew || p.nodes.length < PAGE) break;
    await sleep(DELAY_MS);
  }
  state.lastSync = syncStartedAt;
  flush();
} else {
  while (!state.complete) {
    if (dailyRemaining <= DAILY_BUFFER) { console.log('daily quota nearly spent, resuming next run'); break; }
    const p = await page(state.offset, 'endorsements');
    if (p.status !== 200) { console.log(`stopping on status ${p.status} ${p.message ?? ''}`); break; }
    for (const n of p.nodes) storeNode(n);
    stored += p.nodes.length;
    state.offset += p.nodes.length;
    if (p.nodes.length < PAGE || state.offset >= p.totalCount) {
      state.complete = true;
      state.lastSync = new Date().toISOString();
    }
    if (state.complete || state.offset % (PAGE * 5) === 0) flush();
    if (state.complete) break;
    await sleep(DELAY_MS);
  }
}

const named = Object.values(catalog.mods).filter(m => m.name).length;
const took = Math.round((Date.now() - startedAt) / 1000);
console.log(`this run: ${stored} listed in ${requestsMade} requests, ${took}s`);
console.log(`catalogue: ${named.toLocaleString()} published mods${state.complete ? ', full listing complete' : `, resumes at offset ${state.offset}`}`);
