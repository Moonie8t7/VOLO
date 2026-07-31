import { Link, useLocation } from "wouter";
import { Upload, ArrowUpDown, Download, Database, Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useStore } from "@/lib/store";

const NAV = [
  { href: "/import", icon: Upload, label: "Import" },
  { href: "/optimise", icon: ArrowUpDown, label: "Sorted Order" },
  { href: "/export", icon: Download, label: "Export" },
  { href: "/masterlist", icon: Database, label: "Community Masterlist" },
];

export default function Sidebar() {
  const [location] = useLocation();
  const { mods, masterlist } = useStore();

  return (
    <aside className="w-72 bg-gradient-bg3 border-r border-ornate flex flex-col shadow-bg3">
      <Link href="/">
        <div className="p-6 border-b border-border/20 cursor-pointer hover:bg-primary/5 transition-colors">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-md shadow-bg3 border border-border overflow-hidden shrink-0">
              <img src="/assets/volo-logo.png" alt="" className="w-full h-full object-cover" />
            </div>
            <div className="min-w-0">
              <h2 className="text-2xl font-display font-bold text-gradient-bg3">VOLO</h2>
              <p className="text-sm font-subheader truncate">Verified Order &amp; Load Optimisation</p>
              <p className="text-xs text-muted-foreground/70 mt-1 font-body">for Baldur's Gate III</p>
            </div>
          </div>
        </div>
      </Link>

      <nav className="flex-1 px-6 py-8 space-y-3">
        {NAV.map(item => {
          const isActive = location === item.href;
          return (
            <Link key={item.href} href={item.href}>
              <Button
                variant={isActive ? "default" : "ghost"}
                className={`w-full justify-start text-left transition-all duration-200 ${
                  isActive
                    ? "bg-primary/90 text-primary-foreground shadow-bg3 border border-primary/30 font-medium"
                    : "text-foreground/80 hover:text-foreground hover:bg-primary/10 hover:border-primary/20 border border-transparent"
                }`}
              >
                <item.icon className="mr-4 h-5 w-5 shrink-0" />
                <span className="font-medium tracking-wide flex-1">{item.label}</span>
                {item.href === "/optimise" && mods.length > 0 && (
                  <Badge variant="secondary" className="ml-2 text-xs">{mods.length}</Badge>
                )}
              </Button>
            </Link>
          );
        })}
      </nav>

      <div className="px-6 py-4 border-t border-border/20">
        <Link href="/donations">
          <Button
            variant={location === "/donations" ? "default" : "ghost"}
            className={`w-full justify-start text-left transition-all duration-200 ${
              location === "/donations"
                ? "bg-destructive/90 text-destructive-foreground shadow-bg3 border border-destructive/30 font-medium"
                : "text-foreground/80 hover:text-foreground hover:bg-destructive/10 hover:border-destructive/20 border border-transparent"
            }`}
          >
            <Heart className="mr-3 h-4 w-4" />
            Support VOLO
          </Button>
        </Link>
      </div>

      <div className="px-6 py-5 border-t border-border/20 bg-card/50 text-xs font-body text-muted-foreground space-y-1">
        <p>
          Masterlist{" "}
          <span className="text-foreground/80">
            {masterlist ? `v${masterlist.version}` : "loading"}
          </span>
        </p>
        {masterlist && <p>{masterlist.plugins.length.toLocaleString()} mods known</p>}
        {masterlist?.gamePatch && <p>BG3 {masterlist.gamePatch}</p>}
        <p className="pt-1 opacity-70">Runs entirely in your browser.</p>
      </div>
    </aside>
  );
}
