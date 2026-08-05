# Architecture

VOLO is a static site with no backend. Sorting happens in the browser; the only
server-side code is one Cloudflare Pages Function that opens a GitHub issue on a
submitter's behalf.

## The shape of it

```mermaid
flowchart TD
    subgraph browser["Browser, where sorting happens"]
        file[/"BG3MM export<br/>or modsettings.lsx"/] --> parser["parser.ts"]
        parser --> optimiser["optimiser.ts"]
        masterlist[("bg3-masterlist.json")] --> optimiser
        dividers[("dividers.json")] --> optimiser
        optimiser --> exporter["exporter.ts"]
        exporter --> out[/"Sorted order,<br/>back to disk"/]
    end

    subgraph cloudflare["Cloudflare Pages"]
        static["Static site"]
        fn["/api/submit"]
    end

    subgraph github["GitHub Actions"]
        intake["Process submission"]
        regen["Regenerate masterlist"]
        crawl["Catalogue crawl"]
    end

    optimiser -.-> fn
    fn --> intake
    intake --> corpus[("Load Orders<br/>Public Submitted")]
    corpus --> regen
    regen --> masterlist
    crawl --> catalogues[("nexus/ and modio/<br/>catalogues")]
    catalogues --> regen
    masterlist --> static
    static --> browser
```

## Where the order comes from

Placement is decided by evidence, strongest first. Anything a stronger tier
settles is never revisited by a weaker one.

```mermaid
flowchart LR
    A["Declared dependencies<br/>hard constraints"] --> B["Curated overrides"]
    B --> C["Section headers<br/>written by modders"]
    C --> D["Neighbour inference<br/>with confidence"]
    D --> E["Name patterns"]
    E --> F["Uncategorised<br/>sorts to the end"]
```

Within that, the sequence itself comes from two sources. Astra's Load Order
Dividers provide the skeleton: their numbering decides which section a mod
belongs in. Inside a section, the order learned from submitted working orders
decides. Declared dependencies are graph edges and can override both.

## The client

| File | Responsibility |
|---|---|
| `client/src/lib/parser.ts` | Reads every supported format into a common shape. Never throws. |
| `client/src/lib/optimiser.ts` | Kahn's algorithm over the dependency graph. Pure, no I/O. |
| `client/src/lib/exporter.ts` | Writes BG3MM JSON, modsettings.lsx, CSV, text, Markdown. |
| `client/src/lib/masterlist.ts` | Fetches the masterlist. Degrades to the bundled copy. |
| `client/src/lib/store.tsx` | Session state. Persists only if the user opts in. |
| `client/src/lib/submit.ts` | Posts a submission to `/api/submit`. |

The sort runs in O(V + E). A thousand mods take about three milliseconds, which
matters because an earlier hosted version timed out and was misdiagnosed as a
data-size problem.

## What runs on a schedule

| Workflow | Trigger | What it does |
|---|---|---|
| Catalogue crawl | Daily 04:20 UTC | Crawls Nexus and mod.io, rebuilds derived data, commits |
| Process submission | A labelled issue | Validates, gates, then lands it or opens a pull request |
| Regenerate masterlist | Corpus change on main | Rebuilds the masterlist from the whole corpus |

All three share a `masterlist` concurrency group, so two runs can never
regenerate over each other.

## Why there is no backend

An earlier version fetched mod pages per request, which meant a thousand-mod
list spent about eighteen minutes on network calls and rate limits. Everything
external is now crawled ahead of time into committed JSON, so a user's browser
makes no third-party requests at all. See [decisions.md](decisions.md).
