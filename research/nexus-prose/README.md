# Load order advice in Nexus mod descriptions

Whether mod authors write down load order constraints that the corpus cannot
learn, and how reliably those can be extracted.

The corpus learns order from what players submit. If no submitted order holds
both Mod A and Mod B, nothing can be learned about that pair, ever. An author
who writes the constraint on their own page is the only source of it. That is
the question. It is not yet answered.

## Status

An earlier attempt produced a report that has been invalidated. It concluded
that Nexus prose was close to exhausted, on evidence that could not support the
claim, and it contained a systematic parse error and a miscount. It is kept as
`archive/` because its failures are the regression suite for anything that
replaces it, not because its conclusions are worth anything.

Nothing in this directory has been used to generate a rule, and nothing should
be until the measurements below exist.

## What is measured, and what is not

The invalidated work measured, at best, the precision of seven regular
expressions. It did not measure recall, and said it had.

Recall is genuine statements found over genuine statements present. The second
number has never been established, so no recall figure can be quoted. That the
old gate examined 9,278 of 428,421 sentences says nothing about recall on its
own: a good candidate filter is supposed to discard almost everything. What is
established is only that recall is below 100 percent, because real statements
were found outside the gate, including some it could not match at all: it
required `load`, `place` or `put`, which does not match "placing" or "putting".

## The unit

A segment, not a sentence. Authors write in headings, bullets, table rows and
line-separated instructions, and advice routinely spans what a full stop would
call two sentences or fills a bullet with no full stop at all. Splitting on
punctuation creates a recall problem nobody can see, because the evidence never
becomes a candidate.

Each segment keeps its raw offsets, the heading above it, and any mod links
inside it. Cleaning the markup destroys the links, and the links are what make
a target unambiguous.

## Files

| file | what it is |
| --- | --- |
| `scripts/` | the segmenter, strata and sampler that produced everything here |
| `scripts/segment-tests.mjs` | segmenter regression suite. Run it before trusting a redraw |
| `scripts/reproducibility-test.mjs` | redraws with discovery scrambled and requires an identical sample |
| `scripts/partition.mjs` | duplicate clustering and the development/test split |
| `known-development-sources.json` | descriptions already read, forced into development |
| `claim-schema.md` | the vocabulary every label uses |
| `sampling-manifest.json` | seed, corpus hash, population and draw per stratum |
| `segments-sampled.jsonl` | the drawn segments with context, offsets and links |
| `annotate-blind.tsv` | the annotation view. No output of any parser appears in it |
| `claims-template.tsv` | one row per claim, many rows per segment |
| `regression-cases.json` | failures of the invalidated run, as tests |
| `archive/` | the invalidated report and its defects |

The description cache the segments came from is about 98MB and is not
committed. The manifest records its digest, the digest of the scripts that read
it, and the seed, so a redraw can be shown to be the same experiment rather
than merely a similar one.

    node research/nexus-prose/scripts/segment-tests.mjs
    node research/nexus-prose/scripts/build-sample.mjs <cacheDir> 20260822

## Development and test

Split by duplicate cluster, not by description, and certainly not by segment.

Splitting by description is not enough on its own, because authors paste the
same instruction across their whole collection. Descriptions sharing a
normalised segment are joined and the whole group goes to one side. That is not
a rare correction: 2,139 joins bind 1,541 descriptions into shared clusters.
Without it, a parser tuned on one copy of a pasted caveat would score perfectly
on another copy of the same words and have learned nothing.

Only text that could teach a parser something is allowed to join. Joining on any
repeat at all is transitive, and one translator install routine, a donation
footer and a maintenance notice welded 400 descriptions into a single component
with 310 of the 343 binding segments carrying no ordering language. Restricting
the join to signal-bearing text takes the largest component from 400 to 52, and
the descriptions forced out of the held-out half from 1,200 to 213.

Exposure is graded in `known-development-sources.json`. A page whose prose was
read, or whose extracted claim was reviewed, is forced into development: its
sentences shaped the schema and the refusal patterns. A page merely named as a
target by somebody else sentence is not, because its own description has never
been opened and excluding it would shrink the held-out set for no protection.
Of 151 encountered descriptions, 110 force development and 41 do not.

The split is a hash of the cluster rather than the magnitude of a mod id, so it
does not track publication era. Verified uniform near 0.30 across id bands, and
`reproducibility-test.mjs` redraws the whole sample with file discovery
scrambled and requires an identical result: a seed proves nothing if the draw
depends on the order a filesystem happens to enumerate a directory.

The test portion stays unlabelled by anyone designing a parser until that parser
is frozen, or the numbers it eventually reports describe the set it was built
against.

## Signals and strata

A segment usually matches several signals. The primary stratum decides its
inclusion probability and is exactly one, so the draw stays a probability
sample; every signal it matched is recorded beside it. Without that, "conditional
has X percent precision" would quietly mean "conditional segments that did not
also match something earlier in the list", which is a different claim. 127 of
the drawn segments matched more than one.

Background is drawn at 1,200 rather than 150 on purpose. It is 91 percent of the
corpus, and at 150 a result of zero positives leaves a 95 percent upper bound
near two percent, which across 181,000 segments is thousands of possible missed
claims: not a bound worth having.

## Paths in the sample

Filesystem paths are replaced rather than deleted: `<WINDOWS_USER_PATH>`,
`<WINDOWS_PATH>`, `<HOME>`. Removing the span would change the grammar around
it, and the grammar is the thing being evaluated. The sample is otherwise
verbatim.

## Why the sample is versioned

Because a parser reporting "precision 94 percent" is meaningless unless the
labels that produced it can be inspected. A gold set that exists only as an
untracked local file is not reproducible, and this project has already been
misled once by numbers nobody could re-derive.

## Order of work

1. Label `annotate-blind.tsv`. It carries no parser output, so it cannot anchor.
2. Lock the labels, then join them against `old-extraction.jsonl` to score the
   previous run. Scoring it first would let its errors bias the labels.
3. Only then design a parser, against the labels rather than against whatever
   examples happened to be visible while writing patterns.

## The strata

Seven, disjoint, first match wins. The last is the one that matters: without a
random sample of segments matching none of the signals, you can measure how good
the signals are and still not know what lies outside them.

Populations are in `sampling-manifest.json`. They are counts of segments matched
by a heuristic, and are not counts of evidence. Keeping that distinction is the
single discipline this directory exists to enforce.
