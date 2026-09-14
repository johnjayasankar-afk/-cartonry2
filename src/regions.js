/**
 * The named parts of a blank - the panels, flaps and glue tabs a converter
 * would point at - as polygons in the blank's own coordinates.
 *
 * The drawing has always known these: `annotations()` uses the same fold net to
 * letter each panel. It just had no way to hand them to the interface, so the
 * dieline was something you read rather than something you could interrogate.
 * Nothing here is new geometry; it is the fold engine's own net, flattened.
 */
import { foldNet } from './fold.js';

const bounds = (pts) => {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of pts) {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
};

/** Shoelace. Sign is dropped: winding is the fold engine's business, not ours. */
const areaOf = (pts) => {
  let a = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    a += pts[j][0] * pts[i][1] - pts[i][0] * pts[j][1];
  }
  return Math.abs(a) / 2;
};

const finite = (p) => Number.isFinite(p[0]) && Number.isFinite(p[1]);

/**
 * @param {object} dl     a dieline, for its params
 * @param {object} style  its style record
 * @returns {Array} regions with the net's own bounds moved to (0,0), so a
 *   caller can drop them onto any drawing of the same blank by adding that
 *   drawing's cut-layer origin. Empty for a style that closes by bending and
 *   therefore has no fold net - a pillow box has no flat panels to name.
 */
export function regionsOf(dl, style) {
  if (!dl || !style || typeof style.fold !== 'function') return [];
  let faces;
  try { faces = foldNet(style.fold(dl.params), 0); } catch { return []; }

  const flat = faces
    .map((f) => ({ ...f, pts: f.pts.map(([x, y]) => [x, y]) }))
    .filter((f) => f.pts.length >= 3 && f.pts.every(finite));
  if (!flat.length) return [];

  const nb = bounds(flat.flatMap((f) => f.pts));
  if (!(nb.w > 0 && nb.h > 0)) return [];

  const out = flat.map((f, i) => {
    const pts = f.pts.map(([x, y]) => [x - nb.minX, y - nb.minY]);
    const b = bounds(pts);
    return {
      id: f.id || `r${i}`,
      label: f.label || '',
      kind: f.kind || 'panel',
      pts,
      w: b.w,
      h: b.h,
      cx: (b.minX + b.maxX) / 2,
      cy: (b.minY + b.maxY) / 2,
      areaMm2: areaOf(pts),
    };
  });

  // Reading order, so arrow-key exploration goes the way the eye does. Blank
  // coordinates put Y upwards, so the top of the drawing is the LARGEST y.
  const band = Math.max(nb.h / 40, 1);
  return out.sort((a, b) => (Math.abs(b.cy - a.cy) > band ? b.cy - a.cy : a.cx - b.cx));
}

/** How much of the blank the named regions actually account for, 0..1. */
export function coverage(regions, bbox) {
  if (!regions.length || !bbox || !(bbox.w > 0)) return 0;
  return regions.reduce((s, r) => s + r.areaMm2, 0) / (bbox.w * bbox.h);
}

/** Longest common prefix of a set of labels, trimmed to a whole word. */
const sharedName = (labels) => {
  const uniq = [...new Set(labels)];
  if (uniq.length === 1) return uniq[0];
  let i = 0;
  while (i < uniq[0].length && uniq.every((l) => l[i] === uniq[0][i])) i++;
  const pre = uniq[0].slice(0, i).replace(/[\s\d/-]+$/, '');
  return pre.length > 1 ? pre : uniq.join(' / ');
};

/**
 * The parts schedule: one row per distinct part, with how many of it there are.
 *
 * A regular slotted container has thirteen regions but only seven parts - four
 * of its flaps are the same flap. Listing all thirteen would be a list of
 * duplicates; this is the schedule a converter would actually read, and the
 * shape the drawing is really in.
 *
 * Parts are grouped by kind and size rather than by name, so six faces of a
 * hexagon that differ only by number collapse to "Face x6" while keeping their
 * individual names on the drawing.
 */
export function partsOf(regions) {
  const groups = new Map();
  for (const r of regions) {
    const key = `${r.kind}|${r.w.toFixed(2)}|${r.h.toFixed(2)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(r);
  }
  // A schedule reads body first: the panels that make the box, then the flaps
  // that close it, then the tab that holds it together. Within each, biggest
  // first. Encounter order would have put four flaps above the sides.
  const RANK = { panel: 0, flap: 1, glue: 2 };
  return [...groups.values()].map((members) => ({
    label: sharedName(members.map((m) => m.label)),
    kind: members[0].kind,
    w: members[0].w,
    h: members[0].h,
    count: members.length,
    ids: members.map((m) => m.id),
    areaMm2: members.reduce((s, m) => s + m.areaMm2, 0),
  })).sort((a, b) => (RANK[a.kind] ?? 9) - (RANK[b.kind] ?? 9)
    || (b.w * b.h) - (a.w * a.h));
}
