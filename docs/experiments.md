# Commercial Hypothesis & Demand Tests

## The falsifiable hypothesis

> **Packaging and brand designers, and small e-commerce sellers specifying their own boxes,
> will pay $39 once for a tool that produces a correct, production-ready dieline at their
> exact internal dimensions with the board allowances already applied — because their
> alternatives are redrawing it by hand, waiting on a converter, or a free generator that
> only covers a handful of hobbyist styles — and we can reach them through search queries
> that name a specific box style or fibreboard case code.**

Each clause is independently checkable, and each can be wrong on its own.

## The three assumptions most likely to kill this

| # | Assumption | Why it is fragile | Status |
|---|---|---|---|
| **A1** | Qualified people can find the site through organic search | We have query *breadth* (821 distinct phrasings, 197 naming case codes) but **no volume data at all**, and no domain authority. This is the single most likely cause of failure. | Untested |
| **A2** | Enough of them pay rather than using the free styles or getting a dieline free from their box supplier | Box suppliers hand out dielines to win the print order. ~10% of captured queries carry a "free" signal. | Untested |
| **A3** | The dielines are correct enough that a professional will trust and use them | Geometry is verified five ways in software (310 tests: analytic blank areas, folded-box measurement, independent PDF and DXF parsers, and reassembly of the tiled sheets). It has **never been folded in the physical world.** | Partially tested |

---

## Experiment 1 — Fold test (validates A3). Do this first: it is free and fast.

Software tests prove the maths is self-consistent. They cannot prove a printed dieline folds
into a box of the stated size. This is the cheapest experiment in the whole plan and it
gates everything else — there is no point driving traffic to a tool that is subtly wrong.

- **Measures:** whether a printed dieline folds into a box whose internal dimensions match what was typed.
- **Who:** the owner, at a desk. No customers involved.
- **Cost:** ~45 minutes, about 12 sheets of A4, a craft knife, a ruler, tape.
- **Method:** four boxes, in this order.

  | # | Style | Size | Board | Sheets |
  |---|---|---|---|---|
  | 1 | RSC 0201 | 60 × 40 × 30 mm | 0.5 mm | 1 |
  | 2 | Tuck-top mailer | 90 × 70 × 30 mm | 0.5 mm | 1 |
  | 3 | Straight tuck carton | 50 × 30 × 90 mm | 0.35 mm | 1 |
  | 4 | RSC 0201 | 200 × 150 × 100 mm | 3 mm | 5 + map |

  For every one of them use **Print at home** rather than the plain PDF, and print at
  **100% / Actual size** with "fit to page" off. Before cutting anything, measure the printed
  100 mm bar on each sheet with a ruler. Then cut the long-dashed grey trim frame, butt the cut
  edges (do not overlap), tape the back, and cut the magenta line, score the blue dashes, fold.

- **Why box 4 matters, and why it is last:** boxes 1–3 are small enough to land on one sheet, so
  they test the geometry alone. Box 4 is the size a real customer actually orders and the size
  the home page advertises; it tests the geometry, the tiling, and the taping together. If boxes
  1–3 pass and box 4 fails, the fault is in the tiling or the taping, not the dieline — which is
  precisely why they are run in this order.
- **Do not skip the ruler check.** Box 1 was chosen in an earlier draft of this plan because it
  was thought small enough to print unaided. Its blank is **212 mm** wide and A4 portrait is 210,
  so the print dialog would have shrunk it by about ten per cent and the finished box would have
  measured wrong for a reason having nothing to do with the geometry. The printed bar exists to
  make that failure impossible to miss.
- **Success:** all four assemble; flaps meet without overlapping or gapping by more than ~1 mm;
  internal dimensions measure within ~1 mm of the input (~2 mm on box 4, where taped seams add
  their own tolerance).
- **Failure:** any style will not close, or is out by more than ~2 mm on boxes 1–3.
- **Inconclusive:** the 100 mm bar did not measure 100 mm — the print was scaled, not the dieline.
  Fix the print setting and start again; nothing measured from a scaled sheet means anything.
- **Then:** Success → proceed to Experiment 2. Failure → fix the geometry, add a regression test
  for the specific defect, repeat. **Do not launch on a failed fold test.**

## Experiment 2 — Does anyone arrive? (validates A1)

- **Measures:** qualified visitors per month from organic search, and which box styles they generate.
- **Audience:** people searching for a specific box style, dieline or case code.
- **Cost:** $0 running cost. A domain (~$14/yr) and roughly 2 hours of owner setup.
- **Duration:** 90 days minimum. Organic search does not report back sooner; judging it at 30 days would mistake indexing lag for absence of demand.
- **Success:** ≥400 qualified visitors in month 3 (enough that a 1% conversion would be visible rather than noise).
- **Failure:** <50 visitors in month 3 **and** no upward trend across months 2→3.
- **Inconclusive:** 50–400, or a clear upward trend that has not yet plateaued → extend to 180 days; the asset costs ~$1.17/month to hold, so waiting is nearly free.
- **Then:** Failure → the problem is distribution, not the product. Do **not** rebuild the tool. Either find a channel where a new entrant is visible, or retire it and take the next candidate. Success → read Experiment 3.

## Experiment 3 — Do they pay? (validates A2)

Runs on the same traffic as Experiment 2; no extra cost.

- **Measures:** of visitors who generate a dieline, how many attempt an export on a licensed style (intent), and how many buy.
- **Success:** ≥1.5% of visitors who generate any dieline attempt a locked export, **and** ≥8% of those who attempt one buy.
- **Failure:** <0.3% attempt a locked export across ≥400 visitors. That means the free styles are enough, or the paid catalogue is not the thing they wanted.
- **Inconclusive:** locked-export attempts are healthy but purchases are near zero → the objection is price, trust or checkout friction, not the product. Test in this order: (1) add a printed sample gallery to prove output quality, (2) test $19, (3) re-examine the checkout.
- **Then:** Failure → the depth is not worth paying for. Record it and move to the next candidate rather than adding styles.

## What would make me abandon this

If Experiment 2 fails *and* a serious attempt at a second channel also fails, the correct
conclusion is that this niche cannot be reached by a new entrant without an audience or a
budget — which is a finding about the **channel**, not about box geometry. The runner-up
analysis in the decision memo is the place to restart, not a redesign of this tool.

## Deliberately not doing

- **No fake scarcity, no countdown timers, no invented testimonials, no fabricated user counts.**
- **No pre-orders.** The product is finished; there is nothing to pre-sell.
- **No claims of demand we have not measured.** Every number above is a threshold to test against, not a forecast.
