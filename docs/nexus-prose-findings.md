# Mining mod descriptions for load order constraints

A study ran to answer one question: can VOLO read Nexus mod descriptions and pull
out statements like "load X after Y" well enough to write them into the
masterlist automatically?

**The answer is no, and the reason is the corpus rather than the tooling.** This
note exists so nobody spends the effort again on the assumption that a better
parser would fix it.

## What was done

A stratified probability sample of 2,100 segments was drawn from 199,564
segments across 16,957 BG3 mod descriptions, with the selection probability of
every row recorded so the sample could be scaled back to the corpus.

Every segment was labelled by hand against a frozen codebook: what the segment
is, and for each ordering claim its actor, target, direction or position, scope,
condition and strength. 1,532 segments were used to build a parser and 568 were
held back, labelled by a reader who had seen none of the parser work, and used
once to measure it.

## What the descriptions actually contain

Scaled to the whole corpus by the sampling design:

| | estimated across all 16,957 descriptions |
| --- | --- |
| segments carrying any ordering claim | ~2,840 |
| segments stating a requirement or incompatibility | ~7,800 |
| pairwise "X before Y" claims | ~1,640 |
| **both ends identifying a real, different mod** | **~600** |
| and unconditional | ~450 |

Treat the last two as order of magnitude. They rest on ten and seven observed
segments respectively, and one observation either way moves the total by about
seventy.

**Most authors describe where their own mod goes, not how it relates to a named
other mod.** Of 157 claims recorded across both halves, 70 were of the form "put
this at the bottom", which gives a region and not a pair. Of the 27 that were
genuinely pairwise, only 13 identified both ends.

## Why the yield is worth less than it looks

Of the eleven fully identified cross-mod pairs found, **at least four are a patch,
addon or variant ordered after its own base mod**: a correction patch after the
mod it corrects, a variant after its parent, an addon after its framework. VOLO
already derives those from Nexus requirements metadata and naming. They are not
new information.

A fifth comes from a segment whose own text says *"The order in which the two
mods are placed does not matter, but just in case, please place the mods in this
order"*.

There is also a structural reason the remainder is thin. An author writes "load X
after Y" almost always because they built X to patch Y, and anyone who installs
the patch installs the base. **The pairs described in prose are
disproportionately the pairs that already appear together in submitted load
orders**, which is where VOLO learns ordering anyway. Prose is weakest exactly
where it was supposed to help: pairs no player has ever installed together.

## What the parser could and could not do

Measured once against the held-out half, which the parser had never seen:

| | held-out result |
| --- | --- |
| deciding what a segment is | 91.0% correct |
| finding a segment that carries an ordering claim | precision 68.0, recall 87.2 |
| finding a segment stating a requirement or incompatibility | precision 48.5, recall 48.5 |
| **producing a complete correct claim** | **precision 3.9, recall 4.5** |

The last row is the one that decides it. A claim counts only when every scored
field is right at once, and that happened for two of forty-four claims.

**Detection generalised; extraction did not.** The parser is good at telling you
which page is worth reading and bad at telling you what it says. It found 34 of
39 claim-bearing segments in text it had never seen.

That does not rescue the idea, because the automatable part is the redundant
part. The claims with reliable enough structure to extract are the
patch-after-base ones already available from metadata. The novel ones have no
reliable structure. There is no subset where extraction is both accurate and
informative.

## The decision

Recorded as `prose-is-discovery-not-authority` in [decisions.md](decisions.md).
No constraint derived from prose enters the masterlist without a person having
verified it, and since verification costs about as much as reading the page,
prose mining is not currently worth automating at all.

If this is ever revisited, revisit it because the corpus changed, not because a
better parser is available. The ceiling measured here is roughly 250 to 300
genuinely new cross-mod constraints in the entire corpus, and a perfect parser
does not raise it.
