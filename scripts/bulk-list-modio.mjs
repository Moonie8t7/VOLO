#!/usr/bin/env node
/**
 * Builds a mod.io catalogue for BG3, the platform behind the official in-game
 * mod manager at baldursgate3.game. Ported from the Nexus listing crawler so
 * both ecosystems end up in the same shape of reference database.
 *
 *   node scripts/bulk-list-modio.mjs             full listing, resumes by offset
 *   node scripts/bulk-list-modio.mjs --updates   newest updates first, stops on
 *                                                reaching already known state
 *   node scripts/bulk-list-modio.mjs --deps      fetch dependency lists for
 *                                                mods the listing flagged
 *
 * Needs MODIO_API_KEY in .env, a read key from https://mod.io/me/access.
 * mod.io categorises through per-game tags rather than a category tree, so
 * tags are stored verbatim; mapping them into masterlist groups is a separate
 * review, the same as it was for Nexus categories.
 *
 * A lockfile under modio/ keeps catalogue writers from running concurrently,
 * for the same reason the Nexus crawler has one.
 */

import fs from 'fs';
import path from 'path';

/**
 * api.mod.io is deprecated; the live API answers on per-game modapi.io
 * subdomains. BG3 is game 6715 (resolved via the old domain's games search,
 * which still answers that one query).
 */
const GAME_ID = 6715;
const API = `https://g-${GAME_ID}.modapi.io/v1`;
const GAME_NAME_ID = 'baldursgate3';
const DATA_DIR = 'modio';
const CATALOG = path.join(DATA_DIR, 'catalog.json');
const STATE = path.join(DATA_DIR, 'listing-state.json');
const LOCK = path.join(DATA_DIR, '.lock');
const PAGE = 100;
const DELAY_MS = 700;

try {
  for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
    }
  }
} catch {}

const KEY = process.env.MODIO_API_KEY;
if (!KEY) {
  console.error('MODIO_API_KEY is not set. Create a read key at https://mod.io/me/access and add it to .env');
  process.exit(2);
}

fs.mkdirSync(DATA_DIR, { recursive: true });
try {
  const held = JSON.parse(fs.readFileSync(LOCK, 'utf8'));
  if (Date.now() - held.at < 3 * 3600_000) {
    console.log(`another modio job appears to be running (pid ${held.pid}); exiting`);
    process.exit(0);
  }
} catch {}
fs.writeFileSync(LOCK, JSON.stringify({ pid: process.pid, at: Date.now() }));
const releaseLock = () => { try { fs.unlinkSync(LOCK); } catch {} };
process.on('exit', releaseLock);
process.on('SIGINT', () => process.exit(130));
process.on('SIGTERM', () => process.exit(143));

const UPDATES_MODE = process.argv.includes('--updates');
const DEPS_MODE = process.argv.includes('--deps');

const readJson = (f, fb) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return fb; } };
const catalog = readJson(CATALOG, { game: GAME_NAME_ID, gameId: null, mods: {} });
const state = readJson(STATE, { offset: 0, complete: false, lastSync: null, depsDone: [] });

const sleep = ms => new Promise(r => setTimeout(r, ms));
let requestsMade = 0;

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
  catalog.provenance = {
    source: 'mod.io API v1',
    note: 'Minimal listing fields only; tags are game-defined and stored verbatim.',
  };
  safeWrite(CATALOG, JSON.stringify(catalog) + '\n');
  safeWrite(STATE, JSON.stringify(state, null, 2) + '\n');
}

/**
 * mod.io rate limit arrives via X-Ratelimit headers and 429 with Retry-After.
 * Honour both; the polite delay between pages keeps us far from the ceiling.
 */
async function get(pathname, params = {}) {
  const url = new URL(API + pathname);
  url.searchParams.set('api_key', KEY);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'VOLO/1.0 (volobg3.com; load order tool)' },
      signal: AbortSignal.timeout(60_000),
    });
    requestsMade++;
    if (res.status === 429) {
      const wait = Number(res.headers.get('retry-after') ?? 60);
      console.log(`rate limited, waiting ${wait}s`);
      await sleep(wait * 1000);
      continue;
    }
    if (!res.ok) return { status: res.status };
    return { status: 200, body: await res.json() };
  }
  return { status: 429 };
}

function storeMod(m) {
  const existing = catalog.mods[m.id];
  const updated = m.date_updated ? new Date(m.date_updated * 1000).toISOString() : null;
  catalog.mods[m.id] = {
    ...(existing ?? {}),
    name: m.name ?? existing?.name ?? null,
    nameId: m.name_id ?? existing?.nameId ?? null,
    author: m.submitted_by?.username ?? existing?.author ?? null,
    tags: Array.isArray(m.tags) ? m.tags.map(t => t.name) : existing?.tags ?? [],
    adult: (m.maturity_option ?? 0) !== 0,
    status: m.status === 1 ? 'published' : 'other',
    downloads: m.stats?.downloads_total ?? existing?.downloads ?? 0,
    subscribers: m.stats?.subscribers_total ?? existing?.subscribers ?? 0,
    updated,
    hasDependencies: Boolean(m.dependencies),
  };
  return existing?.updated === updated && existing?.name === m.name;
}

let stored = 0;
const startedAt = Date.now();
const gameId = GAME_ID;
catalog.gameId = GAME_ID;

if (DEPS_MODE) {
  // Dependency lists cost one request per flagged mod, so only fetch for mods
  // the listing marked and that we have not resolved before.
  const done = new Set(state.depsDone);
  const wanted = Object.entries(catalog.mods)
    .filter(([id, m]) => m.hasDependencies && !done.has(Number(id)))
    .sort((a, b) => (b[1].downloads ?? 0) - (a[1].downloads ?? 0));
  console.log(`${wanted.length} mods flagged with dependencies and not yet fetched`);
  for (const [id, mod] of wanted) {
    const r = await get(`/games/${gameId}/mods/${id}/dependencies`);
    if (r.status !== 200) { console.log(`stopping on status ${r.status}`); break; }
    mod.dependsOn = (r.body.data ?? []).map(d => ({ id: d.mod_id, name: d.name ?? null }));
    done.add(Number(id));
    state.depsDone = [...done];
    stored++;
    if (stored % 25 === 0) flush();
    await sleep(DELAY_MS);
  }
  flush();
} else if (UPDATES_MODE) {
  const since = state.lastSync ? Date.parse(state.lastSync) : 0;
  const syncStartedAt = new Date().toISOString();
  let offset = 0;
  while (true) {
    const r = await get(`/games/${gameId}/mods`, { _limit: PAGE, _offset: offset, _sort: '-date_updated' });
    if (r.status !== 200) { console.log(`stopping on status ${r.status}`); break; }
    let anyNew = false;
    for (const m of r.body.data) {
      const unchanged = storeMod(m);
      if (!unchanged && (m.date_updated ?? 0) * 1000 >= since) anyNew = true;
    }
    stored += r.body.data.length;
    offset += PAGE;
    flush();
    if (!anyNew || r.body.data.length < PAGE) break;
    await sleep(DELAY_MS);
  }
  state.lastSync = syncStartedAt;
  flush();
} else {
  while (!state.complete) {
    const r = await get(`/games/${gameId}/mods`, { _limit: PAGE, _offset: state.offset, _sort: '-downloads' });
    if (r.status !== 200) { console.log(`stopping on status ${r.status}, resuming next run`); break; }
    for (const m of r.body.data) storeMod(m);
    stored += r.body.data.length;
    state.offset += r.body.data.length;
    if (r.body.data.length < PAGE || state.offset >= r.body.result_total) {
      state.complete = true;
      state.lastSync = new Date().toISOString();
    }
    flush();
    if (state.complete) break;
    await sleep(DELAY_MS);
  }
}

const named = Object.values(catalog.mods).filter(m => m.name).length;
const took = Math.round((Date.now() - startedAt) / 1000);
console.log(`this run: ${stored} processed in ${requestsMade} requests, ${took}s`);
console.log(`catalogue: ${named.toLocaleString()} mods${state.complete ? ', full listing complete' : `, resumes at offset ${state.offset}`}`);
