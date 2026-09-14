# Improvement log

One entry per cycle. Read this before starting a new one, then check its claims
against the actual product rather than trusting them.

---

## Cycle 8 — 2026-09-13 · The Labs family look

### Why this

Cartonry is one of seven products on labs.johnjayasankar.com, and it was the
last one still dressed as its own thing: system fonts, a cool grey ground and a
teal tile. The other six now share one foundation (a porcelain ground, forest
ink, Inter and IBM Plex Mono, pills and rounded cards) while each keeps its own
accent and its own layout. This cycle brings Cartonry into that family without
moving a control or losing a function. Teal stays Cartonry's accent, and the
drawing's layer colours are untouched: on a drawing, colour means layer.

### Delivered

**Type.** Inter for the interface and IBM Plex Mono for figures, served from
`fonts/` (78 KB for three files) so the CSP's `default-src 'self'` already
covers them. The tool page preloads the two it shows first, and the service
worker pre-caches all three, so the offline tool looks the same as the online
one. Plex Mono is here in 400 and 500 only, so no monospaced rule asks for more
than 500 and the browser never fakes a bold, with one deliberate exception: the
best value in a comparison column.

**Colour.** Porcelain `#f8f6f1` with the family's dot grid and forest ink, and
one rule for controls: what commits or switches (the primary button, the
pressed segment, a layer chip that is on) is forest in light and mint in dark.
Teal marks links, the selected style, focus, and the pack and tile drawings.
Dark mode is the family's forest night, still applied twice so the theme toggle
wins in both directions. Errors and confirmations became tokens (`--bad`,
`--good`), which retired four dark-only override rules.

**Shape.** A segmented control is a track with a pill that moves; buttons,
chips, badges and the header links are pills; cards are 14px and dialogs 18px.
All of it still goes through the radius scale, which gained `--r-lg`.

**Labels.** Panel headings, title-block labels, the picker's family headings,
table headings and the pack labels are small mono capitals, the family's
caption register.

**Brand.** The header mark, the favicon and every guide page use the family
tile with Cartonry's box on it: the body in off-white, the lid in mint. Every
footer carries the family credit line. `og.png` is new, a 1200 × 630 link
preview built from a real capture of the generator, referenced by absolute URL.

**What the host serves.** A `.vercelignore` keeps `docs/`, `research/`,
`test/`, `tools/`, `samples/`, this log and `devserver.py` off the live site.
The owner notes, research, tests, build tools and this log were all being
served as public pages on the product's domain. They stay in the repository. A
`.gitignore` now keeps `.DS_Store` out of commits, and the one that had been
committed is removed. The asset version is 76.

### Bugs found

1. **The catalogue's badges spanned the row.** `.related span{display:block}`
   exists to drop each description under its style name, and it caught the case
   code and the Free badge as well: `0201` sat on a line of its own and "Free"
   was a box as wide as the list. Both sit beside the name now.
2. **The legal pages asked for a favicon that does not exist.** Neither linked
   an icon, so every visit requested `/favicon.ico` and got a 404. Both link the
   SVG now, and their two inline style attributes moved into the sheet.
3. **"(true scale)" was 2.63:1** on the PDF button, teal at 60% opacity. As ink
   at the same opacity it is 4.77:1, and 6.06:1 in dark.

### The second pass, on my own work

**The first after pass photographed the old tile** on the tool page: the edit
to its head landed and the edit to its header did not. A search for the old
teal caught it, and the pass was stopped and rerun.

**The first light screenshots were dark.** A headless browser follows the
machine's own appearance unless told otherwise, so every job now sets its
colour scheme explicitly.

**The pills cost width on the smallest screens.** The header overflowed a 360px
screen by 3px and the Compare segment lost 2px at 320px. The phone header's
link padding is tighter and the segments close up below 640px.

### Verified

- **403 tests green.** The stylesheet guards (the type scale, the radius scale,
  every token defined and used in both directions, no orphan classes, no inline
  styles) all hold on the new sheet.
- **No selector lost.** Indexed against the old sheet, every selector survives
  except the four dark `.msg` overrides that tokens replaced, and no kept rule
  lost a layout property.
- **Before and after in fresh browser profiles**: desktop and a 390px phone,
  light and dark, every view (dieline, 3D, sheet, compare, pack), the inspector,
  print at home, shortcuts, an error, a paid style with board cautions, a guide
  page, the legal pages and print media. **No console messages** and no CSP
  violations.
- **Layout**: 10 widths from 1440 to 320, 7 states each, in millimetres and
  inches. Clean from 1440 down to 360, where the header had overflowed by 6px
  before. 320 still overflows, by 37px where it was 47px, for the same reasons.
- **Contrast**: every enabled text element is AA in both themes, apart from
  the ones that were already below it: the drawings' own lettering at 3.0 to
  3.1:1 and the breadcrumb's decorative "›". Disabled export buttons rose from
  2.01:1 to 2.97:1.
- **Offline**: all 35 pre-cached URLs resolve and all three faces load.
- **What the host serves**, through a local server that applies `.vercelignore`
  and `vercel.json`: pages, modules, fonts and icons return 200, and every
  ignored folder and file returns 404. The CSP is unchanged.
- **The dormant states**: the store open (the Buy link as a pill) and a
  licensed browser, rendered from `app.js`'s own templates.

### Limitations

- **320px was already broken and still is**: the header is too wide and the
  parts schedule overflows. The fix is a different header on the smallest
  phones, which is a design decision rather than a restyle.
- **The drawing's lettering is 3:1.** Panel names and dimensions are drawn by
  the exporter in a mid grey; changing that changes the exported files too.
- **The guide pages' nav sits beside the logo**, as it did: the tool page's
  `header.site nav{margin-left:0}` applies to them as well.
- **`og:image` points at cartonry.vercel.app.** On a custom domain it needs the
  new address.
- **`.vercelignore` covers Vercel only.** On Cloudflare Pages or Netlify those
  folders would still be served.

### Highest-value opportunities next

1. **The smallest phones.** A header that fits below 360px, and a parts
   schedule that stacks instead of overflowing.
2. **Cycle 7's list stands**: the schedule on the spec sheet, rotating the
   drawing on a phone, and giving the reference content its own pages. Milestone
   D is still owner-blocked, and nothing has been printed and folded.

---

## Cycle 7 — 2026-09-08 · A drawing you can point at, and room to draw it

### Why this

Two things were true of the home page. The drawing — the thing the product is
for — was rendered 812px wide inside a 1240px shell on a 1440px screen, with
260px of the window left empty; the shell was a *reading* measure applied to a
drawing board. And the drawing was inert: it knew the name and size of every
panel, and had known all along, but the only way to ask was to read a list of
scalars under a heading. The single most-asked question in the Help is *"which
dimensions do I enter?"*, answered by prose beside a picture you could not
interrogate.

### Delivered

**`src/regions.js` — the named parts of a blank.** `annotations()` has always
lettered panels from the fold engine's own net; this hands that same net to the
interface as measured polygons. No new geometry: the net's bounds match the
drawn blank exactly on all ten foldable styles, which is what makes an overlay
possible at all.

**The parts schedule.** A regular slotted container has thirteen regions but
only **seven parts** — four of its flaps are the same flap. `partsOf()` groups by
kind and size, so a hexagon's six faces collapse to `Face ×6` while keeping
their own names on the drawing. It reads body-first: panels, then flaps, then
the glue tab, biggest first. This is the schedule a converter actually reads.

**The drawing and the schedule point at each other.** Hover, tap or focus a row
and its parts light up on the blank; point at the blank and the row lights up.
A callout names the part and gives its size next to the part itself. Arrow keys
walk the schedule, Home/End jump, Enter pins a part so it stays lit while you
look away, and every row carries an `aria-label` — *"Side, 2 of them, panel,
203 × 103 mm"*.

**Selection is tone, not hue.** Colour on this drawing means *layer* — magenta
cuts, blue creases, green glues. A sixth colour competing for that meaning would
cost more than it bought, so a selected part gets a wash of ink, the way you
would lay tracing paper over it. In dark mode it is a veil of light instead.

**The shell follows the screen.** 1240px → 1480px, and the drawing went from
812 × 300 to **1012 × 374 — 1.55× the area** at 1440px. The prose inside it
stays at 70ch, because that *is* a reading measure and it was right all along.

### Bugs found

1. **Five of the hexagon's six faces had no name.** `label: i === 0 ? 'Face' : ''`
   was a reasonable call for drawn labels and a bad one for anything else: the
   drawing had been lettering one face and leaving five blank, so artwork could
   not be placed against a named face. Found by a test asserting every region is
   named. They are `Face 1`–`Face 6` now, on the drawing as well.
2. **The readout broke a measurement across two lines** — `200 × 150 ×` / `100
   mm` — at several widths, including every phone. The column minimum had been
   guessed at 180px; measured in place it needs 202px, and 169px of that is an
   imperial outside size in monospace. One per row on a phone.
3. **A lonely fourth cell.** Below the width where four readout cells fit, three
   sat in a row and CALIPER dropped underneath alone. Two-by-two in that band.

### The second pass, on my own work

Two things I built badly the first time:

**The kind markers used the drawing's layer colours** — panel in crease blue,
flap in a paler blue. Wrong twice: a panel is not a crease, and it spent the
drawing's colour vocabulary on something that is not a layer, in the same cycle
where I argued colour must keep meaning layer. They tell panel from flap by
FORM now, filled against hollow. Glue keeps green, because glue really is green
on the drawing.

**I had switched the hit layer off as soon as the drawing became pannable**, so
inspection died at exactly the magnification where you would want to look at a
3 mm slot. The layer stays live at every zoom; a drag is told from a press in
script, so panning no longer pins a part by accident.

Also: the callout read *"Glue GLUE 35 × 103 mm"*. The kind tag is worth having
on a Side and is a stutter on a part whose name already is its kind.

### Verified

- **403 tests green** (up from 393). The nine new region and schedule tests were
  each proved to fail first: a 1 mm overlay offset, a reversed reading order, an
  unnamed region, a dropped part and a double-counted one all fail by name.
- **440 layout combinations** — 11 styles × 5 views × 2 units × 2 themes, at
  1440 and at 375, both themes — **0 findings, 0 console errors**, including new
  assertions that the schedule appears on exactly the ten foldable styles and
  never outside the dieline view.
- **No readout value wraps** at 1440/1280/1100/960, across three box sizes from
  200 × 150 × 100 to 1000 × 700 × 500, in both units.
- **Exports are untouched by the overlay**: with the hit layer in the DOM and
  two regions pinned, the exported SVG and DXF contain no trace of it.
- **Keyboard**: arrows, Home/End and Enter drive the schedule; focus lights the
  drawing.
- **Contrast on a fresh dark load**: every new element 6.6:1 to 15.3:1, AA.
- **Samples rebuilt**: exactly 6 of 77 changed, all hexagon, all from the naming
  fix.

### Limitations

- **The pillow box has no schedule.** It closes by bending and has no fold net,
  so it has no flat panels to name. It reports none rather than inventing them.
- **The page is still long** — about 4,300px on desktop, 8,000px on a phone —
  because the catalogue, pricing and help all live below the tool on one page.
  The tool is above the fold and the content below it is real, so this is a
  structure question, not a bug.
- On a phone a 747 mm blank is 114px tall however the stage is sized: the aspect
  ratio, not the layout, is the constraint. Zoom and pan cover it.

### Highest-value opportunities next

1. **Put the schedule on the spec sheet.** `partsOf()` is pure and already the
   shape of a cut list; the page a converter quotes from does not carry one.
2. **Rotate the drawing on a phone.** A 3:1 blank wastes a portrait screen, and
   a 90° toggle would roughly triple its size. The only real fix for the mobile
   drawing.
3. **Give the reference content its own pages.** Catalogue, pricing and help are
   ~2,800px stacked under the tool; as routes they would each get a considered
   design and the workspace would stop being a preamble to an article.
4. **Milestone D onwards is still owner-blocked** and unchanged: sandbox payment
   needs an account I must not create. Experiment 1 — print four dielines and
   fold them — remains the first unblocked owner action, and nothing has been
   printed and folded.

---

## Cycle 6 — 2026-09-08 · Every style on the board it is actually made from

### Why this

Compare was rendering all eleven styles on whatever board was in the picker. Ask
it to compare a shipping case against a tuck carton and it drew the carton in
3 mm B-flute — a thing no converter makes. The numbers were arithmetically
correct and commercially meaningless, which is the worst combination, because
they look like an answer.

### Delivered

**Each style now declares the board it is made from.** `board: {caliper,
format}` on all eleven: 3 mm corrugated for shipping cases, 1.5 mm for trays and
telescope lids, 0.35 mm carton board for tuck ends, 0.5 mm for sleeves, hexagons
and pillow packs.

**Changing style changes the board only when the *format* changes.** A
converter who has dialled in 4 mm C-flute keeps it when moving RSC → FOL, and
loses it only when moving to a folding carton, where 4 mm is not a board that
exists. Verified both directions.

**Compare draws each style on its own board**, with a Board column, a footnote
naming which styles were substituted and why, and each row's caution beneath it.
At 600 × 400 × 300 the cartons and the sleeve warn that they will be flimsy
while the corrugated cases do not; at 40 × 30 × 25 it inverts. That is the
comparison actually being asked for.

**`test/board.test.js`** — five tests. The one that matters asserts that every
style, on its own declared board, raises none of its own cautions. It bites:
setting the tuck carton to 3 mm corrugated fails with *"At 3 mm the tuck will
not slip inside the front panel cleanly."* The declared boards are not
decoration; they are the values at which each style's own rules are satisfied.

### The second pass, which found the real defect

The first version put each caution inside the style-name cell. Measured rather
than eyeballed: the caution had **123px to wrap in while the table was 875px
wide**, so one sentence became **six lines** and took its row from 41px to
156px. Three of eight rows were quadruple height. A comparison table exists to
be read down a column, and that had stopped being possible.

The caution now gets **its own full-width row** under the row it belongs to —
same tint, no rule between them, shared hover, so the pair still reads as one
row. Rows went from 41–156px to **41–82px**, cautions from six lines to two, and
the caution text aligns exactly under the style name with its ▲ hanging in the
indent.

Then the mobile check caught the fix's own defect: a full-width cell wraps to
the *table's* width, so on a phone the caution ran off the right edge and had to
be scrolled sideways to read — worse than what it replaced. Capped to the screen
width, it wraps to three lines fully in view.

I also tried making it sticky like the name column and **removed that**: the
name column is 186px and tells you which row you are on, whereas pinning three
lines of prose would cover most of a 333px screen with the very figures you
scrolled across to see.

### Bugs found

1. **The caution cell inherited `position:sticky; left:0`** from the name
   column's rule, because it is also a first child. It would have pinned a
   paragraph over the scrolling figures. Now explicitly static.
2. **The padding never applied.** `.cmp-warn-row td` loses to `table.cmp td` on
   specificity, so the 51px indent silently did nothing. Found by measuring the
   computed value, not by looking.
3. **An error row's colspan was one short**, sliding the caliper under "Blank".
4. **The version bump touched only `index.html`.** An existing test caught the
   other 13 pages still asking for the old asset version.
5. **The shipped sleeve samples were drawn on corrugated shipping board**, 35 mm
   too long, because the size fixture restated a caliper instead of reading it.
6. **My own layout sweep was silently skipping two of five views** — it looked
   for `viewDieline` and `view3D`; the real ids are `viewFlat` and `view3d`. It
   had been reporting a confident "0 findings" over 66 combinations instead of
   110. It now throws if a view button is missing.

### Then the samples, which the board work exposed

The repo ships 77 generated sample artefacts. Checking them against the new
per-style boards found the sleeve had been drawn on **3 mm corrugated** — a
belly band on shipping board, the exact mistake this cycle exists to prevent.
Its blank was **35 mm too long**. Every other style was already on a sensible
board; the size fixture carried its own caliper and only that one had drifted.
The fixture now reads the style's declared board instead of restating it.

Checking further, **all 44 sample PDFs predated the real-bold fix** — no `/F2`,
no `Helvetica-Bold` — so every one was stale.

**`tools/build-samples.js`** rebuilds all 77 from the styles, so they can never
again be "whatever someone exported that day".

### `src/spec.js`, because the samples could not be finished without it

The generator could rebuild six of the seven artefacts per style. The spec sheet
could not: its rows were assembled inside `app.js` from the live interface. That
meant the **highest-stakes artefact in the product — the page a converter quotes
from — was the only one with no tests at all**, and the 11 stale spec PDFs could
not be regenerated without a second copy of that logic, which is how the samples
went wrong in the first place.

`specRows(dl, style, {unit, sheet, nest, gsm, pack, container})` is now pure.
`app.js` keeps a nine-line wrapper that passes what the interface is showing.

**`test/spec.test.js`** — eight tests on a page that had none. The one worth
having guards last cycle's deliberate decision: *the sheet a supplier receives
never carries the reader's costs.* Adding a cost row fails it by name. So does
converting the caliper to inches (converters specify board in mm worldwide), and
so does quoting Capacity for a telescope lid, whose L×W×H is the box it covers
rather than a cavity.

Verified end-to-end through the real download button, not just the module: with
650 g/m² typed in, the exported PDF carries *"122.8 g at 650 g/m²"*, the live
1200 × 800 sheet, the full pack-out, and no money anywhere.

### Verified

- **393 tests green.** The full-width guard was generalised from the error row
  to every row template and proved to fail on the new one in two ways.
- **440 layout combinations** — 11 styles × 5 views × 2 units × 2 themes, at
  1280 and at 375 — **0 findings, no console errors**. Both halves of the sweep
  were proved to bite first, by injecting an element that overflows the page and
  one that overflows its clipping box. Re-run clean after the spec refactor.
- **All 77 samples rebuilt** and checked: 55 PDFs now carry real bold, none
  carried any before.
- **Caution contrast on fresh loads** (runtime theme toggling returns stale
  computed styles): **4.91:1 light, 8.14:1 dark**, both AA.

### A mistake I made, and what it changed

Rebuilding the deployable zip, I deleted the old one before checking the new one
was complete. It was not: `vercel.json` had only ever existed inside that zip,
never in the source tree, so it went with it. I rewrote it from `_headers`,
which carries the same rules for the other hosts, and put it in the source tree
where it belongs.

The deletion was avoidable — verify, then replace. But it exposed something
worse that predated it: **two deployment configs with the same job and nothing
holding them together.** A missing security header does not break a site, it
just quietly serves without a CSP. `assets: the two host configs send the same
headers` now fails if either drops a header the other sends, or if a value
drifts. Both cases proved.

### Still not done

Nothing has been printed and folded. Experiment 1 remains the first owner action
that is not blocked, and no milestone past C has moved.

---

## Cycle 5 — 2026-09-08 · What a box costs delivered, and what Compare is for

### Why this

The material panel has always answered "what is the board worth?" and cycle 3
added "how many travel together?". Neither is the number a business decides on.
Freight is charged on the load, so its share per box falls as the pallet fills —
which is why a style using more board can still be cheaper delivered.

### Delivered

**`deliveredCost()`** — board per box plus freight's share of the load. The
freight figure is the reader's; there is no table of carrier rates here and
there should not be, because rates depend on lane, volume and contract, and a
plausible invented number is worse than none. It reports half an answer as half
an answer: board with no freight never silently becomes a "delivered" total.

**Compare ranks on the job.** Every column heading is now a button that ranks by
that column, each knowing its own better direction — least board, least waste,
most per sheet, least delivered — so a click means "rank by this" rather than
"sort ascending and work it out yourself". Real buttons, so keyboard-reachable,
with `aria-sort` on the heading.

**Money stays in the money panel**, and off the spec sheet (below).

### What I built and then removed

I added a **Per load** column to Compare, then measured it: 5,915 against 5,746
across the styles — a 7% spread. Styles holding the same internal space have
nearly the same *outside*; only the blank differs. So the column was a row of
near-identical numbers taking width from ones that discriminate, on a table
that already scrolls sideways on a phone.

It is gone, and the finding is stated where it is useful instead: *"All of these
hold the same space, so they pack within 7% of each other — the board is what
differs."* That sentence answers the question the column was posing, which is
whether freight is what decides between these styles. It is not.

### A judgement call: no pricing on the spec sheet

The spec sheet is described in the interface as the page you send to your
printer, and it was printing the reader's own board cost on it. Putting your
cost basis on a document you email to a supplier is a negotiating mistake, and
not one the tool should make on someone's behalf. Board area, weight and sheet
yield stay — a converter needs those. Cost stays on screen, and the Help says
so.

### Bugs found

1. **A pre-existing contrast failure.** The best-in-column mark in Compare used
   the print-layer green at **3.25:1**. I created `--glue-ink` two cycles ago
   for exactly this and applied it only to the Free badge; this instance was
   missed. Caught because the new waste column started marking a best value,
   which put more of that green on screen during a contrast sweep.
2. **A mangled proper noun** — "one euro pallet (eur 1)" — from lowercasing a
   container name inside a sentence.
3. **An off-scale `border-radius: 1px`** on the sort underline, caught by the
   style guard. Removed rather than widening the scale for a 2px bar.
4. I rounded money to five decimals inside `deliveredCost` and the test caught
   it. That is the same mistake as E18 (rounding board area at the source):
   full precision in the model, rounding at the display.

### Verified

- **378 tests pass** (7 new): delivered is board plus freight's share; a fuller
  load carries less freight per box; a bulkier box can beat a cheaper one once
  freight counts; half an answer is never reported as a total; nonsense never
  becomes a confident number; zero freight is a real answer rather than a
  missing one.
- Arithmetic checked against the interface by hand: 180 ÷ 364 = 0.495 freight,
  plus 0.384 board = 0.879 delivered.
- Layout audit over **220 combinations** (11 styles × 5 views × 2 themes ×
  2 units) at 1280, plus every sort column: **0 findings, no console errors**.
  Repeated at 375 in both themes: **0**.
- Contrast on fresh loads in the Compare view: **all text passes AA in both
  themes** after the `--glue-ink` fix.
- Sorting exercised end to end: ranking by waste reorders to 40.9 / 44.6 / 45.5.

### Limitations

- Delivered cost uses whatever container and load height the Pack view holds,
  including its defaults if the reader never opened it. The figure is stated
  beside the container it assumed, but it is one assumption deep.
- Freight is a flat per-load figure. Real quotes have minimums, bands and fuel
  surcharges; none of that is modelled and none of it should be guessed.
- Compare still generates every style at the current caliper, so a folding
  carton is compared at 3 mm corrugated if that is what is set. The cautions
  flag it; the table does not.
- Still nothing printed and folded.

### Highest-value next

1. **Compare at each style's own sensible board.** Comparing a tuck carton at
   3 mm corrugated is comparing something nobody would make. Using each style's
   natural caliper would make the table honest, and it is the largest remaining
   correctness gap in a feature that already exists.
2. **A second spec-sheet page** when the rows justify it; the writer supports
   multi-page and `toSpecSheet` does not use it.
3. **Two toggle idioms** (view segment, SHOW chips) in adjacent bars, still in
   different visual languages. The smallest open item, and probably the last
   one worth doing before this stops being worth doing.

---

## Cycle 4 — 2026-09-08 · The first thirty seconds, and the sheet that leaves the building

### Why this

The log has named the first-run state as the top gap for three cycles and I
have deferred it three times in favour of feature work. Measuring it settled
the argument: **the style list was 641px tall, so the first dimension input sat
at y=905** — below the fold on every laptop up to 1000px. The primary control
of a dimension tool was not on screen when the page loaded. That is not a copy
problem or a missing tour; it is a layout defect.

Nothing said the opening box was an example either, so a newcomer could not
tell whether 200 x 150 x 100 was a default, a demonstration, or something the
page had inferred about them.

### Delivered

**Dimensions first.** The rail is now Dimensions → Box style → Material →
Licence, and the picker is capped at 332px with a scroll and a fade that
retires itself when there is nothing more below. The first dimension input
moved from **y=905 to y=186**; the board select, the product-fit panel and the
material panel are all reachable on a 900px screen.

**The example says it is one.** A note names the starting box, quotes its size
live, and offers the product-first path — which opens the panel, scrolls to it
and focuses the first field. It retires itself the moment the reader edits a
dimension, because that is the moment it stops being true, and it never appears
for someone arriving on a shared link, because that box genuinely is theirs.

**Pack-out reaches the spec sheet.** The count, the container, the load height,
the layer pattern and the layer count now go to the PDF a converter or freight
forwarder actually receives — stated together, because a count without its
container and load height is not a fact about anything.

### Bugs found

1. **Adding those rows overflowed the spec sheet on ten of eleven styles.**
   PDF does not clip or complain: it draws text at a negative coordinate and
   the rows are simply gone. Caught by a new test asserting nothing is laid out
   below the page, which I then verified *can* fail by feeding it more rows
   until it did — a guard that cannot fail is not a guard.
2. **The fix exposed two overlaps.** In a 162pt column a value like
   "Euro pallet (EUR 1) 1200 x 800 mm" is wider than the column, so
   right-aligning it ran it back over its own label — two greys on top of each
   other, which reads as a broken renderer. Long values now drop to their own
   line and wrap.
3. **Then the pack-out group split across columns**, leaving "Boxes per load
   364" alone at the top of column two, reading as an unrelated fact rather
   than the answer to the five rows above it. Rows are now laid out in groups
   and a group that will not fit starts the next column whole.
4. **Bold was faked by drawing every heading twice**, a quarter point apart.
   Helvetica-Bold is one of the base-14 fonts, so it needs no embedding and
   costs nothing. Real bold now, and a test that no string is drawn twice in
   the same place.
5. **The starter note said "change the dimensions on the left"** — true on a
   desktop, false on a phone, where the panel is below the drawing. One string
   has to be true of both.

### Verified

- **371 tests pass** (4 new): nothing laid out below the page, no value
  overlapping its label, no row group split across columns, and bold being a
  real face rather than a double draw.
- Every style's spec sheet checked programmatically for off-page text and
  overlapping strings: **0 and 0**. The overlaps first reported were the
  fake-bold double draw, which is what led to fixing it.
- Layout audit over **220 combinations** (11 styles x 5 views x 2 themes x
  2 units) at 1280 with the starter note showing: **0 findings, no console
  errors**. Repeated at 375 in both themes: 0.
- First-run behaviour exercised end to end: shown on a fresh visit, hidden for
  a returning one, never shown on a shared link, retired by the first dimension
  edit and by the dismiss button, and the offered action verified to open the
  panel and land focus on `prodL`.
- Element positions measured before and after the reorder rather than eyeballed.
- The rendered spec sheet inspected as an image at three stages, which is how
  each of the three layout faults was found.

### Limitations

- The spec sheet is one A4 page and now uses both spec columns. Adding another
  block of rows will overflow again; the guard will catch it, but the answer
  then is a second page, which `document_()` supports but `toSpecSheet` does
  not yet use.
- The pack-out rows use whatever container and load height the Pack view is
  set to, including its defaults if the reader never opened it.
- Still nothing printed and folded.

### Highest-value next

1. **Cost per delivered box.** Board cost per box is known and boxes per pallet
   is now known; freight per pallet is the reader's to supply. That completes
   the economics the material panel starts and is a genuinely new answer.
2. **Compare could rank on the job** — cheapest, least waste, most per pallet.
   Pack-out makes the last of those possible and it is still unbuilt.
3. **Two toggle idioms** (view segment, SHOW chips) remain in adjacent bars in
   different visual languages. Now the smallest of the open items.
4. **A second spec-sheet page** when the rows justify it.

---

## Cycle 3 — 2026-09-07 · How many fit

### Why this

Cycle 2 gave the tool a measured **outside** size. That unlocked the question
that follows every box specification and that the tool could not previously
answer: *how many ship in one carton, or on one pallet?* For most sellers that
number moves more money than the board bill the material panel already
computes — freight is charged on space, not on fibre.

It was also the only candidate on the list that the product was already
equipped for. It needed three things it now had: accurate outside dimensions, a
tested rectangle nester, and a place to draw the answer.

### Delivered — a fifth stage view, **Pack**

`src/pack.js`, a new module with no dependencies beyond the existing estimator.

- **`packInto(box, container, opts)`** tries all three ways up, uses the sheet
  view's guillotine nester for each floor pattern, and keeps the best. Reusing
  the nester matters: on a Euro pallet a 206 × 156 case gives **25** per layer
  as a plain grid and **28** with a mixed layer — five columns upright plus one
  turned column. I checked that by hand before trusting it.
- **Plan and elevation together.** The layer plan answers "how do they tile";
  the elevation answers "how high does that go" and shows the leftover
  headroom as a visible sliver rather than a number in a sentence.
- **The count set as the answer it is** — the headline was small grey text at
  the same weight as five supporting facts in the first draft.
- **Pallet footprints stated as fact** because they are: EUR 1 1200 × 800, ISO
  1200 × 1000, North American 48 × 40 in. Load height is always the reader's to
  enter, because it depends on carrier and goods, not on geometry.
- **A caveat in the interface, not just in a comment.** Identical layers, boxes
  square to the pallet, no overhang, no interlocking, and no knowledge of
  weight, stacking strength or which way up the contents must travel — and it
  says which dimension it chose to stand upright to get its number.
- The pillow box declines honestly here too: no fold model, no measured
  outside, nothing honest to pack.

### Bugs found

1. **`--tile-fill` and `--tile-line` were used and never defined.** The
   print-at-home tile preview had been falling back to its light-mode literals,
   so **that preview ignored dark mode entirely**. Found by a new test asserting
   the mirror of an existing one: not just "no token defined and unused" but
   "no token used and undefined" — scanning the JavaScript too, since several
   modules build inline SVG that references page tokens.
2. **The fifth view button overflowed the stage bar on a phone** — 327px of
   labels in a 333px bar, breaking every view at 375px, 99 findings. The
   segment now takes its own full-width row with buttons sharing it equally.
3. **The pack controls sat below the title block**, separated from the drawing
   they control. Moved above the viewport where the other view toolbars live.
4. **The container boundary measured 2.99:1** against the paper in light mode —
   a hair under the 3:1 WCAG 1.4.11 asks of a meaningful graphic, and that
   dashed line is exactly the boundary boxes may not cross. Darkened to 3.55.
5. The service-worker pre-cache guard from an earlier cycle caught `pack.js`
   the moment it existed, which is what it was written for.

### Verified

- **367 tests pass** (13 new): count equals layers times pattern, nothing
  overhangs, no two boxes overlap, an exact divisor tiles exactly with no
  headroom, the chooser never loses to a plain grid on any of the three axes,
  clearance only ever costs boxes, oversized and malformed input returns
  nothing rather than a confident zero, the stack fits its load height, the
  pallet footprints are the published standards, and both drawings render
  exactly the boxes counted.
- Layout audit over **220 combinations** (11 styles x 5 views x 2 themes x
  2 units) at 1280: **0 findings, no console errors**. Repeated at 375 in both
  themes after the seg fix: **0**.
- Text contrast passes AA in both themes on fresh loads, in the Pack view.
- Graphics contrast measured properly (resolving colours through the browser
  rather than parsing hex with an rgb parser, which is how I first got a
  nonsense 1.11): all pack and tile strokes now **3.55–7.92:1**.
- Hand-checked the orientation chooser on the mailer: 516 upright beats 504 and
  462 for the other two axes.

### Limitations

- Geometry only. No weight, no stacking strength, no interlocking or brick
  bonding, no overhang, no pallet deck height, no carrier height limits.
- Layers are identical and boxes are axis-aligned. A real packer sometimes does
  better by alternating layer patterns; this does not attempt it.
- The pillow box cannot be packed, because its outside size is not measured.
- Still nothing printed and folded.

### Highest-value next

1. **The first-run state** — three cycles running, still unaddressed. A
   newcomer lands on a 200 x 150 x 100 RSC with no explanation of why that box
   or what to do next. It is now the clearest remaining gap.
2. **Pack-out belongs in the spec sheet and the economics.** The count is on
   screen but not in the PDF a converter or freight forwarder receives, and
   cost per box could become cost per delivered box.
3. **Compare could rank on the job** — cheapest, least waste, most per pallet —
   rather than only on board used. Pack-out makes "most per pallet" possible.
4. **Two toggle idioms** (view segment, SHOW chips) still sit in adjacent bars
   in different visual languages.

---

## Cycle 2 — 2026-09-07 · The outside of the box

### Why this

Cycle 1's log named it as the top opportunity and it held up on inspection.
People type the **inside** — that is the space the product needs — but they
ship the **outside**. Carriers price on it, pallets are planned from it, and a
letterbox does not care about the cavity. The tool knew the inside exactly and
said nothing at all about the outside.

The log also warned that this is "per-style geometry, not internal + 2t". That
turned out to be the whole story.

### Delivered

**`outerBounds()` in `src/fold.js`** — the assembled box measured, not assumed.
Panels are modelled on the board's mid-surface, so each one is offset half a
caliper along its own Newell normal and the envelope taken from the result.

The obvious shortcut — mid-surface bounds plus one caliper per axis — is right
for a closed box and wrong for every open one. Measured, the styles disagree
exactly as the physics says they should:

| Form | Gain per axis |
|---|---|
| Closed case, mailer, tuck carton | **+2t** on all three |
| Half-slotted, four-corner tray, telescope lid | **+1.5t** on the open axis |
| Sleeve (a tube, cut at both ends) | **+1t** across, **+0** along the band |
| Hexagon (angled faces) | +1.5t / +1.87t / +2t |

No single formula produces that table.

**`externalFor()`** pairs each outside figure to the axis whose *inside* it
belongs to, so the Outside row lines up with the Internal row above it. This
was the fix for the worst thing in the first draft: sorted output beside
unsorted input showed a tuck carton as `inside 80 x 40 x 150` /
`outside 150.7 x 80.7 x 40.7`, which reads as though the box changed shape.

**In the interface:** an *Outside* cell in the title block, and *Outside,
assembled*, *Length + girth* and *Capacity* on the spec sheet. Length + girth
is stated as a number because the formula is a fact; no carrier's threshold is
quoted, because that would be a claim about a third party.

**Removed:** *Board area* from the title block. Adding a fifth cell left each
one 170px against the 185px a dimension triple needs, and both triples wrapped.
Board area was already in the Material & cost panel, so the cut removed a
duplication and the crowding together.

**Honest gaps:** the pillow box has no fold model — it closes by bending — so
its Outside cell reads "—" and, in the cell rather than in a tooltip a phone
cannot show, *"closes by bending, so it is not measured"*.

### Bugs and wrong assumptions found

1. **A sorted row beside an unsorted row** (above) — caught by reading the
   rendered output across all eleven styles rather than the one on screen.
2. **My own test was wrong twice.** It asserted the outside exceeds the inside
   on *every* axis; a sleeve gains nothing along its band, because there is no
   board at either end. And it asserted a gain of at most two calipers, which
   is false for the telescope lid, dimensioned by the box it covers rather
   than by its own cavity. Both are now asserted as the specific truths they
   are, the sleeve with a test of its own.
3. **Capacity would have lied** on the hexagon (width field is unused) and the
   telescope lid (fields describe another box). Now shown only where L/W/H are
   the cavity, using the existing `comparable()` predicate.
4. **The readout dropped to one column on a phone** when I raised the column
   floor to 180px for desktop. A lower floor below 640px restores two.

### Verified

- **354 tests pass** (10 new): outside > inside per style, closed = +2t
  exactly, open = +1.5t, sleeve = +1t across and +0 along, outside == inside at
  zero caliper, monotonic in caliper, pairing returns the measured values only
  reordered, and the pillow box asserted to have no fold model.
- Layout audit over **176 combinations** (11 styles x 4 views x 2 themes x
  2 units) at 1280: **0 findings**, no console errors. Same sweep at 375: 0.
- `box/hexagon.html` at 375 in both themes: 0 findings.
- Spec sheets regenerate cleanly for all 11 styles with the new rows.
- Read the Outside value for all 11 styles against Internal to confirm the
  axis pairing; the pillow box correctly reports none.
- `externalSize` costs **0.018 ms** per call, so recomputing on every keystroke
  is free.

### Limitations

- The outside is measured from the fold model, so it is exactly as good as that
  model. It has never been checked against a physical box — see the standing
  note about printing and folding one.
- No carrier limits are built in, deliberately. Length + girth is given; the
  comparison is the reader's.
- The pillow box reports no outside size at all.

### Highest-value next

1. **The first-run state.** A newcomer still lands on a 200 x 150 x 100 RSC
   with no explanation of why that box or what to do next.
2. **Compare could rank on the job** — cheapest, strongest, least waste, fewest
   sheets to print — rather than only on board used.
3. **Two toggle idioms** (view segmented control, SHOW chips) sit in adjacent
   bars doing similar work in different visual languages.
4. **A fit check against a carton or pallet** the reader specifies: how many of
   this box fit in it, and in what arrangement. The nesting code already does
   the 2D version of exactly this.

---

## Cycle 1 — 2026-09-07 · Choosing a style, and a drawing that looks like one

### Why these

The product was correct and well tested but had two weaknesses a user meets in
the first thirty seconds.

**You could not choose.** Eleven styles were listed flat, named RSC, HSC,
FOL 0203, STE, RTE — an alphabet the reader does not have yet. Someone who
wants to pack a candle cannot know that a candle box is filed under "tray".
Meanwhile `GUIDES[id].when` — a written paragraph on exactly when to use each
style — existed in the codebase and appeared *only* on the reference pages,
never in the tool where the choice is actually made.

**The drawing did not look like a drawing.** The preview sat on a grey
chequerboard, which in every graphics tool means *transparent*. Here the
background is a sheet of board, so the chequer was not merely generic, it was
saying something untrue. Below it, the four figures that every technical
drawing carries in a title block were set as generic stat cards.

### Delivered

- **Picker grouped by family** — Corrugated shipping / E-commerce / Tray /
  Folding carton / Wrap — from the styles' own `family` data, not a taxonomy
  invented for the sidebar. The headings are the translation for the codes.
- **"Licence" × 9 became a padlock.** The word taught nothing after the first
  read and was nine repetitions of static down the rail. Still announced to a
  screen reader.
- **Trailing acronyms became code chips** (`RSC`, `FOL`, `STE`, `RTE`) so names
  fit one line. Only acronyms: "(open top)" is prose and stays in the name.
- **"When to use it"** now appears under the drawing, from the same source as
  the reference page, with a link through to the full guide.
- **A true-millimetre graticule** behind the preview, drawn *in drawing units*
  so a square is a real square millimetre of the actual box at any zoom. The
  step comes from a 1-2-5 series chosen to give 8–45 divisions whatever the
  box size, the pattern origin sits on the blank's own corner so squares can be
  counted from the edge, and the legend states what one square is worth. Lines
  are `non-scaling-stroke` hairlines: in drawing units a grid line on a 750 mm
  blank is a fifth of a pixel, and four pixels once zoomed to 8×.
  Preview only — an exported file is something a designer places artwork on.
- **The readout became a title block**: ruled cells, caption register, tabular
  figures, and units bound to their figures so "mm" cannot orphan onto its own
  line.

### Bugs found and fixed

1. **The responsive block had never worked.** `@media (max-width:900px)` sat
   *above* the rules it was written to override, and media queries carry no
   extra specificity — only position. The stage bar's tighter gap, the
   readout's tighter padding and the legend's alignment were dead code on every
   phone since they were written. Moved to the end of the sheet; verified the
   declarations now apply (`bar gap` 14px → 10px, `readout padding`
   `9px 16px` → `9px 12px`, `legend margin-left` auto → 0).
2. **186 px of dead stage on a phone.** A 747 × 253 mm blank is 114 px tall
   once it fits a 375 px screen, inside a stage with a 300 px floor. Now 58 px.
3. **A regression I introduced and caught:** the new title block truncated
   `200 × 150 × 100 mm` to `200 × 150 × 10…` in a 135 px cell. An ellipsis
   there hides the one number the reader came for. It wraps instead.
4. **"Box styles" wrapped to two lines** in the header at 375 px.

### Verified

- **344 tests pass** (5 new, covering the graticule: 1-2-5 step series, density
  across 30–5000 mm, opt-in only, origin alignment at three margins, hairline
  strokes).
- Layout audit — overflow, clipping, offscreen, collapsed boxes — across
  11 styles × 4 views × 2 themes at 1280 and 375: **0 findings**. The two hits
  at 7.5× zoom are the intended pan-and-clip behaviour.
- `box/rsc-0201.html` audited at 1280 and 375 in both themes: 0 findings.
- Contrast: **all text passes WCAG AA in both themes**, measured on a fresh
  load with the theme applied before first paint (a runtime `data-theme`
  toggle returns stale computed values in this browser and reports false
  failures — do not trust that measurement).
- Grid legend confirmed adapting per style (50 / 20 / 10 mm) and hiding on the
  3D, Sheet and Compare views.

### Limitations

- The **grid is preview-only** by design; it is not in any export.
- **Screenshots of scrolled content are unreliable** in this environment when
  the browser pane is hidden, and `setTimeout` is throttled hard, so iframe
  sweeps time out. Navigating directly and auditing synchronously works.
- Style names still wrap to two lines for the three longest. Renaming them to
  fit would misname them, so they wrap.
- Nothing has been printed and folded. Unchanged, and still the first thing
  worth doing — see `docs/experiments.md`.

### Highest-value next

1. **Outside dimensions.** People type internal but ship external, and courier
   and pallet limits are external. It is per-style geometry, not internal + 2t,
   so it needs deriving per style rather than guessing.
2. **The empty/first-run state.** A newcomer lands on a 200 × 150 × 100 RSC
   with no explanation of why that box or what to do next.
3. **The two toggle idioms** — the view segmented control and the SHOW chips —
   sit in adjacent bars doing similar jobs in different visual languages.
4. **Compare could rank on the job**, not only on board used: cheapest,
   strongest, least waste, fewest sheets to print.
