# Masterlist coverage report

Generated 2026-08-09T12:11:31.865Z by `scripts/mine-corpus.mjs`.

## Corpus

| | |
|---|---|
| Load orders analysed | 30 |
| labelled working | 24 |
| labelled broken | 3 |
| load-after edges promoted from catalogues | 328 |
| unlabelled | 3 |
| Separator headers parsed | 469 |
| **Unique mods indexed** | **5344** |
| Seen in more than one order | 2250 |
| With declared dependencies | 241 |
| With Script Extender flags | 43 |
| With author metadata | 483 |

## Game version

Calibrated against **Patch 8** (build `4.8.700.7143220`).

BG3 patches change what is compatible, so the build a load order was made on
matters. Full BG3MM exports record it on the base-game packages, which is where
this comes from. Only 1 of 30 orders carry it, because the short
export format omits dependency metadata entirely.

Builds observed across the corpus, newest first:

- `4.8.700.7143220` (Patch 8)

132 mods record the newest build they were seen on, which is what would let
the tool flag a mod as last verified on an older patch.

## How each mod got its group

| Source | Count | Trust |
|---|---|---|
| Curated override | 21 | highest, hand-verified infrastructure |
| Human-authored section header | 2333 | high, a modder put it there |
| Name pattern fallback | 1436 | medium, needs review |
| Nexus or mod.io listing category | 591 | medium, the author's own words about what the mod is |
| Author's other catalogued mods | 27 | medium, a specialist author's habit; needs three catalogued mods with eighty percent in one group |
| Neighbour inference, 0.85 agreement or better | 80 | high, measured 97 percent accurate at this band |
| Neighbour inference, 0.70 to 0.85 | 101 | medium, roughly 75 percent accurate, carries a confidence score |
| Uncategorised | 755 | none, needs community input |

Inferred placements come from where a mod sits in submitted orders: labelled
neighbours within six places vote for their group, weighted by closeness.
Inferred labels never vote for other mods, so an error cannot spread. Each
inferred entry stores its agreement score as `evidence.confidence`.

## Group distribution

- `Top of Load Order`: 9
- `User Interface`: 120
- `Visuals`: 75
- `Weapons`: 201
- `Dyes`: 63
- `Clothing`: 178
- `Character Customization`: 248
- `Resources`: 108
- `Equipment`: 245
- `Armor`: 432
- `Utilities`: 60
- `Races`: 168
- `Animations`: 60
- `Spells`: 299
- `Classes`: 492
- `Bodies`: 19
- `Miscellaneous`: 96
- `Bug Fixes`: 161
- `Gameplay`: 233
- `Accessories`: 84
- `Quests`: 28
- `Environment`: 25
- `Audio`: 11
- `Hair`: 223
- `Heads`: 241
- `Dice`: 312
- `Companions`: 280
- `NPC`: 115
- `Bottom of Load Order`: 3
- `unsorted`: 755

## Known limitations

- **Ordering rules are not derived here.** Pairwise co-occurrence over 24
  working orders overfits badly: most pairs reflect one person's arbitrary sequencing
  rather than a real constraint. Only declared `dependencies` are emitted as hard
  edges. Revisit once submissions reach ~100 orders.
- **755 mods are `unsorted`.** These need community categorisation.
- **Thin exports dominate.** Most submissions use the `{UUID, Name}` format, which
  carries no dependency or version data. Only the full BG3MM export does.

## Files skipped

- `Current_22.11.2025_10-32-17.json`: duplicate of another file
- `VOLO Cleanup.json`: not a load order
- `provenance.json`: not a load order
