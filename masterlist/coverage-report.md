# Masterlist coverage report

Generated 2026-08-09T09:04:00.604Z by `scripts/mine-corpus.mjs`.

## Corpus

| | |
|---|---|
| Load orders analysed | 22 |
| labelled working | 17 |
| labelled broken | 2 |
| load-after edges promoted from catalogues | 298 |
| unlabelled | 3 |
| Separator headers parsed | 249 |
| **Unique mods indexed** | **4295** |
| Seen in more than one order | 1619 |
| With declared dependencies | 218 |
| With Script Extender flags | 43 |
| With author metadata | 483 |

## Game version

Calibrated against **Patch 8** (build `4.8.700.7143220`).

BG3 patches change what is compatible, so the build a load order was made on
matters. Full BG3MM exports record it on the base-game packages, which is where
this comes from. Only 1 of 22 orders carry it, because the short
export format omits dependency metadata entirely.

Builds observed across the corpus, newest first:

- `4.8.700.7143220` (Patch 8)

132 mods record the newest build they were seen on, which is what would let
the tool flag a mod as last verified on an older patch.

## How each mod got its group

| Source | Count | Trust |
|---|---|---|
| Curated override | 20 | highest, hand-verified infrastructure |
| Human-authored section header | 1640 | high, a modder put it there |
| Name pattern fallback | 1273 | medium, needs review |
| Nexus or mod.io listing category | 490 | medium, the author's own words about what the mod is |
| Author's other catalogued mods | 29 | medium, a specialist author's habit; needs three catalogued mods with eighty percent in one group |
| Neighbour inference, 0.85 agreement or better | 69 | high, measured 97 percent accurate at this band |
| Neighbour inference, 0.70 to 0.85 | 89 | medium, roughly 75 percent accurate, carries a confidence score |
| Uncategorised | 685 | none, needs community input |

Inferred placements come from where a mod sits in submitted orders: labelled
neighbours within six places vote for their group, weighted by closeness.
Inferred labels never vote for other mods, so an error cannot spread. Each
inferred entry stores its agreement score as `evidence.confidence`.

## Group distribution

- `Top of Load Order`: 9
- `User Interface`: 101
- `Visuals`: 70
- `Weapons`: 133
- `Dyes`: 34
- `Clothing`: 177
- `Character Customization`: 228
- `Resources`: 91
- `Equipment`: 193
- `Armor`: 271
- `Utilities`: 35
- `Races`: 158
- `Animations`: 55
- `Spells`: 206
- `Classes`: 369
- `Bodies`: 16
- `Miscellaneous`: 65
- `Bug Fixes`: 129
- `Gameplay`: 189
- `Accessories`: 75
- `Quests`: 12
- `Environment`: 12
- `Audio`: 8
- `Hair`: 204
- `Heads`: 211
- `Dice`: 265
- `Companions`: 209
- `NPC`: 82
- `Bottom of Load Order`: 3
- `unsorted`: 685

## Known limitations

- **Ordering rules are not derived here.** Pairwise co-occurrence over 17
  working orders overfits badly: most pairs reflect one person's arbitrary sequencing
  rather than a real constraint. Only declared `dependencies` are emitted as hard
  edges. Revisit once submissions reach ~100 orders.
- **685 mods are `unsorted`.** These need community categorisation.
- **Thin exports dominate.** Most submissions use the `{UUID, Name}` format, which
  carries no dependency or version data. Only the full BG3MM export does.

## Files skipped

- `Current_22.11.2025_10-32-17.json`: duplicate of another file
- `VOLO Cleanup.json`: not a load order
- `provenance.json`: not a load order
