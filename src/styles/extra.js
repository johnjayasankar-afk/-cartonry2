/**
 * Telescope lid and hexagonal box.
 *
 * Both use `foldAllowance`, the generalised form of the "add one caliper" rule:
 * a fold through `turn` degrees moves the inner face in by (t/2)*tan(turn/2).
 * A square box turns 90 deg at each corner and so gains a full caliper across a
 * panel; a hexagon turns only 60 deg and needs 0.577 of one.
 */
import { LAYER, makeDieline, foldAllowance } from '../model.js';
import { path, line } from '../geom.js';
import { panel, hinge, rect } from '../fold.js';
import { lenOf } from './shared.js';

/* ---------------------------------------------------------- TELESCOPE LID */
/**
 * A lid that telescopes over a box of the stated INTERNAL size. The user gives
 * the dimensions of the box being covered; the lid is computed from them, which
 * is the part people get wrong by hand - the lid must clear the box's OUTSIDE,
 * so it needs two board calipers plus a working clearance on each axis.
 */
const lidLayout = (p) => {
  const clear = p.flapGap > 0 ? p.flapGap : 0.8;        // working clearance, per side
  const innerL = p.L + 2 * p.t + 2 * clear;             // must clear the base's outside
  const innerW = p.W + 2 * p.t + 2 * clear;
  const baseL = innerL + foldAllowance(p.t) * 2;
  const baseW = innerW + foldAllowance(p.t) * 2;
  const wall = p.H + foldAllowance(p.t);                // one fold, one cut edge
  const g = Math.max(0.5, p.t);
  return { clear, innerL, innerW, baseL, baseW, wall, g,
           tab: Math.max(4, wall - Math.max(1.5, p.t)),
           xa: wall, xb: wall + baseL, ya: wall, yb: wall + baseW,
           right: 2 * wall + baseL, top: 2 * wall + baseW };
};

export const lid = {
  id: 'telescope-lid', name: 'Telescope lid', code: null, family: 'Tray',
  // E-flute, to slip over its base without forcing.
  board: { caliper: 1.5, format: 'corrugated' },
  free: false, needs: ['L', 'W', 'H'],
  blurb: 'A lid sized to slide over a box you already have. Enter the box it must cover, not the lid.',
  fields: { L: 'Box length', W: 'Box width', H: 'Lid depth' },
  validate: (p) => (p.H > Math.min(p.L, p.W) / 2
    ? ['Lid depth is more than half the box; the corner tabs will overlap.'] : []),
  fold(p) {
    const { wall, g, tab, xa, xb, ya, yb, right, top } = lidLayout(p);
    const base = panel('base', rect(xa, ya, xb, yb), { label: 'Top' });
    const tabs = (yEdge, dir) => {
      const lo = Math.min(yEdge, yEdge + dir * (wall - g));
      const hi = Math.max(yEdge, yEdge + dir * (wall - g));
      return [
        hinge([xa, lo], [xa, hi], 90, panel('lt' + dir, rect(xa - tab, lo, xa, hi), { kind: 'flap', label: 'Tab' })),
        hinge([xb, lo], [xb, hi], -90, panel('rt' + dir, rect(xb, lo, xb + tab, hi), { kind: 'flap', label: 'Tab' })),
      ];
    };
    base.children.push(
      hinge([xa, ya], [xa, yb], 90, panel('wL', rect(0, ya, xa, yb), { label: 'Side' })),
      hinge([xb, ya], [xb, yb], -90, panel('wR', rect(xb, ya, right, yb), { label: 'Side' })),
      hinge([xa, ya], [xb, ya], -90, panel('wF', rect(xa, 0, xb, ya), { label: 'Edge', children: tabs(ya, -1) })),
      hinge([xa, yb], [xb, yb], 90, panel('wB', rect(xa, yb, xb, top), { label: 'Edge', children: tabs(yb, +1) })),
    );
    return base;
  },
  build(p, ctx) {
    const LEN = lenOf(ctx);
    const { clear, innerL, innerW, baseL, baseW, wall, g, tab, xa, xb, ya, yb, right, top } = lidLayout(p);
    const o = [
      [xa, 0], [xa - tab, 0], [xa - tab, wall - g], [xa, wall - g],
      [xa, ya], [0, ya], [0, yb], [xa, yb],
      [xa, yb + g], [xa - tab, yb + g], [xa - tab, top], [xa, top],
      [xb, top], [xb + tab, top], [xb + tab, yb + g], [xb, yb + g],
      [xb, yb], [right, yb], [right, ya], [xb, ya],
      [xb, wall - g], [xb + tab, wall - g], [xb + tab, 0], [xb, 0],
    ];
    const paths = [path(LAYER.CUT, o, true)];
    paths.push(line(LAYER.CREASE, xa, ya, xb, ya), line(LAYER.CREASE, xa, yb, xb, yb));
    paths.push(line(LAYER.CREASE, xa, ya, xa, yb), line(LAYER.CREASE, xb, ya, xb, yb));
    paths.push(line(LAYER.CREASE, xa, 0, xa, wall - g), line(LAYER.CREASE, xb, 0, xb, wall - g));
    paths.push(line(LAYER.CREASE, xa, yb + g, xa, top), line(LAYER.CREASE, xb, yb + g, xb, top));
    return makeDieline({ id: lid.id, name: lid.name, family: lid.family, paths, params: p,
      panels: { covers: `${p.L} x ${p.W}`, lidInternal: `${round(innerL)} x ${round(innerW)}`,
                wallHeight: round(wall), clearance: clear, cornerTab: round(tab) },
      notes: [`Sized to cover a ${LEN(p.L)} x ${LEN(p.W)} box: lid inside is ${LEN(innerL)} x ${LEN(innerW)}.`,
              `That is your box plus two ${p.t} mm board thicknesses plus ${LEN(clear)} clearance each side.`,
              `Set the clearance with the flap relief gap field; ${LEN(0.8)} is a comfortable slip fit.`] });
  },
};
const round = (v) => Math.round(v * 100) / 100;

/* ------------------------------------------------------------- HEXAGONAL */
const hexLayout = (p) => {
  const side = p.L / Math.sqrt(3);                 // L is across the flats
  const allow = foldAllowance(p.t, 60) * 2;        // 60 deg turn at each of two ends
  const pw = side + allow;
  const bodyH = p.H + p.t;                         // flaps top and bottom
  const flap = side * 0.86;                        // reaches past the centre without colliding
  return { side, pw, bodyH, flap, x1: p.glue, y1: 0, y2: bodyH };
};

export const hexagon = {
  id: 'hexagon', name: 'Hexagonal box', code: null, family: 'Tray',
  // 500 micron holds a six-sided tube square.
  board: { caliper: 0.5, format: 'carton' },
  free: false, needs: ['L', 'H'],
  blurb: 'Six-sided box for candles, gifts and cosmetics. Length is measured across the flats.',
  fields: { L: 'Across flats', W: null, H: 'Height' },
  validate: (p) => (p.H <= 0 ? ['Height must be greater than zero.'] : []),
  fold(p) {
    const { pw, bodyH, flap, x1 } = hexLayout(p);
    const y1 = flap, y2 = y1 + bodyH;
    const mk = (i) => {
      const a = x1 + i * pw, b = a + pw;
      // Numbered, not five blanks and a "Face". Six identical labels would be
      // clutter, but six ANONYMOUS faces are worse: artwork is placed per face,
      // and the inspector lets you point at one, which needs it to have a name.
      const n = panel('h' + i, rect(a, y1, b, y2), { label: `Face ${i + 1}` });
      n.children.push(hinge([a, y1], [b, y1], 90,
        panel('h' + i + 'f', rect(a, y1 - flap, b, y1), { kind: 'flap', label: 'Flap' })));
      return n;
    };
    const nodes = [0, 1, 2, 3, 4, 5].map(mk);
    for (let i = 4; i >= 0; i--) {
      const x = x1 + (i + 1) * pw;
      nodes[i].children.push(hinge([x, y1], [x, y2], 60, nodes[i + 1]));
    }
    nodes[0].children.push(hinge([x1, y1], [x1, y2], -60,
      panel('glue', rect(0, y1, x1, y2), { kind: 'glue', label: 'Glue' })));
    return nodes[0];
  },
  build(p, ctx) {
    const LEN = lenOf(ctx);
    const { side, pw, bodyH, flap, x1 } = hexLayout(p);
    const y0 = 0, y1 = flap, y2 = y1 + bodyH;
    const xs = [0, 1, 2, 3, 4, 5, 6].map((i) => x1 + i * pw);
    const ch = Math.min(5, p.glue * 0.4, bodyH * 0.15);
    const notch = Math.min(flap * 0.28, pw * 0.18);

    const o = [[x1, y1], [0, y1 + ch], [0, y2 - ch], [x1, y2], [xs[6], y2], [xs[6], y1]];
    // Bottom flaps, traced right to left, with relieved corners so they clear.
    for (let i = 5; i >= 0; i--) {
      o.push([xs[i + 1], y1], [xs[i + 1] - notch, y0], [xs[i] + notch, y0], [xs[i], y1]);
    }
    const paths = [path(LAYER.CUT, o, true)];
    for (let i = 0; i <= 6; i++) paths.push(line(LAYER.CREASE, xs[i], y1, xs[i], y2));
    paths.push(line(LAYER.CREASE, x1, y1, xs[6], y1));
    paths.push(path(LAYER.GLUE, [[0, y1 + ch], [x1, y1], [x1, y2], [0, y2 - ch]], true));
    return makeDieline({ id: hexagon.id, name: hexagon.name, family: hexagon.family, paths, params: p,
      panels: { acrossFlats: p.L, sideLength: round(side), panelWidth: round(pw),
                bodyH: round(bodyH), flapDepth: round(flap) },
      notes: [`Across the flats ${LEN(p.L)}, so each of the six sides is ${LEN(side)}.`,
              `Panels are ${LEN(pw)} score to score - a 60 degree fold needs only `
              + `${round(foldAllowance(p.t, 60) * 2)} mm of allowance, not a full ${p.t} mm caliper.`,
              'Bottom flaps overlap; glue or tape them in sequence.'] });
  },
};
