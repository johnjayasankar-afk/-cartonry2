import { test, assert, near } from './harness.js';
import { STYLES, byId, generate, comparable } from '../src/registry.js';
import { normaliseParams } from '../src/model.js';
import { sampleFor } from './samples.js';
import { foldNet, foldedBounds, internalSize, externalSize, externalFor } from '../src/fold.js';

/* --------------------------------------------------------------------------
 * These are the strongest correctness tests in the project. Everything else
 * checks the flat blank against itself. These fold the net in 3D and MEASURE
 * THE ASSEMBLED BOX - so if the board allowances are wrong, the box comes out
 * the wrong size and the test fails, exactly as it would on a real cutting table.
 *
 * Expected mid-surface size per axis, from the documented convention:
 *   - bounded by folds at BOTH ends  -> internal + t     (tube, tray base)
 *   - bounded by a fold at ONE end   -> internal + t/2   (open wall height)
 *   - bounded by cut edges at both   -> internal         (sleeve band height)
 * ----------------------------------------------------------------------- */

const CASES = [
  { id: 'rsc-0201',       p: { L: 200, W: 150, H: 100, t: 3 },  mid: (P) => [P.L + P.t, P.W + P.t, P.H + P.t] },
  { id: 'hsc',            p: { L: 200, W: 150, H: 100, t: 3 },  mid: (P) => [P.L + P.t, P.W + P.t, P.H + P.t] },
  { id: 'fol-0203',       p: { L: 200, W: 150, H: 100, t: 3 },  mid: (P) => [P.L + P.t, P.W + P.t, P.H + P.t] },
  { id: 'carton-ste',     p: { L: 80, W: 40, H: 150, t: 0.5 },  mid: (P) => [P.L + P.t, P.W + P.t, P.H + P.t] },
  { id: 'carton-rte',     p: { L: 80, W: 40, H: 150, t: 0.5 },  mid: (P) => [P.L + P.t, P.W + P.t, P.H + P.t] },
  { id: 'sleeve',         p: { L: 200, W: 150, H: 60, t: 3 },   mid: (P) => [P.L + P.t, P.W + P.t, P.H] },
  { id: 'tray-4corner',   p: { L: 200, W: 150, H: 45, t: 1 },   mid: (P) => [P.L + P.t, P.W + P.t, P.H + P.t / 2] },
  { id: 'mailer-tucktop', p: { L: 220, W: 160, H: 60, t: 3 },   mid: (P) => [P.L + P.t, P.W + P.t, P.H + P.t / 2] },
  // A lid must clear the OUTSIDE of the box it covers: box + 2 calipers + 2 clearances.
  { id: 'telescope-lid',  p: { L: 200, W: 150, H: 45, t: 1 },
    mid: (P) => [P.L + 2 * P.t + 1.6 + P.t, P.W + 2 * P.t + 1.6 + P.t, P.H + P.t / 2] },
  // Hexagon: across corners = 2s, across flats = s*sqrt(3), where s is the
  // mid-surface side. Only 60 deg of turn, so the allowance is 0.577t not t.
  { id: 'hexagon',        p: { L: 100, W: 0, H: 120, t: 0.5 },
    mid: (P) => { const s = P.L / Math.sqrt(3) + 2 * (P.t / 2) * Math.tan(Math.PI / 6);
                  return [2 * s, s * Math.sqrt(3), P.H + P.t]; } },
];

const sorted = (a) => a.slice().sort((x, y) => y - x);

for (const c of CASES) {
  const style = byId(c.id);
  const P = normaliseParams(c.p);

  test(`${c.id}: the folded blank measures the box that was asked for`, () => {
    const got = sorted(foldedBounds(style.fold(P), 1).size);
    const want = sorted(c.mid(c.p));
    got.forEach((v, i) => near(v, want[i], 0.01,
      `assembled box axis ${i} (mid-surface). Blank folds to ${got.join(' x ')}, expected ${want.join(' x ')}`));
  });

  test(`${c.id}: nothing sticks out of the assembled box`, () => {
    // If any flap or tab folds the wrong way it lands outside the carton and
    // inflates the bounding box - the failure mode this catches is a tab that
    // swings out instead of in, which no 2D test can see.
    const b = foldedBounds(style.fold(P), 1);
    const want = sorted(c.mid(c.p));
    const got = sorted(b.size);
    assert(got[0] <= want[0] + 0.01,
      `something protrudes: largest axis ${got[0]} mm vs expected ${want[0]} mm`);
  });

  test(`${c.id}: flat at t=0 matches the blank the exporter draws`, () => {
    const flat = foldedBounds(style.fold(P), 0);
    const dl = generate(c.id, c.p);
    assert(flat.size[2] === 0, 'an unfolded net must be planar');
    assert(flat.size[0] <= dl.bbox.w + 0.01 && flat.size[1] <= dl.bbox.h + 0.01,
      `fold model (${flat.size[0]} x ${flat.size[1]}) does not fit the blank (${dl.bbox.w} x ${dl.bbox.h}) - the two have drifted apart`);
  });

  test(`${c.id}: every panel stays connected while folding`, () => {
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      for (const f of foldNet(style.fold(P), t)) {
        for (const q of f.pts) assert(q.every(Number.isFinite), `non-finite point in ${f.id} at t=${t}`);
      }
    }
  });
}

test('every style either folds or says plainly that it cannot', () => {
  for (const s of STYLES) {
    assert(typeof s.fold === 'function' || s.fold === null,
      `${s.id} must declare fold() or fold: null`);
  }
  const covered = new Set(CASES.map((c) => c.id));
  for (const s of STYLES) {
    if (typeof s.fold === 'function') assert(covered.has(s.id), `${s.id} folds but has no fold test`);
  }
});

test('the pillow box declines a 3D preview rather than faking one', () => {
  assert(byId('pillow').fold === null,
    'a pillow box closes by bending, not by folding flat panels - approximating it would look right and be wrong');
});

test('folding is monotonic: the blank gets smaller as it closes', () => {
  const P = normaliseParams({ L: 200, W: 150, H: 100, t: 3 });
  const root = byId('rsc-0201').fold(P);
  let prev = Infinity;
  for (const t of [0, 0.25, 0.5, 0.75, 1]) {
    const s = foldedBounds(root, t).size;
    const footprint = s[0] * s[1];
    assert(footprint <= prev + 1e-6, `footprint grew between fold steps at t=${t}`);
    prev = footprint;
  }
});

/* ------------------------------------------------- outside dimensions ---- */

const foldable = STYLES.filter((s) => typeof s.fold === 'function');
const P = (id) => normaliseParams(sampleFor(id));

test('outside: every axis is larger than the inside, on every style', () => {
  // The board has to go somewhere. If an axis came back equal or smaller the
  // offset is being applied along the wrong normal.
  for (const st of foldable) {
    const p = P(st.id);
    const inn = internalSize(st.fold(p), p.t);
    const out = externalSize(st.fold(p), p.t);
    for (let i = 0; i < 3; i++) {
      assert(out[i] > inn[i] + 1e-9,
        `${st.id}: outside ${out[i]} is not bigger than inside ${inn[i]}`);
    }
  }
});

test('outside: a closed box is the inside plus two calipers, exactly', () => {
  // Board on both faces of every axis. This is the case a formula gets right.
  for (const id of ['rsc-0201', 'fol-0203', 'mailer-tucktop', 'carton-ste', 'carton-rte']) {
    const p = P(id);
    const inn = internalSize(byId(id).fold(p), p.t);
    const out = externalSize(byId(id).fold(p), p.t);
    for (let i = 0; i < 3; i++) near(out[i] - inn[i], 2 * p.t, 1e-6, `${id} axis ${i}`);
  }
});

test('outside: an open face adds board on one side only', () => {
  // THIS is why the outside is measured rather than derived. A tray wall is
  // folded at the base and cut at the top: half a caliper of board below the
  // base's mid-plane, none above the wall's edge. Adding a full caliper per
  // axis - the obvious shortcut - makes every open case half a caliper too
  // tall, and it would look entirely plausible.
  for (const id of ['hsc', 'tray-4corner', 'telescope-lid']) {
    const p = P(id);
    const inn = internalSize(byId(id).fold(p), p.t);
    const out = externalSize(byId(id).fold(p), p.t);
    const deltas = out.map((v, i) => (v - inn[i]) / p.t).sort((a, b) => a - b);
    near(deltas[0], 1.5, 1e-6, `${id}: the open axis should gain 1.5 calipers`);
    near(deltas[1], 2, 1e-6, `${id}: a closed axis should gain 2`);
    near(deltas[2], 2, 1e-6, `${id}: a closed axis should gain 2`);
  }
});

test('outside: a tube open at both ends adds one caliper along it', () => {
  const p = P('sleeve');
  const inn = internalSize(byId('sleeve').fold(p), p.t);
  const out = externalSize(byId('sleeve').fold(p), p.t);
  const deltas = out.map((v, i) => (v - inn[i]) / p.t).sort((a, b) => a - b);
  near(deltas[0], 1, 1e-6, 'a sleeve has no board at either end of its axis');
});

test('outside: with no board at all, the outside is the inside', () => {
  // A degenerate but decisive check: the whole difference is the board.
  for (const st of foldable) {
    const p = { ...P(st.id), t: 0 };
    const mid = foldedBounds(st.fold(p), 1).size.slice().sort((a, b) => b - a);
    const out = externalSize(st.fold(p), 0);
    for (let i = 0; i < 3; i++) near(out[i], mid[i], 1e-6, `${st.id} axis ${i} at zero caliper`);
  }
});

test('outside: grows with the board, never shrinks', () => {
  for (const st of foldable) {
    let prev = null;
    for (const t of [0.3, 0.5, 1.5, 3, 4]) {
      const p = { ...P(st.id), t };
      const out = externalSize(st.fold(p), t);
      assert(out.every(Number.isFinite), `${st.id}: non-finite outside at t=${t}`);
      if (prev) for (let i = 0; i < 3; i++) {
        assert(out[i] >= prev[i] - 1e-9, `${st.id}: axis ${i} shrank as the board got thicker`);
      }
      prev = out;
    }
  }
});

test('outside: the pillow box has no fold model and so claims no outside size', () => {
  // It closes by bending, not by folding about straight hinges. The 3D view
  // already refuses to guess; the outside dimension must refuse too.
  assert(typeof byId('pillow').fold !== 'function',
    'the pillow box has grown a fold model - the outside size can now be measured');
});

test('outside: is reported on the same axes as the inside, in the same order', () => {
  // Sorted output beside unsorted input reads as a different box. Every
  // outside figure must sit against the inside figure it belongs to.
  for (const st of foldable) {
    const p = P(st.id);
    const fld = st.fields || {};
    const wanted = ['L', 'W', 'H'].filter((k) => fld[k] !== null).map((k) => p[k]);
    const got = externalFor(st.fold(p), p.t, wanted);
    assert(got.every(Number.isFinite), `${st.id}: no outside for ${JSON.stringify(wanted)}`);
    // Not strictly greater on every axis: a sleeve is a tube with a cut edge
    // at both ends, so along the band's own axis there is no board at all and
    // the outside equals the inside. That is the measurement being right about
    // an open form, and it is worth one line of test to say so.
    assert(got.some((v, i) => v > wanted[i] + 1e-9), `${st.id}: no axis grew at all`);
    for (let i = 0; i < wanted.length; i++) {
      assert(got[i] >= wanted[i] - 1e-9,
        `${st.id}: outside ${got[i]} is smaller than inside ${wanted[i]}`);
      // The gain is at most two calipers - but only for a style whose fields
      // ARE its own cavity. A telescope lid is dimensioned by the box it goes
      // over, so its outside is legitimately that box plus two calipers of its
      // own board plus the slip clearance, and comparing the two would be
      // comparing different things.
      if (comparable(st)) {
        assert(got[i] - wanted[i] <= 2 * p.t + 1e-6,
          `${st.id}: axis ${i} gained ${(got[i] - wanted[i]).toFixed(2)} - paired to the wrong axis`);
      }
    }
  }
});

test('outside: the paired figures are the measured ones, not new numbers', () => {
  // Whatever the pairing does, it may only reorder what outerBounds measured.
  for (const st of foldable) {
    const p = P(st.id);
    const wanted = foldedBounds(st.fold(p), 1).size.map((v) => v - p.t);
    const paired = externalFor(st.fold(p), p.t, wanted).slice().sort((a, b) => b - a);
    const sorted = externalSize(st.fold(p), p.t);
    for (let i = 0; i < 3; i++) near(paired[i], sorted[i], 1e-6, `${st.id} value ${i}`);
  }
});

test('outside: a sleeve gains nothing along the band, and board across it', () => {
  // The one case where "outside equals inside" is the correct answer.
  const p = P('sleeve');
  const st = byId('sleeve');
  const wanted = ['L', 'W', 'H'].map((k) => p[k]);
  const got = externalFor(st.fold(p), p.t, wanted);
  near(got[2], wanted[2], 1e-6, 'the band height has a cut edge at each end');
  near(got[0] - wanted[0], 2 * p.t, 1e-6, 'across the tube there is board on both sides');
  near(got[1] - wanted[1], 2 * p.t, 1e-6, 'across the tube there is board on both sides');
});
