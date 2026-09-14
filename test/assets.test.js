// Checks on the things that live outside the module graph: the shipped HTML,
// the service worker's pre-cache list, and the cache-busting version. Nothing
// here is clever. All of it is stuff that breaks silently.
import { test, assert } from './harness.js';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

// fileURLToPath, not .pathname: this project lives under "Application Support"
// and a percent-encoded space is not a path.
const root = fileURLToPath(new URL('..', import.meta.url));
const read = (f) => readFileSync(join(root, f), 'utf8');
const sw = read('sw.js');
const V = +/^const V = (\d+);/m.exec(sw)[1];

const htmlFiles = ['index.html', 'privacy.html', 'terms.html',
  ...readdirSync(join(root, 'box')).map((f) => `box/${f}`)];

test('assets: every page asks for the version the worker pre-caches', () => {
  // The failure this catches is invisible in a browser: the page loads fine
  // from the network and the pre-cache silently holds a URL nobody requests.
  for (const f of htmlFiles) {
    for (const m of read(f).matchAll(/(?:href|src)="([^"]+)\?v=(\d+)"/g)) {
      assert(+m[2] === V, `${f} asks for ${m[1]}?v=${m[2]}, but sw.js is at v=${V}`);
    }
  }
});

test('assets: the worker pre-caches the versioned URLs, not bare ones', () => {
  for (const asset of ['styles.css', 'app.js']) {
    assert(sw.includes(`./${asset}?v=\${V}`), `sw.js does not pre-cache ${asset} with a version`);
  }
});

test('assets: the cache name is derived from the version, so it rolls over', () => {
  assert(/const VERSION = `cartonry-v\$\{V\}`/.test(sw),
    'cache name is hardcoded; a version bump would serve the old cache');
});

test('assets: every source module is in the pre-cache list', () => {
  // A module missing here still works - network-first fetches and caches it -
  // but only for someone who was online when they first loaded the page. This
  // is the test that would have caught src/export/tile.js.
  const walk = (dir) => readdirSync(dir).flatMap((f) => {
    const full = join(dir, f);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
  const modules = walk(join(root, 'src'))
    .filter((f) => f.endsWith('.js'))
    .map((f) => './' + relative(root, f));
  const missing = modules.filter((m) => !sw.includes(`'${m}'`));
  assert(missing.length === 0, `not pre-cached: ${missing.join(', ')}`);
});

test('assets: nothing in the pre-cache list has gone missing from disk', () => {
  const listed = [...sw.matchAll(/'(\.\/src\/[^']+)'/g)].map((m) => m[1]);
  const gone = listed.filter((f) => { try { statSync(join(root, f)); return false; } catch { return true; } });
  assert(gone.length === 0, `listed but absent: ${gone.join(', ')}`);
});

test('assets: every module the app imports actually resolves', () => {
  // A typo in an import path is a blank page, and only on the route that hits it.
  const seen = new Set();
  const check = (file) => {
    if (seen.has(file)) return;
    seen.add(file);
    const src = read(file);
    const dir = join(root, file, '..');
    for (const m of src.matchAll(/from '(\.[^']+)'/g)) {
      const target = relative(root, join(dir, m[1]));
      try { statSync(join(root, target)); } catch {
        assert(false, `${file} imports ${m[1]}, which does not exist`);
      }
      check(target);
    }
  };
  check('app.js');
  assert(seen.size > 15, `only followed ${seen.size} modules - the walk did not work`);
});

test('assets: the licence check is the only outbound origin the CSP allows', () => {
  // The privacy claim on the page is "the only network request this site can
  // make is a licence check". The CSP is what makes that true rather than
  // merely intended, so it is worth asserting.
  const headers = read('_headers');
  const csp = /Content-Security-Policy:([^\n]+)/.exec(headers)[1];
  assert(/default-src 'self'/.test(csp), 'CSP does not default to self');
  assert(/form-action 'none'/.test(csp), 'CSP permits form submission');
  const connect = /connect-src ([^;]+)/.exec(csp)[1].trim().split(/\s+/);
  const allowed = connect.filter((o) => o !== "'self'");
  assert(allowed.every((o) => /^https:\/\/api\.(lemonsqueezy\.com|polar\.sh)$/.test(o)),
    `CSP allows unexpected origins: ${allowed.join(', ')}`);
});

test('a11y: every page has exactly one h1', () => {
  // A document with no h1 gives a screen-reader user nothing to land on, and
  // two of them means the page claims to be about two things.
  for (const f of htmlFiles) {
    const n = (read(f).match(/<h1[\s>]/g) || []).length;
    assert(n === 1, `${f} has ${n} h1 elements`);
  }
});

test('a11y: decorative icons are hidden from assistive tech', () => {
  // An icon inside a button that already has an accessible name gets announced
  // twice unless it opts out.
  const app = read('app.js');
  for (const m of app.matchAll(/<svg (?![^>]*aria-hidden)[^>]*>/g)) {
    assert(/aria-label|role="img"/.test(m[0]),
      `unlabelled, unhidden inline svg in app.js: ${m[0].slice(0, 70)}`);
  }
});

test('a11y: nothing ships a positive tabindex', () => {
  // A positive tabindex reorders the whole page's tab sequence, not just its own.
  for (const f of htmlFiles) {
    const bad = [...read(f).matchAll(/tabindex="(\d+)"/g)].filter((m) => +m[1] > 0);
    assert(bad.length === 0, `${f} uses tabindex="${bad[0] && bad[0][1]}"`);
  }
});

test('a11y: every form control on the tool page is labelled', () => {
  const html = read('index.html');
  const labelled = new Set([...html.matchAll(/<label[^>]*\bfor="([^"]+)"/g)].map((m) => m[1]));
  for (const m of html.matchAll(/<(input|select|textarea)\b([^>]*)>/g)) {
    const attrs = m[2];
    if (/type="(hidden|checkbox|radio)"/.test(attrs)) continue;   // checkboxes wrap their label
    const id = (/\bid="([^"]+)"/.exec(attrs) || [])[1];
    assert(id && labelled.has(id), `<${m[1]} id="${id}"> has no label`);
  }
});

test('assets: the two host configs send the same headers', () => {
  // `_headers` covers Cloudflare Pages and Netlify, `vercel.json` covers Vercel.
  // Nothing makes them agree, and one of them once went missing entirely - the
  // site then deploys without a CSP on whichever host reads the absent file,
  // silently, because a missing header looks exactly like a working site.
  const rules = read('_headers');
  const vercel = JSON.parse(read('vercel.json'));
  const sent = new Map(vercel.headers[0].headers.map((h) => [h.key, h.value]));

  const wanted = [...rules.matchAll(/^ {2}([A-Za-z-]+):\s*(.+)$/gm)]
    .map(([, k, v]) => [k, v.trim()]);
  assert(wanted.length >= 5, `only ${wanted.length} header rules found in _headers`);

  for (const [key, value] of wanted) {
    assert(sent.has(key), `_headers sends ${key} but vercel.json does not`);
    assert(sent.get(key) === value,
      `${key} differs:\n  _headers:    ${value}\n  vercel.json: ${sent.get(key)}`);
  }
  for (const key of sent.keys()) {
    assert(wanted.some(([k]) => k === key), `vercel.json sends ${key} but _headers does not`);
  }
});
