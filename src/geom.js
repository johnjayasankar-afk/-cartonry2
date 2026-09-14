// Geometry primitives. All internal units are MILLIMETRES.
// Everything here is pure: no DOM, no I/O, so it is testable under Node.

export const MM_PER_INCH = 25.4;
export const PT_PER_MM = 72 / 25.4;          // PDF user-space points per mm

export const toMm = (v, unit) => (unit === 'in' ? v * MM_PER_INCH : v);

/**
 * Parse a length a person actually types. Accepts plain decimals and the mixed
 * fractions that anyone working in inches uses by habit:
 *   "12"  "12.5"  "12 1/2"  "12-1/2"  "1/2"  "  3 3/8 "
 * Returns NaN for anything it cannot read, so validation reports it rather than
 * quietly substituting a default.
 */
export function parseLength(input) {
  if (typeof input === 'number') return Number.isFinite(input) ? input : NaN;
  const s = String(input ?? '').trim().replace(/["″]/g, '');
  if (!s) return NaN;
  let m = /^(-?\d+(?:\.\d+)?)$/.exec(s);
  if (m) return parseFloat(m[1]);
  m = /^(-?\d+(?:\.\d+)?)\s*[-\s]\s*(\d+)\s*\/\s*(\d+)$/.exec(s);   // 12 1/2, 12-1/2
  if (m) {
    const den = +m[3];
    if (!den) return NaN;
    const whole = parseFloat(m[1]);
    return whole + Math.sign(whole || 1) * (+m[2] / den);
  }
  m = /^(-?\d+)\s*\/\s*(\d+)$/.exec(s);                                  // 1/2
  if (m) return +m[2] ? +m[1] / +m[2] : NaN;
  return NaN;
}
export const fromMm = (v, unit) => (unit === 'in' ? v / MM_PER_INCH : v);

/* ------------------------------------------------------------- display
 * One formatter, used everywhere a length is shown.
 *
 * These were scattered as local helpers, each with its own rounding, and the
 * ones written later simply printed millimetres. So the readout said 29.41"
 * while the panel below it said 747 mm, for the same edge of the same box.
 *
 * Precision differs by unit because the units differ in size: a tenth of a
 * millimetre is finer than any die-cutting tolerance, and a hundredth of an
 * inch is the closest equivalent. Trailing zeros are dropped, because "747 mm"
 * is what a person writes and "747.0 mm" is what a program writes.
 * -------------------------------------------------------------------- */
export const unitLabel = (unit) => (unit === 'in' ? '\u2033' : 'mm');

export function dim(mm, unit) {
  if (!Number.isFinite(mm)) return '—';
  const v = unit === 'in' ? mm / MM_PER_INCH : mm;
  const dp = unit === 'in' ? 2 : 1;
  return String(Math.round(v * 10 ** dp) / 10 ** dp);
}

/**
 * Re-express a displayed length in another unit without losing what was typed.
 *
 * The input boxes hold display text, and display text is rounded. Converting
 * out of that text and back does not return where it started: 150 mm displays
 * as 5.906 in, and 5.906 in is 150.012 mm. Pressing the unit toggle twice left
 * a box the reader never edited slightly larger, and it showed.
 *
 * `keptMm` is the millimetre value last written into that box. If the box still
 * displays that value, the conversion runs from the remembered number instead
 * of the rounded text, and the round trip is exact. A value since typed over
 * will not match, and is honoured as typed.
 *
 * @returns {{mm:number, text:string}} the canonical millimetres, and the text
 *          to display in the new unit.
 */
export function convertShown(shownText, from, to, keptMm, dp = 3) {
  const shown = parseLength(shownText);
  let mm = toMm(Number.isFinite(shown) ? shown : 0, from);
  if (Number.isFinite(keptMm) && Number.isFinite(shown)
      && Math.abs(fromMm(keptMm, from) - shown) < 5e-4) mm = keptMm;
  const k = 10 ** dp;
  return { mm, text: String(Math.round(fromMm(mm, to) * k) / k) };
}

/* Area follows the length unit, because the two are read together: a board
 * price per square metre is not something a person holding a tape marked in
 * inches can check. Grammage stays g/m2 wherever it appears - that is what
 * mills quote worldwide, US folding-carton mills included. */
export const FT2_PER_M2 = 10.763910416709722;
export const areaLabel = (unit) => (unit === 'in' ? 'ft\u00b2' : 'm\u00b2');
export const toArea = (m2, unit) => (unit === 'in' ? m2 * FT2_PER_M2 : m2);
export const fromArea = (v, unit) => (unit === 'in' ? v / FT2_PER_M2 : v);
/**
 * An area, with enough decimals to carry about three significant figures.
 *
 * A fixed three decimals is right for a shipping case at 0.189 m2 and useless
 * for a jewellery carton at 0.0039 - which is where the stored value used to
 * be rounded away entirely.
 */
export function area1(m2, unit, dp) {
  if (!Number.isFinite(m2)) return '—';
  const v = toArea(m2, unit);
  let d = dp;
  if (d == null) {
    const mag = v === 0 ? 0 : Math.floor(Math.log10(Math.abs(v)));
    d = Math.min(6, Math.max(0, 2 - mag));
  }
  return `${v.toFixed(d)} ${areaLabel(unit)}`;
}

/** Join lengths with a unit stated once - and never mark an em dash as inches. */
const joined = (vals, unit) => {
  const parts = vals.map((v) => dim(v, unit));
  if (parts.some((p) => p === '—')) return '—';
  return unit === 'in' ? `${parts.join(' \u00d7 ')}\u2033` : `${parts.join(' \u00d7 ')} mm`;
};

/** A single length with its unit: `747 mm` or `29.41″`. */
export const dim1 = (mm, unit) => joined([mm], unit);

/** A pair, with the unit stated once: `747 × 253 mm` or `29.41 × 9.96″`. */
export const dim2 = (a, b, unit) => joined([a, b], unit);

/** Three, for a box: `200 × 150 × 100 mm`. */
export const dim3 = (a, b, c, unit) => joined([a, b, c], unit);

/** Round to a sane manufacturing precision (0.001 mm) to kill FP noise. */
export const r3 = (n) => Math.round(n * 1000) / 1000;

/**
 * A text label: { layer, kind:'text', at:[x,y], value, size, anchor, rotate }.
 * Sizes are millimetres so labels scale with the drawing, matching how a
 * draughtsman would letter a dieline.
 */
export function label(layer, x, y, value, opts = {}) {
  return {
    layer, kind: 'text', at: [r3(x), r3(y)], value: String(value),
    size: opts.size ?? 3.5,
    anchor: opts.anchor ?? 'middle',      // start | middle | end
    rotate: opts.rotate ?? 0,             // degrees, counter-clockwise
    pts: [[r3(x), r3(y)]],                // so bbox/normalise treat it uniformly
  };
}

/** A path is { layer, closed, pts: [[x,y], ...] }. Coordinates in mm, Y up. */
export function path(layer, pts, closed = false) {
  return { layer, closed, pts: pts.map(([x, y]) => [r3(x), r3(y)]) };
}

export const line = (layer, x1, y1, x2, y2) => path(layer, [[x1, y1], [x2, y2]], false);

export function rect(layer, x, y, w, h, closed = true) {
  return path(layer, [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], closed);
}

/**
 * Arc as a tessellated polyline. Angles in radians, CCW from +X axis.
 * Tessellation is chosen so chord sag <= tol (default 0.05 mm), which is finer
 * than any die-cutting tolerance, and clamped to a sensible segment count.
 */
export function arcPts(cx, cy, radius, a0, a1, tol = 0.05) {
  if (radius <= 0) return [[cx, cy]];
  const sweep = Math.abs(a1 - a0);
  const maxStep = 2 * Math.acos(Math.max(-1, Math.min(1, 1 - tol / radius)));
  const n = Math.max(2, Math.ceil(sweep / (maxStep || sweep)));
  const out = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + (a1 - a0) * (i / n);
    out.push([cx + radius * Math.cos(a), cy + radius * Math.sin(a)]);
  }
  return out;
}

/**
 * Bounding box over a list of paths.
 * Text carries only its anchor point, so its drawn extent is estimated here -
 * otherwise a dimension label sits outside the page and gets clipped.
 * 0.62 em average advance is a safe over-estimate for Helvetica.
 */
export function bboxOf(paths) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const grow = (x, y) => {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  };
  for (const p of paths) {
    if (p.kind === 'text') {
      const w = p.value.length * p.size * 0.62, h = p.size;
      const [x, y] = p.at;
      const dx = p.anchor === 'middle' ? w / 2 : p.anchor === 'end' ? w : 0;
      const dx2 = p.anchor === 'middle' ? w / 2 : p.anchor === 'end' ? 0 : w;
      if (Math.abs(p.rotate % 180) === 90) {          // rotated text swaps extents
        grow(x - h * 0.35, y - dx); grow(x + h, y + dx2);
      } else {
        grow(x - dx, y - h * 0.35); grow(x + dx2, y + h);
      }
      continue;
    }
    for (const [x, y] of p.pts) grow(x, y);
  }
  if (!isFinite(minX)) return { minX: 0, minY: 0, maxX: 0, maxY: 0, w: 0, h: 0 };
  return { minX: r3(minX), minY: r3(minY), maxX: r3(maxX), maxY: r3(maxY),
           w: r3(maxX - minX), h: r3(maxY - minY) };
}

/**
 * Translate every path so the drawing sits with its min corner at (margin, margin).
 * Text nodes carry an `at` anchor as well as `pts`, and both must move together -
 * annotations sit outside the blank in negative space until this runs, and the
 * exporters all assume a drawing that starts at the origin.
 */
export function normalise(paths, margin = 0) {
  const b = bboxOf(paths);
  const dx = margin - b.minX, dy = margin - b.minY;
  if (Math.abs(dx) < 1e-9 && Math.abs(dy) < 1e-9) return paths;
  return paths.map((p) => {
    const moved = { ...p, pts: p.pts.map(([x, y]) => [r3(x + dx), r3(y + dy)]) };
    if (p.kind === 'text') moved.at = [r3(p.at[0] + dx), r3(p.at[1] + dy)];
    return moved;
  });
}

/** Signed area of a closed polygon (shoelace). Positive = counter-clockwise. */
export function signedArea(pts) {
  let a = 0;
  for (let i = 0, n = pts.length; i < n; i++) {
    const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % n];
    a += x1 * y2 - x2 * y1;
  }
  return a / 2;
}

/** Total length of a path, treating `closed` paths as returning to the start. */
export function pathLength(p) {
  let L = 0;
  const pts = p.closed ? [...p.pts, p.pts[0]] : p.pts;
  for (let i = 1; i < pts.length; i++) {
    L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  }
  return L;
}
