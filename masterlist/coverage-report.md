# Masterlist coverage report

Generated 2026-10-01T02:59:24.869Z by `scripts/mine-corpus.mjs`.

## Corpus

| | |
|---|---|
| Load orders analysed | 191 |
| labelled working | 155 |
| labelled broken | 34 |
| load-after edges promoted from catalogues | 812 |
| unlabelled | 2 |
| Separator headers parsed | 4697 |
| **Unique mods indexed** | **11387** |
| Seen in more than one order | 8071 |
| With declared dependencies | 778 |
| With Script Extender flags | 176 |
| With author metadata | 1161 |

## Game version

Calibrated against **Patch 8** (build `4.8.700.7143220`).

BG3 patches change what is compatible, so the build a load order was made on
matters. Full BG3MM exports record it on the base-game packages, which is where
this comes from. Only 3 of 191 orders carry it, because the short
export format omits dependency metadata entirely.

Builds observed across the corpus, newest first:

- `4.8.700.7143220` (Patch 8)

814 mods record the newest build they were seen on, which would let the tool flag a mod as last verified on an older patch.

## How each mod got its group

| Source | Count | Trust |
|---|---|---|
| Curated override | 45 | highest, hand-verified infrastructure |
| Human-authored section header | 7030 | high, a modder put it there |
| Name pattern fallback | 2015 | medium, needs review |
| Nexus or mod.io listing category | 1198 | medium, the author's own words about what the mod is |
| Author's other catalogued mods | 17 | medium, a specialist author's habit; needs three catalogued mods with eighty percent in one group |
| Neighbour inference, 0.85 agreement or better | 103 | high, measured 97 percent accurate at this band |
| Neighbour inference, 0.70 to 0.85 | 89 | medium, roughly 75 percent accurate, carries a confidence score |
| Uncategorised | 890 | none, needs community input |

Inferred placements come from where a mod sits in submitted orders: labelled
neighbours within six places vote for their group, weighted by closeness.
Inferred labels never vote for other mods, so an error cannot spread. Each
inferred entry stores its agreement score as `evidence.confidence`.

## Group distribution

- `Top of Load Order`: 10
- `Resources`: 286
- `Utilities`: 120
- `Visuals`: 134
- `Animations`: 161
- `User Interface`: 201
- `Clothing`: 128
- `Equipment`: 1674
- `Miscellaneous`: 220
- `Spells`: 834
- `Dyes`: 82
- `Armor`: 420
- `Weapons`: 536
- `Gameplay`: 582
- `Races`: 302
- `Classes`: 1351
- `Character Customization`: 419
- `Bug Fixes`: 545
- `Accessories`: 117
- `Quests`: 44
- `Environment`: 69
- `Audio`: 30
- `Heads`: 652
- `Hair`: 331
- `Companions`: 459
- `NPC`: 275
- `Bodies`: 35
- `Dice`: 473
- `Bottom of Load Order`: 7
- `unsorted`: 890

## What the broken orders do differently

Three candidate signals, each measured against the working orders as a control,
because a signal firing equally on both explains nothing. The point of putting
it here is that a negative result is worth as much as a positive one and is far
easier to lose.

| Signal | Broken orders | Working orders | Separates? |
|---|---|---|---|
| Category pairs against the working consensus | 19.0% | 20.7% | no, and it points the other way |
| Mods in no working order anywhere | 7% | 0% | yes |
| Declared dependencies not installed | 0.0 | 0.0 | no |

Measured over 34 broken and 155 working orders, against 141 category conventions, each held by at least 75 percent of at least 500 observed pairs.

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
| `CompatibilityFramework` | 12 of 14 placements | 14 |

## Requirements the working orders do without

A mod here is declared as a requirement by mods that demonstrably run without
it. Its absence is reported as a warning rather than as a broken load order.
A real library scores nothing in the last column: measured across this corpus,
VolitionCabinet, CommunityLibrary, BG3MCM, BG3AF, BG3SX and Compatibility
Framework are present in every working order that needs them.

| Requirement | Working orders needing it | Without it | Declaring mods |
|---|---|---|---|
| `Character Creation Overhaul` | 6 | 6 | 2 |
| `ContainersExtended` | 11 | 11 | 5 |
| `ZipsHeads` | 11 | 9 | 1 |
| `Ornamental Body Jewellery` | 10 | 8 | 2 |
| `HybridUI` | 21 | 16 | 1 |
| `Calimshan Pirate Outfit` | 4 | 3 | 1 |
| `Camp Robes` | 4 | 3 | 1 |
| `Celestial Threads` | 4 | 3 | 1 |
| `Highmost Spell Foci` | 4 | 3 | 1 |
| `Snapshots` | 8 | 6 | 2 |
| `HomeBrew - Comprehensive Reworks` | 5 | 3 | 1 |

## Requirements naming something unknown

Every "install X first" rests on knowing what X is. A name that matches no mod,
no folder and no curated alias makes a warning nobody can act on, and the string
would otherwise be formatted into a message and dropped without being counted.

_none: every stated requirement names a mod this masterlist knows_

## Known limitations

- **Ordering rules are not derived here.** Pairwise co-occurrence over 155
  working orders overfits badly: most pairs reflect one person's arbitrary sequencing
  rather than a real constraint. Only declared `dependencies` are emitted as hard
  edges. Revisit once submissions reach ~100 orders.
- **890 mods are `unsorted`.** These need community categorisation.
- **Thin exports dominate.** Most submissions use the `{UUID, Name}` format, which
  carries no dependency or version data. Only the full BG3MM export does.

## Files skipped

- `Current_22.11.2025_10-32-17.json`: duplicate of another file
- `not_working_issue-134_2026-08-28.json`: duplicate of another file
- `provenance.json`: not a load order
- `working_issue-213_2026-09-17.csv`: not a load order
