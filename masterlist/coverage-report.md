# Masterlist coverage report

Generated 2026-08-12T03:01:38.259Z by `scripts/mine-corpus.mjs`.

## Corpus

| | |
|---|---|
| Load orders analysed | 64 |
| labelled working | 54 |
| labelled broken | 7 |
| load-after edges promoted from catalogues | 472 |
| unlabelled | 3 |
| Separator headers parsed | 1331 |
| **Unique mods indexed** | **7914** |
| Seen in more than one order | 4551 |
| With declared dependencies | 397 |
| With Script Extender flags | 163 |
| With author metadata | 879 |

## Game version

Calibrated against **Patch 8** (build `4.8.700.7143220`).

BG3 patches change what is compatible, so the build a load order was made on
matters. Full BG3MM exports record it on the base-game packages, which is where
this comes from. Only 2 of 64 orders carry it, because the short
export format omits dependency metadata entirely.

Builds observed across the corpus, newest first:

- `4.8.700.7143220` (Patch 8)

577 mods record the newest build they were seen on, which is what would let
the tool flag a mod as last verified on an older patch.

## How each mod got its group

| Source | Count | Trust |
|---|---|---|
| Curated override | 27 | highest, hand-verified infrastructure |
| Human-authored section header | 4630 | high, a modder put it there |
| Name pattern fallback | 1509 | medium, needs review |
| Nexus or mod.io listing category | 755 | medium, the author's own words about what the mod is |
| Author's other catalogued mods | 16 | medium, a specialist author's habit; needs three catalogued mods with eighty percent in one group |
| Neighbour inference, 0.85 agreement or better | 110 | high, measured 97 percent accurate at this band |
| Neighbour inference, 0.70 to 0.85 | 84 | medium, roughly 75 percent accurate, carries a confidence score |
| Uncategorised | 783 | none, needs community input |

Inferred placements come from where a mod sits in submitted orders: labelled
neighbours within six places vote for their group, weighted by closeness.
Inferred labels never vote for other mods, so an error cannot spread. Each
inferred entry stores its agreement score as `evidence.confidence`.

## Group distribution

- `Top of Load Order`: 9
- `User Interface`: 149
- `Visuals`: 89
- `Weapons`: 218
- `Dyes`: 67
- `Clothing`: 167
- `Character Customization`: 430
- `Resources`: 195
- `Equipment`: 701
- `Armor`: 663
- `Utilities`: 66
- `Races`: 210
- `Animations`: 91
- `Spells`: 470
- `Classes`: 912
- `Bodies`: 193
- `Miscellaneous`: 122
- `Bug Fixes`: 373
- `Gameplay`: 379
- `Accessories`: 84
- `Quests`: 21
- `Environment`: 37
- `Audio`: 13
- `Hair`: 266
- `Heads`: 433
- `Dice`: 256
- `Companions`: 334
- `NPC`: 179
- `Bottom of Load Order`: 4
- `unsorted`: 783

## What the broken orders do differently

Three candidate signals, each measured against the working orders as a control,
because a signal firing equally on both explains nothing. The point of putting
it here is that a negative result is worth as much as a positive one and is far
easier to lose.

| Signal | Broken orders | Working orders | Separates? |
|---|---|---|---|
| Category pairs against the working consensus | 12.7% | 22.7% | no, and it points the other way |
| Mods in no working order anywhere | 8% | 1% | yes |
| Declared dependencies not installed | 0.0 | 0.0 | no |

Measured over 7 broken and 51 working orders, against 167 category conventions, each held by at least 75 percent of at least 500 observed pairs.

Read the broken column with that first count in mind. A handful of orders
cannot say what breaks a game, and the ordering signal currently runs
backwards, which is the strongest argument there is against guessing at a cause
from sequence alone.

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
| `CompatibilityFramework` | 11 of 13 placements | 11 |

## Requirements the working orders do without

A mod here is declared as a requirement by mods that demonstrably run without
it. Its absence is reported as a warning rather than as a broken load order.
A real library scores nothing in the last column: measured across this corpus,
VolitionCabinet, CommunityLibrary, BG3MCM, BG3AF, BG3SX and Compatibility
Framework are present in every working order that needs them.

| Requirement | Working orders needing it | Without it | Declaring mods |
|---|---|---|---|
| `Humanoid Tag Scratch Fix` | 10 | 9 | 1 |
| `HybridUI` | 14 | 12 | 1 |
| `UnlockLevelCurve - Level 13-20 | Patch 8` | 7 | 6 | 5 |
| `Ornamental Body Jewellery` | 6 | 5 | 1 |
| `ZipsHeads` | 6 | 5 | 1 |
| `TutorialChestSummoning` | 19 | 14 | 12 |
| `AOE Status Fixer` | 8 | 5 | 1 |
| `Bleeding Overhaul` | 10 | 6 | 1 |

## Requirements naming something unknown

Every "install X first" rests on knowing what X is. A name that matches no mod,
no folder and no curated alias makes a warning nobody can act on, and the string
would otherwise be formatted into a message and dropped without being counted.

_none: every stated requirement names a mod this masterlist knows_

## Known limitations

- **Ordering rules are not derived here.** Pairwise co-occurrence over 54
  working orders overfits badly: most pairs reflect one person's arbitrary sequencing
  rather than a real constraint. Only declared `dependencies` are emitted as hard
  edges. Revisit once submissions reach ~100 orders.
- **783 mods are `unsorted`.** These need community categorisation.
- **Thin exports dominate.** Most submissions use the `{UUID, Name}` format, which
  carries no dependency or version data. Only the full BG3MM export does.

## Files skipped

- `Current_22.11.2025_10-32-17.json`: duplicate of another file
- `VOLO Cleanup.json`: not a load order
- `provenance.json`: not a load order
