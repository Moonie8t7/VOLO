/**
 * Loads the external category listing: every published BG3 mod on Nexus and
 * mod.io, reduced to a name -> group index.
 *
 * The masterlist folds these categories in at build time, but only for mods a
 * submitted order contains. This file covers everything else, so a mod nobody
 * has submitted yet still lands where its own listing says it belongs instead
 * of waiting unsorted at the end. Served the same way as the masterlist: a
 * bundled copy for speed, upgraded from main when that is newer.
 */

import type { ExternalListing } from './types';

const LOCAL_URL = '/external-categories.json';
const REMOTE_URL: string | null =
  'https://raw.githubusercontent.com/Moonie8t7/VOLO/main/masterlist/external-categories.json';

let cache: ExternalListing | null = null;
let inflight: Promise<ExternalListing | null> | null = null;

async function fetchJson(url: string, timeoutMs: number): Promise<ExternalListing> {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const data = (await res.json()) as ExternalListing;
  // typeof null is 'object', so the null checks are load-bearing: a malformed
  // file that passed here would crash the sort on its first lookup.
  if (!Array.isArray(data?.groups)
    || typeof data?.nexus !== 'object' || data.nexus === null
    || typeof data?.modio !== 'object' || data.modio === null) {
    throw new Error('Malformed listing: missing groups, nexus or modio.');
  }
  return data;
}

/**
 * Returns the best listing available, or null when neither copy loads.
 *
 * Never rejects. Sorting works without it; mods the masterlist and the name
 * patterns both miss simply stay unsorted, exactly as they did before this
 * tier existed.
 */
export async function loadListing(): Promise<ExternalListing | null> {
  if (cache) return cache;
  if (inflight) return inflight;

  inflight = (async () => {
    let local: ExternalListing | null = null;
    try {
      local = await fetchJson(LOCAL_URL, 5_000);
    } catch (err) {
      console.warn('[listing] bundled copy unavailable:', err);
    }

    if (REMOTE_URL) {
      try {
        const remote = await fetchJson(REMOTE_URL, 6_000);
        const tr = Date.parse(remote.generated);
        const tl = Date.parse(local?.generated ?? '');
        if (!local || (Number.isFinite(tr) && (!Number.isFinite(tl) || tr > tl))) {
          cache = remote;
          return remote;
        }
      } catch {
        // Offline or rate-limited. The bundled copy is fine.
      }
    }

    cache = local;
    return local;
  })();

  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}
