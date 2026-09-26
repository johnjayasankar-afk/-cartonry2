/* Cartonry, in the Labs material.
   Glass on the bar, the side panels and the view switcher; flat glass on the
   chips. The drawing itself is never touched: a dieline has to stay exact. */
import { initLabsUI } from './labs-ui.js';

initLabsUI({
  glass: [
    { sel: 'header.site', spec: 1, lens: [13, 52, 9, 1.95], vars: { '--gl-tint': '.52', '--gl-tint-dark': '.58', '--gl-drop': '0 1px 0 rgba(28,51,38,.09)' } },
    { sel: '.panel', lens: [14, 39, 9, 1.7], vars: { '--gl-tint': '.66', '--gl-tint-dark': '.5' } },
    { sel: '.seg', spec: 1, lens: [8, 23, 4, 1.7], vars: { '--gl-tint': '.4', '--gl-tint-dark': '.45' } },
    { sel: '.chip', flat: 1, vars: { '--gl-tint': '.5', '--gl-tint-dark': '.5' } }
  ],
  headings: 'h1, .panel h2'
});
