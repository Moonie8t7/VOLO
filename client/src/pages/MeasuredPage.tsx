/**
 * What was measured, including the things that failed.
 *
 * The numbers behind the sort are the one thing VOLO has that no other page
 * about BG3 load order advice has, and until now they lived in the repository
 * where nobody looking for them would find them.
 */

import { Link } from 'wouter';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import summary from '@/lib/masterlist-summary.json';
import {
  BELOW_CHANCE,
  ERROR,
  EVALUATED,
  HELD_OUT,
  LARGEST,
  ORDERS,
  RANDOM,
  SELF_SORTED,
  SMALLEST,
  TARGET,
  WEIGHTED,
  byLift,
  byRecency,
  type MeasuredOrder,
} from '@/lib/measured-stats';
import { countWord, countWordCap } from '@/lib/words';

/**
 * Orders in the corpus that never reach the score, beyond the ones VOLO sorted
 * itself: the same export submitted twice under two names weighs double in a
 * mean, so the evaluation keeps one copy. Derived by subtraction so the three
 * counts on this page cannot disagree with each other.
 */
const DUPLICATES = summary.workingOrders - SELF_SORTED - EVALUATED;

const RECENT = byRecency.slice(0, 10);
const BEST = byLift.slice(0, 5);

/**
 * One table shape for all three views of the same measurement, so the reader
 * learns the columns once. Gain is the column that matters: agreement alone
 * flatters an order whose random baseline is already 55.
 */
function OrderTable({ rows, caption }: { rows: MeasuredOrder[]; caption: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-border/60 text-left text-muted-foreground">
            <th scope="col" className="py-2 pr-4 font-medium">Order</th>
            <th scope="col" className="py-2 pr-4 text-right font-medium">Mods</th>
            <th scope="col" className="py-2 pr-4 text-right font-medium">VOLO</th>
            <th scope="col" className="py-2 pr-4 text-right font-medium">Random</th>
            <th scope="col" className="py-2 text-right font-medium">Gain</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(o => (
            <tr key={o.name} className="border-b border-border/30">
              <td className="py-2 pr-4">{o.name}</td>
              <td className="py-2 pr-4 text-right tabular-nums">{o.mods}</td>
              <td className="py-2 pr-4 text-right tabular-nums">{o.held.toFixed(1)}</td>
              <td className="py-2 pr-4 text-right tabular-nums text-muted-foreground">
                {o.random.toFixed(1)}
              </td>
              <td className="py-2 text-right tabular-nums">
                {(o.held - o.random).toFixed(1)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function MeasuredPage() {
  return (
    <div className="p-8 overflow-auto min-h-screen bg-gradient-to-br from-background via-background to-card">
      <div className="max-w-3xl mx-auto space-y-10">
        <header>
          <h1 className="text-4xl font-display font-bold text-gradient-bg3">
            How well does VOLO actually sort?
          </h1>
          <p className="text-muted-foreground mt-2 font-body">
            The measurements behind the tool, including the ideas that made it worse.
          </p>
        </header>

        <section className="space-y-4 font-body leading-relaxed">
          <h2 className="font-display text-2xl font-bold">The test</h2>
          <p>
            Take a load order somebody played on and enjoyed. Rebuild the
            masterlist from scratch with that order left out, so the tool has
            never seen it. Sort the mods and count how many pairs come out in
            the same relative order as the one the player actually used. Shuffle
            the same list at random for comparison.
          </p>
          <p>
            Leaving the order out matters. Scored against orders it learned
            from, VOLO looks about four points better than it is, because it is
            being asked to recall an answer it has already read.
          </p>
        </section>

        <section className="space-y-4 font-body leading-relaxed">
          <h2 className="font-display text-2xl font-bold">The result</h2>
          <p>
            Across {countWord(EVALUATED)} working orders, VOLO agrees with the player{' '}
            <strong>{HELD_OUT} percent</strong> of the time, against{' '}
            <strong>{RANDOM} percent</strong> for a random shuffle. So it is doing
            real work, and it is nowhere near a solved problem.
          </p>
          <p>
            The corpus holds {summary.workingOrders} working orders and{' '}
            {countWord(EVALUATED)} are scored here. {countWordCap(SELF_SORTED)} of
            them VOLO sorted itself, and marking its own homework measures
            nothing except that the sort is deterministic
            {DUPLICATES > 0
              ? DUPLICATES === 1
                ? ', and one more is a byte-identical copy of another file'
                : `, and ${countWord(DUPLICATES)} more are byte-identical copies of other files`
              : ''}
            .
          </p>
          <p>
            The average treats every order equally, so a {SMALLEST}-mod list
            counts as much as a {LARGEST.toLocaleString('en-GB')}-mod one.
            Weighted by the number of
            mods, which is closer to what someone with a real load order
            experiences, it comes out at {WEIGHTED} percent.
          </p>
        </section>

        <section className="space-y-4 font-body leading-relaxed">
          <h2 className="font-display text-2xl font-bold">Where it helped most</h2>
          <p>
            The five orders VOLO reconstructed best, by how far it beat a random
            shuffle of the same list. This is the good end of the range and
            nothing more: the average above also carries{' '}
            {countWord(BELOW_CHANCE)} orders where the sort did no better than
            chance at all.
          </p>
          <OrderTable rows={BEST} caption="The five orders with the largest gain over a random shuffle" />
        </section>

        <section className="space-y-4 font-body leading-relaxed">
          <h2 className="font-display text-2xl font-bold">The ten most recent</h2>
          <p>
            Newest submissions first, which is the part of the corpus that has
            had the least chance to influence the rules it is being scored
            against.
          </p>
          <OrderTable rows={RECENT} caption="Held-out agreement for the ten most recently submitted orders" />
          <details className="pt-2">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
              All {EVALUATED} scored orders
            </summary>
            <div className="pt-4">
              <OrderTable
                rows={[...ORDERS].sort((a, b) => b.mods - a.mods)}
                caption="Held-out agreement per submitted load order, largest first"
              />
            </div>
          </details>
        </section>

        <section className="space-y-4 font-body leading-relaxed">
          <h2 className="font-display text-2xl font-bold">
            Things that sounded sensible and were not
          </h2>
          <p>
            Most of what was tried made the sort worse. Recording the failures
            is the only way to stop them being tried again. Each figure below is
            against the baseline of its own run, from an older scoring pass, so
            the pairs compare with each other and not with the headline above;
            where only a cost in points is given, that cost is against the same
            run it was measured in.
          </p>
          <dl className="space-y-4">
            <div>
              <dt className="font-subheader">Filing unknown mods near their neighbours</dt>
              <dd className="text-muted-foreground">
                Rather than sending a mod nobody has placed to the end, give it
                the position of the last known mod above it. Scored 61.8 against
                63.6. Mods nobody has categorised really do pile up at the end of
                real load orders, so the tool leaves them there.
              </dd>
            </div>
            <div>
              <dt className="font-subheader">Adopting the divider order wholesale</dt>
              <dd className="text-muted-foreground">
                Throwing out the learned sequence and using the community
                divider numbering for everything scored 60.4 against 63.6.
              </dd>
            </div>
            <div>
              <dt className="font-subheader">Reading categories out of divider names</dt>
              <dd className="text-muted-foreground">
                The divider set names a hundred things the categories do not, so
                using those labels to place otherwise unreachable mods looked
                free. It placed 67 mods and cost 0.7 points.
              </dd>
            </div>
            <div>
              <dt className="font-subheader">Trusting the mod's own listing</dt>
              <dd className="text-muted-foreground">
                Using the Nexus or mod.io category for mods the community has
                never placed cost 0.6 points, and it was rejected on that basis.
                Then it was adopted anyway. The measurement was answering the
                wrong question, which is the next section.
              </dd>
            </div>
          </dl>
        </section>

        <section className="space-y-4 font-body leading-relaxed">
          <h2 className="font-display text-2xl font-bold">
            Why the score is not the goal
          </h2>
          <p>
            The test scores VOLO against orders that already work. That quietly
            rewards doing nothing: leave every mod exactly where the player put
            it and you score perfectly, while sorting nothing at all. Any real
            change costs points before it earns them back.
          </p>
          <p>
            It also flatters ignorance. A mod dumped at the end because the tool
            knows nothing about it scores well, precisely because unplaced mods
            cluster at the end anyway. That says something about the corpus, not
            about whether the sort is useful to you.
          </p>
          <p>
            So when the community divider structure was adopted, the score fell
            from 60.3 to 57.5 and it was adopted regardless. Mods on a known
            position went from 967 of 3,008 to 2,662, and mods with no category
            at all fell from 650 to 338. The exported order gained headings a
            player can read. That was judged worth more than three points on a
            metric fitted to nine files.
          </p>
        </section>

        <section className="space-y-4 font-body leading-relaxed">
          <h2 className="font-display text-2xl font-bold">The honest limits</h2>
          <p>
            {countWordCap(EVALUATED)} scored orders is a small corpus, and it is
            the thing holding the tool back rather than the sorting itself. The
            headline carries about {ERROR} points of uncertainty on that
            sample, and it would take something like {TARGET} scored orders to
            bring that under half a point.
          </p>
          <p>
            Orders also arrive anonymously, which is deliberate but costs
            something here: there is no way to know how many different people
            are behind them, so what reads as {EVALUATED} independent opinions
            may be fewer. Every measurement on this page should be read with
            that in mind.
          </p>
          <p>
            The automated tests parse VOLO's own output with VOLO's own parser,
            which proves the tool is consistent with itself and nothing more.
            Exported orders have been loaded in Baldur's Gate 3 by hand and
            worked, but that is a manual check, not something the test suite can
            promise you.
          </p>
          <p>
            If you have played on an order, submitting it moves these numbers
            more than any change to the code would.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link href="/submit">
              <Button>
                Submit a load order
                <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
              </Button>
            </Link>
            <a
              href="https://github.com/Moonie8t7/VOLO/blob/main/docs/decisions.md"
              target="_blank"
              rel="noreferrer"
            >
              <Button variant="outline">Read the full record</Button>
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}
