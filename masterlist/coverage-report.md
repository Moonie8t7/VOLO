# Masterlist coverage report

Generated 2026-08-09T18:56:19.306Z by `scripts/mine-corpus.mjs`.

## Corpus

| | |
|---|---|
| Load orders analysed | 39 |
| labelled working | 33 |
| labelled broken | 3 |
| load-after edges promoted from catalogues | 342 |
| unlabelled | 3 |
| Separator headers parsed | 860 |
| **Unique mods indexed** | **6476** |
| Seen in more than one order | 3174 |
| With declared dependencies | 252 |
| With Script Extender flags | 43 |
| With author metadata | 483 |

## Game version

Calibrated against **Patch 8** (build `4.8.700.7143220`).

BG3 patches change what is compatible, so the build a load order was made on
matters. Full BG3MM exports record it on the base-game packages, which is where
this comes from. Only 1 of 39 orders carry it, because the short
export format omits dependency metadata entirely.

Builds observed across the corpus, newest first:

- `4.8.700.7143220` (Patch 8)

132 mods record the newest build they were seen on, which is what would let
the tool flag a mod as last verified on an older patch.

## How each mod got its group

| Source | Count | Trust |
|---|---|---|
| Curated override | 22 | highest, hand-verified infrastructure |
| Human-authored section header | 3324 | high, a modder put it there |
| Name pattern fallback | 1485 | medium, needs review |
| Nexus or mod.io listing category | 697 | medium, the author's own words about what the mod is |
| Author's other catalogued mods | 26 | medium, a specialist author's habit; needs three catalogued mods with eighty percent in one group |
| Neighbour inference, 0.85 agreement or better | 138 | high, measured 97 percent accurate at this band |
| Neighbour inference, 0.70 to 0.85 | 91 | medium, roughly 75 percent accurate, carries a confidence score |
| Uncategorised | 693 | none, needs community input |

Inferred placements come from where a mod sits in submitted orders: labelled
neighbours within six places vote for their group, weighted by closeness.
Inferred labels never vote for other mods, so an error cannot spread. Each
inferred entry stores its agreement score as `evidence.confidence`.

## Group distribution

- `Top of Load Order`: 9
- `User Interface`: 140
- `Visuals`: 80
- `Weapons`: 207
- `Dyes`: 68
- `Clothing`: 180
- `Character Customization`: 440
- `Resources`: 125
- `Equipment`: 391
- `Armor`: 715
- `Utilities`: 62
- `Races`: 163
- `Animations`: 95
- `Spells`: 387
- `Classes`: 636
- `Bodies`: 17
- `Miscellaneous`: 91
- `Bug Fixes`: 204
- `Gameplay`: 289
- `Accessories`: 78
- `Quests`: 28
- `Environment`: 34
- `Audio`: 10
- `Hair`: 218
- `Heads`: 280
- `Dice`: 332
- `Companions`: 327
- `NPC`: 173
- `Bottom of Load Order`: 4
- `unsorted`: 693

## Requirements the corpus overrules

A mod here is loaded after the mods that require it, so requirements naming it
stop being ordering constraints. Right for a patcher, which reads the mods it
patches; wrong for a library, which has to be parsed first. Decided from the
working orders alone, with the evidence pooled across everything that requires
the same mod.

Listed because the decision is otherwise invisible. Dropping a real ordering
constraint would be silent, and this file is regenerated and committed on every
mine, so a change to this list shows up in a diff where somebody sees it.

| Mod | Loaded after its dependants | Mods declaring it |
|---|---|---|
| `CompatibilityFramework` | 3 of 4 placements | 3 |

## Requirements naming something unknown

Every "install X first" rests on knowing what X is. A name that matches no mod,
no folder and no curated alias makes a warning nobody can act on, and the string
would otherwise be formatted into a message and dropped without being counted.

_none: every stated requirement names a mod this masterlist knows_

## Known limitations

- **Ordering rules are not derived here.** Pairwise co-occurrence over 33
  working orders overfits badly: most pairs reflect one person's arbitrary sequencing
  rather than a real constraint. Only declared `dependencies` are emitted as hard
  edges. Revisit once submissions reach ~100 orders.
- **693 mods are `unsorted`.** These need community categorisation.
- **Thin exports dominate.** Most submissions use the `{UUID, Name}` format, which
  carries no dependency or version data. Only the full BG3MM export does.

## Files skipped

- `Current_22.11.2025_10-32-17.json`: duplicate of another file
- `VOLO Cleanup.json`: not a load order
- `provenance.json`: not a load order
