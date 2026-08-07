<!-- SPDX-License-Identifier: CC0-1.0 -->

# The VOLO masterlist

Except where expressly stated otherwise, everything in this directory is made
available under [CC0 1.0 Universal](LICENSE): a waiver of copyright and related
rights, as far as the law allows, with no attribution required.

Load order information works better as shared infrastructure than as anyone's
property. Take it, fork it, ship it in a competing tool, use it commercially.
Nothing here needs to ask permission.

## What is in here

| File | What it is |
|---|---|
| `bg3-masterlist.json` | The artefact: every mod VOLO knows, its category, evidence and dependencies |
| `masterlist.schema.json` | JSON Schema for the artefact, for anyone consuming it |
| `coverage-report.md` | What is known versus guessed, regenerated with the masterlist |
| `curated-rules.json` | Hand-written rules: exact placements, incompatibilities, warnings |
| `separator-mods.json` | Astra's divider paks by UUID, so they can be recognised on import |
| `external-categories.json` | Name to category map from the Nexus and mod.io catalogues, including names listings had before a rename |
| `learned-order.json` | The category sequence learned from working orders |

Most of this is generated from the submitted orders in
`Load Orders - Public Submitted/`; edit the corpus or the scripts, not the
output. The exceptions are `curated-rules.json` and `masterlist.schema.json`,
which are written by hand on purpose: a curated rule is a person stating a
constraint the data cannot, and it is the one file here where editing directly
is the point. Loading fails if a curated pattern misses the examples it
carries, so a rule cannot silently stop applying; see
[CONTRIBUTING.md](../CONTRIBUTING.md) for what is and is not checked.

## Why CC0 rather than attribution

The entries are factual: a mod's identifier, what it requires, which category
players file it under, which orders it appeared in. Facts are thin ground for
copyright, and a licence that pretended otherwise would create doubt for anyone
wanting to build on this. CC0 removes the doubt.

It also reflects where the data came from. Players submitted their load orders
so that everyone sorts better. Locking the result up would be a poor way to
repay that.

## What CC0 here does not cover

Two things in this directory are other people's work and are not VOLO's to
waive rights over:

- **Mod names**, throughout every file, belong to their authors. They are
  reproduced exactly as written because they are matched against what players
  have installed.
- **`separator-mods.json`** describes Astra's Load Order Dividers, which are
  used with permission and require credit. See `NOTICE` in the repository root.
