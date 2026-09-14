// ---------------------------------------------------------------------------
// Material estimating: how blanks lie on a sheet, how much board that wastes,
// what each box weighs and what it costs.
//
// The nesting is a guillotine two-block heuristic, which is what an estimator
// does by hand: fill as many columns of one orientation as fit, then turn the
// remaining strip through 90 degrees and fill that. It is not an optimal packer
// and does not pretend to be - it is a layout a converter can actually cut on a
// guillotine, and it beats a naive single-orientation grid on most sizes.
//
// GRAIN MATTERS. Corrugated flutes and carton-board grain run one way down the
// sheet, and the direction relative to the box is structural: flutes should run
// vertically in a finished case so it stacks. If the board is directional the
// blank CANNOT simply be turned 90 degrees to nest better, so `allowRotation`
// defaults to false. Reporting a rotated yield on directional board would be
// quietly wrong in the customer's favour, which is the worst kind of wrong.
// ---------------------------------------------------------------------------

/** Common sheet sizes. Corrugated is cut from reel-fed sheets; carton board from press sheets. */
/* `std` is the name of a paper standard, where one exists. Corrugated sheets
 * have none - the trade specifies them by size - so they carry no name and the
 * menu shows their dimensions alone. Writing "1200 x 800 corrugated" in the
 * name and then appending the size printed it twice. */
export const SHEETS = [
  { id: 'b1',    std: 'B1 press sheet', w: 1000, h: 700,  for: 'carton' },
  { id: 'sra3',  std: 'SRA3',           w: 450,  h: 320,  for: 'carton' },
  { id: 'sra2',  std: 'SRA2',           w: 640,  h: 450,  for: 'carton' },
  { id: 'c1200', std: null,             w: 1200, h: 800,  for: 'corrugated' },
  { id: 'c1600', std: null,             w: 1600, h: 1200, for: 'corrugated' },
  { id: 'c2500', std: null,             w: 2500, h: 1600, for: 'corrugated' },
];

/** How a sheet is named in a menu: the standard plus its size, or just the size. */
export const sheetLabel = (sh, size) => (sh.std ? `${sh.std} — ${size}` : size);

const round = (v, d) => Math.round(v * 10 ** d) / 10 ** d;

/** Lay a plain grid into a rectangular region. Returns placements. */
function grid(x0, y0, W, H, w, h, g, rot) {
  const out = [];
  if (!(w > 0 && h > 0 && W > 0 && H > 0)) return out;
  const cols = Math.floor((W + g) / (w + g));
  const rows = Math.floor((H + g) / (h + g));
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      out.push({ x: round(x0 + c * (w + g), 3), y: round(y0 + r * (h + g), 3), w, h, rot });
    }
  }
  return out;
}

/**
 * How many blanks fit on a sheet, and exactly where they sit.
 *
 * @param {number} bw   blank width  (mm)
 * @param {number} bh   blank height (mm)
 * @param {number} sw   sheet width  (mm)
 * @param {number} sh   sheet height (mm)
 * @param {object|number} opts  { gutter, margin, allowRotation } - a bare number is taken as the gutter
 * @returns {{perSheet, layout, placements, wastePct, usedM2, sheetM2, rotatedCount, area}}
 */
export function sheetYield(bw, bh, sw, sh, opts = {}) {
  const o = typeof opts === 'number' ? { gutter: opts } : opts;
  const g = Math.max(0, o.gutter ?? 0);
  const m = Math.max(0, o.margin ?? 0);            // trim / gripper margin, all round
  const allowRotation = o.allowRotation ?? false;  // directional board by default

  const sheetM2 = round((sw * sh) / 1e6, 4);
  const empty = { perSheet: 0, layout: 'does not fit', placements: [], rotatedCount: 0,
                  wastePct: 100, usedM2: 0, sheetM2, area: { w: sw, h: sh, margin: m } };
  if (!(bw > 0 && bh > 0 && sw > 0 && sh > 0)) return empty;

  const W = sw - 2 * m, H = sh - 2 * m;
  if (W <= 0 || H <= 0) return empty;

  let best = { placements: [], layout: 'does not fit' };
  const consider = (placements, layout) => {
    if (placements.length > best.placements.length) best = { placements, layout };
  };

  const upright = grid(m, m, W, H, bw, bh, g, 0);
  if (upright.length) consider(upright, `${Math.floor((W + g) / (bw + g))} x ${Math.floor((H + g) / (bh + g))} upright`);

  if (allowRotation) {
    const turned = grid(m, m, W, H, bh, bw, g, 90);
    if (turned.length) consider(turned, `${Math.floor((W + g) / (bh + g))} x ${Math.floor((H + g) / (bw + g))} turned 90 deg`);

    // Two-block guillotine, split across the width and again across the height.
    for (const [w1, h1, r1, w2, h2, r2] of [[bw, bh, 0, bh, bw, 90], [bh, bw, 90, bw, bh, 0]]) {
      const cols = Math.floor((W + g) / (w1 + g));
      for (let c = 1; c <= cols; c++) {
        const used = c * w1 + (c - 1) * g;
        const first = grid(m, m, used, H, w1, h1, g, r1);
        const rest = W - used - g;
        const second = rest > 0 ? grid(m + used + g, m, rest, H, w2, h2, g, r2) : [];
        if (first.length + second.length) {
          consider([...first, ...second],
            `${c} column${c > 1 ? 's' : ''} + ${second.length} turned (width split)`);
        }
      }
      const rows = Math.floor((H + g) / (h1 + g));
      for (let r = 1; r <= rows; r++) {
        const used = r * h1 + (r - 1) * g;
        const first = grid(m, m, W, used, w1, h1, g, r1);
        const rest = H - used - g;
        const second = rest > 0 ? grid(m, m + used + g, W, rest, w2, h2, g, r2) : [];
        if (first.length + second.length) {
          consider([...first, ...second],
            `${r} row${r > 1 ? 's' : ''} + ${second.length} turned (height split)`);
        }
      }
    }
  }

  const perSheet = best.placements.length;
  if (!perSheet) return empty;
  const usedM2 = round((perSheet * bw * bh) / 1e6, 4);
  return {
    perSheet, layout: best.layout, placements: best.placements,
    rotatedCount: best.placements.filter((p) => p.rot).length,
    sheetM2, usedM2,
    wastePct: sheetM2 > 0 ? round(100 * (1 - usedM2 / sheetM2), 1) : 100,
    area: { w: sw, h: sh, margin: m },
  };
}

/** Board weight for one blank, in grams. gsm = grammage in g/m^2. */
export const blankWeightG = (areaM2, gsm) => round(areaM2 * gsm, 1);

/**
 * Cost per box, charged on the sheet consumed rather than the blank area,
 * because the waste is paid for too.
 */
export function costPerBox(areaM2, pricePerM2, perSheet, sheet) {
  if (!(pricePerM2 > 0)) return null;
  if (perSheet > 0 && sheet && sheet.sheetM2 > 0) {
    return round((sheet.sheetM2 * pricePerM2) / perSheet, 4);
  }
  return round(areaM2 * pricePerM2, 4);
}

/**
 * What one box costs by the time it reaches you.
 *
 * The material panel has always answered "what is the board worth?" and the
 * pack view now answers "how many travel together?". Neither is the number a
 * business decides on. Freight is charged on the load, so its share per box
 * falls as the pallet fills - which is exactly why a style that uses more board
 * can still be cheaper delivered, and why comparing styles on board alone can
 * point the wrong way.
 *
 * The freight figure is the reader's. There is no table of carrier rates here
 * and there should not be: rates depend on lane, volume, contract and week,
 * and a plausible invented number is worse than no number at all.
 *
 * @param {object} p  { boardPerBox, freightPerLoad, boxesPerLoad }
 * @returns {object|null} { board, freight, total } per box, or null
 */
export function deliveredCost({ boardPerBox, freightPerLoad, boxesPerLoad } = {}) {
  const board = Number.isFinite(boardPerBox) && boardPerBox >= 0 ? boardPerBox : null;
  const haveFreight = Number.isFinite(freightPerLoad) && freightPerLoad >= 0
    && Number.isFinite(boxesPerLoad) && boxesPerLoad > 0;
  if (board === null && !haveFreight) return null;
  // Full precision, deliberately. Rounding money in the model is the same
  // mistake as rounding the board area was (see E18): a freight share of
  // 0.4945 per box multiplied by a 20,000 run is a different number depending
  // on where it was rounded, and the display is the only place that knows how
  // many decimals the reader wants.
  const freight = haveFreight ? freightPerLoad / boxesPerLoad : null;
  if (board === null) return { board: null, freight, total: null };
  if (freight === null) return { board, freight: null, total: null };
  return { board, freight, total: board + freight };
}
