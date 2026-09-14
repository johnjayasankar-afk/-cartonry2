// ---------------------------------------------------------------------------
// Fold engine.
//
// A dieline is a net: flat panels joined by hinges. Given a fold model (a tree
// of panels, each attached to its parent by a hinge line and a fold angle) this
// folds the net in 3D and reports where every panel ends up.
//
// This is not decoration. Folding the net and measuring the resulting box is an
// INDEPENDENT check on the 2D geometry: if the panel maths is wrong, the folded
// box comes out the wrong size. See test/fold.test.js.
//
// Panels are modelled as zero-thickness surfaces sitting on the mid-surface of
// the board. Real board of caliper t is centred on that surface, so the internal
// cavity is the folded mid-surface box less one caliper in each axis.
// ---------------------------------------------------------------------------

/* ------------------------------------------------------------ 4x4 matrices */
export const ident = () => [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];

export function mul(a, b) {
  const o = new Array(16);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
    o[r * 4 + c] = a[r * 4] * b[c] + a[r * 4 + 1] * b[4 + c]
                 + a[r * 4 + 2] * b[8 + c] + a[r * 4 + 3] * b[12 + c];
  }
  return o;
}

export function xf(m, p) {
  const [x, y, z] = p;
  return [
    m[0] * x + m[1] * y + m[2] * z + m[3],
    m[4] * x + m[5] * y + m[6] * z + m[7],
    m[8] * x + m[9] * y + m[10] * z + m[11],
  ];
}

const translate = (x, y, z) => [1,0,0,x, 0,1,0,y, 0,0,1,z, 0,0,0,1];

/** Rotation of `deg` degrees about a unit axis, right-hand rule (Rodrigues). */
function rotAxis(ax, ay, az, deg) {
  const t = (deg * Math.PI) / 180, c = Math.cos(t), s = Math.sin(t), k = 1 - c;
  return [
    c + ax*ax*k,      ax*ay*k - az*s,  ax*az*k + ay*s, 0,
    ay*ax*k + az*s,   c + ay*ay*k,     ay*az*k - ax*s, 0,
    az*ax*k - ay*s,   az*ay*k + ax*s,  c + az*az*k,    0,
    0, 0, 0, 1,
  ];
}

/**
 * Rotation about the line through flat points a and b (both z = 0).
 * The hinge direction a->b sets the sign by the right-hand rule, so reversing
 * a hinge's endpoints folds the panel the other way.
 */
export function rotAboutHinge(a, b, deg) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const L = Math.hypot(dx, dy) || 1;
  return mul(translate(a[0], a[1], 0),
         mul(rotAxis(dx / L, dy / L, 0, deg),
             translate(-a[0], -a[1], 0)));
}

/* ------------------------------------------------------------- net folding */
/**
 * @param {object} root  { id, label, kind, poly:[[x,y]..], children:[{hinge:[a,b], angle, node}] }
 * @param {number} t     fold progress, 0 = flat, 1 = fully folded
 * @returns {Array}      [{ id, label, kind, pts:[[x,y,z]..] }]
 */
export function foldNet(root, t = 1) {
  const out = [];
  (function walk(node, T) {
    out.push({
      id: node.id, label: node.label || '', kind: node.kind || 'panel',
      pts: node.poly.map(([x, y]) => xf(T, [x, y, 0])),
    });
    for (const c of node.children || []) {
      walk(c.node, mul(T, rotAboutHinge(c.hinge[0], c.hinge[1], c.angle * t)));
    }
  })(root, ident());
  return out;
}

/** Axis-aligned bounds of a folded net, in mid-surface millimetres. */
export function foldedBounds(root, t = 1) {
  const faces = foldNet(root, t);
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const f of faces) for (const p of f.pts) for (let i = 0; i < 3; i++) {
    if (p[i] < lo[i]) lo[i] = p[i];
    if (p[i] > hi[i]) hi[i] = p[i];
  }
  const size = [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]].map((v) => Math.round(v * 1000) / 1000);
  return { lo, hi, size };
}

/**
 * The internal cavity of the assembled box, sorted largest-first so it can be
 * compared with the requested L/W/H without caring which axis ended up where.
 * Mid-surface bounds less one caliper per axis.
 */
export function internalSize(root, caliper) {
  return foldedBounds(root, 1).size
    .map((v) => Math.round((v - caliper) * 1000) / 1000)
    .sort((a, b) => b - a);
}

/* ------------------------------------------------- fold-model construction */
export const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];

/** A panel node. */
export const panel = (id, poly, opts = {}) =>
  ({ id, poly, label: opts.label || '', kind: opts.kind || 'panel', children: opts.children || [] });

/** Attach `node` to its parent along a hinge, folding by `angle` degrees. */
export const hinge = (a, b, angle, node) => ({ hinge: [a, b], angle, node });

/**
 * The OUTSIDE of the assembled box, measured rather than assumed.
 *
 * Panels are modelled on the board's mid-surface, so the outer face of each
 * one lies half a caliper along its own normal. Offsetting every panel that
 * way and taking the bounds gives the true envelope of board in space.
 *
 * The obvious shortcut - take the mid-surface bounds and add one caliper per
 * axis - is right for a closed box and wrong for an open one. A tray's wall is
 * folded at the bottom and CUT at the top: there is board half a caliper below
 * the base's mid-plane, and nothing at all above the wall's top edge. The
 * shortcut would make every tray and every open case half a caliper too tall,
 * which is the same class of error the half-caliper rule was written to fix.
 *
 * @param {object} root     fold-model root
 * @param {number} caliper  board thickness in mm
 */
export function outerBounds(root, caliper) {
  const faces = foldNet(root, 1);
  const half = (caliper || 0) / 2;
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const f of faces) {
    // Newell's normal: stable for panels that are not perfectly planar.
    const p = f.pts; const n = [0, 0, 0];
    for (let i = 0; i < p.length; i++) {
      const a = p[i], b = p[(i + 1) % p.length];
      n[0] += (a[1] - b[1]) * (a[2] + b[2]);
      n[1] += (a[2] - b[2]) * (a[0] + b[0]);
      n[2] += (a[0] - b[0]) * (a[1] + b[1]);
    }
    const len = Math.hypot(n[0], n[1], n[2]) || 1;
    const u = [n[0] / len, n[1] / len, n[2] / len];
    // Both faces of the board: the panel is a slab, not a surface.
    for (const q of p) for (const s of [-half, half]) {
      for (let i = 0; i < 3; i++) {
        const v = q[i] + u[i] * s;
        if (v < lo[i]) lo[i] = v;
        if (v > hi[i]) hi[i] = v;
      }
    }
  }
  const size = [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]]
    .map((v) => Math.round(v * 1000) / 1000);
  return { lo, hi, size };
}

/**
 * The assembled box's outside dimensions, largest first.
 *
 * Sorted, because the fold model's axes do not correspond to the L/W/H the
 * reader typed, and because sorted is the form the question is actually asked
 * in: a carrier's limit is on the longest side, and girth is computed from the
 * two shorter ones.
 */
export function externalSize(root, caliper) {
  return outerBounds(root, caliper).size.sort((a, b) => b - a);
}

/**
 * The outside dimensions, given in the SAME ORDER as the inside dimensions the
 * reader is looking at.
 *
 * externalSize() sorts, which is right for a carrier's longest-side rule and
 * wrong next to a list of the reader's own L/W/H: a tuck carton showed
 * "inside 80 x 40 x 150" beside "outside 150.7 x 80.7 x 40.7", which reads as
 * though the box changed shape between the two rows.
 *
 * The pairing is exact rather than a guess. Both measurements are taken in the
 * same world frame, so each requested dimension is matched to the axis whose
 * INTERNAL measurement it equals, and the outside is read from that same axis.
 * Ties are harmless: if two axes measure the same inside they measure the same
 * outside.
 *
 * @param {object} root     fold-model root
 * @param {number} caliper  board thickness in mm
 * @param {number[]} wanted the internal dimensions being displayed, in order
 * @returns {number[]} one outside dimension per `wanted` entry
 */
export function externalFor(root, caliper, wanted) {
  const inner = foldedBounds(root, 1).size.map((v) => v - caliper);   // per world axis
  const outer = outerBounds(root, caliper).size;                      // same frame
  const taken = [false, false, false];
  return wanted.map((w) => {
    let best = -1, err = Infinity;
    for (let i = 0; i < 3; i++) {
      if (taken[i]) continue;
      const e = Math.abs(inner[i] - w);
      if (e < err) { err = e; best = i; }
    }
    if (best < 0) return NaN;
    taken[best] = true;
    return Math.round(outer[best] * 1000) / 1000;
  });
}
