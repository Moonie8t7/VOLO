/**
 * Application state.
 *
 * All of it lives in the browser. There is no server, no session and no upload,
 * so a load order never leaves the user's machine. State survives refreshes via
 * localStorage so someone can sort, close the tab, and come back to it.
 */

import {
  createContext, useContext, useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import type { ReactNode } from 'react';
import type { Masterlist, Mod, ExternalCategories, ParseResult, SortResult } from './types';
import { loadMasterlist, loadExternalCategories } from './masterlist';
import { sortLoadOrder } from './optimiser';

const STORAGE_KEY = 'volo.session.v1';

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

export function StoreProvider({ children }: { children: ReactNode }) {
  const restored = useRef(readSession()).current;

  const [mods, setMods] = useState<Mod[]>(restored?.mods ?? []);
  const [sourceName, setSourceName] = useState(restored?.sourceName ?? '');
  const [format, setFormat] = useState(restored?.format ?? '');
  const [importedAt, setImportedAt] = useState<string | null>(restored?.importedAt ?? null);

  const [masterlist, setMasterlist] = useState<Masterlist | null>(null);
  const [masterlistError, setMasterlistError] = useState<string | null>(null);
  const [isLoadingMasterlist, setLoading] = useState(true);
  const [externalCategories, setExternalCategories] = useState<ExternalCategories | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadExternalCategories().then(ec => { if (!cancelled && ec) setExternalCategories(ec); });
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

  // Persist. Wrapped because localStorage throws in private mode and when full.
  useEffect(() => {
    try {
      if (!mods.length) localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ mods, sourceName, format, importedAt } satisfies Session),
      );
    } catch {
      // Not worth interrupting the user over. The saved session is a convenience.
    }
  }, [mods, sourceName, format, importedAt]);

  const result = useMemo(
    () => (mods.length && masterlist ? sortLoadOrder(mods, masterlist, externalCategories) : null),
    [mods, masterlist, externalCategories],
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
    importParsed, reorder, removeMod, clear,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>');
  return ctx;
}
