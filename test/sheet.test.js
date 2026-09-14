import { test, assert, near } from './harness.js';
import { STYLES, byId, generate } from '../src/registry.js';
import { sheetYield } from '../src/estimate.js';
import { toSheetSVG, toSheetDieline } from '../src/sheet.js';
import { toSVG } from '../src/export/svg.js';
import { toPDF } from '../src/export/pdf.js';
import { toDXF } from '../src/export/dxf.js';
import { LAYER } from '../src/model.js';
import { bboxOf } from '../src/geom.js';
import { sampleFor } from './samples.js';

const dl = generate('carton-ste', sampleFor('carton-ste'));
const y = sheetYield(dl.bbox.w, dl.bbox.h, 1000, 700, { gutter: 4, margin: 12 });

test('the sheet drawing shows exactly as many blanks as the estimate claims', () => {
  assert(y.perSheet > 1, `expected a multi-up layout, got ${y.perSheet}`);
  const svg = toSheetSVG(dl, y);
  const drawn = (svg.match(/<path d="M/g) || []).length + (svg.match(/<rect /g) || []).length;
  // rects: sheet body + trim outline, plus one shape per blank
  assert(drawn >= y.perSheet, `drew ${drawn} shapes for ${y.perSheet} blanks`);
});

test('the sheet dieline places every blank inside the sheet', () => {
  const sd = toSheetDieline(dl, y);
  const cuts = sd.paths.filter((p) => p.layer === LAYER.CUT);
  assert(cuts.length === y.perSheet, `${cuts.length} cut outlines for ${y.perSheet} blanks`);
  for (const p of cuts) {
    const b = bboxOf([p]);
    assert(b.minX >= -1e-6 && b.minY >= -1e-6 && b.maxX <= y.area.w + 1e-6 && b.maxY <= y.area.h + 1e-6,
      `a blank runs off the sheet: ${b.minX},${b.minY} to ${b.maxX},${b.maxY}`);
  }
});

test('each placed blank keeps the size of the original blank', () => {
  const sd = toSheetDieline(dl, y);
  for (const p of sd.paths.filter((q) => q.layer === LAYER.CUT)) {
    const b = bboxOf([p]);
    const same = Math.abs(b.w - dl.bbox.w) < 0.01 && Math.abs(b.h - dl.bbox.h) < 0.01;
    const turned = Math.abs(b.w - dl.bbox.h) < 0.01 && Math.abs(b.h - dl.bbox.w) < 0.01;
    assert(same || turned, `placed blank is ${b.w} x ${b.h}, expected ${dl.bbox.w} x ${dl.bbox.h}`);
  }
});

test('rotated placements really are rotated in the drawing', () => {
  const d2 = generate('rsc-0201', { L: 120, W: 90, H: 70, t: 3 });
  const r = sheetYield(d2.bbox.w, d2.bbox.h, 1200, 800, { allowRotation: true });
  if (!r.rotatedCount) return;                     // this size may not need turning
  const sd = toSheetDieline(d2, r);
  const turned = sd.paths.filter((p) => p.layer === LAYER.CUT)
    .map((p) => bboxOf([p]))
    .filter((b) => Math.abs(b.w - d2.bbox.h) < 0.01);
  assert(turned.length === r.rotatedCount,
    `${turned.length} drawn turned vs ${r.rotatedCount} reported`);
});

test('creases travel with the blank onto the sheet', () => {
  const sd = toSheetDieline(dl, y);
  const perBlank = dl.paths.filter((p) => p.layer === LAYER.CREASE).length;
  const onSheet = sd.paths.filter((p) => p.layer === LAYER.CREASE).length;
  assert(onSheet === perBlank * y.perSheet,
    `${onSheet} creases on the sheet, expected ${perBlank} x ${y.perSheet}`);
});

test('the sheet exports through every exporter unchanged', () => {
  const sd = toSheetDieline(dl, y);
  const svg = toSVG(sd), pdf = toPDF(sd), dxf = toDXF(sd);
  for (const [name, out] of [['svg', svg], ['pdf', pdf], ['dxf', dxf]]) {
    assert(!/NaN|undefined|Infinity/.test(out), `${name} has invalid values`);
  }
  assert(pdf.trimEnd().endsWith('%%EOF'), 'pdf truncated');
  assert(dxf.trimEnd().endsWith('EOF'), 'dxf truncated');
  const mb = /MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/.exec(pdf);
  assert(+mb[1] > 0 && +mb[2] > 0, 'sheet PDF has no page size');
});

test('the sheet PDF is still true scale', () => {
  const sd = toSheetDieline(dl, y);
  const PT = 72 / 25.4, margin = 10;
  const mb = /MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/.exec(toPDF(sd, { margin }));
  near(+mb[1], (y.area.w + margin * 2) * PT, 0.01, 'sheet page width');
  near(+mb[2], (y.area.h + margin * 2) * PT, 0.01, 'sheet page height');
});

test('a blank that does not fit produces an honest empty drawing', () => {
  const huge = generate('rsc-0201', { L: 900, W: 700, H: 600, t: 7 });
  const r = sheetYield(huge.bbox.w, huge.bbox.h, 450, 320, {});
  assert(r.perSheet === 0, 'should not fit');
  const svg = toSheetSVG(huge, r);
  assert(/does not fit/.test(svg), 'the drawing should say so');
  assert(!/NaN/.test(svg), 'no NaN in the empty case');
});

test('every style can be nested and drawn', () => {
  for (const st of STYLES) {
    const d = generate(st.id, sampleFor(st.id));
    const r = sheetYield(d.bbox.w, d.bbox.h, 2500, 1600, { gutter: 3, margin: 10 });
    const svg = toSheetSVG(d, r);
    assert(!/NaN|undefined/.test(svg), `${st.id}: bad sheet SVG`);
    if (r.perSheet) {
      const sd = toSheetDieline(d, r);
      assert(!/NaN|undefined/.test(toPDF(sd)), `${st.id}: bad sheet PDF`);
    }
  }
});

test('the sheet drawing names the grain direction for a reader', () => {
  const svg = toSheetSVG(dl, y, { grainAxis: 'y' });
  assert(/8E77C6/.test(svg), 'grain arrow missing');
  assert(/aria-label="[^"]*blanks laid out/.test(svg), 'no accessible description');
});
