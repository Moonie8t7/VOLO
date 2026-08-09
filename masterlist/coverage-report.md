# Masterlist coverage report

Generated 2026-08-09T09:00:39.013Z by `scripts/mine-corpus.mjs`.

## Corpus

| | |
|---|---|
| Load orders analysed | 21 |
| labelled working | 16 |
| labelled broken | 2 |
| load-after edges promoted from catalogues | 293 |
| unlabelled | 3 |
| Separator headers parsed | 249 |
| **Unique mods indexed** | **4075** |
| Seen in more than one order | 1541 |
| With declared dependencies | 213 |
| With Script Extender flags | 43 |
| With author metadata | 483 |

## Game version

Calibrated against **Patch 8** (build `4.8.700.7143220`).

BG3 patches change what is compatible, so the build a load order was made on
matters. Full BG3MM exports record it on the base-game packages, which is where
this comes from. Only 1 of 21 orders carry it, because the short
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
| Name pattern fallback | 1193 | medium, needs review |
| Nexus or mod.io listing category | 465 | medium, the author's own words about what the mod is |
| Author's other catalogued mods | 29 | medium, a specialist author's habit; needs three catalogued mods with eighty percent in one group |
| Neighbour inference, 0.85 agreement or better | 46 | high, measured 97 percent accurate at this band |
| Neighbour inference, 0.70 to 0.85 | 77 | medium, roughly 75 percent accurate, carries a confidence score |
| Uncategorised | 605 | none, needs community input |

Inferred placements come from where a mod sits in submitted orders: labelled
neighbours within six places vote for their group, weighted by closeness.
Inferred labels never vote for other mods, so an error cannot spread. Each
inferred entry stores its agreement score as `evidence.confidence`.

## Group distribution

- `Top of Load Order`: 9
- `User Interface`: 97
- `Visuals`: 67
- `Weapons`: 129
- `Dyes`: 34
- `Clothing`: 177
- `Character Customization`: 223
- `Resources`: 90
- `Equipment`: 190
- `Armor`: 267
- `Utilities`: 32
- `Races`: 155
- `Animations`: 55
- `Spells`: 193
- `Classes`: 311
- `Bodies`: 16
- `Miscellaneous`: 64
- `Bug Fixes`: 122
- `Gameplay`: 184
- `Accessories`: 72
- `Quests`: 12
- `Environment`: 12
- `Audio`: 7
- `Hair`: 195
- `Heads`: 202
- `Dice`: 264
- `Companions`: 206
- `NPC`: 82
- `Bottom of Load Order`: 3
- `unsorted`: 605

## Known limitations

- **Ordering rules are not derived here.** Pairwise co-occurrence over 16
  working orders overfits badly: most pairs reflect one person's arbitrary sequencing
  rather than a real constraint. Only declared `dependencies` are emitted as hard
  edges. Revisit once submissions reach ~100 orders.
- **605 mods are `unsorted`.** These need community categorisation.
- **Thin exports dominate.** Most submissions use the `{UUID, Name}` format, which
  carries no dependency or version data. Only the full BG3MM export does.

## Files skipped

- `Current_22.11.2025_10-32-17.json`: duplicate of another file
- `VOLO Cleanup.json`: not a load order
- `provenance.json`: not a load order
