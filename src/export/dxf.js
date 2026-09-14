// DXF export, AutoCAD R12 (AC1009) - the most widely readable flavour for
// die makers, plasma/laser CAM and older CAD. Polylines are emitted as
// POLYLINE/VERTEX/SEQEND rather than LWPOLYLINE, which R12 does not support.
import { LAYER } from '../model.js';

const DXF_LAYER = {
  [LAYER.CUT]:    { name: 'CUT',    color: 6 },   // magenta
  [LAYER.CREASE]: { name: 'CREASE', color: 5 },   // blue
  [LAYER.GUIDE]:  { name: 'GUIDE',  color: 8 },   // grey
  [LAYER.GLUE]:   { name: 'GLUE',   color: 3 },   // green
  [LAYER.DIM]:    { name: 'DIMS',   color: 9 },
};

const g = (code, val) => `${code}\n${val}\n`;
const n = (v) => (Math.round(v * 1e4) / 1e4).toFixed(4);

export function toDXF(dl, opts = {}) {
  const layers = [...new Set(dl.paths.map((p) => p.layer))]
    .filter((L) => opts.includeDims || L !== LAYER.DIM);
  const { minX, minY, maxX, maxY } = dl.bbox;

  let s = '';
  // ---- HEADER ----
  s += g(0, 'SECTION') + g(2, 'HEADER');
  s += g(9, '$ACADVER') + g(1, 'AC1009');
  s += g(9, '$INSUNITS') + g(70, 4);                       // 4 = millimetres
  s += g(9, '$EXTMIN') + g(10, n(minX)) + g(20, n(minY)) + g(30, '0.0000');
  s += g(9, '$EXTMAX') + g(10, n(maxX)) + g(20, n(maxY)) + g(30, '0.0000');
  s += g(0, 'ENDSEC');

  // ---- TABLES: layer definitions ----
  s += g(0, 'SECTION') + g(2, 'TABLES') + g(0, 'TABLE') + g(2, 'LAYER') + g(70, layers.length);
  for (const L of layers) {
    const d = DXF_LAYER[L];
    s += g(0, 'LAYER') + g(2, d.name) + g(70, 0) + g(62, d.color) + g(6, 'CONTINUOUS');
  }
  s += g(0, 'ENDTAB') + g(0, 'ENDSEC');

  // ---- ENTITIES ----
  s += g(0, 'SECTION') + g(2, 'ENTITIES');
  for (const p of dl.paths) {
    if (!layers.includes(p.layer)) continue;
    const ln = DXF_LAYER[p.layer].name;
    if (p.kind === 'text') {
      // R12 TEXT: 72 = horizontal justification (0 left, 1 centre, 2 right).
      const just = p.anchor === 'middle' ? 1 : p.anchor === 'end' ? 2 : 0;
      s += g(0, 'TEXT') + g(8, ln)
         + g(10, n(p.at[0])) + g(20, n(p.at[1])) + g(30, '0.0000')
         + g(40, n(p.size)) + g(1, p.value) + g(50, n(p.rotate));
      if (just) s += g(72, just) + g(11, n(p.at[0])) + g(21, n(p.at[1])) + g(31, '0.0000');
      continue;
    }
    s += g(0, 'POLYLINE') + g(8, ln) + g(66, 1) + g(70, p.closed ? 1 : 0)
       + g(10, '0.0000') + g(20, '0.0000') + g(30, '0.0000');
    for (const [x, y] of p.pts) {
      s += g(0, 'VERTEX') + g(8, ln) + g(10, n(x)) + g(20, n(y)) + g(30, '0.0000');
    }
    s += g(0, 'SEQEND') + g(8, ln);
  }
  s += g(0, 'ENDSEC') + g(0, 'EOF');
  return s;
}
