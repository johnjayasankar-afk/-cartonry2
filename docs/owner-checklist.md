# Owner Checklist

Everything that could be built without you is built. What remains needs either your
identity, your bank details, or your money — none of which I can or should supply.

**I have not created any account, bought anything, started any trial, or contacted anyone.
Actual spend so far: $0.00.**

Do them in order. Step 1 is free and gates everything else.

---

## Step 1 — Fold three boxes (30 minutes, $0) — **do this before anything else**

The geometry passes 146 automated tests, including checks that each blank's enclosed area
matches the panels that ought to be there. But software cannot tell you a printed dieline
folds into a box of the right size. Until someone folds one, the core claim is unverified.

1. Run the site locally: `cd prototype && npm run dev`, open <http://localhost:8932>.
2. **First, look at the 3D fold.** Pick a style, press **3D fold**, and watch the blank close.
   The software already measures the assembled box in its test suite, so this is a sanity check
   on your eyes as much as on the geometry — but it is a fast way to spot anything absurd.
3. Generate and export the PDF for each of:
   - **Regular Slotted Container**, 60 × 40 × 30 mm, board 0.5 mm
   - **Tuck-top mailer box**, 90 × 70 × 30 mm, board 0.5 mm  *(a paid style — unlock it locally by editing `free: false` to `true` in `src/styles/misc.js`, or just use the two free ones)*
   - **Sleeve**, 60 × 40 × 25 mm, board 0.5 mm
4. Print **at 100% scale** — turn OFF "fit to page" / "shrink to fit".
5. **Measure the printed blank first.** It must match the "Blank size" the app showed, and the
   dimension lines printed on the drawing tell you what to expect. If it does not match, your
   printer scaled it; fix that before judging the dieline.
6. Cut the solid magenta lines. Score and fold the dashed blue lines. Assemble.

**Pass:** each one closes, flaps meet within about a millimetre, internal size matches what you typed.
**Fail:** anything will not close, or is out by more than ~2 mm → tell me which style and which
dimensions, and I will fix the geometry and add a regression test for it.

Do not go further on a failed fold test.

---

## Step 2 — Put it online (20 minutes, **$0**)

Free static hosting is enough: everything runs in the visitor's browser, so there is no
server to pay for and traffic cannot generate a bill.

1. Create a free account at **Cloudflare Pages** or **Netlify** (either is fine; both have a
   permanent free tier adequate for this).
2. Deploy the `prototype/` folder as a static site. No framework, no environment variables,
   no secrets. Drag-and-drop deployment works. The `_headers` file already carries sensible
   cache and security headers for both hosts.
3. You will get a free address like `cartonry.pages.dev`. **That is enough to start.**
4. Once you know the address, run `npm run build -- --base https://that-address` and redeploy.
   That writes the correct canonical URLs into the eleven box-style reference pages and into
   `sitemap.xml`. It takes a second and matters for search.

**A custom domain is optional and is the only thing worth buying (~$14/year).** It helps
search ranking and looks more credible to a professional buyer. I have not registered one —
that is real money and needs your say-so. Tell me to proceed and I will check availability
and give you exact names and prices before anything is bought.

*Optional, $0:* to get visitor numbers for the demand test, turn on **Cloudflare Web
Analytics** (cookieless, no personal data — `privacy.html` already describes it accurately).
Paste the token into `analytics` in `prototype/src/config.js`. Without it you will be flying
blind on Experiment 2.

---

## Step 3 — Open a merchant-of-record account (30–40 minutes, $0 to open)

A merchant of record is the seller of record for tax purposes. They charge the customer,
collect and remit VAT/sales tax worldwide, and pay you the balance. This is the single
biggest reduction in your ongoing obligations: **you never register for VAT anywhere.**

Choose one:

| | Lemon Squeezy | Polar |
|---|---|---|
| Fee | 5% + $0.50 (+~1.5% international) | 5% + 50¢ starter; lower on paid plans |
| Merchant of record | Yes | Yes |
| Licence keys | Yes, browser-callable validation | Yes, browser-callable validation |
| Both supported by our code? | Yes (`provider: 'lemonsqueezy'`) | Yes (`provider: 'polar'`) |

Either works — the licence code supports both and is tested against both response shapes.

**Verify these yourself at signup; I could not confirm them from official pages** (Lemon
Squeezy's site refuses automated requests, so my figures for it come from secondary 2026
sources): current fee, **minimum payout threshold** (reported around $100 for Lemon Squeezy —
this decides how many sales you need before any money moves), payout schedule, and whether
your country is supported for bank payout.

You will need: your legal name/business details, a bank account or PayPal, and a tax form
(W-9 if US, W-8BEN if not). Have them to hand.

---

## Step 4 — Create the product (15 minutes)

In your provider's dashboard:
1. New product: **"Cartonry — full box style licence"**, one-time, **$39 USD**.
2. Turn **licence keys ON**. Set activations to **3** (enough for a laptop, a desktop and a
   work machine; low enough that a key cannot be shared widely).
3. No expiry. It is a permanent licence — say so, and mean it.
4. Copy the hosted checkout URL.

## Step 5 — Wire it up (5 minutes, no secrets involved)

Edit `prototype/src/config.js` only. **There are no API keys or secrets anywhere in this
project** — licence checks are authenticated by the customer's own key, so nothing sensitive
is ever shipped to the browser. Set:

- `provider` — `'lemonsqueezy'` or `'polar'` (and `organizationId` if Polar)
- `checkoutUrl` — from Step 4
- `supportEmail` — an address you will actually read
- `paymentsLive: true` — **only after Step 6 passes**

While `paymentsLive` is false the site plainly says it is not on sale and links to no
checkout, so nobody can be taken to a dead payment page.

## Step 6 — Buy it yourself once (15 minutes, ~$39 refundable)

The only way to prove the money path end to end. Providers' test modes do not exercise real
payout plumbing.

1. Use the provider's **test mode** first if available; confirm a licence key is emailed.
2. Then make **one real purchase** at full price with your own card.
3. Check, in order: receipt arrives → licence key arrives → pasting the key into the site
   unlocks all styles → a paid style exports a PDF and a DXF → the order shows in the
   dashboard with tax handled → "Release this browser" frees the seat → the key re-activates.
4. **Refund yourself** from the dashboard, and confirm the licence stops unlocking on the
   next check.

This is a test purchase, not revenue. It must never be reported as a customer sale.

## Step 7 — Tell me to launch

Publishing, listing anywhere, or contacting anyone needs your explicit go-ahead, and I have
done none of it. When Steps 1–6 pass, say so and I will prepare the launch material for your
review before anything is published.

---

## Time and money summary

| Step | Your time | Cost |
|---|---|---|
| 1 Fold test | 30 min | $0 |
| 2 Deploy | 20 min | $0 (domain optional, ~$14/yr) |
| 3 MoR account | 30–40 min | $0 |
| 4 Product setup | 15 min | $0 |
| 5 Config | 5 min | $0 |
| 6 Test purchase | 15 min | ~$39, refunded to yourself |
| **Total** | **~2 hours, once** | **$0 required** |

## What I will never do on your behalf

Create accounts or sign up as you · enter card, bank or tax details · accept terms in your
name · make a live charge, purchase or refund · publish, list or message anyone without you
saying so · claim payouts are enabled before you have seen money move.
