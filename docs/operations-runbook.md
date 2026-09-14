# Operations Runbook

The architecture is chosen to make this document short. There is **no server, no database,
no scheduled job, no API key and no third-party runtime dependency.** All geometry, PDF and
DXF generation happens in the visitor's browser. The site is static files.

## Recurring tasks

| Task | Frequency | Owner minutes | Automated by | Exception handling |
|---|---|---:|---|---|
| Customer support email | as it arrives | ~5 / message | Help section on the page answers the common questions (which dimensions, which file format, why the print is scaled) | If it is a geometry complaint: reproduce with the stated style + dimensions, fix, add a regression test, redeploy |
| Licence recovery ("lost my key") | rare | ~3 | Provider re-sends licence emails from the dashboard | Look up the order in the provider dashboard, re-send |
| Refund request | rare | ~2 | One click in the provider dashboard | Stated policy is refund on request within 30 days; do not argue |
| Reconcile payouts | monthly | ~5 | Provider emails a remittance report; they are merchant of record and file the tax | Compare dashboard orders to bank credit |
| Check the site still loads | monthly | ~1 | Free uptime ping (optional, see below) | Static host outage: nothing to do but wait; redeploy if the host lost files |
| Review analytics for the demand test | monthly, first 6 months only | ~10 | Cloudflare Web Analytics dashboard | Compare against thresholds in `experiments.md` |
| Dependency / security updates | **never** | 0 | There are no dependencies to update — `package.json` has zero runtime packages | n/a |
| Rebuild the box-style pages | only when a style is added or its guide changes | ~1 | `npm run build` regenerates `box/*.html`, `sitemap.xml`, `robots.txt` and the catalogue block in `index.html` | Re-run and redeploy; nothing else depends on it |
| Platform API changes | **near zero** | 0 | Nothing is called at runtime except the licence endpoint | If the provider changes their licence API, the adapter in `src/license.js` is the only place to edit |

**Steady-state estimate: well under an hour a month once the demand test is over** — realistically
minutes, dominated by whatever support arrives. Support volume is the one number I cannot
predict, so **treat the sub-one-hour target as a design goal to be measured, not a fact.**
It is recorded here so it can be checked against reality after three months.

Startup effort is separate and is roughly **2 hours, once** (see `owner-checklist.md`).

## Why the usual sources of ongoing work are absent

- **No hosting bill and no scaling risk.** Compute happens on the visitor's device. A traffic
  spike costs nothing and cannot take the site down beyond the host's own free-tier limits.
- **No subscription mechanics.** A one-time licence means no dunning, no expiring cards, no
  cancellation flow, no renewal disputes — the largest source of routine support in small
  software businesses simply does not exist here.
- **No tax filing obligations from sales.** The merchant of record is the seller for tax
  purposes and remits VAT/sales tax. *(This does not remove the owner's own income-tax
  obligations on profit received.)*
- **No content treadmill.** Box geometry does not change. Nothing goes stale.
- **No dependency maintenance.** Zero runtime packages means zero advisories to chase.

## Monitoring worth having (all $0, all optional)

1. **Cloudflare Web Analytics** — visitor counts for the demand test. Cookieless.
2. **A free uptime check** (UptimeRobot free tier or similar) pinging the home page every
   30 minutes, alerting by email. Only worth it once there is traffic.
3. **The provider dashboard** is the source of truth for orders, refunds and payouts.

There is deliberately **no error-reporting service**. It would mean a third-party script on
every page, which contradicts the privacy claim that the site makes no third-party requests.
The trade-off is accepted: a silent client-side bug would be found through support rather
than telemetry.

## Cost controls

The only ways money can be spent are ones the owner chooses: a domain renewal (~$14/yr) and
provider fees, which are a percentage of money already received. **There is no metered
resource anywhere in this system**, so there is no runaway-cost scenario to guard against —
which is exactly why the architecture was chosen.

## If something breaks

| Symptom | First check | Fix |
|---|---|---|
| Site loads but no dieline appears | Browser console | A JS error; run `npm test` locally, it will usually reproduce |
| A customer's key will not activate | Provider dashboard: is the order real? has it hit the activation limit? | Release a seat, or re-issue the key |
| Exports produce an empty or broken file | Reproduce the exact style + dimensions | `npm test` covers all three formats; add the failing case as a test first |
| Everyone suddenly cannot activate | Provider status page | If they changed the licence API, patch the adapter in `src/license.js` |

## Deploying a change

```bash
cd prototype && npm test
```
283 tests must be green. If a style or its guide changed, also run:

```bash
npm run build -- --base https://your-domain
```

Then re-upload the folder to the static host. There is no bundler, no transpiler and no
migration; the build step only regenerates the reference pages and the sitemap.

**Bump the asset version.** `index.html`, `privacy.html` and `terms.html` reference
`styles.css?v=N` and `app.js?v=N`, and `sw.js` names its cache `cartonry-vN`. Increment N in
all of them together so returning visitors pick up the change immediately. The `_headers` file
already sets `must-revalidate`, so this is belt and braces rather than strictly required.

Roll back by re-deploying the previous folder.

## The service worker

`sw.js` caches network-first: online visitors always get current code, and offline visitors get
the last version they loaded. That direction matters — serving a stale dieline generator would
be worse than serving nothing. Cross-origin requests (the licence check) are never intercepted.
If a deploy ever appears not to take effect, bump the cache name in `sw.js`; the old cache is
deleted on activation.
