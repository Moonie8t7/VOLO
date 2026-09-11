# Masterlist coverage report

Generated 2026-09-11T20:28:53.820Z by `scripts/mine-corpus.mjs`.

## Corpus

| | |
|---|---|
| Load orders analysed | 155 |
| labelled working | 125 |
| labelled broken | 28 |
| load-after edges promoted from catalogues | 943 |
| unlabelled | 2 |
| Separator headers parsed | 3975 |
| **Unique mods indexed** | **11616** |
| Seen in more than one order | 7551 |
| With declared dependencies | 843 |
| With Script Extender flags | 176 |
| With author metadata | 1128 |

## Game version

Calibrated against **Patch 8** (build `4.8.700.7143220`).

BG3 patches change what is compatible, so the build a load order was made on
matters. Full BG3MM exports record it on the base-game packages, which is where
this comes from. Only 3 of 155 orders carry it, because the short
export format omits dependency metadata entirely.

Builds observed across the corpus, newest first:

- `4.8.700.7143220` (Patch 8)

814 mods record the newest build they were seen on, which would let the tool flag a mod as last verified on an older patch.

## How each mod got its group

| Source | Count | Trust |
|---|---|---|
| Curated override | 48 | highest, hand-verified infrastructure |
| Human-authored section header | 6655 | high, a modder put it there |
| Name pattern fallback | 2394 | medium, needs review |
| Nexus or mod.io listing category | 1259 | medium, the author's own words about what the mod is |
| Author's other catalogued mods | 17 | medium, a specialist author's habit; needs three catalogued mods with eighty percent in one group |
| Neighbour inference, 0.85 agreement or better | 135 | high, measured 97 percent accurate at this band |
| Neighbour inference, 0.70 to 0.85 | 118 | medium, roughly 75 percent accurate, carries a confidence score |
| Uncategorised | 990 | none, needs community input |

Inferred placements come from where a mod sits in submitted orders: labelled
neighbours within six places vote for their group, weighted by closeness.
Inferred labels never vote for other mods, so an error cannot spread. Each
inferred entry stores its agreement score as `evidence.confidence`.

## Group distribution

- `Top of Load Order`: 10
- `Resources`: 290
- `Utilities`: 111
- `Visuals`: 175
- `Animations`: 157
- `User Interface`: 205
- `Clothing`: 175
- `Equipment`: 1502
- `Miscellaneous`: 210
- `Spells`: 799
- `Dyes`: 85
- `Armor`: 468
- `Weapons`: 576
- `Gameplay`: 601
- `Races`: 305
- `Classes`: 1397
- `Character Customization`: 427
- `Bug Fixes`: 550
- `Accessories`: 126
- `Quests`: 41
- `Environment`: 63
- `Audio`: 28
- `Heads`: 672
- `Hair`: 384
- `Companions`: 488
- `NPC`: 263
- `Bodies`: 40
- `Dice`: 470
- `Bottom of Load Order`: 8
- `unsorted`: 990

## What the broken orders do differently

Three candidate signals, each measured against the working orders as a control,
because a signal firing equally on both explains nothing. The point of putting
it here is that a negative result is worth as much as a positive one and is far
easier to lose.

| Signal | Broken orders | Working orders | Separates? |
|---|---|---|---|
| Category pairs against the working consensus | 21.5% | 21.4% | yes |
| Mods in no working order anywhere | 10% | 0% | yes |
| Declared dependencies not installed | 0.0 | 0.0 | yes |

Measured over 28 broken and 125 working orders, against 134 category conventions, each held by at least 75 percent of at least 500 observed pairs.

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
no working one is reported to the user as a place to start looking, worded as a place to look and not as a fault.

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
| `CompatibilityFramework` | 11 of 13 placements | 13 |

## Requirements the working orders do without

A mod here is declared as a requirement by mods that demonstrably run without
it. Its absence is reported as a warning rather than as a broken load order.
A real library scores nothing in the last column: measured across this corpus,
VolitionCabinet, CommunityLibrary, BG3MCM, BG3AF, BG3SX and Compatibility
Framework are present in every working order that needs them.

| Requirement | Working orders needing it | Without it | Declaring mods |
|---|---|---|---|
| `+Advanced Tabletop Spells` | 16 | 16 | 4 |
| `+Asymmetrical Shadowheart Concept Outfit` | 4 | 4 | 1 |
| `+Baldur's Gate 3 Community Library` | 91 | 91 | 32 |
| `+BG3AF - Animation Framework` | 15 | 15 | 4 |
| `+Camp Robes for Gale` | 4 | 4 | 1 |
| `+Character Preset Framework (CPF)` | 9 | 9 | 1 |
| `+Fade's Equipment Distribution (FED)` | 28 | 28 | 13 |
| `+Goon's Library - Passives Functions Spells and More` | 29 | 29 | 14 |
| `+Half-Tiefs (Tiefling Horns and Tail for All)` | 12 | 12 | 1 |
| `+Hearts' Heads` | 8 | 8 | 1 |
| `+Kaz Lab Assorted Shader Pack` | 8 | 8 | 2 |
| `+Mod Configuration Menu (MCM)` | 100 | 100 | 67 |
| `+Native Mod Loader` | 20 | 20 | 2 |
| `+Spells Extra - DND 5E Library` | 8 | 8 | 7 |
| `+Trips' Accessory Collection` | 5 | 5 | 1 |
| `+Trips' Shader Pack` | 24 | 24 | 11 |
| `+Vlad's Grimoire - Spell VFX Library` | 45 | 45 | 6 |
| `+Wings Character Customization - WCC` | 10 | 10 | 4 |
| `Character Creation Overhaul` | 6 | 6 | 2 |
| `HybridUI` | 17 | 15 | 1 |
| `Ornamental Body Jewellery` | 8 | 7 | 2 |
| `ZipsHeads` | 8 | 7 | 1 |
| `Calimshan Pirate Outfit` | 4 | 3 | 1 |
| `Camp Robes` | 4 | 3 | 1 |
| `Celestial Threads` | 4 | 3 | 1 |
| `Fade's Equipment Distribution` | 6 | 4 | 3 |
| `TutorialChestSummoning` | 46 | 29 | 29 |
| `Snapshots` | 5 | 3 | 2 |
| `UnlockLevelCurve - Level 13-20 | Patch 8` | 10 | 6 | 9 |

## Requirements naming something unknown

Every "install X first" rests on knowing what X is. A name that matches no mod,
no folder and no curated alias makes a warning nobody can act on, and the string
would otherwise be formatted into a message and dropped without being counted.

_none: every stated requirement names a mod this masterlist knows_

## Known limitations

- **Ordering rules are not derived here.** Pairwise co-occurrence over 125
  working orders overfits badly: most pairs reflect one person's arbitrary sequencing
  rather than a real constraint. Only declared `dependencies` are emitted as hard
  edges. Revisit once submissions reach ~100 orders.
- **990 mods are `unsorted`.** These need community categorisation.
- **Thin exports dominate.** Most submissions use the `{UUID, Name}` format, which
  carries no dependency or version data. Only the full BG3MM export does.

## Files skipped

- `Current_22.11.2025_10-32-17.json`: duplicate of another file
- `not_working_issue-134_2026-08-28.json`: duplicate of another file
- `provenance.json`: not a load order
