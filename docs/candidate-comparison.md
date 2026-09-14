# Candidate Comparison

Seven materially different candidates, all researched against primary sources.
Evidence references (E1–E11) are in [`research/evidence-ledger.md`](../research/evidence-ledger.md).

Scoring weights from the brief:
| Criterion | Weight |
|---|---|
| Evidence of willingness to pay | 25% |
| Accessible distribution without an audience | 20% |
| Low ongoing owner workload | 20% |
| Unit economics | 15% |
| Speed & cost of validation and delivery | 10% |
| Legal & platform simplicity | 10% |

Scores are 0–10, assigned from the evidence gathered, not from intuition.

---

## C1 — Confluence glossary app (Atlassian Forge)

1. **Buyer / trigger.** Confluence Cloud admins at mid-size companies; onboarding and inconsistent internal terminology.
2. **Current alternative.** A Confluence page listing terms, maintained by hand.
3. **Evidence of monetary value.** Strong (E9): ~2,150 paid installs across 14 apps; 148+ reviews.
4. **Competitors / prices.** Smart Terms Glossary (1,207 inst, 4.2★), Glossary for Confluence (791 inst, **3.5★**), two more at 3.6★. Per-user monthly pricing.
5. **Reason to choose ours.** Would have been: fast, accurate matching; working import; duplicate detection.
6. **Initial channel.** Atlassian Marketplace in-product search.
7. **Build effort / dependencies.** Medium. Hard dependency on an Atlassian account I cannot create.
8. **Maintenance / support.** Low-medium; uniform environment.
9. **Legal / platform.** Single-platform dependency; 0% revenue-share is an incentive programme that can change.
10. **Economics.** Best available: 0% rev share to $1M, Atlassian is merchant of record, Atlassian hosts.
11. **Why it fails.** **It does fail** (E10). The top complaint — automatic term highlighting — needs a browser extension because Confluence Cloud apps render in a sandboxed iframe and cannot decorate page body text. Every vendor ships an extension. I cannot fix the thing customers are angry about.
12. **Cheapest test.** Reading the review corpus via the Marketplace API. **I ran it. It killed the candidate.**

| Crit | Pay | Dist | Work | Econ | Speed | Legal | **Weighted** |
|---|---|---|---|---|---|---|---|
| Score | 9 | 6 | 5 | 9 | 4 | 5 | **6.70** |

**REJECTED — fatal dependency.** Highest demand evidence of any candidate, but the dissatisfaction is a platform limit, not an addressable gap. Per the brief, a fatal dependency overrides a high score.

---

## C2 — Parametric packaging dieline generator ✅ SELECTED

1. **Buyer / trigger.** Packaging/graphic designers, small brand owners and print brokers who need a correctly-dimensioned cutting template *before* artwork can begin.
2. **Current alternative.** Beg a dieline from the printer (only after committing to that printer), redraw by hand in Illustrator, or use a free hobbyist generator with a handful of styles.
3. **Evidence of monetary value.** Moderate–good: a paid tool tier exists (Packmage), enterprise CAD exists (Esko ArtiosCAD), and dieline packs sell on asset marketplaces. Price signal in queries is only ~10% "free" (83 of 821).
4. **Competitors / prices.** templatemaker.nl (free, hobbyist, limited styles); Packmage (paid); ArtiosCAD (enterprise). No comprehensive, correct, browser-based, standards-indexed generator found.
5. **Reason to choose ours.** Breadth of standard styles at *any* dimension, with correct board-thickness allowances, and production formats (PDF at true scale, DXF) — the depth incumbents lack.
6. **Initial channel.** Long-tail search on specific style + code queries. 821 distinct phrasings captured; **197 reference FEFCO codes**, i.e. professionals search by standard code.
7. **Build effort / dependencies.** Low–medium. Pure geometry. **Zero third-party runtime dependencies; no accounts needed to build or verify.**
8. **Maintenance / support.** Very low. Box geometry does not change. Output is self-evidently right or wrong.
9. **Legal / platform.** No regulated activity, no personal data, no licensed dataset. One care point: use FEFCO codes only as factual identifiers, never reproduce FEFCO's copyrighted catalogue drawings or text, and state non-affiliation.
10. **Economics.** ~97% contribution margin; $0 fixed cost (static hosting free tier, all computation in the browser).
11. **Why it might fail.** Buyers may keep getting dielines free from their box supplier; long-tail search takes months and may never rank; price expectations skew low.
12. **Cheapest test.** Ship a genuinely useful free tier, instrument which styles/sizes are generated and where export is attempted, and measure free→paid intent before spending anything.

| Crit | Pay | Dist | Work | Econ | Speed | Legal | **Weighted** |
|---|---|---|---|---|---|---|---|
| Score | 6 | 7 | 9 | 9 | 9 | 9 | **7.70** |

---

## C3 — Sheet-metal / plate flat-pattern development

1. **Buyer.** Fabrication shops, HVAC sheet-metal, insulation cladding contractors.
2. **Alternative.** $940 desktop software, manual layout, or free single-shape calculators.
3. **Evidence.** Strong price anchors: Plate'n'Sheet Pro **$940** one-time; FastCAM Tradesman $99; CaldereriaOnLine sells download credits.
4. **Competitors.** Plate'n'Sheet, FastSHAPES, CaldereriaOnLine (freemium, ~10 categories), dxfcreator.com, free freeware cone calculators.
5. **Wedge.** Price and modern UX only.
6. **Channel.** Search — but only **71** distinct query phrasings, ~3× narrower than dielines.
7–10. Low maintenance, good margins, no legal exposure.
11. **Why it fails.** **The incumbents already hold the depth moat.** CaldereriaOnLine spans cylinders, cones, transitions, Ys, triple-Ys, elbows, branches, helixes, spheres and profiles. My only differentiation strategy — depth — is the incumbent's existing position.
12. **Cheapest test.** Competitor catalogue audit. **I ran it; it disqualified the candidate.**

| Crit | Pay | Dist | Work | Econ | Speed | Legal | **Weighted** |
|---|---|---|---|---|---|---|---|
| Score | 8 | 4 | 9 | 8 | 8 | 9 | **7.10** |

**Rejected:** loses the differentiation contest despite the best price anchors.

---

## C4 — Maker/CNC file catalogue (Etsy / Cults3D)

Buyer: hobbyists with laser/CNC/3D printers. Evidence (E5) is of a **price race to the bottom**: a "400GB CNC Router Files Mega Pack" at $8.63 (75% off), "10K+ DXF designs" at $25.50, a storage-tray file at $1.00; roughly half of page-1 slots are paid ads; bundle provenance is doubtful. Competing means competing with likely-infringing dumps and buying ads.

| Crit | Pay | Dist | Work | Econ | Speed | Legal | **Weighted** |
|---|---|---|---|---|---|---|---|
| Score | 7 | 5 | 9 | 3 | 7 | 5 | **6.10** |

**Rejected:** unit economics and IP environment.

---

## C5 — DTF gang-sheet / print nesting tool

Real, quantified pain (film at $90–140/roll, 20–30% waste). But the tool is a **loss-leader**: film vendors give gang-sheet builders away free to sell consumables, and Google's own suggestions are dominated by "gang sheet builder free" (E6).

| Crit | Pay | Dist | Work | Econ | Speed | Legal | **Weighted** |
|---|---|---|---|---|---|---|---|
| Score | 3 | 5 | 7 | 5 | 7 | 8 | **5.35** |

**Rejected:** cannot out-price a vendor-subsidised free tool.

---

## C6 — Bank statement → accounting-format converter

The richest high-intent query cluster I found (convert to CSV / QBO / QIF / OFX, per-bank and per-accounting-package). Proven one-time pricing (~$60, ProperSoft). **Rejected on two independent grounds:** (a) parsing arbitrary bank PDF layouts is a permanent maintenance treadmill, directly contradicting the <1 hr/month target; (b) QuickBooks .QBO import requires an Intuit-issued FID/INTU.BID, a licensing gate. Also handles sensitive financial data.

| Crit | Pay | Dist | Work | Econ | Speed | Legal | **Weighted** |
|---|---|---|---|---|---|---|---|
| Score | 8 | 7 | 2 | 7 | 5 | 4 | **5.85** |

---

## C7 — Deed / metes-and-bounds plotter

Buyers: title examiners, land attorneys, surveyors. Paid incumbents ~$100–200 (Deed Plotter, 32 years; Sandy Knoll). **Rejected:** free substitutes already exist (tractplotter.com, Plat Plotter), the category is being actively disrupted by AI entrants (DeedAI, DeedPro), the market is essentially US-only, and buyers are conservative about trusting an unknown vendor.

| Crit | Pay | Dist | Work | Econ | Speed | Legal | **Weighted** |
|---|---|---|---|---|---|---|---|
| Score | 6 | 4 | 8 | 8 | 6 | 7 | **6.30** |

---

## Ranking

| Rank | Candidate | Score | Outcome |
|---|---|---|---|
| 1 | **C2 Packaging dieline generator** | **7.70** | **SELECTED** |
| 2 | C3 Sheet-metal flat patterns | 7.10 | Rejected — incumbent holds the depth moat |
| 3 | C1 Confluence glossary | 6.70 | Rejected — fatal platform dependency |
| 4 | C7 Deed plotter | 6.30 | Rejected — free substitutes + AI disruption |
| 5 | C4 Maker file catalogue | 6.10 | Rejected — race to the bottom |
| 6 | C6 Statement converter | 5.85 | Rejected — maintenance treadmill + licensing gate |
| 7 | C5 DTF gang sheets | 5.35 | Rejected — vendor-subsidised free incumbent |

**Honest note on the scores.** C1, C2 and C3 are within one point of each other. The scores structure the judgement; they do not manufacture certainty. C1 and C3 were eliminated by specific disqualifying facts (a platform limit; an incumbent already occupying the intended wedge), not by their totals.
