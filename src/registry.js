import { rsc } from './styles/rsc.js';
import { fol, hsc } from './styles/slotted.js';
import { ste, rte } from './styles/carton.js';
import { sleeve, tray, mailer, pillow } from './styles/misc.js';
import { lid, hexagon } from './styles/extra.js';
import { normaliseParams, validateParams, warnings } from './model.js';
import { dim1, dim2 } from './geom.js';

export const STYLES = [rsc, hsc, fol, mailer, tray, lid, ste, rte, sleeve, hexagon, pillow];
export const byId = (id) => STYLES.find((s) => s.id === id);

/**
 * Build a dieline, or throw with readable validation errors.
 * @param {object} opts  { unit } - the unit the NOTES are written in. Geometry
 *                       is always millimetres; this only changes the prose.
 */
export function generate(styleId, rawParams, opts = {}) {
  const style = byId(styleId);
  if (!style) throw new Error(`Unknown box style: ${styleId}`);
  const p = normaliseParams(rawParams);
  const errs = validateParams(p, style);
  if (errs.length) { const e = new Error(errs[0]); e.all = errs; e.validation = true; throw e; }
  const unit = opts.unit === 'in' ? 'in' : 'mm';
  const ctx = { len: (mm) => dim1(mm, unit), len2: (a, b) => dim2(a, b, unit) };
  const dl = style.build(p, ctx);
  // Cautions ride along with the dieline: they never block, but they are always
  // computed, so no caller can forget to ask for them.
  dl.warnings = warnings(p, style, dl, ctx);
  return dl;
}

/** True when a style's L/W/H mean the box's own internal size, so styles can be compared. */
export const comparable = (style) => {
  const f = style.fields || {};
  return f.W !== null && f.L !== 'Box length' && f.L !== 'Across flats' && f.L !== 'Panel width';
};
