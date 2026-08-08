# Contributing to VOLO

The most valuable thing you can contribute is a load order you have actually
played on. Everything the sorter knows was learned from those.

## Submitting a load order

Go to [volobg3.com/submit](https://volobg3.com/submit). No GitHub account
needed; the site opens an issue on your behalf, a workflow validates the order,
and orders that validate cleanly and leave the verification metric intact land
automatically.

Send the file untouched, a BG3 Mod Manager export or the game's own
`modsettings.lsx`. The full BG3MM export (File, then Export Order to File)
carries dependency and version data the short one does not, and dividers and
section headers are evidence in their own right, so tidying up before
submitting throws away half of what we learn.

Broken orders are wanted too. They teach the warnings, and the report you get
back diagnoses where your order disagrees with orders known to work.

## Contributing a rule

Some knowledge never appears in a load order: that two mods must not be
installed together, that a patcher belongs at position 105 whatever the data
says, that a particular mod deserves a warning. Those live in
[masterlist/curated-rules.json](masterlist/curated-rules.json), and a pull
request against that file is the most direct way to teach VOLO something a
thousand submissions could not.

Placement and warning rules carry a reason and examples their pattern must
match, and loading fails if a pattern misses its own examples, because a rule
that silently stopped applying is how a patcher spent months filed as a
library. Keep the examples current: a pattern whose examples still pass but
whose mod has been renamed matches nothing real, and only a person notices
that. Incompatibilities are checked for shape, a `why` and at least two mods;
whether the claim is true is on you. State only what you know, not what you
infer from a crash: the file is public and it names other people's work.

### A rule, from symptom to merged

Suppose a framework keeps sorting as ordinary gameplay when other mods need
it in place first. This rule, already in the file, is the whole fix:

```json
{
  "pattern": "item\\s*shipment\\s*framework",
  "group": "Resources",
  "divider": 15,
  "why": "A framework other mods deliver items through.",
  "examples": ["AV Item Shipment Framework", "Item Shipment Framework"]
}
```

Each field earns its place. The `pattern` is a case-insensitive regex matched
against mod names; keep it tight enough that no unrelated mod is caught,
because a rule that overreaches files somebody else's work wrongly. The
`divider` names an exact slot on the skeleton (15 is Scripts, Frameworks; the
full list is in `masterlist/separator-mods.json`), and `group` is the coarse
category it reports as. The `why` is shown to maintainers and has to justify
the claim. The `examples` are real mod names the pattern must match, and they
are what keeps the rule alive: `npm test` fails the moment the pattern stops
matching them, so a rule cannot rot silently.

Run `npm test` before opening the pull request. A reviewer will check two
things the machine cannot: that the reason is true, and that the pattern will
not catch mods it should leave alone.

## Licensing of contributions

VOLO is split deliberately, so please note which half you are contributing to.

**Code.** By submitting a code contribution you agree that it is licensed under
the MIT Licence, as in `LICENSE`.

**Masterlist data, load orders, rules and metadata.** By submitting these you
agree that your contribution is made available under
[CC0 1.0 Universal](masterlist/LICENSE), waiving copyright and related rights
as far as the law allows. Submitted load orders are published in
`Load Orders - Public Submitted/` and are public.

**Documentation.** Prose contributed to the README and other docs is made
available under CC BY 4.0.

In every case you confirm that you have the right to submit the contribution.

## What not to paste in

VOLO cannot place other people's writing under CC0, so please do not copy
substantial text from Nexus Mods descriptions, Discord posts, guides or other
masterlists. Link to the source and write a short factual summary in your own
words instead.

Factual entries are what the masterlist wants:

```json
{
  "name": "Example Mod",
  "group": "Spells",
  "dependencies": [{ "name": "CommunityLibrary" }]
}
```

## Working on the code

```bash
npm install
npm run dev        # http://localhost:5173
npm run check      # typecheck
npm test           # the optimiser against the real corpus, then every tracked file
npm run build      # regenerate the masterlist, then build
```

Two things to know before changing how sorting works:

`npm test` asserts the properties the sort promises: nothing lost, dependencies
never violated, divider order holds except where dependencies force otherwise,
deterministic, and fast.

`node scripts/verify-holdout.mjs` is the honest measure of quality. It rebuilds
the masterlist once per working order with that order left out, sorts it, and
reports agreement. Run it before and after anything that touches placement, and
quote that number rather than the higher one `verify-order.mjs` prints, which
scores against orders the masterlist has already read.

Several plausible ideas have been measured and rejected on that basis. They are
recorded in [docs/decisions.md](docs/decisions.md). Measure first.

## One rule that will bite you

Never normalise a mod name. They are reproduced exactly, punctuation and all,
because they are matched against what players have installed; tidying one up
silently drops that mod from sorting.
