/**
 * The sorted order, with the reasoning behind every placement and any issues
 * found in the order as it arrived.
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import { Link } from 'wouter';
import {
  Search, AlertTriangle, Info, XCircle, ArrowRight, Download, ChevronDown, ChevronUp, Layers,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useStore } from '@/lib/store';
import { countWord } from '@/lib/words';
import dividers from '@/lib/dividers.json';
import type { Issue, IssueSeverity, Mod, Placement, SortResult } from '@/lib/types';

/**
 * How a category was decided, and how loudly to say so.
 *
 * A placement from the corpus is the silent default; anything weaker is
 * labelled in the row itself. The product is called Verified, so a keyword
 * guess must not be indistinguishable from evidence at a glance.
 */
const PROVENANCE: Record<Placement['groupSource'], { short: string; full: string }> = {
  masterlist: { short: '', full: 'Category from the community masterlist.' },
  curated: { short: 'curated', full: 'Placed by a hand-written maintainer rule, not mined from data.' },
  inferred: { short: 'inferred', full: 'Inferred from where this mod sits in submitted orders.' },
  listing: { short: 'listing', full: "From the mod's own Nexus or mod.io listing. Nobody has placed it in an order yet." },
  author: { short: 'author', full: "Placed where this author's other catalogued mods sit. Nobody has placed or listed this mod itself yet." },
  'name-pattern': { short: 'guessed', full: 'Guessed from the mod name. Nobody has placed this one yet.' },
  default: { short: 'unplaced', full: 'No category information yet.' },
  you: { short: 'you', full: 'You put this here. It stays in your list and is sent nowhere.' },
};

/**
 * Counts mods by how their category was decided.
 *
 * The buckets are exclusive and sum to the total, which the previous strip did
 * not: it counted some mods twice and omitted others, so the figures never
 * reconciled against the number of mods on screen.
 */
function countByProvenance(result: SortResult): Record<Placement['groupSource'], number> {
  const counts: Record<Placement['groupSource'], number> = {
    masterlist: 0, curated: 0, inferred: 0, listing: 0, author: 0, 'name-pattern': 0, default: 0, you: 0,
  };
  for (const mod of result.mods) {
    counts[result.placements.get(mod.uuid)?.groupSource ?? 'default'] += 1;
  }
  return counts;
}

/**
 * Nudges one mod earlier or later in the order.
 *
 * Buttons rather than a drag handle: they work on a phone, they work from a
 * keyboard, and dragging through a list of several hundred mods is miserable.
 */
function MoveControls({ name, onMove }: { name: string; onMove: (d: -1 | 1) => void }) {
  const button =
    'flex h-5 w-6 items-center justify-center text-muted-foreground/50 ' +
    'opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100 ' +
    'hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none ' +
    'focus-visible:ring-1 focus-visible:ring-ring';

  return (
    <span className="flex w-6 shrink-0 flex-col pl-1">
      <button type="button" aria-label={`Move ${name} earlier`} className={button}
        onClick={() => onMove(-1)}>
        <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      <button type="button" aria-label={`Move ${name} later`} className={button}
        onClick={() => onMove(1)}>
        <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </span>
  );
}

/**
 * Divider slot numbers to the leaf of their label, e.g. 45 to "Feats".
 *
 * The slot is what actually decides where a mod sits, and it is finer than the
 * group: calling a feats mod "Classes" is true but not the reason it sits
 * where it does, and it reads as wrong to anyone who knows the taxonomy.
 */
const SLOT_LABEL: Map<number, string> = new Map(
  (dividers.all as { num: number; name: string }[]).map(d => {
    const parts = d.name.split(String.fromCharCode(183)).map(p => p.trim());
    let leaf = parts[parts.length - 1] ?? d.name;
    // Catch-all leaves are meaningless alone: "Other" says nothing, "UI Other"
    // says where. The section is the second segment, after the number.
    if (/^Other/i.test(leaf) && parts.length >= 3) leaf = `${parts[parts.length - 2]} ${leaf}`;
    return [d.num, leaf.replace(/[^\x20-\x7E]/g, '').trim()];
  }),
);

/**
 * Astra's skeleton as the two-level thing it already is: fifteen categories,
 * each with a handful of slots.
 *
 * Asked for as two small choices rather than one list of a hundred and thirty
 * one. Picking only the category is a real answer, not a half-finished one: a
 * category heading carries a sort position inside its own section, so a mod
 * filed as Customization lands among the customization mods rather than on the
 * boundary. Someone who knows it is a hair mod can say so and get the exact
 * slot instead.
 */
const SLOT_TREE: { num: number; label: string; slots: { num: number; label: string }[] }[] = (() => {
  const all = dividers.all as { num: number; name: string }[];
  const clean = (s: string) => s.replace(/[^\x20-\x7E]/g, ' ').replace(/\s+/g, ' ').trim();
  const isCategory = (d: { name: string }) => /CATEGORY/i.test(d.name);
  const label = (d: { name: string }) => {
    const parts = clean(d.name).split(String.fromCharCode(183)).map(p => p.trim());
    return (parts[parts.length - 1] || clean(d.name)).replace(/^\d+\s*/, '');
  };

  const cats = all.filter(isCategory);
  return cats.map((cat, i) => {
    const next = cats[i + 1];
    return {
      num: cat.num,
      label: label(cat).replace(/^CATEGORY\s*/i, ''),
      slots: all
        .filter(d => d.num > cat.num && (!next || d.num < next.num) && !isCategory(d))
        .map(d => ({ num: d.num, label: label(d) })),
    };
  });
})();

/**
 * Puts the selected mods on a divider slot.
 *
 * Two selects and a button. The slot is optional because the category alone
 * places a mod perfectly well, and demanding a slot from somebody who only
 * knows "it is a clothing mod" would send them away with nothing.
 */
function SlotPicker({
  count, alsoByAuthor, onApply, onCancel,
}: {
  count: number;
  alsoByAuthor: Mod[];
  onApply: (divider: number, alsoAuthor: boolean) => void;
  onCancel: () => void;
}) {
  const [category, setCategory] = useState<number | ''>('');
  const [slot, setSlot] = useState<number | ''>('');
  const [alsoAuthor, setAlsoAuthor] = useState(false);
  const chosen = SLOT_TREE.find(c => c.num === category);

  const select =
    'h-9 rounded-md border border-border bg-background px-2 text-sm font-body ' +
    'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';

  return (
    <div className="flex flex-wrap items-center gap-3 border-y border-primary/30 bg-primary/5 px-4 py-3">
      <span className="text-sm font-body">
        <strong>{count}</strong> selected
      </span>

      <label className="sr-only" htmlFor="slot-category">Category</label>
      <select
        id="slot-category"
        className={select}
        value={category}
        onChange={e => { setCategory(e.target.value ? Number(e.target.value) : ''); setSlot(''); }}
      >
        <option value="">Choose a category</option>
        {SLOT_TREE.map(c => <option key={c.num} value={c.num}>{c.label}</option>)}
      </select>

      {chosen && chosen.slots.length > 0 && (
        <>
          <label className="sr-only" htmlFor="slot-specific">More specific, optional</label>
          <select
            id="slot-specific"
            className={select}
            value={slot}
            onChange={e => setSlot(e.target.value ? Number(e.target.value) : '')}
          >
            <option value="">Anywhere in {chosen.label}</option>
            {chosen.slots.map(s => <option key={s.num} value={s.num}>{s.label}</option>)}
          </select>
        </>
      )}

      {alsoByAuthor.length > 0 && (
        /* Named, not counted. Agreeing to a number is agreeing to whatever it
           turns out to be, and this is a guess the user is opting into. */
        <label
          className="flex items-center gap-2 text-sm font-body cursor-pointer"
          title={alsoByAuthor.map(m => m.name).join(', ')}
        >
          <input
            type="checkbox"
            checked={alsoAuthor}
            onChange={e => setAlsoAuthor(e.target.checked)}
            className="h-4 w-4 accent-[#D7A869]"
          />
          Also {alsoByAuthor.length === 1
            ? alsoByAuthor[0].name
            : `${alsoByAuthor.length} more by ${alsoByAuthor[0].author}`}
        </label>
      )}

      <Button
        size="sm"
        disabled={category === ''}
        onClick={() => onApply(slot === '' ? Number(category) : Number(slot), alsoAuthor)}
      >
        Put {count === 1 ? 'it' : 'them'} here
      </Button>
      <button onClick={onCancel} className="text-sm underline hover:text-foreground">
        Cancel
      </button>
    </div>
  );
}

const SEVERITY_ICON: Record<IssueSeverity, typeof Info> = {
  critical: XCircle,
  warning: AlertTriangle,
  info: Info,
};

export default function OptimisePage() {
  const {
    mods, result, isLoadingMasterlist, masterlistError, sourceName,
    manualMoves, moveMod, clearManual,
    assigned, assignSlot, clearAssignments,
  } = useStore();
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [unsortedOnly, setUnsortedOnly] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Anchor for shift-click, so a run of forty cosmetics is two clicks.
  const lastClicked = useRef<string | null>(null);

  /**
   * The author to show for a mod.
   *
   * The file's own answer wins, because that is the pak this person installed.
   * Most exports carry no author column at all, so without the masterlist's
   * copy the page could credit only a third of the mods it lists.
   */
  const authorOf = useCallback(
    (m: { uuid: string; author?: string }) =>
      m.author ?? result?.placements.get(m.uuid)?.author,
    [result],
  );

  const visible = useMemo(() => {
    if (!result) return [];
    const q = query.trim().toLowerCase();
    let list = result.mods;
    if (unsortedOnly) {
      list = list.filter(m => result.placements.get(m.uuid)?.groupSource === 'default');
    }
    if (!q) return list;
    return list.filter(m =>
      m.name.toLowerCase().includes(q)
      || authorOf(m)?.toLowerCase().includes(q));
  }, [result, query, unsortedOnly, authorOf]);

  /* Shown rows that can be filed, which is what "select all" acts on. */
  const selectableShown = useMemo(
    () => (result
      ? visible.filter(m => {
        const src = result.placements.get(m.uuid)?.groupSource;
        return src === 'default' || src === 'you';
      })
      : []),
    [result, visible],
  );

  /* The rows as displayed, so a shift range covers what the user can see. */
  const visibleUuids = useMemo(() => visible.map(m => m.uuid), [visible]);

  /** Mods with no category at all, which is what any of this is for. */
  const unsortedCount = useMemo(
    () => (result
      ? result.mods.filter(m => result.placements.get(m.uuid)?.groupSource === 'default').length
      : 0),
    [result],
  );

  /*
   * Selecting a row, with shift extending from the last one clicked.
   *
   * The range walks the list as displayed rather than the underlying order, so
   * it selects what the person can actually see between the two clicks.
   */
  const toggleSelected = useCallback((uuid: string, extend: boolean, ids: string[]) => {
    const anchor = lastClicked.current;
    setSelected(prev => {
      const next = new Set(prev);
      const from = anchor ? ids.indexOf(anchor) : -1;
      const to = ids.indexOf(uuid);
      if (extend && from !== -1 && to !== -1 && from !== to) {
        for (const id of ids.slice(Math.min(from, to), Math.max(from, to) + 1)) next.add(id);
        return next;
      }
      if (next.has(uuid)) next.delete(uuid); else next.add(uuid);
      return next;
    });
    lastClicked.current = uuid;
  }, []);

  /**
   * Other unsorted mods by the same author, when the selection is all one
   * author's work.
   *
   * Deliberately refuses to pool. Selecting mods by two authors and offering
   * everything either of them made would file an author's weapon mod as
   * clothing because one of their dresses was in the selection, and the user
   * would see only a count. An author's mods are not all one kind, which is
   * why the mined version of this guess demands three catalogued mods and
   * eighty percent agreement before it will say anything.
   */
  const alsoByAuthor = useMemo(() => {
    if (!result || !selected.size) return [];
    // Compared folded, rendered verbatim. Two spellings of one person are one
    // person; nobody's name is rewritten to make that true.
    const fold = (a?: string) => (a ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
    const authors = new Set(
      result.mods.filter(m => selected.has(m.uuid)).map(m => fold(authorOf(m))),
    );
    if (authors.size !== 1) return [];
    const [author] = [...authors];
    if (!author) return [];
    return result.mods.filter(m => !selected.has(m.uuid)
      && fold(authorOf(m)) === author
      && result.placements.get(m.uuid)?.groupSource === 'default');
  }, [result, selected, authorOf]);

  const applySlot = useCallback((divider: number, alsoAuthor: boolean) => {
    const ids = [...selected, ...(alsoAuthor ? alsoByAuthor.map(m => m.uuid) : [])];
    assignSlot(ids, divider);
    setSelected(new Set());
    lastClicked.current = null;
  }, [selected, alsoByAuthor, assignSlot]);

  if (!mods.length) {
    return (
      <EmptyState />
    );
  }

  if (isLoadingMasterlist || !result) {
    return (
      <div className="p-8 min-h-screen bg-gradient-to-br from-background via-background to-card">
        <div className="max-w-6xl mx-auto animate-pulse space-y-4">
          <div className="h-10 w-1/3 rounded bg-card/50 border border-primary/20" />
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-14 rounded bg-card/30 border border-primary/10" />
          ))}
        </div>
      </div>
    );
  }

  const { stats, issues, placements } = result;

  const byProvenance = countByProvenance(result);

  return (
    <div className="p-8 overflow-auto min-h-screen bg-gradient-to-br from-background via-background to-card">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl font-display font-bold text-gradient-bg3">Sorted order</h1>
            <p className="text-muted-foreground mt-2 font-body" role="status" aria-atomic="true">
              {sourceName && <span className="font-mono text-xs">{sourceName}</span>}
            {sourceName && ', '}
              {stats.total} mods, {stats.moved} moved, {stats.hardEdges} dependency
              {stats.hardEdges === 1 ? ' rule' : ' rules'} applied
            </p>
          </div>
          <Link href="/export">
            <Button size="lg">
              <Download className="mr-2 h-4 w-4" aria-hidden="true" />
              Export
              <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
            </Button>
          </Link>
        </header>

        {masterlistError && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            <AlertDescription>{masterlistError}</AlertDescription>
          </Alert>
        )}

        {/* A single dense strip rather than four big-number cards. The figures
            are supporting detail, not the point of the page, and four identical
            metric cards is the stock dashboard treatment. */}
        <dl className="flex flex-wrap items-baseline gap-x-8 gap-y-3 border-y border-border/40 py-4">
          <Metric label="mods" value={stats.total} />
          <Metric
            label="placed by the community"
            value={byProvenance.masterlist}
            hint="Filed here by players in the load orders they submitted. The strongest evidence VOLO has."
          />
          <Metric
            label="curated"
            value={byProvenance.curated}
            hint={PROVENANCE.curated.full}
          />
          <Metric
            label="inferred"
            value={byProvenance.inferred}
            hint={PROVENANCE.inferred.full}
          />
          <Metric
            label="from the mod's listing"
            value={byProvenance.listing}
            hint={PROVENANCE.listing.full}
            muted
          />
          {byProvenance.author > 0 && (
            <Metric
              label="from the author's other mods"
              value={byProvenance.author}
              hint={PROVENANCE.author.full}
              muted
            />
          )}
          <Metric
            label="guessed from the name"
            value={byProvenance['name-pattern']}
            hint={PROVENANCE['name-pattern'].full}
            muted
          />
          <Metric
            label="unplaced"
            value={byProvenance.default}
            hint="Nothing places this mod yet: nobody has filed it in a submitted order, no listing gives it a category, and its name gives nothing away. It waits at the end rather than being guessed somewhere."
            muted
          />
        </dl>

        {Object.keys(assigned).length > 0 && (
          <Alert className="border-primary/40 bg-primary/5">
            <AlertDescription className="font-body flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <span>
                You have filed {countWord(Object.keys(assigned).length)}{' '}
                {Object.keys(assigned).length === 1 ? 'mod' : 'mods'} yourself.
                They sort where you put them, and the choice stays in this
                browser. Submitting an order you have played on is what teaches
                VOLO the placement for everybody else.
              </span>
              <button onClick={clearAssignments} className="underline hover:text-foreground text-sm shrink-0">
                Undo my categories
              </button>
            </AlertDescription>
          </Alert>
        )}

        {manualMoves > 0 && (
          <Alert className="border-primary/40 bg-primary/5">
            <AlertDescription className="font-body flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <span>
                You have moved {manualMoves} mod{manualMoves === 1 ? '' : 's'} by hand.
                The export follows your order, not ours. If it works, submitting it
                teaches VOLO the placement.
              </span>
              <button onClick={clearManual} className="underline hover:text-foreground text-sm shrink-0">
                Undo my changes
              </button>
            </AlertDescription>
          </Alert>
        )}

        {issues.map((issue, i) => <IssueCard key={i} issue={issue} mods={result.mods} />)}

        <Card className="border-ornate shadow-bg3">
          <CardHeader className="flex-row items-center justify-between space-y-0 gap-4">
            <CardTitle className="font-display flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary/70" aria-hidden="true" />
              Load order
            </CardTitle>
            <div className="flex items-center gap-3">
              {(unsortedCount > 0 || unsortedOnly) && (
                /* Without this, someone with 900 mods scrolls past 850 sorted
                   ones to reach the pile they came here to deal with. */
                <label className="flex items-center gap-2 text-sm font-body cursor-pointer whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={unsortedOnly}
                    onChange={e => { setUnsortedOnly(e.target.checked); setSelected(new Set()); }}
                    className="h-4 w-4 accent-[#D7A869]"
                  />
                  Unsorted only ({unsortedCount})
                </label>
              )}
              {selectableShown.length > 0 && (
                /* Fifty clothing mods from fifty authors have nothing in
                   common a machine can see. Filtering to them and taking the
                   lot is the shortest honest route. */
                <button
                  onClick={() => {
                    const all = selectableShown.map(m => m.uuid);
                    const already = all.every(u => selected.has(u));
                    setSelected(already ? new Set() : new Set(all));
                    lastClicked.current = null;
                  }}
                  className="text-sm underline hover:text-foreground whitespace-nowrap"
                >
                  {selectableShown.every(m => selected.has(m.uuid))
                    ? 'Clear selection'
                    : `Select all ${selectableShown.length}`}
                </button>
              )}
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <Input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Filter by name or author"
                aria-label="Filter the sorted order by mod name or author"
                type="search"
                name="orderFilter"
                spellCheck={false}
                className="pl-9"
              />
            </div>
            </div>
          </CardHeader>

          {selected.size > 0 && (
            <SlotPicker
              count={selected.size}
              alsoByAuthor={alsoByAuthor}
              onApply={applySlot}
              onCancel={() => { setSelected(new Set()); lastClicked.current = null; }}
            />
          )}

          <CardContent>
            {!visible.length && (
              <p className="py-8 text-center text-muted-foreground font-body">
                {unsortedOnly && !unsortedCount
                  ? 'Nothing left unsorted. Every mod in this order has a category now.'
                  : 'Nothing matches that filter.'}
              </p>
            )}
            <ol className="divide-y divide-border/50">
              {visible.map(mod => {
                const p = placements.get(mod.uuid);
                const isOpen = expanded === mod.uuid;
                return (
                  <li key={mod.uuid} className={isOpen ? undefined : 'row-defer'}>
                    <div className="group flex items-center rounded transition-colors hover:bg-primary/5">
                    {/* Offered on mods with no category, and on the ones you
                        have already filed, so a wrong pick can be taken back. */}
                    {/*
                      The column is always here, holding its width even when
                      the row has nothing to tick. Rendering it only on the
                      rows that can be filed indented those rows past the
                      others and put the position numbers on two different
                      margins.
                    */}
                    <span className="flex w-7 shrink-0 items-center justify-center">
                      {(p?.groupSource === 'default' || p?.groupSource === 'you') && (
                        /*
                         * The click is handled on the wrapper, not on the box.
                         * A checkbox reports its own change without the
                         * modifier keys reliably attached, and shift is the
                         * whole point here: it is what turns forty cosmetics
                         * into two clicks. The box stays a real checkbox so it
                         * reads and behaves correctly, and space from the
                         * keyboard still produces a click that lands here.
                         */
                        <span onClick={e => toggleSelected(mod.uuid, e.shiftKey, visibleUuids)}>
                          <input
                            type="checkbox"
                            aria-label={`Select ${mod.name}`}
                            checked={selected.has(mod.uuid)}
                            readOnly
                            className="h-4 w-4 accent-[#D7A869] align-middle"
                          />
                        </span>
                      )}
                    </span>
                    <MoveControls name={mod.name} onMove={d => moveMod(mod.uuid, d)} />
                    <button
                      className="flex-1 min-w-0 flex items-center gap-4 py-3 text-left px-2"
                      /*
                       * Selecting a mod name ends in a click on the row, which
                       * would open the details the reader was dragging across.
                       * A plain click has no selection by then, because
                       * pressing the mouse down clears whatever was selected,
                       * so anything left is a selection the user just made.
                       */
                      onClick={() => {
                        const selection = window.getSelection();
                        if (selection && !selection.isCollapsed) return;
                        setExpanded(isOpen ? null : mod.uuid);
                      }}
                      aria-expanded={isOpen}
                    >
                      <span className="w-8 text-right text-xs text-muted-foreground font-mono">
                        {(p?.position ?? 0) + 1}
                      </span>
                      {/*
                        Text inside a button cannot be selected by dragging,
                        which is a sensible default for a control and wrong
                        here: people copy a mod name to go and look it up.
                        Asked for, and the masterlist page already behaves this
                        way because its rows are not buttons.
                      */}
                      <span className="flex-1 min-w-0 select-text">
                        <span className="block truncate font-medium font-body">{mod.name}</span>
                        {authorOf(mod) && (
                          <span className="block truncate text-xs text-muted-foreground">{authorOf(mod)}</span>
                        )}
                      </span>
                      {p && p.movedBy !== 0 && (
                        <Badge variant="outline" className="text-xs shrink-0 hidden sm:inline-flex">
                          {p.movedBy < 0 ? 'up' : 'down'} {Math.abs(p.movedBy)}
                        </Badge>
                      )}
                      <span className="shrink-0 flex items-center gap-1.5">
                        <Badge
                          variant={p?.group === 'unsorted' ? 'outline' : 'secondary'}
                          className="text-xs"
                          title={p?.group}
                        >
                          {(p?.divider !== undefined && SLOT_LABEL.get(p.divider))
                            || p?.group || 'unsorted'}
                        </Badge>
                        {p && PROVENANCE[p.groupSource].short && (
                          <span
                            className="text-[10px] uppercase tracking-wider text-muted-foreground/80"
                            title={PROVENANCE[p.groupSource].full}
                          >
                            {PROVENANCE[p.groupSource].short}
                          </span>
                        )}
                      </span>
                      <ChevronDown
                        className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${
                          isOpen ? 'rotate-180' : ''
                        }`} aria-hidden="true" />
                    </button>
                    </div>

                    {isOpen && p && (
                      <div className="pl-16 pr-2 pb-4 space-y-1 text-sm text-muted-foreground font-body">
                        {p.reasons.map((r, i) => (
                          <p key={i} className="flex gap-2">
                            <span className="text-primary/60">-</span>
                            {r.text}
                          </p>
                        ))}
                        <p className="text-xs pt-1 opacity-70">{PROVENANCE[p.groupSource].full}</p>
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
            {!visible.length && (
              <p className="py-8 text-center text-muted-foreground font-body">
                No mods match "{query}".
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/**
 * One provenance figure, with its jargon label explained on the label itself
 * rather than behind an icon.
 *
 * The label is a button so the explanation is reachable by keyboard: a `title`
 * attribute is not, in any browser.
 */
function Metric({ label, value, hint, muted }: {
  label: string; value: number; hint?: string; muted?: boolean;
}) {
  const numeral = (
    <dd className={`font-display text-2xl font-bold tabular-nums ${muted ? 'text-muted-foreground' : 'text-primary'}`}>
      {value.toLocaleString()}
    </dd>
  );

  if (!hint) {
    return (
      <div className="flex items-baseline gap-2">
        {numeral}
        <dt className="text-sm text-muted-foreground">{label}</dt>
      </div>
    );
  }

  return (
    <div className="flex items-baseline gap-2">
      {numeral}
      <dt className="text-sm text-muted-foreground">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="cursor-help underline decoration-dotted decoration-muted-foreground/50 underline-offset-4"
            >
              {label}
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs font-body text-xs leading-relaxed">
            {hint}
          </TooltipContent>
        </Tooltip>
      </dt>
    </div>
  );
}

/** Where "know where this belongs?" actually leads. */
const WRONG_PLACEMENT_URL =
  'https://github.com/Moonie8t7/VOLO/issues/new?template=wrong-placement.yml';

/**
 * The mods an issue is actually about.
 *
 * Every issue already carries the uuids it concerns and none of them were
 * shown, so a reader was told that five mods had never been verified, or that
 * ninety-one were unsorted, with no way to find out which. Two people asked
 * for this within a day of each other, and both were right: a warning naming
 * nothing cannot be acted on.
 */
function IssueMods({ issue, mods }: { issue: Issue; mods: Mod[] }) {
  const [open, setOpen] = useState(false);
  const named = (issue.uuids ?? [])
    .map(u => mods.find(m => m.uuid === u)?.name)
    .filter((n): n is string => !!n);

  if (!named.length) return null;

  // A handful reads as a sentence; ninety-one needs to be asked for.
  const inline = named.length <= 6;
  const shown = inline || open ? named : named.slice(0, 6);

  return (
    <span className="block mt-2 text-sm opacity-90">
      {shown.join(', ')}
      {!inline && !open && (
        <>
          {'. '}
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="underline hover:opacity-100"
          >
            Show all {named.length}
          </button>
        </>
      )}
    </span>
  );
}

function IssueCard({ issue, mods }: { issue: Issue; mods: Mod[] }) {
  const Icon = SEVERITY_ICON[issue.severity];
  return (
    <Alert variant={issue.severity === 'critical' ? 'destructive' : 'default'}>
      <Icon className="h-4 w-4" aria-hidden="true" />
      <AlertTitle className="font-subheader capitalize">{issue.kind.replace('-', ' ')}</AlertTitle>
      <AlertDescription className="font-body">
        {issue.message}
        <IssueMods issue={issue} mods={mods} />
        {issue.resolution && (
          <span className="block mt-1 text-sm opacity-80">
            {issue.resolution}
            {/*
              The card used to send this to the tracker, which was the only
              route when it was written. Filing them here is the shorter one
              and needs no account, so the tracker is offered second, for
              anybody who would rather the answer helped everyone than just
              their own list.
            */}
            {issue.kind === 'unsorted' && (
              <>
                {' '}
                <a
                  href={WRONG_PLACEMENT_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="underline hover:opacity-100"
                >
                  Or tell us, so everyone gets it
                </a>
                .
              </>
            )}
          </span>
        )}
      </AlertDescription>
    </Alert>
  );
}

function EmptyState() {
  return (
    <div className="p-8 min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-card">
      <div className="text-center max-w-md">
        <h1 className="text-3xl font-display font-bold text-gradient-bg3">Nothing to sort yet</h1>
        <p className="text-muted-foreground mt-3 font-body">
          Import a load order from BG3 Mod Manager and VOLO will arrange it.
        </p>
        <Link href="/import">
          <Button size="lg" className="mt-6">
            Import a load order
            <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
