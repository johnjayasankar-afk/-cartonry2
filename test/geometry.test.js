import { test, assert, near, selfIntersects } from './harness.js';
import { STYLES, generate } from '../src/registry.js';
import { LAYER } from '../src/model.js';
import { signedArea, bboxOf, toMm, fromMm } from '../src/geom.js';
import { sampleFor } from './samples.js';

const BASE = { L: 200, W: 150, H: 100, t: 3 };
const cutOf = (dl) => dl.paths.find((p) => p.layer === LAYER.CUT);

/* ---------- properties that must hold for EVERY style ----------
 * Sizes come from test/samples.js so a newly added style is covered by every
 * property below the moment it is registered, with no test edit needed.        */
const CASES = new Proxy({}, { get: (_, id) => sampleFor(String(id)) });

for (const style of STYLES) {
  const params = sampleFor(style.id);
  const dl = generate(style.id, params);

  test(`${style.id}: has exactly one closed cut outline`, () => {
    const cuts = dl.paths.filter((p) => p.layer === LAYER.CUT);
    assert(cuts.length === 1, `expected 1 cut path, got ${cuts.length}`);
    assert(cuts[0].closed, 'cut outline must be closed');
    assert(cuts[0].pts.length >= 4, 'cut outline needs at least 4 points');
  });

  test(`${style.id}: all coordinates are finite`, () => {
    for (const p of dl.paths) for (const [x, y] of p.pts)
      assert(Number.isFinite(x) && Number.isFinite(y), `non-finite point in ${p.layer}`);
  });

  test(`${style.id}: cut outline does not self-intersect`, () => {
    const hit = selfIntersects(cutOf(dl).pts);
    assert(!hit, `segments ${hit && hit.join(' and ')} cross - the die would be defective`);
  });

  test(`${style.id}: cut outline encloses real area`, () => {
    assert(Math.abs(signedArea(cutOf(dl).pts)) > 1, 'degenerate outline');
  });

  test(`${style.id}: every crease lies inside the cut bounding box`, () => {
    const b = bboxOf([cutOf(dl)]);
    for (const p of dl.paths.filter((q) => q.layer === LAYER.CREASE))
      for (const [x, y] of p.pts)
        assert(x >= b.minX - 1e-6 && x <= b.maxX + 1e-6 && y >= b.minY - 1e-6 && y <= b.maxY + 1e-6,
          `crease point ${x},${y} escapes the blank`);
  });

  test(`${style.id}: blank is normalised to the origin`, () => {
    near(dl.bbox.minX, 0, 1e-6, 'minX'); near(dl.bbox.minY, 0, 1e-6, 'minY');
  });

  test(`${style.id}: generation is deterministic`, () => {
    const a = JSON.stringify(generate(style.id, params).paths);
    const b = JSON.stringify(generate(style.id, params).paths);
    assert(a === b, 'two runs produced different geometry');
  });

  test(`${style.id}: blank grows when the box grows`, () => {
    const big = generate(style.id, { ...params, L: params.L * 2 });
    assert(big.bbox.w * big.bbox.h > dl.bbox.w * dl.bbox.h, 'doubling L did not enlarge the blank');
  });
}

/* ---------- style-specific dimensional truths ---------- */

test('RSC: blank width = glue + 2(L+t) + 2(W+t)', () => {
  const dl = generate('rsc-0201', BASE);
  near(dl.bbox.w, 35 + 2 * (BASE.L + BASE.t) + 2 * (BASE.W + BASE.t), 1e-6);
});

test('RSC: blank height = W + (H + t)  [two flaps of W/2 plus the body]', () => {
  const dl = generate('rsc-0201', BASE);
  near(dl.bbox.h, BASE.W + BASE.H + BASE.t, 1e-6);
});

test('RSC: opposing flaps meet exactly at the centre line', () => {
  const dl = generate('rsc-0201', BASE);
  near(dl.panels.flapDepth * 2, BASE.W, 1e-6, 'flap pair span');
});

test('RSC: flapGap opens a real relief gap between meeting flaps', () => {
  const dl = generate('rsc-0201', { ...BASE, flapGap: 4 });
  near(dl.panels.flapDepth * 2, BASE.W - 4, 1e-6);
});

test('RSC: score-to-score panel = internal dimension + one caliper', () => {
  const dl = generate('rsc-0201', BASE);
  near(dl.panels.panelL - BASE.t, BASE.L, 1e-6, 'length panel');
  near(dl.panels.panelW - BASE.t, BASE.W, 1e-6, 'width panel');
});

test('RSC: inner perimeter of the folded tube equals 2(L+W)', () => {
  const dl = generate('rsc-0201', BASE);
  const inner = 2 * (dl.panels.panelL - BASE.t) + 2 * (dl.panels.panelW - BASE.t);
  near(inner, 2 * (BASE.L + BASE.W), 1e-6);
});

test('FOL uses more board than RSC at the same size (full overlap costs material)', () => {
  const rsc = generate('rsc-0201', BASE), fol = generate('fol-0203', BASE);
  assert(fol.bbox.h > rsc.bbox.h, 'FOL blank should be taller');
});

test('HSC has no top flaps: height = W/2 + H + t', () => {
  const dl = generate('hsc', BASE);
  near(dl.bbox.h, BASE.W / 2 + BASE.H + BASE.t, 1e-6);
});

test('Cartons: tuck panel spans the opening depth', () => {
  const p = CASES['carton-ste'];
  const dl = generate('carton-ste', p);
  near(dl.panels.tuckPanel, p.W + p.t, 1e-6);
});

test('STE and RTE differ in geometry (tucks hinge from opposite panels)', () => {
  const p = CASES['carton-ste'];
  const a = JSON.stringify(generate('carton-ste', p).paths);
  const b = JSON.stringify(generate('carton-rte', p).paths);
  assert(a !== b, 'straight and reverse tuck produced identical blanks');
});

test('STE and RTE use the same amount of board', () => {
  const p = CASES['carton-ste'];
  const a = generate('carton-ste', p), b = generate('carton-rte', p);
  near(a.bbox.w * a.bbox.h, b.bbox.w * b.bbox.h, 1e-6);
});

test('Mailer: blank = (wall + baseL + wall) x (wall + baseW + wall + baseW + tuck)', () => {
  const p = CASES['mailer-tucktop'];
  const dl = generate('mailer-tucktop', p);
  const baseL = p.L + p.t, baseW = p.W + p.t, wall = p.H + p.t / 2;
  near(dl.bbox.w, wall + baseL + wall, 1e-6, 'width');
  near(dl.bbox.h, 2 * wall + 2 * baseW + dl.panels.tuckFlap, 1e-6, 'height');
});

test('Tray: blank = (wall + baseL + wall) x (wall + baseW + wall)', () => {
  const p = CASES['tray-4corner'];
  const dl = generate('tray-4corner', p);
  const baseL = p.L + p.t, baseW = p.W + p.t, wall = p.H + p.t / 2;
  near(dl.bbox.w, wall + baseL + wall, 1e-6);
  near(dl.bbox.h, wall + baseW + wall, 1e-6);
});

test('Tray and mailer apply HALF a caliper to open wall heights', () => {
  // A wall folded at one end and cut at the other only loses t/2 to the fold,
  // not a whole caliper. Using the full caliper here made every tray and mailer
  // a caliper too deep - a real defect the 3D fold test found.
  const t = 4;
  for (const [id, p] of [['tray-4corner', { L: 200, W: 150, H: 45, t }],
                         ['mailer-tucktop', { L: 220, W: 160, H: 60, t }]]) {
    near(generate(id, p).panels.wallHeight, p.H + t / 2, 1e-6, `${id} wall height`);
  }
});

test('Pillow: blank height equals H; arcs dip inward by the curve depth', () => {
  const p = CASES['pillow'];
  const dl = generate('pillow', p);
  near(dl.bbox.h, p.H, 1e-6, 'height');
  const ys = cutOf(dl).pts.map((q) => q[1]);
  near(Math.min(...ys.filter((y) => y > p.H / 2)), p.H - p.W, 1e-3, 'top dip');
  near(Math.max(...ys.filter((y) => y < p.H / 2)), p.W, 1e-3, 'bottom dip');
});

test('Sleeve is open at both ends: height equals H exactly', () => {
  const p = CASES['sleeve'];
  near(generate('sleeve', p).bbox.h, p.H, 1e-6);
});

/* ---------- units ---------- */
test('inch/mm conversion round-trips', () => {
  near(fromMm(toMm(12.5, 'in'), 'in'), 12.5, 1e-9);
  near(toMm(1, 'in'), 25.4, 1e-9);
});

test('a 12x9x6 inch RSC produces the same blank as its mm equivalent', () => {
  const a = generate('rsc-0201', { L: toMm(12, 'in'), W: toMm(9, 'in'), H: toMm(6, 'in'), t: 3 });
  const b = generate('rsc-0201', { L: 304.8, W: 228.6, H: 152.4, t: 3 });
  near(a.bbox.w, b.bbox.w, 1e-6); near(a.bbox.h, b.bbox.h, 1e-6);
});

/* ---------- blank AREA checks -------------------------------------------
 * A bounding box cannot tell a full-height corner tab from a 1 mm sliver:
 * both give the same envelope. Comparing the enclosed area against the sum of
 * the panels that ought to be there does catch it. These tests exist because
 * exactly that bug shipped into the first render of the tray and the mailer.
 * ---------------------------------------------------------------------- */

test('Tray: enclosed area equals base + 4 walls + 4 full-height corner tabs', () => {
  const P = { L: 200, W: 150, H: 50, t: 1 };
  const dl = generate('tray-4corner', P);
  const g = Math.max(0.5, P.t), tab = dl.panels.cornerTab;
  const baseL = P.L + P.t, baseW = P.W + P.t, wall = P.H + P.t / 2;
  const expected = baseL * baseW + 2 * (wall * baseW) + 2 * (baseL * wall) + 4 * (tab * (wall - g));
  near(Math.abs(signedArea(cutOf(dl).pts)), expected, 0.5, 'tray blank area');
});

test('Tray: all four corner tabs are the same size', () => {
  const dl = generate('tray-4corner', { L: 200, W: 150, H: 50, t: 1 });
  const pts = cutOf(dl).pts, b = dl.bbox;
  // A tab reaches the far left/right of the blank; count distinct tab corners.
  const atLeft = pts.filter((q) => Math.abs(q[0] - 0) < 1e-6).length;
  const atRight = pts.filter((q) => Math.abs(q[0] - b.maxX) < 1e-6).length;
  assert(atLeft === atRight, `left/right outline points differ (${atLeft} vs ${atRight}) - asymmetric blank`);
});

test('Mailer: enclosed area equals every panel, flap and tab it should have', () => {
  const P = { L: 220, W: 160, H: 60, t: 3 };
  const dl = generate('mailer-tucktop', P);
  const g = Math.max(0.5, P.t), tab = dl.panels.cornerTab, tuck = dl.panels.tuckFlap;
  const ins = Math.max(1, P.t + 0.8), sh = Math.min(3, tuck * 0.3);
  const baseL = P.L + P.t, baseW = P.W + P.t, wall = P.H + P.t / 2;
  const expected =
      2 * (baseL * baseW)        // base + lid
    + 2 * (baseL * wall)         // front + back walls
    + 2 * (wall * baseW)         // left + right side walls
    + 2 * (wall * baseW)         // lid dust flaps
    + 4 * (tab * (wall - g))     // corner tabs
    + ((baseL + (baseL - 2 * ins)) / 2) * sh + (baseL - 2 * ins) * (tuck - sh);  // tuck flap
  near(Math.abs(signedArea(cutOf(dl).pts)), expected, 0.5, 'mailer blank area');
});

test('Mailer: the outline never doubles back along the same edge', () => {
  const dl = generate('mailer-tucktop', { L: 220, W: 160, H: 60, t: 3 });
  const pts = cutOf(dl).pts;
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i - 1], b = pts[i], c = pts[i + 1];
    const back = (b[0] - a[0]) * (c[0] - b[0]) + (b[1] - a[1]) * (c[1] - b[1]);
    const collinear = Math.abs((b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0])) < 1e-9;
    assert(!(collinear && back < 0), `outline reverses over itself at point ${i} (${b})`);
  }
});

test('RSC: enclosed area equals four panels, eight flaps and the glue tab', () => {
  const dl = generate('rsc-0201', BASE);
  const { panelL, panelW, bodyH, flapDepth: F, slotWidth: s } = dl.panels;
  const body = (2 * panelL + 2 * panelW) * bodyH;
  // Flaps sit between slots: two end flaps lose half a slot, inner ones a full slot.
  const flapRun = 2 * panelL + 2 * panelW - 3 * s;
  const glueTab = 35 * bodyH - Math.min(6, 35 * 0.4, bodyH * 0.15) * 35;  // tab less its two chamfers
  near(Math.abs(signedArea(cutOf(dl).pts)), body + 2 * flapRun * F + glueTab, 0.5, 'RSC blank area');
});

test('model: board area is stored exactly, not rounded for display', () => {
  // This was rounded to three decimals of a square metre at source, quantising
  // it to 1000 mm2. A 3941 mm2 carton blank became 0.004 m2 and a 400 mm2 one
  // became zero - and cost per box and weight per box are both computed from
  // this number, so both were wrong by the same proportion.
  for (const [id, p] of [['hexagon', { L: 12, W: 0, H: 10, t: 0.3 }],
                         ['carton-ste', { L: 25, W: 12, H: 8, t: 0.3 }],
                         ['rsc-0201', { L: 200, W: 150, H: 100, t: 3 }]]) {
    const d = generate(id, p);
    near(d.blankAreaM2, (d.bbox.w * d.bbox.h) / 1e6, 1e-12, `${id} area not exact`);
    assert(d.blankAreaM2 > 0, `${id} reports zero board area`);
  }
});

test('notes: the unit changes the prose and nothing else', () => {
  // Notes sit next to the drawing, so they are written in the reader's unit.
  // The geometry must be bit-identical either way: if a display choice could
  // move a knife line, that would be a far worse bug than a mixed-unit label.
  for (const st of STYLES) {
    const p = sampleFor(st.id);
    const mm = generate(st.id, p, { unit: 'mm' });
    const inch = generate(st.id, p, { unit: 'in' });
    assert(JSON.stringify(mm.paths) === JSON.stringify(inch.paths),
      `${st.id}: geometry changed with the display unit`);
    assert(mm.bbox.w === inch.bbox.w && mm.bbox.h === inch.bbox.h, `${st.id}: bbox changed`);
    // Every length in a note must have followed the unit. Board caliper is the
    // deliberate exception - mills quote it in mm in both systems.
    const stray = inch.notes.filter((n) => /\d(\.\d+)? mm\b/.test(n)
      && !/caliper|Slots \d|board thickness/i.test(n));
    assert(stray.length === 0, `${st.id}: note still in millimetres — "${stray[0]}"`);
  }
});

test('notes: default to millimetres when no unit is given', () => {
  // The page builder and the tests call generate() with two arguments.
  const d = generate('rsc-0201', { L: 200, W: 150, H: 100, t: 3 });
  assert(d.notes.some((n) => / mm\b/.test(n)), 'no millimetres in the default notes');
  assert(!d.notes.some((n) => /″/.test(n)), 'inch marks leaked into the default notes');
});
