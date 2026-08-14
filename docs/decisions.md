# Decisions

What was measured, what was kept, and what was thrown away. Several plausible
ideas here made the sorter worse, and they are recorded so nobody rebuilds them
on intuition.

## How quality is measured

Agreement with submitted working orders, pair by pair. Every pair of mods
counts once, so it is Kendall's tau rescaled to 0 to 1. A random shuffle scores
about 50 percent. Perfect agreement is not the goal: a working order is one
valid arrangement, not the only one, and any submitter's exact sequence contains
plenty of arbitrary choices.

Two scripts report it, and the difference matters.

| Script | What it measures | Use it for |
|---|---|---|
| `verify-order.mjs` | Agreement against the orders the masterlist was built from | Comparing two candidate rule sets |
| `verify-holdout.mjs` | Rebuilds the masterlist per order with that order excluded | The number to quote publicly |

The in-sample figure runs about four points high because the masterlist has
already read the answer. **Quote the held-out number.**

Current: **65.0 percent held out**, against a 50.8 percent random baseline,
over 59 distinct working orders.

Two caveats on the held-out figure itself. The group sequence is fixed across
folds rather than re-learned per fold, so it is very slightly optimistic. And
the summary is a mean over orders, not over mods, so a 41-mod order counts as
much as a 999-mod one; on the same data, weighting by mods barely moves the
figure, and the 43 orders above 200 mods average 65.2 on their own. Read
the per-order table before treating a change in the summary as real.

## Adopted

**The category sequence, generated rather than transcribed.** The order categories
load in is derived by counting every pair of mods in every working order and
searching for the sequence that contradicts the least evidence, weighting each
contradicted pair by how lopsided it is and how many observations sit behind it.
The result is written into scripts/mine-corpus.mjs by the learner, not copied in
by hand.

It had been copied by hand, under a comment asking somebody to remember to
refresh it, and while the corpus grew from nine orders to fifty-nine it drifted
until it contradicted 54 of its own 281 pairwise comparisons. Two ranking rules
were tried and rejected on the way. Averaging win rates compared each category
against a different set of opponents, so the averages were not on one scale.
Copeland counted only who beats whom, which made a pair resting on 118,127
observations weigh the same as one resting on 52, and shipped Character
Customization ahead of Classes against a corpus that disagrees 87.7 percent of
the time. Scoring the order instead of the category removed the indirection:
54 contradicted pairs became 16, and the weighted total fell from 275,026 to
18,272.

Held-out agreement did not move, which is expected. Those categories were in the
wrong sequence consistently, and a pairwise agreement metric scores consistency.
What changed is that the exported order now matches what working orders do.

The learner still does not write the sequence automatically on every rebuild.
Adopting a new order changes every sort, so it stays a decision somebody makes
and measures. What it does now is record how well the shipped order fits, so
drift is visible rather than silent.

**Astra's dividers as the ordering skeleton.** Their sequence decides which
section a mod lands in; the learned order decides within a section. Costs about
three points against ordering purely by the learned sequence, and returns a
structure players already recognise and exports whose headings read in order.
A deliberate trade, taken knowingly.

**Requirements promoted from the catalogues.** 206 load-after edges from Nexus
and mod.io requirement tables, where both ends resolve to a mod we know; the
count drifts a little as the catalogues grow. Gated
hard: exact name matches only, optional-sounding entries dropped, cycle-forming
edges discarded, and the corpus overrules a catalogue that contradicts it.
Measured effect on agreement is nil, because working orders already respect
these edges 92 percent of the time. Kept because it is the strongest evidence
type available and it powers the user-facing explanations.

**Corpus arbitration.** Where a catalogue claims A requires B but working orders
consistently load them the other way, the players win. Dropped nine bad edges
and lifted compliance among the rest from 84.9 to 92.3 percent.

**Patchers load last.** Compatibility Framework sat in Resources, rank 7 of 30,
because our groups could not distinguish a library from a patcher. Astra places
it at 105 and the corpus puts it at the very end of the order holding it. Both
agreed against us.

**Every name a listing has been seen under.** Authors rename listings, and
installed paks keep the name they shipped under, so a rename silently breaks
the exact-name match against the catalogues. The crawlers now record old names
and old slugs as aliases when a change comes through, and the category map
also indexes mod.io's nameId slug, which usually still carries the title the
mod was created with because renaming a listing does not rename its URL.
Matching stays exact; fuzzy matching against twenty-four thousand catalogue
names was considered and rejected as a false-positive machine. Found 38 mods
on the first build, including a Races bundle that had outgrown its original
five-race title. Held-out moved 57.3 to 57.4.

**The author's other catalogued mods, as the tier below the listing.** Some
names defeat every tier: a dice set called "ElectricBlue" says nothing, its
listing does not exist, and its neighbours in submitted orders are
alphabetical accidents. But its author has ten catalogued mods and every one
is dice. An author with at least three categorised mods, at least eighty
percent of them in one group, places their otherwise-unplaceable mods with the
rest of their work, labelled `author` so it never reads as evidence. Placed 29
mods at a cost of 0.1 held-out points, the same shape of trade as the listing
tier above: the metric rewards leaving unknown mods parked at the end, and a
mod placed in the right section beats a mod at the end of the file.

## Rejected

Each experiment below quotes the figure it was measured against at the time,
so compare a result with its own baseline rather than with the current
headline. The 63.6 appearing here is the in-sample number from before held-out
evaluation existed; it is not comparable to the current figure at the top of this file.

**Deferring to mod.io where the Nexus category is vague.** Nexus outranks mod.io
on every name both catalogues publish, which was never a measured choice: it is
simply the larger source. They disagree on 923 names, and 121 of those decide a
mod's group today. The disagreements lean one way, Nexus broad and mod.io narrow:
81 mods filed under Gameplay that mod.io calls Spells, 67 under Character
Customization it calls Heads, 37 it calls Hair. Those narrower names are divider
slots, which is what this map exists to supply, so preferring them from those
three vague categories looked obviously right.

It is not. The rule moved 339 keys and 41 masterlist rows, 40 of them into a
different divider slot, and held-out agreement did not move at all: 65.0424
percent with and without, 11 orders improving and 9 getting worse. Reading all 41
by hand agrees. Most look better, and some are plainly wrong; Lone Wolf Mode is
not a spell.

Rejected, and worth stating why rather than only that. This is the standing
principle arriving again by a new route: a listing says what a mod **is**, and
where it loads is a different question. A more specific answer to the first is
not a better answer to the second. The measurement that settled it stayed: the
builder now reports how often the catalogues disagree and how many of those
disagreements reach a mod, and `--conflicts` lists them, so the question does not
have to be reopened from scratch.

**Keeping uncategorised mods in place.** Rather than sorting them to the end,
give them the position of the last categorised mod above them. Measured 61.8
against 63.6. Unplaced mods genuinely do cluster at the end of real orders.

**The divider vocabulary as a classifier.** Using the sub-divider labels
(Warlock, Tiefling, Waypoints, Summons) to place mods nothing else could reach.
Placed 67 mods, cost 0.7 points. Available behind `VOLO_DIVIDER_VOCAB=1`.

The first measurement of this was worthless: the pattern table had been written
through a JS string literal, which turned every `\b` into a backspace byte and
dropped every `\s`, so the rules matched text that cannot occur. Repaired and
re-measured, the conclusion held. `scripts/smoke-test.mjs` now asserts the
tables are reachable and internally consistent, which is the check that would
have caught it.

**Astra's category order wholesale.** Replacing the learned sequence entirely
measured 60.4 percent against 63.6. Preserved on branch
`experiment/astra-order`.

The pattern across these: with so few working orders, the corpus is the binding
constraint, not the algorithm. More submissions beat more cleverness.

## Reversed

**Listing categories as a placement fallback.** Nexus and mod.io categories were
rejected on a 0.6 point loss, then adopted, because the measurement was
answering the wrong question. Held-out agreement is scored against orders that
already work, so any movement costs points and doing nothing scores well; a mod
parked at the end of the list because we know nothing about it is scored
generously precisely because unplaced mods cluster there. That is a statement
about the corpus, not about whether the sort is useful.

The rule now is that the dividers are the skeleton of the order whether or not
the divider paks are installed. Every mod earns a slot on that skeleton, from
where the community filed it, else what its name plainly says, because a name
can hit an exact slot, else its published category; the masterlist then orders
mods within a slot. Skeleton coverage
went from 967 of 3,008 mods to 2,662, and uncategorised from 650 to 338.

The cost, stated plainly: held-out agreement 60.3 to 57.5 percent. That figure
averages orders rather than mods, so a 41-mod order counts as much as a 999-mod
one; weighted by mods the gap is roughly a point. It is a knowing trade of a
metric fitted to nine orders for a structure a player can read.

**Orders VOLO sorted are not evidence of order.** Someone sorts with VOLO,
plays on the result, and submits it. That order looks like a second person
agreeing and contains nothing VOLO did not already believe, so counting it
raises every agreement figure while teaching the masterlist nothing, and each
round makes the next submission likelier to match.

Tagging the export cannot detect it. The real path is VOLO, then BG3MM, then
play, then export from BG3MM, then submit, and BG3MM rewrites the file. Two
signals are recorded instead: the submitter's own answer, and how closely the
sequence matches what VOLO would produce. The answer decides in both
directions, including when someone says they arranged it themselves and the
sequence happens to agree, because VOLO agreeing with a player is the goal
rather than a fault. Measurement only settles the unanswered cases, at 0.98.

A flagged order still counts for which mods exist, whether they were played
together, and whether it worked. It is dropped from section headers, divider
evidence, neighbour inference and held-out scoring. Verified by flagging the
999-mod order: section-header placements fell from 1,641 to 983 and uncategorised
rose from 338 to 544, while it still counted among the nine working orders.
Those were the figures the day it was measured, and the corpus has moved since;
what matters is the shape of the change, not the exact numbers.

## Constraints that shaped the design

**No per-request network calls.** The first version scraped mod pages per mod
per request, sequentially. A thousand-mod list meant roughly eighteen minutes of
network and rate limiting, which was misdiagnosed as a large-dataset problem and
effectively killed it. External data is now crawled ahead of time into committed
JSON.

**Mod names are never altered.** They are matched against what players have
installed, so normalising or tidying a name silently drops the mod from sorting.

**Move as little as possible.** A sorter that reshuffles a working load order
without cause is worse than useless.

## Incidents

**Cache poisoning, 4 August 2026.** Twice in one day the site served HTML in
place of a JavaScript or CSS asset. Cause: during deployment propagation a
request for a not-yet-available asset gets `index.html` with a 200 status, and
our own `/assets/*` rule then told the edge to cache that answer for a year.
Fixed by capping asset cache at an hour and adding `verify-deploy.mjs`, which
detects and repairs it. A stronger fix, routing rules that return a real 404,
is still open.

**Stale session export, 5 August 2026.** A user exported a 102-mod order after
importing a 59-mod file, because picking a file on the Submit page does not
re-import it and the Export page silently used the remembered session. Fixed by
naming the source import on the Export page and making persistence opt-in.
