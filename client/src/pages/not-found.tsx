/**
 * 404 page for unmatched client-side routes.
 *
 * A static host answers an unknown path with index.html and a 200 status, so
 * this page is the only place a visitor learns the address is not real. The
 * noindex that keeps it out of search sits with the other per-route tags in
 * lib/head.ts, because a 200 would otherwise be indexed as a real page.
 */

import { Link } from 'wouter';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="p-8 min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-card">
      <div className="text-center max-w-md">
        <p className="font-mono text-sm text-muted-foreground">404</p>
        <h1 className="text-3xl font-display font-bold text-gradient-bg3 mt-2">
          There is no page here
        </h1>
        <p className="text-muted-foreground mt-3 font-body">
          The link may be out of date, or the address may have a typo in it.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link href="/import">
            <Button size="lg">
              Sort a load order
              <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
            </Button>
          </Link>
          <Link href="/" className="underline hover:text-foreground text-sm">
            Back to the start
          </Link>
        </div>
      </div>
    </div>
  );
}
