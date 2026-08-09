# Masterlist coverage report

Generated 2026-08-09T15:26:56.493Z by `scripts/mine-corpus.mjs`.

## Corpus

| | |
|---|---|
| Load orders analysed | 34 |
| labelled working | 28 |
| labelled broken | 3 |
| load-after edges promoted from catalogues | 332 |
| unlabelled | 3 |
| Separator headers parsed | 469 |
| **Unique mods indexed** | **5749** |
| Seen in more than one order | 2401 |
| With declared dependencies | 245 |
| With Script Extender flags | 43 |
| With author metadata | 483 |

## Game version

Calibrated against **Patch 8** (build `4.8.700.7143220`).

BG3 patches change what is compatible, so the build a load order was made on
matters. Full BG3MM exports record it on the base-game packages, which is where
this comes from. Only 1 of 34 orders carry it, because the short
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
| Name pattern fallback | 1601 | medium, needs review |
| Nexus or mod.io listing category | 721 | medium, the author's own words about what the mod is |
| Author's other catalogued mods | 27 | medium, a specialist author's habit; needs three catalogued mods with eighty percent in one group |
| Neighbour inference, 0.85 agreement or better | 79 | high, measured 97 percent accurate at this band |
| Neighbour inference, 0.70 to 0.85 | 101 | medium, roughly 75 percent accurate, carries a confidence score |
| Uncategorised | 866 | none, needs community input |

Inferred placements come from where a mod sits in submitted orders: labelled
neighbours within six places vote for their group, weighted by closeness.
Inferred labels never vote for other mods, so an error cannot spread. Each
inferred entry stores its agreement score as `evidence.confidence`.

## Group distribution

- `Top of Load Order`: 9
- `User Interface`: 124
- `Visuals`: 81
- `Weapons`: 236
- `Dyes`: 66
- `Clothing`: 183
- `Character Customization`: 252
- `Resources`: 113
- `Equipment`: 274
- `Armor`: 449
- `Utilities`: 61
- `Races`: 186
- `Animations`: 62
- `Spells`: 350
- `Classes`: 529
- `Bodies`: 19
- `Miscellaneous`: 96
- `Bug Fixes`: 180
- `Gameplay`: 256
- `Accessories`: 89
- `Quests`: 28
- `Environment`: 25
- `Audio`: 11
- `Hair`: 226
- `Heads`: 250
- `Dice`: 312
- `Companions`: 297
- `NPC`: 116
- `Bottom of Load Order`: 3
- `unsorted`: 866

## Known limitations

- **Ordering rules are not derived here.** Pairwise co-occurrence over 28
  working orders overfits badly: most pairs reflect one person's arbitrary sequencing
  rather than a real constraint. Only declared `dependencies` are emitted as hard
  edges. Revisit once submissions reach ~100 orders.
- **866 mods are `unsorted`.** These need community categorisation.
- **Thin exports dominate.** Most submissions use the `{UUID, Name}` format, which
  carries no dependency or version data. Only the full BG3MM export does.

## Files skipped

- `Current_22.11.2025_10-32-17.json`: duplicate of another file
- `VOLO Cleanup.json`: not a load order
- `provenance.json`: not a load order
