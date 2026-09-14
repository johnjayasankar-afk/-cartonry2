// Renders every style to one HTML page for visual inspection.
import { writeFileSync } from 'node:fs';
import { STYLES, generate } from '../src/registry.js';
import { toSVG } from '../src/export/svg.js';
import { sampleFor } from './samples.js';

const cards = STYLES.map((s) => {
  const p = sampleFor(s.id);
  const dl = generate(s.id, p);
  return `<figure>
    <figcaption><b>${dl.name}</b>${dl.code ? ` <code>${dl.code}</code>` : ''}
      <span>${p.L}×${p.W}×${p.H} mm, ${p.t} mm board &nbsp;→&nbsp; blank ${dl.bbox.w}×${dl.bbox.h} mm</span>
    </figcaption>
    <div class="art">${toSVG(dl, { margin: 6, strokeMm: Math.max(0.5, dl.bbox.w / 700) })}</div>
  </figure>`;
}).join('\n');

writeFileSync('test/contact-sheet.html', `<!doctype html><meta charset="utf-8">
<title>Cartonry — all styles</title>
<style>
 body{font:12px system-ui;margin:0;padding:10px;background:#fff;color:#111}
 h1{font-size:.95rem;margin:0 0 8px}
 .sheet{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
 figure{margin:0;border:1px solid #e3e6e9;border-radius:6px;overflow:hidden}
 figcaption{padding:5px 7px;background:#f6f7f8;border-bottom:1px solid #e3e6e9;font-size:.68rem;line-height:1.35}
 figcaption span{color:#667;display:block}
 code{background:#fff;border:1px solid #dde;padding:0 3px;border-radius:3px;font-size:.62rem}
 .art{padding:6px;text-align:center;height:112px;display:flex;align-items:center;justify-content:center}
 .art svg{max-width:100%;max-height:100px;height:auto}
</style>
<h1>Cartonry — every box style, rendered from the geometry engine</h1>
<div class="sheet">${cards}</div>`);
console.log(`wrote test/contact-sheet.html (${STYLES.length} styles)`);
