# Masterlist coverage report

Generated 2026-08-08T23:10:24.626Z by `scripts/mine-corpus.mjs`.

## Corpus

| | |
|---|---|
| Load orders analysed | 16 |
| labelled working | 11 |
| labelled broken | 2 |
| load-after edges promoted from catalogues | 209 |
| unlabelled | 3 |
| Separator headers parsed | 249 |
| **Unique mods indexed** | **3275** |
| Seen in more than one order | 1161 |
| With declared dependencies | 171 |
| With Script Extender flags | 43 |
| With author metadata | 483 |

## Game version

Calibrated against **Patch 8** (build `4.8.700.7143220`).

BG3 patches change what is compatible, so the build a load order was made on
matters. Full BG3MM exports record it on the base-game packages, which is where
this comes from. Only 1 of 16 orders carry it, because the short
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
| Name pattern fallback | 828 | medium, needs review |
| Nexus or mod.io listing category | 315 | medium, the author's own words about what the mod is |
| Author's other catalogued mods | 29 | medium, a specialist author's habit; needs three catalogued mods with eighty percent in one group |
| Neighbour inference, 0.85 agreement or better | 42 | high, measured 97 percent accurate at this band |
| Neighbour inference, 0.70 to 0.85 | 57 | medium, roughly 75 percent accurate, carries a confidence score |
| Uncategorised | 348 | none, needs community input |

Inferred placements come from where a mod sits in submitted orders: labelled
neighbours within six places vote for their group, weighted by closeness.
Inferred labels never vote for other mods, so an error cannot spread. Each
inferred entry stores its agreement score as `evidence.confidence`.

## Group distribution

- `Top of Load Order`: 9
- `User Interface`: 75
- `Visuals`: 33
- `Weapons`: 114
- `Dyes`: 27
- `Clothing`: 141
- `Character Customization`: 181
- `Resources`: 86
- `Equipment`: 157
- `Armor`: 245
- `Utilities`: 24
- `Races`: 120
- `Animations`: 50
- `Spells`: 164
- `Classes`: 281
- `Bodies`: 6
- `Miscellaneous`: 60
- `Bug Fixes`: 109
- `Gameplay`: 148
- `Accessories`: 64
- `Quests`: 11
- `Environment`: 6
- `Audio`: 3
- `Hair`: 166
- `Heads`: 164
- `Dice`: 262
- `Companions`: 144
- `NPC`: 75
- `Bottom of Load Order`: 2
- `unsorted`: 348

## Known limitations

- **Ordering rules are not derived here.** Pairwise co-occurrence over 11
  working orders overfits badly: most pairs reflect one person's arbitrary sequencing
  rather than a real constraint. Only declared `dependencies` are emitted as hard
  edges. Revisit once submissions reach ~100 orders.
- **348 mods are `unsorted`.** These need community categorisation.
- **Thin exports dominate.** Most submissions use the `{UUID, Name}` format, which
  carries no dependency or version data. Only the full BG3MM export does.

## Files skipped

- `Current_22.11.2025_10-32-17.json`: duplicate of another file
- `VOLO Cleanup.json`: not a load order
- `provenance.json`: not a load order
