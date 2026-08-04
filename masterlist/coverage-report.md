# Masterlist coverage report

Generated 2026-08-04T13:28:12.610Z by `scripts/mine-corpus.mjs`.

## Corpus

| | |
|---|---|
| Load orders analysed | 14 |
| labelled working | 9 |
| labelled broken | 2 |
| load-after edges promoted from catalogues | 193 |
| unlabelled | 3 |
| Separator headers parsed | 249 |
| **Unique mods indexed** | **3008** |
| Seen in more than one order | 928 |
| With declared dependencies | 159 |
| With Script Extender flags | 43 |
| With author metadata | 128 |

## Game version

Calibrated against **Patch 8** (build `4.8.700.7143220`).

BG3 patches change what is compatible, so the build a load order was made on
matters. Full BG3MM exports record it on the base-game packages, which is where
this comes from. Only 1 of 14 orders carry it, because the short
export format omits dependency metadata entirely.

Builds observed across the corpus, newest first:

- `4.8.700.7143220` (Patch 8)

132 mods record the newest build they were seen on, which is what would let
the tool flag a mod as last verified on an older patch.

## How each mod got its group

| Source | Count | Trust |
|---|---|---|
| Curated override | 14 | highest, hand-verified infrastructure |
| Human-authored section header | 1641 | high, a modder put it there |
| Name pattern fallback | 546 | medium, needs review |
| Neighbour inference, 0.85 agreement or better | 66 | high, measured 97 percent accurate at this band |
| Neighbour inference, 0.70 to 0.85 | 89 | medium, roughly 75 percent accurate, carries a confidence score |
| Uncategorised | 585 | none, needs community input |

Inferred placements come from where a mod sits in submitted orders: labelled
neighbours within six places vote for their group, weighted by closeness.
Inferred labels never vote for other mods, so an error cannot spread. Each
inferred entry stores its agreement score as `evidence.confidence`.

## Group distribution

- `Top of Load Order`: 9
- `User Interface`: 62
- `Resources`: 86
- `Visuals`: 27
- `Gameplay`: 86
- `Utilities`: 15
- `Quests`: 10
- `Environment`: 3
- `Equipment`: 121
- `Accessories`: 63
- `Armor`: 212
- `Clothing`: 128
- `Dyes`: 17
- `Weapons`: 101
- `Spells`: 130
- `Races`: 83
- `Classes`: 255
- `Character Customization`: 151
- `Heads`: 136
- `Hair`: 166
- `Companions`: 121
- `Animations`: 10
- `Miscellaneous`: 54
- `Dice`: 197
- `NPC`: 73
- `Audio`: 1
- `Bodies`: 3
- `Bug Fixes`: 102
- `unsorted`: 585
- `Bottom of Load Order`: 1

## Known limitations

- **Ordering rules are not derived here.** Pairwise co-occurrence over 9
  working orders overfits badly: most pairs reflect one person's arbitrary sequencing
  rather than a real constraint. Only declared `dependencies` are emitted as hard
  edges. Revisit once submissions reach ~100 orders.
- **585 mods are `unsorted`.** These need community categorisation.
- **Thin exports dominate.** Most submissions use the `{UUID, Name}` format, which
  carries no dependency or version data. Only the full BG3MM export does.

## Files skipped

- `Current_22.11.2025_10-32-17.json`: duplicate of another file
- `VOLO Cleanup.json`: not a load order
