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

Current: **60.3 percent held out**, against a 50.5 percent random baseline,
over nine distinct working orders.

One caveat on the held-out figure itself: the group sequence is fixed across
folds rather than re-learned per fold, so it is very slightly optimistic.

## Adopted

**Astra's dividers as the ordering skeleton.** Their sequence decides which
section a mod lands in; the learned order decides within a section. Costs about
three points against ordering purely by the learned sequence, and returns a
structure players already recognise and exports whose headings read in order.
A deliberate trade, taken knowingly.

**Requirements promoted from the catalogues.** 193 load-after edges from Nexus
and mod.io requirement tables, where both ends resolve to a mod we know. Gated
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

## Rejected

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

The pattern across these: with nine working orders, the corpus is the binding
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
where the community filed it, else its published category, else what its name
plainly says; the masterlist then orders mods within a slot. Skeleton coverage
went from 967 of 3,008 mods to 2,662, and uncategorised from 650 to 338.

The cost, stated plainly: held-out agreement 60.3 to 57.5 percent. That figure
averages orders rather than mods, so a 41-mod order counts as much as a 999-mod
one; weighted by mods the gap is roughly a point. It is a knowing trade of a
metric fitted to nine orders for a structure a player can read.

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
