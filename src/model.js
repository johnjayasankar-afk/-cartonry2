// The Dieline model and the shared parameter vocabulary.

import { bboxOf, normalise, r3 } from './geom.js';

/** Layer names follow common prepress dieline convention. */
export const LAYER = {
  CUT: 'cut',        // knife  - solid
  CREASE: 'crease',  // score  - dashed
  GUIDE: 'guide',    // artwork safe-area guide
  GLUE: 'glue',      // glue/adhesive area indicator
  DIM: 'dim',        // dimension annotation (never exported to DXF cut layers)
};

/**
 * Build a finished dieline.
 * @param {object} spec - { id, name, code, paths, params, notes, panels }
 */
export function makeDieline(spec) {
  const paths = normalise(spec.paths, spec.margin ?? 0);
  const bbox = bboxOf(paths);
  return {
    id: spec.id,
    name: spec.name,
    code: spec.code ?? null,
    family: spec.family ?? null,
    paths,
    bbox,
    params: spec.params,
    panels: spec.panels ?? {},
    notes: spec.notes ?? [],
    /** Sheet area of the enclosing blank rectangle, in m^2 (board estimating). */
    // Full precision, deliberately. Rounding this to three decimals of a
    // square metre quantises it to 1000 mm2, and a jewellery carton's blank is
    // 3900 mm2 - so its board area, its weight and its cost were all wrong by
    // up to 17%, and a blank under 500 mm2 reported zero of all three.
    // Display rounds; the model does not.
    blankAreaM2: (bbox.w * bbox.h) / 1e6,
  };
}

/**
 * Shared, validated parameters for every style.
 * All dimensions arrive in mm. L/W/H are INTERNAL box dimensions.
 */
export function normaliseParams(p = {}) {
  // An OMITTED value takes the default. A value that is PRESENT but not a
  // number becomes NaN so validation rejects it - silently substituting a
  // default would hand the user a box that is not the size they typed.
  const num = (v, d) => {
    if (v === undefined || v === null || v === '') return d;
    const n = +v;
    return Number.isFinite(n) ? n : NaN;
  };
  const out = {
    L: num(p.L, 200),           // internal length
    W: num(p.W, 150),           // internal width
    H: num(p.H, 100),           // internal height / depth
    t: num(p.t, 3),             // board caliper (thickness)
    glue: num(p.glue, undefined),   // resolved below once L/W/t are known
    slot: p.slot === undefined || p.slot === null || p.slot === ''
            ? num(p.t, 3) : num(p.slot, 3),      // slot width, defaults to caliper
    flapGap: num(p.flapGap, 0), // gap between meeting flaps
    tuck: num(p.tuck, 0),       // tuck flap depth (0 = auto)
    bleed: num(p.bleed, 3),     // artwork bleed
    dustFlap: num(p.dustFlap, 0), // 0 = auto
  };
  if (out.glue === undefined) out.glue = defaultGlueFlap(out);
  return out;
}

/**
 * A sensible manufacturer's joint.
 *
 * These are different trades with different numbers. A corrugated case is
 * joined with a 30-40 mm flap; a folding carton uses 6-12 mm, because the flap
 * laps onto a panel that may only be a few centimetres wide. Defaulting to the
 * corrugated figure put a 35 mm flap on a 40 mm carton panel - buildable in the
 * maths, absurd on a press.
 *
 * The result is also capped at 45% of the panel it laps onto, so it can never
 * overrun the next crease however small the box is.
 */
export function defaultGlueFlap(p) {
  const laps = Math.min(p.L, p.W);
  const base = p.t <= 1 ? 10 : 35;                 // folding board vs corrugated
  if (!Number.isFinite(laps) || laps <= 0) return base;
  return Math.round(Math.min(base, laps * 0.45) * 100) / 100;
}

/** Validation shared by all styles. Returns an array of human-readable errors. */
export function validateParams(p, style) {
  const errs = [];
  const need = style?.needs ?? ['L', 'W', 'H'];
  // Catch unparseable input first so the user is told what they typed is not a
  // number, rather than getting a confusing downstream geometry complaint.
  // `slot` derives from `t`, so a bad caliper would otherwise raise two errors
  // for one mistake - report only the field the user actually got wrong.
  const nan = Object.entries(p).filter(([, v]) => Number.isNaN(v)).map(([k]) => k);
  const derived = Number.isNaN(p.t) ? new Set(['slot']) : new Set();
  for (const k of nan) if (!derived.has(k)) errs.push(`${DIM_LABEL[k] ?? k} must be a number.`);
  if (errs.length) return errs;
  for (const k of need) {
    if (!(p[k] > 0)) errs.push(`${DIM_LABEL[k] ?? k} must be greater than zero.`);
    if (p[k] > 3000) errs.push(`${DIM_LABEL[k] ?? k} looks too large (max 3000 mm).`);
  }
  if (!(p.t >= 0)) errs.push('Board thickness cannot be negative.');
  if (p.t > 15) errs.push('Board thickness above 15 mm is outside the supported range.');
  if (p.glue < 0) errs.push('Glue flap cannot be negative.');
  if (style?.validate) errs.push(...(style.validate(p) || []));
  return errs;
}

/**
 * Board allowance for one fold.
 *
 * Board of caliper t is centred on the mid-surface we model. Folding through
 * `turn` degrees moves the inner face inward by (t/2)*tan(turn/2) at that
 * corner. A panel bounded by two folds therefore needs its score spacing set to
 * internal + the sum of both allowances.
 *
 *   90 deg  -> (t/2)*tan(45) = t/2 per fold, so t across a panel: the familiar
 *              "add one caliper" rule for square boxes.
 *   60 deg  -> (t/2)*tan(30) = 0.289t per fold, so 0.577t across a panel, which
 *              is why a hexagon needs a smaller allowance than a square box.
 */
export const foldAllowance = (t, turn = 90) => (t / 2) * Math.tan((turn * Math.PI) / 360);

/**
 * Internal box size for a product plus clearance.
 * Clearance is per SIDE, so each axis gains twice it - the mistake people make
 * doing this in their head is adding it once.
 */
export function internalForProduct(product, clearancePerSide) {
  const c = Math.max(0, clearancePerSide || 0);
  return product.map((v) => Math.round((v + 2 * c) * 100) / 100);
}

/**
 * Non-blocking cautions.
 *
 * Validation refuses geometry that cannot exist. These are different: the box
 * is buildable, but a person who does this for a living would raise an eyebrow.
 * A tool that silently produces a technically-valid dieline nobody can run is
 * not being helpful, so say so - and never block on it, because the user may
 * know something we do not.
 */
export function warnings(p, style, dl, ctx) {
  const out = [];
  // Cautions are prose, so they follow the reader's unit like the notes do.
  // Board caliper stays metric wherever it appears; the sheet limits below are
  // a physical property of what converters stock, not of the box.
  const LEN = (ctx && ctx.len) || ((mm) => `${Math.round(mm * 10) / 10} mm`);
  const LEN2 = (ctx && ctx.len2) || ((a, b) => `${Math.round(a)} x ${Math.round(b)} mm`);
  const dims = ['L', 'W', 'H'].filter((k) => (style.fields || {})[k] !== null).map((k) => p[k]);
  const min = Math.min(...dims), max = Math.max(...dims);

  // Rule of thumb: below about twelve calipers a crease starts to fight the
  // board rather than fold it, and the corners will not pull square.
  if (p.t > 0 && min < p.t * 12) {
    out.push(`${p.t} mm board is thick for a box this small (shortest side ${LEN(min)}). `
      + 'Creases may crack and the corners will not pull square. Consider a thinner grade.');
  }
  if (max > 400 && p.t > 0 && p.t < 1.5) {
    out.push(`A box ${LEN(max)} across on ${p.t} mm board will be flimsy. `
      + 'Anything at this size is normally single-wall corrugated or heavier.');
  }
  if (min > 0 && max / min > 10) {
    out.push(`These proportions are extreme (${Math.round(max / min)}:1). Check the dimensions `
      + 'are the ones you meant, and in the right fields.');
  }
  // A glue flap laps onto the panel next to it, which is a length or width
  // panel - never the height. Measuring it against the height warned on
  // perfectly ordinary shallow boxes.
  const lapsOnto = Math.min(p.L, p.W);
  if (dl && dl.panels && dl.panels.glueTab > 0 && dl.panels.glueTab > lapsOnto / 2) {
    out.push(`The ${LEN(dl.panels.glueTab)} glue flap is more than half the ${LEN(lapsOnto)} panel it `
      + 'laps onto, so it will overlap past the next crease. Reduce it in the advanced panel.');
  }
  if (dl) {
    // 2500 x 1600 mm is the largest sheet in the presets; past that a converter
    // is into special stock or a reel, and the blank needs rethinking.
    const bw = Math.max(dl.bbox.w, dl.bbox.h), bh = Math.min(dl.bbox.w, dl.bbox.h);
    if (bw > 2500 || bh > 1600) {
      // 2500 x 1600 mm is a real stock size, so it is named as one - but in the
      // reader's own unit, or the sentence compares inches against millimetres.
      out.push(`The blank is ${LEN2(dl.bbox.w, dl.bbox.h)}, larger than the biggest sheet most `
        + `converters stock (${LEN2(2500, 1600)}). Few will run this without special stock.`);
    }
  }
  if (style.warn) out.push(...(style.warn(p, dl, { len: LEN, len2: LEN2 }) || []));
  return out;
}

export const DIM_LABEL = {
  L: 'Length', W: 'Width', H: 'Height', t: 'Board thickness',
  glue: 'Glue flap', slot: 'Slot width', tuck: 'Tuck depth',
};
