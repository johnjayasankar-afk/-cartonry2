// ---------------------------------------------------------------------------
// Pack-out: how many finished boxes go into a case or onto a pallet.
//
// The tool already knows two things nobody else on the page knows: the box's
// measured OUTSIDE size, and how to nest rectangles well. Put them together
// and it can answer the question that follows every box specification -
// "how many ship in one carton?" - which for most e-commerce sellers is a
// larger number than the board bill the material panel already computes.
//
// WHAT THIS IS. Axis-aligned stacking: a repeating floor pattern, repeated
// upward in identical layers. Each of the three ways up is tried and the best
// kept. The floor pattern comes from the same guillotine nester the sheet view
// uses, so a layer may mix upright and turned boxes - which is what a person
// packing a case actually does.
//
// WHAT THIS IS NOT. It does not interlock layers, brick-bond them, rotate a
// box off-axis, allow overhang, or know anything about weight, stacking
// strength or how a pallet is wrapped. It is a floor plan and a count, and the
// interface says so. A real pallet spec also has to respect the carrier's
// height limit and the crush strength of the bottom layer, and neither of
// those is a geometry question.
// ---------------------------------------------------------------------------
import { sheetYield } from './estimate.js';

/**
 * Pallet footprints are published international standards, so they can be
 * stated as fact. Load height is not: it depends on the carrier, the trailer
 * and the goods, so it is always the reader's to enter.
 */
export const CONTAINERS = [
  { id: 'euro',    name: 'Euro pallet (EUR 1)',     w: 1200, d: 800,  kind: 'pallet' },
  { id: 'iso1210', name: 'ISO pallet 1200 × 1000',  w: 1200, d: 1000, kind: 'pallet' },
  { id: 'gma',     name: 'North American 48 × 40″', w: 1219, d: 1016, kind: 'pallet' },
  { id: 'case60',  name: 'Shipping case 600 × 400', w: 600,  d: 400,  kind: 'case' },
  { id: 'case40',  name: 'Shipping case 400 × 300', w: 400,  d: 300,  kind: 'case' },
];

export const containerById = (id) => CONTAINERS.find((c) => c.id === id);

const round = (v, d = 1) => Math.round(v * 10 ** d) / 10 ** d;

/**
 * Fit a box into a container.
 *
 * @param {number[]} box        the box's OUTSIDE dimensions, any order, mm
 * @param {object} container    { w, d, h } internal, mm - h is the load height
 * @param {object} opts         { gutter } clearance between boxes, mm
 * @returns {object|null} the best arrangement found, or null for bad input
 */
export function packInto(box, container, opts = {}) {
  const gutter = Math.max(0, opts.gutter ?? 0);
  if (!Array.isArray(box) || box.length !== 3) return null;
  if (!box.every((v) => Number.isFinite(v) && v > 0)) return null;
  const { w, d, h } = container || {};
  if (![w, d, h].every((v) => Number.isFinite(v) && v > 0)) return null;

  let best = null;
  // Three ways up: whichever box dimension stands vertical. The remaining two
  // are the footprint, and the nester decides how they tile.
  for (let up = 0; up < 3; up++) {
    const vertical = box[up];
    const foot = box.filter((_, i) => i !== up);
    const layers = Math.floor(h / vertical);
    if (layers < 1) continue;
    const y = sheetYield(foot[0], foot[1], w, d, { gutter, margin: 0, allowRotation: true });
    if (!y.perSheet) continue;
    const total = y.perSheet * layers;
    const usedVol = total * box[0] * box[1] * box[2];
    const cand = {
      total, perLayer: y.perSheet, layers,
      vertical: round(vertical, 2),
      footprint: [round(foot[0], 2), round(foot[1], 2)],
      layout: y.layout,
      placements: y.placements,
      rotatedPerLayer: y.rotatedCount,
      floorUsedPct: round(100 - y.wastePct, 1),
      // Of the container's whole volume, how much is box.
      volumeUsedPct: round((usedVol / (w * d * h)) * 100, 1),
      stackHeight: round(layers * vertical, 1),
      headroom: round(h - layers * vertical, 1),
      container: { w, d, h },
    };
    if (!best || cand.total > best.total
        || (cand.total === best.total && cand.volumeUsedPct > best.volumeUsedPct)) best = cand;
  }
  return best;
}

/**
 * One layer, seen from above. Rectangles rather than dielines: at this point
 * the box is a solid, and drawing its creases would say something false about
 * what is being counted.
 */
export function toLayerSVG(pack, opts = {}) {
  if (!pack) return '';
  const { w, d } = pack.container;
  const pad = Math.max(w, d) * 0.02;
  const W = w + pad * 2, H = d + pad * 2;
  const boxes = pack.placements.map((p, i) => `
    <rect x="${round(p.x + pad, 2)}" y="${round(H - p.y - p.h - pad, 2)}"
          width="${round(p.w, 2)}" height="${round(p.h, 2)}" rx="${Math.min(p.w, p.h) * 0.04}"
          fill="var(--pack-fill,rgba(13,110,140,.13))" stroke="var(--pack-line,#0d6e8c)"
          stroke-width="1.1" vector-effect="non-scaling-stroke"
          data-rot="${p.rot}"><title>Box ${i + 1}${p.rot ? ', turned 90°' : ''}</title></rect>`).join('');
  return `<svg viewBox="0 0 ${round(W, 2)} ${round(H, 2)}" width="100%"
    preserveAspectRatio="xMidYMid meet" role="img"
    aria-label="${pack.perLayer} boxes in one layer, ${pack.layout}, on a ${w} by ${d} millimetre footprint">
    <rect x="${round(pad, 2)}" y="${round(pad, 2)}" width="${w}" height="${d}" fill="none"
          stroke="var(--pack-edge,#8A94A0)" stroke-width="1.4" stroke-dasharray="6 4"
          vector-effect="non-scaling-stroke"/>
    ${boxes}
  </svg>`;
}

/**
 * The stack in elevation, seen from the side.
 *
 * The layer plan answers "how do they tile"; it cannot answer "how high does
 * this go" or "why is there space left over". One drawing without the other
 * tells half the story, and the half it leaves out is the one that decides
 * whether another layer would have fitted.
 */
export function toStackSVG(pack, opts = {}) {
  if (!pack) return '';
  const { w, h } = pack.container;
  const pad = Math.max(w, h) * 0.03;
  const W = w + pad * 2, H = h + pad * 2;
  const lay = pack.vertical;
  const bands = [];
  for (let i = 0; i < pack.layers; i++) {
    const y = H - pad - (i + 1) * lay;
    bands.push(`<rect x="${round(pad, 2)}" y="${round(y, 2)}" width="${w}" height="${round(lay, 2)}"
      fill="var(--pack-fill,rgba(13,110,140,.13))" stroke="var(--pack-line,#0d6e8c)"
      stroke-width="1.1" vector-effect="non-scaling-stroke"/>`);
  }
  // The gap that is left. Drawn, because "22 mm spare" in a sentence is a fact
  // and a visible sliver at the top of the stack is an explanation.
  const gap = pack.headroom > 0 ? `<rect x="${round(pad, 2)}" y="${round(pad, 2)}"
      width="${w}" height="${round(pack.headroom, 2)}" fill="none"
      stroke="var(--pack-edge,#8A94A0)" stroke-width="1" stroke-dasharray="4 3"
      vector-effect="non-scaling-stroke"/>` : '';
  return `<svg viewBox="0 0 ${round(W, 2)} ${round(H, 2)}" width="100%"
    preserveAspectRatio="xMidYMid meet" role="img"
    aria-label="${pack.layers} layers stacked ${Math.round(pack.stackHeight)} millimetres high,
      leaving ${Math.round(pack.headroom)} millimetres of the load height unused">
    <rect x="${round(pad, 2)}" y="${round(pad, 2)}" width="${w}" height="${h}" fill="none"
      stroke="var(--pack-edge,#8A94A0)" stroke-width="1.4" stroke-dasharray="6 4"
      vector-effect="non-scaling-stroke"/>
    ${bands.join('')}${gap}
  </svg>`;
}
