import { test, assert, near } from './harness.js';
import { packInto, toLayerSVG, toStackSVG, CONTAINERS, containerById } from '../src/pack.js';

const EURO = { w: 1200, d: 800, h: 1400 };

test('pack: the count is the layer pattern repeated, and nothing else', () => {
  const r = packInto([206, 156, 106], EURO);
  assert(r, 'no arrangement found for an ordinary case on a Euro pallet');
  assert(r.total === r.perLayer * r.layers, `${r.total} != ${r.perLayer} x ${r.layers}`);
  assert(r.layers === Math.floor(EURO.h / r.vertical), 'layers do not follow the load height');
});

test('pack: no box hangs over the edge', () => {
  // Overhang is a real packing decision with real consequences and this tool
  // does not make it. Every box must sit inside the footprint.
  for (const box of [[206, 156, 106], [90, 60, 40], [333, 211, 97], [125, 125, 125]]) {
    const r = packInto(box, EURO);
    for (const p of r.placements) {
      assert(p.x >= -1e-9 && p.y >= -1e-9, `${box}: placement starts outside the pallet`);
      assert(p.x + p.w <= EURO.w + 1e-6, `${box}: overhangs the width by ${(p.x + p.w - EURO.w).toFixed(1)}`);
      assert(p.y + p.h <= EURO.d + 1e-6, `${box}: overhangs the depth by ${(p.y + p.h - EURO.d).toFixed(1)}`);
    }
  }
});

test('pack: no two boxes occupy the same floor space', () => {
  for (const box of [[206, 156, 106], [180, 120, 90], [250, 170, 60]]) {
    const ps = packInto(box, EURO).placements;
    for (let i = 0; i < ps.length; i++) {
      for (let j = i + 1; j < ps.length; j++) {
        const a = ps[i], b = ps[j];
        const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
        const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
        assert(!(ox > 1e-6 && oy > 1e-6),
          `${box}: boxes ${i} and ${j} overlap by ${ox.toFixed(1)} x ${oy.toFixed(1)}`);
      }
    }
  }
});

test('pack: a box that divides the container exactly gives the exact count', () => {
  // 100 x 100 x 100 into 1000 x 800 x 1200 is 10 x 8 x 12 with nothing over.
  const r = packInto([100, 100, 100], { w: 1000, d: 800, h: 1200 });
  assert(r.perLayer === 80, `expected 80 per layer, got ${r.perLayer}`);
  assert(r.layers === 12, `expected 12 layers, got ${r.layers}`);
  assert(r.total === 960, `expected 960, got ${r.total}`);
  near(r.floorUsedPct, 100, 1e-9, 'a perfect tiling should waste no floor');
  near(r.headroom, 0, 1e-9, 'a perfect stack should leave no headroom');
});

test('pack: the best of the three ways up is the one reported', () => {
  // A flat, wide box: standing it on end wastes the footprint, laying it flat
  // does not. The chooser has to find that without being told.
  const box = [300, 200, 50];
  const best = packInto(box, EURO);
  for (let up = 0; up < 3; up++) {
    const vertical = box[up];
    const foot = box.filter((_, i) => i !== up);
    const layers = Math.floor(EURO.h / vertical);
    // A plain grid is a lower bound on what the nester should achieve.
    const grid = Math.floor(EURO.w / foot[0]) * Math.floor(EURO.d / foot[1]) * layers;
    assert(best.total >= grid,
      `a simple grid standing on axis ${up} gets ${grid}, the chooser only found ${best.total}`);
  }
});

test('pack: clearance between boxes costs boxes, never adds them', () => {
  let prev = Infinity;
  for (const gutter of [0, 2, 5, 10, 25]) {
    const r = packInto([206, 156, 106], EURO, { gutter });
    assert(r.total <= prev, `gutter ${gutter} produced MORE boxes than a tighter one`);
    prev = r.total;
  }
});

test('pack: a box bigger than the container packs nothing, and says so', () => {
  assert(packInto([2000, 900, 100], EURO) === null, 'a box wider than the pallet packed anyway');
  assert(packInto([206, 156, 2000], EURO) === null, 'a box taller than the load height packed anyway');
});

test('pack: junk in gives nothing out, not a confident zero', () => {
  for (const bad of [null, undefined, [1, 2], [0, 5, 5], [NaN, 5, 5], [-3, 5, 5]]) {
    assert(packInto(bad, EURO) === null, `packInto(${JSON.stringify(bad)}) returned a result`);
  }
  assert(packInto([100, 100, 100], { w: 0, d: 800, h: 100 }) === null, 'zero-width container packed');
  assert(packInto([100, 100, 100], null) === null, 'null container packed');
});

test('pack: the stack fits the load height it was given', () => {
  for (const h of [500, 900, 1400, 2200]) {
    const r = packInto([206, 156, 106], { ...EURO, h });
    if (!r) continue;
    assert(r.stackHeight <= h + 1e-6, `stack ${r.stackHeight} exceeds the ${h} load height`);
    assert(r.headroom >= -1e-9 && r.headroom < r.vertical,
      `headroom ${r.headroom} should be less than one box (${r.vertical})`);
  }
});

test('pack: the pallet footprints are the published standards', () => {
  // These are stated as fact in the interface, so they have to be facts.
  const by = (id) => containerById(id);
  assert(by('euro').w === 1200 && by('euro').d === 800, 'EUR 1 is 1200 x 800');
  assert(by('iso1210').w === 1200 && by('iso1210').d === 1000, 'ISO is 1200 x 1000');
  // 48 x 40 inches to the nearest millimetre.
  near(by('gma').w, Math.round(48 * 25.4), 0.5, 'GMA is 48 in');
  near(by('gma').d, Math.round(40 * 25.4), 0.5, 'GMA is 40 in');
  const ids = new Set(CONTAINERS.map((c) => c.id));
  assert(ids.size === CONTAINERS.length, 'duplicate container id');
});

test('pack: the layer drawing shows exactly the boxes that were counted', () => {
  const r = packInto([206, 156, 106], EURO);
  const svg = toLayerSVG(r);
  const rects = (svg.match(/<rect/g) || []).length;
  assert(rects === r.perLayer + 1, `${rects - 1} boxes drawn for ${r.perLayer} counted`);
  assert(svg.includes(`${r.perLayer} boxes in one layer`), 'the drawing is not labelled for a reader');
  assert(toLayerSVG(null) === '', 'a missing arrangement should draw nothing');
});

test('pack: the elevation draws one band per layer and the leftover gap', () => {
  const r = packInto([206, 156, 106], EURO);
  const svg = toStackSVG(r);
  // layers + the container outline + the headroom marker
  const rects = (svg.match(/<rect/g) || []).length;
  assert(rects === r.layers + 2, `${rects} rects for ${r.layers} layers plus outline and gap`);
  assert(svg.includes(`${r.layers} layers stacked`), 'the elevation is not labelled for a reader');
  // A stack with no headroom draws no gap marker.
  const exact = packInto([100, 100, 100], { w: 1000, d: 800, h: 1200 });
  near(exact.headroom, 0, 1e-9);
  assert((toStackSVG(exact).match(/<rect/g) || []).length === exact.layers + 1,
    'a gapless stack should not draw a gap');
  assert(toStackSVG(null) === '', 'no arrangement should draw nothing');
});
