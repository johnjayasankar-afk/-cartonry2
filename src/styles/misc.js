/**
 * Sleeve, four-corner tray, tuck-top mailer and pillow box.
 *
 * BOARD ALLOWANCE CONVENTION (applies to every style in this file)
 *   Panels are modelled on the board's mid-surface. Real board of caliper t is
 *   centred on it, so each 90 deg fold moves the inner face t/2 inward.
 *     - A dimension bounded by folds at BOTH ends (a tube cross-section, a tray
 *       base) needs score-to-score = internal + t.
 *     - A dimension bounded by a fold at ONE end and an open cut edge at the
 *       other (a tray or mailer wall height) needs score-to-edge = internal + t/2.
 *   Both rules are verified by folding the net in 3D and measuring the result -
 *   see test/fold.test.js.
 */
import { LAYER, makeDieline } from '../model.js';
import { path, line, arcPts } from '../geom.js';
import { panel, hinge, rect } from '../fold.js';
import { lenOf } from './shared.js';

/* ------------------------------------------------------------------ SLEEVE */
const sleeveLayout = (p) => {
  const pL = p.L + p.t, pW = p.W + p.t;
  const x1 = p.glue;
  return { pL, pW, x0: 0, x1, x2: x1 + pL, x3: x1 + pL + pW,
           x4: x1 + 2 * pL + pW, x5: x1 + 2 * pL + 2 * pW,
           y0: 0, y1: p.H, ch: Math.min(5, p.glue * 0.4, p.H * 0.15) };
};

export const sleeve = {
  id: 'sleeve', name: 'Sleeve / belly band', code: null, family: 'Wrap',
  // A printed band is folding board, not corrugated.
  board: { caliper: 0.5, format: 'carton' },
  free: true, needs: ['L', 'W', 'H'],
  blurb: 'An open-ended band that slides over a tray or product. The simplest print-and-glue format.',
  fields: { L: 'Length', W: 'Width', H: 'Band height' },
  fold(p) {
    const { x0, x1, x2, x3, x4, x5, y0, y1, ch } = sleeveLayout(p);
    const mk = (id, a, b, label) => panel(id, rect(a, y0, b, y1), { label });
    const p4 = mk('s4', x4, x5, 'End'), p3 = mk('s3', x3, x4, 'Side');
    p3.children.push(hinge([x4, y0], [x4, y1], 90, p4));
    const p2 = mk('s2', x2, x3, 'End');
    p2.children.push(hinge([x3, y0], [x3, y1], 90, p3));
    const p1 = mk('s1', x1, x2, 'Side');
    p1.children.push(hinge([x2, y0], [x2, y1], 90, p2));
    p1.children.push(hinge([x1, y0], [x1, y1], -90,
      panel('glue', [[x0, y0 + ch], [x1, y0], [x1, y1], [x0, y1 - ch]], { kind: 'glue', label: 'Glue' })));
    return p1;
  },
  build(p, ctx) {
    const { x0, x1, x2, x3, x4, x5, y0, y1, ch, pL, pW } = sleeveLayout(p);
    const paths = [path(LAYER.CUT,
      [[x1, y0], [x0, y0 + ch], [x0, y1 - ch], [x1, y1], [x5, y1], [x5, y0]], true)];
    for (const x of [x1, x2, x3, x4]) paths.push(line(LAYER.CREASE, x, y0, x, y1));
    paths.push(path(LAYER.GLUE, [[x0, y0 + ch], [x1, y0], [x1, y1], [x0, y1 - ch]], true));
    return makeDieline({ id: sleeve.id, name: sleeve.name, family: sleeve.family, paths, params: p,
      panels: { panelL: pL, panelW: pW, height: p.H, glueTab: p.glue },
      notes: ['Open at both ends - dimensions are the internal cross-section it must slide over.',
              `Panels are internal dimension + ${p.t} mm caliper.`] });
  },
};

/* -------------------------------------------------------------------- TRAY */
const trayLayout = (p) => {
  const baseL = p.L + p.t, baseW = p.W + p.t;   // folds at both ends -> + one caliper
  const wall = p.H + p.t / 2;                    // one fold, one open edge -> + half
  const g = Math.max(0.5, p.t);
  return { baseL, baseW, wall, g,
           tab: Math.max(4, wall - Math.max(1.5, p.t)),
           xa: wall, xb: wall + baseL, ya: wall, yb: wall + baseW,
           right: 2 * wall + baseL, top: 2 * wall + baseW };
};

export const tray = {
  id: 'tray-4corner', name: 'Four-corner tray', code: null, family: 'Tray',
  // E-flute: thin enough to fold a clean corner tab.
  board: { caliper: 1.5, format: 'corrugated' },
  free: false, needs: ['L', 'W', 'H'],
  blurb: 'Open tray with glued or tucked corner tabs - inserts, produce trays, box bases.',
  fields: { L: 'Length', W: 'Width', H: 'Wall height' },
  validate: (p) => (p.H > Math.min(p.L, p.W) / 2 ? ['Wall height is more than half the base; the corner tabs will overlap.'] : []),
  fold(p) {
    const { wall, g, tab, xa, xb, ya, yb, right, top } = trayLayout(p);
    const base = panel('base', rect(xa, ya, xb, yb), { label: 'Base' });
    const wallNode = (id, poly, label, tabs) => panel(id, poly, { label, children: tabs || [] });
    // Corner tabs hang off the front and back walls and swing in behind the sides.
    // Hinges are always written ascending in Y so the sign of the fold does not
    // depend on which wall the tab belongs to - writing one descending swings
    // the tab outward instead of in, which the fold test catches.
    const tabs = (yEdge, dir) => {
      const lo = Math.min(yEdge, yEdge + dir * (wall - g));
      const hi = Math.max(yEdge, yEdge + dir * (wall - g));
      return [
        hinge([xa, lo], [xa, hi], 90,
          panel('tabL' + dir, rect(xa - tab, lo, xa, hi), { kind: 'flap', label: 'Tab' })),
        hinge([xb, lo], [xb, hi], -90,
          panel('tabR' + dir, rect(xb, lo, xb + tab, hi), { kind: 'flap', label: 'Tab' })),
      ];
    };
    base.children.push(
      hinge([xa, ya], [xa, yb], 90, wallNode('wL', rect(0, ya, xa, yb), 'Side')),
      hinge([xb, ya], [xb, yb], -90, wallNode('wR', rect(xb, ya, right, yb), 'Side')),
      hinge([xa, ya], [xb, ya], -90, wallNode('wF', rect(xa, 0, xb, ya), 'Front', tabs(ya, -1))),
      hinge([xa, yb], [xb, yb], 90, wallNode('wB', rect(xa, yb, xb, top), 'Back', tabs(yb, +1))),
    );
    return base;
  },
  build(p, ctx) {
    const LEN = lenOf(ctx);
    const { baseL, baseW, wall, g, tab, xa, xb, ya, yb, right, top } = trayLayout(p);
    const bot = 0, left = 0;
    const o = [
      [xa, bot], [xa - tab, bot], [xa - tab, bot + wall - g], [xa, bot + wall - g],
      [xa, ya], [left, ya], [left, yb], [xa, yb],
      [xa, yb + g], [xa - tab, yb + g], [xa - tab, top], [xa, top],
      [xb, top], [xb + tab, top], [xb + tab, yb + g], [xb, yb + g],
      [xb, yb], [right, yb], [right, ya], [xb, ya],
      [xb, bot + wall - g], [xb + tab, bot + wall - g], [xb + tab, bot], [xb, bot],
    ];
    const paths = [path(LAYER.CUT, o, true)];
    paths.push(line(LAYER.CREASE, xa, ya, xb, ya), line(LAYER.CREASE, xa, yb, xb, yb));
    paths.push(line(LAYER.CREASE, xa, ya, xa, yb), line(LAYER.CREASE, xb, ya, xb, yb));
    paths.push(line(LAYER.CREASE, xa, bot, xa, bot + wall - g), line(LAYER.CREASE, xb, bot, xb, bot + wall - g));
    paths.push(line(LAYER.CREASE, xa, yb + g, xa, top), line(LAYER.CREASE, xb, yb + g, xb, top));
    return makeDieline({ id: tray.id, name: tray.name, family: tray.family, paths, params: p,
      panels: { baseL, baseW, wallHeight: wall, cornerTab: tab },
      notes: [`Base is ${LEN(baseL)} x ${LEN(baseW)} score to score - internal size plus one ${p.t} mm caliper.`,
              `Walls ${LEN(wall)} to the cut edge (internal depth plus half a caliper).`,
              `Corner tabs ${LEN(tab)} - fold in and glue behind the side walls.`] });
  },
};

/* ------------------------------------------------------------------ MAILER */
const mailerLayout = (p) => {
  const baseL = p.L + p.t, baseW = p.W + p.t;
  const wall = p.H + p.t / 2;
  const g = Math.max(0.5, p.t);
  const tuck = p.tuck > 0 ? p.tuck : Math.max(10, Math.min(30, p.H * 0.8));
  return { baseL, baseW, wall, g, tuck,
           tab: Math.max(4, wall - g), ins: Math.max(1, p.t + 0.8),
           sh: Math.min(3, tuck * 0.3),
           xa: wall, xb: wall + baseL,
           y0: 0, y1: wall, y2: wall + baseW, y3: 2 * wall + baseW,
           y4: 2 * wall + 2 * baseW, y5: 2 * wall + 2 * baseW + tuck };
};

export const mailer = {
  id: 'mailer-tucktop', name: 'Tuck-top mailer box', code: null, family: 'E-commerce',
  // B-flute takes the knocks a posted parcel gets.
  board: { caliper: 3, format: 'corrugated' },
  free: false, needs: ['L', 'W', 'H'],
  blurb: 'The e-commerce mailer: hinged lid at the back, tuck flap at the front, four-corner walls.',
  fields: { L: 'Length', W: 'Width', H: 'Depth' },
  warn: (p, dl, c = { len: (v) => `${Math.round(v)} mm` }) => (p.t >= 3 && p.H < 25
    ? [`A ${c.len(p.H)} deep mailer in ${p.t} mm board is mostly board. The walls and tabs will `
       + 'crowd each other; either go shallower in a thinner grade or make it deeper.']
    : []),
  validate: (p) => (p.H > p.W / 2 ? ['Height is more than half the width; the lid dust flaps will foul the side walls.'] : []),
  fold(p) {
    const M = mailerLayout(p);
    const { wall, g, tab, ins, xa, xb, y0, y1, y2, y3, y4, y5 } = M;
    const base = panel('base', rect(xa, y1, xb, y2), { label: 'Base' });
    const tabsOn = (yEdge, dir) => {
      const lo = Math.min(yEdge, yEdge + dir * (wall - g));
      const hi = Math.max(yEdge, yEdge + dir * (wall - g));
      return [
        hinge([xa, lo], [xa, hi], 90,
          panel('mt' + dir + 'L', rect(xa - tab, lo, xa, hi), { kind: 'flap', label: 'Tab' })),
        hinge([xb, lo], [xb, hi], -90,
          panel('mt' + dir + 'R', rect(xb, lo, xb + tab, hi), { kind: 'flap', label: 'Tab' })),
      ];
    };
    // Lid hangs off the back wall; its dust flaps drop inside the side walls.
    const lid = panel('lid', rect(xa, y3, xb, y4), { label: 'Lid', children: [
      hinge([xa, y3], [xa, y4], 90, panel('lidL', rect(xa - wall, y3, xa, y4), { kind: 'flap', label: 'Dust flap' })),
      hinge([xb, y3], [xb, y4], -90, panel('lidR', rect(xb, y3, xb + wall, y4), { kind: 'flap', label: 'Dust flap' })),
      hinge([xa, y4], [xb, y4], 90, panel('tuck', rect(xa + ins, y4, xb - ins, y5), { kind: 'flap', label: 'Tuck' })),
    ] });
    const backWall = panel('wB', rect(xa, y2, xb, y3), { label: 'Back', children: [
      ...tabsOn(y2, +1), hinge([xa, y3], [xb, y3], 90, lid)] });
    base.children.push(
      hinge([xa, y1], [xa, y2], 90, panel('wL', rect(0, y1, xa, y2), { label: 'Side' })),
      hinge([xb, y1], [xb, y2], -90, panel('wR', rect(xb, y1, xb + wall, y2), { label: 'Side' })),
      hinge([xa, y1], [xb, y1], -90, panel('wF', rect(xa, y0, xb, y1), { label: 'Front', children: tabsOn(y1, -1) })),
      hinge([xa, y2], [xb, y2], 90, backWall),
    );
    return base;
  },
  build(p, ctx) {
    const LEN = lenOf(ctx);
    const M = mailerLayout(p);
    const { baseL, baseW, wall, g, tuck, tab, ins, sh, xa, xb, y0, y1, y2, y3, y4, y5 } = M;
    const o = [
      [xa, y0], [xa - tab, y0], [xa - tab, y1 - g], [xa, y1 - g],
      [xa, y1], [0, y1], [0, y2], [xa, y2],
      [xa, y2 + g], [xa - tab, y2 + g], [xa - tab, y3],
      [xa - wall, y3], [xa - wall, y4], [xa, y4],
      [xa + ins, y4 + sh], [xa + ins, y5], [xb - ins, y5], [xb - ins, y4 + sh], [xb, y4],
      [xb + wall, y4], [xb + wall, y3],
      [xb + tab, y3], [xb + tab, y2 + g], [xb, y2 + g],
      [xb, y2], [xb + wall, y2], [xb + wall, y1], [xb, y1],
      [xb, y1 - g], [xb + tab, y1 - g], [xb + tab, y0], [xb, y0],
    ];
    const paths = [path(LAYER.CUT, o, true)];
    for (const y of [y1, y2, y3, y4]) paths.push(line(LAYER.CREASE, xa, y, xb, y));
    paths.push(line(LAYER.CREASE, xa, y1, xa, y2), line(LAYER.CREASE, xb, y1, xb, y2));
    paths.push(line(LAYER.CREASE, xa, y3, xa, y4), line(LAYER.CREASE, xb, y3, xb, y4));
    paths.push(line(LAYER.CREASE, xa, y0, xa, y1 - g), line(LAYER.CREASE, xb, y0, xb, y1 - g));
    paths.push(line(LAYER.CREASE, xa, y2 + g, xa, y3), line(LAYER.CREASE, xb, y2 + g, xb, y3));
    return makeDieline({ id: mailer.id, name: mailer.name, family: mailer.family, paths, params: p,
      panels: { baseL, baseW, wallHeight: wall, lid: `${baseL} x ${baseW}`, tuckFlap: tuck, cornerTab: tab },
      notes: [`Base ${LEN(baseL)} x ${LEN(baseW)} score to score; walls ${LEN(wall)} to the cut edge.`,
              `Lid hinges from the back wall; ${LEN(tuck)} tuck flap closes at the front.`,
              'Glue-free: assembles by folding, so it ships flat and packs by hand.'] });
  },
};

/* ------------------------------------------------------------- PILLOW BOX */
export const pillow = {
  id: 'pillow', name: 'Pillow box', code: null, family: 'Wrap',
  // It closes by springing, which needs folding board.
  board: { caliper: 0.5, format: 'carton' },
  free: false, needs: ['L', 'H'],
  blurb: 'Curved-end pillow pack for gifts, jewellery and small retail. No end flaps - the arcs close it.',
  fields: { L: 'Panel width', W: 'Curve depth', H: 'Height' },
  // No fold model: a pillow box closes by bending its panels into a lens, not by
  // folding flat panels about straight hinges. A flat-panel approximation would
  // look convincing and be wrong, so the 3D view honestly reports it is n/a.
  fold: null,
  validate: (p) => {
    const sag = p.W > 0 ? p.W : p.L / 4;
    return sag >= p.H / 2 ? ['Curve depth must be less than half the height.'] : [];
  },
  build(p, ctx) {
    const { L, H, t, glue } = p;
    const sag = p.W > 0 ? p.W : L / 4;
    const pw = L + t;
    const x0 = 0, x1 = glue, x2 = x1 + pw, x3 = x2 + pw;
    const y0 = 0, y1 = H;
    const ch = Math.min(5, glue * 0.4, H * 0.1);
    // Concave arc across one panel: full height at the folds, dipping INWARD by
    // `sag` at the centre. `inward` is +1 for the top edge, -1 for the bottom.
    const dip = (xa, xb, yEdge, inward) => {
      const half = (xb - xa) / 2;
      const R = (half * half + sag * sag) / (2 * sag);
      const cy = yEdge + inward * (R - sag);
      const cx = (xa + xb) / 2;
      const a0 = Math.atan2(yEdge - cy, xa - cx), a1 = Math.atan2(yEdge - cy, xb - cx);
      return arcPts(cx, cy, R, a0, a1);
    };
    const o = [[x1, y0], [x0, y0 + ch], [x0, y1 - ch], [x1, y1]];
    o.push(...dip(x1, x2, y1, +1), ...dip(x2, x3, y1, +1));
    o.push([x3, y0]);
    o.push(...dip(x2, x3, y0, -1).reverse(), ...dip(x1, x2, y0, -1).reverse());
    const paths = [path(LAYER.CUT, o, true)];
    paths.push(line(LAYER.CREASE, x1, y0, x1, y1), line(LAYER.CREASE, x2, y0, x2, y1));
    paths.push(path(LAYER.GLUE, [[x0, y0 + ch], [x1, y0], [x1, y1], [x0, y1 - ch]], true));
    return makeDieline({ id: pillow.id, name: pillow.name, family: pillow.family, paths, params: p,
      panels: { panelWidth: pw, height: H, curveDepth: sag, glueTab: glue },
      notes: [`Curve depth ${lenOf(ctx)(sag)} (set via the Width field; defaults to panel width / 4).`,
              'No end flaps: the curved cut edges close the pack when the tube is flattened.'] });
  },
};
