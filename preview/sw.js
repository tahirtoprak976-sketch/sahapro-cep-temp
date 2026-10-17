// Eski önizlemenin servis çalışanı (v3.7) etkinleşince TÜM önbellekleri siliyordu (canlı uygulamanınkiler ve şoförün
// gönderilmemiş fotoğrafları dahil). Bu sürüm hiçbir önbelleğe dokunmadan kendini kaldırır.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.registration.unregister()));
