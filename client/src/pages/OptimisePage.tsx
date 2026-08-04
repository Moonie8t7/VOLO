import { useMemo, useState } from 'react';
import { Link } from 'wouter';
import {
  Search, AlertTriangle, Info, XCircle, ArrowRight, Download, ChevronDown, Layers,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useStore } from '@/lib/store';
import type { Issue, IssueSeverity } from '@/lib/types';

const SEVERITY_ICON: Record<IssueSeverity, typeof Info> = {
  critical: XCircle,
  warning: AlertTriangle,
  info: Info,
};

export default function OptimisePage() {
  const { mods, result, isLoadingMasterlist, masterlistError, sourceName } = useStore();
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const visible = useMemo(() => {
    if (!result) return [];
    const q = query.trim().toLowerCase();
    if (!q) return result.mods;
    return result.mods.filter(m =>
      m.name.toLowerCase().includes(q) || m.author?.toLowerCase().includes(q));
  }, [result, query]);

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

  return (
    <div className="p-8 overflow-auto min-h-screen bg-gradient-to-br from-background via-background to-card">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl font-display font-bold text-gradient-bg3">Sorted order</h1>
            <p className="text-muted-foreground mt-2 font-body">
              {sourceName && <span className="font-mono text-xs">{sourceName}</span>}
            {sourceName && ', '}
              {stats.total} mods, {stats.moved} moved, {stats.hardEdges} dependency
              {stats.hardEdges === 1 ? ' rule' : ' rules'} applied
            </p>
          </div>
          <Link href="/export">
            <Button size="lg">
              <Download className="mr-2 h-4 w-4" />
              Export
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </header>

        {masterlistError && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{masterlistError}</AlertDescription>
          </Alert>
        )}

        {/* A single dense strip rather than four big-number cards. The figures
            are supporting detail, not the point of the page, and four identical
            metric cards is the stock dashboard treatment. */}
        <dl className="flex flex-wrap items-baseline gap-x-8 gap-y-3 border-y border-border/40 py-4">
          <Metric label="mods" value={stats.total} />
          <Metric label="moved" value={stats.moved} />
          <Metric label="known to the masterlist" value={stats.knownToMasterlist} />
          <Metric label="not yet categorised" value={stats.unsorted} muted />
        </dl>

        {issues.map((issue, i) => <IssueCard key={i} issue={issue} />)}

        <Card className="border-ornate shadow-bg3">
          <CardHeader className="flex-row items-center justify-between space-y-0 gap-4">
            <CardTitle className="font-display flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary/70" />
              Load order
            </CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Filter by name or author"
                className="pl-9"
              />
            </div>
          </CardHeader>
          <CardContent>
            <ol className="divide-y divide-border/50">
              {visible.map(mod => {
                const p = placements.get(mod.uuid);
                const isOpen = expanded === mod.uuid;
                return (
                  <li key={mod.uuid}>
                    <button
                      className="w-full flex items-center gap-4 py-3 text-left hover:bg-primary/5 px-2 rounded transition-colors"
                      onClick={() => setExpanded(isOpen ? null : mod.uuid)}
                    >
                      <span className="w-10 text-right text-xs text-muted-foreground font-mono">
                        {(p?.position ?? 0) + 1}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block truncate font-medium font-body">{mod.name}</span>
                        {mod.author && (
                          <span className="block truncate text-xs text-muted-foreground">{mod.author}</span>
                        )}
                      </span>
                      {p && p.movedBy !== 0 && (
                        <Badge variant="outline" className="text-xs shrink-0">
                          {p.movedBy < 0 ? 'up' : 'down'} {Math.abs(p.movedBy)}
                        </Badge>
                      )}
                      <Badge
                        variant={p?.group === 'unsorted' ? 'outline' : 'secondary'}
                        className="text-xs shrink-0 hidden sm:inline-flex"
                      >
                        {p?.group ?? 'unsorted'}
                      </Badge>
                      <ChevronDown
                        className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${
                          isOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </button>

                    {isOpen && p && (
                      <div className="pl-14 pr-2 pb-4 space-y-1 text-sm text-muted-foreground font-body">
                        {p.reasons.map((r, i) => (
                          <p key={i} className="flex gap-2">
                            <span className="text-primary/60">-</span>
                            {r.text}
                          </p>
                        ))}
                        <p className="text-xs pt-1 opacity-70">
                          {p.groupSource === 'masterlist' && 'Category from the community masterlist.'}
                          {p.groupSource === 'inferred' && 'Category inferred from submitted load orders.'}
                          {p.groupSource === 'nexus' && 'Category from its Nexus Mods listing.'}
                          {p.groupSource === 'name-pattern' && 'Category guessed from the mod name.'}
                          {p.groupSource === 'default' && 'No category information yet.'}
                        </p>
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

function Metric({ label, value, muted }: { label: string; value: number; muted?: boolean }) {
  return (
    <div className="flex items-baseline gap-2">
      <dd className={`font-display text-2xl font-bold tabular-nums ${muted ? 'text-muted-foreground' : 'text-primary'}`}>
        {value.toLocaleString()}
      </dd>
      <dt className="text-sm text-muted-foreground">{label}</dt>
    </div>
  );
}

function IssueCard({ issue }: { issue: Issue }) {
  const Icon = SEVERITY_ICON[issue.severity];
  return (
    <Alert variant={issue.severity === 'critical' ? 'destructive' : 'default'}>
      <Icon className="h-4 w-4" />
      <AlertTitle className="font-subheader capitalize">{issue.kind.replace('-', ' ')}</AlertTitle>
      <AlertDescription className="font-body">
        {issue.message}
        {issue.resolution && (
          <span className="block mt-1 text-sm opacity-80">{issue.resolution}</span>
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
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
