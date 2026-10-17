# Uçtan uca testler (her sürümden önce)

Depo kökünde `python3 -m http.server 8841`, sonra:

- `python3 tools/e2e/sim.py [tohum]` — **İşletme simülasyonu**: 3 şoför telefonu (gerçek şoför ekranı: iş, mazot, gider, arıza, fotoğraf, "Patrona gönder") + patron telefonu (kilit, imzalı bağlantılar, asistanla işleme, aynı mesajı tekrar yapıştırma, izin formları onay/red, maaş kapatma, geri alma, mazot faturası) + **2. tur para/belge**: fiyat kuralları, tahsilat (kasa↔cari tek kayıt), hakediş kesinleştirme, eLogo UBL faturası eşleştirme, döküm hesabı, WhatsApp toplu, aynı mesajı iki sekmede aynı anda kaydetme. Sonunda: Veri Sağlığı 0 hata, sayılar tutarlı, şifreli yedek → yeni telefona birebir geri yükleme. `SONUÇ: BAŞARILI` beklenir.
- `python3 tools/e2e/t105.py` — Bozuk veri üretip Veri Sağlığı "güvenli düzeltmeler"ini dener.

Gemini çağrıları sahte (page.route); şoför kodları Gemini'siz işlenir. Playwright + Chromium + Pillow gerekir.

- `node tests/syntax.test.mjs` — tüm js dosyalarının **gerçek** ES modülü sözdizimi denetimi (düz `node --check` bu projede bozuk modülü de geçiyor; güvenmeyin).
