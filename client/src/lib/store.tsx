/**
 * Application state.
 *
 * All of it lives in the browser. There is no server, no session and no upload,
 * so a load order never leaves the user's machine.
 *
 * Nothing is written to localStorage unless the user turns remembering on. It
 * defaults off: a remembered order is as much a trap as a convenience, because
 * the export page will otherwise hand back a list imported days ago.
 */

import {
  createContext, useContext, useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import type { ReactNode } from 'react';
import type { Masterlist, Mod, ParseResult, SortResult } from './types';
import { loadMasterlist } from './masterlist';
import { sortLoadOrder } from './optimiser';

const STORAGE_KEY = 'volo.session.v1';
const REMEMBER_KEY = 'volo.remember.v1';

interface Session {
  mods: Mod[];
  sourceName: string;
  format: string;
  importedAt: string | null;
}

interface StoreValue {
  mods: Mod[];
  sourceName: string;
  format: string;
  importedAt: string | null;

  masterlist: Masterlist | null;
  masterlistError: string | null;
  isLoadingMasterlist: boolean;

  /** Recomputed whenever mods or the masterlist change. */
  result: SortResult | null;

  /** Whether the order survives closing the tab. Off unless the user asks. */
  remember: boolean;
  setRemember: (remember: boolean) => void;

  importParsed: (parsed: ParseResult, sourceName: string) => void;
  reorder: (from: number, to: number) => void;
  removeMod: (uuid: string) => void;
  clear: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

function readSession(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Session;
    return Array.isArray(parsed?.mods) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Remembering is off unless asked for.
 *
 * A remembered order is a trap as much as a convenience: the export page will
 * happily hand back something imported days ago, and someone who has moved on
 * to a different list finds out only when their mod manager reports mods they
 * do not have. Forgetting by default also matches what the site promises,
 * which is that VOLO holds on to nothing.
 */
function readRemember(): boolean {
  try {
    return localStorage.getItem(REMEMBER_KEY) === 'true';
  } catch {
    return false;
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const rememberedAtStart = useRef(readRemember()).current;
  // Only look for a stored order if the user asked us to keep one.
  const restored = useRef(rememberedAtStart ? readSession() : null).current;
  const [remember, setRememberState] = useState(rememberedAtStart);

  const [mods, setMods] = useState<Mod[]>(restored?.mods ?? []);
  const [sourceName, setSourceName] = useState(restored?.sourceName ?? '');
  const [format, setFormat] = useState(restored?.format ?? '');
  const [importedAt, setImportedAt] = useState<string | null>(restored?.importedAt ?? null);

  const [masterlist, setMasterlist] = useState<Masterlist | null>(null);
  const [masterlistError, setMasterlistError] = useState<string | null>(null);
  const [isLoadingMasterlist, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    loadMasterlist()
      .then(ml => {
        if (cancelled) return;
        setMasterlist(ml);
        if (!ml.plugins.length) {
          setMasterlistError('The masterlist is empty, so sorting will fall back to name patterns.');
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setMasterlistError(err instanceof Error ? err.message : 'Could not load the masterlist.');
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Persist only when asked. Wrapped because localStorage throws in private
  // mode and when full. Turning remembering off clears whatever was stored,
  // including anything left behind by an earlier visit.
  useEffect(() => {
    try {
      if (!remember || !mods.length) localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ mods, sourceName, format, importedAt } satisfies Session),
      );
    } catch {
      // Not worth interrupting the user over. The saved session is a convenience.
    }
  }, [remember, mods, sourceName, format, importedAt]);

  const setRemember = useCallback((next: boolean) => {
    setRememberState(next);
    try {
      if (next) localStorage.setItem(REMEMBER_KEY, 'true');
      else {
        localStorage.removeItem(REMEMBER_KEY);
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // Preference is best effort; the in-memory session still works.
    }
  }, []);

  const result = useMemo(
    () => (mods.length && masterlist ? sortLoadOrder(mods, masterlist) : null),
    [mods, masterlist],
  );

  const importParsed = useCallback((parsed: ParseResult, name: string) => {
    setMods(parsed.mods);
    setSourceName(name);
    setFormat(parsed.format);
    setImportedAt(new Date().toISOString());
  }, []);

  const reorder = useCallback((from: number, to: number) => {
    setMods(prev => {
      if (from === to || from < 0 || to < 0 || from >= prev.length || to >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      // Re-baseline positions so a manual nudge becomes the new "original", and
      // the next sort treats it as intent rather than something to undo.
      return next.map((m, i) => ({ ...m, originalIndex: i }));
    });
  }, []);

  const removeMod = useCallback((uuid: string) => {
    setMods(prev => prev.filter(m => m.uuid !== uuid).map((m, i) => ({ ...m, originalIndex: i })));
  }, []);

  const clear = useCallback(() => {
    setMods([]);
    setSourceName('');
    setFormat('');
    setImportedAt(null);
  }, []);

  const value: StoreValue = {
    mods, sourceName, format, importedAt,
    masterlist, masterlistError, isLoadingMasterlist,
    result,
    remember, setRemember,
    importParsed, reorder, removeMod, clear,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>');
  return ctx;
}
