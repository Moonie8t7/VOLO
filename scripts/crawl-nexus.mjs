#!/usr/bin/env node
/**
 * Crawls the Nexus Mods catalogue for Baldur's Gate 3 through the official API
 * and maintains a local reference database at nexus/catalog.json.
 *
 *   node scripts/crawl-nexus.mjs [--max-requests N]
 *
 * Needs NEXUS_API_KEY in the environment or in a .env file at the repo root.
 * Get a personal key from nexusmods.com under Site preferences, API keys.
 *
 * Design constraints, in order:
 *   - Official API only. No HTML scraping; it breaks their terms and the
 *     request-time version of this idea is what sank VOLO v1.
 *   - Respect the rate limit. The API allows 2,500 requests a day; the crawler
 *     reads the remaining-quota headers and stops with a healthy buffer, so the
 *     full catalogue arrives over several daily runs rather than one hammering.
 *   - Resumable. State lives in nexus/crawl-state.json; every run continues
 *     where the last stopped, and the catalogue is flushed to disk regularly so
 *     a crash loses at most a few records.
 *   - Minimal fields. Enough to join against the masterlist and categorise:
 *     never a mirror of their site.
 *
 * Mod IDs are sequential per game, so the crawl walks IDs from 1 up to the
 * newest ID reported by the latest_added endpoint. Deleted and hidden mods are
 * recorded by status so the gap is knowledge rather than a mystery.
 */

import fs from 'fs';
import path from 'path';

const GAME = 'baldursgate3';
const API = 'https://api.nexusmods.com/v1';
const DATA_DIR = 'nexus';
const CATALOG = path.join(DATA_DIR, 'catalog.json');
const STATE = path.join(DATA_DIR, 'crawl-state.json');
const DAILY_BUFFER = 25;        // stop while this much quota remains
const FLUSH_EVERY = 50;         // records between disk writes
const DELAY_MS = 350;           // pause between requests

// .env loader, deliberately tiny so no dependency is needed. Strips surrounding
// quotes because pasted keys often arrive wrapped in them, and a quoted key
// authenticates as nothing.
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
  console.error('Create one at nexusmods.com, Site preferences, API keys, then either');
  console.error('export it or put NEXUS_API_KEY=... in a .env file at the repo root.');
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

const argMax = process.argv.indexOf('--max-requests');
const MAX_REQUESTS = argMax !== -1 ? Number(process.argv[argMax + 1]) : Infinity;

const HEADERS = {
  apikey: KEY,
  'User-Agent': 'VOLO/1.0 (volobg3.com; load order tool)',
        'Application-Name': 'VOLO',
        'Application-Version': '1.0.0',
  Accept: 'application/json',
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

let requestsMade = 0;
let dailyRemaining = Infinity;
let hourlyRemaining = Infinity;
let hourlyReset = null;

/** Header format is "2026-08-03 12:00:00 +0000". */
function parseReset(value) {
  if (!value) return null;
  const t = Date.parse(value.replace(' ', 'T').replace(' +0000', 'Z'));
  return Number.isNaN(t) ? null : t;
}

/** The hourly window is a pause, not a stop: sleep through it and carry on. */
async function waitForHourlyWindow() {
  const wait = hourlyReset
    ? Math.max(hourlyReset - Date.now() + 30_000, 60_000)
    : 10 * 60_000;
  if (wait > 70 * 60_000) return false;
  console.log(`hourly window spent, waiting ${Math.ceil(wait / 60_000)} minutes`);
  await sleep(wait);
  hourlyRemaining = Infinity;
  return true;
}

/** One API call with quota tracking and one retry on throttle. */
async function call(pathname) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(`${API}${pathname}`, {
      headers: HEADERS,
      signal: AbortSignal.timeout(30_000),
    });
    requestsMade++;

    const daily = res.headers.get('x-rl-daily-remaining');
    if (daily !== null) dailyRemaining = Number(daily);
    const hourly = res.headers.get('x-rl-hourly-remaining');
    if (hourly !== null) hourlyRemaining = Number(hourly);
    hourlyReset = parseReset(res.headers.get('x-rl-hourly-reset')) ?? hourlyReset;

    if (res.status === 429) {
      if (attempt === 0 && await waitForHourlyWindow()) continue;
      return { status: 429 };
    }
    if (res.ok) return { status: 200, body: await res.json() };
    return { status: res.status };
  }
}

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}

fs.mkdirSync(DATA_DIR, { recursive: true });
const catalog = readJson(CATALOG, {
  game: GAME,
  categories: {},
  mods: {},
});
const state = readJson(STATE, { nextId: 1, maxId: 0, complete: false });

function flush() {
  catalog.generated = new Date().toISOString();
  catalog.provenance = {
    scannedThrough: state.nextId - 1,
    newestKnownId: state.maxId,
    complete: state.complete,
  };
  fs.writeFileSync(CATALOG, JSON.stringify(catalog) + '\n');
  fs.writeFileSync(STATE, JSON.stringify(state, null, 2) + '\n');
}

// Game metadata carries the category vocabulary; refresh it every run.
{
  const res = await call(`/games/${GAME}.json`);
  if (res.status !== 200) {
    console.error(`Could not reach the API (status ${res.status}). Check the key.`);
    process.exit(1);
  }
  for (const c of res.body.categories ?? []) {
    catalog.categories[c.category_id] = c.name;
  }
  console.log(`game: ${res.body.name}, ${res.body.mods?.toLocaleString?.() ?? '?'} mods reported, ${Object.keys(catalog.categories).length} categories`);
}

// The newest mod ID is the crawl ceiling, taken from the latest additions.
{
  const res = await call(`/games/${GAME}/mods/latest_added.json`);
  if (res.status === 200 && Array.isArray(res.body)) {
    const newest = Math.max(...res.body.map(m => m.mod_id));
    if (newest > state.maxId) {
      state.maxId = newest;
      state.complete = false;
    }
  }
  console.log(`crawl range: ${state.nextId} to ${state.maxId}`);
}

let stored = 0, missing = 0, hidden = 0;
const startedAt = Date.now();

while (state.nextId <= state.maxId) {
  if (requestsMade >= MAX_REQUESTS) { console.log('request budget reached'); break; }
  if (dailyRemaining <= DAILY_BUFFER) { console.log(`daily quota nearly spent (${dailyRemaining} left), stopping`); break; }
  if (hourlyRemaining <= 10 && !(await waitForHourlyWindow())) {
    console.log('hourly window unclear, stopping for this run');
    break;
  }

  const id = state.nextId;
  const res = await call(`/games/${GAME}/mods/${id}.json`);

  if (res.status === 200) {
    const m = res.body;
    catalog.mods[id] = {
      name: m.name ?? null,
      author: m.author ?? m.uploaded_by ?? null,
      category: catalog.categories[m.category_id] ?? String(m.category_id ?? ''),
      version: m.version ?? null,
      adult: Boolean(m.contains_adult_content),
      status: m.status ?? 'published',
      endorsements: m.endorsement_count ?? 0,
      downloads: m.mod_downloads ?? 0,
      updated: m.updated_time ?? null,
    };
    stored++;
  } else if (res.status === 404) {
    catalog.mods[id] = { status: 'removed' };
    missing++;
  } else if (res.status === 403) {
    catalog.mods[id] = { status: 'hidden' };
    hidden++;
  } else if (res.status === 429) {
    console.log('throttled twice, stopping for this run');
    break;
  } else {
    console.log(`id ${id}: unexpected status ${res.status}, skipping`);
  }

  state.nextId = id + 1;
  if ((stored + missing + hidden) % FLUSH_EVERY === 0) flush();
  await sleep(DELAY_MS);
}

if (state.nextId > state.maxId) state.complete = true;
flush();

const took = Math.round((Date.now() - startedAt) / 1000);
const total = Object.values(catalog.mods).filter(m => m.status === 'published' || m.name).length;
console.log('');
console.log(`this run: ${stored} stored, ${missing} removed, ${hidden} hidden, ${requestsMade} requests in ${took}s`);
console.log(`catalogue: ${total.toLocaleString()} published mods, scanned through id ${state.nextId - 1} of ${state.maxId}`);
console.log(state.complete
  ? 'catalogue is complete; future runs top up new releases only'
  : `about ${Math.ceil((state.maxId - state.nextId + 1) / 2400)} more daily runs to finish the initial crawl`);
