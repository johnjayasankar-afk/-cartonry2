/**
 * Fold models shared by the slotted-case family (RSC / FOL / HSC).
 *
 * Sign convention, established once and reused everywhere:
 *   - Vertical hinges run +Y; +90 deg wraps the next panel toward -Z, so four
 *     panels in a row close into a tube.
 *   - Flap hinges run +X. A flap BELOW its hinge folds inward at +90; a flap
 *     ABOVE its hinge folds inward at -90.
 * The fold tests measure the assembled box, so a wrong sign fails loudly.
 */
import { panel, hinge, rect } from '../fold.js';

export function foldSlotted(p, { topFlap, botFlap }) {
  const { L, W, H, t, glue, slot: s } = p;
  const pL = L + t, pW = W + t, bodyH = H + t;
  const chamfer = Math.min(6, glue * 0.4, bodyH * 0.15);
  const x0 = 0, x1 = glue;
  const x2 = x1 + pL, x3 = x2 + pW, x4 = x3 + pL, x5 = x4 + pW;
  const y1 = botFlap, y2 = y1 + bodyH, y3 = y2 + topFlap, y0 = 0;

  // Flap runs stop short at the slots, exactly as the cut outline does.
  const spans = [[x1, x2 - s / 2], [x2 + s / 2, x3 - s / 2],
                 [x3 + s / 2, x4 - s / 2], [x4 + s / 2, x5]];
  const names = ['Side', 'End', 'Side', 'End'];

  const withFlaps = (id, a, b, i) => {
    const kids = [];
    const [fa, fb] = spans[i];
    if (botFlap > 0) kids.push(hinge([fa, y1], [fb, y1], 90,
      panel(id + '-bf', rect(fa, y0, fb, y1), { kind: 'flap', label: 'Flap' })));
    if (topFlap > 0) kids.push(hinge([fa, y2], [fb, y2], -90,
      panel(id + '-tf', rect(fa, y2, fb, y3), { kind: 'flap', label: 'Flap' })));
    return panel(id, rect(a, y1, b, y2), { label: names[i], children: kids });
  };

  // Chain the body panels: each wraps 90 deg off the previous one.
  const p4 = withFlaps('p4', x4, x5, 3);
  const p3 = withFlaps('p3', x3, x4, 2);
  p3.children.push(hinge([x4, y1], [x4, y2], 90, p4));
  const p2 = withFlaps('p2', x2, x3, 1);
  p2.children.push(hinge([x3, y1], [x3, y2], 90, p3));
  const p1 = withFlaps('p1', x1, x2, 0);
  p1.children.push(hinge([x2, y1], [x2, y2], 90, p2));

  // Manufacturer's joint folds inward against the last panel.
  p1.children.push(hinge([x1, y1], [x1, y2], -90,
    panel('glue', [[x0, y1 + chamfer], [x1, y1], [x1, y2], [x0, y2 - chamfer]],
      { kind: 'glue', label: 'Glue' })));
  return p1;
}

/**
 * The length formatter a builder should use when writing its notes.
 *
 * Notes are prose shown next to the drawing, so they have to be written in
 * whatever unit the reader is working in - a flap depth quoted in millimetres
 * under a blank size quoted in inches is the same mixed-unit problem as any
 * other, just further down the page. The geometry never sees this: it is only
 * ever handed millimetres, and only the sentences change.
 *
 * Board CALIPER is the exception and stays metric wherever it appears, because
 * board is specified in millimetres or microns by every mill and converter.
 *
 * @param {object} ctx  build context from registry.generate(); absent in tests
 *                      and in the page builder, which both want millimetres.
 */
export const lenOf = (ctx) => (ctx && ctx.len)
  || ((mm) => `${Math.round(mm * 10) / 10} mm`);
