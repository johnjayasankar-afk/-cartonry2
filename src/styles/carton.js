/**
 * Tuck-end folding cartons (thin board: cosmetics, food, retail).
 *   STE - Straight Tuck End : both tuck panels hinge from the SAME panel (back).
 *   RTE - Reverse Tuck End  : top tucks from the back, bottom from the front.
 * RTE nests more efficiently on the sheet; STE gives a cleaner front face
 * because both tuck seams fall at the back.
 *
 * Panel order across the blank: [glue] [Front L] [Side W] [Back L] [Side W]
 *   L = front panel width, W = depth, H = height. All INTERNAL.
 */
import { LAYER, makeDieline } from '../model.js';
import { path, line } from '../geom.js';
import { panel, hinge, rect } from '../fold.js';
import { lenOf } from './shared.js';

/** Single source of truth for the blank layout, shared by build() and fold(). */
function layout(p) {
  const { L, W, H, t, glue } = p;
  const pL = L + t, pW = W + t, bodyH = H + t;
  const tuckPanel = pW;
  const tuckFlap = p.tuck > 0 ? p.tuck : Math.max(8, Math.min(20, W * 0.55));
  const dustDepth = p.dustFlap > 0 ? p.dustFlap : Math.max(4, pW - 1.5);
  const g = { tuckPanel, tuckFlap, dustDepth, sideGap: Math.max(0.5, t),
              inset: t + 1, shoulder: Math.min(3, tuckFlap * 0.3) };
  const chamfer = Math.min(5, glue * 0.4, bodyH * 0.15);
  const x0 = 0, x1 = glue;
  const x2 = x1 + pL, x3 = x2 + pW, x4 = x3 + pL, x5 = x4 + pW;
  const spans = [[x1, x2], [x2, x3], [x3, x4], [x4, x5]];
  const depth = (k) => (k === 'tuck' ? tuckPanel + tuckFlap : k === 'dust' ? dustDepth : 0);
  return { pL, pW, bodyH, g, chamfer, x0, x1, x2, x3, x4, x5, spans, depth };
}

const TOP = ['flat', 'dust', 'tuck', 'dust'];
const BOT_STE = ['flat', 'dust', 'tuck', 'dust'];   // both tucks hinge from the back
const BOT_RTE = ['tuck', 'dust', 'flat', 'dust'];   // bottom tuck hinges from the front
const FACE = ['Front', 'Side', 'Back', 'Side'];

/**
 * Fold model. Signs follow the convention in styles/shared.js: vertical hinges
 * run +Y and wrap at +90; a closure ABOVE its hinge folds inward at -90, one
 * BELOW folds inward at +90.
 */
function foldCarton(p, reverse) {
  const Lay = layout(p);
  const { g, spans, x1, x2, x3, x4, x5 } = Lay;
  const bot = reverse ? BOT_RTE : BOT_STE;
  const y1 = Math.max(...bot.map(Lay.depth));
  const y2 = y1 + Lay.bodyH;

  const closure = (id, kind, a, b, yEdge, dir) => {
    // dir: +1 the closure sits above yEdge (folds in at -90), -1 below (+90).
    const inward = dir > 0 ? -90 : 90;
    const at = (d) => yEdge + dir * d;
    if (kind === 'dust') {
      const gp = g.sideGap;
      const poly = dir > 0 ? rect(a + gp, yEdge, b - gp, at(g.dustDepth))
                           : rect(a + gp, at(g.dustDepth), b - gp, yEdge);
      return hinge([a, yEdge], [b, yEdge], inward, panel(id, poly, { kind: 'flap', label: 'Dust flap' }));
    }
    const tp = g.tuckPanel, tf = g.tuckFlap, ins = g.inset;
    const tuckTip = panel(id + '-tip',
      dir > 0 ? rect(a + ins, at(tp), b - ins, at(tp + tf))
              : rect(a + ins, at(tp + tf), b - ins, at(tp)),
      { kind: 'flap', label: 'Tuck' });
    const tuckPanelNode = panel(id,
      dir > 0 ? rect(a, yEdge, b, at(tp)) : rect(a, at(tp), b, yEdge),
      { kind: 'flap', label: 'Tuck panel' });
    tuckPanelNode.children.push(hinge([a, at(tp)], [b, at(tp)], inward, tuckTip));
    return hinge([a, yEdge], [b, yEdge], inward, tuckPanelNode);
  };

  const body = spans.map(([a, b], i) => {
    const n = panel('c' + i, rect(a, y1, b, y2), { label: FACE[i] });
    if (TOP[i] !== 'flat') n.children.push(closure('c' + i + '-t', TOP[i], a, b, y2, +1));
    if (bot[i] !== 'flat') n.children.push(closure('c' + i + '-b', bot[i], a, b, y1, -1));
    return n;
  });
  body[2].children.push(hinge([x4, y1], [x4, y2], 90, body[3]));
  body[1].children.push(hinge([x3, y1], [x3, y2], 90, body[2]));
  body[0].children.push(hinge([x2, y1], [x2, y2], 90, body[1]));
  body[0].children.push(hinge([x1, y1], [x1, y2], -90,
    panel('glue', [[Lay.x0, y1 + Lay.chamfer], [x1, y1], [x1, y2], [Lay.x0, y2 - Lay.chamfer]],
      { kind: 'glue', label: 'Glue' })));
  return body[0];
}

/** Emit the top-edge profile for one panel, left to right, at height yTop. */
function feature(kind, xa, xb, yTop, dir, g) {
  const s = dir;                                  // +1 = upward (top), -1 = downward
  const y = (d) => yTop + s * d;
  if (kind === 'flat') return [[xa, yTop], [xb, yTop]];

  if (kind === 'dust') {
    const dd = g.dustDepth, gap = g.sideGap, ang = Math.min(dd * 0.35, (xb - xa - 2 * gap) * 0.2);
    return [[xa, yTop], [xa + gap, yTop], [xa + gap + ang, y(dd)],
            [xb - gap - ang, y(dd)], [xb - gap, yTop], [xb, yTop]];
  }
  // 'tuck' - tuck panel then a narrower tuck flap with angled shoulders
  const { tuckPanel: tp, tuckFlap: tf, inset: ins, shoulder: sh } = g;
  return [[xa, yTop], [xa, y(tp)],
          [xa + ins, y(tp + sh)], [xa + ins, y(tp + tf)],
          [xb - ins, y(tp + tf)], [xb - ins, y(tp + sh)],
          [xb, y(tp)], [xb, yTop]];
}

function buildCarton(p, reverse, meta, ctx) {
  const LEN = lenOf(ctx);
  const { L, W, H, t, glue } = p;
  const Lay = layout(p);
  const { pL, pW, bodyH, g, chamfer, x0, x1, x2, x3, x4, x5, spans, depth } = Lay;
  const { tuckPanel, tuckFlap, dustDepth } = g;
  const top = TOP;
  const bot = reverse ? BOT_RTE : BOT_STE;
  const topMax = Math.max(...top.map(depth));
  const botMax = Math.max(...bot.map(depth));
  const y1 = botMax, y2 = y1 + bodyH;

  // ---- CUT OUTLINE ----
  const o = [[x1, y1], [x0, y1 + chamfer], [x0, y2 - chamfer], [x1, y2]];
  spans.forEach(([a, b], i) => o.push(...feature(top[i], a, b, y2, +1, g)));
  o.push([x5, y2], [x5, y1]);
  for (let i = spans.length - 1; i >= 0; i--) {
    const [a, b] = spans[i];
    o.push(...feature(bot[i], a, b, y1, -1, g).slice().reverse());
  }
  o.push([x1, y1]);

  // Drop consecutive duplicate points introduced by abutting features.
  const clean = o.filter((pt, i) => i === 0 || pt[0] !== o[i - 1][0] || pt[1] !== o[i - 1][1]);
  const paths = [path(LAYER.CUT, clean, true)];

  // ---- CREASES ----
  for (const x of [x1, x2, x3, x4]) paths.push(line(LAYER.CREASE, x, y1, x, y2));
  spans.forEach(([a, b], i) => {
    if (top[i] !== 'flat') paths.push(line(LAYER.CREASE, a, y2, b, y2));
    if (bot[i] !== 'flat') paths.push(line(LAYER.CREASE, a, y1, b, y1));
    if (top[i] === 'tuck') paths.push(line(LAYER.CREASE, a, y2 + tuckPanel, b, y2 + tuckPanel));
    if (bot[i] === 'tuck') paths.push(line(LAYER.CREASE, a, y1 - tuckPanel, b, y1 - tuckPanel));
  });
  paths.push(path(LAYER.GLUE, [[x0, y1 + chamfer], [x1, y1], [x1, y2], [x0, y2 - chamfer]], true));

  return makeDieline({
    id: meta.id, name: meta.name, code: meta.code, family: 'Folding carton',
    paths, params: p,
    panels: { panelL: pL, panelW: pW, bodyH, tuckPanel, tuckFlap, dustDepth, glueTab: glue },
    notes: [
      `Tuck panel ${LEN(tuckPanel)} (spans the opening) + ${LEN(tuckFlap)} tuck flap.`,
      `Dust flaps ${LEN(dustDepth)} with angled leading corners.`,
      reverse ? 'Reverse tuck: top hinges from the back, bottom from the front - nests tighter on the sheet.'
              : 'Straight tuck: both tucks hinge from the back, leaving a clean front face.',
    ],
  });
}

export const ste = {
  id: 'carton-ste', name: 'Straight Tuck End carton (STE)', code: null,
  family: 'Folding carton',
  // 350 micron folding board; a tuck needs to spring.
  board: { caliper: 0.35, format: 'carton' }, free: false, needs: ['L', 'W', 'H'],
  blurb: 'Retail folding carton. Both tucks hinge from the back panel for a clean front face.',
  warn: (p) => (p.t > 1
    ? [`Tuck-end cartons are a folding-board format. At ${p.t} mm the tuck will not slip inside `
       + 'the front panel cleanly. Corrugated of this weight wants a slotted case instead.']
    : []),
  fold: (p) => foldCarton(p, false),
  build: (p, ctx) => buildCarton(p, false, { id: 'carton-ste', name: 'Straight Tuck End carton (STE)', code: null }, ctx),
};

export const rte = {
  id: 'carton-rte', name: 'Reverse Tuck End carton (RTE)', code: null,
  family: 'Folding carton',
  // 350 micron folding board; a tuck needs to spring.
  board: { caliper: 0.35, format: 'carton' }, free: false, needs: ['L', 'W', 'H'],
  blurb: 'Retail folding carton. Tucks hinge from opposite panels, nesting tighter on the sheet.',
  warn: (p) => (p.t > 1
    ? [`Tuck-end cartons are a folding-board format. At ${p.t} mm the tuck will not slip inside `
       + 'the front panel cleanly. Corrugated of this weight wants a slotted case instead.']
    : []),
  fold: (p) => foldCarton(p, true),
  build: (p, ctx) => buildCarton(p, true, { id: 'carton-rte', name: 'Reverse Tuck End carton (RTE)', code: null }, ctx),
};
