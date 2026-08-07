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
 * The masterlist as it stands on main, which can run ahead of whatever shipped
 * with this build. Lets a correction reach users without waiting for a deploy.
 *
 * This was disabled while the repository was private, because
 * raw.githubusercontent.com answers 404 anonymously for private repos and every
 * visitor collected a console error for no benefit. The repository is public
 * now, so the comment that said "re-enable once public" is honoured.
 */
const REMOTE_URL: string | null =
  'https://raw.githubusercontent.com/Moonie8t7/VOLO/main/masterlist/bg3-masterlist.json';

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
        /*
         * Newer wins, judged by generation time rather than version. The
         * version field is the schema version and sits at the same value for
         * months, so comparing it meant the remote copy could never win and
         * the whole mechanism was quietly inert.
         */
        if (newerThan(remote, local)) {
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

/**
 * Whether one masterlist was generated after another.
 *
 * Falls back to the version comparison when either timestamp is unparsable,
 * so a malformed date degrades to the old behaviour rather than to a wrong
 * answer.
 */
function newerThan(a: Masterlist, b: Masterlist): boolean {
  const ta = Date.parse(a.generated);
  const tb = Date.parse(b.generated);
  if (Number.isFinite(ta) && Number.isFinite(tb)) return ta > tb;
  return compareVersions(a.version, b.version) > 0;
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
