# Masterlist coverage report

Generated 2026-08-09T10:59:48.940Z by `scripts/mine-corpus.mjs`.

## Corpus

| | |
|---|---|
| Load orders analysed | 25 |
| labelled working | 20 |
| labelled broken | 2 |
| load-after edges promoted from catalogues | 311 |
| unlabelled | 3 |
| Separator headers parsed | 317 |
| **Unique mods indexed** | **4604** |
| Seen in more than one order | 1840 |
| With declared dependencies | 227 |
| With Script Extender flags | 43 |
| With author metadata | 483 |

## Game version

Calibrated against **Patch 8** (build `4.8.700.7143220`).

BG3 patches change what is compatible, so the build a load order was made on
matters. Full BG3MM exports record it on the base-game packages, which is where
this comes from. Only 1 of 25 orders carry it, because the short
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
| Name pattern fallback | 1223 | medium, needs review |
| Nexus or mod.io listing category | 484 | medium, the author's own words about what the mod is |
| Author's other catalogued mods | 28 | medium, a specialist author's habit; needs three catalogued mods with eighty percent in one group |
| Neighbour inference, 0.85 agreement or better | 75 | high, measured 97 percent accurate at this band |
| Neighbour inference, 0.70 to 0.85 | 92 | medium, roughly 75 percent accurate, carries a confidence score |
| Uncategorised | 642 | none, needs community input |

Inferred placements come from where a mod sits in submitted orders: labelled
neighbours within six places vote for their group, weighted by closeness.
Inferred labels never vote for other mods, so an error cannot spread. Each
inferred entry stores its agreement score as `evidence.confidence`.

## Group distribution

- `Top of Load Order`: 9
- `User Interface`: 108
- `Visuals`: 69
- `Weapons`: 166
- `Dyes`: 49
- `Clothing`: 167
- `Character Customization`: 220
- `Resources`: 102
- `Equipment`: 184
- `Armor`: 399
- `Utilities`: 36
- `Races`: 156
- `Animations`: 55
- `Spells`: 233
- `Classes`: 440
- `Bodies`: 16
- `Miscellaneous`: 75
- `Bug Fixes`: 147
- `Gameplay`: 200
- `Accessories`: 78
- `Quests`: 12
- `Environment`: 12
- `Audio`: 8
- `Hair`: 208
- `Heads`: 229
- `Dice`: 266
- `Companions`: 233
- `NPC`: 82
- `Bottom of Load Order`: 3
- `unsorted`: 642

## Known limitations

- **Ordering rules are not derived here.** Pairwise co-occurrence over 20
  working orders overfits badly: most pairs reflect one person's arbitrary sequencing
  rather than a real constraint. Only declared `dependencies` are emitted as hard
  edges. Revisit once submissions reach ~100 orders.
- **642 mods are `unsorted`.** These need community categorisation.
- **Thin exports dominate.** Most submissions use the `{UUID, Name}` format, which
  carries no dependency or version data. Only the full BG3MM export does.

## Files skipped

- `Current_22.11.2025_10-32-17.json`: duplicate of another file
- `VOLO Cleanup.json`: not a load order
- `provenance.json`: not a load order
