# VOLO

Verified Order and Load Optimisation: a community-curated load order tool for
**Baldur's Gate 3**, in the spirit of [LOOT](https://loot.github.io/) for Bethesda
titles.

Drop in your BG3 Mod Manager export and VOLO sorts it against a community
masterlist, resolving declared dependencies, grouping mods by what they do, and
explaining every placement.

It runs entirely in your browser. There is no server, no account and no upload.
Your load order never leaves your machine.

## How it works

1. **Import.** Reads BG3MM exports in both the short and full-metadata forms, plus
   CSV, TSV and plain text. Section separators you have written yourself are
   recognised and used as categorisation hints, as are Astra's Load Order
   Dividers, which VOLO knows by UUID even when they have been renamed.
2. **Sort.** Groups set the broad shape of the order, running from `core` and
   `libraries` through content and `ui` to `patches` and `fixes`. Dependencies
   declared in mod metadata are hard constraints. Anything else stays put.
3. **Explain.** Every mod tells you why it sits where it does.
4. **Export.** Back to BG3MM, or as JSON, CSV, text or Markdown.

The sort is Kahn's algorithm with the ready set ordered by group rank then
original position. That last detail matters: a sorter that reshuffles a working
load order without cause is worse than useless, so VOLO moves mods only when a
rule requires it.

Sorting 1,000 mods takes about 3ms.

## The masterlist

`masterlist/bg3-masterlist.json` covers **around 2,900 mods**, built from load orders the
community submitted. Roughly half were categorised from section headers that
modders wrote in their own orders. The rest came from name patterns, curated
overrides, or are still uncategorised.

See `masterlist/coverage-report.md` for a breakdown of what is known versus
guessed.

Ordering rules are deliberately conservative. Only dependencies declared in `.pak`
metadata become hard edges. Pairwise ordering mined from a handful of submitted
orders overfits badly, encoding one player's habits as everyone's rules, so it is
not published until there is enough data for it to mean something.

### Contributing

The most useful thing you can send is a **working load order**, ideally the full
BG3MM export (File, then Export Order to File), which carries dependency and
version metadata that the short export does not.

Category corrections are just as valuable, particularly for anything currently
showing as `unsorted`.

## Development

```bash
npm install
npm run dev        # http://localhost:5173
npm run check      # typecheck
npm test           # verify the optimiser against the submitted corpus
npm run build      # regenerate the masterlist, then build to dist/
```

`npm run masterlist` re-mines `Load Orders - Public Submitted/` into
`masterlist/bg3-masterlist.json`. Run it when new submissions arrive.

### Layout

```text
client/src/lib/     parser, optimiser, masterlist loader, exporter (pure, no I/O)
client/src/pages/   the UI
masterlist/         generated masterlist and coverage report
scripts/            corpus miner and smoke test
public/             static assets, including the published masterlist
```

### Deployment

The build produces static files in `dist/`, servable from any CDN. Routing is
client side, so the host needs a rewrite rule sending all paths to `index.html`,
otherwise a refresh on `/optimise` returns a 404.

## Status

Working: import, sort with explanations and confidence scores, export,
masterlist browsing, and load order submission. Submissions arrive through a
GitHub issue form; a workflow validates the order, regenerates the masterlist
and opens a pull request for review.

Not yet built: user overrides that survive masterlist updates, and a desktop
build that reads `modsettings.lsx` directly.

## Credits

Load order dividers by
[Astralities](https://forums.nexusmods.com/profile/106303673-astralities/),
who made Astra's Load Order Dividers for their own playthroughs and gave
permission to include and adapt the set here. The divider paks in
`public/downloads/astras-dividers.zip` are their work; VOLO recognises them by
UUID on import and can reinsert them on export.

## Licence

MIT. The divider paks remain Astralities' work, used with permission.
