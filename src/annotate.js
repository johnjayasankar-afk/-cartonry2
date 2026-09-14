// ---------------------------------------------------------------------------
// Annotation layer: dimensions, panel labels and artwork safe-area guides.
//
// A dieline that only carries cut and crease lines is hard to work with. A
// draughtsman would letter the panels and dimension the blank; this does the
// same, and the annotations ride on their own layers so they can be turned off
// or ignored by a die maker.
//
// Panel names and outlines are taken from the FOLD model, so the labels can
// never disagree with the 3D preview - both read from one description of what
// each panel is.
// ---------------------------------------------------------------------------
import { LAYER } from './model.js';
import { path, line, label, bboxOf, normalise, r3 } from './geom.js';
import { foldNet } from './fold.js';

const TICK = 1.6;      // mm, architectural slash tick
const GAP = 2;         // mm, gap between the blank and its extension line
const OFF = 9;         // mm, distance from the blank to the dimension line

/** One linear dimension with extension lines, slash ticks and a value. */
function dimension(x1, y1, x2, y2, off, text, size) {
  const horizontal = Math.abs(y2 - y1) < 1e-9;
  const out = [];
  if (horizontal) {
    const dy = y1 - off;
    out.push(line(LAYER.DIM, x1, y1 - GAP, x1, dy - TICK));
    out.push(line(LAYER.DIM, x2, y1 - GAP, x2, dy - TICK));
    out.push(line(LAYER.DIM, x1, dy, x2, dy));
    out.push(line(LAYER.DIM, x1 - TICK, dy - TICK, x1 + TICK, dy + TICK));
    out.push(line(LAYER.DIM, x2 - TICK, dy - TICK, x2 + TICK, dy + TICK));
    out.push(label(LAYER.DIM, (x1 + x2) / 2, dy + size * 0.45, text, { size, anchor: 'middle' }));
  } else {
    const dx = x1 - off;
    out.push(line(LAYER.DIM, x1 - GAP, y1, dx - TICK, y1));
    out.push(line(LAYER.DIM, x1 - GAP, y2, dx - TICK, y2));
    out.push(line(LAYER.DIM, dx, y1, dx, y2));
    out.push(line(LAYER.DIM, dx - TICK, y1 - TICK, dx + TICK, y1 + TICK));
    out.push(line(LAYER.DIM, dx - TICK, y2 - TICK, dx + TICK, y2 + TICK));
    out.push(label(LAYER.DIM, dx - size * 0.45, (y1 + y2) / 2, text, { size, anchor: 'middle', rotate: 90 }));
  }
  return out;
}

/**
 * A dimension CHAIN: consecutive measurements along one edge, the way a real
 * dieline dimensions each panel rather than only the overall blank. The
 * divisions are read from the crease lines themselves, so the chain can never
 * disagree with the drawing it annotates.
 */
function chain(stops, from, off, size, horizontal, fmtLen) {
  const out = [];
  const s = [...stops].sort((a, b) => a - b);
  for (let i = 1; i < s.length; i++) {
    const a = s[i - 1], b = s[i];
    const span = b - a;
    // Skip anything too narrow to letter; a chain of unreadable numbers is worse
    // than no chain. Slot widths and relief gaps fall out here, as they should.
    if (span < size * 2.6) continue;
    if (horizontal) {
      out.push(line(LAYER.DIM, a, from - off, a, from - off + TICK * 1.6));
      out.push(line(LAYER.DIM, b, from - off, b, from - off + TICK * 1.6));
      out.push(line(LAYER.DIM, a, from - off, b, from - off));
      out.push(label(LAYER.DIM, (a + b) / 2, from - off + size * 0.4, fmtLen(span),
        { size, anchor: 'middle' }));
    } else {
      out.push(line(LAYER.DIM, from - off, a, from - off + TICK * 1.6, a));
      out.push(line(LAYER.DIM, from - off, b, from - off + TICK * 1.6, b));
      out.push(line(LAYER.DIM, from - off, a, from - off, b));
      out.push(label(LAYER.DIM, from - off - size * 0.4, (a + b) / 2, fmtLen(span),
        { size, anchor: 'middle', rotate: 90 }));
    }
  }
  return out;
}

/** Fold positions along each axis, taken from the crease lines. */
function creaseStops(dl) {
  const xs = new Set(), ys = new Set();
  for (const p of dl.paths) {
    if (p.layer !== LAYER.CREASE || p.pts.length < 2) continue;
    const [[x1, y1], [x2, y2]] = [p.pts[0], p.pts[p.pts.length - 1]];
    if (Math.abs(x1 - x2) < 1e-6) xs.add(Math.round(x1 * 100) / 100);
    if (Math.abs(y1 - y2) < 1e-6) ys.add(Math.round(y1 * 100) / 100);
  }
  return { xs: [...xs], ys: [...ys] };
}

const centroid = (pts) => {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length];
    const f = x1 * y2 - x2 * y1;
    a += f; cx += (x1 + x2) * f; cy += (y1 + y2) * f;
  }
  a *= 0.5;
  return Math.abs(a) < 1e-9 ? pts[0] : [cx / (6 * a), cy / (6 * a)];
};

/**
 * Return extra annotation paths for a dieline.
 * @param {object} dl     built dieline
 * @param {object} style  the style (for its fold model)
 * @param {object} opts   { dims, labels, guides, guideInset, unit, fmt, textMm }
 */
export function annotations(dl, style, opts = {}) {
  const out = [];
  const b = dl.bbox;
  // Text scales with the blank so it stays legible whether the box is a
  // matchbox or a pallet case, but never gets silly at either extreme.
  //
  // `textMm` overrides that for output seen at 1:1 rather than scaled to fit.
  // Proportional lettering is right on a drawing you look at whole; on a sheet
  // of A4 held at arm's length it is 14 mm tall and swamps the panel it labels.
  const size = opts.textMm > 0 ? opts.textMm
    : Math.max(3, Math.min(14, Math.max(b.w, b.h) / 32));
  const fmtLen = opts.fmt || ((mm) => `${Math.round(mm * 10) / 10} mm`);

  // The chain runs closest to the blank; the overall dimension steps outside it.
  // Both letter upward from their line, so the overall has to clear the chain's
  // line AND its lettering, not just the line.
  const cs = size * 0.82, inner = OFF * 0.34;
  const chainBand = inner + cs * 2.4;
  const overallOff = OFF + size + (opts.chain ? chainBand : 0);

  if (opts.dims !== false) {
    out.push(...dimension(b.minX, b.minY, b.maxX, b.minY, overallOff, fmtLen(b.w), size));
    out.push(...dimension(b.minX, b.minY, b.minX, b.maxY, overallOff, fmtLen(b.h), size));
  }

  if (opts.chain) {
    const { xs, ys } = creaseStops(dl);
    out.push(...chain([b.minX, b.maxX, ...xs.filter((v) => v > b.minX && v < b.maxX)],
      b.minY, inner + cs, cs, true, fmtLen));
    out.push(...chain([b.minY, b.maxY, ...ys.filter((v) => v > b.minY && v < b.maxY)],
      b.minX, inner + cs, cs, false, fmtLen));
  }

  if ((opts.labels || opts.guides) && typeof style.fold === 'function') {
    const flat = foldNet(style.fold(dl.params), 0);
    // The fold net and the drawn blank are built from the same layout, but
    // makeDieline normalises the blank to the origin - align to be certain.
    const fb = bboxOf(flat.map((f) => ({ pts: f.pts.map((q) => [q[0], q[1]]) })));
    const dx = b.minX - fb.minX, dy = b.minY - fb.minY;

    for (const f of flat) {
      const pts = f.pts.map((q) => [q[0] + dx, q[1] + dy]);
      const pb = bboxOf([{ pts }]);
      if (opts.guides && f.kind === 'panel') {
        const m = opts.guideInset ?? 3;
        if (pb.w > m * 2.5 && pb.h > m * 2.5) {
          out.push(path(LAYER.GUIDE, [
            [pb.minX + m, pb.minY + m], [pb.maxX - m, pb.minY + m],
            [pb.maxX - m, pb.maxY - m], [pb.minX + m, pb.maxY - m]], true));
        }
      }
      if (opts.labels && f.label && f.kind === 'panel') {
        const c = centroid(pts);
        // Only letter a panel that can actually hold the text.
        if (pb.w > f.label.length * size * 0.62 && pb.h > size * 1.8) {
          out.push(label(LAYER.DIM, c[0], c[1] - size * 0.35, f.label,
            { size: size * 0.85, anchor: 'middle' }));
        }
      }
    }
  }
  return out;
}

/**
 * A copy of `dl` with annotation paths merged in, re-normalised to the origin.
 * Dimensions sit below and to the left of the blank, i.e. in negative space, so
 * the whole drawing has to be shifted back or the exporters clip them off the page.
 */
export function withAnnotations(dl, style, opts = {}) {
  const extra = annotations(dl, style, opts);
  if (!extra.length) return dl;
  const paths = normalise([...dl.paths, ...extra], 0);
  return { ...dl, paths, bbox: bboxOf(paths),
           blankBbox: dl.bbox,                                  // the box the die cuts
           blankAreaM2: (dl.bbox.w * dl.bbox.h) / 1e6 };      // area stays the BLANK's
}
