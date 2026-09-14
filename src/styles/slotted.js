/**
 * Variants of the slotted case that share the RSC blank skeleton.
 *  - FOL  : Full Overlap - flaps as deep as the panel they meet, fully overlapping.
 *  - HSC  : Half Slotted Container - open top (no top flaps), e.g. for a lid to fit over.
 * Both reuse the "internal dimension + one caliper" score rule documented in rsc.js.
 */
import { LAYER, makeDieline } from '../model.js';
import { path, line } from '../geom.js';
import { foldSlotted, lenOf } from './shared.js';

function slottedBlank(p, { topFlap, botFlap, id, name, code, family, notes }) {
  const { L, W, H, t, glue, slot: s } = p;
  const pL = L + t, pW = W + t, bodyH = H + t;
  const chamfer = Math.min(6, glue * 0.4, bodyH * 0.15);

  const x0 = 0, x1 = glue;
  const x2 = x1 + pL, x3 = x2 + pW, x4 = x3 + pL, x5 = x4 + pW;
  const y1 = botFlap, y2 = y1 + bodyH, y3 = y2 + topFlap, y0 = 0;
  const inner = [x2, x3, x4];

  const o = [[x1, y1], [x0, y1 + chamfer], [x0, y2 - chamfer], [x1, y2]];
  if (topFlap > 0) {
    o.push([x1, y3]);
    for (const xs of inner) o.push([xs - s / 2, y3], [xs - s / 2, y2], [xs + s / 2, y2], [xs + s / 2, y3]);
    o.push([x5, y3]);
  } else {
    o.push([x5, y2]);
  }
  o.push([x5, y0]);
  if (botFlap > 0) {
    for (const xs of [...inner].reverse()) o.push([xs + s / 2, y0], [xs + s / 2, y1], [xs - s / 2, y1], [xs - s / 2, y0]);
  }
  o.push([x1, y0]);

  const paths = [path(LAYER.CUT, o, true)];
  for (const x of [x1, x2, x3, x4]) paths.push(line(LAYER.CREASE, x, y1, x, y2));
  const spans = [[x1, x2 - s / 2], [x2 + s / 2, x3 - s / 2], [x3 + s / 2, x4 - s / 2], [x4 + s / 2, x5]];
  for (const [a, b] of spans) {
    if (botFlap > 0) paths.push(line(LAYER.CREASE, a, y1, b, y1));
    if (topFlap > 0) paths.push(line(LAYER.CREASE, a, y2, b, y2));
  }
  paths.push(path(LAYER.GLUE, [[x0, y1 + chamfer], [x1, y1], [x1, y2], [x0, y2 - chamfer]], true));

  return makeDieline({
    id, name, code, family, paths, params: p,
    panels: { panelL: pL, panelW: pW, bodyH, topFlap, botFlap, glueTab: glue, slotWidth: s },
    notes,
  });
}

export const fol = {
  id: 'fol-0203', name: 'Full Overlap Slotted Container (FOL)', code: '0203',
  family: 'Corrugated shipping',
  // Chosen for stiffness, so single-wall B at least.
  board: { caliper: 3, format: 'corrugated' }, free: false, needs: ['L', 'W', 'H'],
  blurb: 'Flaps run the full panel width and fully overlap - a stronger, stiffer base for heavy goods.',
  validate: (p) => (p.slot > Math.min(p.L, p.W) / 2 ? ['Slot width is too large for these panel sizes.'] : []),
  fold: (p) => foldSlotted(p, { topFlap: p.W - p.flapGap, botFlap: p.W - p.flapGap }),
  build(p, ctx) {
    const F = p.W - p.flapGap;   // full overlap: flap as deep as the box is wide
    return slottedBlank(p, {
      topFlap: F, botFlap: F, id: fol.id, name: fol.name, code: fol.code, family: fol.family,
      notes: [`Flap depth ${lenOf(ctx)(F)} - flaps fully overlap for stacking strength.`,
              'Uses more board than an RSC; check your sheet size before ordering.'],
    });
  },
};

export const hsc = {
  id: 'hsc', name: 'Half Slotted Container (open top)', code: null,
  family: 'Corrugated shipping',
  // As the RSC it is cut from.
  board: { caliper: 3, format: 'corrugated' }, free: false, needs: ['L', 'W', 'H'],
  blurb: 'An RSC with no top flaps - an open tray for a separate lid to telescope over.',
  fold: (p) => foldSlotted(p, { topFlap: 0, botFlap: (p.W - p.flapGap) / 2 }),
  build(p, ctx) {
    const F = (p.W - p.flapGap) / 2;
    return slottedBlank(p, {
      topFlap: 0, botFlap: F, id: hsc.id, name: hsc.name, code: hsc.code, family: hsc.family,
      notes: [`Bottom flap depth ${lenOf(ctx)(F)} - flaps meet at the centre.`,
              'Open top: pair with a telescoping lid, sized one caliper larger all round.'],
    });
  },
};
