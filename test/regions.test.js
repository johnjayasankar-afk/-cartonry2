// The regions are hit areas laid over the drawing. If they do not sit exactly
// on the blank, the interface points at the wrong part of the box - which is
// worse than not pointing at all.
import { test, assert } from './harness.js';
import { regionsOf, partsOf, coverage } from '../src/regions.js';
import { STYLES, byId, generate } from '../src/registry.js';
import { sampleFor, sweepFor } from './samples.js';

const foldable = STYLES.filter((s) => typeof s.fold === 'function');

test('regions: the named regions span exactly the blank they overlay', () => {
  // The overlay is positioned by adding the drawing's cut-layer origin, so the
  // net's own bounds have to equal the blank's. A millimetre out and every
  // highlight is a millimetre off, at every zoom level.
  for (const s of foldable) {
    const dl = generate(s.id, sampleFor(s.id));
    const rs = regionsOf(dl, s);
    assert(rs.length > 0, `${s.id}: no regions`);
    const xs = rs.flatMap((r) => r.pts.map((p) => p[0]));
    const ys = rs.flatMap((r) => r.pts.map((p) => p[1]));
    assert(Math.min(...xs) > -0.01 && Math.min(...ys) > -0.01,
      `${s.id}: regions start at ${Math.min(...xs).toFixed(2)}, ${Math.min(...ys).toFixed(2)}`);
    assert(Math.abs(Math.max(...xs) - dl.bbox.w) < 0.01,
      `${s.id}: regions are ${Math.max(...xs).toFixed(2)} wide, blank is ${dl.bbox.w.toFixed(2)}`);
    assert(Math.abs(Math.max(...ys) - dl.bbox.h) < 0.01,
      `${s.id}: regions are ${Math.max(...ys).toFixed(2)} tall, blank is ${dl.bbox.h.toFixed(2)}`);
  }
});

test('regions: hold up across the whole size range, not just one sample', () => {
  for (const s of foldable) {
    for (const [L, W, H] of sweepFor(s.id)) {
      const dl = generate(s.id, { L, W, H, t: s.board.caliper });
      const rs = regionsOf(dl, s);
      assert(rs.length > 0, `${s.id} at ${L}x${W}x${H}: no regions`);
      const xs = rs.flatMap((r) => r.pts.map((p) => p[0]));
      const ys = rs.flatMap((r) => r.pts.map((p) => p[1]));
      assert(Math.abs(Math.max(...xs) - dl.bbox.w) < 0.01
          && Math.abs(Math.max(...ys) - dl.bbox.h) < 0.01,
        `${s.id} at ${L}x${W}x${H}: regions ${Math.max(...xs).toFixed(1)}x${Math.max(...ys).toFixed(1)}`
        + ` vs blank ${dl.bbox.w.toFixed(1)}x${dl.bbox.h.toFixed(1)}`);
    }
  }
});

test('regions: every region is named, measured and of a known kind', () => {
  const KINDS = new Set(['panel', 'flap', 'glue']);
  for (const s of foldable) {
    for (const r of regionsOf(generate(s.id, sampleFor(s.id)), s)) {
      assert(r.label && r.label.trim(), `${s.id}: an unnamed ${r.kind} region`);
      assert(KINDS.has(r.kind), `${s.id}: "${r.label}" has kind "${r.kind}"`);
      assert(r.w > 0 && r.h > 0, `${s.id}: "${r.label}" measures ${r.w} x ${r.h}`);
      assert(r.areaMm2 > 0, `${s.id}: "${r.label}" has no area`);
      assert(Number.isFinite(r.cx) && Number.isFinite(r.cy),
        `${s.id}: "${r.label}" has no centre`);
    }
  }
});

test('regions: account for most of the blank they cover', () => {
  // Not all of it: a tuck carton's corners are cut away around the tuck, so its
  // named parts genuinely do not fill the rectangle. But a big shortfall would
  // mean whole parts of the blank are unnamed and unhoverable.
  for (const s of foldable) {
    const dl = generate(s.id, sampleFor(s.id));
    const c = coverage(regionsOf(dl, s), dl.bbox);
    assert(c > 0.7, `${s.id}: regions cover only ${(c * 100).toFixed(1)}% of the blank`);
    assert(c <= 1.05, `${s.id}: regions cover ${(c * 100).toFixed(1)}% - they overlap`);
  }
});

test('regions: are ordered the way the drawing is read', () => {
  // Arrow-key exploration follows this order, so it has to run top-left to
  // bottom-right the way the eye does. Blank coordinates put Y upwards.
  for (const s of foldable) {
    const dl = generate(s.id, sampleFor(s.id));
    const rs = regionsOf(dl, s);
    const band = Math.max(dl.bbox.h / 40, 1);
    for (let i = 1; i < rs.length; i++) {
      const a = rs[i - 1], b = rs[i];
      const sameRow = Math.abs(b.cy - a.cy) <= band;
      assert(sameRow ? b.cx >= a.cx - 0.01 : b.cy <= a.cy + 0.01,
        `${s.id}: "${a.label}" then "${b.label}" is out of reading order`);
    }
  }
});

test('regions: a style that closes by bending reports none rather than guessing', () => {
  const pillow = byId('pillow');
  assert(typeof pillow.fold !== 'function', 'pillow has gained a fold net');
  assert(regionsOf(generate('pillow', sampleFor('pillow')), pillow).length === 0,
    'pillow invented regions it cannot have');
  assert(regionsOf(null, byId('rsc-0201')).length === 0, 'no dieline should give no regions');
});

test('parts: the schedule accounts for every region, once', () => {
  // A schedule that quietly drops a part, or counts one twice, is a schedule a
  // converter would quote from and get wrong.
  for (const s of foldable) {
    const rs = regionsOf(generate(s.id, sampleFor(s.id)), s);
    const parts = partsOf(rs);
    const counted = parts.reduce((n, p) => n + p.count, 0);
    assert(counted === rs.length,
      `${s.id}: ${rs.length} regions but the schedule counts ${counted}`);
    const ids = parts.flatMap((p) => p.ids);
    assert(new Set(ids).size === ids.length, `${s.id}: a region is in two rows`);
    for (const id of ids) {
      assert(rs.some((r) => r.id === id), `${s.id}: schedule cites unknown region "${id}"`);
    }
  }
});

test('parts: every row is named and measured', () => {
  for (const s of foldable) {
    for (const p of partsOf(regionsOf(generate(s.id, sampleFor(s.id)), s))) {
      assert(p.label && p.label.trim(), `${s.id}: an unnamed row of ${p.count} ${p.kind}`);
      assert(p.count >= 1 && Number.isInteger(p.count), `${s.id}: "${p.label}" counts ${p.count}`);
      assert(p.w > 0 && p.h > 0, `${s.id}: "${p.label}" measures ${p.w} x ${p.h}`);
    }
  }
});

test('parts: reads body first - panels, then flaps, then the glue tab', () => {
  const RANK = { panel: 0, flap: 1, glue: 2 };
  for (const s of foldable) {
    const parts = partsOf(regionsOf(generate(s.id, sampleFor(s.id)), s));
    for (let i = 1; i < parts.length; i++) {
      assert(RANK[parts[i - 1].kind] <= RANK[parts[i].kind],
        `${s.id}: a ${parts[i - 1].kind} row sits above a ${parts[i].kind} row`);
    }
  }
});

test('parts: collapses repeats instead of listing the same flap four times', () => {
  // The whole point: thirteen regions is a list of duplicates, seven is a
  // schedule. If grouping silently stopped working this would still "pass" as
  // a list, so the numbers are named.
  const rsc = byId('rsc-0201');
  const rscParts = partsOf(regionsOf(generate('rsc-0201', sampleFor('rsc-0201')), rsc));
  assert(rscParts.length === 7, `an RSC should schedule as 7 parts, got ${rscParts.length}`);
  assert(rscParts.filter((p) => p.count === 2).length === 6,
    'an RSC has six parts that come in pairs');

  // Six faces differing only by number are one part, and keep their own names
  // on the drawing.
  const hex = byId('hexagon');
  const hexRegions = regionsOf(generate('hexagon', sampleFor('hexagon')), hex);
  const hexParts = partsOf(hexRegions);
  const face = hexParts.find((p) => p.label === 'Face');
  assert(face && face.count === 6, `hexagon faces schedule as ${face ? face.count : 'nothing'}`);
  assert(new Set(hexRegions.filter((r) => r.kind === 'panel').map((r) => r.label)).size === 6,
    'the six faces should still be individually named on the drawing');
});
