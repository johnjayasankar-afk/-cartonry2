import { test, assert, near } from './harness.js';
import { generate, STYLES } from '../src/registry.js';
import { toSVG, gridStep } from '../src/export/svg.js';
import { toDXF } from '../src/export/dxf.js';
import { toPDF } from '../src/export/pdf.js';
import { PT_PER_MM } from '../src/geom.js';
import { sampleFor } from './samples.js';

const dl = generate('rsc-0201', { L: 200, W: 150, H: 100, t: 3 });

/* ---------------- SVG ---------------- */
test('SVG: declares real millimetre dimensions (opens at true scale)', () => {
  const s = toSVG(dl, { margin: 10 });
  const m = /width="([\d.]+)mm" height="([\d.]+)mm"/.exec(s);
  assert(m, 'no mm width/height on the svg element');
  near(+m[1], dl.bbox.w + 20, 1e-6); near(+m[2], dl.bbox.h + 20, 1e-6);
});

test('SVG: viewBox matches the declared size 1:1', () => {
  const s = toSVG(dl, { margin: 10 });
  const vb = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(s);
  near(+vb[1], dl.bbox.w + 20, 1e-6); near(+vb[2], dl.bbox.h + 20, 1e-6);
});

test('SVG: separates cut and crease into distinct labelled layers', () => {
  const s = toSVG(dl);
  assert(/data-layer="cut"/.test(s), 'missing cut layer');
  assert(/data-layer="crease"/.test(s), 'missing crease layer');
  assert(/stroke-dasharray/.test(s), 'creases must be dashed');
});

test('SVG: tags are balanced and every path has geometry', () => {
  const s = toSVG(dl);
  assert((s.match(/<g /g) || []).length === (s.match(/<\/g>/g) || []).length, 'unbalanced <g>');
  for (const d of s.match(/ d="([^"]+)"/g) || []) assert(d.length > 8, 'empty path data');
});

test('SVG: no NaN or undefined leaks into output for any style', () => {
  for (const st of STYLES) {
    const s = toSVG(generate(st.id, sampleFor(st.id)));
    assert(!/NaN|undefined|Infinity/.test(s), `${st.id} emitted invalid SVG numbers`);
  }
});

/* ---------------- DXF ---------------- */
test('DXF: has the four required R12 sections in order', () => {
  const d = toDXF(dl);
  const want = ['SECTION\n2\nHEADER', 'SECTION\n2\nTABLES', 'SECTION\n2\nENTITIES'];
  let at = 0;
  for (const w of want) { const i = d.indexOf(w, at); assert(i > -1, `missing ${w}`); at = i; }
  assert(d.trimEnd().endsWith('EOF'), 'DXF must terminate with EOF');
});

test('DXF: declares AC1009 and millimetre insertion units', () => {
  const d = toDXF(dl);
  assert(/\$ACADVER\n1\nAC1009/.test(d), 'not marked as R12');
  assert(/\$INSUNITS\n70\n4/.test(d), 'units not set to millimetres');
});

test('DXF: every POLYLINE is closed by a SEQEND', () => {
  const d = toDXF(dl);
  near((d.match(/\nPOLYLINE\n/g) || []).length, (d.match(/\nSEQEND\n/g) || []).length, 0);
});

test('DXF: vertex count equals the total points in exported paths', () => {
  const d = toDXF(dl);
  const expected = dl.paths.filter((p) => p.layer !== 'dim').reduce((n, p) => n + p.pts.length, 0);
  near((d.match(/\nVERTEX\n/g) || []).length, expected, 0);
});

test('DXF: declares a layer table entry for every layer used', () => {
  const d = toDXF(dl);
  const used = new Set(dl.paths.map((p) => p.layer));
  near(+/LAYER\n70\n(\d+)/.exec(d)[1], used.size, 0);
  for (const n of ['CUT', 'CREASE', 'GLUE']) assert(d.includes(`\nLAYER\n2\n${n}\n`), `missing layer ${n}`);
});

test('DXF: group codes and values pair up evenly', () => {
  const lines = toDXF(dl).split('\n').filter((l, i, a) => i < a.length - 1);
  assert(lines.length % 2 === 0, 'odd number of DXF lines - a group code has no value');
});

test('DXF: coordinates round-trip back to the source geometry', () => {
  const d = toDXF(dl);
  const xs = [...d.matchAll(/\nVERTEX\n8\n\w+\n10\n(-?[\d.]+)\n20\n(-?[\d.]+)/g)]
    .map((m) => [+m[1], +m[2]]);
  const first = dl.paths[0].pts[0];
  near(xs[0][0], first[0], 1e-4); near(xs[0][1], first[1], 1e-4);
});

/* ---------------- PDF ---------------- */
test('PDF: header, xref and EOF present', () => {
  const p = toPDF(dl);
  assert(p.startsWith('%PDF-1.4'), 'bad header');
  assert(p.includes('\nxref\n'), 'no xref table');
  assert(p.trimEnd().endsWith('%%EOF'), 'no EOF marker');
});

test('PDF: MediaBox is exactly true scale (1 mm design = 1 mm on paper)', () => {
  const p = toPDF(dl, { margin: 10 });
  const mb = /MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/.exec(p);
  near(+mb[1], (dl.bbox.w + 20) * PT_PER_MM, 0.01);
  near(+mb[2], (dl.bbox.h + 20) * PT_PER_MM, 0.01);
});

test('PDF: every xref offset points at its object header', () => {
  const p = toPDF(dl);
  const start = +/startxref\n(\d+)/.exec(p)[1];
  const rows = [...p.slice(start).matchAll(/^(\d{10}) 00000 n/gm)].map((m) => +m[1]);
  const declared = +/\/Size (\d+)/.exec(p)[1];
  const objects = (p.match(/^\d+ 0 obj$/gm) || []).length;
  assert(rows.length === objects, `xref lists ${rows.length} entries for ${objects} objects`);
  assert(declared === objects + 1, `trailer /Size ${declared} does not match ${objects} objects + free entry`);
  rows.forEach((off, i) => assert(p.startsWith(`${i + 1} 0 obj`, off),
    `xref entry ${i + 1} points at ${JSON.stringify(p.slice(off, off + 12))}`));
});

test('PDF: declares the Helvetica base-14 font it uses for labels', () => {
  const p = toPDF(dl);
  assert(/\/BaseFont \/Helvetica[ /]/.test(p), 'regular font object missing');
  assert(/\/BaseFont \/Helvetica-Bold/.test(p), 'bold font object missing');
  // Both faces are offered to every page; neither is embedded, both are base-14.
  assert(/\/Font << \/F1 \d+ 0 R \/F2 \d+ 0 R >>/.test(p),
    'page resources do not reference both faces');
});

test('PDF: stream /Length matches the real stream body length', () => {
  const p = toPDF(dl);
  const declared = +/<< \/Length (\d+) >>\nstream\n/.exec(p)[1];
  const body = p.slice(p.indexOf('stream\n') + 7, p.indexOf('endstream'));
  near(body.length, declared, 0);
});

test('PDF: creases are dashed and cut is solid', () => {
  const p = toPDF(dl);
  assert(/\[3 2\] 0 d/.test(p), 'crease dash pattern missing');
  assert(/\[\] 0 d/.test(p), 'cut should reset to a solid line');
});

test('PDF: generates cleanly for every style', () => {
  for (const st of STYLES) {
    const p = toPDF(generate(st.id, sampleFor(st.id)));
    assert(!/NaN|undefined|Infinity/.test(p), `${st.id} emitted invalid PDF numbers`);
    assert(p.trimEnd().endsWith('%%EOF'), `${st.id} PDF truncated`);
  }
});

/* ---------------- spec sheet ---------------- */
import { toSpecSheet } from '../src/export/pdf.js';

const ROWS = [['Length', '200 mm'], ['Width', '150 mm'], ['', ''], ['Blank size', '747 x 253 mm']];

test('spec sheet is a valid single-page A4 landscape PDF', () => {
  const p = toSpecSheet(dl, { rows: ROWS });
  assert(p.startsWith('%PDF-1.4'), 'bad header');
  assert(p.trimEnd().endsWith('%%EOF'), 'no EOF');
  const mb = /MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/.exec(p);
  near(+mb[1], 297 * PT_PER_MM, 0.01, 'width should be A4 landscape');
  near(+mb[2], 210 * PT_PER_MM, 0.01, 'height should be A4 landscape');
  assert((p.match(/\/Type \/Page[^s]/g) || []).length === 1, 'should be one page');
});

test('spec sheet xref survives the multi-object layout', () => {
  const p = toSpecSheet(dl, { rows: ROWS });
  const start = +/startxref\n(\d+)/.exec(p)[1];
  const rows = [...p.slice(start).matchAll(/^(\d{10}) 00000 n/gm)].map((m) => +m[1]);
  const objects = (p.match(/^\d+ 0 obj$/gm) || []).length;
  assert(rows.length === objects, `xref lists ${rows.length} for ${objects} objects`);
  rows.forEach((off, i) => assert(p.startsWith(`${i + 1} 0 obj`, off),
    `xref entry ${i + 1} points at ${JSON.stringify(p.slice(off, off + 12))}`));
});

test('spec sheet prints the rows it was given', () => {
  const p = toSpecSheet(dl, { rows: ROWS });
  for (const [k, v] of ROWS) {
    if (!k) continue;
    assert(p.includes(`(${k})`), `missing label ${k}`);
    assert(p.includes(`(${v})`), `missing value ${v}`);
  }
});

test('spec sheet says the drawing is not true scale, so nobody measures it', () => {
  const p = toSpecSheet(dl, { rows: ROWS });
  assert(/scaled to fit/i.test(p), 'must warn the drawing is scaled');
  assert(/true-scale PDF/i.test(p), 'must point at the true-scale export');
  assert(/Check against your converter/i.test(p), 'must carry the tooling caution');
});

test('spec sheet handles every style and an empty row list', () => {
  for (const st of STYLES) {
    const p = toSpecSheet(generate(st.id, sampleFor(st.id)), { rows: [] });
    assert(p.trimEnd().endsWith('%%EOF'), `${st.id} spec sheet truncated`);
    assert(!/NaN|undefined/.test(p), `${st.id} spec sheet has invalid values`);
  }
});

test('true-scale export is still exactly true scale after the refactor', () => {
  const p = toPDF(dl, { margin: 10 });
  const mb = /MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/.exec(p);
  near(+mb[1], (dl.bbox.w + 20) * PT_PER_MM, 0.01);
  near(+mb[2], (dl.bbox.h + 20) * PT_PER_MM, 0.01);
});

/* ---------------- preview graticule ---------------- */

test('grid: the step is always a 1-2-5 number a person can count in', () => {
  // 7 mm squares are unreadable as a measure. Every step must be a round
  // number of the kind a ruler is divided into.
  for (let span = 8; span < 6000; span *= 1.07) {
    const s = gridStep(span);
    const mantissa = s / 10 ** Math.floor(Math.log10(s));
    assert([1, 2, 5].some((m) => Math.abs(mantissa - m) < 1e-9),
      `span ${span.toFixed(0)} gave a ${s} mm grid`);
  }
});

test('grid: the density stays readable across every real box size', () => {
  // Too few divisions and it measures nothing; too many and it is a texture.
  for (const span of [30, 60, 120, 250, 500, 750, 1200, 2500, 5000]) {
    const n = span / gridStep(span);
    assert(n >= 8 && n <= 45, `${span} mm gives ${n.toFixed(0)} divisions`);
  }
  assert(gridStep(0) > 0 && gridStep(-5) > 0, 'a degenerate span must not divide by zero');
});

test('grid: appears only when the preview asks for it', () => {
  // The exported file is something a designer places artwork on. A grid baked
  // into it would be someone else's furniture on their drawing.
  assert(toSVG(dl, { grid: true }).includes('url(#mm5)'), 'preview has no grid');
  assert(!toSVG(dl).includes('url(#mm5)'), 'a plain export carries a grid');
  assert(!toSVG(dl, { includeDims: true }).includes('<pattern'), 'export carries a pattern');
});

test('grid: squares line up with the corner of the blank, not the margin', () => {
  // Otherwise you cannot count squares out from the edge of the box, which is
  // the only reason to draw a grid rather than a wash.
  for (const margin of [0, 8, 25]) {
    const svg = toSVG(dl, { margin, grid: true });
    const m = /patternTransform="translate\(([-\d.]+) ([-\d.]+)\)"/.exec(svg);
    assert(m, `no pattern origin at margin ${margin}`);
    near(+m[1], margin, 1e-9, 'grid x origin');
    near(+m[2], dl.bbox.h + margin, 1e-9, 'grid y origin');
  }
});

test('grid: hairlines do not thicken when the drawing is scaled', () => {
  // The preview zooms to 8x. A stroke in drawing units would be a fifth of a
  // pixel on a 750 mm blank and four pixels once zoomed.
  const svg = toSVG(dl, { grid: true });
  const strokes = [...svg.matchAll(/<path[^>]*stroke-width="([\d.]+)"[^>]*>/g)]
    .filter((m) => m[0].includes('vector-effect'));
  assert(strokes.length >= 2, 'grid strokes are not screen-space');
  for (const s of strokes) assert(+s[1] === 1, `grid stroke is ${s[1]}, not a hairline`);
});

test('spec sheet: nothing is laid out below the bottom of the page', () => {
  // The rows are placed downward at a fixed step from a fixed start. Enough of
  // them and the last ones are positioned off the sheet, where they are not
  // clipped or flagged - they are simply written outside the MediaBox and are
  // invisible. A spec sheet quietly missing its last rows is worse than one
  // that never had them.
  const many = [];
  for (let i = 0; i < 26; i++) many.push([`Row label ${i}`, `${i * 7} mm`]);
  const steps = ['Fold the four side walls up along the scored lines.',
    'Fold the corner tabs in and glue them behind the side walls.',
    'Close the lid and tuck the front flap inside the front wall.',
    'Check the tuck holds without forcing, and adjust the depth if it does not.'];
  const pdf = toSpecSheet(dl, { rows: many, steps });
  const page = /\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/.exec(pdf);
  const bottom = 0, top = +page[2];
  const stream = /stream\n([\s\S]*?)endstream/.exec(pdf)[1];
  const ys = [...stream.matchAll(/1 0 0 1 ([\d.-]+) ([\d.-]+) Tm/g)].map((m) => +m[2]);
  assert(ys.length > 10, `only found ${ys.length} text placements to check`);
  const off = ys.filter((y) => y < bottom + 2 || y > top - 2);
  assert(off.length === 0,
    `${off.length} lines fall outside the page (lowest ${Math.min(...ys).toFixed(0)}pt, page is ${top.toFixed(0)}pt)`);
});

test('spec sheet: a value too wide for its column never overlaps its label', () => {
  // Both are drawn in the same grey at the same size, so an overlap does not
  // read as "too long" - it reads as a broken renderer.
  const long = [['Packed into', 'Euro pallet (EUR 1) 1200 × 800 mm'],
                ['Per layer', '28  (5 columns + 3 turned (width split))'],
                ['Short', '3 mm']];
  const pdf = toSpecSheet(dl, { rows: long, steps: [] });
  const stream = /stream\n([\s\S]*?)endstream/.exec(pdf)[1];
  // Gather every drawn string with its baseline and horizontal extent.
  const put = [...stream.matchAll(/BT \/F1 ([\d.]+) Tf [\d. ]+ rg 1 0 0 1 ([\d.-]+) ([\d.-]+) Tm \(([^)]*)\) Tj/g)]
    .map((m) => ({ size: +m[1], x: +m[2], y: +m[3], s: m[4] }));
  for (const [label, value] of long) {
    const l = put.find((t) => t.s === label);
    const v = put.find((t) => t.s.replace(/\\327/g, '×') === value || t.s === value);
    if (!l || !v) continue;
    if (Math.abs(l.y - v.y) > 1) continue;            // wrapped onto its own line: fine
    const labelEnd = l.x + l.s.length * l.size * 0.5;
    assert(v.x >= labelEnd, `"${label}" and its value share a line and overlap`);
  }
});

test('spec sheet: a group of rows is not split across columns', () => {
  // The caller separates groups with blank rows. Breaking one leaves its last
  // line alone at the top of the next column, reading as an unrelated fact
  // rather than the conclusion of the rows above it.
  const rows = [];
  for (let i = 0; i < 18; i++) rows.push([`Filler ${i}`, `${i} mm`]);
  rows.push(['', '']);
  const group = [['Packed into', 'Euro pallet'], ['Load height', '1400 mm'],
                 ['Per layer', '28'], ['Layers', '13'], ['Boxes per load', '364']];
  rows.push(...group);
  const pdf = toSpecSheet(dl, { rows, steps: [] });
  const stream = /stream\n([\s\S]*?)endstream/.exec(pdf)[1];
  const put = [...stream.matchAll(/1 0 0 1 ([\d.-]+) ([\d.-]+) Tm \(([^)]*)\) Tj/g)]
    .map((m) => ({ x: +m[1], y: +m[2], s: m[3] }));
  const xs = group.map(([label]) => {
    const t = put.find((q) => q.s === label);
    assert(t, `"${label}" was not drawn at all`);
    return t.x;
  });
  assert(new Set(xs).size === 1,
    `the group is spread over ${new Set(xs).size} columns (x positions ${[...new Set(xs)].join(', ')})`);
});

test('spec sheet: bold is a real bold face, not the same string drawn twice', () => {
  // Helvetica-Bold is base-14, so it needs no embedding. Double-drawing is
  // muddier in print and leaves every heading overlapping itself.
  const pdf = toSpecSheet(dl, { rows: [['A', 'B']], steps: [] });
  assert(/\/BaseFont \/Helvetica-Bold/.test(pdf), 'no bold face in the document');
  assert(/\/F2 \d+ 0 R/.test(pdf), 'the bold face is not offered to the page');
  const stream = /stream\n([\s\S]*?)endstream/.exec(pdf)[1];
  assert(/BT \/F2 /.test(stream), 'nothing actually uses the bold face');
  // No string is drawn twice at nearly the same place.
  const put = [...stream.matchAll(/1 0 0 1 ([\d.-]+) ([\d.-]+) Tm \(([^)]*)\) Tj/g)]
    .map((m) => ({ x: +m[1], y: +m[2], s: m[3] }));
  for (let i = 0; i < put.length; i++) {
    for (let j = i + 1; j < put.length; j++) {
      const a = put[i], b = put[j];
      assert(!(a.s === b.s && Math.abs(a.y - b.y) < 1 && Math.abs(a.x - b.x) < 2),
        `"${a.s}" is drawn twice at the same spot`);
    }
  }
});
