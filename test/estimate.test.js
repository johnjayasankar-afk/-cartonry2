import { test, assert, near } from './harness.js';
import { sheetYield, blankWeightG, costPerBox, SHEETS, sheetLabel } from '../src/estimate.js';

test('a blank that tiles the sheet exactly gives the exact count', () => {
  const r = sheetYield(100, 100, 1000, 700, 0);
  assert(r.perSheet === 70, `expected 70, got ${r.perSheet} (${r.layout})`);
  near(r.wastePct, 0, 1e-6, 'a perfect tiling wastes nothing');
});

test('rotation is OFF by default, because board grain is directional', () => {
  // 200 x 900 fits nothing upright on a 1000 x 700 sheet, but 4 turned. A
  // converter with directional board cannot make that swap, so the default
  // must not silently claim the better number.
  const fixed = sheetYield(200, 900, 1000, 700, { gutter: 0 });
  const free = sheetYield(200, 900, 1000, 700, { gutter: 0, allowRotation: true });
  assert(fixed.perSheet === 0, `grain-fixed should not rotate: got ${fixed.perSheet}`);
  assert(free.perSheet > 0, `rotation allowed should find a layout: got ${free.perSheet}`);
});

test('with rotation allowed, the heuristic never loses to a plain grid', () => {
  const r = sheetYield(300, 100, 1000, 700, { allowRotation: true });
  assert(r.perSheet >= 21, `two-block heuristic lost to a plain grid: got ${r.perSheet}`);
});

test('the two-block split beats a single-orientation grid where it should', () => {
  // 700 x 200 on 1000 x 700: upright 1x3=3, turned 5x1=5, split finds more.
  const r = sheetYield(700, 200, 1000, 700, { allowRotation: true });
  const plainBest = Math.max(Math.floor(1000 / 700) * Math.floor(700 / 200),
                             Math.floor(1000 / 200) * Math.floor(700 / 700));
  assert(r.perSheet >= plainBest, `split (${r.perSheet}) lost to plain grid (${plainBest})`);
});

test('gutters reduce the count', () => {
  const tight = sheetYield(100, 100, 1000, 700, 0).perSheet;
  const spaced = sheetYield(100, 100, 1000, 700, 10).perSheet;
  assert(spaced < tight, `gutters should cost yield: ${spaced} vs ${tight}`);
});

test('a blank larger than the sheet does not fit, and says so', () => {
  const r = sheetYield(2000, 2000, 1000, 700, 0);
  assert(r.perSheet === 0, 'oversized blank reported as fitting');
  assert(/does not fit/.test(r.layout), `unhelpful layout text: ${r.layout}`);
  assert(r.wastePct === 100, 'waste should be total');
});

test('zero and negative inputs are handled without NaN', () => {
  for (const args of [[0, 100, 1000, 700], [100, 0, 1000, 700], [-5, 100, 1000, 700], [100, 100, 0, 700]]) {
    const r = sheetYield(...args, 0);
    assert(Number.isFinite(r.perSheet) && r.perSheet === 0, `bad result for ${args}`);
    assert(Number.isFinite(r.wastePct), 'wastePct must be finite');
  }
});

test('waste percentage is consistent with the count', () => {
  const r = sheetYield(240, 180, 1200, 800, 0);
  const used = r.perSheet * 240 * 180 / 1e6, sheet = 1200 * 800 / 1e6;
  near(r.wastePct, 100 * (1 - used / sheet), 0.11, 'waste does not match the layout');
});

test('board weight uses grammage over blank area', () => {
  near(blankWeightG(0.5, 400), 200, 1e-6);      // 0.5 m2 of 400 gsm = 200 g
  near(blankWeightG(0.189, 650), 122.9, 0.1);
});

test('cost per box charges for the whole sheet, because waste is paid for', () => {
  const y = sheetYield(500, 350, 1000, 700, 0);   // exactly 4 up, no waste
  assert(y.perSheet === 4, `expected 4 up, got ${y.perSheet}`);
  const c = costPerBox(0.175, 1.0, y.perSheet, y);
  near(c, 0.175, 1e-6, 'with zero waste, sheet cost per box equals blank area cost');
});

test('cost per box is higher than blank area alone when there is waste', () => {
  const y = sheetYield(400, 400, 1000, 700, 0);   // 2 up, lots of waste
  const sheetBased = costPerBox(0.16, 1.0, y.perSheet, y);
  const areaBased = costPerBox(0.16, 1.0, 0, null);
  assert(sheetBased > areaBased, 'waste should make the real cost higher');
});

test('no price means no cost figure is invented', () => {
  assert(costPerBox(0.2, 0, 4, { sheetM2: 0.7 }) === null, 'should return null, not a made-up number');
  assert(costPerBox(0.2, NaN, 4, { sheetM2: 0.7 }) === null);
});

test('every placement sits inside the sheet and none overlap', () => {
  const y = sheetYield(240, 180, 1200, 800, { gutter: 4, margin: 10, allowRotation: true });
  assert(y.perSheet > 0, 'expected a layout');
  for (const p of y.placements) {
    assert(p.x >= 10 - 1e-6 && p.y >= 10 - 1e-6, `placement starts outside the margin: ${p.x},${p.y}`);
    assert(p.x + p.w <= 1200 - 10 + 1e-6 && p.y + p.h <= 800 - 10 + 1e-6,
      `placement runs past the trim edge: ${p.x + p.w},${p.y + p.h}`);
  }
  for (let i = 0; i < y.placements.length; i++) {
    for (let j = i + 1; j < y.placements.length; j++) {
      const a = y.placements[i], b = y.placements[j];
      const gapX = a.x + a.w <= b.x + 1e-9 || b.x + b.w <= a.x + 1e-9;
      const gapY = a.y + a.h <= b.y + 1e-9 || b.y + b.h <= a.y + 1e-9;
      assert(gapX || gapY, `blanks ${i} and ${j} overlap`);
    }
  }
});

test('placement count always equals the reported yield', () => {
  for (const opts of [{}, { allowRotation: true }, { gutter: 6 }, { margin: 15, allowRotation: true }]) {
    const y = sheetYield(320, 240, 1200, 800, opts);
    assert(y.placements.length === y.perSheet,
      `${y.placements.length} placements vs perSheet ${y.perSheet}`);
  }
});

test('a trim margin reduces the usable area and so the yield', () => {
  const none = sheetYield(240, 180, 1200, 800, { margin: 0 }).perSheet;
  const trimmed = sheetYield(240, 180, 1200, 800, { margin: 40 }).perSheet;
  assert(trimmed < none, `margin should cost yield: ${trimmed} vs ${none}`);
});

test('rotated placements are counted and reported', () => {
  const y = sheetYield(700, 200, 1000, 700, { allowRotation: true });
  assert(y.rotatedCount >= 0 && y.rotatedCount <= y.perSheet, 'rotatedCount out of range');
  assert(y.placements.every((p) => p.rot === 0 || p.rot === 90), 'unexpected rotation value');
});

test('sheet presets are well formed', () => {
  const ids = new Set();
  for (const s of SHEETS) {
    assert(s.id && s.w > 0 && s.h > 0, `bad preset ${JSON.stringify(s)}`);
    assert(s.w >= s.h, `${s.id}: presets should be stated landscape for consistency`);
    assert(!ids.has(s.id), `duplicate sheet id ${s.id}`);
    ids.add(s.id);
  }
});

test('sheet menu labels never print the size twice', () => {
  // The corrugated presets used to be named "1200 x 800 corrugated" and the
  // menu appended the size, so the option read the dimensions twice over.
  for (const s of SHEETS) {
    const label = sheetLabel(s, '1200 × 800 mm');
    const sizes = label.match(/\d{3,4}\s*[x×]\s*\d{3,4}/g) || [];
    assert(sizes.length <= 1, `"${label}" states its size ${sizes.length} times`);
    assert(label.trim().length > 0, `${s.id} has an empty menu label`);
  }
  assert(sheetLabel({ std: null }, '1200 × 800 mm') === '1200 × 800 mm');
  assert(sheetLabel({ std: 'SRA3' }, '450 × 320 mm') === 'SRA3 — 450 × 320 mm');
});
