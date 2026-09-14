import { test, assert, near } from './harness.js';
import { STYLES, byId, generate, comparable } from '../src/registry.js';
import { internalForProduct, normaliseParams, warnings } from '../src/model.js';
import { sampleFor } from './samples.js';

/* ------------------------------------------------- sizing from a product */
test('clearance is added to BOTH sides of each axis', () => {
  const box = internalForProduct([180, 120, 80], 3);
  assert(box.join() === [186, 126, 86].join(), `got ${box.join(' x ')}`);
});

test('zero and missing clearance are handled', () => {
  assert(internalForProduct([100, 50, 25], 0).join() === [100, 50, 25].join());
  assert(internalForProduct([100, 50, 25], undefined).join() === [100, 50, 25].join());
  assert(internalForProduct([100, 50, 25], -5).join() === [100, 50, 25].join(),
    'a negative clearance must not shrink the box');
});

test('a product-sized box really does fit the product', () => {
  const product = [180, 120, 80], clearance = 3;
  const box = internalForProduct(product, clearance);
  const dl = generate('rsc-0201', { L: box[0], W: box[1], H: box[2], t: 3 });
  product.forEach((v, i) => {
    const internal = [dl.params.L, dl.params.W, dl.params.H][i];
    assert(internal >= v + 2 * clearance - 1e-9,
      `axis ${i}: internal ${internal} does not clear a ${v} product with ${clearance} each side`);
  });
});

/* -------------------------------------------------------------- warnings */
const warnFor = (id, p) => generate(id, p).warnings;

test('an ordinary box raises nothing', () => {
  assert(warnFor('rsc-0201', { L: 200, W: 150, H: 100, t: 3 }).length === 0,
    'a normal RSC should be quiet');
  assert(warnFor('carton-ste', { L: 80, W: 40, H: 150, t: 0.35 }).length === 0,
    'a normal folding carton should be quiet');
});

test('board too thick for a small box is flagged', () => {
  const w = warnFor('rsc-0201', { L: 40, W: 30, H: 25, t: 4 });
  assert(w.some((x) => /thick for a box this small/i.test(x)), `got: ${w.join(' | ')}`);
});

test('a large box on very thin board is flagged', () => {
  const w = warnFor('rsc-0201', { L: 600, W: 400, H: 300, t: 0.5 });
  assert(w.some((x) => /flimsy/i.test(x)), `got: ${w.join(' | ')}`);
});

test('extreme proportions are flagged', () => {
  const w = warnFor('rsc-0201', { L: 500, W: 20, H: 30, t: 1.5 });
  assert(w.some((x) => /extreme/i.test(x)), `got: ${w.join(' | ')}`);
});

test('the glue-flap warning measures against the panel it laps, not the height', () => {
  // A shallow but perfectly ordinary box must NOT be warned about: the flap
  // laps onto a 200 mm panel, not the 50 mm height.
  const ok = warnFor('rsc-0201', { L: 300, W: 200, H: 50, t: 3 });
  assert(!ok.some((x) => /glue flap/i.test(x)), `false positive: ${ok.join(' | ')}`);
  // A flap the user has overridden to something oversized must be.
  const bad = warnFor('rsc-0201', { L: 40, W: 30, H: 25, t: 1, glue: 35 });
  assert(bad.some((x) => /glue flap/i.test(x)), `missed a real one: ${bad.join(' | ')}`);
});

test('the default glue flap suits the format, so it is never itself a warning', () => {
  // A corrugated case is joined with 30-40 mm; a folding carton with 6-12 mm.
  // Defaulting to the corrugated figure put a 35 mm flap on a 40 mm carton panel.
  for (const [id, p] of [['rsc-0201', { L: 200, W: 150, H: 100, t: 3 }],
                         ['carton-ste', { L: 80, W: 40, H: 150, t: 0.35 }],
                         ['carton-rte', { L: 45, W: 25, H: 90, t: 0.35 }],
                         ['sleeve', { L: 200, W: 150, H: 60, t: 3 }],
                         ['rsc-0201', { L: 40, W: 30, H: 25, t: 1 }]]) {
    const w = warnFor(id, p);
    assert(!w.some((x) => /glue flap/i.test(x)),
      `${id} at ${JSON.stringify(p)} warned about its own default: ${w.join(' | ')}`);
  }
});

test('a folding carton gets a folding-carton joint, a case gets a case joint', () => {
  assert(generate('carton-ste', { L: 80, W: 40, H: 150, t: 0.35 }).panels.glueTab === 10,
    'folding carton should default to a 10 mm flap');
  assert(generate('rsc-0201', { L: 200, W: 150, H: 100, t: 3 }).panels.glueTab === 35,
    'corrugated case should default to a 35 mm joint');
});

test('the default flap can never overrun the panel it laps onto', () => {
  for (const [L, W, t] of [[40, 30, 1], [25, 18, 0.35], [60, 12, 0.5], [1000, 800, 7]]) {
    const dl = generate('rsc-0201', { L, W, H: Math.max(10, W / 2), t });
    assert(dl.panels.glueTab <= Math.min(L, W) * 0.45 + 1e-6,
      `flap ${dl.panels.glueTab} overruns a ${Math.min(L, W)} mm panel`);
  }
});

test('an explicit glue flap is always respected, warning or not', () => {
  assert(generate('rsc-0201', { L: 200, W: 150, H: 100, t: 3, glue: 22 }).panels.glueTab === 22);
  assert(generate('carton-ste', { L: 80, W: 40, H: 150, t: 0.35, glue: 8 }).panels.glueTab === 8);
});

test('styles with no glue flap are never warned about one', () => {
  for (const id of ['tray-4corner', 'mailer-tucktop', 'telescope-lid']) {
    const w = warnFor(id, sampleFor(id));
    assert(!w.some((x) => /glue flap/i.test(x)), `${id} has no glue flap but was warned`);
  }
});

test('a blank too big for any stock sheet is flagged', () => {
  const w = warnFor('rsc-0201', { L: 900, W: 800, H: 700, t: 7 });
  // Match the fact, not the wording: the sentence now names the stock size in
  // whichever unit the reader is using.
  assert(w.some((x) => /larger than the biggest sheet/i.test(x) && /2500/.test(x)),
    `got: ${w.join(' | ')}`);
});

test('corrugated in a tuck-end carton is flagged as the wrong format', () => {
  const w = warnFor('carton-ste', { L: 80, W: 40, H: 150, t: 3 });
  assert(w.some((x) => /folding-board format/i.test(x)), `got: ${w.join(' | ')}`);
});

test('a shallow RSC is told its flaps will stand proud', () => {
  const w = warnFor('rsc-0201', { L: 300, W: 200, H: 50, t: 3 });
  assert(w.some((x) => /stand proud/i.test(x)), `got: ${w.join(' | ')}`);
});

test('warnings never block: the dieline is still complete and exportable', () => {
  const dl = generate('rsc-0201', { L: 40, W: 30, H: 25, t: 4 });
  assert(dl.warnings.length > 0, 'expected warnings for this case');
  assert(dl.paths.length > 0 && dl.bbox.w > 0, 'a warned dieline must still be a dieline');
});

test('every style carries a warnings array, even when empty', () => {
  for (const st of STYLES) {
    const dl = generate(st.id, sampleFor(st.id));
    assert(Array.isArray(dl.warnings), `${st.id} has no warnings array`);
    for (const w of dl.warnings) {
      assert(typeof w === 'string' && w.length > 20, `${st.id}: unhelpfully short warning "${w}"`);
      assert(/[.!]$/.test(w.trim()), `${st.id}: warning should be a sentence: "${w}"`);
    }
  }
});

test('warnings() is pure and does not need a dieline', () => {
  const st = byId('rsc-0201');
  const p = normaliseParams({ L: 40, W: 30, H: 25, t: 4 });
  const w = warnings(p, st, null);
  assert(Array.isArray(w) && w.length > 0, 'should still advise without a built dieline');
});

/* ------------------------------------------------------------- comparing */
test('only styles whose L/W/H mean the box itself are comparable', () => {
  const yes = STYLES.filter(comparable).map((s) => s.id);
  const no = STYLES.filter((s) => !comparable(s)).map((s) => s.id);
  for (const id of ['rsc-0201', 'hsc', 'fol-0203', 'mailer-tucktop', 'tray-4corner',
                    'carton-ste', 'carton-rte', 'sleeve']) {
    assert(yes.includes(id), `${id} should be comparable`);
  }
  // A lid is sized to the box it covers, a hexagon is measured across the flats,
  // and a pillow box uses Width as its curve depth. Comparing those against a
  // plain L/W/H would line up numbers that do not mean the same thing.
  for (const id of ['telescope-lid', 'hexagon', 'pillow']) {
    assert(no.includes(id), `${id} should NOT be comparable`);
  }
});

test('comparable styles all accept a plain internal size, or say why not', () => {
  const p = { L: 200, W: 150, H: 100, t: 3 };
  for (const st of STYLES.filter(comparable)) {
    try { generate(st.id, p); }
    catch (e) {
      assert(e.validation && e.message.length > 20,
        `${st.id} failed without a usable explanation: ${e.message}`);
    }
  }
});

test('comparing ranks by board used, and the sleeve always uses least', () => {
  const p = { L: 200, W: 150, H: 100, t: 3 };
  const areas = STYLES.filter(comparable).map((st) => {
    try { return { id: st.id, a: generate(st.id, p).blankAreaM2 }; } catch { return null; }
  }).filter(Boolean).sort((x, y) => x.a - y.a);
  assert(areas[0].id === 'sleeve', `expected the sleeve to use least board, got ${areas[0].id}`);
  const rsc = areas.find((x) => x.id === 'rsc-0201');
  const fol = areas.find((x) => x.id === 'fol-0203');
  assert(fol.a > rsc.a, 'full overlap must use more board than a plain RSC');
});

test('cautions: follow the reader unit, except board caliper', () => {
  // Sizes chosen to trip each caution in turn.
  const trips = [
    ['rsc-0201', { L: 200, W: 150, H: 40, t: 3 }],       // flaps stand proud
    ['rsc-0201', { L: 600, W: 20, H: 400, t: 0.5 }],     // flimsy + extreme ratio
    ['mailer-tucktop', { L: 220, W: 160, H: 20, t: 3 }], // thick board, small box
    ['rsc-0201', { L: 1400, W: 900, H: 700, t: 4 }],     // blank bigger than any sheet
  ];
  let seen = 0;
  for (const [id, p] of trips) {
    const inch = generate(id, p, { unit: 'in' }).warnings || [];
    const mm = generate(id, p, { unit: 'mm' }).warnings || [];
    assert(mm.length === inch.length, `${id}: different number of cautions per unit`);
    seen += inch.length;
    for (const w of inch) {
      // Only the caliper sentence may still say "mm", and it names the board.
      const strays = (w.match(/\d+(\.\d+)? mm\b/g) || []).filter((m) =>
        !new RegExp(`${m.replace('.', '\\.')} board|board is|caliper`).test(w));
      assert(strays.length === 0, `${id}: caution still in millimetres — "${w}"`);
    }
  }
  assert(seen >= 5, `only ${seen} cautions fired; the trip sizes have drifted`);
});
