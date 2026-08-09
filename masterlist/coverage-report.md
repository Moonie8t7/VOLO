# Masterlist coverage report

Generated 2026-08-09T10:45:24.787Z by `scripts/mine-corpus.mjs`.

## Corpus

| | |
|---|---|
| Load orders analysed | 23 |
| labelled working | 18 |
| labelled broken | 2 |
| load-after edges promoted from catalogues | 302 |
| unlabelled | 3 |
| Separator headers parsed | 317 |
| **Unique mods indexed** | **4557** |
| Seen in more than one order | 1814 |
| With declared dependencies | 221 |
| With Script Extender flags | 43 |
| With author metadata | 483 |

## Game version

Calibrated against **Patch 8** (build `4.8.700.7143220`).

BG3 patches change what is compatible, so the build a load order was made on
matters. Full BG3MM exports record it on the base-game packages, which is where
this comes from. Only 1 of 23 orders carry it, because the short
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
| Name pattern fallback | 1197 | medium, needs review |
| Nexus or mod.io listing category | 471 | medium, the author's own words about what the mod is |
| Author's other catalogued mods | 28 | medium, a specialist author's habit; needs three catalogued mods with eighty percent in one group |
| Neighbour inference, 0.85 agreement or better | 73 | high, measured 97 percent accurate at this band |
| Neighbour inference, 0.70 to 0.85 | 93 | medium, roughly 75 percent accurate, carries a confidence score |
| Uncategorised | 635 | none, needs community input |

Inferred placements come from where a mod sits in submitted orders: labelled
neighbours within six places vote for their group, weighted by closeness.
Inferred labels never vote for other mods, so an error cannot spread. Each
inferred entry stores its agreement score as `evidence.confidence`.

## Group distribution

- `Top of Load Order`: 9
- `User Interface`: 105
- `Visuals`: 69
- `Weapons`: 164
- `Dyes`: 49
- `Clothing`: 167
- `Character Customization`: 220
- `Resources`: 102
- `Equipment`: 182
- `Armor`: 398
- `Utilities`: 36
- `Races`: 156
- `Animations`: 55
- `Spells`: 228
- `Classes`: 427
- `Bodies`: 16
- `Miscellaneous`: 74
- `Bug Fixes`: 144
- `Gameplay`: 196
- `Accessories`: 74
- `Quests`: 11
- `Environment`: 12
- `Audio`: 8
- `Hair`: 208
- `Heads`: 228
- `Dice`: 266
- `Companions`: 233
- `NPC`: 82
- `Bottom of Load Order`: 3
- `unsorted`: 635

## Known limitations

- **Ordering rules are not derived here.** Pairwise co-occurrence over 18
  working orders overfits badly: most pairs reflect one person's arbitrary sequencing
  rather than a real constraint. Only declared `dependencies` are emitted as hard
  edges. Revisit once submissions reach ~100 orders.
- **635 mods are `unsorted`.** These need community categorisation.
- **Thin exports dominate.** Most submissions use the `{UUID, Name}` format, which
  carries no dependency or version data. Only the full BG3MM export does.

## Files skipped

- `Current_22.11.2025_10-32-17.json`: duplicate of another file
- `VOLO Cleanup.json`: not a load order
- `provenance.json`: not a load order
