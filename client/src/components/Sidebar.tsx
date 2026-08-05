/**
 * Primary navigation.
 *
 * Collapses into a top bar below the large breakpoint, where a fixed sidebar
 * would eat most of the viewport.
 */

import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { Upload, ArrowUpDown, Download, Send, Database, Heart, Menu, X, LineChart, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/lib/store";

const NAV = [
  { href: "/import", icon: Upload, label: "Import" },
  { href: "/optimise", icon: ArrowUpDown, label: "Sorted Order" },
  { href: "/export", icon: Download, label: "Export" },
  { href: "/submit", icon: Send, label: "Submit an Order" },
  { href: "/masterlist", icon: Database, label: "Community Masterlist" },
  { href: "/measured", icon: LineChart, label: "How Well It Sorts" },
  { href: "/about", icon: Info, label: "About" },
];

/**
 * Nav items are a single interactive element each.
 *
 * They used to be a Link wrapping a Button, which nests an <a> around a
 * <button>. That is invalid HTML, gives every item two tab stops, and leaves
 * screen readers announcing a link containing a button.
 *
 * min-h-11 is 44px, the minimum comfortable touch target.
 */
function NavLink({
  href, icon: Icon, label, active, badge, tone = "primary", onNavigate,
}: {
  href: string;
  icon: typeof Upload;
  label: string;
  active: boolean;
  badge?: number;
  tone?: "primary" | "support";
  onNavigate?: () => void;
}) {
  // Selected state follows the official site's panel vocabulary: translucent
  // black with a thin gold border and gold text, never a filled light block.
  const activeStyle = tone === "support"
    ? "bg-black/35 text-destructive-foreground border-destructive/60"
    : "bg-black/35 text-secondary border-border/80";
  const idleStyle = tone === "support"
    ? "text-foreground/80 hover:text-foreground hover:bg-destructive/10 hover:border-destructive/20"
    : "text-foreground/80 hover:text-foreground hover:bg-primary/10 hover:border-primary/20";

  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={`flex min-h-11 w-full items-center gap-4 rounded-md border px-4 py-2 text-left
        transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2
        focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background
        ${active ? `${activeStyle} font-medium shadow-bg3` : `${idleStyle} border-transparent`}`}
    >
      <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
      <span className="flex-1 tracking-wide">{label}</span>
      {badge !== undefined && badge > 0 && (
        <Badge variant="secondary" className="text-xs">{badge}</Badge>
      )}
    </Link>
  );
}

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      href="/"
      className="flex items-center gap-4 rounded-md focus-visible:outline-none
        focus-visible:ring-2 focus-visible:ring-ring"
    >
      <img
        src="/assets/volo-logo-256.png"
        alt=""
        width={compact ? 40 : 56}
        height={compact ? 40 : 56}
        className={`${compact ? "h-10 w-10" : "h-14 w-14"} shrink-0 rounded-md border border-border object-cover shadow-bg3`}
      />
      <span className="min-w-0">
        <span className="block font-display text-2xl font-bold text-primary">VOLO</span>
        {!compact && (
          <>
            <span className="block text-sm leading-snug text-secondary">
              Verified Order and Load Optimisation
            </span>
            <span className="mt-1 block text-xs text-muted-foreground/70">
              for Baldur's Gate III
            </span>
          </>
        )}
      </span>
    </Link>
  );
}

function Footer() {
  const { masterlist } = useStore();
  return (
    <div className="space-y-1 border-t border-border/20 bg-card/50 px-6 py-5 text-xs text-muted-foreground">
      {masterlist ? (
        <>
          <p>Masterlist: {masterlist.plugins.length.toLocaleString()} mods</p>
          {masterlist.gamePatch && <p>Calibrated for BG3 {masterlist.gamePatch}</p>}
        </>
      ) : (
        <p>Loading masterlist</p>
      )}
    </div>
  );
}

export default function Sidebar() {
  const [location] = useLocation();
  const { mods } = useStore();
  const [open, setOpen] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);

  // Escape closes the disclosure and returns focus to the control that opened
  // it, so keyboard users are not stranded inside a panel they cannot dismiss.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      toggle.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const items = NAV.map(item => (
    <NavLink
      key={item.href}
      {...item}
      active={location === item.href}
      badge={item.href === "/optimise" ? mods.length : undefined}
      onNavigate={() => setOpen(false)}
    />
  ));

  return (
    <>
      {/* Below lg the sidebar would eat most of the viewport, so it collapses
          into a top bar with a disclosure panel. */}
      <header className="flex flex-col border-b border-ornate bg-gradient-bg3 shadow-bg3 lg:hidden">
        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <Brand compact />
          <button
            type="button"
            ref={toggle}
            onClick={() => setOpen(v => !v)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? "Close menu" : "Open menu"}
            className="flex h-11 w-11 items-center justify-center rounded-md border border-transparent
              text-foreground/80 transition-colors hover:bg-primary/10 hover:text-foreground
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {open ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
          </button>
        </div>
        {open && (
          <nav id="mobile-nav" aria-label="Main" className="space-y-2 px-4 pb-4">
            {items}
            <NavLink
              href="/donations" icon={Heart} label="Support VOLO" tone="support"
              active={location === "/donations"} onNavigate={() => setOpen(false)}
            />
          </nav>
        )}
      </header>

      <aside className="hidden w-72 shrink-0 flex-col border-r border-ornate bg-gradient-bg3 shadow-bg3 lg:flex">
        <div className="border-b border-border/20 p-6">
          <Brand />
        </div>

        <nav aria-label="Main" className="flex-1 space-y-3 px-6 py-8">
          {items}
        </nav>

        <div className="border-t border-border/20 px-6 py-4">
          <NavLink
            href="/donations" icon={Heart} label="Support VOLO" tone="support"
            active={location === "/donations"}
          />
        </div>

        <Footer />
      </aside>
    </>
  );
}
