// GÜVENLİ GEÇİŞ — eski önizleme (v3.7, /preview/) servis çalışanının yerini alır.
// Eski çalışan etkinleşirken TÜM önbellekleri siliyordu. Bu sürüm:
//  • yalnız eski önizlemenin kendi uygulama önbelleğini ("sahapro-solo-v3", birebir ad) siler — başka hiçbir önbelleğe
//    (canlı uygulama, şoför fotoğrafları, paylaşım) dokunmaz;
//  • yalnız KENDİ kaydını kaldırır (registration.unregister) — başka kapsamdaki çalışanlara dokunmaz;
//  • veritabanına ve ayarlara dokunmaz.
const OLD_PREVIEW_CACHE = "sahapro-solo-v3";
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil((async () => {
  try { if (await caches.has(OLD_PREVIEW_CACHE)) await caches.delete(OLD_PREVIEW_CACHE); } catch (_) {}
  await self.registration.unregister();
  // Açık eski önizleme sekmeleri yeni (bilgi) sayfasına geçsin
  for (const c of await self.clients.matchAll({ type: "window" })) try { c.navigate(c.url); } catch (_) {}
})()));
