// ---------------------------------------------------------------------------
// Sheet layout renderer.
//
// The estimator returns where every blank sits, so draw it. A bare "4 up, 21%
// waste" is a number the customer has to trust; a picture of the sheet is a
// number they can check. It also makes a bad layout obvious at a glance, which
// is exactly when someone should change the sheet or the box size.
// ---------------------------------------------------------------------------
import { LAYER } from './model.js';

const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

/**
 * The nested sheet expressed as an ordinary dieline, so every existing exporter
 * works on it unchanged: SVG for a designer, true-scale PDF for a printer, DXF
 * for a cutting table that wants the whole sheet in one file.
 */
export function toSheetDieline(dl, y, opts = {}) {
  const { w: SW, h: SH, margin: M } = y.area;
  const cut = dl.paths.find((p) => p.layer === LAYER.CUT);
  const paths = [
    // The sheet edge and trim line are guides, never knife lines.
    { layer: LAYER.GUIDE, closed: true, pts: [[0, 0], [SW, 0], [SW, SH], [0, SH]] },
  ];
  if (M > 0) {
    paths.push({ layer: LAYER.GUIDE, closed: true,
      pts: [[M, M], [SW - M, M], [SW - M, SH - M], [M, SH - M]] });
  }
  for (const p of y.placements) {
    paths.push({ layer: LAYER.CUT, closed: true, pts: placedPath(cut.pts, p, dl.bbox.w, dl.bbox.h) });
    for (const cr of dl.paths.filter((q) => q.layer === LAYER.CREASE)) {
      paths.push({ layer: LAYER.CREASE, closed: cr.closed,
                   pts: placedPath(cr.pts, p, dl.bbox.w, dl.bbox.h) });
    }
  }
  return {
    id: `${dl.id}-sheet`, name: `${dl.name} — ${y.perSheet} up on ${SW} x ${SH} mm`,
    code: dl.code, family: dl.family, paths,
    bbox: { minX: 0, minY: 0, maxX: SW, maxY: SH, w: SW, h: SH },
    params: dl.params, panels: dl.panels,
    blankAreaM2: (SW * SH) / 1e6,
    notes: [`${y.perSheet} blanks per sheet, ${y.layout}.`,
            `${y.wastePct}% of the board is waste.`,
            opts.grainNote || 'Board grain runs down the sheet; blanks are not turned.'],
  };
}

/** Place one blank's cut outline on the sheet, rotating it if the layout did. */
function placedPath(pts, p, blankW, blankH) {
  return pts.map(([x, y]) => (p.rot === 90
    // 90 deg CCW then shifted back into positive space: (x,y) -> (bh - y, x)
    ? [p.x + (blankH - y), p.y + x]
    : [p.x + x, p.y + y]));
}

/**
 * @param {object} dl     the CUT blank (not the annotated drawing)
 * @param {object} y      result from sheetYield()
 * @param {object} opts   { grainAxis:'y'|'x', showOutlines, label }
 */
export function toSheetSVG(dl, y, opts = {}) {
  const { w: SW, h: SH, margin: M } = y.area;
  const pad = Math.max(SW, SH) * 0.06;
  const W = SW + pad * 2, H = SH + pad * 2;
  const cut = dl.paths.find((p) => p.layer === LAYER.CUT);
  // Below about forty blanks the real outline is worth drawing; above that the
  // detail is invisible at any sensible size and rectangles read more clearly.
  const outlines = (opts.showOutlines ?? y.perSheet <= 40) && cut;
  const stroke = Math.max(SW / 900, 0.6);

  const blanks = y.placements.map((p, i) => {
    if (outlines) {
      const d = placedPath(cut.pts, p, dl.bbox.w, dl.bbox.h)
        .map(([x, yy], j) => `${j ? 'L' : 'M'}${Math.round(x * 100) / 100} ${Math.round(yy * 100) / 100}`)
        .join(' ') + ' Z';
      return `<path d="${d}"/>`;
    }
    return `<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" rx="${Math.min(p.w, p.h) * 0.02}"/>`;
  }).join('');

  const trim = M > 0
    ? `<rect x="${M}" y="${M}" width="${SW - 2 * M}" height="${SH - 2 * M}" fill="none"
         stroke="#9AA3AB" stroke-width="${stroke}" stroke-dasharray="${stroke * 6} ${stroke * 4}"/>`
    : '';

  // Grain / flute arrow, drawn down the side it actually runs along.
  const gv = (opts.grainAxis ?? 'y') === 'y';
  const aLen = (gv ? SH : SW) * 0.34, aHead = Math.max(SW, SH) * 0.014;
  const gx = gv ? -pad * 0.45 : SW / 2 - aLen / 2;
  const gy = gv ? SH / 2 - aLen / 2 : -pad * 0.45;
  const grain = `<g stroke="#8E77C6" stroke-width="${stroke * 1.6}" fill="none" stroke-linecap="round">
      ${gv
        ? `<path d="M${gx} ${gy} L${gx} ${gy + aLen}"/>
           <path d="M${gx - aHead} ${gy + aHead} L${gx} ${gy} L${gx + aHead} ${gy + aHead}"/>
           <path d="M${gx - aHead} ${gy + aLen - aHead} L${gx} ${gy + aLen} L${gx + aHead} ${gy + aLen - aHead}"/>`
        : `<path d="M${gx} ${gy} L${gx + aLen} ${gy}"/>
           <path d="M${gx + aHead} ${gy - aHead} L${gx} ${gy} L${gx + aHead} ${gy + aHead}"/>
           <path d="M${gx + aLen - aHead} ${gy - aHead} L${gx + aLen} ${gy} L${gx + aLen - aHead} ${gy + aHead}"/>`}
    </g>`;

  const fs = Math.max(SW, SH) * 0.022;
  const caption = opts.label !== false
    ? `<text x="${SW / 2}" y="${-pad * 0.32}" text-anchor="middle" font-size="${fs}"
         font-family="Helvetica, Arial, sans-serif" fill="#8A94A0">${esc(
           y.perSheet ? `${y.perSheet} up on ${SW} × ${SH} mm · ${y.wastePct}% waste` : 'does not fit')}</text>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-pad} ${-pad} ${W} ${H}"
     width="100%" height="100%" role="img"
     aria-label="${esc(y.perSheet ? `${y.perSheet} blanks laid out on a ${SW} by ${SH} millimetre sheet`
       : 'The blank does not fit this sheet')}">
  <rect x="0" y="0" width="${SW}" height="${SH}" fill="rgba(127,127,127,.07)"
        stroke="#8A94A0" stroke-width="${stroke * 1.2}"/>
  ${trim}
  <g fill="rgba(230,0,126,.07)" stroke="#E6007E" stroke-width="${stroke}"
     stroke-linejoin="round">${blanks}</g>
  ${grain}
  ${caption}
</svg>`;
}
