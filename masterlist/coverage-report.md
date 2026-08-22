# Masterlist coverage report

Generated 2026-08-22T07:25:25.197Z by `scripts/mine-corpus.mjs`.

## Corpus

| | |
|---|---|
| Load orders analysed | 113 |
| labelled working | 96 |
| labelled broken | 15 |
| load-after edges promoted from catalogues | 579 |
| unlabelled | 2 |
| Separator headers parsed | 2563 |
| **Unique mods indexed** | **9706** |
| Seen in more than one order | 6666 |
| With declared dependencies | 602 |
| With Script Extender flags | 176 |
| With author metadata | 1126 |

## Game version

Calibrated against **Patch 8** (build `4.8.700.7143220`).

BG3 patches change what is compatible, so the build a load order was made on
matters. Full BG3MM exports record it on the base-game packages, which is where
this comes from. Only 3 of 113 orders carry it, because the short
export format omits dependency metadata entirely.

Builds observed across the corpus, newest first:

- `4.8.700.7143220` (Patch 8)

814 mods record the newest build they were seen on, which is what would let
the tool flag a mod as last verified on an older patch.

## How each mod got its group

| Source | Count | Trust |
|---|---|---|
| Curated override | 31 | highest, hand-verified infrastructure |
| Human-authored section header | 5971 | high, a modder put it there |
| Name pattern fallback | 1689 | medium, needs review |
| Nexus or mod.io listing category | 1059 | medium, the author's own words about what the mod is |
| Author's other catalogued mods | 18 | medium, a specialist author's habit; needs three catalogued mods with eighty percent in one group |
| Neighbour inference, 0.85 agreement or better | 91 | high, measured 97 percent accurate at this band |
| Neighbour inference, 0.70 to 0.85 | 74 | medium, roughly 75 percent accurate, carries a confidence score |
| Uncategorised | 773 | none, needs community input |

Inferred placements come from where a mod sits in submitted orders: labelled
neighbours within six places vote for their group, weighted by closeness.
Inferred labels never vote for other mods, so an error cannot spread. Each
inferred entry stores its agreement score as `evidence.confidence`.

## Group distribution

- `Top of Load Order`: 10
- `Resources`: 275
- `Utilities`: 79
- `Visuals`: 127
- `Animations`: 145
- `User Interface`: 160
- `Clothing`: 126
- `Equipment`: 1287
- `Miscellaneous`: 168
- `Spells`: 625
- `Dyes`: 66
- `Armor`: 445
- `Weapons`: 550
- `Gameplay`: 505
- `Races`: 255
- `Classes`: 1095
- `Character Customization`: 381
- `Bug Fixes`: 481
- `Accessories`: 124
- `Quests`: 23
- `Environment`: 52
- `Audio`: 24
- `Heads`: 535
- `Hair`: 308
- `Companions`: 397
- `NPC`: 201
- `Bodies`: 33
- `Dice`: 451
- `Bottom of Load Order`: 5
- `unsorted`: 773

## What the broken orders do differently

Three candidate signals, each measured against the working orders as a control,
because a signal firing equally on both explains nothing. The point of putting
it here is that a negative result is worth as much as a positive one and is far
easier to lose.

| Signal | Broken orders | Working orders | Separates? |
|---|---|---|---|
| Category pairs against the working consensus | 23.4% | 23.7% | no, and it points the other way |
| Mods in no working order anywhere | 9% | 0% | yes |
| Declared dependencies not installed | 0.1 | 0.0 | yes |

Measured over 15 broken and 96 working orders, against 135 category conventions, each held by at least 75 percent of at least 500 observed pairs.

Read the broken column with that first count in mind. A handful of orders
cannot say what breaks a game, and the ordering signal still runs backwards,
which is the strongest argument there is against guessing at a cause from
sequence alone. It runs backwards by less than it used to appear to: this
measurement could not read modsettings.lsx, identified mods by the UUID field
alone and counted dividers as mods, which made the gap look three times wider
than it is.

The third row separates on a difference of a tenth of a requirement per order,
which is not a finding. It reads at all only because the requirements stated in
a TSV are no longer discarded, and it is recorded rather than believed.

Only the middle row feeds anything today. A mod seen in a broken order and in
no working one is reported to the user as a place to start looking, worded as
exactly that rather than as a fault.

## Requirements the corpus overrules

A mod here is loaded after the mods that require it, so requirements naming it
stop being ordering constraints. Right for a patcher, which reads the mods it
patches; wrong for a library, which has to be parsed first. Decided from the
working orders alone, with the evidence pooled across everything that requires
the same mod.

Listed because the decision is otherwise invisible. Dropping a real ordering
constraint would be silent, and this file is regenerated and committed on every
mine, so a change to this list shows up in a diff where somebody sees it.

| Mod | Loaded after its dependants | Mods declaring it |
|---|---|---|
| `CompatibilityFramework` | 13 of 16 placements | 15 |

## Requirements the working orders do without

A mod here is declared as a requirement by mods that demonstrably run without
it. Its absence is reported as a warning rather than as a broken load order.
A real library scores nothing in the last column: measured across this corpus,
VolitionCabinet, CommunityLibrary, BG3MCM, BG3AF, BG3SX and Compatibility
Framework are present in every working order that needs them.

| Requirement | Working orders needing it | Without it | Declaring mods |
|---|---|---|---|
| `HybridUI` | 17 | 15 | 1 |
| `Ornamental Body Jewellery` | 8 | 7 | 2 |
| `ZipsHeads` | 8 | 7 | 1 |
| `UnlockLevelCurve - Level 13-20 | Patch 8` | 9 | 6 | 8 |
| `TutorialChestSummoning` | 35 | 22 | 26 |
| `BDS Moonlit Circlet` | 8 | 5 | 1 |
| `Snapshots` | 5 | 3 | 2 |

## Requirements naming something unknown

Every "install X first" rests on knowing what X is. A name that matches no mod,
no folder and no curated alias makes a warning nobody can act on, and the string
would otherwise be formatted into a message and dropped without being counted.

_none: every stated requirement names a mod this masterlist knows_

## Known limitations

- **Ordering rules are not derived here.** Pairwise co-occurrence over 96
  working orders overfits badly: most pairs reflect one person's arbitrary sequencing
  rather than a real constraint. Only declared `dependencies` are emitted as hard
  edges. Revisit once submissions reach ~100 orders.
- **773 mods are `unsorted`.** These need community categorisation.
- **Thin exports dominate.** Most submissions use the `{UUID, Name}` format, which
  carries no dependency or version data. Only the full BG3MM export does.

## Files skipped

- `Current_22.11.2025_10-32-17.json`: duplicate of another file
- `provenance.json`: not a load order
