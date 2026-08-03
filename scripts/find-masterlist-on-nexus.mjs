#!/usr/bin/env node
/**
 * Finds masterlist mods on Nexus by name search, so our own mods get catalogue
 * coverage today instead of waiting for the id-order crawl to reach them.
 *
 *   node scripts/find-masterlist-on-nexus.mjs [--max-requests N]
 *
 * For every masterlist mod not yet in the catalogue, searches the GraphQL API
 * by name, eight aliased searches per request. A hit is accepted only when the
 * best candidate's normalised name is near-identical to ours; the point is
 * precision, and an unmatched mod is better than a wrong match. Accepted hits
 * are written into nexus/catalog.json in the same shape the id crawler uses,
 * so the requirements harvester and the enricher pick them up unchanged.
 *
 * Searches already performed are remembered in nexus/search-state.json,
 * including misses, so reruns only try genuinely new names.
 */

import fs from 'fs';
import path from 'path';

const GAME_ID = '3474';
const ENDPOINT = 'https://api.nexusmods.com/v2/graphql';
const CATALOG = path.join('nexus', 'catalog.json');
const STATE = path.join('nexus', 'search-state.json');
const MASTERLIST = path.join('masterlist', 'bg3-masterlist.json');
const BATCH = 8;
const CANDIDATES = 6;
const DELAY_MS = 500;
const DAILY_BUFFER = 25;
const ACCEPT = 0.92;

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

const readJson = (f, fb) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return fb; } };
const catalog = readJson(CATALOG, { game: 'baldursgate3', categories: {}, mods: {} });
const state = readJson(STATE, { searched: {} });
const masterlist = JSON.parse(fs.readFileSync(MASTERLIST, 'utf8'));

const norm = s => String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');

function similarity(a, b) {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const grams = new Map();
  for (let i = 0; i < a.length - 1; i++) {
    const g = a.slice(i, i + 2);
    grams.set(g, (grams.get(g) || 0) + 1);
  }
  let hits = 0;
  for (let i = 0; i < b.length - 1; i++) {
    const g = b.slice(i, i + 2);
    const n = grams.get(g) || 0;
    if (n > 0) { grams.set(g, n - 1); hits++; }
  }
  return (2 * hits) / (a.length + b.length - 2);
}

// Names already represented in the catalogue need no search.
const inCatalog = new Set(
  Object.values(catalog.mods).filter(m => m.name).map(m => norm(m.name)),
);

const targets = [];
const seenTarget = new Set();
for (const p of masterlist.plugins) {
  const key = norm(p.name);
  if (!key || key.length < 3) continue;
  if (inCatalog.has(key)) continue;
  if (key in state.searched) continue;
  if (seenTarget.has(key)) continue;
  seenTarget.add(key);
  targets.push({ name: p.name, key });
}

console.log(`masterlist mods to look up: ${targets.length}`);
if (!targets.length) process.exit(0);

const sleep = ms => new Promise(r => setTimeout(r, ms));
let requestsMade = 0;
let dailyRemaining = Infinity;
let found = 0, rejected = 0;

function flush() {
  fs.writeFileSync(CATALOG, JSON.stringify(catalog) + '\n');
  fs.writeFileSync(STATE, JSON.stringify(state) + '\n');
}

for (let i = 0; i < targets.length; i += BATCH) {
  if (requestsMade >= MAX_REQUESTS) { console.log('request budget reached'); break; }
  if (dailyRemaining <= DAILY_BUFFER) { console.log('daily quota nearly spent, stopping'); break; }

  const slice = targets.slice(i, i + BATCH);
  const query = '{ ' + slice.map((t, idx) =>
    `s${idx}: mods(filter: { gameId: [{ value: ${JSON.stringify(GAME_ID)}, op: EQUALS }], ` +
    `name: [{ value: ${JSON.stringify(t.name)}, op: WILDCARD }] }, count: ${CANDIDATES}) ` +
    `{ nodes { modId name version adultContent status endorsements downloads updatedAt ` +
    `uploader { name } modCategory { name } } }`,
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
  slice.forEach((t, idx) => {
    const nodes = body.data?.[`s${idx}`]?.nodes ?? [];
    let best = null, bestScore = 0;
    for (const n of nodes) {
      const score = similarity(t.key, norm(n.name));
      if (score > bestScore || (score === bestScore && (n.endorsements ?? 0) > (best?.endorsements ?? 0))) {
        bestScore = score; best = n;
      }
    }
    if (best && bestScore >= ACCEPT) {
      const id = Number(best.modId);
      if (!catalog.mods[id]?.name) {
        catalog.mods[id] = {
          name: best.name,
          author: best.uploader?.name ?? null,
          category: best.modCategory?.name ?? null,
          version: best.version ?? null,
          adult: Boolean(best.adultContent),
          status: String(best.status ?? 'published').toLowerCase(),
          endorsements: best.endorsements ?? 0,
          downloads: best.downloads ?? 0,
          updated: best.updatedAt ?? null,
          foundBy: 'search',
        };
      }
      state.searched[t.key] = id;
      found++;
    } else {
      state.searched[t.key] = null;
      rejected++;
    }
  });

  flush();
  await sleep(DELAY_MS);
}

flush();
console.log(`searched ${found + rejected} names in ${requestsMade} requests`);
console.log(`accepted ${found}, no confident match for ${rejected}`);
