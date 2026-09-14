#!/usr/bin/env node
/**
 * Economics model. Every input is declared here and labelled as ASSUMED or
 * SOURCED, so nothing in the output is a number I invented silently.
 */
const I = {
  // --- SOURCED --------------------------------------------------------
  price:            { v: 39,    t: '$', src: 'SOURCED (our decision)', note: 'One-time licence, USD' },
  morPct:           { v: 0.05,  t: '%', src: 'SOURCED', note: 'Lemon Squeezy percentage fee (2026 published rate)' },
  morFixed:         { v: 0.50,  t: '$', src: 'SOURCED', note: 'Lemon Squeezy fixed fee per transaction' },
  intlPct:          { v: 0.015, t: '%', src: 'SOURCED', note: 'LS uplift on international payments' },
  domainYear:       { v: 14,    t: '$', src: 'SOURCED', note: 'typical .com registration/renewal per year' },
  hostingMonth:     { v: 0,     t: '$', src: 'SOURCED', note: 'static site on a free tier; all compute is client-side' },
  // --- ASSUMED (no data - these are the numbers to attack first) -------
  intlShare:        { v: 0.60,  t: '%', src: 'ASSUMED', note: 'share of buyers outside the seller country' },
  refundRate:       { v: 0.05,  t: '%', src: 'ASSUMED', note: 'refunds + disputes as a share of orders' },
  convVisitorToBuy: { v: 0.01,  t: '%', src: 'ASSUMED', note: 'visitor -> purchase; NOT measured, NOT observed' },
};

const P = Object.fromEntries(Object.entries(I).map(([k, o]) => [k, o.v]));
const fee = P.price * (P.morPct + P.intlShare * P.intlPct) + P.morFixed;
const netPerOrder = P.price - fee;
const contribution = netPerOrder * (1 - P.refundRate);
const fixedMonth = P.hostingMonth + P.domainYear / 12;

const money = (n) => (n < 0 ? '-$' : '$') + Math.abs(n).toFixed(2);
const L = [];
L.push('## Inputs\n');
L.push('| Input | Value | Basis | Note |');
L.push('|---|---:|---|---|');
for (const [k, o] of Object.entries(I)) {
  const v = o.t === '%' ? (o.v * 100).toFixed(o.v < 0.02 ? 1 : 0) + '%' : money(o.v);
  L.push(`| \`${k}\` | ${v} | ${o.src} | ${o.note} |`);
}

L.push('\n## Contribution per sale\n');
L.push('| Line | Amount |');
L.push('|---|---:|');
L.push(`| List price | ${money(P.price)} |`);
L.push(`| Merchant-of-record fee (${(P.morPct * 100).toFixed(0)}% + ${money(P.morFixed)}, plus ${(P.intlPct * 100).toFixed(1)}% on ${(P.intlShare * 100).toFixed(0)}% international) | ${money(-fee)} |`);
L.push(`| **Net received per completed order** | **${money(netPerOrder)}** |`);
L.push(`| Less refunds/disputes at ${(P.refundRate * 100).toFixed(0)}% | ${money(-netPerOrder * P.refundRate)} |`);
L.push(`| **Contribution per order (expected)** | **${money(contribution)}** |`);
L.push(`\nMargin: **${((contribution / P.price) * 100).toFixed(1)}%** of list price.`);
L.push(`\n> VAT and sales tax are collected and remitted by Lemon Squeezy as merchant of record. That money is never business income and is excluded here.`);

L.push('\n## Fixed monthly cost\n');
L.push('| Item | Monthly |');
L.push('|---|---:|');
L.push(`| Static hosting (free tier) | ${money(P.hostingMonth)} |`);
L.push(`| Domain (${money(P.domainYear)}/yr) | ${money(P.domainYear / 12)} |`);
L.push(`| **Total fixed** | **${money(fixedMonth)}** |`);
L.push(`\nBreak-even: **${(fixedMonth / contribution).toFixed(2)} sales/month** — about ${Math.ceil(12 * fixedMonth / contribution)} sale(s) a year.`);
L.push(`\nThere is no per-user cost. Geometry, PDF and DXF generation all run in the visitor's browser, so traffic cannot create a bill. The only way costs rise is if the owner chooses to buy something.`);

L.push('\n## Sales needed for illustrative operating-profit levels\n');
L.push('*Planning scenarios, not forecasts.*\n');
L.push('| Monthly operating profit | Sales/month | Gross billed | Qualified visitors/month @ 1% |');
L.push('|---|---:|---:|---:|');
for (const target of [100, 500, 1000]) {
  const n = (target + fixedMonth) / contribution;
  L.push(`| $${target} | ${Math.ceil(n)} | ${money(Math.ceil(n) * P.price)} | ${Math.ceil(Math.ceil(n) / P.convVisitorToBuy).toLocaleString()} |`);
}

L.push('\n### Sensitivity to the conversion rate (the input I have no data for)\n');
L.push('| Visitors/month needed | @0.25% | @0.5% | @1% | @2% |');
L.push('|---|---:|---:|---:|---:|');
for (const target of [100, 500, 1000]) {
  const n = Math.ceil((target + fixedMonth) / contribution);
  L.push(`| for $${target}/mo profit (${n} sales) | ` +
    [0.0025, 0.005, 0.01, 0.02].map((c) => Math.ceil(n / c).toLocaleString()).join(' | ') + ' |');
}

L.push('\n## Scenarios\n');
L.push('| | Conservative | Base | Optimistic |');
L.push('|---|---:|---:|---:|');
const scen = { Conservative: 1, Base: 6, Optimistic: 20 };
const rows = { 'Sales / month': [], 'Gross billed': [], 'Contribution': [], 'Fixed cost': [], 'Operating profit': [], 'Annualised profit': [] };
for (const n of Object.values(scen)) {
  rows['Sales / month'].push(n);
  rows['Gross billed'].push(money(n * P.price));
  rows['Contribution'].push(money(n * contribution));
  rows['Fixed cost'].push(money(-fixedMonth));
  rows['Operating profit'].push(money(n * contribution - fixedMonth));
  rows['Annualised profit'].push(money((n * contribution - fixedMonth) * 12));
}
for (const [k, v] of Object.entries(rows)) L.push(`| ${k} | ${v.join(' | ')} |`);
L.push(`\n- **Conservative (1 sale/month)** — the business is profitable but the profit is trivial: ${money(1 * contribution - fixedMonth)}/month. It costs almost nothing to keep running, so this is a survivable state, not a failure state.`);
L.push(`- **Base (6 sales/month)** — ${money(6 * contribution - fixedMonth)}/month. Requires roughly ${Math.ceil(6 / P.convVisitorToBuy).toLocaleString()} qualified visitors a month at the assumed 1% conversion.`);
L.push(`- **Optimistic (20 sales/month)** — ${money(20 * contribution - fixedMonth)}/month, about ${money((20 * contribution - fixedMonth) * 12)} a year.`);

L.push('\n## What would break this model\n');
L.push('1. **Conversion is the weak input.** 1% is assumed with no evidence. If the real figure is 0.1%, every visitor number above multiplies by ten and the base case needs 60,000 visitors a month, which is not reachable through organic search in this niche.');
L.push('2. **Traffic is the binding constraint, not price or cost.** Doubling the price barely changes the visitor requirement; getting any qualified traffic at all changes everything.');
L.push('3. **Refund rate could be higher than 5%** if buyers expect a style we do not have. The free tier and full preview of paid styles exist partly to prevent that: nobody should pay before seeing exactly what they get.');
L.push('4. **Free dielines from box suppliers** cap willingness to pay for the commodity styles. The defence is breadth and instant any-size output, not the RSC on its own.');

console.log(L.join('\n'));
