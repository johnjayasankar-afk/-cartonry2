# Status

**Date:** 2026-09-05 · **Business:** Cartonry — parametric packaging dieline generator

## Milestones — where this actually stands

| | Milestone | State |
|---|---|---|
| **A** | Opportunity researched and selected | ✅ **Done** — 7 candidates compared, 6 rejected on specific evidence |
| **B** | Commercial hypothesis and demand test prepared | ✅ **Done** — hypothesis, 3 riskiest assumptions, 3 experiments with thresholds |
| **C** | Complete prototype working | ✅ **Done** — 11 box styles, 3D fold engine, dimensioned drawings, sheet-yield estimating, 4 export formats incl. tiled home printing, fully metric/imperial throughout, **403 tests green**, verified in-browser and through an independent PDF renderer |
| **D** | Sandbox payment and fulfilment verified | ⬜ **Blocked on owner** — needs an account I must not create. Licence logic is built and tested against mocked providers (16 tests incl. revocation, offline grace, activation limits) |
| **E** | Owner account requirements completed | ⬜ **Not started** — see `owner-checklist.md`, ~2 hours |
| **F** | Public launch authorised and completed | ⬜ **Not started** — needs explicit authorisation |
| **G** | Qualified prospects reached | ⬜ **Not started** |
| **H** | First genuine customer payment received | ⬜ **Not started** |
| **I** | Funds paid out to owner | ⬜ **Not started** |
| **J** | Positive operating profit + low maintenance over time | ⬜ **Not started** |

**Nothing below C has been achieved, and nothing below C is claimed.**

## Money

| | |
|---|---|
| **Actual spend to date** | **$0.00** |
| Accounts created | none |
| Trials started | none |
| Recurring costs committed | none |
| Actual sales | **0** |
| Actual refunds | 0 |
| Actual payouts | **$0.00** |

Required to launch: **$0** (free static hosting, free MoR account). Optional: a domain, ~$14/year.

## What is working

- **Eleven box styles** generating correct geometry from internal dimensions and board caliper.
- **A 3D fold engine** that folds the flat net and, in the test suite, *measures the assembled
  box against the dimensions that were asked for.* This is the strongest correctness evidence in
  the project, and it found two real defects the 2D maths had passed (see below).
- **Dimensioned, lettered drawings**: dimension lines with extension lines and slash ticks,
  panel names taken from the fold model, and per-panel artwork safe-area guides — each on its
  own switchable, separately-exported layer.
- **Sheet-yield and cost estimating**: guillotine two-block nesting, waste percentage, board
  weight from grammage, and cost per box charged on the sheet consumed.
- SVG (true millimetre sizing), PDF (true scale, base-14 lettering — **verified rendering in
  Apple's PDF engine**), DXF R12 (**verified by an independent group-code parser**).
- Live preview with zoom and pan, mm/inch with fraction input ("12 1/2"), arrow-key nudging,
  board presets, adjustable allowances, and validation that never silently substitutes a default.
- Shareable links that reopen the exact box; recent sizes; light/dark/system theme; keyboard
  shortcuts; offline operation via a network-first service worker.
- **Eleven written reference pages**, one per style, each with a real drawing, a folded 3D view
  and ~150 words of genuine guidance — plus sitemap and robots.
- Licence activation against a merchant of record — works with **either** Lemon Squeezy or Polar.
- Privacy and terms pages written to match what the software actually does.
- **A printer-ready spec sheet export** — one A4 page with the drawing and every number a
  converter asks for, clearly marked as not-to-scale so nobody measures the wrong file.
- The style catalogue on the home page is **static HTML**, so the eleven reference pages are
  reachable by a crawler and by anyone browsing without scripts.
- **A sheet-nesting view**: the real blank outlines drawn nested on the sheet with trim margin
  and grain arrow, exportable as SVG, true-scale PDF or DXF through the same writers.
- **Dimension chains** measuring every panel, read from the crease lines so they cannot
  disagree with the drawing; no two labels overlap on any style.
- **Written assembly steps** for all eleven styles, shown in the app, on the reference pages
  and on the spec sheet.
- Style thumbnails drawn from the real geometry, a print stylesheet and a web manifest.
- **Sizing from the product** — enter what goes in the box and the clearance it needs; the
  internal dimensions follow. This is how people actually start.
- **A comparison view** ranking every comparable style by board used at the current size, with
  incompatible styles showing the reason rather than a blank.
- **Order economics** — sheets, board area, weight and cost for a whole run.
- **Non-blocking cautions** carrying real domain knowledge, and format-aware defaults.
- **Print at home** — the dieline tiled across sheets of the reader's own paper at exactly 1:1,
  with a trim frame, corner registration, a sheet map, per-sheet neighbour labels, and a printed
  100 mm bar on every sheet so a scaled print is caught before anything is cut. Trim-and-butt,
  not overlap-and-align, so registration error does not accumulate across seams. This is the
  step every other part of the tool was already telling people to take.
- **Millimetres or inches, coherently.** One formatter drives every length the tool displays,
  so the readout, the notes, the cautions, the material panel, the compare table, the print
  dialog and the spec sheet cannot disagree about the same edge. Area follows too (m² / ft²),
  and the board price converts so the quoted cost is the same money either way. Board caliper
  and slot width stay metric on purpose, and the interface says why: every mill and converter
  specifies board in millimetres or microns, US ones included.
- **A style picker grouped by what the style is**, with the written "when to use it"
  guidance surfaced in the tool rather than only on the reference pages.
- **A true-millimetre graticule** behind the preview: squares are real millimetres of the
  actual box at any zoom, aligned to the blank's own corner, with the step stated in the
  legend. See `IMPROVEMENTS.md` for the reasoning and the bugs it turned up.
- **Outside dimensions, measured from the folded model** rather than derived from a formula:
  a closed case gains two calipers on each axis, an open tray one and a half on its open axis,
  and a sleeve none at all along its band. Shown against the internal size on the same axes,
  with length + girth and capacity on the spec sheet.
- **Pack-out** — how many finished boxes fit in a case or on a pallet, drawn as a layer plan
  and a stack elevation, with the orientation chosen for the best count. Uses the measured
  outside size and the same nester as the sheet view. Geometry only: the interface says
  plainly what it does not know (weight, stacking strength, interlocking, which way up).
- **A first screen that works**: the dimension fields are the first thing on the page, and the
  opening box says it is an example until the reader changes it.
- **Cost per box delivered** — board plus freight's share of the load, from the reader's own
  freight figure. No carrier rates are invented. The comparison table ranks on any column,
  including delivered cost, and the spec sheet deliberately carries no pricing.
- **403 automated tests. Zero runtime dependencies. Zero server.** Plus in-browser sweeps of
  every style against every view, every ordered pair of style transitions in both units, and a
  4,000-specification fuzz across every subsystem.

## Two real defects the fold engine caught after the 2D maths looked right

1. **Open walls were a full caliper too deep.** Tray and mailer wall heights used the "add one
   caliper" rule that applies to a dimension bounded by folds at *both* ends. A wall folded at
   one end and cut at the other only loses half a caliper. Every tray and mailer was a caliper
   too deep until the folded box was measured.
2. **Corner tabs swung outward.** On the far-side walls the hinge was written descending, so the
   tabs rotated away from the box instead of into it. A bounding-box check cannot see this; the
   folded model lands the tab outside the carton, which the test catches immediately.

A third, earlier defect — corner tabs collapsing to 1 mm slivers — was caught by comparing each
blank's enclosed **area** against the sum of the panels it should contain. Bounding boxes are
identical either way; areas are not.

A fourth was not a geometry bug but an honesty one: **the nester was rotating blanks 90° to
improve the yield.** Corrugated flutes and carton grain run one way down the sheet, so a real
converter often cannot make that swap. Rotation is now off by default and the reported yield is
the one the customer can actually get.

A fifth came from writing the cautions: **the default glue flap was 35 mm on every style.** That
is a corrugated manufacturer's joint. On a folding carton, where the flap laps onto a panel a few
centimetres wide, it is absurd — the tool was putting a 35 mm flap on a 40 mm panel. The default
is now format-aware and capped at 45% of the panel it laps onto. The caution I wrote to *report*
the problem is what exposed it.

A sixth was not in the software at all. **The instruction the whole tool rests on — print it at
100% and fold it — was impossible for ten of the eleven styles**, because their blanks are larger
than any paper a desk printer takes. Worse, the fold test in `experiments.md` had been written
around the problem with a deliberately tiny 60 × 40 × 30 mm RSC, and *that* blank is 212 mm wide
against A4's 210: the experiment meant to validate the geometry would itself have been scaled by
about ten per cent. Every test in the suite was measuring the drawing; none asked whether the
customer could hold it. See E15.

A seventh was found by sweeping every ordered pair of styles rather than testing one path at a
time. **Selecting the hexagon and then any ordinary box left the tool in a validation error the
reader did nothing to cause.** The hexagon has no width — it has a distance across the flats — so
its Width field is hidden and zeroed. Re-showing the field for the next style never put the value
back, and four styles (RSC, HSC, FOL, sleeve) have no defaults of their own to overwrite the zero,
so they landed on "Width must be greater than zero" with the exports disabled. The first fix was
also wrong: it stashed the outgoing value *after* the incoming style's defaults had already
written zero over it, which the same sweep caught immediately. 121 transitions now pass clean.

Three more came out of this pass, and one of them was mine to begin with.

**Eight: board area was rounded at the point of storage, not display.** Three decimals of a
square metre quantises to 1000 mm². A jewellery carton's blank is 3941 mm² and a small hexagon's
is 855 mm² — a 17% overstatement — and anything under 500 mm² read as zero. Board area, weight
per box and **cost per box** all derive from that one number. Found by fuzzing 4,000 random
specifications, which generated sizes no hand-written case would have picked. See E18.

**Nine: half the interface ignored the unit toggle.** The readout said `29.41 × 9.96″` while the
panel below it said `747 × 253 mm`, the notes said `Flap depth 75 mm`, and the gutter field was
labelled `(mm)`. Every one of those was written correctly in isolation; the fault existed only
between them. See E16.

**Ten, and the one worth dwelling on: fixing that introduced a silently wrong number.**
Relabelling the board-price field "per ft²" is a display change — except that everything
downstream multiplies it by an area held in m². Cost per box and cost for the run became
**10.76 times too low**, and both still read as plausible money. It was caught by asserting a
property rather than reading the screen: the quoted cost of a box must not change when the unit
is switched. See E17.

## What is still assumption, not evidence

- **That anyone will find it.** I have query *breadth* (821 distinct phrasings, 197 naming
  fibreboard case codes) but **no search volume data**, and I have invented none. This is the
  most likely way the business fails.
- **That finders will pay.** No one has been asked for money. The $39 price is a decision, not
  a tested figure.
- **That the dielines fold correctly in the physical world.** The geometry is now verified five
  independent ways in software — analytic blank areas, folded-box measurement, independent
  renderers for PDF and DXF, and reassembling the tiled sheets back into the original drawing —
  but **nothing has been printed and folded.** Software cannot tell you a printed dieline behaves
  on real board. That is Step 1 of the checklist and it is free. It is now also *possible*: until
  today the tool could not put a full-size blank on the owner's printer at all.
- **The 1% conversion rate** in the economics model is a labelled assumption used for sizing, not a forecast.

## Expected vs observed owner workload

Designed for **under an hour a month** in steady state (no server, no dependencies, no
subscription mechanics, no content treadmill). **Observed: not yet measurable** — treat the target as a
design goal to be checked after three live months. Startup effort is separate: ~2 hours, once.

## Smallest remaining owner actions

1. **Fold four printed dielines** (45 min, $0) — three small ones on single sheets, then a real
   200 × 150 × 100 mm case tiled across five. Validates the core claim before anything is spent.
2. Deploy to free static hosting (20 min, $0).
3. Open a merchant-of-record account, create the $39 product with licence keys (~1 hour, $0).
4. One real test purchase, then refund it (15 min, ~$39 refundable).

Full detail, including what I will never do on the owner's behalf: `owner-checklist.md`.

## Next experiment

Experiment 1 (fold test, now four boxes including a tiled full-size case) — then Experiment 2
(does anyone arrive), which needs 90 days and
has an explicit failure threshold that ends the project rather than extending it. See
`experiments.md`.

## Open items needing professional review

- Formal trademark search on the name "Cartonry" before any spend on a domain or branding.
  A web search found no conflict in packaging software, which is not the same as clearance.
- The refund and liability wording in `terms.html` is written to be fair and plain, but it has
  not been reviewed by a lawyer in the owner's (still unknown) jurisdiction.
