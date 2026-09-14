// ---------------------------------------------------------------------------
// Tiling: splitting a drawing across sheets a desk printer can actually make.
//
// This exists because of a plain physical fact. The advice this whole tool
// rests on - print it at 100%, fold it, check it against the product before
// you order tooling - is impossible for almost every real box. A 200x150x100
// shipping case is a 747 x 253 mm blank. That is larger than A2. Ten of the
// eleven catalogue styles, at their own default sizes, do not fit on A4.
//
// Offered a page bigger than the paper, a print dialog does one of two things:
// scales it to fit, silently destroying the true scale the file exists to
// carry, or prints one corner. Either way the person folds nothing.
//
// THE SCHEME IS TRIM-AND-BUTT, not overlap-and-align.
//
// Each sheet owns a rectangular CELL of the drawing and prints it with a BLEED
// of duplicated drawing on all four sides. A dashed trim line marks the cell
// boundary. You cut on the dashed line and butt the cut edges together.
//
// The alternative - print an overlap, align the artwork by eye, tape it down -
// accumulates error across every seam, and a 5-across blank has four seams. A
// millimetre of drift per seam is four millimetres on the length of the box,
// which is the same order as the board allowance the tool exists to get right.
// Butting cut edges has no cumulative term at all: each cut is made against a
// printed line whose position is exact, and the error is one cut, once.
//
// The bleed is not there to be aligned. It is there so the trim line is never
// inside an unprintable margin, and so a printer whose registration is a
// millimetre out still puts the line on the paper.
// ---------------------------------------------------------------------------

/** Paper a desk printer is likely to hold, in millimetres, portrait. */
export const PAPERS = [
  { id: 'a4',      name: 'A4',            w: 210,   h: 297 },
  { id: 'letter',  name: 'US Letter',     w: 215.9, h: 279.4 },
  { id: 'legal',   name: 'US Legal',      w: 215.9, h: 355.6 },
  { id: 'a3',      name: 'A3',            w: 297,   h: 420 },
  { id: 'tabloid', name: 'US Tabloid',    w: 279.4, h: 431.8 },
];

export const paperById = (id) => PAPERS.find((p) => p.id === id);

export const TILE_DEFAULTS = {
  margin: 10,     // unprintable edge to stay clear of. 10 mm clears nearly every desk printer.
  bleed: 5,       // duplicated drawing outside the trim line, each side
  // 13 mm holds the sheet label, the ruler and its numbers with 1.7 mm to
  // spare - measured against Helvetica's cap height, not guessed. It is worth
  // measuring: at 14 mm an A4 portrait cell drops to 253 mm, and the 253 mm
  // RSC blank stops fitting one row, which costs five extra sheets on the
  // commonest box in the catalogue.
  footer: 13,
};

/** Column letters: A..Z, then AA, AB - a 27-column blank is absurd but not a crash. */
export function colName(i) {
  let s = '';
  for (let n = i; n >= 0; n = Math.floor(n / 26) - 1) s = String.fromCharCode(65 + (n % 26)) + s;
  return s;
}

/** How many cells of size `cell` are needed to cover `total`. */
const cellsFor = (total, cell) => (cell > 0 ? Math.max(1, Math.ceil(total / cell - 1e-9)) : Infinity);

function planFor(w, h, pw, ph, o) {
  // The drawing area left on a sheet once the margins, the bleed on both sides
  // and the footer band are taken out. This is the nominal cell.
  const cw = pw - 2 * o.margin - 2 * o.bleed;
  const ch = ph - 2 * o.margin - 2 * o.bleed - o.footer;
  if (!(cw > 0 && ch > 0)) return null;
  const cols = cellsFor(w, cw), rows = cellsFor(h, ch);
  if (!Number.isFinite(cols * rows)) return null;
  return { cols, rows, count: cols * rows, cell: { w: cw, h: ch }, paper: { w: pw, h: ph } };
}

/**
 * Work out the sheet grid for a drawing.
 *
 * Orientation is chosen, not asked for: the same blank can need six sheets one
 * way round and five the other, and nobody should have to try both. Fewest
 * sheets wins; a tie goes to whichever wastes less paper.
 *
 * @param {number} w   drawing width in mm
 * @param {number} h   drawing height in mm
 * @param {object} paper  { id, name, w, h } portrait
 * @param {object} opts   { margin, bleed, footer, orientation: 'auto'|'portrait'|'landscape' }
 * @returns {object|null} plan, or null if the drawing cannot be tiled at all
 */
export function tilePlan(w, h, paper, opts = {}) {
  const o = { ...TILE_DEFAULTS, ...opts };
  if (!(w > 0 && h > 0) || !paper) return null;

  const want = o.orientation || 'auto';
  const cands = [];
  if (want !== 'landscape') {
    const p = planFor(w, h, paper.w, paper.h, o);
    if (p) cands.push({ ...p, orientation: 'portrait' });
  }
  if (want !== 'portrait') {
    const p = planFor(w, h, paper.h, paper.w, o);
    if (p) cands.push({ ...p, orientation: 'landscape' });
  }
  if (!cands.length) return null;

  // Fewest sheets; then least paper. Paper used is the same per sheet within an
  // orientation, so the tie-break is really "which grid covers more tightly".
  cands.sort((a, b) => (a.count - b.count)
    || (a.count * a.paper.w * a.paper.h) - (b.count * b.paper.w * b.paper.h));
  const best = cands[0];

  const pages = [];
  for (let r = 0; r < best.rows; r++) {
    for (let c = 0; c < best.cols; c++) {
      const x = c * best.cell.w, y = h - (r + 1) * best.cell.h;   // row 1 is the TOP of the drawing
      // The last column and the bottom row are short. Reporting the true covered
      // extent keeps the map honest and stops the trim line being drawn out in
      // empty space beyond the blank.
      const cwEff = Math.min(best.cell.w, w - x);
      const chEff = Math.min(best.cell.h, y + best.cell.h);
      pages.push({
        i: pages.length,
        col: c, row: r,
        label: `${colName(c)}${r + 1}`,
        x, y: Math.max(0, y),
        w: cwEff, h: chEff,
        full: { w: best.cell.w, h: best.cell.h },
      });
    }
  }

  const sheetArea = (best.paper.w * best.paper.h) / 1e6;
  return {
    ...best,
    paper: { ...paper, w: best.paper.w, h: best.paper.h },
    margin: o.margin, bleed: o.bleed, footer: o.footer,
    drawing: { w, h },
    pages,
    sheetsA: sheetArea,
    /** Sheets including the instruction page that leads the document. */
    totalSheets: best.count + 1,
    grid: `${best.cols} × ${best.rows}`,
  };
}

/**
 * Does the drawing fit one sheet with no tiling at all? Answered against the
 * same margins the tiler uses, so the two never disagree about a borderline size.
 */
export function fitsOnePage(w, h, paper, opts = {}) {
  const p = tilePlan(w, h, paper, opts);
  return !!p && p.count === 1;
}

/**
 * A picture of the plan, for the screen. The sheet count alone is a number the
 * reader has to take on trust; the grid drawn over their own blank is a number
 * they can check, and it makes "turn the dimensions off and save a sheet"
 * something they can see rather than be told.
 *
 * @param {object} dl    dieline (annotated or not - drawn as it will print)
 * @param {object} plan  from tilePlan()
 */
export function toTileSVG(dl, plan) {
  const b = dl.bbox, pad = Math.max(b.w, b.h) * 0.035;
  const W = b.w + pad * 2, H = b.h + pad * 2;
  const Y = (v) => b.h - v + pad;                       // SVG y runs down
  const d = (p) => p.pts.map(([x, y], i) => `${i ? 'L' : 'M'}${(x + pad).toFixed(2)} ${Y(y).toFixed(2)}`)
    .join('') + (p.closed ? 'Z' : '');
  const layer = (name, stroke, dash) => dl.paths.filter((p) => p.layer === name && p.kind !== 'text')
    .map((p) => `<path d="${d(p)}" fill="none" stroke="${stroke}" stroke-width="1.2"
      vector-effect="non-scaling-stroke"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`).join('');
  const fs = Math.max(b.w, b.h) * 0.045;
  const cells = plan.pages.map((p) => `
    <rect x="${(p.x + pad).toFixed(2)}" y="${Y(p.y + p.h).toFixed(2)}"
      width="${p.w.toFixed(2)}" height="${p.h.toFixed(2)}"
      fill="var(--tile-fill, rgba(13,110,140,.06))" stroke="var(--tile-line, #0d6e8c)"
      stroke-width="1.4" stroke-dasharray="7 3" vector-effect="non-scaling-stroke"/>`).join('');
  // Labels go on last, over a knocked-out patch. A cell label sitting on a cut
  // line is illegible exactly when it is being used - while sorting the sheets.
  const labels = plan.pages.map((p) => {
    const cx = p.x + p.w / 2 + pad, cy = Y(p.y + p.h / 2);
    const lw = p.label.length * fs * 0.66 + fs * 0.5;
    return `<rect x="${(cx - lw / 2).toFixed(2)}" y="${(cy - fs * 0.62).toFixed(2)}"
      width="${lw.toFixed(2)}" height="${(fs * 1.1).toFixed(2)}" rx="${(fs * 0.16).toFixed(2)}"
      fill="var(--tile-knock, #fff)"/>
    <text x="${cx.toFixed(2)}" y="${(cy + fs * 0.34).toFixed(2)}" font-size="${fs.toFixed(2)}"
      text-anchor="middle" fill="var(--tile-line, #0d6e8c)"
      font-family="ui-sans-serif,system-ui,sans-serif">${p.label}</text>`;
  }).join('');
  return `<svg viewBox="0 0 ${W.toFixed(2)} ${H.toFixed(2)}" width="100%"
    preserveAspectRatio="xMidYMid meet" role="img"
    aria-label="${plan.count} sheets of ${plan.paper.name} ${plan.orientation}, ${plan.grid}">
    ${layer('crease', 'var(--crease, #2f9fd4)', '5 3')}${layer('guide', '#8E77C6', '3 3')}
    ${layer('cut', 'var(--cut, #e6007e)')}${cells}${labels}</svg>`;
}
