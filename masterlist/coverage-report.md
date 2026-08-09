# Masterlist coverage report

Generated 2026-08-09T16:04:34.857Z by `scripts/mine-corpus.mjs`.

## Corpus

| | |
|---|---|
| Load orders analysed | 36 |
| labelled working | 30 |
| labelled broken | 3 |
| load-after edges promoted from catalogues | 332 |
| unlabelled | 3 |
| Separator headers parsed | 625 |
| **Unique mods indexed** | **6208** |
| Seen in more than one order | 2758 |
| With declared dependencies | 245 |
| With Script Extender flags | 43 |
| With author metadata | 483 |

## Game version

Calibrated against **Patch 8** (build `4.8.700.7143220`).

BG3 patches change what is compatible, so the build a load order was made on
matters. Full BG3MM exports record it on the base-game packages, which is where
this comes from. Only 1 of 36 orders carry it, because the short
export format omits dependency metadata entirely.

Builds observed across the corpus, newest first:

- `4.8.700.7143220` (Patch 8)

132 mods record the newest build they were seen on, which is what would let
the tool flag a mod as last verified on an older patch.

## How each mod got its group

| Source | Count | Trust |
|---|---|---|
| Curated override | 21 | highest, hand-verified infrastructure |
| Human-authored section header | 3047 | high, a modder put it there |
| Name pattern fallback | 1504 | medium, needs review |
| Nexus or mod.io listing category | 684 | medium, the author's own words about what the mod is |
| Author's other catalogued mods | 26 | medium, a specialist author's habit; needs three catalogued mods with eighty percent in one group |
| Neighbour inference, 0.85 agreement or better | 140 | high, measured 97 percent accurate at this band |
| Neighbour inference, 0.70 to 0.85 | 103 | medium, roughly 75 percent accurate, carries a confidence score |
| Uncategorised | 683 | none, needs community input |

Inferred placements come from where a mod sits in submitted orders: labelled
neighbours within six places vote for their group, weighted by closeness.
Inferred labels never vote for other mods, so an error cannot spread. Each
inferred entry stores its agreement score as `evidence.confidence`.

## Group distribution

- `Top of Load Order`: 9
- `User Interface`: 130
- `Visuals`: 76
- `Weapons`: 222
- `Dyes`: 66
- `Clothing`: 174
- `Character Customization`: 299
- `Resources`: 127
- `Equipment`: 298
- `Armor`: 745
- `Utilities`: 61
- `Races`: 186
- `Animations`: 92
- `Spells`: 372
- `Classes`: 587
- `Bodies`: 18
- `Miscellaneous`: 95
- `Bug Fixes`: 198
- `Gameplay`: 287
- `Accessories`: 82
- `Quests`: 28
- `Environment`: 35
- `Audio`: 9
- `Hair`: 239
- `Heads`: 292
- `Dice`: 320
- `Companions`: 311
- `NPC`: 164
- `Bottom of Load Order`: 3
- `unsorted`: 683

## Known limitations

- **Ordering rules are not derived here.** Pairwise co-occurrence over 30
  working orders overfits badly: most pairs reflect one person's arbitrary sequencing
  rather than a real constraint. Only declared `dependencies` are emitted as hard
  edges. Revisit once submissions reach ~100 orders.
- **683 mods are `unsorted`.** These need community categorisation.
- **Thin exports dominate.** Most submissions use the `{UUID, Name}` format, which
  carries no dependency or version data. Only the full BG3MM export does.

## Files skipped

- `Current_22.11.2025_10-32-17.json`: duplicate of another file
- `VOLO Cleanup.json`: not a load order
- `provenance.json`: not a load order
