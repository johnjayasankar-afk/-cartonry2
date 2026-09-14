// Checks on the stylesheet itself. Everything here caught, or would have
// caught, something real.
import { test, assert } from './harness.js';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (f) => readFileSync(join(root, f), 'utf8');
const css = read('styles.css');
const html = read('index.html');
const app = read('app.js');
const markup = html + app;

/** Every rule in the sheet, as [selectorList, declarations]. */
const rules = [...css.matchAll(/(^|\})\s*([^{}@/]+?)\{([^}]*)\}/g)]
  .map((m) => [m[2].trim(), m[3]]);

/** Every shipped JavaScript source, so token scans can see inline SVG too. */
function walkJs(dir = 'src', out = []) {
  for (const f of readdirSync(join(root, dir))) {
    const rel = `${dir}/${f}`;
    if (statSync(join(root, rel)).isDirectory()) walkJs(rel, out);
    else if (f.endsWith('.js')) out.push(rel);
  }
  if (dir === 'src') out.push('app.js');
  return out;
}

test('style: a layout container class is not shared with anything else', () => {
  // A bare `.layout` rule set the page's two-column grid. A <dd class="layout">
  // in the material panel picked it up and was handed a 330px grid track and
  // 40px of padding, which pushed the whole left column 34px out of its box.
  // A class that positions the page must name the page.
  for (const [sel, body] of rules) {
    if (!/grid-template-columns\s*:/.test(body)) continue;
    for (const one of sel.split(',')) {
      const t = one.trim();
      const m = /^\.([A-Za-z0-9_-]+)$/.exec(t);
      if (!m) continue;                                  // scoped selectors are fine
      const uses = (markup.match(new RegExp(`class="[^"]*\\b${m[1]}\\b[^"]*"`, 'g')) || []).length;
      assert(uses <= 1,
        `.${m[1]} sets a page grid and is used ${uses} times; give the container its own name`);
    }
  }
});

test('style: no inline style attributes in the shipped markup', () => {
  // Spacing and type that describe how the page is built belong in the sheet,
  // where they can be seen as a system rather than twenty separate decisions.
  const pages = [['index.html', html], ['app.js', app], ['tools/build-pages.js', read('tools/build-pages.js')],
    ...readdirSync(join(root, 'box')).map((f) => [`box/${f}`, read(`box/${f}`)])];
  for (const [file, src] of pages) {
    const inline = [...src.matchAll(/(?<!data-)\bstyle="([^"]*)"/g)]
      .map((m) => m[1])
      .filter((v) => v && !v.startsWith('${'));          // template-driven values
    assert(inline.length === 0, `${file} has ${inline.length} inline styles: ${inline[0]}`);
  }
});

test('style: font sizes come from the scale, not from arithmetic', () => {
  const raw = [...css.matchAll(/font-size:\s*([0-9.]+)(rem|px)/g)].map((m) => m[0]);
  assert(raw.length === 0, `${raw.length} unscaled font sizes, e.g. ${raw[0]}`);
});

test('style: corner radii come from the scale', () => {
  const raw = [...css.matchAll(/border-radius:\s*([0-9.]+)px/g)]
    .map((m) => m[0]).filter((v) => !/:\s*0px/.test(v));
  assert(raw.length === 0, `${raw.length} unscaled radii, e.g. ${raw[0]}`);
});

test('style: every token the sheet uses is defined in it', () => {
  const defined = new Set([...css.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
  const used = new Set([...css.matchAll(/var\((--[a-z0-9-]+)/g)].map((m) => m[1]));
  const missing = [...used].filter((v) => !defined.has(v));
  assert(missing.length === 0, `undefined tokens: ${missing.join(', ')}`);
});

test('style: no token is defined and then never used', () => {
  // A leftover token is a decision nobody made any more. --radius survived a
  // rename this way, still declared, referenced by nothing.
  //
  // "Used" has to include the JavaScript: several modules build inline SVG and
  // reference page tokens from inside it - var(--grid-fine), var(--pack-line) -
  // which is a real use that a stylesheet-only scan cannot see.
  const js = walkJs().map(read).join('\n');
  const defined = [...css.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]);
  const used = new Set([...(css + js).matchAll(/var\((--[a-z0-9-]+)/g)].map((m) => m[1]));
  const dead = [...new Set(defined)].filter((v) => !used.has(v));
  assert(dead.length === 0, `unused tokens: ${dead.join(', ')}`);
});

test('style: a token used anywhere is defined in the stylesheet', () => {
  // The mirror of the above: an inline SVG asking for var(--pack-line) with no
  // such token falls back silently to whatever the second argument says, and
  // the theme quietly stops applying to that element.
  const js = walkJs().map(read).join('\n');
  const defined = new Set([...css.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
  const missing = [...new Set([...js.matchAll(/var\((--[a-z0-9-]+)/g)].map((m) => m[1]))]
    .filter((v) => !defined.has(v));
  assert(missing.length === 0, `used in JS but never defined: ${missing.join(', ')}`);
});

test('style: classes named in the markup exist in the stylesheet', () => {
  // A typo in a class name is invisible: the element simply renders unstyled.
  const inCss = new Set([...css.matchAll(/\.([A-Za-z][A-Za-z0-9_-]*)/g)].map((m) => m[1]));
  const inMarkup = new Set();
  for (const m of markup.matchAll(/class="([^"$]*)"/g)) {
    for (const c of m[1].split(/\s+/)) if (c && !c.includes('${')) inMarkup.add(c);
  }
  const orphans = [...inMarkup].filter((c) => !inCss.has(c));
  assert(orphans.length === 0, `classes with no rule: ${orphans.join(', ')}`);
});

test('style: every comparison row spans the full width of the table', () => {
  // A row that carries fewer cells than there are columns makes up the
  // difference with colspan. Get the sum wrong and the remaining values slide
  // under the wrong headings - the caliper appeared under "Blank". Checking
  // only the error row missed that the caution row has the same failure mode,
  // so this walks every row template the comparison table can emit.
  const src = read('app.js');
  const head = src.match(/const cols = \[([\s\S]*?)\n  \];/);
  assert(head, 'could not find the comparison column list');
  const columns = (head[1].match(/\n\s*\[/g) || []).length;

  const body = src.match(/const body = rows\.map\(\(r\) => \{([\s\S]*?)\n  \}\)\.join\(''\);/);
  assert(body, 'could not find the comparison row templates');
  const frags = body[1].split(/<tr\b/).slice(1).map((f) => f.split('</tr>')[0]);
  assert(frags.length >= 3, `expected the error, data and caution rows, found ${frags.length}`);

  // A colspan is either a literal or derived from the column list itself.
  const width = (raw) => {
    const m = raw.match(/^\$\{cols\.length(?:\s*-\s*(\d+))?\}$/);
    if (m) return columns - (+m[1] || 0);
    assert(/^\d+$/.test(raw), `colspan "${raw}" is neither a number nor from cols.length`);
    return +raw;
  };
  frags.forEach((f, i) => {
    const tds = (f.match(/<td/g) || []).length;
    const extra = [...f.matchAll(/colspan="([^"]+)"/g)]
      .reduce((a, m) => a + (width(m[1]) - 1), 0);
    assert(tds + extra === columns,
      `comparison row ${i + 1} covers ${tds + extra} columns but the table has ${columns}`);
  });
});
