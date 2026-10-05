// SAHAPRO CEP — Service Worker (offline-first app shell)
const CACHE = 'sahapro-cep-temp-v1';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './js/core.js',
  './js/db.js',
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
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Cache-first (app shell), ağ başarılı olursa arka planda tazele
self.addEventListener('fetch', (ev) => {
  if (ev.request.method !== 'GET') return;
  ev.respondWith(
    caches.match(ev.request, { ignoreSearch: true }).then((cached) => {
      const net = fetch(ev.request).then((res) => {
        if (res && res.ok && new URL(ev.request.url).origin === location.origin) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(ev.request, copy));
        }
        return res;
      }).catch(() => cached);
      return cached || net;
    })
  );
});
