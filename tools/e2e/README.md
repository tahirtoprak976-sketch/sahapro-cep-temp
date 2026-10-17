# Uçtan uca testler (her sürümden önce)

Depo kökünde `python3 -m http.server 8841`, sonra:

- `python3 tools/e2e/sim.py [tohum]` — **İşletme simülasyonu**: 3 şoför telefonu (gerçek şoför ekranı: iş, mazot, gider, arıza, fotoğraf, "Patrona gönder") + patron telefonu (kilit, imzalı bağlantılar, asistanla işleme, aynı mesajı tekrar yapıştırma, izin formları onay/red, maaş kapatma, geri alma, mazot faturası). Sonunda: Veri Sağlığı 0 hata, sayılar tutarlı, şifreli yedek → yeni telefona birebir geri yükleme. `SONUÇ: BAŞARILI` beklenir.
- `python3 tools/e2e/t105.py` — Bozuk veri üretip Veri Sağlığı "güvenli düzeltmeler"ini dener.

Gemini çağrıları sahte (page.route); şoför kodları Gemini'siz işlenir. Playwright + Chromium + Pillow gerekir.
