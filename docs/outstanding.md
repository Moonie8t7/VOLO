# Outstanding work

Everything known to be wrong, suspected and not yet checked, or checked and
deliberately left alone. Current as of 2026-08-14.

## Where this stands

Three entries are open and none of them is a defect. Two are decisions that were
made deliberately, and the third is a fact nobody can now recover. Everything
else on this list has either shipped, been measured and closed, or been tried and
rejected with the numbers kept.

**The four batches are done.** Batch 4 ended in a rejection rather than a change:
preferring mod.io where the Nexus category is vague moved 41 placements and did
not move held-out agreement at all, so it was reverted and the measurement that
answered it stayed in the builder.

**Seven things were found on the way and fixed rather than filed:** an order
reported as merged that was never committed, an approval label that never
expired, a Google Apps Script project sitting in the corpus, an audit that only
asked whether a corpus file was valid JSON, uuid case that would have split every
identity in an upper-cased export, two XML readers decoding different escapes, and
a cancelled approval that nothing noticed.

**Community, all cleared on 14 August 2026.** The Drive folders are Restricted,
so the leaked identifiers open nothing. Becky's order is in the corpus. Replies
are sent to Actualsailorcat, issue #67, issue #22, jupppo, Keileon and
CoffeeMaleficent1956.

**Measured state.** Held-out agreement 64.9 percent across 61 evaluated orders,
random baseline 50.8. Corpus 79 orders, 9,307 mods.

**A note on this file's own numbers.** An audit challenged three figures here as
unreproducible. Two were genuinely stale and are restated. The third was
re-derived at the commit it describes and the entry was right in every particular
while the audit was wrong, so treat a challenge as something to check rather than
something to believe.

**One item, one place, one state.** An earlier version of this file kept a
hand-written summary above a generated inventory, and the two drifted apart three
times in a day: it once reported twelve critical defects as open when all twelve
were fixed. If you add an item, add it once.

**Where the findings came from.** Two automated audit passes on 2026-08-12,
read-only, every check required to execute a script rather than assert a number,
followed by targeted verification of anything that looked worth acting on. Treat
every figure here with suspicion. Roughly one in five needed correcting once it
was reproduced by hand: a dependency share reported as 53 percent and as 35
percent was really 60 percent of one denominator and 53 of another, with neither
stated; two passes reached opposite conclusions on browser dependency lookup
because one measured the masterlist and the other measured the browser; and a
claim that the breakage table is published on the measured page was simply wrong,
it lives in a repository file nobody reads.

Severity means: **critical**, evidence is lost, split or double-counted at
material scale, or two components disagree about identity; **major**, the same but
small or partly mitigated; **minor**, a data-quality wart; **decision**, nothing
is broken and somebody has to choose.

---

## Shipped

Every fix below is on `main` and deployed. Held-out agreement stands at 65.0
percent across 59 orders. Almost none of this work was meant to move that score,
and the one change that was meant to move it was meant to move it down; the rise
since comes mostly from the corpus growing. An earlier version of this line
claimed the figure opened and closed a day unchanged at 64.2. That pair is only
reproducible over about five hours of 12 August, not a day, so it has been
replaced with the measured figure rather than a narrative.

### Identity

- **`d5dc30e` Count a mod as one mod however its owner exported it.** The miner
  read only the UUID field, so 865 entries were counted by name in the masterlist
  and by UUID in the browser. Identity now resolves UUID, then the UUID at the end
  of the pak filename, then a corpus-voted name, then a `name:` fallback. 294
  fragmented identities came back together.
- **`d5dc30e`** The divider guard tested `entry.UUID` before identity was resolved,
  so a thin export's restyled dividers were mined as mods and one 521-entry order
  recorded no section at all. Fixing that exposed a regression the identity change
  had itself introduced: 103 divider paks entered the masterlist as mods, and the
  browser would have written their real UUIDs into exported orders, which is what
  makes BG3 Mod Manager move somebody's actual dividers. Caught before it shipped.
- **`9d5ff94` Stop one mod answering for every mod written in another script.**
  Name lookups strip everything outside a-z0-9, so a title in Chinese, Japanese,
  Korean or Cyrillic normalises to the empty string. Three of four indexes guarded
  that key; `byNormName` did not, so 23 mods in one order shared a bucket and the
  last one written answered for all of them.
- **`01909c3` Apply the load-after exception to thin exports too.** Compatibility
  Framework is pinned late on purpose, and the flag was read by UUID alone, so the
  one mod the exception exists for lost it in exactly the orders that needed it.

### Evidence

- **`fb875eb` Read the requirements a TSV states.** `for (const dep of
  entry.Dependencies ?? [])` iterated a comma-separated string character by
  character, silently dropping 118 of the 222 requirements the corpus states, in
  the only path the sorter treats as a hard constraint. Declared edges 561 to 630.
- **`fb875eb`** The submit page discarded every section header when converting an
  order, on every format via the "use the order imported here" button. That is
  1,462 headers across the 25 corpus orders that carry them, and section headers
  are the strongest placement evidence there is.
- **`a36d6bb` Stop counting VOLO's own sort as somebody agreeing with it.** A
  self-declaration was believed absolutely, so an order that had been through VOLO
  and was honestly declared self-arranged taught the sorter its own answer. The
  judge gained a neighbour rule: 85 percent shared mods plus a 0.15 agreement jump
  is VOLO-influenced whatever was declared. Held out fell 64.3 to 63.8, which is
  the change working rather than failing.
- **`bf9f0a2` Count one opinion about ordering per person, not per export.** Seven
  groups of near-identical orders, 17 files. Fifty-nine working orders are
  forty-nine independent ones. Only sequence is de-duplicated; presence still
  counts from every copy. A second leak surfaced in the same pass: `orderWitness`
  read every working order rather than only those allowed to speak about sequence.
  Re-derived at that commit on 14 August 2026 in a throwaway worktree, because an
  audit had reported it unreproducible and claimed 5 groups over 13 files with 58
  working orders. Every figure above is right and the audit was wrong: 59 working
  orders, 14 near-duplicate pairs, 7 groups, 17 files, 49 independent opinions.
  The audit's own numbers were the ones nobody had checked.
- **`523c343` Apply one rule for whether a Nexus listing belongs to a mod.** Two
  consumers of the enrichment file, ninety lines apart, applied opposite policies.
  25 mods were told a listing was theirs on a name similarity of 0.9 alone, two of
  them provably the wrong mod. Requirement edges now fan out to every claimant
  rather than landing on whichever was written last.

### Correctness a user can see

- **`4269194` Stop deleting mods whose names contain a run of dashes.** A row was
  read as a section header when four or more of `- = _ ~` appeared anywhere in its
  name, so "Angel Wings And Halos ____ By Ren", 264,623 downloads, vanished from
  every order containing it. Checked against all 31,363 corpus rows before
  changing: the tighter rule classifies every one identically.
- **`771b9e6` Read a section header by its most specific word, not its first.**
  `skins` was declared above `dice`, so 172 dice sets were filed as Bodies on
  divider 99 instead of Dice on divider 90. 224 mods regrouped.
- **`dfbb24f` Credit the mods a thin export cannot name.** Five percent of corpus
  rows carry an author in the file; the masterlist holds one for most of the rest,
  and every visitor downloads it. Displayed authors went 1,526 to 10,797 of 30,979
  and orders showing none at all went 66 to 0.

### Intake and reporting

- **`31b4fee`** Intake forced the filename `submission.json` on every submission,
  so only JSON could be read through an issue. A 539-mod TSV was rejected as "Not
  valid JSON".
- **`eba7706`** A filed order was named `.json` regardless of its format, which the
  repository audit refused and which would have made the file unreadable to every
  script that reads the corpus back.
- **`656cdc1`** Every submitter received their verdict twice.
- **`599a19c` Measure breakage with the miner's reader instead of a private one.**
  It could not parse `modsettings.lsx` at all, identified mods by the UUID field
  alone, counted dividers as mods, and carried the same string-dependency bug.
  Three of the six published figures were wrong.
- **`220b05e`** Six exported constants had no description of their own.
- **A reviewed order lands by the direct path instead of by merging its branch.**
  A submission pull request carries only the corpus file, so merging it committed
  an order the README did not describe. `npm run build` re-mines the corpus during
  the run, the figures test compared that against the unregenerated README, and it
  correctly failed. The regeneration that followed repaired main within minutes,
  but the failing mark stayed on the commit for good, and the same failure fired
  on the pull request, so red carried no information at the moment somebody was
  deciding whether to merge. All three orders merged on 13 August 2026 went red
  this way. Labelling the issue `approved` now replays the submission with the
  hold lifted, and it lands as a clean order does: one commit holding the order
  and everything derived from it. Approval moves only the hold, never the
  validation. The superseded branch is closed, having only ever carried the corpus
  file. Weakening the figures test was rejected: it caught a real README drift and
  would stop catching a masterlist committed without its README.
- **`66a0bd3` A submitted order could be reported as merged without ever being
  committed.** Intake stages the order and `provenance.json` together, and the
  already-landed guard took the first staged path as the order. Git lists staged
  paths byte-sorted, so `provenance.json` falls after a `working_` order and
  before a `not_working_` one: on exactly the orders that land automatically, the
  guard asked whether `provenance.json` was on main, which it always is. Any
  failed apply was read as already landed, and the issue was closed with "Merged
  automatically". Issue #67 was lost this way on 11 August and stayed lost for two
  days. Two more that looked lost were not: #78 landed as a `.tsv`, and #91 landed
  while this was being checked. The order file is now chosen explicitly and an
  empty result is an error. This is the third time the "accepted but never landed"
  failure has appeared wearing a different face.
- **`4802bec` Approval was a permanent grant on a mutable issue.** Intake replays
  on `edited` and nothing removed the label, so an approval given for one order
  would have landed whatever the issue said afterwards with nobody reading it. The
  label is now spent as soon as it lands something. The same commit stops the
  branch retirement hanging off the step that closes the issue: a bare `if:` means
  `success() && ...`, so a failed comment would have left the branch open and
  mergeable, which is the one outcome that step exists to prevent.
- **Every order now says where it came from, and silence is no longer a verdict.**
  Fifteen orders had no provenance record and were read as independent by
  default, so nothing separated "measured and found independent" from "never
  looked at". `scripts/backfill-provenance.mjs` measures and records all fifteen,
  and the audit now fails on a corpus file without a record. All fifteen are
  independent, so the masterlist is unchanged: zero rows differ in group, slot or
  evidence tier, which is measured rather than assumed.
  The measurement needed correcting first, and this is the part worth keeping.
  Read in place, `New8.json` agrees with VOLO on 0.981 of its pairs, above the
  0.98 threshold that withdraws an order's positional evidence. Rebuilt without
  its own contribution the same order reads 0.774. Intake measures an arriving
  order before admitting it, so its figure is honestly held out; a backfilled
  order is already in the corpus, so measuring it in place asks how well VOLO
  agrees with what VOLO was taught by. Taking the first reading would have thrown
  away a 297-mod order's sections for the offence of having been listened to. The
  script now re-measures anything above the threshold against a masterlist built
  without it, which is expensive and only ever runs for the few that the cheap
  reading condemns.
- **A held order waits on its issue, and a cancelled approval no longer vanishes.**
  A held order used to open a corpus-only branch. It carried an order the README
  did not describe, so its own checks failed on it and that red mark showed every
  time somebody looked, at the exact moment they were deciding whether to accept.
  Two open at once collided on `provenance.json`. None of it was load-bearing:
  approval replays from the issue body, so the branch never reached main. Held
  orders are labelled `held-for-review` on the issue that already carries the
  diagnosis, and both labels are cleared once an order lands. That retires the
  branch cleanup, the provenance conflict class and the last permanently-red
  submission commits in one go.
  The hourly stranded-submission replay could not see a cancelled approval. It
  replays issues with no reply at all, and a held order always has its diagnosis
  comment, so an approval whose run lost the concurrency race sat labelled and
  unlanded forever. It now also replays any issue still carrying `approved` after
  the work should have finished, keyed on when it was last touched rather than
  when it was filed, because a submission from last week can be approved today.
- **One author, one spelling, and the published identity namespace is documented.**
  Exports disagree about capitalisation and spacing, so the same person arrived as
  `HyperspaceTowel` and `Hyperspace Towel`, `kylin3` and `Kylin3`. Twelve authors
  were split that way across 91 rows, which showed wherever authors are listed and
  gave the author-catalogue tier two small catalogues instead of one. The most
  frequent spelling now wins, the same rule a mod name uses, and folding is for
  comparison only: what gets published is always a spelling somebody actually
  wrote, never a lower-cased invention, because these are real people's names.
  Twenty rows moved onto twelve canonical names and no author carries two
  spellings now.
  Separately, the schema's `uuid` field had no description at all while 262 rows
  carry a synthetic `name:` key. Anyone consuming the published masterlist met a
  second identity namespace with nothing saying it existed. It is described now,
  without a count baked in, since that is the figure-drift habit this file keeps
  catching.
- **A retired identity losing its Nexus listing is now visible.** The enrichment
  file is keyed by uuid and written by a nightly crawl, so a mod whose identity a
  mine retires keeps its old key until the crawl next runs, and the read-time
  filter drops it. Dropping is right, since the alternative is attaching one mod's
  listing to another, but it failed quietly and a mod that lost its listing looked
  exactly like a mod that never had one. The count is reported now. Measured
  today: 0 of 2,671 keys name an identity the masterlist no longer holds, so the
  mitigation and the crawl between them are keeping up, which is what this entry
  was open to find out.
- **A mod renamed since your last update is recognised again.** The miner kept
  only a mod's most frequent name, so everyone still listing the old one matched
  nothing and fell through to whatever the next rule guessed. The corpus holds
  288 mods under more than one name, 332 alternates in all, and 260 of those reach
  a mod no canonical name reaches. `ImpUI_P8_Fork` now resolves to
  `ImpUI (ImprovedUI)` rather than to nothing. The other 64 collide with a name
  some mod genuinely publishes under, so aliases are added in a second pass and
  can only fill gaps: a canonical name always wins its own key, which the smoke
  test checks from both directions. UUID already covered most of this, which is
  why it stayed hidden; a thin export carries no UUID, and that is exactly the
  case where the name is all there is. Held-out agreement 65.0 percent, unmoved,
  because these mods were being placed by later rules rather than not at all.
- **Both XML readers decode the same escapes.** `modsettings.lsx` is read twice
  here, by the parser for the browser and by the miner for the corpus. The parser
  decoded the five named entities and both numeric forms; the miner decoded only
  the named ones. A mod called `Tav&#39;s Hair` reached the miner with the escape
  intact and the browser without, so the two disagreed about the name, which is
  what every name lookup and the `name:` fallback identity rest on. Four `.lsx`
  files in the corpus exercise that reader and none carries a numeric escape
  today, so this changed nothing: 0 of 9,238 rows differ. The smoke test now
  parses an `.lsx` carrying a named, a decimal and a hex escape and requires the
  decoded name, and separately requires the miner to carry the same rules.
- **UUID case can no longer split an identity.** A UUID is hexadecimal and case
  means nothing, but identity here is an exact string match, and the two halves of
  the path disagreed: the filename reader lower-cased what it extracted while the
  UUID field was taken as written. Measured before fixing, on a real 1,488-mod
  order, upper-casing its UUIDs produced 1,488 identities with **none** in common
  with the original. One exporter choosing upper-case would have taken a whole
  submission with it, and a passing build would not have mentioned it. Both
  readers now share one rule, and the smoke test re-parses the largest order in
  the corpus with its UUIDs upper-cased and requires every identity to survive.
  Inert on today's data, which is the point: 0 of 9,238 rows changed and the
  dependency graph holds the same 712 edges.
  Fixing it briefly cost two of those edges. Normalising turns a missing UUID
  into an empty string, so a requirement stated by name alone, on a mod whose own
  UUID the corpus never supplied, compared equal to itself and was dropped as a
  self-reference. The guard now needs a UUID to be present before it will call
  something a self-reference.
- **A working order sat unverified for eleven days because of its filename.**
  `New8.json` was added on 3 August by a commit titled "Add Astra's Load Order
  Dividers and a new working order", and it is the only corpus file that commit
  adds. The status of an order is read from its filename prefix, this one had
  none, so 297 mods went uncounted as verified and the order was kept out of the
  verification set entirely. Renamed to `working_New8.json`, with its provenance
  record moved to match. Held-out agreement 64.8 to 65.1 percent on 59 orders
  rather than 58, cautions 34 to 28, and mods showing installs with no working
  order 67 to 65. Reading status from a filename is the underlying fault and is
  still how it works; what makes it survivable is that a wrong prefix understates
  evidence rather than inventing it.
- **The masterlist page counts orders that were confirmed working, not orders
  seen.** It rendered raw presence, so 67 mods showed "seen in 3" beside a caution
  saying the mod had never been in a working order. Both were true and together
  they read as a contradiction, which is how the same display managed to be two
  separate open items. It now leads with the confirmed-working count, says plainly
  when there is none, and puts the whole breakdown where a reader asking about
  that mod will find it. The miner supplies the missing piece: `voloSortedInstalls`
  records how much of a mod's support is VOLO's own output returning. Presence
  still counts, because those mods were really installed and really played, but
  4,229 mods have some support of that kind and for 797 it is the only support
  they have. That was not visible anywhere before.
- **The never-verified caution now needs two orders, and a working twin answers
  it.** It fired on any mod seen once in a broken order and never in a working
  one, which was 496 mods. A warning pointing at 496 things points at nothing,
  and the population grows with every held submission, so the single-sighting bar
  was getting noisier as the corpus got better. It now asks for two separate
  broken orders, and a row of the same name with working installs cancels it.
  That is a weaker claim than deciding two same-name UUIDs are one mod, which
  stays open: all it records is that the name works for somebody. Together these
  take the caution from 496 mods to 34, a 93 percent cut, with zero placement
  changes, because the caution is advice and never an input to the sort.
- **Install counts are per order rather than per entry.** `installs` counted
  distinct files while `workingInstalls` and `brokenInstalls` counted entries, so
  an order listing a mod twice verified it twice, and a caution asking to have
  been seen in two orders would have accepted one order listing it twice. All
  three are now sets of filenames. Worth saying plainly: this corrected nothing
  in the present corpus. The totals are identical either side of the change at
  28,478, because no order currently lists a mod twice. It was fixed for the bar
  above to mean what it says, not because it was inflating anything today.
- **`331115b` The audit asks whether a corpus file is a load order.** It only ever
  asked whether the file was valid JSON, which is why the file below survived. A
  file under the corpus directory must now carry a non-empty order array. All 80
  pass, and restoring the offending file reproduces the failure that should have
  been raised in July. The Drive folder IDs that file carried have been public in
  the repository since 31 July 2026 and remain in history; whether that matters
  depends on how those folders are shared, which needs checking in Drive.
- **`6432338` A Google Apps Script project was sitting in the load order corpus.**
  `VOLO Cleanup.json` held an `appsscript.json` and a `Code.gs`, not an order. It
  survived because it is valid JSON and that is all the audit checked. It changed
  nothing, measured rather than assumed: mining with and without it gives the same
  8,858 rows with no difference in group, divider slot or install count. It did
  count as a corpus file everywhere the corpus is counted, so every published
  "N orders" figure was one too high. Found while asking why four orders sit
  unlabelled.
- **Held orders no longer conflict on `provenance.json`.** Each branch added a
  record to the same sorted map, and adjacent records share their closing lines,
  so resolving around the conflict markers spliced two records into one and
  produced invalid JSON. It failed loudly when parsed, which is how it was caught,
  and it would have recurred whenever more than one order was held. Landing
  directly removes the merge entirely: `writeProvenance` re-reads the file and
  merges the record, so two orders approved at once cannot collide.

---

## Open

Two entries. Most cover the twenty-six findings of the first audit,
because the name-twin problem alone was reported five separate ways by different
passes and is listed once here; three more were measured on 13 August 2026 by an
audit of this document against the tree it describes.

Nothing here is known to harm a user today. That was not true a day ago: the
never-verified caution fired on 496 mods and is rendered in the browser, and an
earlier version of this paragraph claimed no user-facing item while the entry
below called itself the most user-visible one open. The caution now asks for two
orders and is down to 34, so the claim holds again. The rest are latent, and two
are decisions rather than defects.

### Decisions

- **Name twins: one name carried by more than one real UUID.** Measured on
  14 August 2026 under the alphanumeric key the code actually joins on: 140 names
  are carried by two or more rows, 51 of those place the same name in more than
  one group, and 1,172 install observations sit across them. Under exact-name
  matching it is 87. The count depends entirely on which rule is asked, which is
  why the figure is given with its rule attached; an earlier version of this entry
  said 89 and could not be reproduced under any of them.
  Reported five separate ways by different passes; it is one problem.
  **Deliberately open, and now with a measured reason.** Three candidate
  discriminators were tested on 14 August 2026 and all three fail. The Nexus
  enrichment looks decisive, agreeing on a single listing for 68 of the groups and
  disagreeing on none, and it is worthless here: enrichment matches a mod to a
  listing by normalised name, so same-name rows share a listing by construction.
  That is the definition, not evidence. The two signals that would be independent
  are barely present: a folder is known on both members of only 8 of the 140
  groups, an author on 3, and the folders that do differ differ cosmetically, as
  `Tasha's_Hairs` against `TashasCauldronHairstyles_1af5bb45`.
  So the position argument stands: never co-occurring is not evidence that two
  UUIDs are one mod, and merging risks collapsing genuinely different mods. Stays
  open until something non-circular can tell them apart.
### Provenance and labelling

- **Two orders still carry no verdict.** `LastExported.json` and
  `LastExported(1).json` hold 1,066 and 11 entries, arrived in the founding
  import, and have no prefix saying whether they worked. They have provenance
  records and are measured as independent, so they teach placement; what is
  missing is the one thing nobody can now supply, which is whether the person who
  played them finished the game. Left open deliberately, because the alternative
  is inventing an answer on their behalf.

### Intake

---

## Closed without code

Each was verified, found real, and deliberately not acted on. Recorded so nobody
re-derives them or fixes them by reflex.

- **Accented letters are deleted rather than folded.** All 39 accented rows in the
  corpus resolve by UUID before any name lookup is reached. Folding changes one
  masterlist row.
- **No NFC or NFD normalisation anywhere.** Every name in every source is already
  NFC. Latent, not live, and the same defect as the accents seen from the other
  side.
- **`findMod` uses a normalisation no other component uses.** There are zero
  incompatibility rules, so that loop has iterated zero times on every sort ever
  run.
- **`build-external-categories.mjs norm()` has no `String()` guard.** Zero
  non-string values in either catalogue, and every call site is already guarded.
- **Normalised-name collisions cost 184 listings their lookup key.** At most 23
  keys could serve a group read off the wrong listing, in the tier that only fills
  silence.
- **`AUTHOR_PRIOR` joins authors to catalogue handles by exact string**, and
  **catalogue author identities split across casings**, and **the author tier's
  live output is one submitter's dice set**. The tier places 18 rows of 8,498 and
  repairing the join buys three more. The cause is that 4.9 percent of corpus rows
  carry an author at all. Too thin to repair, and that is the finding.
- **External-category claims are decided by name alone.** Five to 28 rows of one to
  five installs, in the weakest tier.
- **`LISTING_ALIASES` has 92 candidates.** Every candidate row is unsorted or
  neighbour-inferred with one to six installs; an alias fills silence rather than
  correcting anything.
- **`labelOf` promotes two unprefixed filenames to working.** Relabelling would
  remove 167 mods' working evidence to satisfy a filename convention.
- **The fuzzy Nexus matcher lands on translated re-uploads.** Real, and since
  `523c343` nothing consumes a fuzzy match except a human report. Fix it first if
  that output is ever consumed again.
- **`enrich-from-nexus.mjs CATEGORY_MAP` is keyed on categories Nexus does not
  serve.** The field it fills is read nowhere outside that script's own report.

---

## Tested and ruled out

Negatives with numbers behind them, so nobody investigates these again.

- **`working_issue-71_2026-08-11.lsx` being VOLO's own sort coming back.** A
  modsettings export of 146 mods, recorded at 0.955 agreement and declared
  self-arranged, with no near-duplicate anywhere in the corpus. The neighbour rule
  could not see it and the threshold deliberately does not fire on a declaration,
  so it sat suspicious on agreement alone, which is the one thing the design
  refuses to act on.
  Settled on 14 August 2026 with the held-out measurement built for the provenance
  backfill: 0.926 agreement in place, 0.930 with the masterlist rebuilt without
  it. An order that had taught VOLO its own answer would collapse when removed, as
  New8.json did from 0.981 to 0.774. This one does not move, and is marginally
  higher without itself. It is an independent order that agrees closely because
  whoever arranged it used the same conventions VOLO learned from everybody else.

- **Reconciling a mod's author against its Nexus listing.** Of 9,307 rows, 459
  have an author in both the corpus and a matching Nexus listing, and 131 of those
  disagree. That reads like a data-quality problem and is mostly the opposite: the
  corpus carries the pak's own metadata, which is what an adopting author updates
  first. `ImpUI (ImprovedUI)` is bibsan in the corpus and still Djmr on Nexus;
  `5eSpells` is Celes/DiZ against DiZ91891; `BetterTooltips` names both authors
  where the listing names one. Preferring the listing would replace the better
  answer with the staler one, and there is no rule that separates an adoption from
  a co-credit from a renamed handle. Measured 14 August 2026.

- **The miner and the browser attributing one corpus entry to two different
  masterlist rows.** Real when it was found. Measured again on 14 August 2026 after
  the identity work: 36,087 corpus entries parsed, 35,984 resolved to a row, and
  **zero** attributed to a row other than their own identity. Closed by the uuid
  case fix, the alternate-name index and the identity ladder rather than by
  anything aimed at it.
- **Widening the Nexus requirement join beyond exact name matches.** It drops
  around 140 candidate edges, which reads like lost evidence. Fuzzy matching
  against twenty-four thousand catalogue names was measured and rejected as a
  false-positive machine, and that is recorded under Rejected in
  `docs/decisions.md`. Listed here because it kept being rediscovered as a defect.

- **Purging the Apps Script blob from GitHub's own storage.** History was rewritten
  with `git filter-repo` and force-pushed, so no branch holds `VOLO Cleanup.json`
  and the two Drive folder IDs return nothing under `git log -S` across every ref.
  GitHub still serves it: fourteen `refs/pull/*` refs stay pinned to pre-rewrite
  commits, which a force-push cannot touch, and the blob is fetchable at each of
  their head commits. Confirmed by asking GitHub for the file at all fifteen pull
  request heads on 2026-08-14: fourteen answered 200 and only `#95`, created after
  the rewrite, answered 404.
  Not pursued, deliberately. The Drive folders were set to Restricted, so the two
  IDs now open nothing, and GitHub's removal flow asks directly whether the risk
  could be mitigated by rotating the affected credentials. Here it could, and was.
  Answering otherwise to force a cleanup would have meant misrepresenting a
  security situation to get housekeeping done. What remains is an inert pair of
  folder IDs and a script that moves files between two folders the maintainer
  owns. Reopen only if those folders are ever made public again.

- **Preferring mod.io's group where the Nexus category is vague.** Nexus outranks
  mod.io on every name both publish, which was never measured; it is just the
  larger catalogue. They disagree on 923 names and 121 of those decide a mod's
  group today, leaning one way: 81 mods filed under Gameplay that mod.io calls
  Spells, 67 under Character Customization it calls Heads, 37 it calls Hair. Those
  are divider slots, which is what this map exists to supply, so the change looked
  obviously right. It moved 339 keys and 41 rows, 40 into a different slot, and
  held-out agreement did not move: 65.0424 percent either way, 11 orders better
  and 9 worse. Reading all 41 by hand says the same, most better and some plainly
  wrong, since Lone Wolf Mode is not a spell. Rejected on 2026-08-14, recorded in
  `docs/decisions.md`. The measurement stayed: the builder reports how often the
  catalogues disagree and how many disagreements reach a mod, and `--conflicts`
  lists them.

- Every masterlist dependency target resolves by UUID: zero dangling, zero
  engine-module and zero name-key targets.
- All curated requirement rules resolve and agree with a fresh resolve against the
  current masterlist.
- No cycles, no self-dependencies and no alias-mediated self-references anywhere.
- `loadsAfterDependents` and `oftenAbsent` both reproduce exactly from the raw
  corpus.
- No near-duplicate pair crosses the working and broken line, so the corpus holds
  no breakage delta.
- Base-game engine modules leak into no evidence.
- Trying alternate names against the catalogues changes one masterlist row.
- `SEPARATOR_RE` eats no real mod in the corpus.
- The name-keyed rows are real mods, not missed section headers.
- Blank UUIDs: 1,966 entries carry an empty UUID string and 936 carry no UUID key,
  but there are zero all-zero GUIDs, zero whitespace-only, zero brace-wrapped and
  zero upper-cased.

---

## Notes on method

- Every fix that touches identity, grouping or hard edges gets its own held-out
  run. Bundling two of them makes a bad result unattributable, which is why these
  landed as separate commits rather than one.
- Two shapes produced most of these defects, and both are worth hunting on purpose
  rather than waiting for them to surface. **Two components each holding their own
  copy of a rule**: identity, dividers, separators, the breakage reader, the
  enrichment policy. Five instances, all silent, all found by comparing the copies
  rather than by testing either one. **A guard applied where somebody remembered
  rather than structurally**: `sortedByVolo` in three places but not
  `orderWitness`; empty-key guards on three indexes but not the fourth.
- A deploy that fails after `checks` passes is a separate signal. One commit was
  reported as live when its Pages build had failed and the site was serving a
  masterlist three hours old. Confirm both check runs before using the word live.
