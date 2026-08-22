# Claim schema

One segment can carry several claims, so claims live in their own file and
reference a segment by id. The previous run assumed one sentence produced one
edge, and that assumption is one of the things being evaluated, so it is not
built into the schema.

A segment such as

> load ISF at the very bottom of your load order and load this mod right above it

carries at least two: ISF to the bottom, and this mod before ISF.

## Segment fields

Set once per segment, in `annotate-blind.tsv`.

| field | values |
| --- | --- |
| `claim_present` | `yes`, `no`. No means the segment is not load order advice at all. |
| `claim_count` | how many distinct claims it carries. 0 when `claim_present` is no. |
| `notes` | free text. |

## Claim fields

One row per claim, in `claims-template.tsv`, each referencing `segment_id`.

### relation_type

What kind of statement it is. Three, because scope and conditionality are
separate dimensions rather than kinds.

| value | meaning |
| --- | --- |
| `PAIRWISE` | one thing ordered against another named thing |
| `PLACEMENT` | one thing placed in a region of the order, naming nothing else |
| `CATEGORICAL` | a class of mods against another class |

### relation and placement

`relation` applies to `PAIRWISE` and `CATEGORICAL`: `before`, `after`, `none`.

`placement` applies to `PLACEMENT`, graded on purpose:

    TOP  NEAR_TOP  EARLY  LATE  NEAR_BOTTOM  BOTTOM  FIRST  LAST  none

"Near the end" is `NEAR_BOTTOM`, not `LAST`. Flattening the two loses the
author's hedge, and the hedge is information.

### actor and target

| field | meaning |
| --- | --- |
| `actor_text` | the words naming the thing being placed |
| `actor_identity` | nexus id, uuid, or `unresolved` |
| `target_text` | the words naming what it is placed relative to, if any |
| `target_identity` | nexus id, uuid, or `unresolved` |

The actor is not always the page being described. In "Feats Extra edits some
vanilla feats, so load it before this mod", the actor is Feats Extra and the
page is the target. Getting that backwards is the single largest error in the
invalidated run.

### scope

Orthogonal to `relation_type`. A conditional pairwise claim is still pairwise.

    WHOLE_MOD  PLUGIN  MAIN_FILE  OPTIONAL_FILE  PATCH  CONFIG  CATEGORY  UNKNOWN

"Put the optional file near the bottom" is `PLACEMENT`, `NEAR_BOTTOM`,
`OPTIONAL_FILE`. Recording it as a statement about the whole mod is how the
invalidated run concluded that VOLO disagreed with an author it did not.

### condition_type and condition

    NONE  MOD_PRESENT  VERSION  SYMPTOM  INSTALLATION_METHOD  OTHER

`condition` is free text: which mod, which version, which symptom. A remedy such
as "if the shadows look wrong, move this higher" is a real claim with
`condition_type` `SYMPTOM`, and is worth keeping even if it never becomes a
default sort rule.

### strength

    must  should  recommend  troubleshooting  observation

### resolution_confidence

    link  exact_title  alias  stem  unresolved

A stem match never establishes an entity on its own. A real mod is called
"Load order - Cheese Collection", whose stem is the words "load order", and it
was matched as the target of any segment containing them. Prefer `unresolved`
over a guess: unresolved evidence can be resolved later, an invented target
cannot be found again.

## Confidence, and when a second reader is required

Every claim carries a `label_confidence`:

| value | meaning |
| --- | --- |
| `CLEAR` | one careful reader would read it the same way |
| `AMBIGUOUS` | the segment supports more than one reading |
| `UNRESOLVED` | it is advice, but what it refers to cannot be settled from the text |

Anything not `CLEAR`, and anything in these categories whatever its confidence,
gets an independent second reading:

- a pronoun standing for something named earlier
- more than one claim in the segment
- a conditional or a remedy
- scope that is a file, patch or component rather than the mod
- an identity resolved by anything weaker than a link or an exact title
- a categorical claim

The second reader sees neither the first reader's labels nor any parser output.

Disagreement is recorded, not resolved away. Two careful readers differing is
the strongest available evidence that an extractor should decline to parse that
segment, and abstention is a perfectly good outcome for a sorter that reorders
somebody's game.

## What counts as a correct extraction

Fixed before any parser exists, so it cannot be chosen afterwards to flatter
one.

A `PAIRWISE` claim is correct only when actor identity, target identity,
relation, scope and condition are all correct. A `PLACEMENT` claim needs actor,
placement, scope and condition. A `CATEGORICAL` claim needs both categories and
the relation.

Placement is scored exactly. Gold `NEAR_BOTTOM` against predicted `LAST` is
wrong, because the author hedged and the parser did not. A second, clearly
separate figure may report region compatibility, where `LATE`, `NEAR_BOTTOM`
and `BOTTOM` count as one region; it is never the headline, and never called
precision without saying which.

Scoring is per claim, not per segment. A segment whose gold is

    A LAST
    B BEFORE A

and whose parser output is only `A LAST` has found one of two claims. Counting
that segment as correct would hide half the recall.

## Estimating anything about the corpus

The strata are sampled at wildly different rates: about 41 percent of
`absolute_region`, about 1.4 percent of `explicit_relative`, about 0.66 percent
of `background`. So a raw count over the sample describes the sample and not
Nexus.

Each drawn segment carries `selectionProbability`. A corpus estimate weights
each by its reciprocal, and every claim inside a segment inherits that segment's
weight. Averaging the seven per-stratum percentages is not a corpus figure and
must not be reported as one.

Report both, labelled: per-stratum results, which say which signals are worth
having, and the weighted estimate, which is the only thing that answers how much
evidence Nexus prose actually holds.
