// A valid sample size per style. Some styles constrain the ratio between
// dimensions (a tray's walls cannot exceed half its base), and the pillow box
// reuses the Width field as its curve depth - so one size does not fit all.
//
// The caliper is NOT listed here. It used to be, and it drifted: the sleeve
// fixture said 3mm, so every generated sleeve sample was a belly band drawn in
// corrugated shipping board - the exact mistake the per-style `board` exists to
// prevent. Each style declares the board it is made from; that is the one
// source of truth, and the fixture reads it rather than restating it.
import { byId } from '../src/registry.js';

const OVERRIDES = {
  'tray-4corner':   { L: 200, W: 150, H: 45 },
  'mailer-tucktop': { L: 220, W: 160, H: 60 },
  'pillow':         { L: 90,  W: 22,  H: 120 },
  'carton-ste':     { L: 80,  W: 40,  H: 150 },
  'carton-rte':     { L: 80,  W: 40,  H: 150 },
  'telescope-lid':  { L: 200, W: 150, H: 45 },
  'hexagon':        { L: 100, W: 0,   H: 120 },
};
export const sampleFor = (id) => ({
  ...(OVERRIDES[id] ?? { L: 200, W: 150, H: 100 }),
  t: byId(id).board.caliper,
});

/** Sizes that must all succeed for a given style. */
export function sweepFor(id) {
  if (id === 'pillow') return [[60, 15, 90], [90, 22, 120], [140, 35, 200], [200, 50, 300]];
  if (id === 'hexagon') return [[50, 0, 60], [100, 0, 120], [180, 0, 200], [300, 0, 320]];
  if (id === 'telescope-lid') return [[60, 40, 15], [150, 100, 40], [300, 200, 90], [500, 400, 180]];
  if (id === 'tray-4corner' || id === 'mailer-tucktop')
    return [[60, 40, 15], [150, 100, 40], [300, 200, 90], [500, 400, 180]];
  return [[60, 40, 30], [150, 100, 80], [300, 200, 120], [500, 400, 200]];
}
