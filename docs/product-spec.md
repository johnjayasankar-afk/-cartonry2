# Product Specification — Cartonry

**One job:** turn internal box dimensions into a correct, production-ready dieline.

## Positioning

For packaging and brand designers, small e-commerce sellers and print buyers who need a
cutting template at a specific size. Free generators cover a handful of hobbyist styles;
professional packaging CAD is priced for converters. Cartonry sits between: a real catalogue
of standard styles, correct board allowances, production file formats, no install, no account.

## The customer journey

1. Arrives from a search naming a box style or case code — often landing on that style's own
   reference page, which carries a real drawing and a folded 3D view before any click.
2. Opens the generator with that style already selected.
3. Enters what actually goes in the box — **the product size and how much room it needs** — and
   the internal dimensions are worked out. Or types the box size directly if they know it.
4. Picks a board; the preview updates live, and anything questionable about the combination is
   raised without blocking.
4. Presses **3D fold** and watches the flat blank close into the box. This is the moment the
   tool earns trust: you can see it is the right box before spending anything.
6. Reads blank size, board area, blanks-per-sheet, waste, weight, cost per box — and, given an
   order quantity, sheets and board cost for the whole run.
7. Switches to **Sheet** to see how the blank actually nests, and to **Compare** to see which
   style uses least board at this size.
8. Exports SVG, true-scale PDF, DXF, or a one-page spec sheet — of the blank or the whole
   nested sheet. Two styles are free and unrestricted.
9. For a paid style: previews it fully at their own dimensions first, then buys a $39 licence
   and pastes the key from their receipt. No account is ever created.

## Scope

**In:** eleven box styles; sizing from the product; a style comparison; a 3D fold engine; a
sheet-nesting view with grain handling; non-blocking domain cautions;
dimensioned, chain-dimensioned, labelled, guide-marked drawings; written assembly steps;
mm/inch with fraction input; board presets and custom caliper; adjustable glue flap, slot
width, flap relief and tuck depth; sheet-yield, weight and cost estimating; live preview with
zoom and pan; layered SVG, PDF and DXF export of either the blank or the whole nested sheet;
a printer-ready spec sheet; tiled home printing at true scale; shareable links; offline
operation; licence activation and release.

**Out (deliberately):** artwork, nesting output files, quoting workflows, accounts, cloud
saving, team features, an API. Each would add support surface for a customer who came here to
get one file.

## Catalogue

| Style | Code | Family | Free | 3D |
|---|---|---|---|---|
| Regular Slotted Container (RSC) | 0201 | Corrugated shipping | ✅ | ✅ |
| Half Slotted Container (open top) | — | Corrugated shipping | | ✅ |
| Full Overlap Slotted Container (FOL) | 0203 | Corrugated shipping | | ✅ |
| Tuck-top mailer box | — | E-commerce | | ✅ |
| Four-corner tray | — | Tray | | ✅ |
| Telescope lid | — | Tray | | ✅ |
| Straight Tuck End carton (STE) | — | Folding carton | | ✅ |
| Reverse Tuck End carton (RTE) | — | Folding carton | | ✅ |
| Sleeve / belly band | — | Wrap | ✅ | ✅ |
| Hexagonal box | — | Tray | | ✅ |
| Pillow box | — | Wrap | | — |

Codes are shown only where they are unambiguous industry designations. Where I was not certain
a style maps to a specific published code, **no code is claimed** — a wrong code would be worse
than none to the professional this is aimed at.

## Geometry: the part that has to be right

**Board allowance.** Panels are modelled on the board's mid-surface. Folding through `turn`
degrees moves the inner face inward by `(t/2)·tan(turn/2)` at that corner, so:

| Situation | Allowance | Example |
|---|---|---|
| Bounded by 90° folds at both ends | **+ one caliper** | RSC panels, tray base |
| Bounded by a 90° fold at one end, cut at the other | **+ half a caliper** | tray and mailer wall height |
| Bounded by cut edges at both ends | **nothing** | sleeve band height |
| Bounded by 60° folds at both ends | **+ 0.577 calipers** | hexagon panels |

The half-caliper and 60° cases are exactly what hand-drawn dielines get wrong. Both were
found by the 3D fold engine after the 2D maths already looked correct.

**Other rules:** RSC flaps are W/2 so the outer pair meet on the centre line, with an
adjustable relief gap; slots are one caliper wide and centred on the vertical scores; corner
tabs span the full wall height less a clearance at the base score; tuck panels span the
opening depth and are followed by a narrower tuck flap with angled shoulders.

## Advice, not just arithmetic

Validation refuses geometry that cannot exist. **Cautions** are different: the box is buildable,
but someone who does this for a living would raise an eyebrow — board too thick for a small box
so the creases crack, a 600 mm case on 0.5 mm board, proportions of 10:1 suggesting a number is
in the wrong field, a blank larger than any stock sheet, corrugated specified for a tuck-end
carton, a shallow RSC whose flaps will stand proud. They never block, because the user may know
something the tool does not; they are simply said.

Defaults carry the same domain knowledge. A **manufacturer's joint is 30–40 mm on corrugated and
6–12 mm on folding board**, and it is capped at 45% of the panel it laps onto so it can never
overrun the next crease. Defaulting to the corrugated figure — which the tool did until a test
caught it — put a 35 mm flap on a 40 mm carton panel: valid arithmetic, absurd on a press.

## Comparing styles

Same internal size, every style that means the same thing by it, ranked by board used — because
the question is usually "which of these is cheapest to make?". Styles whose dimensions mean
something else (a lid sized to the box it covers, a hexagon measured across the flats, a pillow
box whose Width is its curve depth) are **excluded and said to be excluded**, rather than quietly
compared against numbers that do not line up. Styles that cannot take the size at all show the
reason instead of a blank.

## The fold engine — verification, not decoration

Each style declares a fold model: a tree of panels joined by hinges with fold angles. The
engine folds the net in 3D, and the test suite **measures the assembled box and compares it to
the dimensions that were asked for.** If an allowance is wrong, the box comes out the wrong
size and the test fails — the same way it would fail on a real cutting table.

It also catches errors no 2D check can see: a corner tab that swings outward instead of in
lands outside the carton and inflates the bounding box.

The pillow box declares `fold: null`. It closes by bending its panels into a curve rather than
folding flat panels about straight hinges, and the UI says so plainly instead of showing a
flat-panel approximation that would look convincing and be wrong.

## Drawing output

- **Cut** (solid magenta), **crease** (dashed blue), **glue** (dashed green), **artwork guide**
  (dashed violet, per-panel safe area), **dimensions** (lettered, with extension lines and
  architectural slash ticks).
- **Dimension chains** measure every panel, not just the overall blank. The divisions are read
  from the crease lines themselves, so a chain can never disagree with the drawing it annotates,
  and gaps too narrow to letter are skipped rather than printed as mush. The overall dimension
  steps outside the chain so no two labels ever collide — asserted for every style.
- Panel names come from the fold model, so the drawing and the 3D view can never disagree.
- Every annotation layer is independently switchable and each exports as its own named layer.

## Export formats and the spec sheet

- **SVG** — sized in real millimetres, layers named `cut` / `crease` / `guide` / `glue` / `dim`,
  text as real text.
- **PDF** — written directly; `MediaBox` in points so 1 mm in the design is 1 mm on paper.
  Lettering uses base-14 Helvetica, so nothing is embedded and every reader can open it.
  Verified down to xref offsets and stream lengths, and rendered through an independent engine.
- **DXF** — AutoCAD R12 (`AC1009`), millimetre insertion units, `POLYLINE`/`VERTEX`/`SEQEND`
  plus `TEXT`, layered `CUT` / `CREASE` / `GLUE` / `GUIDE` / `DIMS`. Annotations can be omitted
  entirely for a die maker who only wants the knife.
- **Spec sheet** — a one-page A4 landscape summary: the drawing scaled to fit on the left, and
  on the right every number a converter asks for (internal size, board, blank size, panel
  breakdown, sheet, blanks per sheet and layout, waste, weight, cost). It states plainly that
  the drawing is *not* true scale and points at the production PDF, so nobody measures the wrong
  file. This is the artefact a designer attaches to an email.

## Estimating and the sheet view

Guillotine two-block nesting — fill columns of one orientation, turn the leftover strip 90° and
fill that — which is what an estimator does by hand and what a converter can actually cut. It
reports blanks per sheet, the layout, waste percentage, board weight from grammage, and cost
per box charged on the **sheet consumed**, because waste is paid for too.

**Grain is respected by default.** Corrugated flutes and carton-board grain run one way down
the sheet, and the direction relative to the box is structural — flutes should run vertically
in a case so it stacks. So the nester does **not** rotate blanks unless the user states the
board is non-directional. Reporting a rotated yield on directional board would be quietly
wrong in the customer's favour, which is the worst kind of wrong.

The estimator returns **where every blank sits**, and the Sheet view draws it: the real cut
outlines nested on the sheet, the trim margin, and an arrow showing the grain direction. A
number the customer has to trust becomes a picture they can check. The whole nested sheet
exports through the same SVG, PDF and DXF writers as a single blank, so a converter can be
sent one file for the sheet.

## Architecture

Static files. **Zero runtime dependencies.** All computation client-side.

```
prototype/
  index.html  privacy.html  terms.html  styles.css  app.js  sw.js  favicon.svg
  _headers            cache + security headers for Cloudflare Pages / Netlify
  devserver.py        local no-store server so edits are never masked by cache
  src/
    geom.js           primitives, units, fraction parsing, bbox, area, arcs
    model.js          dieline model, parameter validation, fold-allowance rule
    fold.js           4x4 maths and net folding
    render3d.js       painter's-algorithm SVG renderer with Lambert shading
    annotate.js       dimensions, panel names, artwork guides
    estimate.js       sheet yield with placements, grain constraint, weight, cost
    sheet.js          nested-sheet drawing, and the sheet as an exportable dieline
    registry.js  config.js  license.js
    guides.js         per-style reference copy and written assembly steps
    styles/           rsc  slotted  carton  misc  extra  shared
    export/           svg  pdf  dxf     (all written from scratch)
  tools/build-pages.js   emits box/*.html, sitemap.xml, robots.txt, and writes the
                         style catalogue into index.html as real HTML
  test/               261 tests, no framework
```

**Why no libraries:** the product needs geometry, an SVG string, a PDF and a DXF. All four are
small enough to write directly. Zero dependencies means no supply-chain risk, no advisories and
no upgrade treadmill — which is what makes the maintenance target credible.

**Offline:** a service worker caches the shell network-first. Online you always get current
code — stale geometry would be worse than useless — and offline the generator keeps working,
because it does all its work in the browser anyway.

## Small things that make it feel finished

Style thumbnails drawn from the real geometry, so the picker is visual. Written assembly steps
per style, in the app, on the reference pages and on the spec sheet. Shareable links carrying
the whole specification. Recent sizes. Light/dark/system theme. Keyboard shortcuts for every
view and toggle. Zoom and pan. Fraction input for inches, and arrow keys that nudge a dimension.
A print stylesheet. A web manifest, so it installs as an app. Reduced-motion respected
throughout.

## Print at home

The tool told everyone to print the dieline at 100% and fold it before ordering tooling, and for
ten of the eleven styles at their default size that was impossible: the blank is larger than any
paper a desk printer takes. A 200 × 150 × 100 mm case unfolds to 747 × 253 mm, larger than A2.

**Print at home** splits the drawing across sheets of the reader's own paper — A4, Letter, Legal,
A3 or Tabloid — at exactly 1:1. Orientation is chosen, not asked for; the same blank can need six
sheets one way round and five the other.

The scheme is **trim-and-butt, not overlap-and-align**. Each sheet owns a rectangular cell of the
drawing and prints it with 5 mm of duplicated drawing on every side. A long-dashed frame marks the
cell boundary — long, because creases are dashed too and on a mono laser the dash length is the
only thing telling them apart. You cut on that line and butt the cut edges together. Aligning
printed artwork by eye accumulates error at every seam, and a five-across blank has four of them;
butting cut edges has no cumulative term, because each cut is made against a line whose position
is exact.

Every sheet carries the sheet's grid reference, which sheets join it on each side, a thumbnail of
the grid with this sheet marked, and a printed **100 mm bar**. The bar is the only claim on the
sheet that can be checked without believing anything the tool says: if it does not measure 100 mm
under a ruler, the print was scaled and every other dimension is wrong by the same factor. A lead
page shows the whole blank with the grid drawn over it and the sheets lettered.

The geometry is clipped to the cell before it is written, as well as being clipped by the PDF clip
path. Two independent mechanisms, because a tiled sheet is printed rather than read, and the cheap
end of the print pipeline is exactly where clip paths get dropped — and an ignored clip does not
fail visibly, it prints the whole 747 mm blank shrunk onto one sheet and looks plausible.

## Millimetres or inches

One formatter in `src/geom.js` produces every length the tool displays. Before it existed the
unit toggle had been applied where it was first written and nowhere since: the readout said
`29.41 × 9.96″` and the material panel four inches below said `747 × 253 mm`.

Everything the reader measures follows the toggle — box dimensions, blank size, panel sizes,
sheet and paper sizes, gutter, trim, clearance and the press allowances, the written notes and
the cautions. Area follows as well, m² becoming ft², and the board price converts inversely so
that the cost it produces is the same money in either mode.

Two fields stay metric in both modes, and the interface says so rather than leaving it looking
like an oversight: **board caliper** and **slot width**, which is the caliper. Board is specified
in millimetres or microns by every mill and converter, US ones included, and `0.0138 in` is not a
figure anyone in the trade would recognise. Grammage stays g/m² for the same reason.

Two details that are easy to get wrong and were:

- **Round-tripping.** The input boxes hold display text, and display text is rounded. 150 mm
  shows as 5.906 in, and 5.906 in is 150.012 mm — so pressing the toggle twice used to leave a
  box the reader never edited slightly larger, and it showed. Each box now remembers the
  millimetre value last written into it and converts from that, unless the reader has typed over
  it. The same applies to the board price, where the trailing zero in `1.20` is part of how money
  is written.
- **Clearance presets are not conversions.** One millimetre is 0.04 in, which is not a clearance
  anybody specifies. The inch presets are 1/32″, 1/8″ and 1/4″ — the round numbers of that system,
  named by the same intent.

## Trust and honesty commitments

- Stated plainly as a drafting aid; the converter's approval still governs. Customers are told
  to print at 100%, fold it, and check before ordering tooling — and are now given a way to
  actually do that at any box size, with a printed ruler to verify the print was not scaled.
- Paid styles are **fully previewable**, in 2D and 3D, at the customer's own dimensions.
- No fake scarcity, no invented testimonials, no countdown timers, no dark patterns.
- No affiliation with any standards body is claimed; codes are used only as factual identifiers.
- Where the tool cannot do something honestly — the pillow box in 3D — it says so.
- While the store is closed the site says so and links to no checkout.
