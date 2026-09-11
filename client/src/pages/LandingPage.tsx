/**
 * Landing page: what VOLO does, where its rules come from, and the questions
 * people actually ask. Mod counts are read from the live masterlist.
 */

import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Separator } from "@/components/ui/separator";
import { CorpusCharts, StatBand } from "@/components/CorpusStats";
import DonationSection from "@/components/DonationSection";
import SortingDemo from "@/components/SortingDemo";
import { useStore } from "@/lib/store";
import summary from "@/lib/masterlist-summary.json";

export default function LandingPage() {
  const { masterlist } = useStore();

  /**
   * The live masterlist once it has downloaded, the figures recorded at build
   * time until then. The masterlist is megabytes fetched after the page loads,
   * so without the fallback this sentence would read "thousands of mods" on
   * first paint and in the prerendered HTML that search engines read.
   */
  const [openQuestion, setOpenQuestion] = useState<string>("");
  const modCount = masterlist?.plugins.length ?? summary.mods;
  const patch = masterlist?.gamePatch ?? summary.gamePatch;

  return (
    /* The landing page renders outside the app shell, so it carries its own
       main landmark rather than inheriting the one in Layout. */
    <main className="min-h-dvh">
      {/* The hero carries the site's smoke and cloud. The site's hero is imagery with
      dark cloud over its top and edges, and that darkening is the first thing
      a visitor sees. */}
      <div className="shroud relative overflow-hidden">
        <div className="relative max-w-4xl mx-auto px-6 py-20 text-center">
          {/*
            The wordmark and the descriptive line are one heading.
            "VOLO" alone told a reader arriving from a search nothing, and it
            collides with a Forgotten Realms character and several unrelated
            products, so the words people actually search on belong here rather
            than in a paragraph underneath.
          */}
          {/*
            Mark, name and expansion are one lockup, the same way the sidebar
            sets them. The expansion used to sit below the descriptive line as
            its own paragraph, which put an explanation of the name in the
            middle of the pitch; it belongs against the wordmark it explains.
            The mark carries no frame. It is already a circle with a heavy outline, and a
            box around it would look like an avatar chip.
          */}
          <h1 className="mb-6">
            <span className="flex items-center justify-center gap-4 md:gap-5">
              <img
                src="/assets/volo-logo-256.webp"
                alt=""
                width={256}
                height={256}
                className="w-16 h-16 md:w-20 md:h-20"
              />
              <span className="block text-left">
                <span className="block font-display text-5xl md:text-6xl font-bold text-gradient-bg3 leading-none">
                  VOLO
                </span>
                <span
                  className="block font-subheader text-xs mt-1.5"
                  style={{ color: "hsl(var(--bg3-main) / 0.75)" }}
                >
                  Verified Order and Load Optimisation
                </span>
              </span>
            </span>
            {/* The two spans are separate blocks visually, but they run
                together in the heading's text unless a space is written in. */}
            {' '}
            <span
              className="mt-6 block font-display fluid-h2"
              style={{ color: "hsl(var(--bg3-small))" }}
            >
              Load order sorting for Baldur's Gate 3
            </span>
          </h1>
          {/* The heading above already names the game and the job, so this
              says what is true of the result rather than repeating either. */}
          <p className="text-lg mb-8 max-w-2xl mx-auto leading-relaxed" style={{ color: "hsl(var(--bg3-main))" }}>
            Mods in the wrong order override each other or never load, and the
            usual fix is moving them one at a time. VOLO sorts yours the way
            orders that actually work are sorted, with the reasoning shown for
            every mod. Runs in your browser, needs no account, and costs nothing.
          </p>

          {/* The marks ride the edges of the control, as on the site's primary call to
          action. They live on a wrapper because the control's mask cuts
          anything that crosses its edge. */}
          <Link href="/import" className="btn-diamond">
            <Button size="lg" className="px-10 text-lg">
              Sort my load order
            </Button>
          </Link>
          <p className="mt-4 text-sm" style={{ color: "hsl(var(--bg3-main) / 0.8)" }}>
            Played on an order already?{" "}
            <Link href="/submit" className="underline hover:text-foreground">
              Submit it and teach the sorter
            </Link>
            .
          </p>
          <p className="mt-6 text-sm italic" style={{ color: "hsl(var(--bg3-main) / 0.6)" }}>
            Named after the Realms' most confident chronicler. Unlike Volo... we verify.
          </p>
        </div>
      </div>

      {/* Paragraphs are held to 62ch, about 75 letters, the top of the
          readable range. A ch is the zero glyph, and in Gothic A1 that is
          wider than the average letter, so 75ch had given 90. The site runs
          its copy at about 60; this is as wide as the lines can go before
          the eye loses the return. */}
      <div className="max-w-[1100px] mx-auto px-6 py-16 [&_p]:max-w-[62ch]">
        <h2 className="ruled mb-8" style={{ color: "hsl(var(--bg3-header))" }}>
          What it does
        </h2>
        <div className="space-y-6 mb-16 leading-relaxed" style={{ color: "hsl(var(--bg3-main))" }}>
          <p>
            Export your order from BG3 Mod Manager, or use the game's own
            modsettings.lsx, and drop it in. VOLO reads the full export, the
            short one, CSV, or a plain list of names. Export the result and
            import it straight back.
          </p>

          <figure className="frame-bg3 frame-decor mt-14 mb-10 p-6">
            {/*
              WebP first at a fraction of the weight, with the PNG behind it for
              anything that will not take WebP. Two widths, because the figure is
              never wider than 720 points: a phone was downloading the 1200 wide
              file to paint it at a third of that. Dimensions are set so the page
              does not jump as it loads, and it is lazy because it sits well
              below the fold.
            */}
            <picture>
              <source
                type="image/webp"
                srcSet="/assets/volo-sorted-order-preview-900.v4.webp 900w,
                        /assets/volo-sorted-order-preview.v4.webp 1200w"
                sizes="(min-width: 768px) 720px, calc(100vw - 3rem)"
              />
              <img
                src="/assets/volo-sorted-order-preview.v4.png"
                alt="A sorted load order in VOLO. ImpUI sits first on its ImprovedUI slot, having moved up 84 places, and each row below shows how far that mod travelled, the slot it landed on such as Caites' UI Mods, and a note such as curated wherever the placement came from something other than a played order."
                width={1200}
                height={630}
                loading="lazy"
                decoding="async"
                className="w-full border border-border/60 shadow-bg3"
              />
            </picture>
            <figcaption className="mt-3 text-sm" style={{ color: "hsl(var(--bg3-main) / 0.75)" }}>
              Every row says where the mod landed and why. Mods placed from
              anything other than a played order are labelled, so a guess
              never looks like evidence.
            </figcaption>
          </figure>
        </div>

        {/* Anchored so the issue templates can point straight at the evidence
            ladder rather than at the top of the page. */}
        <Separator className="mb-12 -mx-[4vw] w-[calc(100%+8vw)]" />
        <h2 id="where-the-order-comes-from" className="ruled mb-8 scroll-mt-6" style={{ color: "hsl(var(--bg3-header))" }}>
          Where the order comes from
        </h2>
        {/* The one section that pairs its copy with a visual: the frame demo
            on the left and the copy centred beside it, as the site sets
            imagery beside text. The other sections were tried this way and
            put back, because a figure at half width was too small to read
            and the stats band wanted the whole width. */}
        <div className="mb-16 grid gap-10 leading-relaxed lg:grid-cols-[minmax(0,1fr)_minmax(0,55ch)] lg:items-center" style={{ color: "hsl(var(--bg3-main))" }}>
          <div className="space-y-6 lg:order-2">
            <p>
              A working BG3 load order is already divided into sections, and the
              community has settled on a set of divider mods that name them: a
              hundred-odd labelled positions running from interface mods at the
              top to compatibility patches at the bottom. VOLO treats those as the
              frame of the order, whether or not you install the dividers
              themselves.
            </p>
            <p>
              Which position a mod belongs at comes from the best evidence there
              is, in that order: where players filed it in orders they submitted,
              then what its name plainly says, then the category on its Nexus or
              mod.io page. Every row tells you which of the three you are looking
              at, so a guess never passes for evidence.
            </p>
          </div>
          <div className="lg:order-1">
            <SortingDemo />
          </div>
        </div>

        <Separator className="mb-12 -mx-[4vw] w-[calc(100%+8vw)]" />
        <h2 className="ruled mb-8" style={{ color: "hsl(var(--bg3-header))" }}>
          What it will not do
        </h2>
        <div className="space-y-6 mb-16 leading-relaxed" style={{ color: "hsl(var(--bg3-main))" }}>
          <p>
            Dependencies are absolute: a mod that declares it needs another is
            never placed before it, whatever the sections say. Where VOLO has
            nothing to go on it leaves your order alone, so what you see moved
            is what it had a reason to move. Mods it knows nothing about wait at
            the end instead of being filed somewhere flattering, and you can
            move anything by hand.
          </p>
        </div>

        <Separator className="mb-12 -mx-[4vw] w-[calc(100%+8vw)]" />
        <h2 className="ruled mb-8" style={{ color: "hsl(var(--bg3-header))" }}>
          How much to trust it
        </h2>
        <div className="space-y-6 mb-10 leading-relaxed" style={{ color: "hsl(var(--bg3-main))" }}>
          <p>
            The masterlist knows {modCount.toLocaleString()} mods
            {patch ? `, calibrated against BG3 ${patch}` : ""}, and you can{" "}
            <Link href="/masterlist" className="underline hover:text-foreground">
              browse every one of them
            </Link>
            . How well it sorts is{" "}
            <Link href="/measured" className="underline hover:text-foreground">
              measured against orders it has never seen
            </Link>
            , and the failures are published alongside the wins.{" "}
            <Link href="/about" className="underline hover:text-foreground">
              Who makes VOLO, and where it is weak
            </Link>
            , is written down as well.
          </p>
          <p>
            Played on an order, working or not?{" "}
            <Link href="/submit" className="underline hover:text-foreground">
              Submitting it
            </Link>{" "}
            makes the sorter better for everyone. All of it, code and data, is
            on{" "}
            <a
              href="https://github.com/Moonie8t7/VOLO"
              target="_blank"
              rel="noreferrer"
              className="underline hover:text-foreground"
            >
              GitHub
            </a>
            .
          </p>
        </div>
        <StatBand />
        <CorpusCharts />

        <Separator className="mb-12 -mx-[4vw] w-[calc(100%+8vw)]" />
        <h2 className="ruled mb-8" style={{ color: "hsl(var(--bg3-header))" }}>
          Questions
        </h2>
        {/* Two columns that open independently, sharing one open question, which
            is how the site lays its FAQ out: an open answer lengthens its own
            column and leaves the other untouched. */}
        <div className="mb-16 grid w-full items-start gap-y-[15px] md:grid-cols-2 md:gap-x-[30px]">
        <Accordion type="single" collapsible value={openQuestion} onValueChange={setOpenQuestion} className="flex flex-col gap-y-[15px]">
          <AccordionItem value="upload">
            <AccordionTrigger>
              Is my mod list uploaded anywhere?
            </AccordionTrigger>
            <AccordionContent className="space-y-3">
              <p>
                No, although two moments make it look that way: picking your
                file, and saving the sorted one. Neither touches the network.
              </p>
              <p>
                When the page loads, your browser downloads VOLO's code and
                runs it on your computer, the same way a downloaded program
                runs. Picking a file hands it to that code through the
                browser's file picker, which reads it straight from your disk
                into the page's memory. The sorting happens in that memory.
                Saving the result uses the browser's download dialog, so it feels like a
                download, but the file is built inside the page and written
                from there to your disk.
              </p>
              <p>
                Check it in the browser's network panel. Everything you see
                comes from this site: VOLO's own code, styles, images and
                typeface, and the masterlist it sorts against, which is one file
                of public data served the same way to everybody. Your mod list
                is in none of them. The Submit page adds Cloudflare's anti-spam widget, and
                sends your order only once you press the button. That button is
                the only thing on the site that sends your list anywhere.
              </p>
              <p>
                The{' '}
                <Link href="/privacy" className="underline hover:text-foreground">
                  privacy page
                </Link>{' '}
                names every third party involved, including the ones this
                answer glosses over.
              </p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="account">
            <AccordionTrigger>
              Do I need an account?
            </AccordionTrigger>
            <AccordionContent>
              No, for either. Sorting needs nothing, and submitting an order goes through
              this site with no sign-up.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="sources">
            <AccordionTrigger>
              Does it matter where my mods are from?
            </AccordionTrigger>
            <AccordionContent>
              No. VOLO sorts the load order file, and a pak is a pak whether it
              came from Nexus Mods, the official in-game mod manager at
              baldursgate3.game (which runs on mod.io), or anywhere else. VOLO
              also keeps reference catalogues of both platforms, so a mod the
              community has not placed yet can still be categorised from its
              own listing.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="labels">
            <AccordionTrigger>
              What do the labels next to each mod mean?
            </AccordionTrigger>
            <AccordionContent className="space-y-3">
              <p>
                They say how much the placement is worth, because a guess and a
                verified position should not look alike. No label means players
                filed that mod there themselves, which is the strongest evidence
                VOLO has. A curated placement is a maintainer's hand-written
                rule. An inferred one was voted on by the mods either side of it
                in submitted orders, and the percentage is how much they agreed.
                A listing placement came from the mod's own Nexus or mod.io page, which
                describes the mod but says nothing about where people load it. An author placement means the mod itself is
                listed nowhere, but its author's other catalogued mods
                overwhelmingly sit in one section, so the mod is filed with
                them. A guess means VOLO read the title and had
                nothing else to go on, and unplaced means it had not even that,
                so the mod waits at the end.
              </p>
              <p>
                Expanding a row gives the reasoning in full, including any
                dependency that forced it. If a placement looks wrong, move it,
                and if the moved order works, submitting it is what corrects
                VOLO for the next person.
              </p>
            </AccordionContent>
          </AccordionItem>

        </Accordion>
        <Accordion type="single" collapsible value={openQuestion} onValueChange={setOpenQuestion} className="flex flex-col gap-y-[15px]">
          <AccordionItem value="wrong">
            <AccordionTrigger>
              What if VOLO gets something wrong?
            </AccordionTrigger>
            <AccordionContent>
              It will, sometimes. The masterlist is only as good as the orders
              behind it, and plenty of mods have not been categorised yet. Every
              placement shows its reasoning, so you can see why a mod landed
              where it did and judge it for yourself. If you know better, put it
              right in your mod manager and submit that order; correcting VOLO
              is the whole idea.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="inactive">
            <AccordionTrigger>
              Some of my mods show as inactive in-game. Is that bad?
            </AccordionTrigger>
            <AccordionContent>
              Usually not. Override-style mods do their work without joining the
              load order, so the in-game manager lists them as inactive; that is
              normal and safe to ignore. If every single mod is disabled after
              launch, that is different: one broken pak can take the whole list
              down with it, and the fix is finding and removing the broken one.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="console">
            <AccordionTrigger>
              Can I use VOLO on Xbox or PlayStation?
            </AccordionTrigger>
            <AccordionContent className="space-y-3">
              <p>
                Not today. This has been checked, so it is a confirmed answer.
              </p>
              <p>
                I asked Larian directly in August 2026, and a Community Manager
                checked with the team. There is a modsettings.lsx on consoles,
                the same file VOLO reads on PC, but there is no way to get it
                off the console or put a modified one back, and external
                software is not compatible with mods on consoles at all.
              </p>
              <p>
                It cannot be done with a mod either, which I looked into next. Load order is
                decided before any mod runs, so a mod cannot reorder the mods
                it was loaded alongside. Mod files are data with no access to
                the file system, and Script Extender, the only thing on PC
                that has such access, is a Windows library that cannot exist
                on a console.
              </p>
              <p>
                What already works in your favour is that the masterlist is
                built from mod.io as well as Nexus Mods, and mod.io is the
                platform behind the in-game mod manager. Your mods are in the
                data and sorted like anyone else's.
              </p>
              <p>
                So there is one workflow left, and it ends with you doing the
                last part by hand. VOLO shows you the order on a phone or a PC,
                and you drag your mods into that order in the in-game manager
                yourself. I could make that much less tedious by letting you
                connect your mod.io account, so VOLO reads what you are
                subscribed to and builds the list without you typing two hundred
                names in. However, it would still be incredibly manual (and
                tedious) to reorder them on a console.
              </p>
              <p>
                I have not built it, because it is only worth building if people
                would actually use it, and dragging a long list around with a
                controller may cost more than it saves. If you would use it, say
                so on the Nexus page or open an issue on GitHub. If enough
                people want it, I will build it.
              </p>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="loot">
            <AccordionTrigger>
              Is this like LOOT?
            </AccordionTrigger>
            <AccordionContent>
              Same spirit, different method. LOOT sorts Bethesda games with a
              hand-written masterlist. VOLO is only for Baldur's Gate 3, and its
              rules are learned from orders the community has actually played on.
            </AccordionContent>
          </AccordionItem>
        </Accordion>
        </div>

        <div className="text-center">
          {/* The marks ride the edges of the control, as on the site's primary call to
          action. They live on a wrapper because the control's mask cuts
          anything that crosses its edge. */}
          <Link href="/import" className="btn-diamond">
            <Button size="lg" className="px-10 text-lg">
              Sort my load order
            </Button>
          </Link>
        </div>
      </div>

      <div className="py-16">
        <div className="max-w-[1100px] mx-auto px-6">
          <DonationSection />
        </div>
      </div>
    </main>
  );
}
