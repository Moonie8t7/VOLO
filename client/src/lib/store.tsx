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
import type {
  ExternalListing, ImportedSection, Masterlist, Mod, ParseResult, SortResult,
} from './types';
import { loadMasterlist } from './masterlist';
import { loadListing } from './listing';
import { sortLoadOrder } from './optimiser';

const STORAGE_KEY = 'volo.session.v1';
const REMEMBER_KEY = 'volo.remember.v1';

interface Session {
  mods: Mod[];
  sourceName: string;
  format: string;
  importedAt: string | null;
  /* The user's own section headers, kept so an export can give them back. */
  sections?: ImportedSection[];
  /* Divider slots the user picked for their own unsorted mods. */
  assigned?: Record<string, number>;
}

interface StoreValue {
  mods: Mod[];
  sourceName: string;
  format: string;
  importedAt: string | null;
  /**
   * Section headers the imported file carried. Held because they are the
   * user's own divider paks, and an export that drops them hands back a load
   * order stripped of the structure they built.
   */
  sections: ImportedSection[];

  /**
   * Divider slots the user has picked for their own mods, by uuid.
   *
   * Their answer to "VOLO does not know what this is, but I do". It outranks
   * everything the masterlist says, because it is their load order, and it
   * goes no further than this browser.
   */
  assigned: Record<string, number>;
  /** Puts one or many mods on a slot. A null slot takes the choice back. */
  assignSlot: (uuids: string[], divider: number | null) => void;
  clearAssignments: () => void;

  masterlist: Masterlist | null;
  masterlistError: string | null;
  isLoadingMasterlist: boolean;

  /**
   * Start downloading the masterlist and catalogues.
   *
   * For pages that show the list itself rather than sort with it, and so have
   * no imported order to trigger the download. Idempotent, and safe to call
   * from an effect on every render.
   */
  requestMasterlist: () => void;

  /** Recomputed whenever mods or the masterlist change. */
  result: SortResult | null;

  /** Whether the order survives closing the tab. Off unless the user asks. */
  remember: boolean;
  setRemember: (remember: boolean) => void;

  /** How many mods the user has moved by hand, overriding the sort. */
  manualMoves: number;
  moveMod: (uuid: string, direction: -1 | 1) => void;
  clearManual: () => void;

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
  const [sections, setSections] = useState<ImportedSection[]>(restored?.sections ?? []);
  const [assigned, setAssigned] = useState<Record<string, number>>(restored?.assigned ?? {});

  const [masterlist, setMasterlist] = useState<Masterlist | null>(null);
  const [masterlistError, setMasterlistError] = useState<string | null>(null);
  const [isLoadingMasterlist, setLoading] = useState(false);

  /*
   * The Nexus and mod.io catalogues, for mods nothing else places. Loaded
   * alongside the masterlist but never waited on: sorting without it is the
   * old behaviour, and the sort re-runs when it arrives.
   */
  const [listing, setListing] = useState<ExternalListing | null>(null);

  /*
   * Nothing downloads until something needs it.
   *
   * The masterlist and the catalogues come to roughly a megabyte between them,
   * and each is fetched twice: the bundled copy, then the newer one on GitHub.
   * Downloading that on mount billed every page for it, the landing page
   * included, which reports a mod count it already has from the build-time
   * summary and never touches the list itself. Measured on a phone, that was
   * most of the gap between the mobile and desktop page scores. It also meant
   * every visit reached raw.githubusercontent.com whether or not the visitor
   * ever sorted anything.
   *
   * Only ever set, never cleared: a session that has needed the list once
   * should not re-enter the loading state when an order is cleared.
   */
  const [wanted, setWanted] = useState(false);
  const requestMasterlist = useCallback(() => setWanted(true), []);

  // An imported order is its own request; it cannot be sorted without the list.
  useEffect(() => {
    if (mods.length) setWanted(true);
  }, [mods.length]);

  useEffect(() => {
    if (!wanted) return;
    let cancelled = false;
    setLoading(true);
    loadListing().then(l => { if (!cancelled && l) setListing(l); });
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
  }, [wanted]);

  // Persist only when asked. Wrapped because localStorage throws in private
  // mode and when full. Turning remembering off clears whatever was stored,
  // including anything left behind by an earlier visit.
  useEffect(() => {
    try {
      if (!remember || !mods.length) localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ mods, sourceName, format, importedAt, sections, assigned } satisfies Session),
      );
    } catch {
      // Not worth interrupting the user over. The saved session is a convenience.
    }
  }, [remember, mods, sourceName, format, importedAt, sections, assigned]);

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

  const assignSlot = useCallback((uuids: string[], divider: number | null) => {
    setAssigned(prev => {
      const next = { ...prev };
      for (const uuid of uuids) {
        if (divider === null) delete next[uuid];
        else next[uuid] = divider;
      }
      return next;
    });
  }, []);

  const clearAssignments = useCallback(() => setAssigned({}), []);

  const sorted = useMemo(
    () => (mods.length && masterlist ? sortLoadOrder(mods, masterlist, listing, assigned) : null),
    [mods, masterlist, listing, assigned],
  );

  /**
   * A hand-moved mod stays where the user put it.
   *
   * Applying the move to the input would not work: the next sort would place
   * it by category all over again and silently undo the correction. So the
   * override is applied to the sorted output instead. The sort proposes, the
   * user disposes, and the export follows what is on screen. Mods the override
   * does not mention keep the position the sort gave them.
   */
  const [manualOrder, setManualOrder] = useState<string[] | null>(null);

  const result = useMemo(() => {
    if (!sorted || !manualOrder) return sorted;
    const byUuid = new Map(sorted.mods.map(m => [m.uuid, m]));
    const ordered = manualOrder.map(u => byUuid.get(u)).filter((m): m is Mod => !!m);
    for (const m of sorted.mods) if (!manualOrder.includes(m.uuid)) ordered.push(m);

    const placements = new Map(sorted.placements);
    ordered.forEach((m, position) => {
      const p = placements.get(m.uuid);
      if (p) placements.set(m.uuid, { ...p, position, movedBy: position - m.originalIndex });
    });
    return { ...sorted, mods: ordered, placements };
  }, [sorted, manualOrder]);

  const moveMod = useCallback((uuid: string, direction: -1 | 1) => {
    setManualOrder(prev => {
      const base = prev ?? result?.mods.map(m => m.uuid) ?? [];
      const from = base.indexOf(uuid);
      const to = from + direction;
      if (from === -1 || to < 0 || to >= base.length) return prev;
      const next = [...base];
      [next[from], next[to]] = [next[to], next[from]];
      return next;
    });
  }, [result]);

  const clearManual = useCallback(() => setManualOrder(null), []);

  /** How many mods sit somewhere the sort did not put them. */
  const manualMoves = useMemo(() => {
    if (!sorted || !manualOrder) return 0;
    const suggested = sorted.mods.map(m => m.uuid);
    return manualOrder.filter((u, i) => suggested[i] !== u).length;
  }, [sorted, manualOrder]);

  const importParsed = useCallback((parsed: ParseResult, name: string) => {
    setManualOrder(null);
    setMods(parsed.mods);
    setSourceName(name);
    setFormat(parsed.format);
    setSections(parsed.sections);
    setAssigned({});
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
    setManualOrder(null);
    setMods([]);
    setSourceName('');
    setFormat('');
    setSections([]);
    setAssigned({});
    setImportedAt(null);
  }, []);

  const value: StoreValue = {
    mods, sourceName, format, importedAt, sections,
    assigned, assignSlot, clearAssignments,
    masterlist, masterlistError, isLoadingMasterlist, requestMasterlist,
    result,
    remember, setRemember,
    manualMoves, moveMod, clearManual,
    importParsed, reorder, removeMod, clear,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>');
  return ctx;
}
