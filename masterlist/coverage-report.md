# Masterlist coverage report

Generated 2026-08-09T00:15:31.873Z by `scripts/mine-corpus.mjs`.

## Corpus

| | |
|---|---|
| Load orders analysed | 17 |
| labelled working | 12 |
| labelled broken | 2 |
| load-after edges promoted from catalogues | 210 |
| unlabelled | 3 |
| Separator headers parsed | 249 |
| **Unique mods indexed** | **3480** |
| Seen in more than one order | 1265 |
| With declared dependencies | 172 |
| With Script Extender flags | 43 |
| With author metadata | 483 |

## Game version

Calibrated against **Patch 8** (build `4.8.700.7143220`).

BG3 patches change what is compatible, so the build a load order was made on
matters. Full BG3MM exports record it on the base-game packages, which is where
this comes from. Only 1 of 17 orders carry it, because the short
export format omits dependency metadata entirely.

Builds observed across the corpus, newest first:

- `4.8.700.7143220` (Patch 8)

132 mods record the newest build they were seen on, which is what would let
the tool flag a mod as last verified on an older patch.

## How each mod got its group

| Source | Count | Trust |
|---|---|---|
| Curated override | 16 | highest, hand-verified infrastructure |
| Human-authored section header | 1640 | high, a modder put it there |
| Name pattern fallback | 900 | medium, needs review |
| Nexus or mod.io listing category | 338 | medium, the author's own words about what the mod is |
| Author's other catalogued mods | 29 | medium, a specialist author's habit; needs three catalogued mods with eighty percent in one group |
| Neighbour inference, 0.85 agreement or better | 40 | high, measured 97 percent accurate at this band |
| Neighbour inference, 0.70 to 0.85 | 55 | medium, roughly 75 percent accurate, carries a confidence score |
| Uncategorised | 462 | none, needs community input |

Inferred placements come from where a mod sits in submitted orders: labelled
neighbours within six places vote for their group, weighted by closeness.
Inferred labels never vote for other mods, so an error cannot spread. Each
inferred entry stores its agreement score as `evidence.confidence`.

## Group distribution

- `Top of Load Order`: 9
- `User Interface`: 76
- `Visuals`: 39
- `Weapons`: 118
- `Dyes`: 28
- `Clothing`: 152
- `Character Customization`: 186
- `Resources`: 86
- `Equipment`: 160
- `Armor`: 248
- `Utilities`: 24
- `Races`: 121
- `Animations`: 50
- `Spells`: 167
- `Classes`: 284
- `Bodies`: 12
- `Miscellaneous`: 61
- `Bug Fixes`: 112
- `Gameplay`: 152
- `Accessories`: 68
- `Quests`: 11
- `Environment`: 6
- `Audio`: 7
- `Hair`: 172
- `Heads`: 170
- `Dice`: 261
- `Companions`: 159
- `NPC`: 77
- `Bottom of Load Order`: 2
- `unsorted`: 462

## Known limitations

- **Ordering rules are not derived here.** Pairwise co-occurrence over 12
  working orders overfits badly: most pairs reflect one person's arbitrary sequencing
  rather than a real constraint. Only declared `dependencies` are emitted as hard
  edges. Revisit once submissions reach ~100 orders.
- **462 mods are `unsorted`.** These need community categorisation.
- **Thin exports dominate.** Most submissions use the `{UUID, Name}` format, which
  carries no dependency or version data. Only the full BG3MM export does.

## Files skipped

- `Current_22.11.2025_10-32-17.json`: duplicate of another file
- `VOLO Cleanup.json`: not a load order
- `provenance.json`: not a load order
