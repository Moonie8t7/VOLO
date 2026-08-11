/**
 * Who makes VOLO, why it exists, and how to reach whoever broke it.
 *
 * A tool that asks people to believe "your load order is not uploaded" has to
 * be willing to say who is making that claim. This page is the answer to that,
 * and to the reasonable question of why a stranger's sorting rules should be
 * trusted over your own judgement.
 */

import { Link } from 'wouter';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useStore } from '@/lib/store';
import summary from '@/lib/masterlist-summary.json';
import { ENOUGH, ERROR, TARGET } from '@/lib/measured-stats';

const REPO = 'https://github.com/Moonie8t7/VOLO';

const num = (n: number) => n.toLocaleString('en-GB');

export default function AboutPage() {
  const { masterlist } = useStore();
  const modCount = masterlist?.plugins.length ?? summary.mods;
  const workingOrders = masterlist?.provenance?.working ?? summary.workingOrders;

  /*
   * Published listings across both catalogues, counting a mod on both once.
   * Absent until the catalogues are next crawled, so the paragraph that needs
   * it is dropped rather than rendered around holes.
   */
  const catalogue = summary.catalogue;
  const share = catalogue ? Math.round((100 * modCount) / catalogue.distinct) : null;

  return (
    <div className="p-8 overflow-auto min-h-screen bg-gradient-to-br from-background via-background to-card">
      <div className="max-w-3xl mx-auto space-y-10">
        <header>
          <h1 className="text-4xl font-display font-bold text-gradient-bg3">
            About VOLO
          </h1>
          <p className="text-muted-foreground mt-2 font-body">
            Who makes this, why it exists, and where it is weak.
          </p>
        </header>

        <section className="space-y-4 font-body leading-relaxed">
          <h2 className="font-display text-2xl font-bold">Who</h2>
          <p>
            VOLO is one person. I am{' '}
            <a href={REPO} target="_blank" rel="noreferrer" className="underline hover:text-foreground">
              Moonie
            </a>
            , I play a heavily modded Baldur's Gate 3, and I built this because
            I wanted it to exist. It has nothing to do with Larian Studios,
            Nexus Mods or mod.io, and nobody pays to be placed anywhere in it.
            The whole thing is public, so if you want to know what it does with
            your file, you can go and read the code that does it.
          </p>
          <p>
            The load order dividers that give the sort its structure are the
            work of{' '}
            <a
              href="https://forums.nexusmods.com/profile/106303673-astralities/"
              target="_blank"
              rel="noreferrer"
              className="underline hover:text-foreground"
            >
              Astralities
            </a>
            , who made them for their own playthroughs and gave permission for
            them to be used and adapted here.
          </p>
        </section>

        <section className="space-y-4 font-body leading-relaxed">
          <h2 className="font-display text-2xl font-bold">Why</h2>
          <p>
            I love this game. Baldur's Gate 3 is quite possibly my favourite
            game of all time, but there are only so many times I can play a
            vanilla run and look at the same classes, items, outfits and races.
            Mods change the game, and they change the experience of playing it.
          </p>
          <p>
            I am a fantasy and RPG nerd, and I put a good number of hours into
            various Bethesda titles, where LOOT was an invaluable part of the
            experience. BG3 had nothing like it when I started building VOLO in
            2025. Load order advice lived in comment sections and pinned posts,
            it contradicted itself, and most of it was somebody's memory of what
            worked once. Meanwhile thousands of people had a working order
            sitting in their mod manager, and nobody was collecting any of it.
          </p>
          <p>
            So VOLO collects it. The rules come from orders people played on,
            not from opinion, and where the evidence runs out the tool says so
            and leaves the mod where you had it. That is the whole idea.
          </p>
        </section>

        <section className="space-y-4 font-body leading-relaxed">
          <h2 className="font-display text-2xl font-bold">How it is built</h2>
          <p>
            Submitted orders go into a public corpus, {num(summary.orders)} of
            them so far. A script reads them, works out which category each mod
            belongs to and where categories sit relative to each other, and
            writes a masterlist of {num(modCount)} mods, {num(summary.placed)}{' '}
            of which land on a known position. The site downloads that file and
            does the sorting in your browser. Nothing about your own list is
            sent anywhere unless you choose to submit it.
          </p>
          <p>
            The masterlist is generated by a program, not written by hand, and
            the program is not clever: it counts things. Where a placement came
            from a count rather than from a person, the interface says so, and
            you can{' '}
            <Link href="/measured" className="underline hover:text-foreground">
              read what happened when we measured it
            </Link>
            .
          </p>
        </section>

        <section className="space-y-4 font-body leading-relaxed">
          <h2 className="font-display text-2xl font-bold">
            Reasons to be sceptical
          </h2>
          {ENOUGH ? (
            <p>
              The corpus is no longer thin. {num(workingOrders)} working orders
              hold the headline agreement figure steady to within half a point,
              so one unusual order can no longer swing it. What limits VOLO now
              is how much of the mod scene it has seen, which is the next
              paragraph.
            </p>
          ) : (
            <p>
              The corpus is small. {num(workingOrders)} working orders is enough
              to see a signal and not much more. The headline agreement figure
              carries about {ERROR} points of uncertainty, so it moves when a
              large order lands, and it takes something like {TARGET} scored
              orders before it settles to within half a point. Submissions are
              the only thing that gets it there.
            </p>
          )}
          {catalogue && (
            <p>
              VOLO also only knows mods that have turned up in somebody's order.
              Nexus Mods lists {num(catalogue.nexus)} published BG3 mods and
              mod.io lists {num(catalogue.modio)}, which is about{' '}
              {num(catalogue.distinct)} in the wild once the ones on both
              platforms are counted once. The masterlist holds {num(modCount)}.
              Those two are not counted the same way, because a single listing
              can ship several files, so read it as a rough share: VOLO has met
              somewhere around {share} percent of what is published and knows
              nothing whatsoever about the rest.
            </p>
          )}
          <p>
            {num(summary.uncategorised)} of the mods it does know have no
            category from any source. They wait at the end of your order instead
            of being guessed at. VOLO is a starting point you check, not an
            authority. If it puts something in the wrong place, you are probably
            right and it is probably wrong.
          </p>
        </section>

        <section className="space-y-4 font-body leading-relaxed">
          <h2 className="font-display text-2xl font-bold">Getting in touch</h2>
          <p>
            If a mod is filed wrongly,{' '}
            <a
              href={`${REPO}/issues/new?template=wrong-placement.yml`}
              target="_blank"
              rel="noreferrer"
              className="underline hover:text-foreground"
            >
              report the placement
            </a>
            ; the form asks for where it belongs and how you know, and the most
            useful thing you can attach is the order you actually played on,
            because that corrects the evidence rather than one entry. Something
            on the site misbehaving is{' '}
            <a
              href={`${REPO}/issues/new?template=bug-report.yml`}
              target="_blank"
              rel="noreferrer"
              className="underline hover:text-foreground"
            >
              a bug report
            </a>
            , and anything else goes to{' '}
            <a
              href={`${REPO}/issues`}
              target="_blank"
              rel="noreferrer"
              className="underline hover:text-foreground"
            >
              the issue tracker
            </a>
            .
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link href="/submit">
              <Button>
                Submit a load order
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
              </Button>
            </Link>
            <a href={REPO} target="_blank" rel="noreferrer">
              <Button variant="outline">View the source</Button>
            </a>
            <a
              href="https://www.nexusmods.com/baldursgate3/mods/24316"
              target="_blank"
              rel="noreferrer"
            >
              <Button variant="outline">VOLO on Nexus Mods</Button>
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}
