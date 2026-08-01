import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import DonationSection from "@/components/DonationSection";
import { useStore } from "@/lib/store";

export default function LandingPage() {
  const { masterlist } = useStore();
  const modCount = masterlist?.plugins.length;
  const patch = masterlist?.gamePatch;

  return (
    <div className="min-h-screen bg-background">
      <div className="relative bg-gradient-bg3 overflow-hidden">
        <div className="relative max-w-4xl mx-auto px-6 py-20 text-center">
          <div className="flex items-center justify-center gap-4 mb-6">
            <img
              src="/assets/volo-logo.png"
              alt=""
              className="w-16 h-16 md:w-20 md:h-20 border border-border shadow-bg3"
            />
            <h1 className="font-display text-5xl md:text-6xl font-bold text-gradient-bg3 leading-tight">
              VOLO
            </h1>
          </div>
          <p className="font-display text-xl md:text-2xl mb-6" style={{ color: "hsl(var(--bg3-small))" }}>
            Verified Order and Load Optimisation
          </p>
          <p className="text-lg mb-3 max-w-2xl mx-auto leading-relaxed" style={{ color: "hsl(var(--bg3-main))" }}>
            Sorts your Baldur's Gate 3 mod list the way load orders that actually
            work are sorted. Runs entirely in your browser; your list never
            leaves your machine.
          </p>
          <p className="text-sm mb-8 italic" style={{ color: "hsl(var(--bg3-main) / 0.7)" }}>
            Named after the Realms' most confident chronicler. Unlike Volo, we verify.
          </p>

          <Link href="/import">
            <Button size="lg" className="px-8 text-lg">
              Sort my load order
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-16">
        <h2 className="font-display text-2xl font-bold mb-8" style={{ color: "hsl(var(--bg3-header))" }}>
          What it does
        </h2>
        <div className="space-y-6 mb-16 leading-relaxed" style={{ color: "hsl(var(--bg3-main))" }}>
          <p>
            Export your order from BG3 Mod Manager and drop it in. VOLO reads the
            full export, the short one, CSV, or a plain list of names.
          </p>
          <p>
            It sorts your mods by category, keeps declared dependencies ahead of
            the mods that need them, and otherwise moves as little as possible.
            Every mod shows the reason it sits where it does. Mods that have
            never appeared in a working order get flagged rather than guessed at.
          </p>
          <p>
            Export the result and import it straight back into BG3 Mod Manager.
          </p>
        </div>

        <h2 className="font-display text-2xl font-bold mb-8" style={{ color: "hsl(var(--bg3-header))" }}>
          Where the order comes from
        </h2>
        <div className="space-y-6 mb-16 leading-relaxed" style={{ color: "hsl(var(--bg3-main))" }}>
          <p>
            Not from guesswork. The sorting rules are learned from load orders
            players submitted after actually playing on them. Orders that worked
            teach placement; orders that broke teach warnings.
          </p>
          <p>
            The masterlist currently knows
            {modCount ? ` ${modCount.toLocaleString()} mods` : " thousands of mods"}
            {patch ? `, calibrated against BG3 ${patch}` : ""}. All of it is on{" "}
            <a
              href="https://github.com/Moonie8t7/VOLO"
              target="_blank"
              rel="noreferrer"
              className="underline hover:text-foreground"
            >
              GitHub
            </a>
            , and you can{" "}
            <Link href="/masterlist" className="underline hover:text-foreground">
              browse it here
            </Link>
            . When you have played on an order, working or not, submitting it
            from the Export page makes the sorter better for everyone.
          </p>
        </div>

        <h2 className="font-display text-2xl font-bold mb-8" style={{ color: "hsl(var(--bg3-header))" }}>
          Questions
        </h2>
        <Accordion type="single" collapsible className="w-full mb-16">
          <AccordionItem value="upload" className="border-ornate/20">
            <AccordionTrigger className="text-left font-semibold">
              Is my mod list uploaded anywhere?
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground">
              No. Parsing and sorting happen in your browser. There is no server
              behind this site, so there is nowhere to upload it to. The only
              time your list leaves your machine is if you choose to submit it.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="account" className="border-ornate/20">
            <AccordionTrigger className="text-left font-semibold">
              Do I need an account?
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground">
              No. Submitting a load order uses GitHub, so that needs a GitHub
              account, but sorting does not.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="wrong" className="border-ornate/20">
            <AccordionTrigger className="text-left font-semibold">
              What if VOLO gets something wrong?
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground">
              It will, sometimes. The masterlist is only as good as the orders
              behind it, and plenty of mods have not been categorised yet. Every
              placement shows its reasoning, so you can see why a mod landed
              where it did and move it yourself. If you know better, submit a
              correction; that is the whole idea.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="loot" className="border-ornate/20">
            <AccordionTrigger className="text-left font-semibold">
              Is this like LOOT?
            </AccordionTrigger>
            <AccordionContent className="text-muted-foreground">
              Same spirit, different method. LOOT sorts Bethesda games with a
              hand-written masterlist. VOLO is only for Baldur's Gate 3, and its
              rules are learned from orders the community has actually played on.
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        <div className="text-center">
          <Link href="/import">
            <Button size="lg" className="px-8 text-lg">
              Sort my load order
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </div>

      <div className="py-16 bg-card/30">
        <div className="max-w-4xl mx-auto px-6">
          <DonationSection />
        </div>
      </div>
    </div>
  );
}
