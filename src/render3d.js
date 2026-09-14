// ---------------------------------------------------------------------------
// 3D preview renderer. Projects a folded net to SVG with painter's-algorithm
// depth sorting and simple Lambert shading. No WebGL, no library: a few hundred
// polygons is well within SVG's comfort zone and it stays crisp at any zoom.
// ---------------------------------------------------------------------------

const D2R = Math.PI / 180;

/** Board tones. Deliberately paper-like rather than saturated. */
const TONE = {
  panel: [196, 154, 108],
  flap:  [176, 134,  90],
  glue:  [122, 168, 132],
};

/** Rotate world -> camera, then project orthographically. */
function project(p, yaw, pitch) {
  const cy = Math.cos(yaw * D2R), sy = Math.sin(yaw * D2R);
  const cp = Math.cos(pitch * D2R), sp = Math.sin(pitch * D2R);
  const x1 = p[0] * cy - p[1] * sy;
  const y1 = p[0] * sy + p[1] * cy;
  const z1 = p[2];
  const y2 = y1 * cp - z1 * sp;
  const z2 = y1 * sp + z1 * cp;
  return [x1, -y2, z2];            // screen x, screen y (SVG y is down), depth
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
function normal(pts) {
  // Newell's method: robust for polygons that are not perfectly planar.
  let n = [0, 0, 0];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    n[0] += (a[1] - b[1]) * (a[2] + b[2]);
    n[1] += (a[2] - b[2]) * (a[0] + b[0]);
    n[2] += (a[0] - b[0]) * (a[1] + b[1]);
  }
  const L = Math.hypot(...n) || 1;
  return [n[0] / L, n[1] / L, n[2] / L];
}

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const shade = (rgb, k) => `rgb(${rgb.map((c) => Math.round(clamp01(k) * c)).join(',')})`;

/**
 * @param {Array}  faces  from foldNet()
 * @param {object} opts   { yaw, pitch, size, padding, showLabels }
 */
export function toSVG3D(faces, opts = {}) {
  const yaw = opts.yaw ?? -34;
  const pitch = opts.pitch ?? 62;
  const W = opts.size?.[0] ?? 640;
  const H = opts.size?.[1] ?? 420;
  const pad = opts.padding ?? 22;
  if (!faces.length) return '';

  const light = (() => { const v = [0.42, -0.5, 0.76]; const L = Math.hypot(...v); return v.map((c) => c / L); })();

  const projected = faces.map((f) => {
    const pts = f.pts.map((p) => project(p, yaw, pitch));
    const n = normal(pts);
    return { ...f, pts, n, depth: pts.reduce((s, q) => s + q[2], 0) / pts.length };
  });

  // Fit to the viewport.
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const f of projected) for (const q of f.pts) {
    if (q[0] < minX) minX = q[0]; if (q[0] > maxX) maxX = q[0];
    if (q[1] < minY) minY = q[1]; if (q[1] > maxY) maxY = q[1];
  }
  const scale = Math.min((W - pad * 2) / Math.max(maxX - minX, 1e-6),
                         (H - pad * 2) / Math.max(maxY - minY, 1e-6));
  const ox = (W - (maxX - minX) * scale) / 2 - minX * scale;
  const oy = (H - (maxY - minY) * scale) / 2 - minY * scale;
  const to = (q) => `${(q[0] * scale + ox).toFixed(2)},${(q[1] * scale + oy).toFixed(2)}`;

  projected.sort((a, b) => a.depth - b.depth);      // far to near

  const body = projected.map((f) => {
    const tone = TONE[f.kind] || TONE.panel;
    // Two-sided lighting: a panel seen from behind is still lit, just dimmer.
    const lam = Math.abs(f.n[0] * light[0] + f.n[1] * light[1] + f.n[2] * light[2]);
    const k = 0.55 + 0.45 * lam;
    return `<polygon points="${f.pts.map(to).join(' ')}" fill="${shade(tone, k)}" `
         + `stroke="rgba(60,38,18,.42)" stroke-width="0.7" stroke-linejoin="round"/>`;
  }).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" `
    + `width="100%" height="100%" role="img" aria-label="Three-dimensional preview of the folded box">`
    + `<g>${body}</g></svg>`;
}
