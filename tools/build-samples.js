#!/usr/bin/env node
/**
 * Regenerates the sample artifacts in ../samples.
 *
 * These files used to be produced by hand, and drifted: every sleeve sample was
 * a belly band drawn on 3 mm corrugated shipping board, because the size
 * fixture carried its own caliper and nobody reconciled it with the style. Each
 * style now declares the board it is made from, the fixture reads it, and this
 * script exists so the samples can be rebuilt from that one source instead of
 * being whatever someone exported on the day.
 *
 * The spec sheet used to be excluded because its rows were assembled inside
 * app.js from the interface. They live in src/spec.js now, so it is generated
 * from the same code the download button runs.
 *
 *   node tools/build-samples.js
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { STYLES, generate } from '../src/registry.js';
import { withAnnotations } from '../src/annotate.js';
import { toSVG } from '../src/export/svg.js';
import { toDXF } from '../src/export/dxf.js';
import { toPDF, toSpecSheet, toTiledPDF } from '../src/export/pdf.js';
import { specRows } from '../src/spec.js';
import { GUIDES } from '../src/guides.js';
import { toSheetDieline } from '../src/sheet.js';
import { sheetYield, SHEETS } from '../src/estimate.js';
import { paperById } from '../src/export/tile.js';
// The canonical per-style size. It lives under test/ because that is what needs
// it most, and is imported rather than restated so the two cannot disagree.
import { sampleFor } from '../test/samples.js';

const OUT = fileURLToPath(new URL('../../samples/', import.meta.url));
// The app's own defaults for the sheet panel.
const NEST = { gutter: 4, margin: 10, allowRotation: false };
const ANNO = { dims: true, labels: true };
const bytes = (pdf) => Buffer.from(pdf, 'latin1');

mkdirSync(OUT, { recursive: true });
let written = 0;
const skipped = [];

for (const style of STYLES) {
  const params = sampleFor(style.id);
  const dl = generate(style.id, params);
  const anno = withAnnotations(dl, style, ANNO);
  const put = (ext, data, bin) => {
    writeFileSync(OUT + style.id + '.' + ext, bin ? bytes(data) : data);
    written++;
  };

  put('svg', toSVG(anno, { includeDims: true }));
  put('dxf', toDXF(anno, { includeDims: true }));
  put('pdf', toPDF(anno, { includeDims: true }), true);

  // The sheet layout is nested on the press sheet that suits this style's own
  // board - a corrugated case does not get laid out on a B1 carton sheet.
  const sheet = SHEETS.find((s) => s.for === style.board.format) || SHEETS[0];
  const y = sheetYield(dl.bbox.w, dl.bbox.h, sheet.w, sheet.h, NEST);
  if (y.perSheet) {
    put('sheet.pdf', toPDF(toSheetDieline(dl, y, {
      grainNote: 'Board grain runs down the sheet; blanks are not turned.',
    }), { includeDims: true }), true);
  } else {
    skipped.push(`${style.id}.sheet.pdf - blank does not fit ${sheet.w}x${sheet.h} mm`);
  }

  // The spec sheet: the page a converter quotes from. Plain - no weight and no
  // pack-out, because both depend on figures the reader supplies, and a sample
  // must not look like it knows the reader's board or pallet.
  put('spec.pdf', toSpecSheet(anno, {
    rows: specRows(dl, style, { unit: 'mm', sheet, nest: NEST }),
    generated: new Date().toISOString().slice(0, 10),
    steps: (GUIDES[style.id] || {}).assembly || [],
  }), true);

  for (const id of ['a4', 'letter']) {
    try {
      put(`${id}-tiled.pdf`, toTiledPDF(anno, {
        paper: paperById(id),
        sizeLabel: `${params.L} × ${params.W} × ${params.H} mm internal`,
      }), true);
    } catch (e) {
      skipped.push(`${style.id}.${id}-tiled.pdf - ${e.message}`);
    }
  }
}

console.log(`${written} files written to samples/ from ${STYLES.length} styles`);
for (const s of skipped) console.log('  skipped: ' + s);
