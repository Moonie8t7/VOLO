# Masterlist coverage report

Generated 2026-08-02T20:17:19.784Z by `scripts/mine-corpus.mjs`.

## Corpus

| | |
|---|---|
| Load orders analysed | 12 |
| labelled working | 8 |
| labelled broken | 2 |
| unlabelled | 2 |
| Separator headers parsed | 172 |
| **Unique mods indexed** | **2887** |
| Seen in more than one order | 882 |
| With declared dependencies | 20 |
| With Script Extender flags | 43 |
| With author metadata | 128 |

## Game version

Calibrated against **Patch 8** (build `4.8.700.7143220`).

BG3 patches change what is compatible, so the build a load order was made on
matters. Full BG3MM exports record it on the base-game packages, which is where
this comes from. Only 1 of 12 orders carry it, because the short
export format omits dependency metadata entirely.

Builds observed across the corpus, newest first:

- `4.8.700.7143220` (Patch 8)

132 mods record the newest build they were seen on, which is what would let
the tool flag a mod as last verified on an older patch.

## How each mod got its group

| Source | Count | Trust |
|---|---|---|
| Curated override | 12 | highest, hand-verified infrastructure |
| Human-authored section header | 1488 | high, a modder put it there |
| Name pattern fallback | 558 | medium, needs review |
| Neighbour inference, 0.85 agreement or better | 76 | high, measured 97 percent accurate at this band |
| Neighbour inference, 0.70 to 0.85 | 108 | medium, roughly 75 percent accurate, carries a confidence score |
| Uncategorised | 645 | none, needs community input |

Inferred placements come from where a mod sits in submitted orders: labelled
neighbours within six places vote for their group, weighted by closeness.
Inferred labels never vote for other mods, so an error cannot spread. Each
inferred entry stores its agreement score as `evidence.confidence`.

## Group distribution

- `Top of Load Order`: 9
- `User Interface`: 58
- `Visuals`: 28
- `Weapons`: 98
- `Dyes`: 20
- `Clothing`: 135
- `Character Customization`: 125
- `Resources`: 93
- `Equipment`: 76
- `Armor`: 226
- `Utilities`: 8
- `Races`: 58
- `Animations`: 10
- `Spells`: 121
- `Classes`: 215
- `Bodies`: 4
- `Miscellaneous`: 49
- `Bug Fixes`: 99
- `Gameplay`: 87
- `Accessories`: 70
- `Quests`: 0
- `Environment`: 0
- `Audio`: 1
- `Hair`: 169
- `Heads`: 125
- `Dice`: 194
- `Companions`: 93
- `NPC`: 71
- `Bottom of Load Order`: 0
- `unsorted`: 645

## Known limitations

- **Ordering rules are not derived here.** Pairwise co-occurrence over 8
  working orders overfits badly: most pairs reflect one person's arbitrary sequencing
  rather than a real constraint. Only declared `dependencies` are emitted as hard
  edges. Revisit once submissions reach ~100 orders.
- **645 mods are `unsorted`.** These need community categorisation.
- **Thin exports dominate.** Most submissions use the `{UUID, Name}` format, which
  carries no dependency or version data. Only the full BG3MM export does.

## Files skipped

- `Current_22.11.2025_10-32-17.json`: duplicate of another file
- `VOLO Cleanup.json`: not a load order
