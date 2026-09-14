import { test, assert, near } from './harness.js';
import { tilePlan, PAPERS, paperById, colName, TILE_DEFAULTS } from '../src/export/tile.js';
import { toTiledPDF } from '../src/export/pdf.js';
import { generate, STYLES } from '../src/registry.js';
import { PT_PER_MM } from '../src/geom.js';
import { sampleFor } from './samples.js';

const A4 = paperById('a4');
const dl = generate('rsc-0201', { L: 200, W: 150, H: 100, t: 3 });

/* ------------------------------------------------------------ the plan */

test('tile: the flagship box really does need tiling on A4', () => {
  // The premise of the whole feature. If this ever stops being true the
  // feature is dead weight and should be reconsidered, not quietly kept.
  assert(dl.bbox.w > 210 || dl.bbox.h > 297,
    `a ${dl.bbox.w}x${dl.bbox.h} blank would fit A4 after all`);
});

test('tile: cells tile the drawing with no gap and no overlap', () => {
  for (const st of STYLES) {
    const d = generate(st.id, sampleFor(st.id));
    const p = tilePlan(d.bbox.w, d.bbox.h, A4);
    // Rows are laid top-down and columns left-to-right; abutting is exact,
    // because a butt joint is the whole reason the scheme works.
    for (const pg of p.pages) {
      near(pg.x, pg.col * p.cell.w, 1e-9, `${st.id} column ${pg.col} start`);
      const top = pg.y + pg.h;
      near(top, d.bbox.h - pg.row * p.cell.h, 1e-6, `${st.id} row ${pg.row} top`);
    }
    // Union covers the drawing exactly: last column ends at the right edge.
    const right = Math.max(...p.pages.map((g) => g.x + g.w));
    const bottom = Math.min(...p.pages.map((g) => g.y));
    near(right, d.bbox.w, 1e-6, `${st.id} right edge covered`);
    near(bottom, 0, 1e-6, `${st.id} bottom edge covered`);
  }
});

test('tile: every cell plus its bleed and footer fits the sheet exactly', () => {
  for (const paper of PAPERS) {
    const p = tilePlan(dl.bbox.w, dl.bbox.h, paper);
    near(p.cell.w + 2 * p.bleed + 2 * p.margin, p.paper.w, 1e-9, `${paper.id} width`);
    near(p.cell.h + 2 * p.bleed + 2 * p.margin + p.footer, p.paper.h, 1e-9, `${paper.id} height`);
  }
});

test('tile: no cell claims drawing beyond the blank', () => {
  const p = tilePlan(dl.bbox.w, dl.bbox.h, A4);
  for (const pg of p.pages) {
    assert(pg.x >= -1e-9 && pg.y >= -1e-9, 'cell starts outside the drawing');
    assert(pg.x + pg.w <= dl.bbox.w + 1e-6, 'cell runs past the right edge');
    assert(pg.y + pg.h <= dl.bbox.h + 1e-6, 'cell runs past the top edge');
    assert(pg.w > 0 && pg.h > 0, 'empty cell emitted');
  }
});

test('tile: orientation is chosen for the fewest sheets, not guessed', () => {
  for (const st of STYLES) {
    const d = generate(st.id, sampleFor(st.id));
    const auto = tilePlan(d.bbox.w, d.bbox.h, A4);
    const port = tilePlan(d.bbox.w, d.bbox.h, A4, { orientation: 'portrait' });
    const land = tilePlan(d.bbox.w, d.bbox.h, A4, { orientation: 'landscape' });
    assert(auto.count <= Math.min(port.count, land.count),
      `${st.id}: auto took ${auto.count}, best was ${Math.min(port.count, land.count)}`);
  }
});

test('tile: the orientation choice is real, not a constant', () => {
  // The general test above proves auto never loses. This proves it is actually
  // choosing: there is a size where each orientation wins. Without it, a tiler
  // hardwired to portrait would pass every other test in this file.
  const wins = { portrait: 0, landscape: 0 };
  for (const [w, h] of [[747, 253], [340, 700], [500, 500], [900, 200], [200, 900]]) {
    const p = tilePlan(w, h, A4);
    const other = tilePlan(w, h, A4,
      { orientation: p.orientation === 'portrait' ? 'landscape' : 'portrait' });
    if (p.count < other.count) wins[p.orientation]++;
  }
  assert(wins.portrait > 0 && wins.landscape > 0,
    `orientation never mattered: ${JSON.stringify(wins)}`);
});

test('tile: the footer band is not so tall it costs sheets', () => {
  // A 200x150x100 RSC is a 747 x 253 mm blank, and an A4 portrait cell is
  // 254 mm tall. Two millimetres of footer is the difference between five
  // sheets and ten on the box most people will generate first.
  const p = tilePlan(747, 253, A4);
  assert(p.count === 5 && p.orientation === 'portrait',
    `expected 5 portrait sheets, got ${p.count} ${p.orientation}`);
});

test('tile: cell labels are unique and read across then down', () => {
  const p = tilePlan(1400, 900, A4);
  const seen = new Set();
  p.pages.forEach((pg, i) => {
    assert(!seen.has(pg.label), `duplicate label ${pg.label}`);
    seen.add(pg.label);
    assert(pg.label === `${colName(pg.col)}${pg.row + 1}`, 'label does not match its cell');
    assert(pg.i === i, 'page index out of order');
  });
  assert(p.pages[1].row === 0, 'second page should be the next column, not the next row');
});

test('tile: bigger paper never needs more sheets', () => {
  const order = ['a4', 'letter', 'legal', 'a3', 'tabloid'];
  const counts = order.map((id) => tilePlan(747, 403, paperById(id)).count);
  assert(counts[3] <= counts[0], `A3 (${counts[3]}) should not beat A4 (${counts[0]})`);
  assert(counts[4] <= counts[1], `Tabloid (${counts[4]}) should not beat Letter (${counts[1]})`);
});

test('tile: degenerate input is refused rather than guessed at', () => {
  assert(tilePlan(0, 100, A4) === null, 'zero width should not tile');
  assert(tilePlan(100, 0, A4) === null, 'zero height should not tile');
  assert(tilePlan(100, 100, null) === null, 'no paper should not tile');
  // Margins that swallow the sheet leave nothing to print on.
  assert(tilePlan(100, 100, A4, { margin: 200 }) === null, 'impossible margin should not tile');
});

test('tile: a small blank is one sheet, and knows it', () => {
  const p = tilePlan(120, 90, A4);
  assert(p.count === 1 && p.cols === 1 && p.rows === 1, `got ${p.grid}`);
  near(p.pages[0].w, 120, 1e-9); near(p.pages[0].h, 90, 1e-9);
});

test('tile: column names survive past Z', () => {
  assert(colName(0) === 'A' && colName(25) === 'Z' && colName(26) === 'AA' && colName(27) === 'AB');
});

/* ------------------------------------------------------------- the PDF */

/** Pull the content stream of each page out of a generated PDF, in order. */
function streams(pdf) {
  return [...pdf.matchAll(/stream\n([\s\S]*?)endstream/g)].map((m) => m[1]);
}
/** Every path point in a content stream, as [x, y] in points. */
function points(s) {
  return [...s.matchAll(/(-?[\d.]+) (-?[\d.]+) (m|l)\b/g)].map((m) => [+m[1], +m[2]]);
}

test('tiled PDF: one page per cell, plus the instruction sheet', () => {
  const pdf = toTiledPDF(dl, { paper: A4 });
  const plan = tilePlan(dl.bbox.w, dl.bbox.h, A4);
  assert(/^%PDF-1\.4/.test(pdf), 'not a PDF');
  assert(/%%EOF\n$/.test(pdf), 'truncated');
  const pageObjs = (pdf.match(/\/Type \/Page[^s]/g) || []).length;
  assert(pageObjs === plan.count + 1, `expected ${plan.count + 1} pages, got ${pageObjs}`);
  assert(new RegExp(`/Count ${plan.count + 1}`).test(pdf), 'page tree count disagrees');
});

test('tiled PDF: every page is the chosen paper size, to the point', () => {
  const pdf = toTiledPDF(dl, { paper: A4 });
  const plan = tilePlan(dl.bbox.w, dl.bbox.h, A4);
  const boxes = [...pdf.matchAll(/\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/g)];
  assert(boxes.length === plan.count + 1, 'a page is missing its MediaBox');
  for (const b of boxes) {
    near(+b[1], plan.paper.w * PT_PER_MM, 0.01, 'page width');
    near(+b[2], plan.paper.h * PT_PER_MM, 0.01, 'page height');
  }
});

test('tiled PDF: nothing is drawn outside the page', () => {
  // A coordinate off the MediaBox is invisible, so a placement bug would show
  // up as a mysteriously blank sheet rather than an error.
  const pdf = toTiledPDF(dl, { paper: A4 });
  const plan = tilePlan(dl.bbox.w, dl.bbox.h, A4);
  const W = plan.paper.w * PT_PER_MM, H = plan.paper.h * PT_PER_MM;
  streams(pdf).forEach((s, i) => {
    for (const [x, y] of points(s)) {
      assert(x >= -0.5 && x <= W + 0.5 && y >= -0.5 && y <= H + 0.5,
        `page ${i}: point ${x},${y} is off a ${W.toFixed(0)}x${H.toFixed(0)}pt page`);
    }
  });
});

test('tiled PDF: the scale bar is exactly 100 mm of PDF user space', () => {
  // The one claim on the sheet a reader can check with a ruler. If this drifts,
  // the instruction "if the bar is not 100 mm the printer scaled it" is a lie.
  const pdf = toTiledPDF(dl, { paper: A4 });
  const s = streams(pdf)[1];                       // first tile page
  const segs = [...s.matchAll(/([\d.]+) ([\d.]+) m ([\d.]+) ([\d.]+) l S Q/g)]
    .map((m) => ({ x0: +m[1], y0: +m[2], x1: +m[3], y1: +m[4] }))
    .filter((g) => Math.abs(g.y1 - g.y0) < 1e-9);
  // Coordinates are written to 0.001 pt, which is 0.00035 mm - four orders of
  // magnitude finer than a laser printer's dot. Assert to the precision that
  // actually reaches paper, not to the precision of the float.
  const bars = segs.filter((g) => Math.abs(g.x1 - g.x0 - 100 * PT_PER_MM) < 0.01);
  assert(bars.length === 1, `expected exactly one 100 mm rule, found ${bars.length}`);
  // ...and nothing else on the sheet is nearly-but-not-quite 100 mm, which
  // would be the confusing failure: a reader measuring the wrong line.
  const decoys = segs.filter((g) => {
    const L = Math.abs(g.x1 - g.x0) / PT_PER_MM;
    return L > 80 && L < 120 && Math.abs(L - 100) > 0.01;
  });
  assert(decoys.length === 0, `${decoys.length} rules could be mistaken for the scale bar`);
});

test('tiled PDF: reassembling the tiles reproduces the drawing exactly', () => {
  // The strongest check available: read the points back out of each page,
  // undo that page's placement, and confirm the union is the original blank.
  // An offset error on any tile - the failure that makes a taped-up sheet a
  // millimetre wrong - shows up here and nowhere else.
  for (const id of ['rsc-0201', 'mailer-tucktop', 'carton-ste']) {
    const d = generate(id, sampleFor(id));
    const plan = tilePlan(d.bbox.w, d.bbox.h, A4);
    const pdf = toTiledPDF(d, { paper: A4 });
    const st = streams(pdf);
    const source = [];
    for (const p of d.paths) if (p.kind !== 'text') for (const q of p.pts) source.push(q);

    const covered = new Set();
    plan.pages.forEach((pg, k) => {
      const frameTop = plan.margin + plan.footer + plan.bleed + plan.cell.h;
      const frameLeft = plan.margin + plan.bleed;
      const topDraw = pg.y + pg.h;
      // Inverse of the transform the exporter applied.
      const back = ([x, y]) => [x / PT_PER_MM - frameLeft + pg.x,
                                y / PT_PER_MM - frameTop + topDraw];
      for (const pt of points(st[k + 1])) {
        const [dx, dy] = back(pt);
        // Only points inside this cell are this page's responsibility; the
        // bleed and the page furniture map outside it and are ignored.
        // The round trip through 3-decimal points costs ~3e-5 mm, and a
        // vertex on a cell boundary is the commonest case there is.
        if (dx < pg.x - 0.02 || dx > pg.x + pg.w + 0.02) continue;
        if (dy < pg.y - 0.02 || dy > pg.y + pg.h + 0.02) continue;
        for (let s2 = 0; s2 < source.length; s2++) {
          if (Math.abs(source[s2][0] - dx) < 0.02 && Math.abs(source[s2][1] - dy) < 0.02) {
            covered.add(s2);
          }
        }
      }
    });
    // Every vertex of the real drawing must land on some sheet, in the right place.
    const missing = source.filter((_, i) => !covered.has(i));
    assert(missing.length === 0,
      `${id}: ${missing.length} of ${source.length} vertices never appeared on a sheet `
      + `(first: ${missing[0]})`);
  }
});

test('tiled PDF: adjacent sheets share their seam, so a cut cannot lose a line', () => {
  const d = generate('rsc-0201', { L: 200, W: 150, H: 100, t: 3 });
  const plan = tilePlan(d.bbox.w, d.bbox.h, A4);
  assert(plan.cols > 1, 'need a multi-column plan for this test');
  const pdf = toTiledPDF(d, { paper: A4 });
  const st = streams(pdf);
  // A point one bleed-width past the seam must be drawn on BOTH sheets.
  const seam = plan.cell.w;
  const inA = points(st[1]).map(([x]) => x / PT_PER_MM - plan.margin - plan.bleed);
  assert(Math.max(...inA) > seam + plan.bleed * 0.5,
    'the first sheet stops at the seam - there is no bleed to cut through');
});

test('tiled PDF: works for every style on every paper without throwing', () => {
  for (const st of STYLES) {
    const d = generate(st.id, sampleFor(st.id));
    for (const paper of PAPERS) {
      const pdf = toTiledPDF(d, { paper });
      assert(pdf.length > 1000, `${st.id} on ${paper.id} produced nothing`);
      assert(/%%EOF\n$/.test(pdf), `${st.id} on ${paper.id} truncated`);
    }
  }
});

test('tiled PDF: xref offsets point at real objects', () => {
  // Hand-written xref tables are exactly where a PDF written from scratch goes
  // wrong, and a viewer will often repair it silently rather than complain.
  const pdf = toTiledPDF(dl, { paper: A4 });
  const start = +/startxref\n(\d+)/.exec(pdf)[1];
  assert(pdf.slice(start, start + 4) === 'xref', 'startxref does not point at the table');
  const table = /xref\n0 (\d+)\n([\s\S]*?)trailer/.exec(pdf);
  const rows = table[2].trim().split('\n').slice(1);
  rows.forEach((r, i) => {
    const off = +r.slice(0, 10);
    assert(pdf.startsWith(`${i + 1} 0 obj`, off), `object ${i + 1} is not at offset ${off}`);
  });
});

test('tiled PDF: no line of page furniture runs past the right margin', () => {
  // The warning beside the ruler wraps to the room between the ruler and the
  // locator. On A4 portrait that room is 60 mm, on A4 landscape 147, and text
  // that overflows a PDF page is not clipped - it just prints into the margin
  // and off the paper, silently.
  for (const paper of PAPERS) {
    const plan = tilePlan(dl.bbox.w, dl.bbox.h, paper);
    const pdf = toTiledPDF(dl, { paper });
    const right = (plan.paper.w - plan.margin) * PT_PER_MM;
    for (const st of streams(pdf).slice(1)) {
      for (const m of st.matchAll(/BT \/F1 ([\d.]+) Tf [\d. ]+ rg 1 0 0 1 ([\d.]+) ([\d.]+) Tm \(([^)]*)\) Tj/g)) {
        const size = +m[1], x = +m[2], body = m[4];
        // Rough Helvetica advance; the point is gross overflow, not kerning.
        const end = x + body.replace(/\\\d{3}/g, 'x').length * size * 0.52;
        assert(end <= right + 6,
          `${paper.id}: "${body.slice(0, 28)}" ends at ${end.toFixed(0)}pt, margin is ${right.toFixed(0)}pt`);
      }
    }
  }
});
