# Masterlist coverage report

Generated 2026-07-31T19:41:05.143Z by `scripts/mine-corpus.mjs`.

## Corpus

| | |
|---|---|
| Load orders analysed | 12 |
| labelled working | 6 |
| labelled broken | 2 |
| unlabelled | 4 |
| Separator headers parsed | 172 |
| **Unique mods indexed** | **2887** |
| Seen in more than one order | 882 |
| With declared dependencies | 20 |
| With Script Extender flags | 43 |
| With author metadata | 128 |

## How each mod got its group

| Source | Count | Trust |
|---|---|---|
| Curated override | 12 | highest, hand-verified infrastructure |
| Human-authored section header | 1454 | high, a modder put it there |
| Name pattern fallback | 519 | medium, needs review |
| Uncategorised | 902 | none, needs community input |

## Group distribution

- `core`: 1
- `libraries`: 24
- `frameworks`: 65
- `gameplay`: 86
- `classes`: 220
- `spells`: 121
- `items`: 395
- `character`: 418
- `clothing`: 135
- `companions`: 135
- `ui`: 53
- `visual`: 183
- `patches`: 33
- `fixes`: 66
- `unsorted`: 952

## Known limitations

- **Ordering rules are not derived here.** Pairwise co-occurrence over 6
  working orders overfits badly: most pairs reflect one person's arbitrary sequencing
  rather than a real constraint. Only declared `dependencies` are emitted as hard
  edges. Revisit once submissions reach ~100 orders.
- **902 mods are `unsorted`.** These need community categorisation.
- **Thin exports dominate.** Most submissions use the `{UUID, Name}` format, which
  carries no dependency or version data. Only the full BG3MM export does.

## Files skipped

- `Current_22.11.2025_10-32-17.json`: duplicate of another file
- `VOLO Cleanup.json`: not a load order
