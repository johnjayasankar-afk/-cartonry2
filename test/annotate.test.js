import { test, assert, near } from './harness.js';
import { STYLES, byId, generate } from '../src/registry.js';
import { withAnnotations, annotations } from '../src/annotate.js';
import { LAYER } from '../src/model.js';
import { toSVG } from '../src/export/svg.js';
import { toPDF } from '../src/export/pdf.js';
import { toDXF } from '../src/export/dxf.js';
import { sampleFor } from './samples.js';

const ALL = { dims: true, labels: true, guides: true };
const dl = generate('rsc-0201', { L: 200, W: 150, H: 100, t: 3 });
const an = withAnnotations(dl, byId('rsc-0201'), ALL);

test('annotations never move into negative space (they would clip off the page)', () => {
  for (const st of STYLES) {
    const d = generate(st.id, sampleFor(st.id));
    const a = withAnnotations(d, st, ALL);
    for (const p of a.paths) {
      for (const [x, y] of p.pts) assert(x >= -1e-6 && y >= -1e-6, `${st.id}: point ${x},${y} is off-page`);
      if (p.kind === 'text') assert(p.at[0] >= -1e-6 && p.at[1] >= -1e-6, `${st.id}: text anchor off-page`);
    }
  }
});

test('the cut blank keeps its true size when annotations are added', () => {
  assert(an.blankBbox.w === dl.bbox.w && an.blankBbox.h === dl.bbox.h, 'blank size changed');
  near(an.blankAreaM2, dl.blankAreaM2, 1e-9, 'board area must describe the blank, not the annotations');
  assert(an.bbox.w > dl.bbox.w && an.bbox.h > dl.bbox.h, 'drawing should grow to fit the dimensions');
});

test('dimension labels state the real blank size', () => {
  const texts = an.paths.filter((p) => p.kind === 'text').map((p) => p.value);
  assert(texts.includes(`${dl.bbox.w} mm`), `missing width label, got ${texts.join(', ')}`);
  assert(texts.includes(`${dl.bbox.h} mm`), `missing height label, got ${texts.join(', ')}`);
});

test('panel names come from the fold model, so 2D and 3D can never disagree', () => {
  const labels = an.paths.filter((p) => p.kind === 'text' && !/mm|"/.test(p.value)).map((p) => p.value);
  assert(labels.length === 4, `expected 4 body panels, got ${labels.length}`);
  assert(labels.filter((l) => l === 'Side').length === 2 && labels.filter((l) => l === 'End').length === 2,
    `unexpected panel names: ${labels.join(', ')}`);
});

test('each toggle contributes only its own layer', () => {
  const only = (o) => new Set(annotations(dl, byId('rsc-0201'), o).map((p) => p.layer));
  assert(!only({ dims: true }).has(LAYER.GUIDE), 'dimensions leaked a guide');
  const g = only({ dims: false, guides: true });
  assert(g.has(LAYER.GUIDE) && !g.has(LAYER.DIM), 'guides leaked a dimension');
  assert(annotations(dl, byId('rsc-0201'), { dims: false }).every((p) => p.layer !== LAYER.DIM)
    || annotations(dl, byId('rsc-0201'), { dims: false, labels: true }).some((p) => p.kind === 'text'),
    'labels and dimensions must be independently controllable');
});

test('a style with no fold model still gets dimensions, just no panel names', () => {
  const p = generate('pillow', sampleFor('pillow'));
  const a = withAnnotations(p, byId('pillow'), ALL);
  const texts = a.paths.filter((q) => q.kind === 'text');
  assert(texts.length === 2, `pillow should get 2 dimension labels only, got ${texts.length}`);
});

test('annotations survive all three exporters without producing junk', () => {
  for (const st of STYLES) {
    const a = withAnnotations(generate(st.id, sampleFor(st.id)), st, ALL);
    for (const [name, out] of [['svg', toSVG(a, { includeDims: true })],
                               ['dxf', toDXF(a, { includeDims: true })],
                               ['pdf', toPDF(a, { includeDims: true })]]) {
      assert(!/NaN|undefined|Infinity/.test(out), `${st.id}: ${name} contains invalid values`);
    }
  }
});

test('SVG renders labels as real text, upright despite the flipped drawing', () => {
  const s = toSVG(an, { includeDims: true });
  assert(/<text /.test(s), 'no text elements');
  assert(/scale\(1 -1\)/.test(s), 'text must be un-flipped so it reads the right way up');
  assert(s.includes('>747 mm<'), 'width dimension missing from SVG');
});

test('DXF writes TEXT entities on the DIMS layer', () => {
  const d = toDXF(an, { includeDims: true });
  assert((d.match(/\nTEXT\n/g) || []).length >= 6, 'expected TEXT entities');
  assert(d.includes('\nLAYER\n2\nDIMS\n'), 'DIMS layer not declared');
  assert(d.includes('\nLAYER\n2\nGUIDE\n'), 'GUIDE layer not declared');
  assert(!d.includes('\nLAYER\n2\nBLEED\n'), 'stale BLEED layer name');
});

test('DXF can omit annotations entirely for a die maker who only wants the knife', () => {
  const plain = toDXF(an, { includeDims: false });
  assert(!plain.includes('\nLAYER\n2\nDIMS\n'), 'DIMS layer should be excluded');
  assert(!(plain.match(/\nTEXT\n/g) || []).length, 'text should be excluded');
  assert(plain.includes('\nLAYER\n2\nCUT\n'), 'cut layer must still be present');
});

test('PDF page grows to contain the dimension lines', () => {
  const p = toPDF(an, { includeDims: true });
  const mb = /MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/.exec(p);
  const plain = /MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/.exec(toPDF(dl));
  assert(+mb[1] > +plain[1] && +mb[2] > +plain[2], 'annotated page should be larger than the bare blank');
});

test('label text scales with the blank but stays within sane limits', () => {
  const tiny = withAnnotations(generate('rsc-0201', { L: 30, W: 20, H: 15, t: 0.4 }), byId('rsc-0201'), ALL);
  const huge = withAnnotations(generate('rsc-0201', { L: 1200, W: 800, H: 600, t: 7 }), byId('rsc-0201'), ALL);
  const size = (d) => d.paths.find((p) => p.kind === 'text').size;
  assert(size(tiny) >= 3 && size(tiny) <= 14, `tiny box label ${size(tiny)} mm out of range`);
  assert(size(huge) >= 3 && size(huge) <= 14, `huge box label ${size(huge)} mm out of range`);
  assert(size(huge) > size(tiny), 'bigger blanks should get bigger lettering');
});

/* ---- dimension chain ---- */
test('the chain measures each panel and the numbers add up to the blank', () => {
  const c = withAnnotations(dl, byId('rsc-0201'), { dims: false, chain: true });
  const vals = c.paths.filter((p) => p.kind === 'text').map((p) => parseFloat(p.value));
  // Across: glue 35 + 203 + 153 + 203 + 153 = 747, the full blank width.
  const across = [35, 203, 153, 203, 153];
  for (const v of across) assert(vals.includes(v), `chain is missing a ${v} mm panel`);
  near(across.reduce((a, b) => a + b, 0), dl.bbox.w, 1e-6, 'chain should account for the whole blank');
});

test('the chain reads its divisions from the creases, so it cannot disagree', () => {
  const c = withAnnotations(dl, byId('rsc-0201'), { dims: false, chain: true });
  const vals = c.paths.filter((p) => p.kind === 'text').map((p) => parseFloat(p.value));
  assert(vals.includes(dl.panels.bodyH), `body height ${dl.panels.bodyH} not dimensioned`);
  assert(vals.includes(dl.panels.flapDepth), `flap depth ${dl.panels.flapDepth} not dimensioned`);
});

test('the chain skips gaps too narrow to letter, rather than printing mush', () => {
  const c = withAnnotations(dl, byId('rsc-0201'), { dims: false, chain: true });
  const vals = c.paths.filter((p) => p.kind === 'text').map((p) => parseFloat(p.value));
  assert(!vals.includes(3), 'a 3 mm slot should not be dimensioned in the chain');
});

test('the overall dimension steps clear of the chain: no label overlaps another', () => {
  const box = (p) => {
    const w = p.value.length * p.size * 0.62, h = p.size;
    const dx = p.anchor === 'middle' ? w / 2 : p.anchor === 'end' ? w : 0;
    const dx2 = p.anchor === 'middle' ? w / 2 : p.anchor === 'end' ? 0 : w;
    return Math.abs(p.rotate % 180) === 90
      ? { x0: p.at[0] - h * 0.35, x1: p.at[0] + h, y0: p.at[1] - dx, y1: p.at[1] + dx2 }
      : { x0: p.at[0] - dx, x1: p.at[0] + dx2, y0: p.at[1] - h * 0.35, y1: p.at[1] + h };
  };
  for (const st of STYLES) {
    const a = withAnnotations(generate(st.id, sampleFor(st.id)), st,
      { dims: true, labels: true, chain: true });
    const t = a.paths.filter((p) => p.kind === 'text').map(box);
    for (let i = 0; i < t.length; i++) {
      for (let j = i + 1; j < t.length; j++) {
        const A = t[i], B = t[j];
        assert(!(A.x0 < B.x1 && B.x0 < A.x1 && A.y0 < B.y1 && B.y0 < A.y1),
          `${st.id}: two dimension labels overlap`);
      }
    }
  }
});

test('the chain is off unless asked for', () => {
  const plain = withAnnotations(dl, byId('rsc-0201'), { dims: true, labels: true });
  const withChain = withAnnotations(dl, byId('rsc-0201'), { dims: true, labels: true, chain: true });
  assert(withChain.paths.length > plain.paths.length, 'chain added nothing');
});
