// The spec sheet is the one page that leaves the building. Until it was pulled
// out of app.js it could not be tested at all.
import { test, assert } from './harness.js';
import { specRows } from '../src/spec.js';
import { STYLES, byId, generate, comparable } from '../src/registry.js';
import { sampleFor } from './samples.js';

const SHEET = { std: 'B1 press sheet', w: 1000, h: 700 };
const NEST = { gutter: 4, margin: 10 };
const rowsFor = (id, opts = {}) => {
  const p = sampleFor(id);
  return specRows(generate(id, p), byId(id), { unit: 'mm', sheet: SHEET, nest: NEST, ...opts });
};
const labels = (rows) => rows.map((r) => r[0]);
const find = (rows, label) => (rows.find((r) => r[0] === label) || [])[1];

test('spec: every style produces a sheet with no broken values', () => {
  for (const s of STYLES) {
    const rows = rowsFor(s.id);
    assert(rows.length > 6, `${s.id}: only ${rows.length} rows`);
    for (const [label, value] of rows) {
      if (label === '' && value === '') continue;          // deliberate spacer
      assert(label !== '', `${s.id}: a value with no label: "${value}"`);
      assert(value !== '' && value != null, `${s.id}: "${label}" has no value`);
      assert(!/undefined|NaN|\[object/.test(String(value)),
        `${s.id}: "${label}" reads "${value}"`);
    }
  }
});

test('spec: the sheet a supplier receives never carries the reader\'s costs', () => {
  // A deliberate decision, not an accident of the current layout: printing your
  // own cost basis on a page you email to a converter is a negotiating mistake.
  // Weight and area stay, so this looks for money rather than for economics.
  const money = /cost|price|\bpaid\b|per box.*[$£€]|[$£€]/i;
  for (const s of STYLES) {
    for (const [label, value] of rowsFor(s.id, { gsm: 700, price: 1.25 })) {
      assert(!money.test(label), `${s.id}: spec sheet has a "${label}" row`);
      assert(!money.test(String(value)), `${s.id}: "${label}" reads "${value}"`);
    }
  }
});

test('spec: board caliper stays in millimetres in inch mode', () => {
  // Board is specified in mm or microns by every mill and converter, including
  // in the US. "0.0138 in" is not a number anyone in the trade would recognise.
  for (const s of STYLES) {
    const v = find(rowsFor(s.id, { unit: 'in' }), 'Board caliper');
    assert(/ mm$/.test(v), `${s.id}: caliper reads "${v}" in inch mode`);
  }
});

test('spec: inch mode converts every other length', () => {
  for (const s of STYLES) {
    for (const [label, value] of rowsFor(s.id, { unit: 'in' })) {
      if (label === 'Board caliper' || label === '') continue;
      assert(!/\d\s*mm\b/.test(String(value)),
        `${s.id}: "${label}" still reads "${value}" in inch mode`);
    }
  }
});

test('spec: a style never lists a dimension field it does not use', () => {
  // A hexagon is dimensioned across the flats and has no Width; printing one
  // would invite a converter to quote against a number that means nothing.
  for (const s of STYLES) {
    const fld = { L: 'Length', W: 'Width', H: 'Height', ...(s.fields || {}) };
    const ls = labels(rowsFor(s.id));
    for (const k of ['L', 'W', 'H']) {
      if (fld[k] == null) {
        assert(!ls.includes('Width') || k !== 'W',
          `${s.id}: hides the ${k} field but the spec sheet lists "Width"`);
      } else {
        assert(ls.includes(fld[k]), `${s.id}: spec sheet omits "${fld[k]}"`);
      }
    }
  }
});

test('spec: capacity is quoted only where the fields really are the cavity', () => {
  // A telescope lid is dimensioned by the box it covers and a hexagon by its
  // flats, so L x W x H would be a confident wrong number for both.
  for (const s of STYLES) {
    const has = labels(rowsFor(s.id)).includes('Capacity');
    assert(has === comparable(s),
      `${s.id}: capacity ${has ? 'quoted' : 'missing'}, comparable=${comparable(s)}`);
  }
});

test('spec: the sheet yield reported is the one for the sheet named', () => {
  // These three rows are only meaningful together - a "per sheet" count beside
  // a different sheet size is worse than no count.
  const rows = rowsFor('rsc-0201');
  const sheet = find(rows, 'Sheet');
  assert(sheet === '1000 × 700 mm', `named sheet reads "${sheet}"`);
  assert(find(rows, 'Blanks per sheet'), 'no blanks-per-sheet row beside the sheet');
  const noSheet = labels(specRows(generate('rsc-0201', sampleFor('rsc-0201')),
    byId('rsc-0201'), { unit: 'mm' }));
  assert(!noSheet.includes('Sheet') && !noSheet.includes('Blanks per sheet'),
    'quoted a sheet yield when no sheet was given');
});

test('spec: pack-out is stated in full or not at all', () => {
  // A box count without the container and load height it assumed is a number
  // someone will quote back at you.
  const dl = generate('rsc-0201', sampleFor('rsc-0201'));
  const withPack = specRows(dl, byId('rsc-0201'), { unit: 'mm', sheet: SHEET, nest: NEST,
    pack: { container: { h: 1800 }, perLayer: 12, layout: '4 × 3', layers: 8, total: 96 },
    container: { name: 'Euro pallet', w: 1200, d: 800 } });
  for (const l of ['Packed into', 'Load height', 'Per layer', 'Layers', 'Boxes per load']) {
    assert(labels(withPack).includes(l), `pack-out omits "${l}"`);
  }
  // Half an answer is not offered: no container means no rows at all.
  const half = specRows(dl, byId('rsc-0201'), { unit: 'mm', sheet: SHEET, nest: NEST,
    pack: { container: { h: 1800 }, perLayer: 12, layout: '4 × 3', layers: 8, total: 96 } });
  assert(!labels(half).includes('Boxes per load'),
    'quoted a box count with no container to quote it against');
});
