# Masterlist coverage report

Generated 2026-08-09T19:01:44.651Z by `scripts/mine-corpus.mjs`.

## Corpus

| | |
|---|---|
| Load orders analysed | 40 |
| labelled working | 34 |
| labelled broken | 3 |
| load-after edges promoted from catalogues | 330 |
| unlabelled | 3 |
| Separator headers parsed | 903 |
| **Unique mods indexed** | **6565** |
| Seen in more than one order | 3228 |
| With declared dependencies | 309 |
| With Script Extender flags | 163 |
| With author metadata | 880 |

## Game version

Calibrated against **Patch 8** (build `4.8.700.7143220`).

BG3 patches change what is compatible, so the build a load order was made on
matters. Full BG3MM exports record it on the base-game packages, which is where
this comes from. Only 2 of 40 orders carry it, because the short
export format omits dependency metadata entirely.

Builds observed across the corpus, newest first:

- `4.8.700.7143220` (Patch 8)

577 mods record the newest build they were seen on, which is what would let
the tool flag a mod as last verified on an older patch.

## How each mod got its group

| Source | Count | Trust |
|---|---|---|
| Curated override | 22 | highest, hand-verified infrastructure |
| Human-authored section header | 3459 | high, a modder put it there |
| Name pattern fallback | 1459 | medium, needs review |
| Nexus or mod.io listing category | 690 | medium, the author's own words about what the mod is |
| Author's other catalogued mods | 26 | medium, a specialist author's habit; needs three catalogued mods with eighty percent in one group |
| Neighbour inference, 0.85 agreement or better | 143 | high, measured 97 percent accurate at this band |
| Neighbour inference, 0.70 to 0.85 | 86 | medium, roughly 75 percent accurate, carries a confidence score |
| Uncategorised | 680 | none, needs community input |

Inferred placements come from where a mod sits in submitted orders: labelled
neighbours within six places vote for their group, weighted by closeness.
Inferred labels never vote for other mods, so an error cannot spread. Each
inferred entry stores its agreement score as `evidence.confidence`.

## Group distribution

- `Top of Load Order`: 9
- `User Interface`: 146
- `Visuals`: 82
- `Weapons`: 206
- `Dyes`: 67
- `Clothing`: 180
- `Character Customization`: 435
- `Resources`: 127
- `Equipment`: 400
- `Armor`: 712
- `Utilities`: 62
- `Races`: 185
- `Animations`: 95
- `Spells`: 387
- `Classes`: 654
- `Bodies`: 17
- `Miscellaneous`: 91
- `Bug Fixes`: 208
- `Gameplay`: 329
- `Accessories`: 77
- `Quests`: 27
- `Environment`: 34
- `Audio`: 10
- `Hair`: 218
- `Heads`: 294
- `Dice`: 332
- `Companions`: 325
- `NPC`: 172
- `Bottom of Load Order`: 4
- `unsorted`: 680

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

- `MainUI` (64 references)
- `CrossplayUI` (62 references)
- `PhotoMode` (62 references)

## Known limitations

- **Ordering rules are not derived here.** Pairwise co-occurrence over 34
  working orders overfits badly: most pairs reflect one person's arbitrary sequencing
  rather than a real constraint. Only declared `dependencies` are emitted as hard
  edges. Revisit once submissions reach ~100 orders.
- **680 mods are `unsorted`.** These need community categorisation.
- **Thin exports dominate.** Most submissions use the `{UUID, Name}` format, which
  carries no dependency or version data. Only the full BG3MM export does.

## Files skipped

- `Current_22.11.2025_10-32-17.json`: duplicate of another file
- `VOLO Cleanup.json`: not a load order
- `provenance.json`: not a load order
