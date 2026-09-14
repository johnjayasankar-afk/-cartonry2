# Economics Model

> Regenerate with `node docs/economics.js`. Every figure below is computed, not typed —
> the model is the script, this file is its output plus commentary.

**Revenue model:** one-time licence, $39. Deliberately *not* a subscription. There is no
continuing service to justify a recurring charge — the customer downloads files and owns
them — and a subscription would create the exact ongoing work the owner does not want:
cancellations, dunning, failed-card emails and renewal disputes.

## Inputs

| Input | Value | Basis | Note |
|---|---:|---|---|
| `price` | $39.00 | SOURCED (our decision) | One-time licence, USD |
| `morPct` | 5% | SOURCED | Lemon Squeezy percentage fee (2026 published rate) |
| `morFixed` | $0.50 | SOURCED | Lemon Squeezy fixed fee per transaction |
| `intlPct` | 1.5% | SOURCED | LS uplift on international payments |
| `domainYear` | $14.00 | SOURCED | typical .com registration/renewal per year |
| `hostingMonth` | $0.00 | SOURCED | static site on a free tier; all compute is client-side |
| `intlShare` | 60% | ASSUMED | share of buyers outside the seller country |
| `refundRate` | 5% | ASSUMED | refunds + disputes as a share of orders |
| `convVisitorToBuy` | 1.0% | ASSUMED | visitor -> purchase; NOT measured, NOT observed |

## Contribution per sale

| Line | Amount |
|---|---:|
| List price | $39.00 |
| Merchant-of-record fee (5% + $0.50, plus 1.5% on 60% international) | -$2.80 |
| **Net received per completed order** | **$36.20** |
| Less refunds/disputes at 5% | -$1.81 |
| **Contribution per order (expected)** | **$34.39** |

Margin: **88.2%** of list price.

> VAT and sales tax are collected and remitted by Lemon Squeezy as merchant of record. That money is never business income and is excluded here.

## Fixed monthly cost

| Item | Monthly |
|---|---:|
| Static hosting (free tier) | $0.00 |
| Domain ($14.00/yr) | $1.17 |
| **Total fixed** | **$1.17** |

Break-even: **0.03 sales/month** — about 1 sale(s) a year.

There is no per-user cost. Geometry, PDF and DXF generation all run in the visitor's browser, so traffic cannot create a bill. The only way costs rise is if the owner chooses to buy something.

## Sales needed for illustrative operating-profit levels

*Planning scenarios, not forecasts.*

| Monthly operating profit | Sales/month | Gross billed | Qualified visitors/month @ 1% |
|---|---:|---:|---:|
| $100 | 3 | $117.00 | 300 |
| $500 | 15 | $585.00 | 1,500 |
| $1000 | 30 | $1170.00 | 3,000 |

### Sensitivity to the conversion rate (the input I have no data for)

| Visitors/month needed | @0.25% | @0.5% | @1% | @2% |
|---|---:|---:|---:|---:|
| for $100/mo profit (3 sales) | 1,200 | 600 | 300 | 150 |
| for $500/mo profit (15 sales) | 6,000 | 3,000 | 1,500 | 750 |
| for $1000/mo profit (30 sales) | 12,000 | 6,000 | 3,000 | 1,500 |

## Scenarios

| | Conservative | Base | Optimistic |
|---|---:|---:|---:|
| Sales / month | 1 | 6 | 20 |
| Gross billed | $39.00 | $234.00 | $780.00 |
| Contribution | $34.39 | $206.33 | $687.78 |
| Fixed cost | -$1.17 | -$1.17 | -$1.17 |
| Operating profit | $33.22 | $205.17 | $686.61 |
| Annualised profit | $398.67 | $2462.01 | $8239.37 |

- **Conservative (1 sale/month)** — the business is profitable but the profit is trivial: $33.22/month. It costs almost nothing to keep running, so this is a survivable state, not a failure state.
- **Base (6 sales/month)** — $205.17/month. Requires roughly 600 qualified visitors a month at the assumed 1% conversion.
- **Optimistic (20 sales/month)** — $686.61/month, about $8239.37 a year.

## What would break this model

1. **Conversion is the weak input.** 1% is assumed with no evidence. If the real figure is 0.1%, every visitor number above multiplies by ten and the base case needs 60,000 visitors a month, which is not reachable through organic search in this niche.
2. **Traffic is the binding constraint, not price or cost.** Doubling the price barely changes the visitor requirement; getting any qualified traffic at all changes everything.
3. **Refund rate could be higher than 5%** if buyers expect a style we do not have. The free tier and full preview of paid styles exist partly to prevent that: nobody should pay before seeing exactly what they get.
4. **Free dielines from box suppliers** cap willingness to pay for the commodity styles. The defence is breadth and instant any-size output, not the RSC on its own.
