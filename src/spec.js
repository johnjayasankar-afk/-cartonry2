/**
 * The rows printed on the spec sheet - the one page that leaves the building.
 *
 * This lived inside app.js and read the interface directly, which meant the
 * highest-stakes artefact in the product, the page a converter quotes from, was
 * the only one that could not be tested or regenerated outside a browser. It
 * takes what it needs as arguments now: the same rows, from anywhere.
 */
import { dim, dim1, dim2, dim3, area1 } from './geom.js';
import { comparable } from './registry.js';
import { sheetYield, blankWeightG } from './estimate.js';
import { externalFor, externalSize } from './fold.js';

const DEFAULT_FIELDS = { L: 'Length', W: 'Width', H: 'Height' };
const fmt = (n) => (Math.round(n * 1000) / 1000).toString();

/** A style's dimensions, in the order and unit the reader is working in. */
const joinDims = (vals, u) => (vals.length === 3 ? dim3(vals[0], vals[1], vals[2], u)
  : vals.length === 2 ? dim2(vals[0], vals[1], u)
  : vals.length === 1 ? dim1(vals[0], u)
  : '—');

/**
 * The assembled outside size, measured off the folded model rather than
 * guessed. Styles that close by bending have no folded model, and a style
 * whose fold throws has nothing honest to report, so both give null.
 */
export function externalOf(dl, style, wanted) {
  if (!dl || typeof style.fold !== 'function') return null;
  try {
    const p = dl.params;
    const out = wanted && wanted.length
      ? externalFor(style.fold(p), p.t, wanted)
      : externalSize(style.fold(p), p.t);
    return out.every(Number.isFinite) ? out : null;
  } catch { return null; }
}

/**
 * @param {object} dl        the dieline
 * @param {object} style     its style record
 * @param {object} opts      unit, sheet, nest, gsm, and the pack-out if there is one
 * @returns {Array<[string,string]>} label/value pairs; ['',''] is a spacer
 */
export function specRows(dl, style, opts = {}) {
  const u = opts.unit || 'mm';
  const fld = { ...DEFAULT_FIELDS, ...(style.fields || {}) };
  const rows = [];
  for (const k of ['L', 'W', 'H']) if (fld[k] != null) rows.push([fld[k], dim1(dl.params[k], u)]);
  // Caliper stays in millimetres in both modes. Board is specified in mm or
  // microns by every mill and converter, including in the US, and "0.0138 in"
  // is not a number anyone in the trade would recognise.
  rows.push(['Board caliper', `${fmt(dl.params.t)} mm`]);
  rows.push(['', '']);
  // Paired to the reader's own axes for the row they read, sorted for the
  // girth arithmetic, which is defined on the longest side and the two others.
  const axes = ['L', 'W', 'H'].filter((k) => fld[k] != null);
  const extPaired = externalOf(dl, style, axes.map((k) => dl.params[k]));
  const extSorted = externalOf(dl, style);
  if (extPaired) rows.push(['Outside, assembled', joinDims(extPaired, u)]);
  if (extSorted) {
    // Length + girth is how a carrier states a size limit. Quoting the formula
    // is fact; quoting any particular carrier's threshold would not be, so the
    // number is given and the comparison left to the reader.
    rows.push(['Length + girth', dim1(extSorted[0] + 2 * (extSorted[1] + extSorted[2]), u)]);
  }
  // Capacity only where L/W/H really are the cavity. A telescope lid is
  // dimensioned by the box it covers and a hexagon by its flats, so
  // multiplying the three fields together would produce a confident wrong
  // number in both cases.
  if (comparable(style)) {
    rows.push(['Capacity', `${(dl.params.L * dl.params.W * dl.params.H / 1e6).toFixed(2)} L`]);
  }
  rows.push(['', '']);
  rows.push(['Blank size', dim2(dl.bbox.w, dl.bbox.h, u)]);
  rows.push(['Board area per box', area1(dl.blankAreaM2, u)]);
  for (const [k, v] of Object.entries(dl.panels)) {
    rows.push([k.replace(/([A-Z])/g, ' $1').replace(/^./, (m) => m.toUpperCase()),
               typeof v === 'number' ? dim1(v, u) : String(v)]);
  }
  const sheet = opts.sheet;
  if (sheet) {
    const y = sheetYield(dl.bbox.w, dl.bbox.h, sheet.w, sheet.h, opts.nest || {});
    rows.push(['', '']);
    rows.push(['Sheet', dim2(sheet.w, sheet.h, u)]);
    rows.push(['Blanks per sheet', y.perSheet ? `${y.perSheet}  (${y.layout})` : 'does not fit']);
    if (y.perSheet) rows.push(['Board wasted', `${y.wastePct}%`]);
    if (y.rotatedCount) rows.push(['Turned 90°', `${y.rotatedCount} of ${y.perSheet}`]);
  }
  const gsm = opts.gsm;
  if (gsm) rows.push(['Weight per box', `${blankWeightG(dl.blankAreaM2, gsm)} g at ${gsm} g/m²`]);

  // No pricing on this sheet, deliberately.
  //
  // It is described in the interface as the page you send to your printer, and
  // printing your own cost basis on a document you email to a supplier is a
  // negotiating mistake the tool should not make on the reader's behalf. Board
  // area, weight and sheet yield stay - a converter needs those. What the board
  // costs YOU stays in the material panel, on screen.

  // Pack-out. The count is only meaningful beside the container and the load
  // height it assumed, so all three are stated or none are.
  const { pack, container } = opts;
  if (pack && container) {
    rows.push(['', '']);
    rows.push(['Packed into', `${container.name} ${dim2(container.w, container.d, u)}`]);
    rows.push(['Load height', dim1(pack.container.h, u)]);
    rows.push(['Per layer', `${pack.perLayer}  (${pack.layout})`]);
    rows.push(['Layers', `${pack.layers}`]);
    rows.push(['Boxes per load', pack.total.toLocaleString()]);
  }
  return rows;
}
