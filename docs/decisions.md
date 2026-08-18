# Decisions

What was measured, what was kept, and what was thrown away. Several plausible
ideas here made the sorter worse, and they are recorded so nobody rebuilds them
on intuition.

Every entry carries a slug heading, so a commit message, an issue reply or a
code comment can point at one decision rather than at the whole file:
`docs/decisions.md#alias-joins-for-constraints`. The slugs are stable. If an
entry is reworded, keep its slug; if it is genuinely superseded, leave it where
it is and add the new decision, because a link that quietly changes meaning is
worse than one that breaks.

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

Current: **65.2 percent held out**, against a 50.7 percent random baseline,
over 69 distinct working orders.

Two caveats on the held-out figure itself. The group sequence is fixed across
folds rather than re-learned per fold, so it is very slightly optimistic. And
the summary is a mean over orders, not over mods, so a 41-mod order counts as
much as a 999-mod one; on the same data, weighting by mods barely moves the
figure, and the 47 orders above 200 mods average 65.3 on their own. Read
the per-order table before treating a change in the summary as real.

## Adopted

### generated-category-sequence

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

### astra-dividers-as-skeleton

**Astra's dividers as the ordering skeleton.** Their sequence decides which
section a mod lands in; the learned order decides within a section. Costs about
three points against ordering purely by the learned sequence, and returns a
structure players already recognise and exports whose headings read in order.
A deliberate trade, taken knowingly.

### catalogue-requirements

**Requirements promoted from the catalogues.** 206 load-after edges from Nexus
and mod.io requirement tables, where both ends resolve to a mod we know; the
count drifts a little as the catalogues grow. Gated
hard: exact name matches only, optional-sounding entries dropped, cycle-forming
edges discarded, and the corpus overrules a catalogue that contradicts it.
Measured effect on agreement is nil, because working orders already respect
these edges 92 percent of the time. Kept because it is the strongest evidence
type available and it powers the user-facing explanations.

### corpus-arbitration

**Corpus arbitration.** Where a catalogue claims A requires B but working orders
consistently load them the other way, the players win. Dropped nine bad edges
and lifted compliance among the rest from 84.9 to 92.3 percent.

### patchers-load-last

**Patchers load last.** Compatibility Framework sat in Resources, rank 7 of 30,
because our groups could not distinguish a library from a patcher. Astra places
it at 105 and the corpus puts it at the very end of the order holding it. Both
agreed against us.

### listing-name-aliases

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

### author-catalogue-tier

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

### one-gate-for-every-order

**One gate for every order, not one for orders that worked.** Broken orders used
to wait for a person on the reasoning that their value is the written diagnosis
and only a human can act on it. That is true and does not follow: the diagnosis
is posted to the issue either way, and holding the order never made anybody read
it. All the hold achieved was a corpus that waited on somebody being at a
keyboard.

What a broken order contributes decides whether that is safe. It adds presence,
and it adds the section headers and divider slots its submitter wrote, which is
real placement evidence. It never contributes sequence: `workingPositions` in the
miner is built from working orders alone, so no ordering is learned from an order
that did not run. The corpus had always treated them that way, so this changed
who presses the button rather than what the evidence means.

An order of either kind now lands if it leaves agreement intact and waits if it
does not, which is the gate that would notice harm and is unchanged. The
`approved` label still overrides a hold, because an order that drops agreement
can still be one a person wants kept. Issue #94 landed itself the same evening,
104 mods, agreement flat, no button pressed.

### caution-needs-two-orders

**The never-verified caution asks for two orders.** It fired on any mod seen once
in an order somebody reported as broken and never in one reported working, which
was 496 mods. A warning pointing at 496 things points at nothing, and only 35 of
them had ever been seen that way twice. It also got worse as the project got
better: every held submission adds broken orders, so the one-sighting bar grew
noisier exactly as the corpus grew more useful.

It now asks for two separate broken orders, and a row of the same name carrying
working installs answers it, since warning about a mod while the community
demonstrably runs something of that name is the least useful thing the page could
say. That is a much weaker claim than deciding two same-name UUIDs are one mod,
which stays open and undecided; all it records is that the name works for
somebody. Together: 496 mods to 34, with placement measured as untouched rather
than assumed, because the caution is advice and never an input to the sort.

## Rejected

Each experiment below quotes the figure it was measured against at the time,
so compare a result with its own baseline rather than with the current
headline. The 63.6 appearing here is the in-sample number from before held-out
evaluation existed; it is not comparable to the current figure at the top of this file.

### alias-joins-for-constraints

**Matching catalogue listings on a mod's previously seen names.** Both joins
between the masterlist and the catalogues match on a mod's current name only, so
a renamed mod loses its listing and every requirement that listing states.
Widening them to `alternateNames`, the other names the corpus has seen a mod
under, recovered 36 listings and twelve load-after edges.

It was reverted the same day, and the reason is worth more than the change was.
`alternateNames` are not previously published names. They are whatever any
submitter typed for that identity, including shorthand and generic words. One
submitter listed Sailor Cat's `Wish Spell` as plain `Wish`, which minted `wish`
as an alias; mod.io has an unrelated mod titled `Wish` by TarroBlackfeather that
declares a dependency on `Make a Wish` by a third author. So the join published
the claim that Wish Spell requires Make a Wish, as a hard edge, between two
strangers' mods. Both sit on divider 34.5, so that edge alone decided their order
and reversed it against the only submitted order holding both. The
corpus-contradiction guard could not catch it: it needs two witnesses and there
was one.

An ambiguity guard would not have saved it either. `wish` is unambiguous within
the masterlist; it is simply wrong. Generic words typed by submitters will keep
colliding with real catalogue titles, so the data is unsuitable for this by
construction rather than by accident.

The distinction to keep: the same field is safe for **placement** and unsafe for
**constraints**. Resolving an unknown name to a group is a soft guess where being
wrong costs a category, and `alternateNames` is used for exactly that in the
browser, where it recovers 260 names nothing else reaches. Turning it into a hard
ordering edge is a claim about two real authors' work that silently reorders
somebody's game. Same data, entirely different blast radius.

The renaming problem it set out to solve is already handled properly: the
crawlers record a listing's previous titles as aliases when a title actually
changes, which is authoritative in a way that submitter-typed names are not.

### community-wiki-orderings

**Adopting orderings from the BG3 community wiki.** Its general load order guide
is an independent convention, written by `somecookie` and last edited in October
2024, with no reference to Astra's dividers. Where it agrees with VOLO that is
genuine outside corroboration, and it agrees on almost everything: ImpUI first,
libraries early, fixes before items, races and classes as expanded content, heads
and hair among the visuals, dice last of them, Compatibility Framework last of
all. Compared by divider slot rather than by the `groups` array, which is only
the within-section tiebreak and reads as a contradiction if mistaken for the load
order.

Two specific claims were tested against the corpus and both lost.

Its section 3.5 names six user interface mods in order. Players disagree on four
of the ten pairs, most clearly on Better Tooltips ahead of Dynamic Sidebar, 20
orders against 9. Two of the four edges survive arbitration and the one resting
on merit has 4 orders against 3, which is too thin to spend a hard constraint on.
Not added. Finding that gap is what produced the sequence arbitration guard.

Its section 2 puts new spells alongside items and fixes, well ahead of where VOLO
places them. Measured across 64 working orders holding enough spell mods to
judge: Equipment loads before Spells in 40 orders against 21, Armor in 26 against
17, with Clothing and Weapons at coin flips. VOLO's Spells at divider 47, behind
Equipment at 34.5, is what players actually do. The guide is not wrong so much as
coarser: its one section covers items, spells and fixes together, and players draw
a distinction it does not.

### glow-eyes-eotb-incompatibility

**Publishing the incompatibility the Unique Tav guide states.** That guide says
Astralities' Glow Eyes and Eyes of the Beholder are incompatible and that you must
choose one, and the KAVT manual says both need patches. `incompatible` in the
curated rules is empty, so this looked like its first real entry, and both UUIDs
were read directly from the paks rather than matched by name.

Ten corpus orders hold both mods. Nine of them are reported working. Whatever the
guides mean by incompatible, it is not what a warning on this page would say, and
publishing it would put a false caution on two real authors' work on the strength
of a document that the people playing the game contradict nine to one.

The mods the KAVT manual calls outright incompatible were checked afterwards
against both authors' catalogues and the corpus, and none of them is publishable
either. KAVT itself is well used: 37 orders hold it, 31 of them reported working.
Against that, Character Creation Overhaul has 4 installs and appears alongside
KAVT in two orders, one of them working. Extra Scars for Everyone has 2 installs
and never appears with it. More Makeup and Tattoos and Lemons Makeup and Tattoo
Non-Replacers are not in the masterlist at all.

One working order holding a supposedly incompatible pair is the same objection
that sank the Glow Eyes claim, only smaller. And never co-occurring is not
evidence of a conflict, for the reason already written down under the name twins:
absence is not a signal when the population is two installs. The manual may well
be right about all of them. The corpus cannot corroborate it, and this project
does not publish claims about other people's work on the strength of a document
alone.

### modio-over-vague-nexus

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

### uncategorised-mods-in-place

**Keeping uncategorised mods in place.** Rather than sorting them to the end,
give them the position of the last categorised mod above them. Measured 61.8
against 63.6. Unplaced mods genuinely do cluster at the end of real orders.

### divider-vocabulary-classifier

**The divider vocabulary as a classifier.** Using the sub-divider labels
(Warlock, Tiefling, Waypoints, Summons) to place mods nothing else could reach.
Placed 67 mods, cost 0.7 points. Available behind `VOLO_DIVIDER_VOCAB=1`.

The first measurement of this was worthless: the pattern table had been written
through a JS string literal, which turned every `\b` into a backspace byte and
dropped every `\s`, so the rules matched text that cannot occur. Repaired and
re-measured, the conclusion held. `scripts/smoke-test.mjs` now asserts the
tables are reachable and internally consistent, which is the check that would
have caught it.

### astra-category-order-wholesale

**Astra's category order wholesale.** Replacing the learned sequence entirely
measured 60.4 percent against 63.6. Preserved on branch
`experiment/astra-order`.

The pattern across these: with so few working orders, the corpus is the binding
constraint, not the algorithm. More submissions beat more cleverness.

## Reversed

### listing-categories-fallback

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

### volo-sorted-not-evidence

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

### no-per-request-network-calls

**No per-request network calls.** The first version scraped mod pages per mod
per request, sequentially. A thousand-mod list meant roughly eighteen minutes of
network and rate limiting, which was misdiagnosed as a large-dataset problem and
effectively killed it. External data is now crawled ahead of time into committed
JSON.

### a-pak-filename-is-not-a-second-mod

**One mod can ship under several names and one filename can outlive its title.**
KAVT, KAVT NVP and Unique Tav all ship a pak called `unique_tav.pak`, all declare
the folder `unique_tav`, and all carry the UUID
`4cb0fd40-7212-4fe9-8733-9a8dbc6637ae`. They are one identity: KAVT is Unique Tav
renamed, and NVP is its variant. Extracting the three archives into one directory
overwrites the same file three times, which is the same fact in a different form.

Worth recording because it was misread the other way round. The corpus contains
orders listing that mod as `unique_tav`, and VOLO resolving the name Unique Tav to
the KAVT row was taken for a bad alias of the kind that produced the `Wish`
mistake. It is not. The identity ladder had it right, and the paks confirm it.

The general rule: a shared name is only evidence of a shared mod when the UUID
agrees, and the UUID is in `meta.lsx` inside the pak. `scripts/pak-uuid.mjs` reads
it, so this is a lookup rather than an argument.

### never-alter-mod-names

**Mod names are never altered.** They are matched against what players have
installed, so normalising or tidying a name silently drops the mod from sorting.

That holds even when a name is provably wrong. One mod of 9502 carries
`Disguise`, then U+00E2 U+2030 U+00A0, then `Polymorphed (Interrupt in
Disguise)`. Those three characters are the CP1252 reading of the bytes E2 89 A0,
which is UTF-8 for U+2260, the not-equal sign. Reversing the misreading produces
the title mod.io listing 4691460 uses. So the repair is demonstrable rather than
a guess, and it is still not made.

The names in this entry are written as codepoints because the repository audit
rejects non-ASCII in committed files.

Nothing here originates with us. The order uploaded to R2 already carried the
corruption, and its SHA-256 matches the hash recorded on issue #99, so what is
published is what the submitter's export produced. Three separate orders carry
the same bytes. Repairing the masterlist would also not hold, because the miner
rebuilds it from those files, so the change would have to live in the miner and
would then be editing submitted evidence on every run.

The name is stored as submitted. Matching is unaffected either way, because
`norm()` strips everything that is not a letter or digit before comparing. Anyone
who finds this and reaches for a fix is looking at the decision, not an oversight.

### console-load-orders

**Console load orders cannot be read or written, and this was asked properly.**
Larian Support was contacted on 10 August 2026 and the question was escalated to
a Community Manager through the Discord. The answers, over 12 to 15 August: there
is a `modsettings.lsx` on consoles, but no way to extract it or resubmit it once
modified; external software is not compatible with mods on consoles; and unless
everything is submitted through mod.io they cannot guarantee it would work. A
request for an order-import feature in the in-game Mod Manager was left open
rather than accepted, with an offer to reach out if it changes.

The limitation is architectural rather than a policy anyone could waive. Load
order is an input read at startup, so a mod cannot reorder the mods it was loaded
alongside; a `.pak` is data in the game's virtual file system with no filesystem
access; and Script Extender, the only thing on PC that has such access, is a
native DLL that cannot exist on a console. A utility mod that reads the order on
one run, sorts it and asks for a restart fails at every step, not just the write.

What remains viable needs nothing from Larian. Console mods come only from
mod.io, whose API exposes a user's subscriptions under their own authorisation,
so VOLO can read a player's mods and show them a recommended order to apply by
hand in the in-game Mod Manager. That is a load order guide that happens to be
generated. mod.io has no ordering concept either, so the write half is closed on
both sides.

That guide was considered and deliberately not built. Its best case is still a
player dragging a hundred and fifty entries by hand with a controller, and
reaching even that means adding mod.io accounts to a tool that today holds no
accounts, sets no cookies and asks nothing of anyone. That is a poor trade for a
feature whose ceiling is tolerable. The decision is not permanent, and it does
not need a controller test to revisit: the FAQ asks console players to say so on
Nexus or GitHub, and a queue of people asking is a better reason to build than
any measurement taken in advance.

### move-as-little-as-possible

**Move as little as possible.** A sorter that reshuffles a working load order
without cause is worse than useless.

## Incidents

### cache-poisoning-2026-08-04

**Cache poisoning, 4 August 2026.** Twice in one day the site served HTML in
place of a JavaScript or CSS asset. Cause: during deployment propagation a
request for a not-yet-available asset gets `index.html` with a 200 status, and
our own `/assets/*` rule then told the edge to cache that answer for a year.
Fixed by capping asset cache at an hour and adding `verify-deploy.mjs`, which
detects and repairs it. A stronger fix, routing rules that return a real 404,
is still open.

### stranded-submission-2026-08-16

**A submission accepted and then lost, 16 August 2026.** Issue #105 was
validated, its submitter was told in writing that it had been merged, and the
order never reached the corpus. It sat that way for a day.

Landing rebases a submission onto whatever main holds once the rebuild
finishes. The order file is new, so it always applies. Every submission also
adds a record to `provenance.json`, a single sorted map they all share, so
issue #104 landing five minutes earlier moved the lines #105's patch expected
and the apply was refused. The run failed after the acceptance comment had
already been posted.

The collision was known. It is written up under the corpus pull requests as the
reason those branches were abandoned, where it was fixed by removing the
branches and left standing on the path every order actually takes.

The record is data rather than text, so it is now lifted by key before the
rebase and written onto whichever `provenance.json` is on main, which two
submissions cannot contend over. The judgement intake made is carried across
rather than recomputed, and #105 shows why that matters: it was a VOLO-sorted
order at 0.989 agreement, so recomputing it against a moved masterlist could
have changed whether it counts as independent evidence.

Both replay nets missed it, each for the same reason. They treated a comment
from the pipeline as proof the pipeline had handled the order, when it only
proves the pipeline spoke. A third pass now takes the filename out of the
acceptance comment and asks whether main holds that file.

### stale-session-export-2026-08-05

**Stale session export, 5 August 2026.** A user exported a 102-mod order after
importing a 59-mod file, because picking a file on the Submit page does not
re-import it and the Export page silently used the remembered session. Fixed by
naming the source import on the Export page and making persistence opt-in.
