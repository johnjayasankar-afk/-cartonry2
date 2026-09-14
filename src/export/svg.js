// SVG export. Sized in real millimetres so it opens at true scale in
// Illustrator, Inkscape, Affinity and CorelDRAW.
import { LAYER } from '../model.js';

export const STYLE_RULES = {
  [LAYER.CUT]:    { stroke: '#E6007E', dash: null,      label: 'Cut' },
  [LAYER.CREASE]: { stroke: '#0090D4', dash: '3 2',     label: 'Crease / fold' },
  [LAYER.GUIDE]:  { stroke: '#8E77C6', dash: '2 2',     label: 'Artwork guide' },
  [LAYER.GLUE]:   { stroke: '#00A45A', dash: '2 1.5',   label: 'Glue area' },
  [LAYER.DIM]:    { stroke: '#8A94A0', dash: null,      label: 'Dimensions' },
};

const d = (p) => p.pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ') + (p.closed ? ' Z' : '');

/* ------------------------------------------------------------ graticule
 * A true-millimetre grid for the on-screen preview.
 *
 * The preview used to sit on a chequerboard, which in every graphics tool
 * means "transparent". Here the background is not transparent - it is a sheet
 * of board - and the chequer said nothing about it. A graticule says something
 * true instead: it is drawn in DRAWING units, so a square is a real square
 * millimetre of the actual box at every zoom level, and proportions can be
 * read straight off it without measuring.
 *
 * Off by default. It belongs to the preview, not to an exported file that
 * someone is going to place artwork on.
 * -------------------------------------------------------------------- */

/**
 * A grid step from the 1-2-5 series giving roughly 12-30 divisions across the
 * drawing - fine enough to measure by, coarse enough not to become a texture.
 * @param {number} span  the larger side of the drawing, in mm
 */
export function gridStep(span) {
  if (!(span > 0)) return 10;
  const raw = span / 20;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const n = raw / pow;
  return (n <= 1.5 ? 1 : n <= 3.5 ? 2 : n <= 7.5 ? 5 : 10) * pow;
}

/**
 * @param {object} dl      dieline
 * @param {object} opts    { margin, strokeMm, includeDims }
 */
export function toSVG(dl, opts = {}) {
  const margin = opts.margin ?? 10;
  const sw = opts.strokeMm ?? 0.25;
  const { w, h } = dl.bbox;
  const W = w + margin * 2, H = h + margin * 2;
  const step = gridStep(Math.max(w, h));
  // non-scaling-stroke: the line weight is a SCREEN width, not a drawing width.
  // In drawing units a grid line on a 750 mm blank works out at a fifth of a
  // pixel and is simply not there; and at 8x zoom the same line would be fat.
  // A hairline is a hairline at every scale, which is what a graticule is.
  // The pattern origin is moved to the blank's own corner, so squares can be
  // counted out from the edge of the box rather than from an arbitrary point
  // in the margin. A grid you cannot count from is only a texture.
  const grid = opts.grid ? `  <defs>
    <pattern id="mm" width="${step}" height="${step}" patternUnits="userSpaceOnUse">
      <path d="M${step} 0V${step}H0" fill="none" stroke="var(--grid-fine,rgba(120,130,140,.22))"
            stroke-width="1" vector-effect="non-scaling-stroke"/>
    </pattern>
    <pattern id="mm5" width="${step * 5}" height="${step * 5}" patternUnits="userSpaceOnUse"
             patternTransform="translate(${margin} ${H - margin})">
      <rect width="${step * 5}" height="${step * 5}" fill="url(#mm)"/>
      <path d="M${step * 5} 0V${step * 5}H0" fill="none"
            stroke="var(--grid-bold,rgba(120,130,140,.40))" stroke-width="1"
            vector-effect="non-scaling-stroke"/>
    </pattern>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#mm5)"/>
` : '';

  // Y is flipped so the SVG reads the same way up as the on-screen preview.
  const groups = Object.values(LAYER)
    .filter((L) => !(L === LAYER.DIM && !opts.includeDims))
    .map((L) => {
      const ps = dl.paths.filter((p) => p.layer === L);
      if (!ps.length) return '';
      const r = STYLE_RULES[L];
      const dash = r.dash ? ` stroke-dasharray="${r.dash}"` : '';
      const fill = L === LAYER.GLUE ? ' fill="rgba(0,164,90,.08)"' : ' fill="none"';
      const body = ps.map((p) => (p.kind === 'text'
        // Y is flipped for the whole drawing, so text is un-flipped locally to read the right way up.
        ? `    <text x="0" y="0" font-family="Helvetica, Arial, sans-serif" font-size="${p.size}"`
          + ` text-anchor="${p.anchor}" fill="${r.stroke}" stroke="none"`
          + ` transform="translate(${p.at[0]} ${p.at[1]}) scale(1 -1) rotate(${-p.rotate})"`
          + `>${esc(p.value)}</text>`
        : `    <path d="${d(p)}"/>`)).join('\n');
      return `  <g id="${r.label.replace(/[^a-z]/gi, '-')}" data-layer="${L}" `
        + `stroke="${r.stroke}" stroke-width="${sw}"${dash}${fill} `
        + `stroke-linejoin="round" stroke-linecap="round">\n` + body + `\n  </g>`;
    }).filter(Boolean).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}mm" height="${H}mm"
     viewBox="0 0 ${W} ${H}" data-generator="Cartonry">
  <title>${esc(dl.name)} - ${dl.params.L} x ${dl.params.W} x ${dl.params.H} mm internal</title>
${grid}  <g transform="translate(${margin} ${H - margin}) scale(1 -1)">
${groups}
  </g>
</svg>`;
}

const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
