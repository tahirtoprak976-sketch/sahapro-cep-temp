// SAHAPRO SOLO — Service Worker (offline-first app shell + CDN runtime cache)
const CACHE = 'sahapro-solo-v2';
const CDN_CACHE = 'sahapro-solo-cdn-v1';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './js/core.js',
  './js/db.js',
  './js/ui.js',
  './js/parser.js',
  './js/pdf.js',
  './js/ocr.js',
  './js/m-dash.js',
  './js/m-work.js',
  './js/m-finance.js',
  './js/m-ops.js',
  './js/m-crm.js',
  './js/app.js',
  './manifest.webmanifest',
  './icons/icon.svg'
];

self.addEventListener('install', (ev) => {
  ev.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (ev) => {
  ev.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== CDN_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// App shell: cache-first + arka planda tazeleme.
// CDN (jsdelivr: jsPDF / tesseract): cache-first — sürümlü URL'ler immutable; ilk online kullanımda cache'lenir.
self.addEventListener('fetch', (ev) => {
  if (ev.request.method !== 'GET') return;
  const url = new URL(ev.request.url);
  const isCDN = url.origin === 'https://cdn.jsdelivr.net';
  const cacheName = isCDN ? CDN_CACHE : CACHE;
  ev.respondWith(
    caches.match(ev.request, { ignoreSearch: !isCDN }).then((cached) => {
      const net = fetch(ev.request).then((res) => {
        if (res && res.ok && (url.origin === location.origin || isCDN)) {
          const copy = res.clone();
          caches.open(cacheName).then((c) => c.put(ev.request, copy));
        }
        return res;
      }).catch(() => cached);
      return cached || net;
    })
  );
});
