# Masterlist coverage report

Generated 2026-08-09T11:03:33.602Z by `scripts/mine-corpus.mjs`.

## Corpus

| | |
|---|---|
| Load orders analysed | 27 |
| labelled working | 22 |
| labelled broken | 2 |
| load-after edges promoted from catalogues | 327 |
| unlabelled | 3 |
| Separator headers parsed | 317 |
| **Unique mods indexed** | **5094** |
| Seen in more than one order | 2065 |
| With declared dependencies | 240 |
| With Script Extender flags | 43 |
| With author metadata | 483 |

## Game version

Calibrated against **Patch 8** (build `4.8.700.7143220`).

BG3 patches change what is compatible, so the build a load order was made on
matters. Full BG3MM exports record it on the base-game packages, which is where
this comes from. Only 1 of 27 orders carry it, because the short
export format omits dependency metadata entirely.

Builds observed across the corpus, newest first:

- `4.8.700.7143220` (Patch 8)

132 mods record the newest build they were seen on, which is what would let
the tool flag a mod as last verified on an older patch.

## How each mod got its group

| Source | Count | Trust |
|---|---|---|
| Curated override | 21 | highest, hand-verified infrastructure |
| Human-authored section header | 2039 | high, a modder put it there |
| Name pattern fallback | 1476 | medium, needs review |
| Nexus or mod.io listing category | 614 | medium, the author's own words about what the mod is |
| Author's other catalogued mods | 28 | medium, a specialist author's habit; needs three catalogued mods with eighty percent in one group |
| Neighbour inference, 0.85 agreement or better | 82 | high, measured 97 percent accurate at this band |
| Neighbour inference, 0.70 to 0.85 | 101 | medium, roughly 75 percent accurate, carries a confidence score |
| Uncategorised | 733 | none, needs community input |

Inferred placements come from where a mod sits in submitted orders: labelled
neighbours within six places vote for their group, weighted by closeness.
Inferred labels never vote for other mods, so an error cannot spread. Each
inferred entry stores its agreement score as `evidence.confidence`.

## Group distribution

- `Top of Load Order`: 9
- `User Interface`: 113
- `Visuals`: 77
- `Weapons`: 207
- `Dyes`: 57
- `Clothing`: 173
- `Character Customization`: 236
- `Resources`: 103
- `Equipment`: 220
- `Armor`: 422
- `Utilities`: 39
- `Races`: 169
- `Animations`: 55
- `Spells`: 267
- `Classes`: 487
- `Bodies`: 18
- `Miscellaneous`: 85
- `Bug Fixes`: 160
- `Gameplay`: 239
- `Accessories`: 88
- `Quests`: 13
- `Environment`: 12
- `Audio`: 11
- `Hair`: 221
- `Heads`: 239
- `Dice`: 286
- `Companions`: 270
- `NPC`: 82
- `Bottom of Load Order`: 3
- `unsorted`: 733

## Known limitations

- **Ordering rules are not derived here.** Pairwise co-occurrence over 22
  working orders overfits badly: most pairs reflect one person's arbitrary sequencing
  rather than a real constraint. Only declared `dependencies` are emitted as hard
  edges. Revisit once submissions reach ~100 orders.
- **733 mods are `unsorted`.** These need community categorisation.
- **Thin exports dominate.** Most submissions use the `{UUID, Name}` format, which
  carries no dependency or version data. Only the full BG3MM export does.

## Files skipped

- `Current_22.11.2025_10-32-17.json`: duplicate of another file
- `VOLO Cleanup.json`: not a load order
- `provenance.json`: not a load order
