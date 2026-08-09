# Masterlist coverage report

Generated 2026-08-09T11:11:05.437Z by `scripts/mine-corpus.mjs`.

## Corpus

| | |
|---|---|
| Load orders analysed | 28 |
| labelled working | 23 |
| labelled broken | 2 |
| load-after edges promoted from catalogues | 330 |
| unlabelled | 3 |
| Separator headers parsed | 363 |
| **Unique mods indexed** | **5131** |
| Seen in more than one order | 2087 |
| With declared dependencies | 243 |
| With Script Extender flags | 43 |
| With author metadata | 483 |

## Game version

Calibrated against **Patch 8** (build `4.8.700.7143220`).

BG3 patches change what is compatible, so the build a load order was made on
matters. Full BG3MM exports record it on the base-game packages, which is where
this comes from. Only 1 of 28 orders carry it, because the short
export format omits dependency metadata entirely.

Builds observed across the corpus, newest first:

- `4.8.700.7143220` (Patch 8)

132 mods record the newest build they were seen on, which is what would let
the tool flag a mod as last verified on an older patch.

## How each mod got its group

| Source | Count | Trust |
|---|---|---|
| Curated override | 21 | highest, hand-verified infrastructure |
| Human-authored section header | 2082 | high, a modder put it there |
| Name pattern fallback | 1471 | medium, needs review |
| Nexus or mod.io listing category | 611 | medium, the author's own words about what the mod is |
| Author's other catalogued mods | 28 | medium, a specialist author's habit; needs three catalogued mods with eighty percent in one group |
| Neighbour inference, 0.85 agreement or better | 81 | high, measured 97 percent accurate at this band |
| Neighbour inference, 0.70 to 0.85 | 103 | medium, roughly 75 percent accurate, carries a confidence score |
| Uncategorised | 734 | none, needs community input |

Inferred placements come from where a mod sits in submitted orders: labelled
neighbours within six places vote for their group, weighted by closeness.
Inferred labels never vote for other mods, so an error cannot spread. Each
inferred entry stores its agreement score as `evidence.confidence`.

## Group distribution

- `Top of Load Order`: 9
- `User Interface`: 113
- `Visuals`: 77
- `Weapons`: 205
- `Dyes`: 64
- `Clothing`: 176
- `Character Customization`: 235
- `Resources`: 103
- `Equipment`: 218
- `Armor`: 430
- `Utilities`: 39
- `Races`: 169
- `Animations`: 57
- `Spells`: 273
- `Classes`: 489
- `Bodies`: 18
- `Miscellaneous`: 85
- `Bug Fixes`: 163
- `Gameplay`: 245
- `Accessories`: 87
- `Quests`: 13
- `Environment`: 12
- `Audio`: 11
- `Hair`: 220
- `Heads`: 238
- `Dice`: 290
- `Companions`: 271
- `NPC`: 84
- `Bottom of Load Order`: 3
- `unsorted`: 734

## Known limitations

- **Ordering rules are not derived here.** Pairwise co-occurrence over 23
  working orders overfits badly: most pairs reflect one person's arbitrary sequencing
  rather than a real constraint. Only declared `dependencies` are emitted as hard
  edges. Revisit once submissions reach ~100 orders.
- **734 mods are `unsorted`.** These need community categorisation.
- **Thin exports dominate.** Most submissions use the `{UUID, Name}` format, which
  carries no dependency or version data. Only the full BG3MM export does.

## Files skipped

- `Current_22.11.2025_10-32-17.json`: duplicate of another file
- `VOLO Cleanup.json`: not a load order
- `provenance.json`: not a load order
