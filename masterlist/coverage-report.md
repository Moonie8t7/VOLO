# Masterlist coverage report

Generated 2026-08-09T16:08:37.188Z by `scripts/mine-corpus.mjs`.

## Corpus

| | |
|---|---|
| Load orders analysed | 37 |
| labelled working | 31 |
| labelled broken | 3 |
| load-after edges promoted from catalogues | 334 |
| unlabelled | 3 |
| Separator headers parsed | 744 |
| **Unique mods indexed** | **6296** |
| Seen in more than one order | 3020 |
| With declared dependencies | 247 |
| With Script Extender flags | 43 |
| With author metadata | 483 |

## Game version

Calibrated against **Patch 8** (build `4.8.700.7143220`).

BG3 patches change what is compatible, so the build a load order was made on
matters. Full BG3MM exports record it on the base-game packages, which is where
this comes from. Only 1 of 37 orders carry it, because the short
export format omits dependency metadata entirely.

Builds observed across the corpus, newest first:

- `4.8.700.7143220` (Patch 8)

132 mods record the newest build they were seen on, which is what would let
the tool flag a mod as last verified on an older patch.

## How each mod got its group

| Source | Count | Trust |
|---|---|---|
| Curated override | 22 | highest, hand-verified infrastructure |
| Human-authored section header | 3240 | high, a modder put it there |
| Name pattern fallback | 1436 | medium, needs review |
| Nexus or mod.io listing category | 668 | medium, the author's own words about what the mod is |
| Author's other catalogued mods | 26 | medium, a specialist author's habit; needs three catalogued mods with eighty percent in one group |
| Neighbour inference, 0.85 agreement or better | 137 | high, measured 97 percent accurate at this band |
| Neighbour inference, 0.70 to 0.85 | 101 | medium, roughly 75 percent accurate, carries a confidence score |
| Uncategorised | 666 | none, needs community input |

Inferred placements come from where a mod sits in submitted orders: labelled
neighbours within six places vote for their group, weighted by closeness.
Inferred labels never vote for other mods, so an error cannot spread. Each
inferred entry stores its agreement score as `evidence.confidence`.

## Group distribution

- `Top of Load Order`: 9
- `User Interface`: 133
- `Visuals`: 74
- `Weapons`: 210
- `Dyes`: 69
- `Clothing`: 168
- `Character Customization`: 427
- `Resources`: 128
- `Equipment`: 358
- `Armor`: 729
- `Utilities`: 59
- `Races`: 160
- `Animations`: 91
- `Spells`: 378
- `Classes`: 608
- `Bodies`: 16
- `Miscellaneous`: 89
- `Bug Fixes`: 196
- `Gameplay`: 286
- `Accessories`: 81
- `Quests`: 28
- `Environment`: 33
- `Audio`: 9
- `Hair`: 212
- `Heads`: 270
- `Dice`: 329
- `Companions`: 309
- `NPC`: 167
- `Bottom of Load Order`: 4
- `unsorted`: 666

## Known limitations

- **Ordering rules are not derived here.** Pairwise co-occurrence over 31
  working orders overfits badly: most pairs reflect one person's arbitrary sequencing
  rather than a real constraint. Only declared `dependencies` are emitted as hard
  edges. Revisit once submissions reach ~100 orders.
- **666 mods are `unsorted`.** These need community categorisation.
- **Thin exports dominate.** Most submissions use the `{UUID, Name}` format, which
  carries no dependency or version data. Only the full BG3MM export does.

## Files skipped

- `Current_22.11.2025_10-32-17.json`: duplicate of another file
- `VOLO Cleanup.json`: not a load order
- `provenance.json`: not a load order
