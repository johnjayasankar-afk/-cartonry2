import { STYLES, byId, generate, comparable } from './src/registry.js';
import { toSVG, gridStep } from './src/export/svg.js';
import { toDXF } from './src/export/dxf.js';
import { toPDF, toSpecSheet, toTiledPDF } from './src/export/pdf.js';
import { PAPERS, paperById, tilePlan, toTileSVG } from './src/export/tile.js';
import { toMm, fromMm, parseLength, convertShown, dim, dim1, dim2, dim3, unitLabel,
         area1, areaLabel, toArea, fromArea } from './src/geom.js';
import { foldNet, externalSize, externalFor } from './src/fold.js';
import { toSVG3D } from './src/render3d.js';
import { internalForProduct } from './src/model.js';
import { withAnnotations } from './src/annotate.js';
import { SHEETS, sheetLabel, sheetYield, blankWeightG, costPerBox, deliveredCost }
  from './src/estimate.js';
import { toSheetSVG, toSheetDieline } from './src/sheet.js';
import { specRows as buildSpecRows, externalOf } from './src/spec.js';
import { regionsOf, partsOf } from './src/regions.js';
import { GUIDES } from './src/guides.js';
import { CONFIG } from './src/config.js';
import { CONTAINERS, containerById, packInto, toLayerSVG, toStackSVG } from './src/pack.js';
import * as Licence from './src/license.js';

const $ = (id) => document.getElementById(id);

// Each style declares what its dimension fields mean; a null hides the field
// entirely, so a hexagon never shows a Width box it does not use.
const DEFAULT_FIELDS = { L: 'Length', W: 'Width', H: 'Height' };
const fieldsFor = (id) => ({ ...DEFAULT_FIELDS, ...(byId(id).fields || {}) });
/**
 * A representative size for the styles whose proportions are constrained - a
 * tray's walls cannot exceed half its base, a hexagon has no width. The BOARD
 * is no longer here: which board a style is cut from is a fact about the style
 * and now lives in the style, where its own warn() rules can be checked
 * against it. This map used to carry it for seven of eleven styles, so
 * choosing a shipping case straight after a carton left the case in 350 micron
 * card - a 747mm blank in something like a greetings card.
 */
const DEFAULTS = {
  hexagon: { L: 100, W: 0, H: 120 },
  'telescope-lid': { L: 200, W: 150, H: 45 },
  pillow: { L: 90, W: 22, H: 120 },
  'carton-ste': { L: 80, W: 40, H: 150 },
  'carton-rte': { L: 80, W: 40, H: 150 },
  'tray-4corner': { L: 200, W: 150, H: 45 },
  'mailer-tucktop': { L: 220, W: 160, H: 60 },
};

/** Put the board select on a caliper, choosing Custom if it is not a preset. */
function setBoard(caliper) {
  const opt = [...$('boardSel').options].find((o) => parseFloat(o.value) === caliper);
  if (opt) { $('boardSel').value = opt.value; $('customTWrap').hidden = true; }
  else { $('boardSel').value = 'custom'; $('customTWrap').hidden = false; $('dimT').value = fmt(caliper); }
}

const VIEW_BUTTONS = [['viewFlat', 'flat'], ['view3d', '3d'], ['viewSheet', 'sheet'],
                      ['viewCompare', 'compare'], ['viewPack', 'pack']];

const state = {
  styleId: 'rsc-0201', unit: 'mm', licensed: false, dl: null,
  view: 'flat', foldT: 1, yaw: -34, pitch: 62, anim: null,
  anno: { dims: true, labels: true, chain: false, guides: false },
  // The dieline inspector: which part the pointer is over, and which is pinned.
  regions: [], parts: [], hoverPart: -1, pickPart: -1, partsSig: '', dragged: 0,
  zoom: 1, panX: 0, panY: 0, paper: 'a4', container: 'euro', cmpSort: 'area',
};

/* ------------------------------------------------------------- rendering */
/**
 * A tiny outline of each style for the picker. Generated once from the real
 * geometry - a thumbnail that did not match the style it labels would be worse
 * than none - at a nominal size chosen to show the style's character.
 */
const THUMB_SIZE = {
  hexagon: { L: 100, W: 0, H: 120, t: 0.5 },
  pillow: { L: 90, W: 22, H: 120, t: 0.5 },
  'carton-ste': { L: 80, W: 40, H: 150, t: 0.5 },
  'carton-rte': { L: 80, W: 40, H: 150, t: 0.5 },
  'tray-4corner': { L: 200, W: 150, H: 45, t: 1 },
  'telescope-lid': { L: 200, W: 150, H: 45, t: 1 },
  'mailer-tucktop': { L: 220, W: 160, H: 60, t: 3 },
};
const thumbCache = new Map();

function thumb(id) {
  if (thumbCache.has(id)) return thumbCache.get(id);
  let out = '';
  try {
    const d = generate(id, THUMB_SIZE[id] || { L: 200, W: 150, H: 100, t: 3 });
    const cut = d.paths.find((p) => p.layer === 'cut');
    const path = cut.pts.map(([x, y], i) =>
      `${i ? 'L' : 'M'}${Math.round(x * 10) / 10} ${Math.round((d.bbox.h - y) * 10) / 10}`).join(' ') + 'Z';
    // non-scaling-stroke means the width is in screen pixels, not drawing units,
    // so it must be a small absolute number however large the blank is.
    out = `<svg viewBox="0 0 ${d.bbox.w} ${d.bbox.h}" preserveAspectRatio="xMidYMid meet"
      aria-hidden="true" focusable="false"><path d="${path}" fill="none" stroke="currentColor"
      stroke-width="1.1" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>`;
  } catch { out = ''; }
  thumbCache.set(id, out);
  return out;
}

const LOCK_ICON = '<svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true" '
  + 'fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3.2" y="7" width="9.6" '
  + 'height="6.4" rx="1.3"/><path d="M5.6 7V5.2a2.4 2.4 0 0 1 4.8 0V7"/></svg>';

/**
 * The style picker, grouped by what the style IS.
 *
 * Eleven styles named RSC, HSC, FOL 0203, STE and RTE is an alphabet the
 * reader does not have yet. A flat list of them asks someone who wants to pack
 * a candle to already know that a candle box is a "tray". The family headings
 * are the translation, and they come from the styles' own data rather than a
 * taxonomy invented for the sidebar.
 *
 * The word "Licence" used to sit on nine of the eleven rows. It is learned
 * once and then it is nine repetitions of static down the rail, so it is now a
 * padlock - still announced to a screen reader, no longer shouting.
 */
function renderStyleList() {
  const groups = [];
  for (const s of STYLES) {
    const g = groups.find((x) => x.family === s.family);
    (g || groups[groups.push({ family: s.family, items: [] }) - 1]).items.push(s);
  }
  $('styleList').innerHTML = groups.map((g) => `
    <li class="fam-head" role="presentation">${g.family}</li>`
    + g.items.map((s) => {
      const mark = s.free ? '<span class="lock free">Free</span>'
        : (state.licensed ? '' : `<span class="lock" title="Needs a licence"
             aria-label="Needs a licence">${LOCK_ICON}</span>`);
      // A trailing acronym becomes a chip so the name fits one line. Only an
      // acronym: "(open top)" is part of the name and reads as prose, and
      // setting it in a code chip would claim it is a designation.
      const abbr = /\(([A-Z]{2,4})\)$/.exec(s.name);
      const nm = abbr ? s.name.slice(0, abbr.index).trim() : s.name;
      return `<li><button type="button" data-style="${s.id}"
        aria-current="${s.id === state.styleId}">
        <span class="thumb">${thumb(s.id)}</span>
        <span class="nm">${nm}</span>
        ${abbr ? `<span class="abbr">${abbr[1]}</span>` : ''}${mark}
      </button></li>`;
    }).join('')).join('');
  $('styleList').querySelectorAll('button').forEach((b) =>
    b.addEventListener('click', () => selectStyle(b.dataset.style)));
  updateListFade();
  // Keep the selected row in view when the list is arrived at scrolled, or
  // when the style was chosen from a link or the keyboard rather than a click.
  const cur = $('styleList').querySelector('[aria-current=true]');
  if (cur) cur.scrollIntoView({ block: 'nearest' });
}

/**
 * The capped list fades at its foot to say there is more. The fade goes when
 * there is not - a permanent gradient is decoration; one that answers a
 * question and then stops is an affordance.
 */
function updateListFade() {
  const list = $('styleList'), wrap = $('stylesWrap');
  if (!list || !wrap) return;
  const room = list.scrollHeight - list.clientHeight - list.scrollTop;
  wrap.style.setProperty('--fade', room > 4 ? '1' : '0');
}

function selectStyle(id) {
  state.styleId = id;
  // Field labels FIRST. applyFieldLabels stashes the outgoing style's value for
  // any field the incoming one hides, and that value has to be read before the
  // defaults below overwrite it - the hexagon's default width is zero, which is
  // what made the stash useless the first time round.
  applyFieldLabels(id);
  const d = DEFAULTS[id];
  if (d) {
    $('dimL').value = fmt(fromMm(d.L, state.unit));
    $('dimW').value = fmt(fromMm(d.W, state.unit));
    $('dimH').value = fmt(fromMm(d.H, state.unit));
  }
  // Every style, not the seven that happened to have an entry. Only when the
  // format actually changes: a reader who chose C-flute over B-flute for a case
  // keeps it when they look at another case, and only loses it on the way to a
  // folding carton, where it would be wrong.
  const want = byId(id).board;
  if (want && formatOf(currentCaliper()) !== want.format) setBoard(want.caliper);
  renderStyleList();
  update();
  const st = byId(id);
  if (state.view === '3d' && st.fold) { state.foldT = 0; animateFold(0, 1); }
}

const fmt = (n) => (Math.round(n * 1000) / 1000).toString();

/** The caliper the board select is currently on, in mm. */
function currentCaliper() {
  const v = $('boardSel').value;
  return v === 'custom' ? (parseFloat($('dimT').value) || 0) : parseFloat(v);
}

/**
 * Corrugated or folding board. One millimetre is the line the rest of the app
 * already draws - defaultGlueFlap() picks a 35mm manufacturer's joint above it
 * and a 10mm one below - so it is drawn once here and shared.
 */
const formatOf = (caliper) => (caliper > 1 ? 'corrugated' : 'carton');

/* ------------------------------------------------------- unit-aware fields
 * Fields holding a length the reader CHOOSES follow the unit toggle, values
 * and labels together. A box measured in inches with a gutter in millimetres
 * is not a smaller inconsistency than a box measured in inches with its blank
 * size in millimetres; it is the same one, one panel further down.
 *
 * Two fields stay metric on purpose, and say so in the interface: board
 * caliper and slot width. Board is specified in millimetres or microns by
 * every mill and converter, including in the US, and the slot IS the caliper.
 * ---------------------------------------------------------------------- */
const LENGTH_FIELDS = [
  ['packH', 'Load height'],
  ['packGap', 'Clearance'],
  ['packW', 'Width'],
  ['packD', 'Depth'],
  ['clearMm', 'Clearance each side'],
  ['optGlue', 'Glue flap'],
  ['optGap',  'Flap relief gap'],
  ['optTuck', 'Tuck depth'],
  ['sheetW',  'Sheet width'],
  ['sheetH',  'Sheet height'],
  ['gutter',  'Gutter'],
  ['trim',    'Trim'],
];

/** Read a unit-aware field as millimetres. Blank gives `fallback`. */
function lenMm(id, fallback = undefined) {
  const raw = $(id).value.trim();
  if (raw === '') return fallback;
  const v = parseLength(raw);
  return Number.isFinite(v) ? toMm(v, state.unit) : NaN;
}

/** Same, clamped to a non-negative number - for options where junk means none. */
const lenMm0 = (id) => { const v = lenMm(id, 0); return Number.isFinite(v) ? Math.max(0, v) : 0; };

/** A field that is millimetres in both modes: board caliper, and the slot cut to it. */
function mmOnly(id) {
  const raw = $(id).value.trim();
  if (raw === '') return undefined;
  const v = parseLength(raw);
  return Number.isFinite(v) ? v : NaN;
}

/**
 * Put the whole interface into a unit: labels, presets, menus and the values
 * already sitting in the boxes. `from` is null on first paint, when there is
 * nothing to convert - and NOT null when a shared link arrives already in
 * inches, where the millimetre defaults in the markup do need converting. A
 * 1200 mm sheet read as 1200 inches is a sheet forty metres wide.
 */
function applyUnitChrome(from, to) {
  retitleLengthFields(from, to);
  retitlePrice(from, to);
  renderContainerOptions();
  renderClearanceOptions();
  renderSheetOptions();
  renderPaperOptions();
  renderRecent();
}

/** Re-letter the unit-aware labels, and convert what is in the boxes. */
/**
 * The board price is quoted per unit of area, so switching units has to invert
 * the conversion: 1.20 per square metre is 0.11 per square foot, not 12.92.
 * Relabelling the number without converting it would multiply a board bill by
 * ten and never look wrong on screen.
 */
/**
 * The board price the reader typed, always expressed per SQUARE METRE.
 *
 * Everything downstream - cost per box, cost for the run - multiplies by an
 * area held in m2. Reading the field raw while it is labelled "per ft2" makes
 * every quoted cost ten times too low, and it looks entirely plausible on
 * screen. Nothing about a wrong number here announces itself.
 */
function pricePerM2() {
  const v = parseFloat($('price').value);
  if (!Number.isFinite(v)) return NaN;
  return state.unit === 'in' ? v / fromArea(1, 'in') : v;
}

function retitlePrice(from, to) {
  const lab = $('lab-price');
  if (lab) lab.innerHTML = `Board price per ${areaLabel(to)} `
    + '<span class="muted-note inline">(your currency)</span>';
  const el = $('price');
  if (!from || from === to || el.value.trim() === '') return;
  const shown = parseFloat(el.value);
  if (!Number.isFinite(shown)) return;
  // Same trick as the dimension boxes: remember the canonical figure, so that
  // toggling back and forth returns 1.20 rather than 1.19996.
  let perM2 = from === 'in' ? shown / fromArea(1, 'in') : shown;
  const kept = parseFloat(el.dataset.perM2);
  if (Number.isFinite(kept)) {
    const kShown = from === 'in' ? fromArea(kept, 'in') : kept;
    if (Math.abs(kShown - shown) < 5e-5) perM2 = kept;
  }
  el.dataset['shown_' + from] = el.value;      // keep the reader's own typing
  el.dataset.perM2 = String(perM2);
  const out = to === 'in' ? fromArea(perM2, 'in') : perM2;
  // Prefer the exact text last shown in this unit. A price typed as "1.20"
  // should come back as "1.20", not as "1.2" - it is money, and the trailing
  // zero is part of how money is written.
  const prior = el.dataset['shown_' + to];
  const priorPerM2 = prior === undefined ? NaN
    : (to === 'in' ? parseFloat(prior) / fromArea(1, 'in') : parseFloat(prior));
  el.value = Number.isFinite(priorPerM2) && Math.abs(priorPerM2 - perM2) < 1e-9
    ? prior : String(Math.round(out * 1e5) / 1e5);
}

function retitleLengthFields(from, to) {
  for (const [id, name] of LENGTH_FIELDS) {
    const el = $(id), lab = $('lab-' + id);
    if (lab) lab.textContent = `${name} (${to === 'in' ? 'in' : 'mm'})`;
    if (from && el.value.trim() !== '') {
      const { mm, text } = convertShown(el.value, from, to, parseFloat(el.dataset.mm));
      el.dataset.mm = String(mm);
      el.value = text;
    }
  }
}

/**
 * The clearance presets.
 *
 * These are not the same number converted. One millimetre expressed in inches
 * is 0.04", which is not a clearance anyone specifies; the nearest thing a
 * person working in inches actually asks for is a thirty-second. So each unit
 * gets the round numbers of its own system, named by the intent they serve.
 * Values are in the DISPLAY unit, and clearanceMm() converts.
 */
const CLEARANCE_PRESETS = {
  mm: [['1', 'Snug', '1 mm', 'rigid product, no padding'],
       ['3', 'Standard', '3 mm', ''],
       ['6', 'Generous', '6 mm', 'room for tissue or a card']],
  in: [['0.03125', 'Snug', '1/32″', 'rigid product, no padding'],
       ['0.125', 'Standard', '1/8″', ''],
       ['0.25', 'Generous', '1/4″', 'room for tissue or a card']],
};

function renderClearanceOptions() {
  const sel = $('clearSel');
  // Keep the reader on the preset they chose, by position rather than value -
  // the values differ between units by design.
  const wasCustom = sel.value === 'custom';
  const idx = Math.max(0, sel.selectedIndex);
  sel.innerHTML = (CLEARANCE_PRESETS[state.unit] || CLEARANCE_PRESETS.mm)
    .map(([v, name, shown, why]) =>
      `<option value="${v}">${name} — ${shown} each side${why ? ` (${why})` : ''}</option>`)
    .join('') + '<option value="custom">Custom…</option>';
  sel.selectedIndex = wasCustom ? sel.options.length - 1 : Math.min(idx, sel.options.length - 1);
}

/**
 * Lettering for the drawing itself. Same numbers as the interface, but with a
 * plain inch mark: SVG, PDF and DXF R12 can all carry a straight quote without
 * transliteration, and a dieline is read by whatever the converter happens to
 * open it in.
 */
const drawLen = (mm, u) => (u === 'in' ? `${dim(mm, u)}"` : `${dim(mm, u)} mm`);

/**
 * Tie a unit to the figure it belongs to for display.
 *
 * A value and its unit are one word typographically. Without this the title
 * block on a phone breaks "200 x 150 x 100 mm" after the last number and
 * leaves "mm" alone on a line of its own. Display only - the exporters keep
 * ordinary spaces, because a DXF or a PDF is read by software.
 */
const bindUnit = (str) => String(str).replace(/ (mm|\u2033|m\u00b2|ft\u00b2|g|kg)$/, '\u00a0$1');

/**
 * The outside of the assembled box, measured from the folded model.
 *
 * People type the inside - that is the space the product needs - but they ship
 * the outside. Carriers price on it, pallets are planned from it, and a
 * letterbox does not care about the cavity.
 *
 * It is measured rather than derived because no single formula is right for
 * every style: a closed case gains two calipers on each axis, an open tray
 * gains one and a half on its open axis, and a sleeve gains one. See
 * outerBounds() in src/fold.js.
 *
 * Returns null for a style with no fold model - the pillow box closes by
 * bending, and the 3D view already declines to guess at it.
 */
function externalMm(wanted) {
  return externalOf(state.dl, byId(state.styleId), wanted);
}

/** A style's dimensions, in the order and unit the reader is working in. */
const joinDims = (vals, u) => (u === 'in'
  ? `${vals.map((v) => dim(v, u)).join(' × ')}″`
  : `${vals.map((v) => dim(v, u)).join(' × ')} mm`);

/** Paper and sheet menus name a standard, then its size in the reader's unit. */
function renderPaperOptions() {
  const u = state.unit;
  $('paperSel').innerHTML = PAPERS.map((p) =>
    `<option value="${p.id}">${p.name} — ${dim2(p.w, p.h, u)}</option>`).join('');
  $('paperSel').value = state.paper;
}
function renderSheetOptions() {
  const u = state.unit, groups = { corrugated: 'Corrugated', carton: 'Carton board' };
  const byFor = {};
  for (const sh of SHEETS) (byFor[sh.for] ||= []).push(sh);
  const keep = $('sheetSel').value;
  $('sheetSel').innerHTML =
    Object.entries(byFor).map(([k, list]) => `<optgroup label="${groups[k] || k}">`
      + list.map((sh) =>
        `<option value="${sh.id}">${sheetLabel(sh, dim2(sh.w, sh.h, u))}</option>`)
        .join('') + '</optgroup>').join('')
    + '<option value="custom">Custom sheet…</option>';
  $('sheetSel').value = keep || 'c1200';
}

/**
 * Show only the dimension fields this style actually uses, named its way.
 *
 * A hidden field is zeroed, because the styles that hide one genuinely do not
 * have it - a hexagon has no width, it has a distance across the flats. The
 * zero has to be put back when a style that DOES use the field comes round
 * again, or picking the hexagon and then any ordinary box leaves a width of
 * zero in a box that has just been re-shown, and the tool sits in a validation
 * error the reader did nothing to cause.
 *
 * The restore only fires on the exact '0' written here, so it cannot overwrite
 * a value selectStyle() has already applied from that style's defaults.
 */
function applyFieldLabels(id) {
  const f = fieldsFor(id);
  for (const k of ['L', 'W', 'H']) {
    const el = $('dim' + k), wrap = el.parentElement;
    if (f[k] == null) {
      if (!wrap.hidden) el.dataset.kept = el.value;
      wrap.hidden = true;
      el.value = '0';
    } else {
      if (wrap.hidden && el.value === '0' && el.dataset.kept) el.value = el.dataset.kept;
      wrap.hidden = false;
      $('lab' + k).textContent = f[k];
    }
  }
  $('dimGrid').classList.toggle('two', Object.values(f).filter(Boolean).length === 2);
}

function readParams() {
  const u = state.unit;
  // A number input hands back '' for anything it cannot parse, so "12x" and an
  // empty box look identical here. Required dimensions therefore become NaN
  // (validation then names the field) rather than silently taking a default,
  // which would hand back a box that is not the size the user asked for.
  const required = (id) => {
    const raw = $(id).value;
    if (raw.trim() === '') return NaN;
    return toMm(parseLength(raw), u);      // NaN propagates to validation
  };
  // Allowances are lengths the reader chooses, so they arrive in whatever unit
  // is selected and are converted here - the geometry only ever sees mm.
  const optional = (id) => lenMm(id, undefined);
  const boardSel = $('boardSel').value;
  const t = boardSel === 'custom' ? mmOnly('dimT') : parseFloat(boardSel);
  return {
    L: required('dimL'), W: required('dimW'), H: required('dimH'),
    t: t === undefined ? NaN : t,
    glue: optional('optGlue'), slot: mmOnly('optSlot'),
    flapGap: optional('optGap'), tuck: optional('optTuck'),
  };
}

function update() {
  const style = byId(state.styleId);
  $('styleName').textContent = style.name;
  $('styleCode').hidden = !style.code;
  if (style.code) $('styleCode').textContent = style.code;

  let dl;
  try {
    // The unit reaches generate() only so the NOTES are written in it; the
    // geometry is millimetres either way, and the tests assert that.
    dl = generate(state.styleId, readParams(), { unit: state.unit });
    $('errBox').innerHTML = '';
  } catch (e) {
    state.dl = null;
    $('errBox').innerHTML = `<div class="msg err">${(e.all || [e.message]).join(' ')}</div>`;
    $('warnBox').innerHTML = '';
    $('viewport').innerHTML = '<p class="stage-empty">'
      + 'Adjust the dimensions to see the dieline.</p>';
    $('readout').innerHTML = ''; $('notes').innerHTML = '';
    setExportsEnabled(false);
    return;
  }
  state.dl = dl;
  const warns = dl.warnings || [];
  $('warnBox').innerHTML = warns.length
    ? `<div class="warns"><div class="hd">Worth checking</div><ul>`
      + warns.map((w) => `<li>${w}</li>`).join('') + '</ul></div>'
    : '';
  renderStage();

  // Every length shown anywhere goes through src/geom.js's formatter, so the
  // readout and the panels below it can never disagree about the same edge.
  // Exports keep full precision regardless of what is displayed.
  const u = state.unit;
  writeUrl();
  clearTimeout(state.recentTimer);
  state.recentTimer = setTimeout(rememberSpec, 1200);   // only remember settled edits

  // Show only the dimensions this style uses, under the name it calls them.
  const fld = fieldsFor(state.styleId);
  const used = ['L', 'W', 'H'].filter((k) => fld[k] != null).map((k) => dl.params[k]);
  const dimsLabel = fld.L === 'Box length' ? 'Covers a box' : 'Internal';
  const ext = externalMm(used);
  // Four cells, not five. Board area used to sit here as well as in the
  // material panel below, and adding "Outside" made the duplication expensive:
  // five cells left 170px each, and both dimension triples wrapped. The title
  // block carries what identifies the box; costing figures live in the panel
  // that is about cost.
  $('readout').innerHTML = `
    <div><dt>Blank size</dt><dd>${bindUnit(dim2(dl.bbox.w, dl.bbox.h, u))}</dd></div>
    <div><dt>${dimsLabel}</dt><dd>${bindUnit(joinDims(used, u))}</dd></div>
    <div><dt>Outside</dt><dd>${ext ? bindUnit(joinDims(ext, u)) : '—'}</dd>${ext ? ''
      // A tooltip is not an explanation on a touch screen. The one style this
      // applies to says why in the cell, in the same voice the 3D view uses
      // when it declines to approximate a shape that bends rather than folds.
      : '<span class="cell-why">closes by bending, so it is not measured</span>'}</div>
    <div><dt>Caliper</dt><dd>${bindUnit(fmt(dl.params.t) + ' mm')}</dd></div>`;
  // "When to use it" answers the question the reader actually has after
  // picking from a list of eleven: did I choose the right one? The text is the
  // same guidance the style's reference page carries, so there is one source
  // for it rather than a shorter, vaguer restatement written for the app.
  const guide = GUIDES[state.styleId] || {};
  updateStarterSize();
  $('notes').innerHTML = (guide.when
    ? `<p class="brief"><b>When to use it</b> ${guide.when}
       <a class="brief-more" href="box/${state.styleId}.html">Full guide<span aria-hidden="true"> \u2192</span></a></p>`
    : '')
    + '<ul>' + dl.notes.map((n) => `<li>${n}</li>`).join('') + '</ul>';
  // Show what the automatic allowances actually resolved to, so "auto" is never
  // a black box - the joint differs by an order of magnitude between formats.
  if ($('optGlue').value === '') {
    $('optGlue').placeholder = dl.panels.glueTab
      ? `auto — ${dim(dl.panels.glueTab, u)}` : 'n/a';
  }
  if ($('optSlot').value === '') $('optSlot').placeholder = `auto — ${dl.params.t}`;
  const steps = (GUIDES[state.styleId] || {}).assembly || [];
  $('assembly').hidden = !steps.length;
  $('assemblySteps').innerHTML = steps.map((t) => `<li>${t}</li>`).join('');
  renderYield();
  if ($('tileDlg').open) renderTileDialog();

  const unlocked = style.free || state.licensed;
  setExportsEnabled(unlocked);
  const sheetMode = state.view === 'sheet';
  $('dlSvg').textContent = sheetMode ? 'Sheet SVG' : 'Download SVG';
  $('dlPdf').innerHTML = sheetMode
    ? 'Sheet PDF <span class="qualifier">(true scale)</span>'
    : 'Download PDF <span class="qualifier">(true scale)</span>';
  $('dlDxf').textContent = sheetMode ? 'Sheet DXF' : 'Download DXF';
  $('exportNote').textContent = !unlocked
    ? `${style.name} needs a licence — preview is free.`
    : sheetMode ? 'Exporting the whole nested sheet.' : 'Files are generated on your device.';
}

/* ------------------------------------------------------- size from product
 * People know their product, not their box. This works the internal size out:
 * product plus the clearance they choose on each side of each axis.
 * It writes into the dimension fields rather than shadowing them, so there is
 * only ever one source of truth for the box size.
 * ---------------------------------------------------------------------- */
function clearanceMm() {
  const v = $('clearSel').value;
  return v === 'custom' ? lenMm0('clearMm') : toMm(parseFloat(v), state.unit);
}

function fitResult() {
  const u = state.unit;
  const p = ['prodL', 'prodW', 'prodH'].map((id) => {
    const raw = $(id).value.trim();
    return raw === '' ? null : toMm(parseLength(raw), u);
  });
  if (p.some((v) => v === null || !Number.isFinite(v) || v <= 0)) return null;
  const c = clearanceMm();
  return { product: p, clearance: c, box: internalForProduct(p, c) };
}

function renderFitPreview() {
  const r = fitResult();
  const el = $('fitPreview'), btn = $('applyFit');
  if (!r) {
    el.textContent = 'Enter all three product dimensions to see the box size.';
    btn.disabled = true; btn.style.opacity = 0.5; return;
  }
  btn.disabled = false; btn.style.opacity = 1;
  el.innerHTML = `Internal box size <strong class="foot-brand">`
    + `${joinDims(r.box, state.unit)}</strong> — your product plus `
    + `${dim1(r.clearance, state.unit)} on each side.`;
}

function applyFit() {
  const r = fitResult();
  if (!r) return;
  retireStarter();
  const u = state.unit;
  ['dimL', 'dimW', 'dimH'].forEach((id, i) => { $(id).value = fmt(fromMm(r.box[i], u)); });
  update();
  toast('Box sized to your product.');
}

/* ------------------------------------------------------ material & yield */
/** The nesting options the material panel is currently asking for. */
function nestOpts() {
  return {
    gutter: lenMm0('gutter'),
    margin: lenMm0('trim'),
    allowRotation: $('allowRot').checked,
  };
}

/** The current nesting result, computed from the CUT blank, not the annotations. */
function currentYield() {
  const sheet = currentSheet();
  return sheetYield(state.dl.bbox.w, state.dl.bbox.h, sheet.w, sheet.h, nestOpts());
}

function currentSheet() {
  const v = $('sheetSel').value;
  if (v === 'custom') return { std: 'Custom', w: lenMm0('sheetW'), h: lenMm0('sheetH') };
  return SHEETS.find((s) => s.id === v) || SHEETS[0];
}

function currentGsm() {
  const typed = parseFloat($('gsm').value);
  if (Number.isFinite(typed) && typed > 0) return typed;
  const opt = $('boardSel').selectedOptions[0];
  const auto = parseFloat(opt && opt.dataset.gsm);
  return Number.isFinite(auto) ? auto : null;
}

function renderYield() {
  const el = $('yieldOut');
  if (!state.dl) { el.innerHTML = ''; return; }
  const u = state.unit;
  const blank = state.dl.bbox;                       // the cut blank, not the annotations
  const sheet = currentSheet();
  const y = currentYield();
  const gsm = currentGsm();
  const price = pricePerM2();
  const cost = costPerBox(state.dl.blankAreaM2, price, y.perSheet, y);
  const qty = Math.max(0, Math.floor(parseFloat($('qty').value) || 0));

  const rows = [];
  rows.push(['Blanks per sheet', y.perSheet
    ? `${y.perSheet}`
    : '<span class="warn-inline">0 — too big</span>']);
  if (y.perSheet) rows.push(['Board wasted', `${y.wastePct}%`]);
  if (y.rotatedCount) rows.push(['Turned 90°', `${y.rotatedCount} of ${y.perSheet}`]);
  rows.push(['Board per box', area1(state.dl.blankAreaM2, u)]);
  if (gsm) rows.push(['Weight per box', `${blankWeightG(state.dl.blankAreaM2, gsm)} g`]);
  if (cost != null) rows.push(['Board cost per box', y.perSheet ? cost.toFixed(3) : '—']);
  // Delivered cost. Board is what the box is worth; freight is what it costs to
  // have it. The share falls as the load fills, which is the whole point.
  const freightPerLoad = parseFloat($('freight').value);
  const packed = currentPack().pack;
  const del = deliveredCost({
    boardPerBox: y.perSheet ? cost : NaN,
    freightPerLoad,
    boxesPerLoad: packed ? packed.total : NaN,
  });
  if (del && del.freight != null) {
    rows.push(['Freight per box', del.freight.toFixed(3)]);
    if (del.total != null) rows.push(['Delivered per box', del.total.toFixed(3)]);
  }
  if (qty > 0 && y.perSheet) {
    const sheets = Math.ceil(qty / y.perSheet);
    rows.push(['', '']);
    rows.push([`Sheets for ${qty.toLocaleString()}`, sheets.toLocaleString()]);
    rows.push(['Board for the run', area1(sheets * y.sheetM2, u, 1)]);
    if (gsm) rows.push(['Weight of the run', `${(qty * blankWeightG(state.dl.blankAreaM2, gsm) / 1000).toFixed(1)} kg`]);
    if (cost != null) rows.push(['Board cost for the run', (sheets * y.sheetM2 * price).toFixed(2)]);
  }

  el.innerHTML = `<dl>${rows.map(([k, v]) => (k === ''
      ? '<dd class="spacer"></dd><dd class="spacer"></dd>'
      : `<dt>${k}</dt><dd>${v}</dd>`)).join('')}
    <dd class="nest-note">${y.perSheet
      ? `Layout: ${y.layout} on ${dim2(sheet.w, sheet.h, u)}.`
        + (cost != null ? ' Cost charges the whole sheet, because the waste is paid for too.' : '')
        + (del && del.total != null && packed
          ? ` Freight is spread over the ${packed.total.toLocaleString()} boxes that fit one `
            + `${currentContainer().name}.` : '')
      : `A ${dim2(blank.w, blank.h, u)} blank does not fit a ${dim2(sheet.w, sheet.h, u)} sheet`
        + `${$('allowRot').checked ? '' : ', and the grain setting prevents turning it'}.`}</dd></dl>`;
  if (state.view === 'sheet' || state.view === 'compare') renderStage();
}

/**
 * The rows of the spec sheet: everything a converter would ask for, in the
 * order they would ask for it. Blank rows are spacers between groups.
 */
function specRows() {
  const { pack, container } = currentPack();
  return buildSpecRows(state.dl, byId(state.styleId), {
    unit: state.unit,
    sheet: currentSheet(),
    nest: nestOpts(),
    gsm: currentGsm(),
    pack, container,
  });
}

/** What the download buttons act on: the sheet in sheet view, else the drawing. */
function exportTarget() {
  if (state.view === 'sheet') {
    const y = currentYield();
    if (!y.perSheet) return null;
    return toSheetDieline(state.dl, y, {
      grainNote: $('allowRot').checked
        ? 'Board treated as non-directional; some blanks are turned 90 degrees.'
        : 'Board grain runs down the sheet; blanks are not turned.',
    });
  }
  return annotated();
}

/** The dieline as the customer sees and exports it, annotations included. */
function annotated() {
  if (!state.dl) return null;
  const a = state.anno;
  if (!a.dims && !a.labels && !a.guides && !a.chain) return state.dl;
  return withAnnotations(state.dl, byId(state.styleId), {
    dims: a.dims, labels: a.labels, guides: a.guides, chain: a.chain,
    fmt: (mm) => drawLen(mm, state.unit),
  });
}

/* --------------------------------------------------------------- compare
 * Same internal size, every style that means the same thing by it. Sorted by
 * board used, because that is what the question usually is: which of these is
 * cheapest to make? Styles whose dimensions mean something else - a lid sized
 * to a box, a hexagon measured across the flats - are excluded and said so,
 * rather than quietly compared against numbers that do not match.
 * ---------------------------------------------------------------------- */
function renderCompare() {
  const sheet = currentSheet(), opts = nestOpts();
  const gsm = currentGsm(), price = pricePerM2();
  const rows = [];
  const skipped = [];

  for (const st of STYLES) {
    if (!comparable(st)) { skipped.push(st.name); continue; }
    // Each style in the board it is actually made from.
    //
    // Comparing a folding carton at 3mm corrugated compares something nobody
    // would make: the tuck would not spring, the style's own caution says so,
    // and every figure below - board area, blanks per sheet, cost - is then
    // arithmetic about an imaginary object. The reader's caliper is kept for
    // styles of the same format, so a choice of C-flute over B-flute survives
    // a comparison between cases and is only substituted on the way to a
    // format where it would be wrong.
    const caliper = st.board && st.board.format !== formatOf(state.dl.params.t)
      ? st.board.caliper : state.dl.params.t;
    let dl;
    try {
      dl = generate(st.id, { ...state.dl.params, t: caliper }, { unit: state.unit });
    } catch (e) {
      rows.push({ st, error: e.message, caliper });
      continue;
    }
    const y = sheetYield(dl.bbox.w, dl.bbox.h, sheet.w, sheet.h, opts);
    const cost = costPerBox(dl.blankAreaM2, price, y.perSheet, y);
    // How many of THIS style travel together, and what one costs delivered.
    // A style that uses more board can still win once freight is counted, and
    // ranking on board alone would never show it.
    let perLoad = null;
    if (typeof st.fold === 'function') {
      try {
        const box = externalSize(st.fold(dl.params), dl.params.t);
        const c = currentContainer();
        const pk = packInto(box, { w: c.w, d: c.d, h: lenMm0('packH') },
          { gutter: lenMm0('packGap') });
        perLoad = pk ? pk.total : null;
      } catch { perLoad = null; }
    }
    const del = deliveredCost({ boardPerBox: y.perSheet ? cost : NaN,
      freightPerLoad: parseFloat($('freight').value), boxesPerLoad: perLoad });
    rows.push({ st, dl, y, cost, perLoad, caliper,
      delivered: del && del.total != null ? del.total : null,
      weight: gsm ? blankWeightG(dl.blankAreaM2, gsm) : null });
  }
  // Errored rows sink to the bottom. Two of them tie, and neither has a
  // dieline to measure, so the area comparison must not run for them.
  // Each column has a natural best: least board, least waste, most per sheet,
  // most per load, least delivered. Clicking a heading ranks by that, rather
  // than asking the reader to work out which direction they wanted.
  const RANK = {
    area:      { get: (r) => r.dl.blankAreaM2, dir: 1 },
    perSheet:  { get: (r) => r.y.perSheet, dir: -1 },
    waste:     { get: (r) => (r.y.perSheet ? r.y.wastePct : Infinity), dir: 1 },

    delivered: { get: (r) => r.delivered, dir: 1 },
  };
  const rank = RANK[state.cmpSort] || RANK.area;
  rows.sort((a, b) => {
    if (a.error && b.error) return a.st.name.localeCompare(b.st.name);
    if (a.error) return 1;
    if (b.error) return -1;
    // A style with nothing to show for this column sinks, but keeps its place
    // relative to other blanks rather than being ordered arbitrarily.
    const av = rank.get(a), bv = rank.get(b);
    const aOk = Number.isFinite(av), bOk = Number.isFinite(bv);
    if (!aOk && !bOk) return a.dl.blankAreaM2 - b.dl.blankAreaM2;
    if (!aOk) return 1;
    if (!bOk) return -1;
    return (av - bv) * rank.dir;
  });

  const areas = rows.filter((r) => !r.error).map((r) => r.dl.blankAreaM2);
  const bestArea = areas.length ? Math.min(...areas) : NaN;
  const perSheets = rows.filter((r) => !r.error && r.y.perSheet).map((r) => r.y.perSheet);
  const bestUp = perSheets.length ? Math.max(...perSheets) : 0;

  const cur = state.styleId;
  const live = rows.filter((r) => !r.error);
  const bestOf = (get, dir) => {
    const vals = live.map(get).filter(Number.isFinite);
    if (!vals.length) return NaN;
    return dir === 1 ? Math.min(...vals) : Math.max(...vals);
  };
  // How much does the pallet count actually vary between these styles? Styles
  // holding the same internal space have nearly the same OUTSIDE, so the answer
  // is usually "hardly at all" - which is why there is no per-load column: it
  // would be a column of near-identical numbers taking width from ones that
  // discriminate.
  const substituted = rows.filter((r) => r.caliper !== state.dl.params.t).map((r) => r.st.name);
  const loads = live.map((r) => r.perLoad).filter(Number.isFinite);
  const loadSpread = loads.length > 1
    ? Math.round(((Math.max(...loads) - Math.min(...loads)) / Math.max(...loads)) * 100)
    : null;
  const bestDel = bestOf((r) => r.delivered, 1);
  const bestWaste = bestOf((r) => (r.y.perSheet ? r.y.wastePct : NaN), 1);

  // Sortable headings. Each column knows which direction is better, so a click
  // means "rank by this", not "sort ascending and let me work it out".
  const moneyLabel = live.some((r) => r.delivered != null) ? 'Delivered / box'
    : (price > 0 ? 'Board / box' : (gsm ? 'Weight' : '—'));
  const cols = [
    ['', 'Style', false],
    ['', `Blank (${unitLabel(state.unit)})`, false],
    ['', 'Board', false],
    ['area', `Board ${areaLabel(state.unit)}`, true],
    ['perSheet', 'Per sheet', true],
    ['waste', 'Waste', true],
    [live.some((r) => r.delivered != null) ? 'delivered' : '', moneyLabel,
      live.some((r) => r.delivered != null)],
  ];

  const body = rows.map((r) => {
    if (r.error) {
      return `<tr data-style="${r.st.id}"><td><span class="cmp-name">
        <span class="thumb">${thumb(r.st.id)}</span>${r.st.name}</span></td>
        <td></td>
        <td class="sub">${r.caliper ? fmt(r.caliper) + ' mm' : ''}</td>
        <td colspan="${cols.length - 3}" class="bad">${r.error}</td></tr>`;
    }
    const best = (v, isBest) => `<span class="${isBest ? 'best' : ''}">${v}</span>`;
    const money = r.delivered != null ? r.delivered
      : (r.cost != null && r.y.perSheet ? r.cost : null);
    const warn = (r.dl.warnings || [])[0];
    const on = `${r.st.id === cur ? ' current' : ''}${warn ? ' warned' : ''}`;
    return `<tr data-style="${r.st.id}" class="${on.trim()}">
      <td><span class="cmp-name"><span class="thumb">${thumb(r.st.id)}</span>
        <span class="cmp-txt">${r.st.name}</span></span></td>
      <td>${dim(r.dl.bbox.w, state.unit)} × ${dim(r.dl.bbox.h, state.unit)}</td>
      <td class="${r.caliper === state.dl.params.t ? '' : 'sub'}">${fmt(r.caliper)} mm</td>
      <td>${best(area1(r.dl.blankAreaM2, state.unit).replace(/ .*/, ''),
                   r.dl.blankAreaM2 === bestArea)}</td>
      <td>${r.y.perSheet ? best(r.y.perSheet, r.y.perSheet === bestUp) : '—'}</td>
      <td>${r.y.perSheet ? best(r.y.wastePct + '%', r.y.wastePct === bestWaste) : '—'}</td>
      <td>${money != null
        ? best(money.toFixed(3), r.delivered != null && r.delivered === bestDel)
        : (r.weight != null ? r.weight + ' g' : '—')}</td>
    </tr>${warn ? `<tr data-style="${r.st.id}" class="cmp-warn-row${
      r.st.id === cur ? ' current' : ''}">
      <td colspan="${cols.length}"><span class="cmp-warn">${warn}</span></td>
    </tr>` : ''}`;
  }).join('');

  const head = cols.map(([key, label, sortable]) => {
    if (!sortable) return `<th scope="col">${label}</th>`;
    const on = state.cmpSort === key;
    return `<th scope="col" aria-sort="${on ? 'ascending' : 'none'}">
      <button type="button" class="cmp-sort${on ? ' on' : ''}" data-sort="${key}"
        aria-label="Rank the styles by ${label}">${label}</button></th>`;
  }).join('');

  $('viewport').innerHTML = `<table class="cmp">
    <thead><tr>${head}</tr></thead>
    <tbody>${body}</tbody></table>`;
  $('viewport').querySelectorAll('[data-sort]').forEach((b) =>
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      state.cmpSort = b.dataset.sort;
      renderCompare();
    }));
  $('viewport').querySelectorAll('tr[data-style]').forEach((tr) =>
    tr.addEventListener('click', () => selectStyle(tr.dataset.style)));

  const p = state.dl.params;
  $('sheetNote').innerHTML =
    `<span>At ${dim3(p.L, p.W, p.H, state.unit)} internal on `
    + `${dim2(sheet.w, sheet.h, state.unit)}.</span>`
    + (skipped.length ? `<span>Not compared: ${skipped.join(', ')} — their dimensions mean `
      + `something different, so the numbers would not line up.</span>` : '')
    // Say plainly that the boards differ, because a reader scanning board area
    // down the column is otherwise comparing 350 micron card against B-flute
    // without being told.
    + (substituted.length
      ? `<span>${substituted.join(', ')} ${substituted.length === 1 ? 'is' : 'are'} shown on
         ${substituted.length === 1 ? 'its' : 'their'} own board rather than
         ${fmt(state.dl.params.t)} mm — the format differs, and comparing them on a board
         nobody would use them in would compare nothing.</span>` : '')
    // Worth saying, because it is not obvious and it settles a real question:
    // freight is not what decides between these styles.
    + (loadSpread != null ? `<span>All of these hold the same space, so they pack within
        ${loadSpread}% of each other — ${loadSpread <= 5 ? 'freight barely separates them, and the'
        : 'the'} board is what differs.</span>` : '');
}

/* --------------------------------------------------------------- starter
 * The opening box is an example, and until this it was not labelled as one.
 * A newcomer arrived at a fully specified 200 x 150 x 100 shipping case with
 * no way to tell whether it was a default, a demonstration, or something the
 * page had somehow inferred about them.
 *
 * The note retires itself the moment it stops being true - the first edit to a
 * dimension - rather than waiting to be dismissed, and it never appears for
 * someone arriving on a shared link, because that box genuinely is theirs.
 * ---------------------------------------------------------------------- */
const SEEN_KEY = 'cartonry.started';
let starterLive = false;

function showStarter() {
  try { if (localStorage.getItem(SEEN_KEY)) return; } catch {}
  starterLive = true;
  $('starter').hidden = false;
  updateStarterSize();
}

function updateStarterSize() {
  if (!starterLive || !state.dl) return;
  const fld = fieldsFor(state.styleId);
  const used = ['L', 'W', 'H'].filter((k) => fld[k] != null).map((k) => state.dl.params[k]);
  $('starterSize').textContent = joinDims(used, state.unit);
}

/** Once the reader has made the box their own, the note is no longer true. */
function retireStarter() {
  if (!starterLive) return;
  starterLive = false;
  $('starter').hidden = true;
  try { localStorage.setItem(SEEN_KEY, '1'); } catch {}
}

/* ------------------------------------------------------------------ pack
 * How many finished boxes go in a case or on a pallet.
 *
 * This is the question that follows every box specification, and for most
 * sellers the answer moves more money than the board bill: freight is charged
 * on the space the boxes take up, not on what they are made of. It is only
 * answerable now because the outside size is measured rather than guessed.
 * ---------------------------------------------------------------------- */
function renderContainerOptions() {
  const u = state.unit, sel = $('packSel');
  const kinds = { pallet: 'Pallet footprint', case: 'Shipping case' };
  const byKind = {};
  for (const c of CONTAINERS) (byKind[c.kind] ||= []).push(c);
  const keep = sel.value;
  sel.innerHTML = Object.entries(byKind).map(([k, list]) =>
    `<optgroup label="${kinds[k] || k}">`
    + list.map((c) => `<option value="${c.id}">${c.name} — ${dim2(c.w, c.d, u)}</option>`).join('')
    + '</optgroup>').join('')
    + '<option value="custom">Custom…</option>';
  sel.value = keep || state.container;
}

function currentContainer() {
  if ($('packSel').value === 'custom') {
    return { id: 'custom', name: 'Custom', kind: 'case',
             w: lenMm0('packW'), d: lenMm0('packD') };
  }
  return containerById($('packSel').value) || CONTAINERS[0];
}

/** The arrangement for the box as it stands, or null with a reason. */
function currentPack() {
  const style = byId(state.styleId);
  if (!state.dl) return { pack: null, why: 'Nothing to pack yet.' };
  if (typeof style.fold !== 'function') {
    return { pack: null, why: `A ${style.name.toLowerCase()} closes by bending rather than `
      + 'folding, so its assembled size is not measured — and without that there is nothing '
      + 'honest to pack.' };
  }
  const p = state.dl.params;
  let box;
  try { box = externalSize(style.fold(p), p.t); } catch { box = null; }
  if (!box || !box.every(Number.isFinite)) {
    return { pack: null, why: 'The assembled size could not be measured for this box.' };
  }
  const c = currentContainer();
  const h = lenMm0('packH');
  const pack = packInto(box, { w: c.w, d: c.d, h }, { gutter: lenMm0('packGap') });
  if (!pack) {
    return { pack: null, box, container: c,
      why: `A ${dim3(box[0], box[1], box[2], state.unit)} box does not fit a `
        + `${dim2(c.w, c.d, state.unit)} footprint ${h > 0 ? `at ${dim1(h, state.unit)} high` : ''}. `
        + 'Try a larger container, or a smaller box.' };
  }
  return { pack, box, container: c };
}

function renderPack() {
  const vp = $('viewport');
  const { pack, box, container, why } = currentPack();
  if (!pack) {
    vp.innerHTML = `<p class="na3d"><strong>Nothing to pack.</strong><br>${why}</p>`;
    $('sheetNote').innerHTML = '<span>Adjust the box or the container above.</span>';
    return;
  }
  const u = state.unit;
  // Plan and elevation together: how they tile, and how high that goes.
  vp.innerHTML = `<div class="pack-wrap">
      <figure class="pack-fig"><div class="pack-svg">${toLayerSVG(pack)}</div>
        <figcaption>One layer, from above</figcaption></figure>
      <figure class="pack-fig narrow"><div class="pack-svg">${toStackSVG(pack)}</div>
        <figcaption>The stack, from the side</figcaption></figure>
    </div>`;
  // The headline is the whole point of this view, so it is set like one.
  $('sheetNote').innerHTML = `
    <span class="pack-total"><b>${pack.total.toLocaleString()}</b> boxes</span>
    <span class="pack-facts">
      <span>${pack.perLayer} per layer × ${pack.layers} layers</span>
      <span>${pack.layout}</span>
      <span>${dim1(pack.vertical, u)} standing</span>
      <span>floor ${pack.floorUsedPct}% · volume ${pack.volumeUsedPct}%</span>
      <span>${dim1(pack.headroom, u)} of the load height spare</span>
    </span>
    <span class="pack-caveat">Geometry only: identical layers, boxes square to the pallet, no
      overhang and no interlocking. It knows nothing about weight, stacking strength or which
      way up the contents must travel — and it has chosen to stand the
      ${dim1(pack.vertical, u)} dimension upright to fit more in.</span>`;
}

/* ----------------------------------------------------------------- stage */
function renderStage() {
  const dl = state.dl, vp = $('viewport'), style = byId(state.styleId);
  if (!dl) return;
  const is3d = state.view === '3d' && typeof style.fold === 'function';
  const isSheet = state.view === 'sheet';
  const isCmp = state.view === 'compare';
  const isPack = state.view === 'pack';
  vp.classList.toggle('is3d', is3d);
  vp.classList.toggle('issheet', isSheet);
  vp.classList.toggle('iscompare', isCmp);
  vp.classList.toggle('ispack', isPack);
  $('legend').hidden = is3d || isSheet || isCmp || isPack;
  $('packBar').hidden = !isPack;
  if (isPack) { $('gridKey').hidden = true; }
  const gridKey = $('gridKey');
  if (gridKey) {
    gridKey.hidden = !(state.view === 'flat');
    if (state.view === 'flat') {
      const step = gridStep(Math.max(dl.bbox.w, dl.bbox.h));
      gridKey.querySelector('span').textContent = dim1(step, state.unit) + ' grid';
    }
  }
  $('foldBar').hidden = state.view !== '3d';
  $('annoBar').hidden = state.view !== 'flat';
  renderParts();
  $('sheetNote').hidden = !(isSheet || isCmp || isPack);

  if (isPack) { renderPack(); return; }
  if (isCmp) { renderCompare(); return; }

  if (isSheet) {
    const y = currentYield();
    vp.innerHTML = y.perSheet
      ? toSheetSVG(dl, y, { grainAxis: 'y' })
      : `<p class="na3d"><strong>This blank does not fit the sheet.</strong><br>
         The blank is ${dim2(dl.bbox.w, dl.bbox.h, state.unit)} and the sheet is
         ${dim2(y.area.w, y.area.h, state.unit)}${nestOpts().margin
           ? ` less a ${dim1(nestOpts().margin, state.unit)} trim` : ''}.
         Pick a bigger sheet, or a smaller box.</p>`;
    $('sheetNote').innerHTML = y.perSheet
      ? `<span class="grainkey"><i></i>Grain / flute direction</span>
         <span>${y.layout}</span>
         <span>${$('allowRot').checked ? 'Blanks may be turned' : 'Blanks are not turned'}</span>`
      : '<span>Adjust the sheet size or the box in the Material panel.</span>';
    return;
  }

  if (state.view === '3d' && !style.fold) {
    vp.innerHTML = `<p class="na3d"><strong>No 3D preview for this style.</strong><br>
      A pillow box closes by bending its panels into a curve, not by folding flat panels
      about straight hinges. A flat-panel approximation would look convincing and be wrong,
      so we do not show one.</p>`;
    $('foldBar').hidden = true;
    return;
  }
  if (is3d) {
    const faces = foldNet(style.fold(dl.params), state.foldT);
    vp.innerHTML = `<div class="stage3d">${toSVG3D(faces, {
      yaw: state.yaw, pitch: state.pitch, size: [900, 600] })}</div>`;
  } else {
    const shown = annotated();
    // The graticule is drawn in millimetres inside the SVG, so it stays true to
    // the box at any zoom - and the legend says what one square is worth, which
    // is what turns it from a texture into something you can measure with.
    vp.innerHTML = `<div class="pan">${toSVG(shown, {
      margin: 8, strokeMm: Math.max(0.4, shown.bbox.w / 900),
      includeDims: true, grid: true })}</div>`;
    applyTransform();
    mountHits(vp, shown);
  }
}

/* ---------------------------------------------------------------------------
 * The dieline inspector.
 *
 * The drawing knew the name and size of every panel all along - `annotations()`
 * has always lettered them from the same fold net. It just had no way to hand
 * them to the interface, so the most-asked question in the Help ("which
 * dimension do I enter?") was answered by prose beside a drawing that could not
 * be interrogated. Now the schedule and the drawing point at each other.
 *
 * Colour on this drawing means layer - magenta cuts, blue creases, green glues.
 * That meaning is not for sale, so the highlight is a change of TONE, not of
 * hue: a wash of ink over the part, the way you would lay tracing paper on it.
 * ------------------------------------------------------------------------- */

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Where the blank's own corner sits inside the drawing, annotations and all. */
function cutOrigin(shown) {
  let minX = Infinity, minY = Infinity;
  for (const p of shown.paths) {
    if (p.layer !== 'cut') continue;
    for (const [x, y] of p.pts) { if (x < minX) minX = x; if (y < minY) minY = y; }
  }
  return Number.isFinite(minX) ? { x: minX, y: minY } : { x: 0, y: 0 };
}

/** Lay one transparent polygon over each named part of the blank. */
function mountHits(vp, shown) {
  const svg = vp.querySelector('svg');
  if (!svg || !state.regions.length) return;
  // The drawing group carries the y-flip; the hit layer has to share it or the
  // overlay is a mirror image of the blank.
  const groups = svg.querySelectorAll('g[transform]');
  const g = groups[groups.length - 1];
  if (!g) return;
  const o = cutOrigin(shown);
  const hit = document.createElementNS(SVG_NS, 'g');
  hit.setAttribute('class', 'hitlayer');
  hit.setAttribute('aria-hidden', 'true');
  state.regions.forEach((r, i) => {
    const poly = document.createElementNS(SVG_NS, 'polygon');
    poly.setAttribute('points',
      r.pts.map(([x, y]) => `${(x + o.x).toFixed(2)},${(y + o.y).toFixed(2)}`).join(' '));
    poly.setAttribute('class', 'hitr');
    poly.dataset.region = String(i);
    hit.appendChild(poly);
  });
  g.appendChild(hit);
  paintHits();
}

/** Which part a region belongs to, so the drawing and the schedule agree. */
const partOfRegion = (i) => {
  const id = state.regions[i] && state.regions[i].id;
  return state.parts.findIndex((p) => p.ids.includes(id));
};

function paintHits() {
  const vp = $('viewport');
  const active = state.hoverPart >= 0 ? state.hoverPart : state.pickPart;
  const ids = active >= 0 && state.parts[active] ? state.parts[active].ids : [];
  vp.querySelectorAll('.hitr').forEach((el) => {
    const r = state.regions[+el.dataset.region];
    const on = r && ids.includes(r.id);
    el.classList.toggle('on', !!on);
    el.classList.toggle('pinned', !!on && state.pickPart === active);
  });
  $('partsList').querySelectorAll('button[data-part]').forEach((b) => {
    const i = +b.dataset.part;
    b.classList.toggle('on', i === active);
    b.setAttribute('aria-pressed', String(i === state.pickPart));
  });
  vp.classList.toggle('inspecting', ids.length > 0);
}

/** The floating callout: what this part is, and how big, next to the part. */
function paintChip() {
  const vp = $('viewport');
  let chip = vp.querySelector('.partchip');
  const active = state.hoverPart >= 0 ? state.hoverPart : state.pickPart;
  const part = active >= 0 ? state.parts[active] : null;
  if (!part) { if (chip) chip.remove(); return; }
  if (!chip) {
    chip = document.createElement('div');
    chip.className = 'partchip';
    vp.appendChild(chip);
  }
  // "Glue GLUE 35 x 103 mm" - the kind tag is worth having on a Side or a Tuck,
  // and is a stutter on a part whose name already is its kind.
  const kind = part.label.toLowerCase() === part.kind ? '' : part.kind;
  chip.innerHTML = `<b>${part.label}</b>${part.count > 1
    ? `<span class="x">×${part.count}</span>` : ''}`
    + (kind ? `<span class="k">${kind}</span>` : '')
    + `<span class="d">${dim2(part.w, part.h, state.unit)}</span>`;
  // Anchored to the part it names, clamped inside the stage so it is never
  // half off the edge - the drawing can be panned anywhere.
  const target = [...vp.querySelectorAll('.hitr.on')][0];
  if (!target) { chip.style.opacity = '0'; return; }
  const t = target.getBoundingClientRect(), v = vp.getBoundingClientRect();
  const cw = chip.offsetWidth, ch = chip.offsetHeight;
  let x = t.left - v.left + t.width / 2 - cw / 2;
  let y = t.top - v.top - ch - 8;
  if (y < 6) y = t.top - v.top + t.height + 8;          // flip below if no room
  x = Math.max(6, Math.min(v.width - cw - 6, x));
  y = Math.max(6, Math.min(v.height - ch - 6, y));
  chip.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  chip.style.opacity = '1';
}

const setHoverPart = (i) => { state.hoverPart = i; paintHits(); paintChip(); };
function setPickPart(i) {
  state.pickPart = state.pickPart === i ? -1 : i;
  paintHits(); paintChip();
  const p = state.parts[state.pickPart];
  $('partsHint').textContent = p
    ? `${p.label} stays highlighted. Press it again to release.`
    : 'Point at a part to find it on the drawing.';
}

/** The schedule. Rebuilt only when the shape of the list changes, so typing a
 *  dimension does not yank focus out of the row you are on. */
function renderParts() {
  const box = $('parts'), list = $('partsList');
  const style = byId(state.styleId);
  const show = state.view === 'flat' && state.dl;
  state.regions = show ? regionsOf(state.dl, style) : [];
  state.parts = state.regions.length ? partsOf(state.regions) : [];
  box.hidden = !state.parts.length;
  if (!state.parts.length) { state.hoverPart = -1; state.pickPart = -1; return; }

  const sig = state.parts.map((p) => `${p.label}|${p.kind}|${p.count}`).join(';');
  if (sig !== state.partsSig) {
    state.partsSig = sig;
    state.hoverPart = -1; state.pickPart = -1;
    list.innerHTML = state.parts.map((p, i) => `<li><button type="button" data-part="${i}"
      aria-pressed="false">
      <span class="pk pk-${p.kind}" aria-hidden="true"></span>
      <span class="pl">${p.label}</span>
      <span class="pc">${p.count > 1 ? `×${p.count}` : ''}</span>
      <span class="pdots" aria-hidden="true"></span>
      <span class="pd"></span></button></li>`).join('');
  }
  // Sizes change with every keystroke; the rows do not.
  list.querySelectorAll('button[data-part]').forEach((b) => {
    const p = state.parts[+b.dataset.part];
    b.querySelector('.pd').textContent = dim2(p.w, p.h, state.unit);
    b.setAttribute('aria-label',
      `${p.label}, ${p.count > 1 ? p.count + ' of them, ' : ''}${p.kind}, `
      + `${dim2(p.w, p.h, state.unit)}`);
  });
  paintHits();
}

/** Hover, tap and keyboard, wired once. */
function wireInspector() {
  const vp = $('viewport'), list = $('partsList');
  vp.addEventListener('pointerover', (e) => {
    const el = e.target.closest && e.target.closest('.hitr');
    if (el) setHoverPart(partOfRegion(+el.dataset.region));
  });
  vp.addEventListener('pointerleave', () => setHoverPart(-1));
  vp.addEventListener('click', (e) => {
    // A pan ends in a click on whatever was under the finger. Panning the
    // drawing should not also pin a part.
    if (state.dragged > 4) { state.dragged = 0; return; }
    const el = e.target.closest && e.target.closest('.hitr');
    if (el) setPickPart(partOfRegion(+el.dataset.region));
  });

  list.addEventListener('pointerover', (e) => {
    const b = e.target.closest('button[data-part]');
    if (b) setHoverPart(+b.dataset.part);
  });
  list.addEventListener('pointerleave', () => setHoverPart(-1));
  list.addEventListener('focusin', (e) => {
    const b = e.target.closest('button[data-part]');
    if (b) setHoverPart(+b.dataset.part);
  });
  list.addEventListener('focusout', (e) => {
    if (!list.contains(e.relatedTarget)) setHoverPart(-1);
  });
  list.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-part]');
    if (b) setPickPart(+b.dataset.part);
  });
  // Arrow keys walk the schedule; Escape lets go.
  list.addEventListener('keydown', (e) => {
    const bs = [...list.querySelectorAll('button[data-part]')];
    const at = bs.indexOf(document.activeElement);
    if (at < 0) return;
    const to = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? at + 1
      : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? at - 1
      : e.key === 'Home' ? 0 : e.key === 'End' ? bs.length - 1 : -1;
    if (to >= 0 && to < bs.length) { e.preventDefault(); bs[to].focus(); }
    else if (e.key === 'Escape' && state.pickPart >= 0) { e.preventDefault(); setPickPart(state.pickPart); }
  });
}

function applyTransform() {
  const el = $('viewport').querySelector('.pan');
  if (!el) return;
  el.style.transform = `translate(${state.panX}px, ${state.panY}px) scale(${state.zoom})`;
  $('viewport').classList.toggle('pannable', state.zoom > 1.001);
}

function setZoom(z, recentre = false) {
  state.zoom = Math.max(1, Math.min(8, z));
  if (recentre || state.zoom === 1) { state.panX = 0; state.panY = 0; }
  applyTransform();
}

/** Animate the fold from flat to closed - it reads as an explanation, not a flourish. */
function animateFold(from = 0, to = 1, ms = 780) {
  cancelAnimationFrame(state.anim);
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    state.foldT = to; $('foldRange').value = String(Math.round(to * 100)); renderStage(); return;
  }
  const t0 = performance.now();
  const ease = (x) => 1 - Math.pow(1 - x, 3);
  const step = (now) => {
    const k = Math.min(1, (now - t0) / ms);
    state.foldT = from + (to - from) * ease(k);
    $('foldRange').value = String(Math.round(state.foldT * 100));
    renderStage();
    if (k < 1) state.anim = requestAnimationFrame(step);
  };
  state.anim = requestAnimationFrame(step);
}

function setView(v) {
  if (state.view === v) return;
  state.view = v;
  for (const [id, key] of VIEW_BUTTONS) $(id).setAttribute('aria-pressed', String(v === key));
  const style = byId(state.styleId);
  if (v === '3d' && style.fold) { state.foldT = 0; renderStage(); animateFold(0, 1); }
  else renderStage();
  update();            // export labels and the readout follow the view
  writeUrl();
}

/** Drag anywhere on the 3D stage to orbit. Pointer events cover mouse and touch. */
function wireOrbit() {
  const vp = $('viewport');
  let dragging = false, lx = 0, ly = 0;
  vp.addEventListener('pointerdown', (e) => {
    if (!vp.classList.contains('is3d')) return;
    dragging = true; lx = e.clientX; ly = e.clientY;
    vp.setPointerCapture(e.pointerId);
  });
  vp.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    state.yaw += (e.clientX - lx) * 0.55;
    state.pitch = Math.max(8, Math.min(88, state.pitch - (e.clientY - ly) * 0.4));
    lx = e.clientX; ly = e.clientY;
    renderStage();
  });
  const stop = (e) => { if (dragging) { dragging = false; try { vp.releasePointerCapture(e.pointerId); } catch {} } };
  vp.addEventListener('pointerup', stop);
  vp.addEventListener('pointercancel', stop);
}

/** Drag to pan once zoomed in; wheel with ctrl/cmd to zoom. */
function wirePan() {
  const vp = $('viewport');
  let dragging = false, lx = 0, ly = 0;
  vp.addEventListener('pointerdown', (e) => {
    if (vp.classList.contains('is3d') || state.zoom <= 1.001) return;
    dragging = true; lx = e.clientX; ly = e.clientY; state.dragged = 0;
    vp.setPointerCapture(e.pointerId);
  });
  vp.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    state.dragged += Math.abs(e.clientX - lx) + Math.abs(e.clientY - ly);
    state.panX += e.clientX - lx; state.panY += e.clientY - ly;
    lx = e.clientX; ly = e.clientY; applyTransform();
  });
  const stop = (e) => { if (dragging) { dragging = false; try { vp.releasePointerCapture(e.pointerId); } catch {} } };
  vp.addEventListener('pointerup', stop);
  vp.addEventListener('pointercancel', stop);
  vp.addEventListener('wheel', (e) => {
    if (vp.classList.contains('is3d') || !(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    setZoom(state.zoom * (e.deltaY < 0 ? 1.12 : 1 / 1.12));
  }, { passive: false });
}

function setExportsEnabled(on) {
  for (const id of ['dlSvg', 'dlPdf', 'dlDxf', 'dlSpec', 'btnTile']) {
    const b = $(id);
    b.disabled = !on || !state.dl;
    b.style.opacity = b.disabled ? 0.45 : 1;
    b.style.cursor = b.disabled ? 'not-allowed' : 'pointer';
  }
}

/* -------------------------------------------------------------- download */
function save(filename, data, mime, binary = false) {
  const blob = binary
    ? new Blob([Uint8Array.from(data, (c) => c.charCodeAt(0) & 0xff)], { type: mime })
    : new Blob([data], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click();
  a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const slug = (dl) => `${dl.id}_${Math.round(dl.params.L)}x${Math.round(dl.params.W)}x${Math.round(dl.params.H)}mm`;

function guard() {
  const style = byId(state.styleId);
  if (!state.dl) return false;
  if (!style.free && !state.licensed) {
    document.getElementById('pricing').scrollIntoView({ behavior: 'smooth' });
    return false;
  }
  return true;
}


/* --------------------------------------------------------- print at home
 * The tool's own advice is "print it at 100%, fold it, check it before you
 * order tooling", and for ten of the eleven catalogue styles at their default
 * size that is impossible: the blank is bigger than any paper a desk printer
 * takes. This is the missing half of that sentence.
 *
 * The dialog shows the grid over the reader's own blank before they commit to
 * a download, because the interesting decision - is it worth turning the
 * dimensions off to save a sheet - is one you make by looking, not by reading
 * a number.
 * ---------------------------------------------------------------------- */

/** What gets tiled: the drawing as configured, lettered for reading at 1:1. */
function tileTarget() {
  if (!state.dl) return null;
  const a = state.anno;
  if (!a.dims && !a.labels && !a.guides && !a.chain) return state.dl;
  return withAnnotations(state.dl, byId(state.styleId), {
    dims: a.dims, labels: a.labels, guides: a.guides, chain: a.chain,
    // Annotation lettering normally scales with the blank, which is right for a
    // drawing seen whole and absurd on a sheet of A4 held at arm's length.
    textMm: 4,
    fmt: (mm) => drawLen(mm, state.unit),
  });
}

function renderTileDialog() {
  const dl = tileTarget();
  const paper = paperById(state.paper) || PAPERS[0];
  const plan = dl && tilePlan(dl.bbox.w, dl.bbox.h, paper);
  const blank = state.dl ? (state.dl.blankBbox || state.dl.bbox) : null;
  if (!plan) {
    $('tilePrev').innerHTML = '';
    $('tileFacts').innerHTML = '';
    $('tileLede').textContent = 'Nothing to tile yet.';
    $('tileGo').disabled = true;
    return;
  }
  $('tileGo').disabled = false;
  $('tilePrev').innerHTML = toTileSVG(dl, plan);
  $('tileLede').innerHTML = plan.count === 1
    ? `Your blank is <strong>${dim2(blank.w, blank.h, state.unit)}</strong> and fits
       one sheet of ${paper.name}. You still get the trim frame and the 100 mm check bar, so you
       can prove the print came out at true scale before you fold anything.`
    : `Your blank is <strong>${dim2(blank.w, blank.h, state.unit)}</strong> — larger
       than a sheet of ${paper.name}. It is split across ${plan.count} sheets that you cut along
       the trim line and butt together. Cut edges butt rather than overlap, so nothing drifts
       across the joins however many there are.`;

  const rows = [
    ['Sheets to print', `${plan.count + 1}`],
    ['', `${plan.count} of the dieline, plus a map showing where each one goes`],
    ['Grid', `${plan.grid} ${plan.orientation}`],
    ['Each sheet holds', dim2(plan.cell.w, plan.cell.h, state.unit)],
  ];
  // Say what the annotations cost, in the unit that matters: sheets.
  const bare = tilePlan(state.dl.bbox.w, state.dl.bbox.h, paper);
  const extra = bare ? plan.count - bare.count : 0;
  // If another paper would save real work, say which and by how much. A box
  // big enough to need thirty sheets of A4 usually needs eight of A3, and
  // nobody wants to try all five to find that out.
  let better = '';
  if (plan.count > 6) {
    const alt = PAPERS.map((q) => ({ q, p: tilePlan(dl.bbox.w, dl.bbox.h, q) }))
      .filter((x) => x.p).sort((a, b) => a.p.count - b.p.count)[0];
    if (alt && alt.q.id !== paper.id && alt.p.count <= plan.count * 0.75) {
      better = `<dd class="wide">On ${alt.q.name} this would be ${alt.p.count} sheets
        instead of ${plan.count}.</dd>`;
    }
  }
  // And past a certain point, taping is not the answer.
  const toomany = plan.count > 40
    ? `<dd class="wide warn-inline">${plan.count} sheets is a lot of cutting and taping.
       Worth checking the dimensions are the size you meant, or printing a scaled proof
       from the spec sheet instead and folding the real thing at a copy shop.</dd>`
    : '';
  $('tileFacts').innerHTML = rows.map(([k, v]) => (k === ''
      ? `<dd class="wide sub">${v}</dd>`
      : `<dt>${k}</dt><dd>${v}</dd>`)).join('')
    + (extra > 0
      ? `<dd class="wide">${extra} of those ${extra === 1 ? 'sheets is' : 'sheets are'} taken up
         by the dimension lettering, which sits outside the knife line. Turning
         <em>Dimensions</em> off above the drawing brings it down to ${bare.count}.</dd>`
      : '')
    + better + toomany;
}

function openTileDialog() {
  if (!guard()) return;
  renderTileDialog();
  $('tileDlg').showModal();
}

function downloadTiles() {
  const dl = tileTarget();
  const paper = paperById(state.paper) || PAPERS[0];
  try {
    const pdf = toTiledPDF(dl, { paper, sizeLabel: sizeLabel() });
    save(`${slug(state.dl)}_${paper.id}_tiled.pdf`, pdf, 'application/pdf', true);
    toast('Tiled PDF saved — print at 100%, then check the 100 mm bar.');
  } catch (e) {
    toast(e.message, 'err');
  }
}

/** The internal size, named the way this style names it. */
function sizeLabel() {
  const fld = fieldsFor(state.styleId), p = state.dl.params, u = state.unit;
  const dims = ['L', 'W', 'H'].filter((k) => fld[k] != null)
    .map((k) => dim(p[k], u)).join(' \u00d7 ');
  return `${dims} ${u === 'in' ? 'in' : 'mm'} ${fld.L === 'Box length' ? 'box covered' : 'internal'}`;
}

/* --------------------------------------------------------------- licence */
function renderLicence() {
  const el = $('licenceBody');
  if (state.licensed) {
    el.innerHTML = `<div class="msg ok">Licensed — all box styles unlocked.</div>
      <button class="ghost" id="btnRelease">Release this browser</button>
      <p class="note">
        Releasing frees the seat so you can activate on another machine.</p>`;
    $('btnRelease').onclick = async () => {
      const r = await Licence.deactivate();
      state.licensed = false; renderLicence(); renderStyleList(); update();
      flash(r.message || 'Licence released.', 'ok');
    };
    return;
  }
  el.innerHTML = `
    <p class="muted-note lead">
      Two styles are free to export. A licence unlocks all ${STYLES.length}.</p>
    <div class="field"><label for="lkey">Licence key</label>
      <input id="lkey" type="text" autocomplete="off" spellcheck="false" placeholder="from your receipt email"></div>
    <button class="primary" id="btnActivate">Activate</button>
    <div id="lmsg" class="lmsg"></div>`;
  $('btnActivate').onclick = async () => {
    const btn = $('btnActivate'); btn.disabled = true; btn.textContent = 'Checking…';
    const r = await Licence.activate($('lkey').value);
    btn.disabled = false; btn.textContent = 'Activate';
    $('lmsg').innerHTML = `<div class="msg ${r.ok ? 'ok' : 'err'}">${r.message}</div>`;
    if (r.ok) { state.licensed = true; renderLicence(); renderStyleList(); update(); }
  };
}

function renderPricing() {
  const p = CONFIG.price;
  $('pricingBody').innerHTML = CONFIG.paymentsLive && CONFIG.checkoutUrl
    ? `<p><strong class="foot-brand">${p.label}</strong> — unlocks every box style, for good.
         No subscription. Free updates to the style catalogue.</p>
       <p><a class="brand buy" href="${CONFIG.checkoutUrl}">Buy a licence →</a></p>
       <p class="fine">Sold through Lemon Squeezy, who act as merchant of record and
         handle VAT and sales tax. You receive a licence key by email immediately after payment.</p>`
    : `<p><strong class="foot-brand">${p.label}</strong> — planned price for a licence
         unlocking every box style, one payment, no subscription.</p>
       <div class="msg warn"><strong>Not on sale yet.</strong> The store is not open, so nothing
         can be bought here today. The two free styles are fully working and unrestricted —
         use them, and judge whether the rest would be worth it.</div>`;
}

function flash(msg, kind = 'ok') {
  const box = $('errBox');
  box.innerHTML = `<div class="msg ${kind}">${msg}</div>`;
  setTimeout(() => { if (box.firstChild && box.firstChild.textContent === msg) box.innerHTML = ''; }, 4000);
}

/* ----------------------------------------------------------------- theme
 * Three states, cycled in this order: follow the system, force light, force
 * dark. The choice is remembered; "system" stores nothing, so a reader who
 * never touches it keeps whatever their OS does.
 * ---------------------------------------------------------------------- */
const THEME_KEY = 'cartonry.theme';
const THEME_ICON = {
  system: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" focusable="false"><rect x="2" y="4" width="20" height="14" rx="2"/><path d="M8 21h8M12 18v3"/></svg>',
  light: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  dark: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true" focusable="false"><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.7 6.7 0 0 0 10.5 10.5z"/></svg>',
};
function readTheme() { try { return localStorage.getItem(THEME_KEY) || 'system'; } catch { return 'system'; } }
function applyTheme(mode) {
  const r = document.documentElement;
  if (mode === 'system') r.removeAttribute('data-theme'); else r.setAttribute('data-theme', mode);
  try { mode === 'system' ? localStorage.removeItem(THEME_KEY) : localStorage.setItem(THEME_KEY, mode); } catch {}
  const btn = $('themeBtn');
  if (btn) {
    btn.innerHTML = THEME_ICON[mode];
    btn.title = `Theme: ${mode === 'system' ? 'follows your system' : mode}`;
    btn.setAttribute('aria-label', btn.title);
  }
}
const nextTheme = (m) => ({ system: 'light', light: 'dark', dark: 'system' }[m] || 'system');

/* ---------------------------------------------------------------- toasts */
function toast(message, kind = '') {
  const box = $('toasts');
  const el = document.createElement('div');
  el.className = `toast ${kind}`.trim();
  el.textContent = message;
  box.appendChild(el);
  setTimeout(() => { el.style.transition = 'opacity .25s'; el.style.opacity = '0';
    setTimeout(() => el.remove(), 260); }, 2400);
}

/* ------------------------------------------------------- recent specs
 * A short local history so returning to a size you were just working on is one
 * click. Stored only in this browser, and only sizes - nothing identifying.
 * ------------------------------------------------------------------- */
const PAPER_KEY = 'cartonry.paper';
const RECENT_KEY = 'cartonry.recent.v1';
const readRecent = () => { try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch { return []; } };

const recentKey = (e) => `${e.s}|${Math.round(e.L)}|${Math.round(e.W)}|${Math.round(e.H)}`;

function rememberSpec() {
  if (!state.dl) return;
  const p = state.dl.params;
  const entry = { s: state.styleId, L: p.L, W: p.W, H: p.H, t: p.t, u: state.unit };
  // Dedupe on style plus rounded size, so nudging a dimension by a tenth does
  // not fill the list with near-identical entries.
  const list = readRecent().filter((e) => recentKey(e) !== recentKey(entry));
  list.unshift(entry);
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 4))); } catch {}
  renderRecent();
}

function renderRecent() {
  const el = $('recents'); if (!el) return;
  const list = readRecent().filter((e) => byId(e.s));

  el.innerHTML = list.length <= 1 ? '' :
    `<span class="rc-label">Recent</span>` + list.slice(0, 4).map((e, i) => {
      const st = byId(e.s);
      const dims = (byId(e.s).fields || {}).W === null
        ? [e.L, e.H] : [e.L, e.W, e.H];
      const d = dims.map((v) => dim(v, e.u)).join('×');
      const short = st.name.replace(/\s*\(.*?\)/, '').replace(/ (box|carton|container)$/i, '');
      return `<button type="button" class="rc" data-recent="${i}"
        title="${st.name} — ${d} ${e.u === 'in' ? 'in' : 'mm'}">
        <span class="rc-n">${short}</span><span class="rc-d">${d}</span></button>`;
    }).join('');
  el.querySelectorAll('[data-recent]').forEach((b) => b.addEventListener('click', () => {
    const e = readRecent()[+b.dataset.recent]; if (!e) return;
    state.styleId = e.s; state.unit = e.u;
    $('unitMm').setAttribute('aria-pressed', String(e.u === 'mm'));
    $('unitIn').setAttribute('aria-pressed', String(e.u === 'in'));
    $('dimL').value = fmt(fromMm(e.L, e.u));
    $('dimW').value = fmt(fromMm(e.W, e.u));
    $('dimH').value = fmt(fromMm(e.H, e.u));
    const opt = [...$('boardSel').options].find((o) => parseFloat(o.value) === e.t);
    if (opt) { $('boardSel').value = opt.value; $('customTWrap').hidden = true; }
    else { $('boardSel').value = 'custom'; $('customTWrap').hidden = false; $('dimT').value = fmt(e.t); }
    applyFieldLabels(e.s); renderStyleList(); update();
  }));
}

/* --------------------------------------------------------------- URL state
 * The whole specification lives in the address bar, so a dieline can be
 * bookmarked, sent to a colleague, or reopened months later and be exactly the
 * same box. No account needed for any of that.
 * ---------------------------------------------------------------------- */
function writeUrl() {
  if (!state.dl) return;
  const p = state.dl.params, q = new URLSearchParams();
  q.set('style', state.styleId);
  q.set('l', fmt(fromMm(p.L, state.unit)));
  q.set('w', fmt(fromMm(p.W, state.unit)));
  q.set('h', fmt(fromMm(p.H, state.unit)));
  q.set('t', fmt(p.t));
  if (state.unit !== 'mm') q.set('u', state.unit);
  if (state.view !== 'flat') q.set('v', state.view);
  history.replaceState(null, '', `${location.pathname}?${q}`);
}

function readUrl() {
  const q = new URLSearchParams(location.search);
  const id = q.get('style');
  if (!id || !byId(id)) return false;
  state.styleId = id;
  if (q.get('u') === 'in') {
    state.unit = 'in';
    $('unitMm').setAttribute('aria-pressed', 'false');
    $('unitIn').setAttribute('aria-pressed', 'true');
  }
  for (const [key, el] of [['l', 'dimL'], ['w', 'dimW'], ['h', 'dimH']]) {
    const v = parseFloat(q.get(key));
    if (Number.isFinite(v)) $(el).value = fmt(v);
  }
  const t = parseFloat(q.get('t'));
  if (Number.isFinite(t)) {
    const opt = [...$('boardSel').options].find((o) => parseFloat(o.value) === t);
    if (opt) { $('boardSel').value = opt.value; $('customTWrap').hidden = true; }
    else { $('boardSel').value = 'custom'; $('customTWrap').hidden = false; $('dimT').value = fmt(t); }
  }
  const v = q.get('v');
  if (v === '3d' || v === 'sheet' || v === 'compare' || v === 'pack') {
    state.view = v;
    for (const [id, key] of VIEW_BUTTONS) $(id).setAttribute('aria-pressed', String(v === key));
  }
  return true;
}

async function copyLink() {
  writeUrl();
  try {
    await navigator.clipboard.writeText(location.href);
    toast('Link copied — it reopens this exact box.');
  } catch {
    toast('Copy the address bar to share this box.', 'err');
  }
}

/* ---------------------------------------------------------- keyboard */
function wireKeys() {
  document.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    const dlg = $('keysDlg');
    // With a modal open, the only shortcut that means anything is the one that
    // closes it. Anything else silently rearranges the page behind the dialog,
    // which the reader discovers only after dismissing it.
    const modal = document.querySelector('dialog[open]');
    if (modal) {
      if (e.key === '?' && modal === dlg) { dlg.close(); e.preventDefault(); }
      else if ((e.key === 't' || e.key === 'T') && modal === $('tileDlg')) {
        modal.close(); e.preventDefault();
      }
      return;
    }
    const chip = (k) => document.querySelector(`[data-anno="${k}"]`);
    switch (e.key) {
      case 'f': case 'F': setView(state.view === '3d' ? 'flat' : '3d'); break;
      case 'h': case 'H': setView(state.view === 'sheet' ? 'flat' : 'sheet'); break;
      case 'c': case 'C': setView(state.view === 'compare' ? 'flat' : 'compare'); break;
      case 'k': case 'K': setView(state.view === 'pack' ? 'flat' : 'pack'); break;
      case 'r': case 'R': if (state.view === '3d') animateFold(0, 1); break;
      case 'd': case 'D': chip('dims')?.click(); break;
      case 'n': case 'N': chip('labels')?.click(); break;
      case 'p': case 'P': chip('chain')?.click(); break;
      case 'g': case 'G': chip('guides')?.click(); break;
      case 'u': case 'U': setUnit(state.unit === 'mm' ? 'in' : 'mm'); break;
      case '+': case '=': setZoom(state.zoom * 1.4); break;
      case '-': case '_': setZoom(state.zoom / 1.4); break;
      case '0': setZoom(1, true); break;
      case '[': case ']': {
        const i = STYLES.findIndex((s) => s.id === state.styleId);
        const n = (i + (e.key === ']' ? 1 : STYLES.length - 1)) % STYLES.length;
        selectStyle(STYLES[n].id);
        document.querySelector(`#styleList [data-style="${STYLES[n].id}"]`)
          ?.scrollIntoView({ block: 'nearest' });
        break;
      }
      case 't': case 'T': openTileDialog(); break;
      case 's': case 'S': copyLink(); break;
      case '?': dlg.showModal(); break;
      default: return;
    }
    e.preventDefault();
  });
  $('keysDlg').addEventListener('click', (e) => { if (e.target === $('keysDlg')) $('keysDlg').close(); });
}

/* ------------------------------------------------------------------ boot */
/**
 * Swap the unit the dimension boxes are written in.
 *
 * The boxes hold display text, and display text is rounded. Converting out of
 * that text and back again does not return where it started: 150 mm shows as
 * 5.906 in, and 5.906 in is 150.012 mm. Pressing U twice used to leave a box
 * the reader never edited half a hundredth of a millimetre larger, and it
 * showed - the field said 150.012.
 *
 * So each box remembers the millimetre value last written into it. If it still
 * displays that value, the conversion runs from the remembered number rather
 * than from the rounded text. A value the reader has since typed over will not
 * match, and is used as typed.
 */
function setUnit(u) {
  if (u === state.unit) return;
  const prev = state.unit;
  for (const id of ['dimL', 'dimW', 'dimH']) {
    const el = $(id);
    const { mm, text } = convertShown(el.value, state.unit, u, parseFloat(el.dataset.mm));
    el.dataset.mm = String(mm);
    el.value = text;
  }
  state.unit = u;
  $('unitMm').setAttribute('aria-pressed', String(u === 'mm'));
  $('unitIn').setAttribute('aria-pressed', String(u === 'in'));
  applyUnitChrome(prev, u);
  update();
}

function mountAnalytics() {
  const a = CONFIG.analytics;
  if (!a || a.provider !== 'cloudflare' || !a.token) return;   // default: no third-party requests
  const s = document.createElement('script');
  s.defer = true;
  s.src = 'https://static.cloudflareinsights.com/beacon.min.js';
  s.setAttribute('data-cf-beacon', JSON.stringify({ token: a.token }));
  document.head.appendChild(s);
}

function initSheets() { renderSheetOptions(); renderClearanceOptions(); }

/** Register the offline worker. Failure is silent - it is an enhancement. */
function registerWorker() {
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol !== 'https:' && location.hostname !== 'localhost'
      && location.hostname !== '127.0.0.1') return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}

function init() {
  applyTheme(readTheme());
  registerWorker();
  mountAnalytics();
  initSheets();
  renderStyleList(); renderLicence(); renderPricing();
  if (CONFIG.supportEmail) {
    $('footContact').innerHTML = `<a href="mailto:${CONFIG.supportEmail}">Support</a>`;
  }
  ['dimL', 'dimW', 'dimH', 'dimT', 'optGlue', 'optSlot', 'optGap', 'optTuck']
    .forEach((id) => $(id).addEventListener('input', update));
  ['dimL', 'dimW', 'dimH'].forEach((id) => $(id).addEventListener('input', retireStarter));
  $('starterX').onclick = retireStarter;
  $('starterFit').onclick = () => {
    // Take them to the thing the note offered, opened and focused, rather than
    // leaving them to find it. On a phone the panel is below the drawing, so
    // the scroll is doing real work and not just a flourish.
    $('fitDetails').open = true;
    const reduce = window.matchMedia
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    $('fitDetails').scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
    $('prodL').focus({ preventScroll: true });
  };
  // Up/Down nudge the value; Shift for a coarse step, Alt for a fine one.
  ['dimL', 'dimW', 'dimH'].forEach((id) => $(id).addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    const cur = parseLength($(id).value);
    if (!Number.isFinite(cur)) return;
    const step = (e.shiftKey ? 10 : e.altKey ? 0.1 : 1) * (e.key === 'ArrowUp' ? 1 : -1);
    e.preventDefault();
    $(id).value = fmt(Math.max(0, Math.round((cur + step) * 1000) / 1000));
    update();
  }));
  ['gutter', 'trim', 'gsm', 'price', 'qty', 'sheetW', 'sheetH', 'freight']
    .forEach((id) => $(id).addEventListener('input', renderYield));
  $('sheetSel').addEventListener('change', () => {
    $('customSheet').hidden = $('sheetSel').value !== 'custom';
    renderYield();
  });
  $('boardSel').addEventListener('change', () => {
    $('customTWrap').hidden = $('boardSel').value !== 'custom';
    update();
  });
  $('unitMm').onclick = () => setUnit('mm');
  $('unitIn').onclick = () => setUnit('in');
  $('viewFlat').onclick = () => setView('flat');
  $('view3d').onclick = () => setView('3d');
  $('viewSheet').onclick = () => setView('sheet');
  $('viewCompare').onclick = () => setView('compare');
  $('viewPack').onclick = () => setView('pack');
  renderContainerOptions();
  $('packSel').addEventListener('change', () => {
    state.container = $('packSel').value;
    const custom = state.container === 'custom';
    $('packCustom').hidden = !custom; $('packCustomD').hidden = !custom;
    renderPack();
  });
  ['packH', 'packGap', 'packW', 'packD'].forEach((id) =>
    $(id).addEventListener('input', () => { if (state.view === 'pack') renderPack(); }));
  $('applyFit').onclick = applyFit;
  ['prodL', 'prodW', 'prodH', 'clearMm'].forEach((id) => $(id).addEventListener('input', renderFitPreview));
  $('clearSel').addEventListener('change', () => {
    $('clearCustomWrap').hidden = $('clearSel').value !== 'custom';
    renderFitPreview();
  });
  renderFitPreview();
  $('allowRot').addEventListener('change', renderYield);
  $('foldPlay').onclick = () => animateFold(0, 1);
  $('foldRange').addEventListener('input', (e) => {
    cancelAnimationFrame(state.anim);
    state.foldT = +e.target.value / 100;
    renderStage();
  });
  $('styleList').addEventListener('scroll', updateListFade, { passive: true });
  wireOrbit();
  wirePan();
  wireInspector();
  wireKeys();
  $('themeBtn').onclick = () => applyTheme(nextTheme(readTheme()));
  for (const btn of document.querySelectorAll('[data-anno]')) {
    btn.addEventListener('click', () => {
      const k = btn.dataset.anno;
      state.anno[k] = !state.anno[k];
      btn.setAttribute('aria-pressed', String(state.anno[k]));
      renderStage();
      if ($('tileDlg').open) renderTileDialog();
    });
  }
  $('zoomIn').onclick = () => setZoom(state.zoom * 1.4);
  $('zoomOut').onclick = () => setZoom(state.zoom / 1.4);
  $('zoomFit').onclick = () => setZoom(1, true);

  const suffix = () => (state.view === 'sheet' ? '_sheet' : '');
  const target = () => { const t = exportTarget();
    if (!t) toast('Nothing to export: the blank does not fit this sheet.', 'err'); return t; };
  $('dlSvg').onclick = () => { if (!guard()) return; const t = target(); if (t)
    save(`${slug(state.dl)}${suffix()}.svg`, toSVG(t, { includeDims: true }), 'image/svg+xml'); };
  $('dlDxf').onclick = () => { if (!guard()) return; const t = target(); if (t)
    save(`${slug(state.dl)}${suffix()}.dxf`, toDXF(t, { includeDims: true }), 'application/dxf'); };
  $('dlPdf').onclick = () => { if (!guard()) return; const t = target(); if (t)
    save(`${slug(state.dl)}${suffix()}.pdf`, toPDF(t, { includeDims: true }), 'application/pdf', true); };
  $('dlSpec').onclick = () => guard() && save(`${slug(state.dl)}_spec.pdf`,
    toSpecSheet(annotated(), { rows: specRows(),
      generated: new Date().toISOString().slice(0, 10),
      steps: (GUIDES[state.styleId] || {}).assembly || [] }), 'application/pdf', true);
  $('btnShare').onclick = copyLink;
  $('btnTile').onclick = openTileDialog;
  $('tileGo').onclick = downloadTiles;
  $('tileClose').onclick = () => $('tileDlg').close();
  $('tileDlg').addEventListener('click', (e) => { if (e.target === $('tileDlg')) $('tileDlg').close(); });
  renderPaperOptions();
  $('paperSel').value = state.paper;
  $('paperSel').addEventListener('change', () => {
    state.paper = $('paperSel').value;
    try { localStorage.setItem(PAPER_KEY, state.paper); } catch {}
    renderTileDialog();
  });
  try {
    const saved = localStorage.getItem(PAPER_KEY);
    if (saved && paperById(saved)) { state.paper = saved; $('paperSel').value = saved; }
  } catch {}

  const fromUrl = readUrl();
  // A shared link carries someone's real box, so it is never an example.
  if (!fromUrl) showStarter(); else { try { localStorage.setItem(SEEN_KEY, '1'); } catch {} }
  // readUrl may have switched the unit, and the markup's defaults - a 4 mm
  // gutter, a 1200 mm sheet - are written in millimetres. Convert them, or a
  // link shared in inches opens with a sheet forty metres across.
  applyUnitChrome(state.unit === 'mm' ? null : 'mm', state.unit);
  if (fromUrl) { renderStyleList(); applyFieldLabels(state.styleId); update(); }
  else selectStyle(state.styleId);

  // Re-check any stored licence against the provider, quietly.
  Licence.refresh().then((r) => {
    if (r.licensed !== state.licensed) {
      state.licensed = r.licensed; renderLicence(); renderStyleList(); update();
    }
  }).catch(() => {});
}
init();
