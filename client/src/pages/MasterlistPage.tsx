/**
 * Browse the community masterlist and what is known about each mod.
 *
 * The category filters run in load order rather than alphabetically, which is
 * information in itself and so is labelled; unlabelled they read as an
 * arbitrary wall of chips. They collapse below the small breakpoint, where
 * thirty-one of them would fill the viewport before a single mod appeared.
 */

import { useMemo, useState } from 'react';
import { Link } from 'wouter';
import { Database, Search, GitPullRequest } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useStore } from '@/lib/store';

const PAGE_SIZE = 60;

export default function MasterlistPage() {
  const { masterlist, isLoadingMasterlist, masterlistError } = useStore();
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<string>('all');
  const [limit, setLimit] = useState(PAGE_SIZE);

  const filtered = useMemo(() => {
    if (!masterlist) return [];
    const q = query.trim().toLowerCase();
    return masterlist.plugins.filter(p => {
      if (group !== 'all' && p.group !== group) return false;
      if (!q) return true;
      return p.name.toLowerCase().includes(q) || p.author?.toLowerCase().includes(q);
    });
  }, [masterlist, query, group]);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of masterlist?.plugins ?? []) map.set(p.group, (map.get(p.group) ?? 0) + 1);
    return map;
  }, [masterlist]);

  return (
    <div className="p-8 overflow-auto min-h-screen bg-gradient-to-br from-background via-background to-card">
      <div className="max-w-5xl mx-auto space-y-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl font-display font-bold text-gradient-bg3">
              Community masterlist
            </h1>
            <p className="text-muted-foreground mt-2 font-body">
              {masterlist
                ? `${masterlist.plugins.length.toLocaleString()} mods, v${masterlist.version}` +
                  (masterlist.gamePatch ? `, calibrated against BG3 ${masterlist.gamePatch}` : '')
                : 'Loading'}
            </p>
          </div>
          <Link href="/submit">
            <Button variant="outline">
              <GitPullRequest className="mr-2 h-4 w-4" />
              Submit a load order
            </Button>
          </Link>
        </header>

        {masterlistError && (
          <Alert variant="destructive">
            <AlertDescription>{masterlistError}</AlertDescription>
          </Alert>
        )}

        <Alert className="border-primary/30 bg-primary/5">
          <Database className="h-4 w-4" />
          <AlertDescription className="font-body">
            Built from load orders the community sent in, topped up from Nexus
            and mod.io listings where nobody has placed a mod yet. Entries
            marked <span className="mx-1 text-xs uppercase tracking-wider">listing</span>
            came from the second sort, and mods in{' '}
            <Badge variant="outline" className="mx-1">unsorted</Badge> from neither.
            If you know where one belongs, that is the most useful thing you can
            contribute.
          </AlertDescription>
        </Alert>

        <Card className="border-ornate shadow-bg3">
          <CardHeader className="space-y-4">
            <CardTitle className="font-display">Browse</CardTitle>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={e => { setQuery(e.target.value); setLimit(PAGE_SIZE); }}
                placeholder="Search by mod name or author"
                aria-label="Search the masterlist by mod name or author"
                type="search"
                name="masterlistSearch"
                spellCheck={false}
                className="pl-9"
              />
            </div>
            <details open={typeof window !== 'undefined' && window.innerWidth >= 640}>
              <summary className="cursor-pointer text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground mb-3">
                Filter by category, listed in load order
              </summary>
            <div className="flex flex-wrap gap-2">
              <GroupChip
                label="all" count={masterlist?.plugins.length ?? 0}
                active={group === 'all'}
                onClick={() => { setGroup('all'); setLimit(PAGE_SIZE); }}
              />
              {masterlist?.groups.map(g => (
                <GroupChip
                  key={g.name} label={g.name} count={counts.get(g.name) ?? 0}
                  active={group === g.name}
                  onClick={() => { setGroup(g.name); setLimit(PAGE_SIZE); }}
                />
              ))}
            </div>
            </details>
          </CardHeader>
          <CardContent>
            {isLoadingMasterlist && (
              <p className="py-8 text-center text-muted-foreground font-body">Loading masterlist</p>
            )}

            {!isLoadingMasterlist && !filtered.length && (
              <p className="py-8 text-center text-muted-foreground font-body">
                Nothing matches that search.
              </p>
            )}

            <ul className="divide-y divide-border/50">
              {filtered.slice(0, limit).map(p => (
                <li key={p.uuid} className="py-3 flex items-center gap-4">
                  <span className="flex-1 min-w-0">
                    <span className="block truncate font-medium font-body">{p.name}</span>
                    {p.author && (
                      <span className="block truncate text-xs text-muted-foreground">{p.author}</span>
                    )}
                  </span>
                  {p.evidence?.source === 'inferred' && p.evidence.confidence && (
                    <span className="text-xs text-muted-foreground shrink-0">
                      inferred, {Math.round(p.evidence.confidence * 100)}%
                    </span>
                  )}
                  {p.evidence?.source === 'external-category' && (
                    <span
                      className="text-xs text-muted-foreground shrink-0"
                      title="Category taken from the mod's own Nexus or mod.io listing, not from a played order."
                    >
                      listing
                    </span>
                  )}
                  {p.evidence && p.evidence.installs > 1 && (
                    <span className="text-xs text-muted-foreground shrink-0">
                      seen in {p.evidence.installs}
                    </span>
                  )}
                  <Badge
                    variant={p.group === 'unsorted' ? 'outline' : 'secondary'}
                    className="text-xs shrink-0"
                  >
                    {p.group}
                  </Badge>
                </li>
              ))}
            </ul>

            {filtered.length > limit && (
              <Button
                variant="ghost"
                className="w-full mt-4"
                onClick={() => setLimit(l => l + PAGE_SIZE)}
              >
                Show more ({(filtered.length - limit).toLocaleString()} remaining)
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function GroupChip({
  label, count, active, onClick,
}: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs transition-colors ${
        active
          ? 'border-primary bg-primary/15 text-foreground'
          : 'border-border text-muted-foreground hover:border-primary/50'
      }`}
    >
      {label} <span className="opacity-60">{count.toLocaleString()}</span>
    </button>
  );
}
