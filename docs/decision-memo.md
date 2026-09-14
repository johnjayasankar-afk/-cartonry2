# Decision Memo

**Date:** 2026-09-04 · **Decision:** Build a parametric packaging **dieline generator** — a browser-based tool that produces production-ready cutting templates for standard box styles at any dimension. **Runner-up:** a Confluence glossary app on Atlassian Forge.

---

## The decision

Build **a client-side dieline generator**, indexed by the standard fibreboard case codes professionals already search by, exporting SVG free and PDF (true scale) + DXF on payment, sold as a one-time licence through a merchant of record.

## Why

**1. It is the only candidate where the depth advantage is still unclaimed.**
My one durable advantage is doing a large amount of careful, correct work at near-zero marginal cost. That advantage only pays where nobody has done that work yet. In sheet-metal layout — which had the *best* price anchors I found ($940 incumbent) — CaldereriaOnLine already spans ten shape families. The moat was occupied. In dielines, the free option (templatemaker.nl) is hobbyist with a limited style set, and the comprehensive options are enterprise CAD. The middle is empty.

**2. The buyer searches by standard code, which is exactly what a catalogue serves.**
Of 821 distinct query phrasings captured from Google's suggest endpoint, **197 reference FEFCO codes** and a further 41 name specific styles (mailer box, tray, sleeve, rigid box, pizza box). Only ~10% carry a "free" signal — markedly lower than the tool categories I rejected, where "free" dominated. People searching "FEFCO 0201 template" or "mailer box dieline template illustrator" know precisely what they want.

**3. Cost structure lets the business wait.**
All geometry runs in the browser. No server, no per-use cost, no scaling risk, no third-party runtime dependency. Hosting is a static free tier. Because carrying cost is ~$0, slow organic discovery costs nothing but time — which matters, because distribution is the honest weak point.

**4. Near-zero maintenance.**
Box geometry does not change. There is no format to track, no API to follow, no platform to keep up with. This is the single strongest fit with "exceptionally little ongoing work". Contrast C6, where new bank PDF layouts would demand attention forever.

**5. I can build *and verify* it now, with no accounts.**
Dieline correctness is objectively checkable: panels must sum to the correct girth, folds must partition the outline, flaps must meet, and re-folding must reproduce the requested internal dimensions. I can prove those properties in tests rather than assert them. Every other finalist needed an account before anything could be run.

## Why the runner-up lost

The Confluence glossary app had the **strongest demand evidence of anything I found**: ~2,150 paid installs across 14 apps, 148+ reviews, incumbents stuck at 3.5–4.2★, and the best economics available anywhere (0% revenue share to $1M, Atlassian as merchant of record, Atlassian hosting). On demand evidence alone it beat the winner.

It lost on a fact I only found by reading the actual review text: customers are angry that **term highlighting requires a browser extension**. That is not vendor incompetence — Confluence Cloud apps render in a sandboxed iframe and cannot decorate page body text, which is why *every* vendor ships a separate Chrome/Firefox add-on. The single thing customers complain about most is the one thing I could not fix either. A wedge built on "the incumbents are bad" collapses when the incumbents are bad for a reason that also binds me.

Two secondary marks against it: I cannot create the Atlassian account needed to build or verify anything, so it could only ever have been delivered as unrun code; and Forge moved to consumption-based pricing on 2026-01-01, so infrastructure cost is no longer strictly zero.

The wider lesson, recorded in the ledger: **low ratings inside a platform often measure platform constraints rather than addressable gaps.** That materially weakens "find a badly-rated marketplace category" as a general strategy, and I have downgraded it accordingly.

## What I am NOT claiming

- **No proof of demand yet.** I have evidence that the *problem* exists, that professionals search by standard code, and that adjacent paid products exist. I do **not** have evidence that anyone will pay *me*. Query breadth is not volume — I have no volume data and have invented none.
- **Distribution is the weak point and it is slow.** Organic search realistically takes months and may never rank for competitive head terms. This is the most likely way the business fails.
- **The free-dieline-from-your-printer risk is real.** Many buyers get dielines free from their box supplier. The segment I serve is people who need one *before* choosing a supplier, or who need many variants while designing.

## Kill criteria

If, after the free tier has been genuinely exposed to qualified traffic, the free→paid export-intent rate is indistinguishable from zero, the correct response is to conclude the depth is not worth paying for and move to the next candidate — not to spend more defending it. Thresholds are set in `docs/experiments.md`.
