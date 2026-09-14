import { test, assert, near } from './harness.js';
import { dim, dim1, dim2, dim3, unitLabel, toMm, fromMm, parseLength, convertShown,
         toArea, fromArea, area1, areaLabel, MM_PER_INCH } from '../src/geom.js';

test('units: a length reads the way a person writes it', () => {
  assert(dim1(747, 'mm') === '747 mm', dim1(747, 'mm'));
  assert(dim1(746.52, 'mm') === '746.5 mm', dim1(746.52, 'mm'));
  assert(dim1(200, 'in') === '7.87″', dim1(200, 'in'));
  assert(dim2(747, 253, 'mm') === '747 × 253 mm', dim2(747, 253, 'mm'));
  assert(dim3(200, 150, 100, 'mm') === '200 × 150 × 100 mm', dim3(200, 150, 100, 'mm'));
});

test('units: trailing zeros are dropped, not printed', () => {
  // "747.0 mm" is what a program writes; "747 mm" is what a person writes.
  assert(!dim1(747.0, 'mm').includes('.'), dim1(747.0, 'mm'));
  assert(!dim1(25.4, 'in').includes('.00'), dim1(25.4, 'in'));
  assert(dim1(25.4, 'in') === '1″', dim1(25.4, 'in'));
});

test('units: the inch mark is a double prime, not a quote', () => {
  assert(unitLabel('in') === '″', 'wrong inch mark');
  assert(dim1(25.4, 'in').endsWith('″'), 'inch length not marked');
  assert(dim1(10, 'mm').endsWith(' mm'), 'mm length not spaced');
});

test('units: nothing unreadable is shown as a number', () => {
  for (const bad of [NaN, Infinity, -Infinity, undefined, null]) {
    assert(dim(bad, 'mm') === '—', `dim(${bad}) = ${dim(bad, 'mm')}`);
    assert(dim1(bad, 'in') === '—', `dim1(${bad}) = ${dim1(bad, 'in')}`);
  }
});

test('units: precision is finer than any die-cutting tolerance', () => {
  // 0.1 mm and 0.01 in are both well inside what a die can hold, so rounding
  // for display can never mislead about whether a box will close.
  near(Math.abs(747.04 - +dim(747.04, 'mm')), 0.04, 0.001);
  const inchErrMm = Math.abs(200 - +dim(200, 'in') * MM_PER_INCH);
  assert(inchErrMm < 0.13, `inch rounding loses ${inchErrMm.toFixed(3)} mm`);
});

test('units: switching back and forth does not drift the value', () => {
  // setUnit() re-writes the input boxes on every toggle. If that round trip
  // lost anything, a box would shrink slightly each time someone pressed U.
  for (const start of [200, 150, 100, 0.35, 3, 12.7, 1, 762, 0.1]) {
    let text = String(start), unit = 'mm', kept = NaN;
    for (let i = 0; i < 20; i++) {
      const next = unit === 'mm' ? 'in' : 'mm';
      const r = convertShown(text, unit, next, kept);
      text = r.text; kept = r.mm; unit = next;
    }
    const backMm = toMm(parseLength(text), unit);
    near(backMm, start, 1e-9, `${start} mm drifted to ${backMm} after 20 toggles`);
  }
});

test('units: a typed fraction survives the round trip', () => {
  // Anyone working in inches types "12 1/2", and the value has to come back
  // as 12.5 in, not as a parse failure that silently becomes a default.
  near(toMm(parseLength('12 1/2'), 'in'), 12.5 * MM_PER_INCH, 1e-9);
  assert(dim1(toMm(parseLength('12 1/2'), 'in'), 'in') === '12.5″',
    dim1(toMm(parseLength('12 1/2'), 'in'), 'in'));
});

test('units: a value the reader types over is honoured, not snapped back', () => {
  // The remembered millimetres must not override a real edit. Type 6 where the
  // box said 5.906, and you get six inches, not the 150 mm it used to hold.
  const first = convertShown('150', 'mm', 'in', NaN);
  assert(first.text === '5.906', first.text);
  const edited = convertShown('6', 'in', 'mm', first.mm);
  near(edited.mm, 6 * MM_PER_INCH, 1e-9, 'an edit was snapped away');
  // ...while an untouched box round-trips exactly.
  const back = convertShown(first.text, 'in', 'mm', first.mm);
  near(back.mm, 150, 1e-12, 'untouched value drifted');
  assert(back.text === '150', back.text);
});

test('units: junk in the box does not become a silent zero-size box', () => {
  const r = convertShown('twelve', 'mm', 'in', NaN);
  assert(r.mm === 0, `got ${r.mm}`);       // validation then names the field
  assert(r.text === '0', r.text);
});

test('units: area follows the length unit, and the factor is right', () => {
  // 1 m2 is 10.7639 ft2. Getting this wrong would understate a board bill by
  // an order of magnitude, in the direction that flatters the estimate.
  near(toArea(1, 'in'), 10.7639104, 1e-6);
  near(fromArea(toArea(0.189, 'in'), 'in'), 0.189, 1e-12);
  assert(area1(0.189, 'mm') === '0.189 m²', area1(0.189, 'mm'));
  assert(area1(0.189, 'in') === '2.03 ft²', area1(0.189, 'in'));
  assert(area1(NaN, 'in') === '—', area1(NaN, 'in'));
});

test('units: a small blank keeps its area instead of rounding to nothing', () => {
  // A jewellery carton's blank is about 0.0039 m2. Three fixed decimals turns
  // that into "0.004" - a 1.5% error - and anything under 0.0005 into "0.000",
  // which made board area, weight and cost all read zero.
  assert(area1(0.00394134, 'mm') === '0.00394 m²', area1(0.00394134, 'mm'));
  assert(area1(0.0008553, 'mm') === '0.000855 m²', area1(0.0008553, 'mm'));
  assert(!/^0\.000 /.test(area1(0.0004, 'mm')), area1(0.0004, 'mm'));
  // ...and a big run total does not sprout meaningless decimals.
  assert(area1(160.34, 'mm') === '160 m²', area1(160.34, 'mm'));
});

test('units: a board price converts so it still means the same money', () => {
  // GBP 1.20 per square metre is GBP 0.111 per square foot. If the number were
  // simply relabelled, switching units would multiply the quoted cost by ten.
  const perM2 = 1.2;
  const perFt2 = fromArea(perM2, 'in');       // price per unit area inverts
  near(perFt2, 1.2 / 10.7639104, 1e-9);
  // A 0.189 m2 blank must cost the same either way round.
  near(0.189 * perM2, toArea(0.189, 'in') * perFt2, 1e-9);
});
