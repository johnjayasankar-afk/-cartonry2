// PDF export written from scratch - no libraries.
//
// Two outputs share one small PDF writer:
//   toPDF()       - the dieline alone, page sized to the drawing so it places
//                   and prints at TRUE SCALE (1 mm in the design = 1 mm on paper).
//   toSpecSheet() - an A4 landscape summary a designer can send to a converter:
//                   the drawing, scaled to fit, plus every number that matters.
import { LAYER } from '../model.js';
import { PT_PER_MM } from '../geom.js';

const RGB = {
  [LAYER.CUT]:    [0.90, 0.00, 0.49],
  [LAYER.CREASE]: [0.00, 0.56, 0.83],
  [LAYER.GUIDE]:  [0.56, 0.47, 0.78],
  [LAYER.GLUE]:   [0.00, 0.64, 0.35],
  [LAYER.DIM]:    [0.42, 0.46, 0.50],
};
const DASH = {
  [LAYER.CREASE]: '[3 2] 0',
  [LAYER.GUIDE]:  '[2 2] 0',
  [LAYER.GLUE]:   '[2 1.5] 0',
  [LAYER.DIM]:    null,
};
const ORDER = [LAYER.GUIDE, LAYER.DIM, LAYER.GLUE, LAYER.CREASE, LAYER.CUT];

const f = (v) => (Math.round(v * 1000) / 1000).toString();
const byteLen = (s) => s.length;   // emitted as latin1, so chars === bytes
/* -------------------------------------------------------------- encoding
 * The font is base-14 Helvetica declared /WinAnsiEncoding, so a byte in a
 * string literal is a WinAnsi code point, not ASCII. Everything above 0x7E was
 * previously discarded, which quietly ate the multiplication sign out of every
 * "200 x 150 x 100" on every spec sheet and turned m² into m. WinAnsi has all
 * of those characters; they just have to be written as octal escapes, because
 * a raw high byte in a PDF literal is not portable across producers.
 *
 * 0xA0-0xFF are Latin-1, so they map to themselves. 0x80-0x9F is WinAnsi's own
 * block of typographic characters and has to be spelled out.
 * -------------------------------------------------------------------- */
const WINANSI_HIGH = {
  '\u20AC': 0x80, '\u201A': 0x82, '\u0192': 0x83, '\u201E': 0x84, '\u2026': 0x85,
  '\u2020': 0x86, '\u2021': 0x87, '\u02C6': 0x88, '\u2030': 0x89, '\u0160': 0x8A,
  '\u2039': 0x8B, '\u0152': 0x8C, '\u017D': 0x8E, '\u2018': 0x91, '\u2019': 0x92,
  '\u201C': 0x93, '\u201D': 0x94, '\u2022': 0x95, '\u2013': 0x96, '\u2014': 0x97,
  '\u02DC': 0x98, '\u2122': 0x99, '\u0161': 0x9A, '\u203A': 0x9B, '\u0153': 0x9C,
  '\u017E': 0x9E, '\u0178': 0x9F,
};
/** Characters with no WinAnsi code that still have an honest plain-text stand-in. */
const FOLD_ASCII = {
  '\u2032': "'", '\u2033': '"', '\u2212': '-', '\u2264': '<=', '\u2265': '>=',
  '\u00A0': ' ', '\u2009': ' ', '\u202F': ' ',
};
const pdfStr = (s) => [...String(s)].map((ch) => {
  if (ch === '\\' || ch === '(' || ch === ')') return '\\' + ch;
  const cp = ch.codePointAt(0);
  if (cp >= 0x20 && cp <= 0x7E) return ch;
  if (FOLD_ASCII[ch]) return FOLD_ASCII[ch];
  const code = WINANSI_HIGH[ch] ?? (cp >= 0xA0 && cp <= 0xFF ? cp : null);
  return code == null ? '' : '\\' + code.toString(8).padStart(3, '0');
}).join('');

/** Width of a string in em, matching what pdfStr will actually emit. */
export const pdfTextEm = (s) => [...String(s)]
  .reduce((n, ch) => n + (FOLD_ASCII[ch] ? FOLD_ASCII[ch].length : 1), 0) * 0.5;

/* --------------------------------------------------------------- clipping
 * Segment clipping for tiled output.
 *
 * A PDF clip path (`re W n`) would hide the off-sheet part of the drawing, and
 * for a compliant viewer that is enough. It is not enough here. A tiled sheet
 * is printed, not read, and the cheap end of the print pipeline - phone viewers,
 * driver-side rasterisers, "print to fax" paths - is exactly where clip paths
 * get approximated or dropped. The RSC outline is a single closed polygon 747 mm
 * across; on a 180 mm cell, an ignored clip does not degrade gracefully, it
 * prints the whole blank shrunk into one sheet and looks plausible.
 *
 * So the geometry is cut to the cell before it is written. The clip path stays
 * as well, because two independent mechanisms failing the same way is unlikely.
 * ---------------------------------------------------------------------- */
const outcode = (x, y, r) =>
  (x < r.x0 ? 1 : 0) | (x > r.x1 ? 2 : 0) | (y < r.y0 ? 4 : 0) | (y > r.y1 ? 8 : 0);

/** Cohen-Sutherland: the part of segment a-b inside r, or null. */
function clipSeg(a, b, r) {
  let [x0, y0] = a, [x1, y1] = b;
  let c0 = outcode(x0, y0, r), c1 = outcode(x1, y1, r);
  for (let guard = 0; guard < 8; guard++) {
    if (!(c0 | c1)) return [[x0, y0], [x1, y1]];
    if (c0 & c1) return null;
    const c = c0 || c1;
    let x, y;
    if (c & 8)      { x = x0 + ((x1 - x0) * (r.y1 - y0)) / (y1 - y0); y = r.y1; }
    else if (c & 4) { x = x0 + ((x1 - x0) * (r.y0 - y0)) / (y1 - y0); y = r.y0; }
    else if (c & 2) { y = y0 + ((y1 - y0) * (r.x1 - x0)) / (x1 - x0); x = r.x1; }
    else            { y = y0 + ((y1 - y0) * (r.x0 - x0)) / (x1 - x0); x = r.x0; }
    if (c === c0) { x0 = x; y0 = y; c0 = outcode(x0, y0, r); }
    else          { x1 = x; y1 = y; c1 = outcode(x1, y1, r); }
  }
  return null;
}

/**
 * Cut a path to a rectangle, returning the open runs that survive.
 * A path entirely inside is handed back untouched, closure and all, so the
 * common case costs nothing and keeps its `h` operator.
 */
function clipPath(p, r) {
  const inside = (x, y) => !outcode(x, y, r);
  if (p.pts.every(([x, y]) => inside(x, y))) return [{ pts: p.pts, closed: p.closed }];
  const seq = p.closed ? [...p.pts, p.pts[0]] : p.pts;
  const runs = [];
  let cur = null;
  for (let i = 1; i < seq.length; i++) {
    const cl = clipSeg(seq[i - 1], seq[i], r);
    if (!cl) { cur = null; continue; }
    const [a, b] = cl;
    if (cur && Math.abs(cur[cur.length - 1][0] - a[0]) < 1e-9
            && Math.abs(cur[cur.length - 1][1] - a[1]) < 1e-9) {
      cur.push(b);
    } else {
      cur = [a, b];
      runs.push({ pts: cur, closed: false });
    }
  }
  return runs.filter((run) => run.pts.length > 1);
}

/* --------------------------------------------------------- drawing content */
/**
 * Paint a dieline into a content stream.
 * @param {object} dl    dieline
 * @param {object} t     { scale, ox, oy, clip? } - millimetres to points, the origin in
 *                       points, and optionally a rectangle in DRAWING millimetres
 *                       outside which nothing is written at all.
 * @param {number} sw    stroke width in points
 */
function drawDieline(dl, t, sw, includeDims) {
  let c = `${f(sw)} w 1 J 1 j\n`;
  const X = (mm) => t.ox + mm * t.scale;
  const Y = (mm) => t.oy + mm * t.scale;
  for (const L of ORDER) {
    if (L === LAYER.DIM && !includeDims) continue;
    const ps = dl.paths.filter((p) => p.layer === L);
    if (!ps.length) continue;
    const [r, g, b] = RGB[L];
    c += `q ${f(r)} ${f(g)} ${f(b)} RG ${DASH[L] ? DASH[L] + ' d' : '[] 0 d'}\n`;
    for (const p of ps) {
      if (p.kind === 'text') {
        // A label is placed by its anchor; half a label hanging over a seam is
        // worse than none, so it belongs to whichever sheet holds its anchor.
        if (t.clip && outcode(p.at[0], p.at[1], t.clip)) continue;
        const size = p.size * t.scale;
        // Helvetica's average advance is close enough for placement; exact
        // metrics would mean shipping a full width table for no visible gain.
        const w = p.value.length * size * 0.5;
        const dx = p.anchor === 'middle' ? -w / 2 : p.anchor === 'end' ? -w : 0;
        const th = (p.rotate * Math.PI) / 180, ct = Math.cos(th), st = Math.sin(th);
        c += `BT /F1 ${f(size)} Tf ${f(r)} ${f(g)} ${f(b)} rg\n`
           + `${f(ct)} ${f(st)} ${f(-st)} ${f(ct)} ${f(X(p.at[0]) + dx * ct)} ${f(Y(p.at[1]) + dx * st)} Tm\n`
           + `(${pdfStr(p.value)}) Tj ET\n`;
        continue;
      }
      for (const run of (t.clip ? clipPath(p, t.clip) : [p])) {
        run.pts.forEach(([x, y], i) => { c += `${f(X(x))} ${f(Y(y))} ${i ? 'l' : 'm'}\n`; });
        c += run.closed ? 'h S\n' : 'S\n';
      }
    }
    c += 'Q\n';
  }
  return c;
}

/* ------------------------------------------------------------ PDF assembly */
function document_(pages, title) {
  // Object order: 1 catalog, 2 pages, then per page (page, contents), info, font.
  const objs = [];
  const pageRefs = [];
  let next = 3;
  for (let i = 0; i < pages.length; i++) { pageRefs.push(next); next += 2; }
  const infoRef = next, fontRef = next + 1, boldRef = next + 2;

  objs.push(`<< /Type /Catalog /Pages 2 0 R >>`);
  objs.push(`<< /Type /Pages /Kids [${pageRefs.map((r) => `${r} 0 R`).join(' ')}] /Count ${pages.length} >>`);
  pages.forEach((pg, i) => {
    objs.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${f(pg.w)} ${f(pg.h)}] `
      + `/Contents ${pageRefs[i] + 1} 0 R /Resources << /Font << /F1 ${fontRef} 0 R `
      + `/F2 ${boldRef} 0 R >> >> >>`);
    objs.push(`<< /Length ${byteLen(pg.content)} >>\nstream\n${pg.content}endstream`);
  });
  objs.push(`<< /Title (${pdfStr(title)}) /Creator (Cartonry) /Producer (Cartonry dieline generator) >>`);
  objs.push(`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>`);
  // Helvetica-Bold is one of the base-14 fonts, so real bold costs nothing and
  // needs no embedding. Bold used to be faked by drawing the string twice a
  // quarter point apart, which is muddier on paper and, on screen, is a string
  // overlapping itself.
  objs.push(`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>`);

  let pdf = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
  const offsets = [];
  objs.forEach((body, i) => { offsets.push(byteLen(pdf)); pdf += `${i + 1} 0 obj\n${body}\nendobj\n`; });
  const xrefPos = byteLen(pdf);
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`
       + offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')
       + `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R /Info ${infoRef} 0 R >>\n`
       + `startxref\n${xrefPos}\n%%EOF\n`;
  return pdf;
}

/** The dieline alone, at true scale. */
export function toPDF(dl, opts = {}) {
  const margin = opts.margin ?? 10;
  const sw = (opts.strokeMm ?? 0.25) * PT_PER_MM;
  const w = (dl.bbox.w + margin * 2) * PT_PER_MM;
  const h = (dl.bbox.h + margin * 2) * PT_PER_MM;
  const t = { scale: PT_PER_MM, ox: margin * PT_PER_MM, oy: margin * PT_PER_MM };
  const title = `${dl.name} ${dl.params.L}x${dl.params.W}x${dl.params.H}mm`;
  return document_([{ w, h, content: drawDieline(dl, t, sw, opts.includeDims !== false) }], title);
}

/* ---------------------------------------------------------- the spec sheet */
const A4 = { w: 297 * PT_PER_MM, h: 210 * PT_PER_MM };   // landscape

function text(x, y, size, str, { bold = false, grey = false, anchor = 'start' } = {}) {
  const w = pdfTextEm(str) * size;
  const dx = anchor === 'end' ? -w : anchor === 'middle' ? -w / 2 : 0;
  const col = grey ? '0.42 0.46 0.50' : '0.07 0.09 0.11';
  return `BT /${bold ? 'F2' : 'F1'} ${f(size)} Tf ${col} rg `
    + `1 0 0 1 ${f(x + dx)} ${f(y)} Tm (${pdfStr(str)}) Tj ET\n`;
}

/**
 * A one-page A4 landscape summary: the drawing scaled to fit on the left, the
 * numbers on the right. This is the artefact a designer emails to a converter.
 * @param {object} opts  { rows: [label, value][], steps: string[] }
 */
export function toSpecSheet(dl, opts = {}) {
  const rows = opts.rows || [];
  const steps = opts.steps || [];
  const pad = 16 * PT_PER_MM;
  const drawW = A4.w * 0.545 - pad * 1.4, drawH = A4.h - pad * 2 - 26;
  const scale = Math.min(drawW / dl.bbox.w, drawH / dl.bbox.h) * 0.98;
  const ox = pad + (drawW - dl.bbox.w * scale) / 2;
  const oy = pad + (drawH - dl.bbox.h * scale) / 2;

  let c = '';
  // Header rule
  c += `q 0.85 0.87 0.89 RG 0.6 w ${f(pad)} ${f(A4.h - pad - 20)} m ${f(A4.w - pad)} ${f(A4.h - pad - 20)} l S Q\n`;
  c += text(pad, A4.h - pad - 12, 13, dl.name + (dl.code ? `  (${dl.code})` : ''), { bold: true });
  // The date belongs with the document's identity, not in the spec table where
  // it was the row that orphaned itself at the top of the second column.
  c += text(A4.w - pad, A4.h - pad - 12, 8.5,
    'Cartonry dieline specification' + (opts.generated ? `  ·  ${opts.generated}` : ''),
    { grey: true, anchor: 'end' });

  // Drawing, scaled to fit rather than true scale - the sheet is a summary.
  c += drawDieline(dl, { scale, ox, oy }, 0.5, true);
  c += text(pad, pad - 8, 7.5,
    'Drawing scaled to fit this sheet. Use the separate true-scale PDF for production.', { grey: true });

  /* Spec table, in two columns that flow.
   *
   * Rows used to run down one column at a fixed step from a fixed start, and
   * once the pack-out figures were added that ran off the bottom of the sheet
   * on ten of the eleven styles. Nothing clips or complains: PDF simply draws
   * text at a negative coordinate, and a spec sheet quietly missing its last
   * rows is worse than one that never carried them.
   *
   * So the column has a floor. Reach it and the next row starts at the top of
   * a second column, and the assembly steps follow wherever the rows finished.
   */
  const specX = A4.w * 0.545;                   // drawing left of here, specs right
  const specW = A4.w - pad - specX;
  const gap = 14;
  const colW = (specW - gap) / 2;
  const cols = [specX, specX + colW + gap];
  const top = A4.h - pad - 44;
  const floor = pad + 14;                       // clear of the footer line
  let col = 0, y = top;
  const room = (need) => {
    if (y - need >= floor) return true;
    if (col === 0) { col = 1; y = top; return true; }
    return false;                               // both columns full: stop, do not overdraw
  };
  const lx = () => cols[col];
  const vx = () => cols[col] + colW;

  /* Rows are laid out in GROUPS, split on the blank spacer rows the caller
   * already uses to separate them. A group that will not fit the rest of a
   * column starts the next one instead of being broken across the gap - the
   * pack-out figures ended with "Boxes per load 364" alone at the top of the
   * second column, which reads as an unrelated fact rather than the answer to
   * the five rows above it. */
  const groups = [[]];
  for (const r of rows) {
    if (r[0] === '') { if (groups[groups.length - 1].length) groups.push([]); continue; }
    groups[groups.length - 1].push(r);
  }
  const measure = (row) => {
    const [label, value] = row;
    const w = pdfTextEm(label) * 8.5 + pdfTextEm(String(value)) * 8.5 + 10;
    if (w <= colW) return 16;
    return 15 + wrap(String(value), 8.5, colW).length * 11;
  };
  for (const group of groups.filter((g) => g.length)) {
    const need = group.reduce((a, r) => a + measure(r), 0);
    if (y - need < floor && col === 0) { col = 1; y = top; }
    for (const [label, value] of group) {
      const v = String(value);
      const fits = pdfTextEm(label) * 8.5 + pdfTextEm(v) * 8.5 + 10 <= colW;
      const vlines = fits ? [v] : wrap(v, 8.5, colW);
      if (y - measure([label, value]) < floor) { if (col === 1) break; col = 1; y = top; }
      c += text(lx(), y, 8.5, label, { grey: true });
      if (fits) c += text(vx(), y, 8.5, v, { anchor: 'end' });
      else for (const ln of vlines) { y -= 11; c += text(vx(), y, 8.5, ln, { anchor: 'end' }); }
      c += `q 0.90 0.92 0.94 RG 0.4 w ${f(lx())} ${f(y - 5)} m ${f(vx())} ${f(y - 5)} l S Q\n`;
      y -= 16;
    }
    y -= 7;
  }
  if (steps.length && room(24)) {
    y -= 6;
    c += text(lx(), y, 8.5, 'Assembly', { bold: true });
    y -= 14;
    for (let i = 0; i < steps.length; i++) {
      const lines = wrap(steps[i], 7.6, colW - 14);
      if (!room(lines.length * 10 + 2)) break;
      c += text(lx(), y, 7.6, `${i + 1}.`, { grey: true });
      for (const ln of lines) { c += text(lx() + 14, y, 7.6, ln, { grey: true }); y -= 10; }
      y -= 2;
    }
  }
  c += text(A4.w * 0.545, pad - 8, 7.5,
    'Check against your converter before ordering tooling.', { grey: true });

  return document_([{ w: A4.w, h: A4.h, content: c }],
    `${dl.name} specification ${dl.params.L}x${dl.params.W}x${dl.params.H}mm`);
}

/* ------------------------------------------------------------ tiled print
 * The dieline split across sheets a desk printer can make, at true scale.
 *
 * See src/export/tile.js for why this is trim-and-butt rather than overlap.
 * Everything below is page furniture in service of two promises: that the
 * pieces go back together in exactly one way, and that the reader can prove
 * the print was not scaled without trusting us about it.
 * ---------------------------------------------------------------------- */
import { tilePlan, colName } from './tile.js';

const INK = '0.07 0.09 0.11', GREY = '0.42 0.46 0.50', FAINT = '0.72 0.75 0.78';
const TRIM_DASH = '9 3';        // long: creases are '3 2' and must not be confused with it

/** A rule, in mm on the page. */
const rule = (x1, y1, x2, y2, col = FAINT, w = 0.5, dash = null) =>
  `q ${col} RG ${f(w)} w ${dash ? `[${dash}] 0 d` : '[] 0 d'} `
  + `${f(x1 * PT_PER_MM)} ${f(y1 * PT_PER_MM)} m ${f(x2 * PT_PER_MM)} ${f(y2 * PT_PER_MM)} l S Q\n`;

const box = (x, y, w, h, col = FAINT, sw = 0.5, dash = null, fill = null) =>
  `q ${col} RG ${fill ? fill + ' rg ' : ''}${f(sw)} w ${dash ? `[${dash}] 0 d` : '[] 0 d'} `
  + `${f(x * PT_PER_MM)} ${f(y * PT_PER_MM)} ${f(w * PT_PER_MM)} ${f(h * PT_PER_MM)} re `
  + `${fill ? 'B' : 'S'} Q\n`;

/** Text positioned in mm on the page. */
const mmText = (x, y, size, str, o = {}) => text(x * PT_PER_MM, y * PT_PER_MM, size, str, o);

/**
 * A printed ruler. This is the only part of the document that can be checked
 * without believing anything we say: if the bar is not 100 mm under a real
 * ruler, the print was scaled and every other number on the sheet is wrong by
 * the same factor. It is on every page because a print job can be re-run for
 * one sheet, and that sheet is then the odd one out.
 */
function scaleBar(x, y) {
  let c = '';
  const len = 100;
  c += rule(x, y, x + len, y, INK, 0.7);
  for (let i = 0; i <= len; i += 10) c += rule(x + i, y, x + i, y + (i % 50 === 0 ? 2.9 : 1.6), INK, 0.7);
  // Numbers sit BELOW the rule. Above it is the sheet label row, and a "0"
  // printed under "Sheet A1" is how the first draft of this looked.
  c += mmText(x, y - 3.2, 6.4, '0', { grey: true });
  c += mmText(x + 50, y - 3.2, 6.4, '50', { grey: true, anchor: 'middle' });
  c += mmText(x + len, y - 3.2, 6.4, '100 mm', { grey: true, anchor: 'middle' });
  return c;
}

/** A thumbnail of the sheet grid with this sheet filled - where am I in the box. */
function locator(plan, page, x, yTop, w, maxH) {
  // Cell shape follows the real grid's aspect, then the whole thing is scaled
  // to fit the space it has - a 3 x 9 tiling used to draw itself off the sheet.
  const ar = (plan.cell.h * plan.rows) / (plan.cell.w * plan.cols);
  let cw = w / plan.cols, ch = (w * ar) / plan.rows;
  if (ch * plan.rows > maxH) { const k = maxH / (ch * plan.rows); ch *= k; cw *= k; }
  const x0 = x + (w - cw * plan.cols);            // right-aligned in its slot
  let c = '';
  for (let r = 0; r < plan.rows; r++) {
    for (let cc = 0; cc < plan.cols; cc++) {
      const here = cc === page.col && r === page.row;
      c += box(x0 + cc * cw, yTop - (r + 1) * ch, cw, ch,
        here ? INK : FAINT, here ? 0.7 : 0.4, null, here ? '0.86 0.89 0.91' : null);
    }
  }
  return c;
}

function tilePageContent(dl, plan, page) {
  const { margin, bleed, footer, cell } = plan;
  const frameTop = margin + footer + bleed + cell.h;
  const frameLeft = margin + bleed;
  const topDraw = page.y + page.h;               // this cell's top edge, in drawing mm
  const X = (mm) => (frameLeft + (mm - page.x)) * PT_PER_MM;
  const Y = (mm) => (frameTop - (topDraw - mm)) * PT_PER_MM;

  let c = '';
  // Clip to the cell plus its bleed, so a neighbouring panel cannot print over
  // this sheet's footer or run into the unprintable margin.
  c += `q ${f(margin * PT_PER_MM)} ${f((frameTop - page.h - bleed) * PT_PER_MM)} `
     + `${f((page.w + 2 * bleed) * PT_PER_MM)} ${f((page.h + 2 * bleed) * PT_PER_MM)} re W n\n`;
  c += drawDieline(dl, {
    scale: PT_PER_MM, ox: X(0), oy: Y(0),
    clip: { x0: page.x - bleed, x1: page.x + page.w + bleed,
            y0: page.y - bleed, y1: page.y + page.h + bleed },
  }, 0.25 * PT_PER_MM, true);
  c += 'Q\n';

  // Trim line. Dashed, because a solid rule reads as part of the drawing and
  // someone will cut a dieline along it - but a LONG dash, because creases are
  // dashed too. On a colour screen they are grey and blue; on the mono laser
  // this sheet is going to, dash length is the only thing telling them apart,
  // and cutting a crease ruins the proof.
  c += box(frameLeft, frameTop - page.h, page.w, page.h, '0.55 0.58 0.62', 0.5, TRIM_DASH);

  // Corner crosshairs, reaching into the bleed: the cut position stays
  // unambiguous even where the dashed line runs along a panel edge.
  for (const [cx, cy] of [[frameLeft, frameTop], [frameLeft + page.w, frameTop],
                          [frameLeft, frameTop - page.h], [frameLeft + page.w, frameTop - page.h]]) {
    c += rule(cx - bleed * 0.8, cy, cx + bleed * 0.8, cy, INK, 0.5);
    c += rule(cx, cy - bleed * 0.8, cx, cy + bleed * 0.8, INK, 0.5);
  }

  // Footer. Two rows, and a right-hand slot for the locator: the sheet's
  // identity on top, the ruler beneath it, nothing sharing a baseline.
  const rowA = margin + 9.0;        // label baseline, clear of the ruler ticks
  const barY = margin + 4.4;        // ruler, with its numbers 3.2 mm beneath
  const locW = 24;
  const nb = [];
  if (page.col > 0) nb.push(`${colName(page.col - 1)}${page.row + 1} left`);
  if (page.col < plan.cols - 1) nb.push(`${colName(page.col + 1)}${page.row + 1} right`);
  if (page.row > 0) nb.push(`${colName(page.col)}${page.row} above`);
  if (page.row < plan.rows - 1) nb.push(`${colName(page.col)}${page.row + 2} below`);
  c += rule(margin, margin + footer, plan.paper.w - margin, margin + footer);
  c += mmText(margin, rowA, 9, `Sheet ${page.label}`, { bold: true });
  c += mmText(margin + 6 + pdfTextEm(`Sheet ${page.label}`) * 9 / PT_PER_MM, rowA, 7.4,
    `${page.i + 1} of ${plan.count}` + (nb.length ? `  \u00b7  joins ${nb.join(', ')}` : ''),
    { grey: true });
  c += scaleBar(margin, barY);
  // The warning wraps to whatever room is left between the ruler and the
  // locator, so it fits portrait A4 and uses the space on a landscape sheet.
  const warnX = margin + 112;
  const warnW = plan.paper.w - margin - locW - 4 - warnX;
  const lines = wrap('This bar must measure 100 mm (3.94 in). If it is shorter, the printer '
    + 'scaled the page: print again at 100% / Actual size.',
    6.4, Math.max(60, warnW * PT_PER_MM));
  // Two lines only: a third would land under the bottom margin.
  lines.slice(0, 2).forEach((ln, i) => { c += mmText(warnX, barY + 1.4 - i * 3.1, 6.4, ln, { grey: true }); });
  c += locator(plan, page, plan.paper.w - margin - locW, margin + footer - 2, locW, footer - 4);
  return c;
}

/** Page one: what to do with the rest of them. */
function tileMapContent(dl, plan, meta) {
  const P = plan.paper, pad = plan.margin + 4;
  let c = '';
  c += mmText(pad, P.h - pad - 6, 15, 'Print, cut and tape', { bold: true });
  c += mmText(pad, P.h - pad - 13, 8.6,
    `${dl.name} — ${meta.size} — ${plan.count} sheets of ${P.name} ${plan.orientation}`, { grey: true });
  c += rule(pad, P.h - pad - 17, P.w - pad, P.h - pad - 17);

  const steps = [
    'Print every sheet at 100%. In the print dialog turn OFF "fit to page", "shrink oversized pages" and any scaling. Choose Actual size.',
    'Check the 100 mm bar on any sheet against a ruler before cutting. If it is short, the print scaled: fix the setting and print again.',
    'Cut each sheet along the long-dashed grey frame, on all four sides. The short blue '
      + 'dashes inside it are creases - do not cut those.',
    'Lay the sheets out in the grid below and butt the cut edges together - do not overlap them. Tape on the back.',
    'On the assembled sheet the magenta line is the knife line and the blue dashes are creases. '
      + 'Score the creases with a blunt point, then fold away from the score.',
  ];
  let y = P.h - pad - 26;
  for (let i = 0; i < steps.length; i++) {
    c += mmText(pad, y, 8.6, `${i + 1}`, { bold: true });
    for (const ln of wrap(steps[i], 8.6, (P.w - pad * 2 - 8) * PT_PER_MM)) {
      c += mmText(pad + 6, y, 8.6, ln); y -= 4.6;
    }
    y -= 2.6;
  }

  // The grid, drawn over the real outline so the sheets can be matched to it.
  y -= 4;
  const mapW = P.w - pad * 2, mapH = y - pad - 16;
  const s = Math.min(mapW / plan.drawing.w, mapH / plan.drawing.h);
  const mx = pad + (mapW - plan.drawing.w * s) / 2;
  const my = pad + 16 + (mapH - plan.drawing.h * s) / 2;
  // Dimensions ON: the tiles carry them, and a map that omits them makes the
  // grid look oversized against a drawing that is actually smaller than it.
  c += drawDieline(dl, { scale: s * PT_PER_MM, ox: mx * PT_PER_MM, oy: my * PT_PER_MM }, 0.4, true);
  for (const pg of plan.pages) {
    c += box(mx + pg.x * s, my + pg.y * s, pg.w * s, pg.h * s, '0.55 0.58 0.62', 0.5, TRIM_DASH);
  }
  // Labels last, over a knocked-out patch: a cell label landing on a cut line
  // is unreadable exactly when it matters, which is while sorting the sheets.
  for (const pg of plan.pages) {
    const cx = mx + (pg.x + pg.w / 2) * s, cy = my + (pg.y + pg.h / 2) * s;
    const lw = pdfTextEm(pg.label) * 11 / PT_PER_MM + 3;
    c += `q 1 1 1 rg ${f((cx - lw / 2) * PT_PER_MM)} ${f((cy - 2.6) * PT_PER_MM)} `
       + `${f(lw * PT_PER_MM)} ${f(8 * PT_PER_MM)} re f Q\n`;
    c += mmText(cx, cy, 11, pg.label, { anchor: 'middle', grey: true });
  }
  c += mmText(pad, pad + 8, 7.6,
    `Assembled, the blank is ${meta.blank}. Cartonry is a drafting tool: check a folded proof `
    + 'against your product, and your converter, before ordering tooling.', { grey: true });
  return c;
}

/**
 * Break a string to fit `maxPt` at `size`, measured with the same metric
 * text() uses to place it - so a line that this says fits, fits.
 */
function wrap(str, size, maxPt) {
  const out = [];
  let cur = '';
  for (const w of String(str).split(' ')) {
    const t = cur ? `${cur} ${w}` : w;
    if (pdfTextEm(t) * size > maxPt && cur) { out.push(cur); cur = w; } else cur = t;
  }
  if (cur) out.push(cur);
  return out;
}

/**
 * The dieline tiled across desk-printer sheets, at true scale.
 * @param {object} dl    dieline
 * @param {object} opts  { paper, margin, bleed, orientation, meta }
 * @returns {string} PDF bytes as a latin1 string, or throws if it cannot tile
 */
export function toTiledPDF(dl, opts = {}) {
  const paper = opts.paper || { id: 'a4', name: 'A4', w: 210, h: 297 };
  const plan = tilePlan(dl.bbox.w, dl.bbox.h, paper, opts);
  if (!plan) throw new Error('This drawing cannot be tiled onto that paper.');
  const meta = {
    size: opts.sizeLabel || `${dl.params.L} × ${dl.params.W} × ${dl.params.H} mm internal`,
    // The CUT blank, not the annotated extent. Annotations live outside the
    // knife line, and quoting their bounding box overstates the board by the
    // width of the dimension lettering.
    blank: (() => { const b = dl.blankBbox || dl.bbox;
      return `${Math.round(b.w)} × ${Math.round(b.h)} mm`; })(),
  };
  const W = plan.paper.w * PT_PER_MM, H = plan.paper.h * PT_PER_MM;
  const pages = [{ w: W, h: H, content: tileMapContent(dl, plan, meta) }];
  for (const pg of plan.pages) pages.push({ w: W, h: H, content: tilePageContent(dl, plan, pg) });
  return document_(pages, `${dl.name} tiled for ${paper.name} — ${meta.size}`);
}
