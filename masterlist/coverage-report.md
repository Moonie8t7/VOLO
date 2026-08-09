# Masterlist coverage report

Generated 2026-08-09T16:02:57.154Z by `scripts/mine-corpus.mjs`.

## Corpus

| | |
|---|---|
| Load orders analysed | 35 |
| labelled working | 29 |
| labelled broken | 3 |
| load-after edges promoted from catalogues | 332 |
| unlabelled | 3 |
| Separator headers parsed | 506 |
| **Unique mods indexed** | **6026** |
| Seen in more than one order | 2605 |
| With declared dependencies | 245 |
| With Script Extender flags | 43 |
| With author metadata | 483 |

## Game version

Calibrated against **Patch 8** (build `4.8.700.7143220`).

BG3 patches change what is compatible, so the build a load order was made on
matters. Full BG3MM exports record it on the base-game packages, which is where
this comes from. Only 1 of 35 orders carry it, because the short
export format omits dependency metadata entirely.

Builds observed across the corpus, newest first:

- `4.8.700.7143220` (Patch 8)

132 mods record the newest build they were seen on, which is what would let
the tool flag a mod as last verified on an older patch.

## How each mod got its group

| Source | Count | Trust |
|---|---|---|
| Curated override | 21 | highest, hand-verified infrastructure |
| Human-authored section header | 2799 | high, a modder put it there |
| Name pattern fallback | 1529 | medium, needs review |
| Nexus or mod.io listing category | 704 | medium, the author's own words about what the mod is |
| Author's other catalogued mods | 27 | medium, a specialist author's habit; needs three catalogued mods with eighty percent in one group |
| Neighbour inference, 0.85 agreement or better | 133 | high, measured 97 percent accurate at this band |
| Neighbour inference, 0.70 to 0.85 | 107 | medium, roughly 75 percent accurate, carries a confidence score |
| Uncategorised | 706 | none, needs community input |

Inferred placements come from where a mod sits in submitted orders: labelled
neighbours within six places vote for their group, weighted by closeness.
Inferred labels never vote for other mods, so an error cannot spread. Each
inferred entry stores its agreement score as `evidence.confidence`.

## Group distribution

- `Top of Load Order`: 9
- `User Interface`: 120
- `Visuals`: 78
- `Weapons`: 224
- `Dyes`: 67
- `Clothing`: 160
- `Character Customization`: 279
- `Resources`: 116
- `Equipment`: 268
- `Armor`: 751
- `Utilities`: 58
- `Races`: 187
- `Animations`: 92
- `Spells`: 363
- `Classes`: 539
- `Bodies`: 18
- `Miscellaneous`: 99
- `Bug Fixes`: 182
- `Gameplay`: 287
- `Accessories`: 81
- `Quests`: 28
- `Environment`: 26
- `Audio`: 9
- `Hair`: 247
- `Heads`: 296
- `Dice`: 321
- `Companions`: 297
- `NPC`: 115
- `Bottom of Load Order`: 3
- `unsorted`: 706

## Known limitations

- **Ordering rules are not derived here.** Pairwise co-occurrence over 29
  working orders overfits badly: most pairs reflect one person's arbitrary sequencing
  rather than a real constraint. Only declared `dependencies` are emitted as hard
  edges. Revisit once submissions reach ~100 orders.
- **706 mods are `unsorted`.** These need community categorisation.
- **Thin exports dominate.** Most submissions use the `{UUID, Name}` format, which
  carries no dependency or version data. Only the full BG3MM export does.

## Files skipped

- `Current_22.11.2025_10-32-17.json`: duplicate of another file
- `VOLO Cleanup.json`: not a load order
- `provenance.json`: not a load order
