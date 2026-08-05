# VOLO

Verified Order and Load Optimisation: a community-curated load order tool for
**Baldur's Gate 3**, in the spirit of [LOOT](https://loot.github.io/) for
Bethesda titles.

[volobg3.com](https://volobg3.com)

## What it does

Drop in a BG3 Mod Manager export or the game's own `modsettings.lsx`. VOLO sorts
it against a masterlist built from load orders players actually played on,
resolves declared dependencies, explains every placement, and hands the file
back.

It runs entirely in your browser. There is no server, no account and no upload;
your load order never leaves your machine. Mods from Nexus Mods and from mod.io,
the platform behind the official in-game mod manager, are both supported.

Measured on orders it has never seen, VOLO agrees with them **60.3 percent** of
the time against **50.5 percent** for a random shuffle. It is a sorting aid with
evidence behind it, not an oracle.

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
npm run check      # typecheck
npm test           # the optimiser against the real corpus
npm run build      # regenerate the masterlist, then build to dist/
```

## Documentation

| Document | What it covers |
|---|---|
| [docs/architecture.md](docs/architecture.md) | How the pieces fit together, and what runs where |
| [docs/decisions.md](docs/decisions.md) | What was measured, adopted and rejected |
| [docs/workflow.md](docs/workflow.md) | Scripts, evaluation and the automated pipelines |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Submitting load orders, and the licence split |

## Architecture

```mermaid
flowchart LR
    file[/"Your load order"/] --> parser["Parse"]
    parser --> sort["Sort"]
    masterlist[("Masterlist")] --> sort
    sort --> out[/"Sorted order"/]
    out -.->|"you choose to submit"| queue["Submission queue"]
    queue --> corpus[("Corpus")]
    corpus --> masterlist
```

Placement is decided by evidence, strongest first: declared dependencies, then
curated overrides, then section headers modders wrote themselves, then
neighbour inference, then name patterns. Anything still unknown keeps its place
rather than being guessed at. Astra's Load Order Dividers give the order its
skeleton; the sequence learned from working orders decides within each section.

Full detail in [docs/architecture.md](docs/architecture.md).

## The masterlist

`masterlist/bg3-masterlist.json` covers just over 3,000 mods, built from
submitted orders. Around 1,600 were categorised from section headers modders
wrote in their own orders, 546 from name patterns, 157 inferred from their
neighbours, and 650 are not categorised yet.

See [masterlist/coverage-report.md](masterlist/coverage-report.md) for what is
known versus guessed, and [masterlist/README.md](masterlist/README.md) for the
data licence.

## Known constraints

Nine working orders is a small corpus, and it is the binding constraint on
quality rather than the algorithm. Four plausible improvements have measured
*worse* than doing nothing, all recorded in
[docs/decisions.md](docs/decisions.md). More submissions beat more cleverness.

650 mods have no category. Almost all appeared in exactly one submitted order,
so there is nothing to infer from.

The sort has never been validated against the game itself. Every check is
against VOLO's own parser, which is circular. Loading an exported
`modsettings.lsx` in BG3 remains the outstanding test.

## Licence

VOLO is licensed in parts, because the code and the data want different terms.

| Part | Licence | Where |
|---|---|---|
| Application code | MIT | [LICENSE](LICENSE) |
| Masterlist and submitted corpus | CC0-1.0 | [masterlist/LICENSE](masterlist/LICENSE) |
| Documentation | CC BY 4.0 | this file and `docs/` |
| Name, logo, visual identity | All rights reserved | [TRADEMARKS.md](TRADEMARKS.md) |
| Third party components | Their own terms | [NOTICE](NOTICE) |

The data is CC0 deliberately. Load order information is more useful as shared
infrastructure than as anyone's property, and players contributed it so that
everyone sorts better; another BG3 tool is welcome to take the masterlist
wholesale. What is not licensed is the project's identity, so a fork can use
everything here but should not present itself as VOLO.

MIT rather than GPL because VOLO is a hosted web application, where ordinary GPL
adds friction for contributors without covering the likeliest copying scenario:
someone running a modified copy as a service, which is not distribution. If
preventing that ever matters more than ease of adoption, the licence that
addresses it is AGPL-3.0-or-later, not GPL.

## Credits

Load order dividers by
[Astralities](https://forums.nexusmods.com/profile/106303673-astralities/), who
made Astra's Load Order Dividers for their own playthroughs and gave permission
to include and adapt the set here. The divider paks in
`public/downloads/astras-dividers.zip` are their work.

VOLO is an independent community project, not affiliated with Larian Studios,
Nexus Mods or mod.io.
