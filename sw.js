/* Service worker.
 *
 * Network-first with a cache fallback. Online you always get the current code -
 * a dieline tool serving stale geometry would be worse than useless - and
 * offline you get the last version you loaded, which is the whole point: the
 * generator does its work in the browser, so once it is cached it keeps working
 * on a train, on site, or behind a locked-down network.
 *
 * Cross-origin requests (the licence check) are never touched.
 */
/* The asset version, in ONE place.
 *
 * It used to appear here twice and in every HTML file, and it drifted: the
 * pages asked for app.js?v=21 while this list pre-cached app.js?v=20, so the
 * two largest assets were quietly never pre-cached at all. Nothing broke
 * loudly - network-first picked them up on first load - which is exactly why
 * it went unnoticed. test/assets.test.js now fails if these ever disagree. */
const V = 76;
const VERSION = `cartonry-v${V}`;
const SHELL = [
  './', './index.html', `./styles.css?v=${V}`, `./app.js?v=${V}`,
  './favicon.svg', './manifest.webmanifest', './privacy.html', './terms.html',
  './fonts/inter-var.woff2', './fonts/ibm-plex-mono-400.woff2', './fonts/ibm-plex-mono-500.woff2',
  './src/geom.js', './src/model.js', './src/registry.js', './src/config.js',
  './src/license.js', './src/annotate.js', './src/estimate.js', './src/fold.js',
  './src/render3d.js', './src/sheet.js',
  './src/spec.js', './src/regions.js', './src/guides.js', './src/pack.js',
  './src/styles/rsc.js', './src/styles/slotted.js', './src/styles/carton.js',
  './src/styles/misc.js', './src/styles/extra.js', './src/styles/shared.js',
  './src/export/svg.js', './src/export/pdf.js', './src/export/dxf.js',
  './src/export/tile.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION)
    // addAll fails the whole install if any single file 404s; tolerate that.
    .then((c) => Promise.allSettled(SHELL.map((u) => c.add(u))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(e.request, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(e.request).then((hit) => hit
        || caches.match('./index.html')
        || new Response('Offline and this page was never cached.', {
             status: 503, headers: { 'Content-Type': 'text/plain' } })))
  );
});
