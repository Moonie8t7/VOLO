# VOLO

Verified Order and Load Optimisation: a community-curated load order tool for
**Baldur's Gate 3**, in the spirit of [LOOT](https://loot.github.io/) for Bethesda
titles.

Drop in your BG3 Mod Manager export and VOLO sorts it against a community
masterlist, resolving declared dependencies, grouping mods by what they do, and
explaining every placement. It supports mods from Nexus Mods and from mod.io,
the platform behind the official in-game mod manager at baldursgate3.game, with
reference catalogues of both kept fresh by a daily crawl.

It runs entirely in your browser. There is no server, no account and no upload.
Your load order never leaves your machine.

## How it works

1. **Import.** Reads BG3MM exports in both the short and full-metadata forms, plus
   CSV, TSV and plain text. Section separators you have written yourself are
   recognised and used as categorisation hints, as are Astra's Load Order
   Dividers, which VOLO knows by UUID even when they have been renamed.
2. **Sort.** Astra's Load Order Dividers give the order its shape: their
   sequence decides which section a mod belongs in, and within a section the
   masterlist decides, learned from where working orders actually put things.
   Declared dependencies are hard constraints and can override both. Mods the
   community has never placed fall back to name patterns, and anything still
   unknown sorts to the end.
3. **Explain.** Every mod tells you why it sits where it does.
4. **Export.** Back to BG3MM, or as JSON, CSV, text or Markdown.

The sort is Kahn's algorithm with the ready set ordered by divider, then group
rank, then original position. That last detail matters: a sorter that reshuffles
a working load order without cause is worse than useless, so VOLO moves mods
only when a rule requires it.

Sorting 1,000 mods takes about 3ms.

## The masterlist

`masterlist/bg3-masterlist.json` covers **just over 3,000 mods**, built from the
load orders the community submitted. Around 1,600 were categorised from section
headers modders wrote in their own orders, 546 from name patterns, 157 inferred
from where they sit relative to their neighbours, and 650 are not categorised
at all yet.

See `masterlist/coverage-report.md` for a breakdown of what is known versus
guessed.

Ordering rules are deliberately conservative. Hard edges come from dependencies
declared in `.pak` metadata, plus author-declared requirements from the Nexus
and mod.io catalogues where both ends resolve to a mod we know, optional-sounding
entries are excluded, and the corpus does not contradict the direction. Pairwise
ordering mined from a handful of submitted orders overfits badly, encoding one
player's habits as everyone's rules, so it is not published until there is
enough data for it to mean something.

Listing categories were tried as a fallback for uncategorised mods and removed:
held-out measurement showed them making the sort worse, because what a mod *is*
is a different question from where it *loads*.

### Contributing

Submit an order at [volobg3.com/submit](https://volobg3.com/submit). No account
needed; it opens an issue here on your behalf, and orders that validate cleanly
and leave the verification metric intact land automatically.

The most useful thing you can send is an order you have **actually played on**,
working or broken, ideally the full BG3MM export (File, then Export Order to
File), which carries the dependency and version metadata the short export does
not. Send it untouched: dividers and section headers are evidence too.

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
scripts/            corpus miner, crawlers, evaluation and intake
public/             static assets, including the published masterlist
```

### Deployment

The build produces static files in `dist/`, servable from any CDN. Routing is
client side, so the host needs a rewrite rule sending all paths to `index.html`,
otherwise a refresh on `/optimise` returns a 404.

## Status

Working: import from every BG3MM format plus the game's own `modsettings.lsx`,
sort with explanations and confidence scores, export back to either, masterlist
browsing, and submission straight from the site. A workflow validates each
submission, rebuilds the masterlist and either lands it or opens a pull request
for review.

Measured on held-out orders, VOLO agrees with orders it has never seen 60.3
percent of the time, against 50.5 percent for a random shuffle. See
`scripts/verify-holdout.mjs`; the in-sample figure that `verify-order.mjs`
prints is several points higher and should not be quoted.

That figure is a deliberate trade. Ordering purely by the sequence learned from
the corpus measures 63.6 percent, but produces exports whose divider headings
run out of numeric order and read as scrambled. The divider skeleton costs
about three points of agreement and returns a structure players already know.
Part of the gap is also an artefact: the learned sequence was derived from all
nine working orders and is fixed across folds, while Astra's taxonomy had no
such exposure, so the comparison flatters the learned order by an unmeasured
amount.

Not yet built: user overrides that survive masterlist updates, and placement for
the mods still showing as `unsorted`.

## Credits

Load order dividers by
[Astralities](https://forums.nexusmods.com/profile/106303673-astralities/),
who made Astra's Load Order Dividers for their own playthroughs and gave
permission to include and adapt the set here. The divider paks in
`public/downloads/astras-dividers.zip` are their work; VOLO recognises them by
UUID on import and can reinsert them on export.

## Licence

VOLO is licensed in parts, because the code and the data want different terms.

| Part | Licence | Where |
|---|---|---|
| Application code | MIT | `LICENSE` |
| Masterlist and submitted corpus | CC0-1.0 | `masterlist/LICENSE` |
| Documentation | CC BY 4.0 | this file and `masterlist/README.md` |
| Name, logo, visual identity | All rights reserved | `TRADEMARKS.md` |
| Third party components | Their own terms | `NOTICE` |

The data is CC0 on purpose. Load order information is more useful as shared
infrastructure than as anyone's property, and it was contributed by players so
that everyone sorts better; another BG3 tool is welcome to take the masterlist
wholesale. What is not licensed is the project's identity, so a fork can use
everything here but should not present itself as VOLO. See `TRADEMARKS.md`.

MIT rather than GPL because VOLO is a hosted web application, where ordinary
GPL would add friction for contributors and integrations without actually
covering the likeliest copying scenario: someone running a modified copy as a
service, which is not distribution. If preventing that ever matters more than
ease of adoption, AGPL-3.0-or-later is the licence that addresses it, not GPL.
