# Masterlist coverage report

Generated 2026-08-06T01:38:54.189Z by `scripts/mine-corpus.mjs`.

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
| Name pattern fallback | 700 | medium, needs review |
| Nexus or mod.io listing category | 219 | medium, the author's own words about what the mod is |
| Neighbour inference, 0.85 agreement or better | 36 | high, measured 97 percent accurate at this band |
| Neighbour inference, 0.70 to 0.85 | 60 | medium, roughly 75 percent accurate, carries a confidence score |
| Uncategorised | 338 | none, needs community input |

Inferred placements come from where a mod sits in submitted orders: labelled
neighbours within six places vote for their group, weighted by closeness.
Inferred labels never vote for other mods, so an error cannot spread. Each
inferred entry stores its agreement score as `evidence.confidence`.

## Group distribution

- `Top of Load Order`: 9
- `User Interface`: 67
- `Visuals`: 30
- `Weapons`: 110
- `Dyes`: 22
- `Clothing`: 132
- `Character Customization`: 170
- `Resources`: 84
- `Equipment`: 140
- `Armor`: 225
- `Utilities`: 23
- `Races`: 104
- `Animations`: 48
- `Spells`: 151
- `Classes`: 256
- `Bodies`: 5
- `Miscellaneous`: 59
- `Bug Fixes`: 105
- `Gameplay`: 124
- `Accessories`: 55
- `Quests`: 10
- `Environment`: 6
- `Audio`: 2
- `Hair`: 156
- `Heads`: 148
- `Dice`: 221
- `Companions`: 133
- `NPC`: 74
- `Bottom of Load Order`: 1
- `unsorted`: 338

## Known limitations

- **Ordering rules are not derived here.** Pairwise co-occurrence over 9
  working orders overfits badly: most pairs reflect one person's arbitrary sequencing
  rather than a real constraint. Only declared `dependencies` are emitted as hard
  edges. Revisit once submissions reach ~100 orders.
- **338 mods are `unsorted`.** These need community categorisation.
- **Thin exports dominate.** Most submissions use the `{UUID, Name}` format, which
  carries no dependency or version data. Only the full BG3MM export does.

## Files skipped

- `Current_22.11.2025_10-32-17.json`: duplicate of another file
- `VOLO Cleanup.json`: not a load order
