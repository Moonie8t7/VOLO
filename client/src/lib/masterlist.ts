/**
 * Loads the community masterlist.
 *
 * It is a static JSON file served from the CDN, not an API call. Nothing needs to
 * run server side, the file is cacheable and versioned, and contributions arrive
 * as pull requests against the masterlist repo.
 */

import type { Masterlist } from './types';

/** Bundled copy, so the app works on first paint and when GitHub is unreachable. */
const LOCAL_URL = '/bg3-masterlist.json';

/**
 * The masterlist as it stands on main, which runs ahead of whatever shipped with
 * this build. Lets a correction reach users without a redeploy.
 *
 * Disabled while the repository is private: raw.githubusercontent.com answers 404
 * for anonymous requests to a private repo, so every visitor would collect a
 * console error on every page load for no benefit. The bundled copy is identical
 * data in the meantime.
 *
 * Re-enable by restoring the URL below once the repository is public.
 */
const REMOTE_URL: string | null = null;
// 'https://raw.githubusercontent.com/Moonie8t7/VOLO/main/masterlist/bg3-masterlist.json'

const EMPTY: Masterlist = {
  version: '0.0.0',
  generated: new Date(0).toISOString(),
  groups: [],
  plugins: [],
};

let cache: Masterlist | null = null;
let inflight: Promise<Masterlist> | null = null;

async function fetchJson(url: string, timeoutMs: number): Promise<Masterlist> {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const data = (await res.json()) as Masterlist;
  if (!Array.isArray(data?.plugins) || !Array.isArray(data?.groups)) {
    throw new Error('Malformed masterlist: missing plugins or groups.');
  }
  return data;
}

/**
 * Returns the best masterlist available, preferring the bundled copy for speed
 * and upgrading to the community one when it is newer.
 *
 * Never rejects. A failed fetch degrades to the bundled list rather than breaking
 * sorting, because a stale masterlist is far better than none.
 */
export async function loadMasterlist(): Promise<Masterlist> {
  if (cache) return cache;
  if (inflight) return inflight;

  inflight = (async () => {
    let local = EMPTY;
    try {
      local = await fetchJson(LOCAL_URL, 5_000);
    } catch (err) {
      console.warn('[masterlist] bundled copy unavailable:', err);
    }

    if (REMOTE_URL) {
      try {
        const remote = await fetchJson(REMOTE_URL, 6_000);
        if (compareVersions(remote.version, local.version) > 0) {
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

/** Semver-ish comparison. Returns >0 if a is newer. */
export function compareVersions(a = '0', b = '0'): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff) return diff;
  }
  return 0;
}
