#!/usr/bin/env node
/**
 * Generates one reference page per box style, plus sitemap and robots.
 *
 * Each page carries its own written guide, a real dieline drawing and a real
 * folded 3D view - both rendered here as inline SVG, so the page is complete and
 * useful with JavaScript switched off. These are reference pages that happen to
 * link to the tool, not doorway pages wrapped around a link.
 *
 * Run: node tools/build-pages.js [--base https://example.com]
 */
import { mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { STYLES, generate } from '../src/registry.js';
import { GUIDES } from '../src/guides.js';
import { toSVG } from '../src/export/svg.js';
import { toSVG3D } from '../src/render3d.js';
import { foldNet } from '../src/fold.js';
import { sheetYield } from '../src/estimate.js';
import { normaliseParams } from '../src/model.js';

// The asset version lives in sw.js and nowhere else. It used to be a literal
// here too, so rebuilding the reference pages silently reverted them to an
// older stylesheet URL than the one the worker pre-caches.
const ASSET_V = +/^const V = (\d+);/m.exec(
  readFileSync(new URL('../sw.js', import.meta.url), 'utf8'))[1];

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const baseArg = process.argv.indexOf('--base');
const BASE = baseArg > -1 ? process.argv[baseArg + 1].replace(/\/$/, '') : '';

const SAMPLE = {
  'telescope-lid': { L: 200, W: 150, H: 45, t: 1.5 },
  'hexagon': { L: 100, W: 0, H: 120, t: 0.5 },
  'pillow': { L: 90, W: 22, H: 120, t: 0.5 },
  'carton-ste': { L: 80, W: 40, H: 150, t: 0.35 },
  'carton-rte': { L: 80, W: 40, H: 150, t: 0.35 },
  'tray-4corner': { L: 200, W: 150, H: 45, t: 1.5 },
  'mailer-tucktop': { L: 220, W: 160, H: 60, t: 3 },
  'sleeve': { L: 200, W: 150, H: 60, t: 3 },
};
const sampleFor = (id) => SAMPLE[id] || { L: 200, W: 150, H: 100, t: 3 };

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// Two decimals is finer than any die-cutting tolerance and much easier to read.
const mm = (v) => Math.round(v * 100) / 100;

function page(style) {
  const g = GUIDES[style.id];
  const p = sampleFor(style.id);
  const dl = generate(style.id, p);
  const flat = toSVG(dl, { margin: 10, strokeMm: Math.max(0.5, dl.bbox.w / 700) });
  const solid = style.fold
    ? toSVG3D(foldNet(style.fold(normaliseParams(p)), 1), { size: [560, 400] })
    : '';
  // Grain-fixed, the honest default: directional board cannot simply be turned.
  const y = sheetYield(dl.bbox.w, dl.bbox.h, 1200, 800, { gutter: 4, margin: 10 });
  const q = `../index.html?style=${style.id}&l=${p.L}&w=${p.W}&h=${p.H}&t=${p.t}`;
  const related = STYLES.filter((s) => s.id !== style.id)
    .sort((a, b) => (b.family === style.family) - (a.family === style.family)).slice(0, 4);

  const jsonld = {
    '@context': 'https://schema.org', '@type': 'TechArticle',
    headline: g.title, description: g.lede,
    about: { '@type': 'Thing', name: style.name },
    ...(BASE ? { url: `${BASE}/box/${style.id}.html` } : {}),
  };

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(g.title)}</title>
<meta name="description" content="${esc(g.lede)}">
<link rel="canonical" href="${BASE ? `${BASE}/box/${style.id}.html` : `${style.id}.html`}">
<meta property="og:type" content="article">
<meta property="og:title" content="${esc(g.title)}">
<meta property="og:description" content="${esc(g.lede)}">
<meta name="twitter:card" content="summary_large_image">
<link rel="stylesheet" href="../styles.css?v=${ASSET_V}">
<link rel="icon" href="../favicon.svg" type="image/svg+xml">
<script type="application/ld+json">${JSON.stringify(jsonld)}</script>
</head>
<body>
<header class="site"><div class="wrap">
  <a class="brand" href="../index.html">
    <svg width="28" height="28" viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="brandTile" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2c5a42"/><stop offset="1" stop-color="#1a3a2a"/></linearGradient></defs><rect width="64" height="64" rx="18" fill="url(#brandTile)"/><path d="M16 23h32v26H16z" fill="none" stroke="#f0f7f3" stroke-width="4" stroke-linejoin="round"/><path d="M16 23l8-8h16l8 8" fill="none" stroke="#6ee7b7" stroke-width="4" stroke-linejoin="round"/></svg>
    Cartonry</a>
  <nav><a href="../index.html">Generator</a><a href="../index.html#pricing">Pricing</a></nav>
</div></header>

<main class="wrap">
  <nav class="crumbs" aria-label="Breadcrumb">
    <a href="../index.html">Box styles</a> <span aria-hidden="true">›</span> ${esc(style.name)}
  </nav>

  <article class="guide">
    <h1>${esc(style.name)}${style.code ? ` <span class="code">${style.code}</span>` : ''}</h1>
    <p class="lede">${esc(g.lede)}</p>

    <div class="cta-row">
      <a class="cta" href="${q}">Open this style in the generator →</a>
      <span class="cta-note">${style.free
        ? 'Free to export — no account, no signup.'
        : 'Free to preview at your own dimensions.'}</span>
    </div>

    <div class="previews">
      <figure><div class="pv">${flat}</div>
        <figcaption>Dieline at ${p.L} × ${p.W === 0 ? '—' : p.W} × ${p.H} mm internal, ${p.t} mm board.
          Blank ${mm(dl.bbox.w)} × ${mm(dl.bbox.h)} mm.</figcaption></figure>
      ${solid ? `<figure><div class="pv solid">${solid}</div>
        <figcaption>The same blank, folded. Every panel here comes from the same
          geometry the dieline is cut from.</figcaption></figure>` : ''}
    </div>

    <h2>When to use it</h2>
    <p>${esc(g.when)}</p>
    <h2>How it is put together</h2>
    <p>${esc(g.construction)}</p>
    <h2>What to watch for</h2>
    <p>${esc(g.watch)}</p>

    <h2>How it assembles</h2>
    <ol class="steps">${g.assembly.map((t) => `<li>${esc(t)}</li>`).join('')}</ol>

    <h2>At a glance</h2>
    <table class="spec">
      <tbody>
        <tr><th scope="row">Family</th><td>${esc(style.family)}</td></tr>
        ${style.code ? `<tr><th scope="row">Case code</th><td>${style.code}</td></tr>` : ''}
        <tr><th scope="row">Example internal size</th><td>${p.L} × ${p.W === 0 ? '—' : p.W} × ${p.H} mm</td></tr>
        <tr><th scope="row">Blank size</th><td>${mm(dl.bbox.w)} × ${mm(dl.bbox.h)} mm</td></tr>
        <tr><th scope="row">Board used</th><td>${dl.blankAreaM2.toFixed(3)} m² per box</td></tr>
        <tr><th scope="row">On a 1200 × 800 sheet</th><td>${y.perSheet
          ? `${y.perSheet} up, ${y.wastePct}% waste (${y.layout})` : 'does not fit'}</td></tr>
        <tr><th scope="row">Export formats</th><td>SVG, true-scale PDF, DXF (R12, layered)</td></tr>
      </tbody>
    </table>

    <h2>Notes this generator applies</h2>
    <ul class="notes-list">${dl.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>

    <h2>Other box styles</h2>
    <ul class="related">${related.map((s) => `<li><a href="${s.id}.html">${esc(s.name)}</a>
      <span>${esc(s.blurb)}</span></li>`).join('')}</ul>
  </article>
</main>

<footer class="site"><div class="wrap">
  <div class="cols">
    <div class="brand-col"><strong class="foot-brand">Cartonry</strong>
      <p class="note tight">Dielines computed in your browser. No account, no upload, no tracking.</p></div>
    <div><a href="../privacy.html">Privacy</a></div>
    <div><a href="../terms.html">Terms &amp; refunds</a></div>
  </div>
  <p class="foot-note">Fibreboard case codes such as 0201 are the international
    industry designations used to identify box styles. Cartonry is independent and is not affiliated with,
    endorsed by, or derived from the publications of FEFCO or any standards body.</p>
  <p class="labs-credit">An independent product by <a href="https://johnjayasankar.com">John Jayasankar</a>,
    part of <a href="https://labs.johnjayasankar.com">Labs</a>.</p>
</div></footer>
</body></html>`;
}

mkdirSync(join(ROOT, 'box'), { recursive: true });
for (const style of STYLES) {
  const g = GUIDES[style.id];
  if (!g) throw new Error(`No guide written for style "${style.id}" - refusing to emit a thin page.`);
  if (!Array.isArray(g.assembly) || g.assembly.length < 3) {
    throw new Error(`Style "${style.id}" has no assembly steps - refusing to emit a thin page.`);
  }
  writeFileSync(join(ROOT, 'box', `${style.id}.html`), page(style));
}

// Write the style catalogue into index.html as real HTML. Rendering it with
// JavaScript left the eleven reference pages unreachable to a crawler, and to
// anyone browsing without scripts, from the one page most likely to be linked.
const catalogue = '<ul class="related">\n'
  + STYLES.map((s) => `      <li><a href="box/${s.id}.html">${esc(s.name)}</a>`
      + (s.code ? ` <span class="code">${s.code}</span>` : '')
      + (s.free ? ' <span class="lock free">Free</span>' : '')
      + `\n        <span>${esc(s.blurb)}</span></li>`).join('\n')
  + '\n    </ul>\n    <p class="note wide-gap">Each style has a reference page covering when to'
  + ' use it, how it is put together, and what people get wrong.</p>';

const indexPath = join(ROOT, 'index.html');
const index = readFileSync(indexPath, 'utf8');
const startMark = '<!-- CATALOGUE:START (generated by tools/build-pages.js - do not edit by hand) -->';
const endMark = '<!-- CATALOGUE:END -->';
const a = index.indexOf(startMark), b = index.indexOf(endMark);
if (a === -1 || b === -1) throw new Error('Catalogue markers missing from index.html');
writeFileSync(indexPath,
  index.slice(0, a + startMark.length) + '\n    ' + catalogue + '\n    ' + index.slice(b));

const urls = ['index.html', 'privacy.html', 'terms.html',
              ...STYLES.map((s) => `box/${s.id}.html`)];
// A sitemap needs absolute URLs - the protocol requires them, and a sitemap of
// "/box/rsc-0201.html" is rejected rather than merely unhelpful. So it is
// written only when the domain is known. Shipping an invalid one and pointing
// robots.txt at it would be worse than shipping none.
if (BASE) {
  writeFileSync(join(ROOT, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`
    + urls.map((u) => `  <url><loc>${BASE}/${u === 'index.html' ? '' : u}</loc></url>`)
        .join('\n') + `\n</urlset>\n`);
} else {
  try { unlinkSync(join(ROOT, 'sitemap.xml')); } catch { /* nothing to remove */ }
}
writeFileSync(join(ROOT, 'robots.txt'),
  `User-agent: *\nAllow: /\n${BASE ? `Sitemap: ${BASE}/sitemap.xml\n` : ''}`);

console.log(`built ${STYLES.length} style pages + catalogue + robots.txt`
  + (BASE ? ' + sitemap.xml'
          : '\n  No --base given, so no sitemap was written: the protocol requires absolute'
          + '\n  URLs. Once the site has a domain, run:'
          + '\n    npm run build:pages -- --base https://your-domain.example'));
