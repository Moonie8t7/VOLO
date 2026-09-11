# Design direction

What VOLO's interface is modelled on, what was taken from it, what was left
out, and the rules that settle a judgement call. When a component and this
file disagree, one of them is wrong and gets changed.

## The source

The official Baldur's Gate 3 site at baldursgate3.game. Its compiled
stylesheets sit under `_nuxt`, one file per component, and the file names are
the vocabulary: `border`, `divider`, `cardFrame`, `frameSimple`,
`merchFrame`, `selectFrame`, `buttonDiamond`, `buttonSimple`, `banner`,
`bannerSimple`, `newsListingItemFrame`, `SubpageHero`. Framing on that site is
a set of named parts, and that is the main difference between it and a
generic dark site.

Two techniques do most of the work.

**The two-tone bevel.** Its dividers are drawn as `border-top: 1px solid #896d51`
over `border-bottom: 1px solid #553c22`, a light line above and a
dark line below. The pair gives a surface a light source. A single uniform
ring at low opacity, which VOLO had before, does not.

**Edges that taper.** The same divider carries `mask-image:
url(divider_mask_left.svg), url(divider_mask_right.svg)` with
`mask-composite: intersect` and `backdrop-filter: blur(5px)`. The ends are cut
to a point.

The type scale is fluid between two anchors, 970px and 1920px, with
`clamp(48px, 3rem + 12 * (100vw - 970px)/950, 60px)` for h1 down to
`clamp(14px, .875rem + 2 * (100vw - 970px)/950, 16px)` for body.

## What was left out

The gold at scale. The site is a marketing surface for a game and can use
`#c8aa34` across whole sections. VOLO is a tool for fixing a load order, so
gold is limited to highlights.

The illustration, the logo and the key art. These are commissioned work and
identify Larian's product.

The fonts. Quadraat is commercial.

## Track

The landing page is a marketing surface and is judged as one. Masterlist,
Measured, Submit, Export and the optimiser screens are product screens, where
the table is the product and restraint is correct.

## Mood

A ledger kept on a dark desk. Panels are cut into the ground, not floated on
it. Rules are hairlines. The data is the most prominent thing on any screen.

## Palette

Anchored on the charcoal already in use. Every other value comes from the
site.

| Role | Token | Value | Source |
| --- | --- | --- | --- |
| Ground | `--bg3-charcoal` | `#161411` | already in use |
| Panel | `--bg3-panel` | `#24211A` | already in use |
| Bevel light | `--bg3-bevel-light` | `#896d51` | BG3 divider top |
| Bevel dark | `--bg3-bevel-dark` | `#553c22` | BG3 divider bottom |
| Rule | `--bg3-border` | `#B4906D` | BG3 `#b1906a` |
| Heading | `--bg3-header` | `#FDE5CD` | already in use |
| Body | `--bg3-main` | `#CFCFCE` | already in use |
| Subhead | `--bg3-small` | `#FBCEA0` | BG3 `#fbcea0` |
| Highlight | `--bg3-gold` | `#D7A869` | BG3 `#c8aa34` family |
| Warning | `--bg3-clay` | `#B15A4A` | already in use |
| Danger | `--bg3-red` | `#CF3939` | BG3 |
| Good | `--bg3-green` | `#008951` | BG3 |

The status colours were Tailwind's defaults, `38 92% 50%` amber and
`142 76% 36%` green. They now come from the site.

Gold is a highlight and never a surface. A screen with gold in more than a
few places has used it up.

## Type

| Role | Face | Why |
| --- | --- | --- |
| Titles, eyebrow labels, navigation, button labels | EB Garamond | Self-hosted as a variable font. Quadraat is commercial and Garamond is the closest humanist serif that can be shipped. |
| Body copy, interface and data | Gothic A1 | The site sets every paragraph in Gothic A1 at 65 percent white under serif titles. It is free. |

This split comes from the site's stylesheets. An earlier version of this
table put prose in the serif, and the pages looked like a book where the site
looks like a site. Eyebrow labels are the serif at 13px, uppercase, tracked
0.22em, in the subhead colour. Italic and emphasis stay in the serif because
the sans has no italic.

The scale is fluid on the site's formula, anchored between 970px and 1920px.

## Contrast

Body and heading text sit on charcoal or panel and clear 4.5:1. Gold on
charcoal is used for text at 18px and above, or for marks, never for body
copy. Every state that uses red or green also carries a word or a mark,
because some readers cannot separate those two colours.

## Shape

No border radius anywhere. The site uses none, and VOLO sets `--radius: 0rem`.

## What was removed and what replaced it

**Two soft radial blobs on the body.** Replaced by the site's smoke texture,
fixed behind the whole page (see the ground, below).

**Uniform hairline rings.** Replaced by the bevel and by the site's frame
files.

**Drop shadows.** The site uses none. Depth comes from the bevel and from the
smoke going darker at the edges.

**Arrow icons on buttons.** A right arrow sat on both calls to action and on
nine product-page buttons. The house rule on arrows covers icons as well as
characters, and the site's primary button has no icon.

**A diagonal wash from charcoal to coffee.** It sat on the hero and the
sidebar. The site uses gradients on lines, on text fills, on the button hover
and as black fades over imagery. It never uses one as a coloured surface.

## House rules that override anything here

These are standing instructions for the project. They win against any
aesthetic argument.

**Nothing says what it was written with.** No tool names and no wording that
sounds machine-written, in a commit message, a pull request, a code comment,
a document or anything published. `scripts/audit-repo.mjs` checks every
tracked file and fails the build.

**No em dash, no en dash, no arrows, no emoji, no non-standard characters** in
anything this project writes. Hyphens, commas, colons and full stops only.
This covers user-facing prose and interface glyphs alike.

**Mod names are reproduced exactly as submitted, never tidied.** Punctuation,
capitalisation, spacing and unusual characters stay. Altering one breaks the
match against what a player has installed. Files that reproduce someone else's
text are exempt from the punctuation rules for the same reason, and
`audit-repo.mjs` carries the exemption list.

**`docs/outstanding.md` is never committed.** It is in `.gitignore` on
purpose. Read it, edit it, never stage it or check out over it.

**Do not add another entry-point script.** Fix the shared library or the
existing command instead.

**`node -e` is read only.** It has corrupted regex source in this project by
eating escapes. Use the editing tools for source changes.

## Ownership and the site's files

`TRADEMARKS.md` reserves the VOLO name, logo and visual identity. The code is
MIT and the data is CC0. In the other direction, VOLO is a third party tool
and must not look like an official Larian product.

The original rule was to reproduce geometry and never ship an asset. It held
for two passes: arcs, chamfers, tapers and bevels were built from gradients,
and the cloud from noise. On 11 September 2026 the maintainer compared the
results with the site, judged them ugly, and decided to use the site's own
decorative files. They are under `public/assets/bg3`, in the same folders the
site serves them from: `btn`, `svg`, `faq`, `menu`, `mask`, `jpg`, `png`, 56
files, about 1.25MB. The logo, the key art and the fonts are still not taken.
The brand pack has no usage terms, so the decision carries a risk that has
not been settled, and it is recorded here so nobody takes it for an
oversight. A set of the maintainer's own smoke and hero mask was tried the
same day and withdrawn.

Files that were changed after first being served carry a version suffix
(`about-hero-mask.v3.png`, `cloud-left.v2.png`, `cloud-right.v2.png`,
`cloud-left-flipped.v2.png`), because `public/_headers` caches `/assets/*`
for a year as immutable and a replaced file needs a new name.

## Where the site's assets are

The homepage's network requests show a video, a still and two logos, and
nothing else. That is not the asset list. Open the site, then DevTools,
Sources, Page, `baldursgate3.game`. The static tree is listed by folder.

| Folder | Contents |
| --- | --- |
| `/btn/` | The button system. `diamond-corner-{top,bottom}-{left,right}.svg` are the corner arcs, `diamond-mask-corner-1..4.svg` and `mask-corner-1..4.svg` cut the corners, `mask-triangle-{top,bottom}.svg` the centre notches, `diamond-hover-mask-*.svg` the hover cut-outs, `diamond-hover-texture-{left,right}.png` the hover fill |
| `/svg/` | Frames and rules. `card-corner.svg`, `card-top.svg`, `corner.svg`, `corner-medium.svg`, `divider-deco.svg`, `divider_mask_{left,right}.svg`, `frame-corner-*-mask.svg`, `frame-decor.svg`, `frame-top-element-solid-mask.svg`, `modal-pattern{,-vertical}.svg`, `select-corner-*.svg` |
| `/mask/` | Section blends. `top_v_mask.png`, `bottom_v_mask.png`, `mask-content.png` |
| `/png/` | More masks and washes. `darken-mask.png`, `about-hero-mask.png`, `buy-now-background-mask.png`, `card-background-image-mask.png`, `faq-background-mask.png`, `thumbs-mask.png`, `wallpaper-mask.png`, `smoke-mobile.png` |
| `/jpg/` | Textures. `smoke.jpg`, `texture-button.jpg`, `faq-background.jpg`, `buy-now-background.jpg` |
| `/menu/` | `cloud-left.png`, `cloud-right.png` |
| `/heros/` | `dark-mask.png` |
| `/banners/` | `awards-bg.png`, `awards-mask.png` |
| `/faq/` | `corner-small-{left,right}-{top,bottom}.svg` |
| `/hero/` | `Homepage_All_2.mp4`, `hero-background-video-still.jpg` |

The masks under `/mask/` and `/png/` are how one section blends into the
next. They are painted PNG alpha masks, and a CSS gradient does not match
their edge.

A bare request for any of them returns 403. Fetch them from inside the loaded
page.

## Construction notes

Read from the site's files and stylesheets. Guessing from screenshots was
wrong several times.

**The divider.** `divider.css`: a 6px band, `left: -4vw; width: calc(100% +
8vw)`, so it bleeds past its container. A `divider-body` runs from 30px in to
30px short of the end with `border-top: 1px solid #896d51` and
`border-bottom: 1px solid #553c22`. Inside it a `blur` layer, black at a
quarter opacity with a 5px backdrop blur, is masked by
`divider_mask_left.svg` and `divider_mask_right.svg`, which are
`polygon(2000 0, 3.54626 0, 0 3, 3.54626 6, 2000 6)`: the shadow band tapers
to a point at each end. `divider-deco.svg`, a 30 by 6 lens, sits at each end,
the right one mirrored. The lens is a terminal. It widens from its point to
the band's full height and its top and bottom edges continue as the two
lines. VOLO's `rule-bg3` uses these files and layout, and the landing page
bleeds it 4vw past the column.

**The bevel.** `border-top: 1px solid #896d51` over `border-bottom: 1px solid #553c22`.

**The primary button.** `buttonDiamond.css`. A wrapper 246 by 58 pads a
control 234 by 48 by 6 and 5. The fill is `rgba(0,0,0,0.35)` over
`backdrop-filter: blur(10px)`. The corners are cut by `diamond-mask-corner-1`
to `4`, 800 by 800 tiles pinned to the four corners and composited with
`intersect`, each a concave arc of radius about 17 centred 7 units outside
the corner. `diamond-corner-*.svg` is a 10px arc drawn just inside each cut.
The edge is `1px solid #e1cbb7` along the top and `1px solid #be9775` along
the bottom, with the verticals a gradient between the two. `border-left` and
`border-right` each stop at `calc(50% - 16px)`, so the top and bottom lines
have a 32px gap at centre for a 34 by 10 mark whose middle is a hollow
diamond straddling the line. The side marks are 18 by 8 kites, 6px outside
the edge. The label is Quadraat Demibold 18px, uppercase, white. On hover the
marks fade out, and a flood of `radial-gradient(circle, #fff, #ddc9a7)` with
`diamond-hover-texture-left.png` and `right.png` over it covers the whole
wrapper box, masked by `diamond-hover-mask-decor-top.svg`, `bottom.svg` and
the four `diamond-hover-mask-corner-*.svg` files, so the flood has notches
where the marks were. The label goes black.

VOLO's `chamfer` class applies the four corner masks and draws the edge as
gradient strips on a pseudo-element, with the arcs as background layers.
`btn-chamfer` adds the glass, the serif label and the flood. `btn-diamond` is
the wrapper: its upper pseudo-element carries the four marks and its lower
one carries the flood, and on hover the control's glass and edge go clear so
the flood shows through and the single label reads dark on it. The marks ship
with their bars trimmed off and the edge line runs to the diamond's tips,
because a bar inside an image and a line drawn by CSS land on different
sub-pixels at a fractional device scale. The bottom mark sits one pixel
higher than symmetry would put it, as the site's does.

**The plain button.** `buttonSimple.css` and the `.button` rules: the same
glass with `border: 1px solid #b99b77`, masked by `mask-corner-1` to `4`,
which slit each corner on the diagonal and leave the tip attached, and by
`mask-triangle-top.svg` and `bottom.svg`, a 4px V at the centre of the top
and bottom edges. `texture-button.jpg` fades in on hover. The selector
brackets sit inside the corners. VOLO's outline button uses all of these.

**The selector frame.** `selectFrame.css`: `select-corner-*.svg`, 18 by 18,
an L-bracket with a diamond jog on each arm, in `#b99b77`, one in each
corner; the `select-corner-active-*.svg` set is heavier and paler and marks
the chosen item. VOLO uses the active set on the sidebar's current item and
the plain set on outline buttons.

**The heading rule.** `--deco-line`: one pixel tall, `linear-gradient(90deg, #e0ccb1, #b78f6d)`,
a small hollow diamond at its head and a three unit point
at its tail. The default width is 190px, and every section header overrides
it to `width: 100%` of the text block; banners use 120px and centred lines
keep a fixed width with auto margins. Above a title sits a 13px uppercase
eyebrow tracked 3px in `#fbcea0`. VOLO's `.ruled` does the same: full width
under a left-aligned heading, 190px under a centred one.

**Panel frames.** `merchFrame.css` at its large size: `corner.svg`, 21 by 21,
turned into each corner, top and bottom lines `linear-gradient(90deg, #bf9875, #604b38
50%, #bf9875)` starting 11px in, plain `#bf9875` sides, and
optionally `frame-decor.svg`, 420 by 18, riding the top and bottom edges at
centre with the lines fading out beneath it. `corner.svg` is a one pixel
quarter circle of radius 17 centred on the corner point, with a leaf-shaped
flourish outside the arc. VOLO's `frame-bg3` uses the corner file and the
lines on cards and alerts, and `frame-decor` adds the knotwork on the landing
page's figure.

**Card corners.** `card-corner.svg` is 108 by 108, a band of fine rays
between two arcs filled from `#534c3f` to transparent. It is painted on
`frame__corners` elements that the desktop layout collapses to zero size, so
the desktop page never shows it. An earlier VOLO build reproduced it on every
card and it was removed.

**Gradients.** 124 instances on the homepage, all on lines, text fills, the
button hover, or as black fades over imagery. None is a coloured surface.

**The ground.** `smoke.jpg`, 2880 by 1800 in 78KB, fixed behind the whole
site as the `.smoke` layer, at cover, fading out over the last sixth;
`smoke-mobile.png` on narrow screens. It is a warm brown, hue 30, saturation
0.37, with a median luminance of 13.6 out of 255 and no grain. VOLO uses the
same file the same way, at 55 percent opacity over the charcoal and with a
2px blur, because the JPEG's compression blocks show once anything brightens
it.

**The hero cloud.** The site masks its hero imagery with
`about-hero-mask.png`, 4040 by 1640, whose alpha eats the sides and the foot
with a grainy, billowed edge, and hangs `cloud-left.png` and
`cloud-right.png` over the top as its menu does: the left cloud in a 433px
box at `left: -3vw`, the right one across the full width from the right, both
at contain. Measured from the mask: the side rims are solid for 4 percent of
the width and gone by 10; the bottom pool is solid for 5 percent of the
height and gone by 24; the billows have periods of about 600, 300 and 240px
at 1440 wide; the grain is 1 to 2px specks. The ink is black at every alpha.

VOLO has no imagery, so the layer the mask eats is `smoke.jpg` lifted to 1.8
brightness with a 3px blur, at 80 percent opacity. The mask is intersected
with two plain feathers, one across and one down, so the layer fades before
any box edge whatever the painted rim does at that height, and it is
stretched to the box because VOLO's hero is shorter than the mask's aspect.
The mask ships at 1600 wide, softened by a Gaussian of 4.5px at source scale,
with its full alpha range. The clouds ship with their palette alpha rewritten
as eight-bit alpha softened by a pixel, and a mirrored copy of the left cloud
sits at the right. The painted spatter looks like noise over a smooth layer
without those softenings; over the site's detailed imagery it does not.

**Type scale.** `clamp(48px, 3rem + 12 * (100vw - 970px)/950, 60px)` at h1,
down through the ratios 48 to 60, 36 to 48, 30 to 36, 24 to 30, 20 to 24, 18
to 20, body 14 to 16. VOLO's hero tagline sits on the h2 step.

**Container.** `.container` is `padding: 0 8vw` at `width: 970px`, `1170px`
and `1410px` by breakpoint, which leaves about 1100px of content at 1900
wide. VOLO's landing page uses `max-w-[1100px]`, with framed elements and
the FAQ grid spanning it and paragraphs held to 62ch. A `ch` is the width
of the zero, 8.9px in Gothic A1 at 16px against an average letter of 7.4px,
so 62ch is about 75 letters a line, the top of the readable range. The
site's news and product copy runs at 58 to 65 in columns of 468px to 494px;
the cap had been 75ch, which measured at 87 to 93 letters, and then 55ch,
which matched the site but left the right half of every text section
empty. Text cannot fill an 1100px container at 16px without running about
140 letters a line, so 62ch is the compromise: as wide as the lines can go
before the eye loses the return.

The site never leaves copy alone at half the width; every text block sits
beside an image, a video or a second column. On 11 September 2026 every
landing section was set that way and most were put back the same day: a
figure at half width was too small to read, the stats band wanted the whole
width, and the support buttons had no reason to stand in a column. One
pairing stayed, the frame demo on the left of "Where the order comes from"
with the copy centred beside it. Headings are set with `text-wrap: balance`
and paragraphs with `text-wrap: pretty`, so a heading never strands one
word and a paragraph never ends on one. No text on the site runs below
12px; the wordmark's expansion did on a phone and was raised.
The hero's paragraph opens with the stakes, mods overriding each other or
never loading, before the promise; without that sentence the page argued
a fix for a problem it never named.

Some things the page does on purpose that a checklist would flag: the
hero is centred because the site's is; the construction colours in the
stylesheet are written as the site's literal values, recorded in this
file, rather than as tokens; the 30px and 15px gaps and the 13px eyebrow
are the site's numbers, not a spacing scale; and section headings run at
the same size as the hero's descriptive line because the site's own
section titles run at 48px under its hero.
**The FAQ.** `faq-item`: a box at least 104px tall; under the content, black
at 35 percent over a 10px backdrop blur with 5px concave corner cuts made
by `mask: radial-gradient(5px at 5px 5px, transparent 98%, #000) -5px -5px`;
over it, unmasked, the four `faq/corner-small-*.svg` ornaments at 94px and
the frame lines. The question is 22px uppercase serif, 35px in, at 85
percent width, with a ring-and-chevron at the right and a 120px deco line
that appears beneath it when open. The answer is Gothic A1 16px on 24px at
65 percent white with 35px side padding. The open item's fill goes to 50
percent with a warm radial glow. Two columns 30px apart, 15px between
items, each column independent. VOLO's landing FAQ is built the same way,
as two accordions sharing one open value.

**The news block.** An eyebrow (13px uppercase serif tracked 3px in
`#fbcea0`), the newest item's title as a 48px uppercase h2 with a deco line
under it, its text in Gothic A1 16px on 24px at 70 percent white, then a
default button and the date in the eyebrow style. Below, cards 570 by 360 in
a carousel, each the FAQ box construction (`box-frame` with the same
`corner-small-*.svg` ornaments and the same blur and corner cuts), padded
24px 0 24px 40px, with the date, a 34px uppercase title, the text at 65
percent, and a plain uppercase text link, `button-simple`, which carries an
arrow. A "Latest submissions" section built on it was tried on 11 September
2026 and removed the same day: its only link led to a GitHub issue, which
is intake output a visitor has no use for, and its cards said the same
sentence three times. The corpus growth chart carries what it was for. The
card frame survives as `box-bg3` and the text link as `link-simple`, without
the arrow, on the chart cards.

**The awards panel.** `content-bg`: black at 35 percent over a 10px backdrop
blur, `banners/awards-bg.png` (an ink wash, 1767 by 300) at cover along the
bottom, corners cut by a 16px radial mask; inside it, 10px in, the merch
frame with its knotwork; content padded 40px, a label block (eyebrow and a
56px uppercase h2) at the left with 60px after it, then the row of items;
`banners/awards-mask.png`, a smoke puff 97 wide, over the right edge and
past the top and bottom. VOLO's `panel-bg3` is that panel without the wash
and the puff, wrapping `frame-bg3 frame-decor`, and carries the four figures
under "How much to trust it": mods in the masterlist, orders submitted,
held-out agreement against chance, and catalogue listings read. The wash
and the puff were shipped for a few hours on 11 September 2026 and removed:
on the site the panel sits under the hero video and the wash contrasts with
the still above it, but on the smoke ground it is the same warm brown and
the panel stopped reading as a surface. The `banners` files went with them.
The panel runs the width of the page, the label block at the left and the
four tiles in a row, each figure above its label so a wrapped label cannot
push a figure out of line with its neighbour.

**The charts.** Two inline SVGs in `box-bg3` cards, 30px apart: orders
landed by ISO week as columns, and placement sources as horizontal bars.
Their vocabulary is Larian's first anniversary infographics, which the
maintainer supplied as the guide on 11 September 2026: bars of mottled
parchment darkening towards the foot, each with a bright cap line a little
wider than the bar and its figure above; dotted gridlines in the gold, a dot
at one end and the tick values along the right or the foot; titles in the
serif with the last words in gold and a small sans line under them naming
the unit; figures set large in the serif. The parchment is the site's own
`texture-button.jpg`, the button hover material, as an SVG pattern under a
gradient shade; the shade is the one gradient surface on the page and is
there because the infographics' bars are shaded, which the site's flat
rule does not cover. Square bar ends. Only the tallest and the newest
column carry a figure; every bar of the source chart does, because the
smallest are a pixel wide. Each bar has a `title` for hover and each
chart a table behind a toggle. The data is written by the miner into the
summary (`weekly`, with every week present, `undated`, `latest`,
`placements`), so no figure on the page is typed by hand.

## The brand pack

A press pack downloaded from Larian, kept outside the repository in the
maintainer's Downloads folder as `BG3 Brand Pack`. Five archives: two press
kits, key art and logos, and two videos. No archive contains a usage terms
document.

The useful part is the in-game UI screenshots in the release day press kit,
`Screenshots/UI 7.png`, `UI 11.png` and `INVENTORY.png`. Two decisions came
from them.

**Panels are darker than the ground.** Every panel in the inventory screen is
near black against a warmer surround. VOLO had `--card` lighter than
`--background`, the convention component libraries ship.

**Focus is marked by corner ornament, not by a fill.** The active character
panel has gold filigree at its corners and the same background as the others.

The screenshots also show names in the serif and every stat and counter in
the sans.

## Branch and preview

All of this work was done on `design/bg3-material`, kept off `main` until
it was judged against the site in the browser, and merged into `main` on
11 September 2026.

| What | Where |
| --- | --- |
| Branch | `design/bg3-material` |
| Pull request | #175 |
| Preview | `https://design-bg3-material.volo-bg3.pages.dev` |
| Production | `volobg3.com`, built from `main` |

Cloudflare Pages builds every branch, so a design branch has a real build
at its own alias before anything reaches production.

Checking a change before it is pushed:

```text
npx vite build && node scripts/prerender.mjs     builds dist without regenerating the masterlist
node scripts/serve-dist.mjs                       serves dist on http://localhost:4180
npm test                                          smoke-test.mjs then audit-repo.mjs
```

Look at the rendered page. Several rounds of this work shipped changes that
were invisible because the reasoning was done against stylesheets. Screenshot
the local build and the site and compare them.

`npm run build` regenerates the masterlist and leaves `masterlist/`,
`public/bg3-masterlist.json`, `client/src/lib/masterlist-summary.json` and
`public/sitemap.xml` modified with new timestamps. Revert those before
committing a design change.

## Mistakes made on this branch

Each cost a round trip.

**Material applied where nothing used it.** The bevel went into a
`shadow-bg3` class used in thirteen places, none of them the `Card` component
every page renders. Put surface changes on the primitives in
`client/src/components/ui/`.

**A font shipped that nothing rendered.** Gothic A1 was loaded at 30KB and
applied to a `font-ui` class used in zero files.

**A type scale that never applied.** Fluid sizes were set on bare `h1` to
`h6` while forty-nine headings carried Tailwind size utilities that override
them.

**A border cut by its own clip-path.** The chamfered button's edge was drawn
as an inset ring and the clip removed it along the four diagonals. The
construction now masks the element and draws the edge inside the mask.

**An edge showing through the fill.** With the edge painted as a solid tan
octagon and a translucent fill over it, tan showed through the whole face and
the button came out lighter than its ground. A translucent fill can only sit
on something transparent.

**A colour read off the wrong element.** The label's bronze came from the
site's wrapper anchor, `#c19976`. The label inside it is white. Read computed
styles from the element that carries the text.

**A gap with nothing in it.** The edge lines broke at centre for a diamond
that only the landing page's wrapper draws, so every other button had a gap.
The gap is now opened by the wrapper only.

**A mask measured from the border box** while the edge was drawn in the
padding box, so any chamfered element with a border had the two a pixel
apart. Both are measured from the padding box now.

**A bar in an image beside a line in CSS.** The mark's bars and the edge line
share a row at integer device scales and drift apart at fractional ones. The
bars are trimmed off the marks and the line runs to the diamond.

**A replaced file with the same name.** `/assets/*` is served with a one year
immutable cache, so overwriting a file in place changes nothing for anyone
who has fetched it. Every replaced file gets a version suffix.

**A mask shipped at half size with 64 alpha levels.** The stipple turned into
dither and the quantisation saved no weight. The full range is kept.

**A lifted JPEG.** Brightening `smoke.jpg` two stops made its 8 by 8
compression blocks visible. A 3px blur removes them.

**A rule cancelled by its own component.** The rebuilt divider showed
nothing because the Separator primitive carried a `bg-none` utility, and its
`bg-border` base would have tinted the band. Utilities on a primitive beat the
stylesheet.

**Ornaments painted behind the thing they decorate.** Background images on
the wrapper never appeared because the control on top was opaque. The marks
go on the wrapper's pseudo-elements above the control, and the wrapper is
padded so they have room.

**Screenshots at the wrong width.** The driven browser reported 720 CSS
pixels at a device pixel ratio of 2 while its screenshots came out 1440 wide,
so several rounds compared tablet layouts and misread the fluid type scale.
Check `window.innerWidth` before trusting a capture. The browser is one the
maintainer watches; a document zoom set for a close-up shows on their screen.
