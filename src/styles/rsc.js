/**
 * Regular Slotted Container (RSC) - international fibreboard case code 0201.
 * The standard shipping carton: one blank, four body panels, four flaps top
 * and bottom, all flaps the same depth so the outer pair meet at the centre.
 *
 *  BLANK LAYOUT (Y up, origin bottom-left)
 *
 *   y3 ┌────┬────┬────┬────┐   top flaps (depth F)
 *   y2 ├─┬──┼────┼────┼────┤   top score
 *      │G│  │    │    │    │   body (height H + t)
 *   y1 ├─┴──┼────┼────┼────┤   bottom score
 *   y0 └────┴────┴────┴────┘   bottom flaps (depth F)
 *      x0 x1   x2   x3   x4  x5
 *         L+t  W+t  L+t  W+t
 *
 * GEOMETRY RULES (documented so they can be checked, not taken on trust):
 *  - Score-to-score panel width = internal dimension + one board caliper.
 *    Folding a strip through 90 deg consumes one caliper of INNER face length
 *    per corner; each panel meets two corners and so gains t overall. This is
 *    the standard "add one caliper" rule used by corrugated converters.
 *  - Flap depth F = (W - flapGap) / 2, so the two outer flaps meet at the
 *    centre line of the base. flapGap opens a deliberate relief gap.
 *  - Slots are centred on the vertical scores and are one caliper wide, so
 *    flaps clear each other when folded.
 */
import { LAYER, makeDieline } from '../model.js';
import { path, line } from '../geom.js';
import { foldSlotted, lenOf } from './shared.js';

export const rsc = {
  id: 'rsc-0201',
  name: 'Regular Slotted Container (RSC)',
  code: '0201',
  family: 'Corrugated shipping',
  // B-flute is the standard shipping case board.
  board: { caliper: 3, format: 'corrugated' },
  blurb: 'The standard shipping box. All flaps the same depth; outer flaps meet at the centre.',
  needs: ['L', 'W', 'H'],
  free: true,
  validate: (p) => {
    const e = [];
    if (p.W - p.flapGap <= 0) e.push('Width must exceed the flap gap.');
    if (p.slot > Math.min(p.L, p.W) / 2) e.push('Slot width is too large for these panel sizes.');
    return e;
  },
  warn: (p, dl, c = { len: (v) => `${Math.round(v)} mm` }) => (p.H < p.W / 2
    ? [`The flaps are ${c.len(p.W / 2)} deep but the box is only ${c.len(p.H)} tall, so they `
       + 'will stand proud of the side walls when folded. A tray or a full-overlap case suits a '
       + 'shallow box better.']
    : []),

  fold: (p) => foldSlotted(p, { topFlap: (p.W - p.flapGap) / 2, botFlap: (p.W - p.flapGap) / 2 }),

  build(p, ctx) {
    const { L, W, H, t, glue, slot: s, flapGap } = p;
    const F = (W - flapGap) / 2;            // flap depth
    const pL = L + t, pW = W + t;           // score-to-score panel widths
    const bodyH = H + t;                    // score-to-score body height
    const chamfer = Math.min(6, glue * 0.4, bodyH * 0.15); // glue-tab chamfer

    const x0 = 0, x1 = glue;
    const x2 = x1 + pL, x3 = x2 + pW, x4 = x3 + pL, x5 = x4 + pW;
    const y0 = 0, y1 = F, y2 = y1 + bodyH, y3 = y2 + F;

    const scores = [x1, x2, x3, x4];        // vertical fold lines
    const inner = [x2, x3, x4];             // scores that carry a slot

    // ---- CUT OUTLINE (single closed polygon, traced clockwise) ----
    const o = [];
    o.push([x1, y1]);                       // glue tab, bottom
    o.push([x0, y1 + chamfer]);
    o.push([x0, y2 - chamfer]);
    o.push([x1, y2]);                       // glue tab, top

    // Top edge: up over each flap, down into each slot.
    o.push([x1, y3]);
    for (const xs of inner) {
      o.push([xs - s / 2, y3], [xs - s / 2, y2], [xs + s / 2, y2], [xs + s / 2, y3]);
    }
    o.push([x5, y3]);

    o.push([x5, y0]);                       // right edge, full height

    // Bottom edge, traced right to left (mirror of the top).
    for (const xs of [...inner].reverse()) {
      o.push([xs + s / 2, y0], [xs + s / 2, y1], [xs - s / 2, y1], [xs - s / 2, y0]);
    }
    o.push([x1, y0]);

    const paths = [path(LAYER.CUT, o, true)];

    // ---- CREASES ----
    for (const x of scores) paths.push(line(LAYER.CREASE, x, y1, x, y2));   // body folds
    // Flap folds, drawn per panel so they stop at the slots.
    const spans = [[x1, x2 - s / 2], [x2 + s / 2, x3 - s / 2],
                   [x3 + s / 2, x4 - s / 2], [x4 + s / 2, x5]];
    for (const [a, b] of spans) {
      paths.push(line(LAYER.CREASE, a, y1, b, y1));
      paths.push(line(LAYER.CREASE, a, y2, b, y2));
    }

    // ---- GLUE AREA ----
    paths.push(path(LAYER.GLUE,
      [[x0, y1 + chamfer], [x1, y1], [x1, y2], [x0, y2 - chamfer]], true));

    return makeDieline({
      id: rsc.id, name: rsc.name, code: rsc.code, family: rsc.family,
      paths, params: p, margin: 0,
      panels: { panelL: pL, panelW: pW, bodyH, flapDepth: F, glueTab: glue, slotWidth: s },
      notes: [
        `Panels are internal dimension + ${t} mm caliper (score to score).`,
        `Flap depth ${lenOf(ctx)(F)} - outer flaps meet at the centre.`,
        `Slots ${s} mm wide, centred on the vertical scores.`,
      ],
    });
  },
};
