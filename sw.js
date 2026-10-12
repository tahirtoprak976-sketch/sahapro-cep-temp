// Versioned atomic app shell. Existing cached assets are never mixed with a new release.
const CACHE = "sahapro-solo-v3-20261012-evidence-parser-1";
const CDN_CACHE = "sahapro-solo-cdn-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./js/core.js",
  "./js/message-engine.js",
  "./js/message-smart-core.js", "./js/message-smart-db.js", "./js/message-smart-ui.js",
  "./js/solo-core.js", "./js/solo-db.js", "./js/solo-ui.js", "./vendor/qrcode.js",
  "./js/db.js",
  "./js/ui.js",
  "./js/parser.js",
  "./js/history-core.js",
  "./js/history-db.js",
  "./js/history-ui.js",
  "./data/history-template.json",
  "./js/pdf.js",
  "./js/ocr.js",
  "./js/m-dash.js",
  "./js/m-work.js",
  "./js/m-finance.js",
  "./js/m-ops.js",
  "./js/m-crm.js",
  "./js/app.js",
  "./js/business.js",
  "./js/pro.js",
  "./js/document-engine.js",
  "./js/pdf-templates.js",
  "./js/backup.js",
  "./js/enterprise.js", "./js/enterprise-core.js", "./js/enterprise-db.js",
  "./vendor/DejaVuSans.ttf",
  "./vendor/DejaVuSans-Bold.ttf",
  "./manifest.webmanifest",
  "./icons/icon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];
self.addEventListener("install", (event) =>
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS))),
);
// New release waits for the user or until every old window is closed.
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});
self.addEventListener("activate", (event) =>
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (k) =>
                k.startsWith("sahapro-solo-") && k !== CACHE && k !== CDN_CACHE,
            )
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  ),
);
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url),
    local = url.origin === location.origin,
    cdn = url.origin === "https://cdn.jsdelivr.net";
  if (!local && !cdn) return;
  event.respondWith(
    (async () => {
      const cache = await caches.open(cdn ? CDN_CACHE : CACHE),
        cached = await cache.match(event.request, { ignoreSearch: local });
      if (cached) return cached;
      const response = await fetch(event.request);
      if (response.ok && cdn) await cache.put(event.request, response.clone());
      return response;
    })(),
  );
});
