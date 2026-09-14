# Evidence Ledger

Legend: **[D]** direct evidence · **[I]** indirect evidence · **[H]** hypothesis

---

### E1. Merchant-of-record providers handle global VAT/sales tax at ~5% + $0.50
- **Source:** Multiple 2026 comparisons (Paddle, Lemon Squeezy, Polar, Gumroad). Accessed 2026-09-04.
- **Establishes:** [I] Prevailing MoR fee band is ~5%+$0.50; Gumroad ~10%+$0.50 direct / 30% via Discover. MoR removes owner obligation to register for VAT in each country.
- **Uncertainty:** Country eligibility for the owner's (unknown) jurisdiction not yet verified. Fee accuracy must be confirmed on official pricing pages before commitment.
- **Next test:** Read official pricing/eligibility pages of the finalist provider.

### E2. Figma Community is CLOSED to new paid-file creators
- **Source:** https://help.figma.com/hc/en-us/articles/12067637274519-About-selling-Community-resources — accessed 2026-09-04.
- **Establishes:** [D] Figma states "We are not approving new creators to sell paid files on Community at this time." Fee 15%; Figma handles delivery, refunds, support, sales tax; payouts to 80+ countries; 30 business-day hold.
- **Implication:** FATAL DEPENDENCY for any Figma-paid-file channel. Excluded.

### E3. Shopify App Store: favourable rev-share, but most apps earn nothing
- **Source:** shopify.dev revenue-share changelog + 2026 benchmark write-ups. Accessed 2026-09-04.
- **Establishes:** [I] Developers keep 100% of first $1M gross annual app revenue (from 2025-01-01), 85% above. Widely-reported benchmark commentary says most apps earn <$1K MRR.
- **Uncertainty:** Third-party benchmark numbers are not audited. Support burden for merchant-facing apps is the key unknown.
- **Next test:** Only relevant if a Shopify app becomes a finalist.

### E4. Atlassian Forge economics are excellent — but marketplace listing is NOT distribution
- **Source A (economics):** https://developer.atlassian.com/platform/marketplace/pricing-payment-and-billing/ and https://www.atlassian.com/blog/development/updates-to-marketplace-revenue-share-2026 — accessed 2026-09-04.
- **Establishes:** [D] For "Paid via Atlassian" apps, **Atlassian is the merchant of record**. Forge apps meeting eligibility (Forge-only modules, Forge auth, Forge UI) pay **0% revenue share up to $1M lifetime** from 2026-01-01. Atlassian hosts Forge apps. Payout threshold **$500 USD profit**, remitted within 30 days of month-end. Sells everywhere except US-embargoed countries.
- **Source B (demand reality):** Atlassian Marketplace public REST API `/rest/2/addons?hosting=cloud&cost=paid&withPricingInfo=true` — harvested 3,341 paid cloud apps (Jira capped at API paging limit 2,000; Confluence 1,341), 2026-09-04. Raw data: `research/data/atlassian_paid_cloud.json`.
- **Establishes:** [D] Install counts for paid cloud apps are brutally power-law:
  - p50 = **29 installs**; p75 = 163; p90 = 728; p95 = 1,467; p99 = 5,457; max 62,523.
  - **30% of paid cloud apps have fewer than 10 installs.** Only 13% have ≥500.
- **What this establishes:** Simply listing on a mature marketplace does **not** produce distribution. The cold-start problem exists *inside* marketplaces too. This is direct evidence against a core assumption I held at the start.
- **Important uncertainty:** Atlassian Cloud apps are typically free under a user threshold, so installs overstate paying customers. Install counts also accumulate over an app's whole life. Neither correction makes the median look better.
- **Decision impact:** Downgrades "list it on a marketplace" as a distribution strategy in general. Raises the weight of *specific-query capture* (searcher knows what they want; few good results exist).

### E5. Consumer/maker digital-file marketplaces are a price race to the bottom
- **Source:** Etsy search results for "cnc dxf files", read directly in browser 2026-09-04.
- **Establishes:** [D] Observed on page 1: "400GB CNC Router Files Mega Pack" at $8.63 (75% off $34.53); "10K+ CNC Dxf Panel Designs" $25.50 (25% off); "160+ Wooden Box Laser Cut Bundle" $5.48 (50% off); a CNC storage tray file at $1.00. Roughly half of page-1 slots were paid ads.
- **What this establishes:** Heavy discounting is the norm; huge bundles of thousands of files sell for single-digit dollars; visibility on page 1 substantially requires paid ads. Original functional designs do better (a Santa Maria grill DXF at $25.00, a firepit/chair DXF set at $144.32) but each requires bespoke design work per SKU.
- **Uncertainty:** Etsy does not expose per-listing sold counts in search results, so this is price/competition evidence, not volume evidence. Provenance of "10K+/400GB" bundles is doubtful — competing against likely-infringing dumps is itself a reason to avoid.
- **Decision impact:** Eliminates the "parametric maker-file catalog" candidate. Per-SKU economics are poor, ads are required, and the competitive set includes IP dumping.

### E6. Tool categories funded as loss-leaders cannot be monetised
- **Source:** Google Suggest mining (`research/data/scan_*.json`) + DTF industry pages, accessed 2026-09-04.
- **Establishes:** [D] For "gang sheet builder", "cut list optimizer", "nesting software", "box dieline generator", "solar panel layout tool", Google's own suggestions are dominated by "...free" variants. DTF gang-sheet builders are supplied free by film vendors (dtfwestcoast, dtfpromo, raccoontransfers etc.) as customer acquisition for consumable sales.
- **What this establishes:** Where a tool drives sales of a consumable or a platform, an incumbent gives it away. Buyer price expectation is $0.
- **Method note:** Google Suggest evidences *query phrasing that exists*, NOT search volume. I have no volume data and have not estimated any.
- **Decision impact:** Adds a screening rule — reject any candidate whose function is a natural loss-leader for someone selling hardware, consumables, or a platform.

### E7. Every standalone B2B utility niche examined already has a free competitor
- **Source:** Web research + vendor pages, all accessed 2026-09-04.
- **Establishes:** [D] For each niche I costed a paid incumbent, I also found a free substitute:
  | Niche | Paid incumbent | Free substitute found |
  |---|---|---|
  | Sheet-metal flat patterns | Plate'n'Sheet Pro **$940** one-time (Novedge); FastCAM Tradesman $99 | dxfcreator.com, "Flat Pattern Cone Calculator" freeware, CaldereriaOnLine freemium, letsfab.in |
  | Deed / metes-and-bounds plotting | Deed Plotter, Sandy Knoll (~$100–200) | tractplotter.com ("free online deed plotting"), Plat Plotter |
  | Nutrition-facts labels | ReciPal, LabelCalc, Genesis R&D | OnlineLabels free generator |
  | DTF gang sheets | DTFGSA (~$1,092/yr cited) | Free builders from film vendors (loss-leader) |
  | Container/pallet load plans | EasyCargo, Cape Pack | SeaRates free calculator (freight loss-leader) |
- **What this establishes:** On the open web, a free substitute is the default competitive condition for deterministic utilities. Pricing power is weak.
- **Decision impact:** This is the strongest single argument against the standalone-web-tool route, and it emerged only from doing the pricing research on each niche.

### E8. Inside a paid enterprise platform, a free web substitute is structurally impossible
- **Reasoning from E4 + E7.** [I] A Confluence glossary must run *inside* Confluence to highlight terms on pages. No external website can deliver that, regardless of price. The integration point itself is the moat — which is exactly what E7 shows the open web lacks.

### E9. Wedge selected: Confluence glossary/terminology — proven demand, dissatisfied customers
- **Source:** Atlassian Marketplace REST API harvest, 2026-09-04 (`research/data/atlassian_paid_cloud.json`).
- **Establishes:** [D] 14 paid cloud glossary apps. Leaders and their ratings:
  | App | Installs | Reviews | Stars |
  |---|---|---|---|
  | Smart Terms Glossary | 1,207 | 46 | **4.2** |
  | Glossary for Confluence (Terms Definition) | 791 | 84 | **3.5** |
  | Glossary - Terminology Manager | 81 | 11 | **3.6** |
  | Glossary for Confluence Cloud | 74 | 7 | **3.6** |
  - ~2,150+ paid installs and 148+ reviews in the category; every incumbent with a meaningful review count sits at **3.5–4.2 stars**.
- **What this establishes:** Businesses demonstrably pay for this, and the incumbent field is rated mediocre. This is proven demand plus visible dissatisfaction — the strongest wedge shape available.
- **Important uncertainty:** Star ratings tell me customers are unhappy, **not why**. I have not read the review text. That is the single most important open question and the cheapest next experiment.
- **Also uncertain:** Atlassian Cloud apps are free below a user threshold, so installs overstate paying customers.

### E10. Customer reviews reveal WHY glossary incumbents are rated poorly — and it is a platform limit I cannot fix
- **Source:** Atlassian Marketplace reviews API, `/rest/2/addons/{key}/reviews`, pulled 2026-09-04. Raw: `research/data/glossary_reviews.json`.
- **Establishes:** [D] "Glossary for Confluence (Terms Definition)": 86 reviews, star distribution {1★:13, 2★:20, 3★:18, 4★:18, 5★:17} — **51 of 86 reviews at ≤3 stars.** Recurring verbatim complaints across all four apps:
  - Highlighting requires a browser extension — *"Glossary terms in an article are not highlighted. Enabling this feature requires a browser extension. Not doable for our company."* (1★); *"Doesn't work in firefox"* (1★); *"There is no term highlighting in the cloud version"* (2★)
  - Performance — *"Incredibly slow and not useful. Do not recommend."* (1★); *"Incredibly slow, not highlighting words."* (1★)
  - Bugs / rendering interference — *"Too buggy"*; incompatibility with the draw.io app
  - Broken import — *"The importing tool is broken... Half my terms dont import"* (1★)
  - Cloud far weaker than Server; no duplicate detection; search ignores descriptions
  - Price — *"with 100 users, it's $1500/year for a simple glossary"* (1★)
- **Source (cause):** developer.atlassian.com (Forge modules render in a sandboxed iframe; `contextMenu`/`contentAction` act only on user-selected text) + the fact that **every** vendor ships a separate browser extension for highlighting — Simple Glossary, Glossary for Confluence Cloud (Chrome + Firefox add-ons), Terminology Manager. Accessed 2026-09-04.
- **What this establishes:** Confluence **Cloud** apps cannot decorate rendered page body text. Automatic term highlighting — the single most-complained-about gap — is **architecturally unavailable to me too**. Multiple independent vendors hitting the same wall confirms a platform constraint, not vendor incompetence.
- **DECISION: REJECT the Confluence glossary wedge.** It scored highest on demand evidence, but the dissatisfaction is caused by a limit I cannot overcome. Per the brief, a fatal dependency overrides a high score.
- **Wider lesson (important):** Low ratings in Atlassian categories may often measure *platform constraints* rather than addressable product gaps. This materially weakens "find a badly-rated Marketplace category" as a general selection strategy — each candidate would need this same cause-analysis.

### E11. Correction to E7 — free substitutes cap shallow tools, but depth still commands payment
- **Reasoning:** [I] Plate'n'Sheet sells at **$940** one-time and CaldereriaOnLine runs a paid freemium business *despite* free cone/transition DXF generators existing. Free substitutes are shallow (one shape, one case); paid products win on breadth, correctness and reliability.
- **Revised rule:** A free substitute does not by itself disqualify a niche. It caps pricing for *shallow* products. The defensible position is **depth** — which is the one advantage that scales with careful work rather than with audience or capital.

### E12. Software verification is not physical verification — and the difference is not academic
- **Source:** this project's own test suite and build log, 2026-09-05.
- **Establishes:** [D] Three independent software checks were added after the initial 2D geometry
  was already passing 146 tests, and **each found a defect the previous ones had missed**:
  1. **Enclosed-area comparison** (blank area vs the sum of panels that should be present) found
     corner tabs collapsing to 1 mm slivers on the far-side walls of the tray and mailer. A
     bounding-box check cannot see this — the envelope is identical either way.
  2. **Folded-box measurement** (fold the net in 3D, measure the result) found that open wall
     heights had a full caliper of allowance where only half a caliper is correct. Every tray and
     mailer was a caliper too deep.
  3. **The same measurement** found corner tabs rotating outward rather than inward, caused by a
     hinge written descending instead of ascending.
- **What this establishes:** correctness claims are only as strong as the *kind* of check behind
  them. Each new class of test found something the previous class structurally could not.
- **What it does NOT establish:** that a printed dieline folds correctly on real board. No blank
  has been printed and folded. That remains Experiment 1 and it is still the first thing to do.

### E13. An estimate can be arithmetically right and commercially wrong
- **Source:** this project's own estimator, corrected 2026-09-05.
- **Establishes:** [D] The sheet-yield calculator was rotating blanks 90 degrees whenever that
  nested better. The arithmetic was correct. But corrugated flutes and carton-board grain run
  one way down the sheet, and flute direction relative to the box is structural — flutes should
  run vertically in a case so it stacks. A converter with directional board frequently **cannot**
  make that swap, so the tool was quoting a yield the customer could not achieve, always in the
  flattering direction.
- **Fix:** rotation is now opt-in behind a labelled setting that explains the trade-off, and the
  sheet drawing shows the grain direction so the assumption is visible rather than buried.
- **What this establishes:** correctness checks that only test the maths will not catch an
  assumption that is wrong about the world. The error here was a domain fact, not a formula, and
  no unit test on the nesting arithmetic would ever have failed.

### E14. Writing the warning is what found the bug
- **Source:** this project, 2026-09-05.
- **Establishes:** [D] I added a caution for "glue flap larger than half the panel it laps onto".
  It immediately fired on an ordinary 80 × 40 mm folding carton — because the **default** flap was
  35 mm for every style. 35 mm is a corrugated manufacturer's joint; a folding carton uses 6–12 mm,
  since the flap laps onto a panel only a few centimetres wide. Every folding carton the tool had
  ever produced carried a joint roughly three times too big.
- **What this establishes:** encoding domain expectations as checks surfaces defects that no
  amount of testing the *maths* would reach. The geometry was internally consistent throughout;
  the default was simply wrong about the trade. The fix was to make the default format-aware and
  cap it at 45% of the panel, so the value can no longer be wrong rather than merely reported.
- **Pattern, now three times over:** area checks found sliver tabs; folded-box measurement found
  the half-caliper rule and reversed tabs; domain cautions found the glue flap. Each new *kind* of
  check found something the previous kinds structurally could not.

### E15. The tool's own central instruction was physically impossible
- **Source:** measured in this project, 2026-09-05, by generating every catalogue style at its
  default size and comparing the blank against paper sizes.
- **Establishes:** [D] The help text, the reference pages and Experiment 1 all rest on one
  instruction — *print the PDF at 100%, fold it, and check it before you order tooling.* **Ten of
  the eleven styles, at their own default sizes, produce a blank that does not fit on A4.** The
  flagship 200 × 150 × 100 mm shipping case unfolds to 747 × 253 mm, which is larger than A2.
  Offered a page bigger than the paper, a print dialog either scales it — destroying the true
  scale the file exists to carry — or prints one corner.
- **Sharper still:** the fold test in `experiments.md` had already been written around the
  problem, specifying a deliberately tiny 60 × 40 × 30 mm RSC. That blank is **212 mm** wide.
  A4 portrait is 210. The experiment designed to validate the geometry would itself have been
  silently scaled by about ten per cent, and the resulting box would have measured wrong for a
  reason that had nothing to do with the geometry.
- **What this establishes:** a correctness claim can be fully verified in software and still be
  unreachable in practice. Every one of the 283 tests passing before this was measuring the
  drawing. None of them asked whether the customer could hold it. The gap was not in the maths,
  the exports, or the renderers — it was between the last artefact the software produces and the
  first action a human takes with it.
- **Fix:** a tiling exporter that splits the blank across sheets of the reader's own paper at
  1:1, using trim-and-butt rather than overlap-and-align so registration error does not
  accumulate across seams, with a printed 100 mm bar on every sheet so the reader can prove the
  print was not scaled without taking our word for it.
- **Pattern, now four times over:** area checks found sliver tabs; folded-box measurement found
  the half-caliper rule and reversed tabs; domain cautions found the glue flap; asking what the
  customer physically does next found this. Each new *kind* of check found something the
  previous kinds structurally could not.

### E16. Half the interface was written in one unit and half in another
- **Source:** measured in this project, 2026-09-05, by putting the tool into inch mode and
  reading every panel.
- **Establishes:** [D] The unit toggle had been applied where it was first written and nowhere
  since. The readout said `29.41 × 9.96″`; four inches below it the material panel said
  `A 747 × 253 mm blank does not fit a 1200 × 800 mm sheet`, the notes said `Flap depth 75 mm`,
  the sheet menu was metric, the gutter field was labelled `(mm)`, and the print dialog quoted
  the blank in millimetres. Each of those was locally correct and written by someone (me) who
  had the millimetre value in hand and no reason to think about it.
- **What this establishes:** consistency is not preserved by writing each piece correctly. Every
  one of these sites passed review when it was written; the inconsistency only exists *between*
  them, and it is invisible unless you deliberately go and look in the other mode. The fix was
  one formatter in `geom.js` that every display site now calls, plus tests that assert the
  properties that must hold across a unit switch rather than the wording of any one label.

### E17. Making a display consistent produced a silently wrong number
- **Source:** this project, 2026-09-05, caught by the check written alongside the change.
- **Establishes:** [D] Relabelling the board-price field "per ft²" in inch mode was a display
  change. But everything downstream multiplies that figure by an area held in square metres, so
  cost per box and cost for the run silently became **10.76 times too low** — and both still
  looked like plausible money. Nothing on screen indicated a fault.
- **How it was caught:** by asserting the property rather than inspecting the output — the
  quoted cost of a box must not change when the unit toggle is pressed. That check took one line
  and failed immediately; reading the screen would not have flagged £0.036 as wrong.
- **What this establishes:** a change scoped as "display only" can cross into the model wherever
  a displayed value is also an input. The safe boundary is not "is this a label?" but "does
  anything compute with this?" — and money is exactly where the error is least visible and most
  expensive.

### E18. Rounding at the source, not at the display
- **Source:** found by fuzzing 4000 random specifications through every subsystem, 2026-09-05.
- **Establishes:** [D] The blank's board area was stored rounded to three decimals of a square
  metre — a granularity of 1000 mm². A shipping case at 0.189 m² is unaffected. A jewellery
  carton's blank is 3941 mm², which became 0.004 m²; a small hexagon's 855 mm² became 0.001,
  a **17% overstatement**. Anything under 500 mm² became zero. Board area, weight per box and
  **cost per box** are all computed from that one number, so all three were wrong by the same
  proportion for every small box — and small boxes are a real segment, not an edge case.
- **What this establishes:** rounding belongs at the point of display, never at the point of
  storage. The rounded figure looked like a tidy number rather than a lossy one, which is why it
  survived four previous passes of review. Fuzzing found it because it generated sizes no
  hand-written test case would have chosen.
- **Pattern, now six times over:** area checks found sliver tabs; folded-box measurement found
  the half-caliper rule and reversed tabs; domain cautions found the glue flap; asking what the
  customer physically does next found the printing gap; reading the interface in the other unit
  found the mixed units; random specifications found the rounding. Each new *kind* of check found
  something the previous kinds structurally could not.
