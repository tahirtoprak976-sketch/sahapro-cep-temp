# SOLO v3.9.36 — şoför nakit bildirimi hata düzeltmeleri

## Düzeltilen davranışlar

- İş tarihi ile nakdin alındığı tarih ayrıldı. Yeni şoför iş formunda nakit tarihi ayrı seçilir; varsayılan bugün. Tarih taslakta, imzalı SP1 paketinde, okunur paylaşım metninde ve patronun tahsilat önizlemesinde korunur. İşin tarihi değişmez.
- Eski paketlerde `cash_date` yoksa önceki davranış korunur: nakit tarihi iş tarihidir. Eski kayıtlar bugüne taşınmaz.
- Kayıt listesindeki **Nakit bilgisi** tutarı ve ardından tarihi sorar. Yalnız tarih değişikliği de aynı kayıt kimliğiyle yeniden paylaşım bekler. Tarih adımında vazgeçmek hiçbir alanı değiştirmez. Daha önce nakit belirtilmemiş bir işe ekleme yapılırken nakit tarihi bugün önerilir.
- Boş tutar artık gerçekten nakit bildirimini kaldırır; **Vazgeç** ile karışmaz. `0` da kaldırır. Patronun daha önce onayladığı tahsilat bu yolla silinmez/değişmez.
- Şoför tahsilatı kayıt katmanında gerçek takvim tarihi gerektirir; örneğin 30 Şubat doğrudan çağrıda da reddedilir.

## Korunan sınırlar

Nakit patronun açık onayını gerektirir ve şoförde görünür; kasaya teslim ayrı işlemdir. Aynı bildirim tekrar onaylandığında çift iş/tahsilat oluşmaz; değişmiş tutar/tarih eski onaylı tahsilatı ezmez. Alt müşteri, ana firmasıyla birlikte eşleştirilir. İptal edilmiş bağlantı ve farklı personel adına tahsilat yazma reddedilir.

Bu sürüm kalıcı bir patron gelen kutusu eklemez. İş kaydından sonra bekleyen nakit aynı sonuç ekranındaki düğmeden açılır; sayfa kapatıldıysa orijinal SP1 mesajı yeniden okutulabilir. WhatsApp paylaşımı teslim alındı kanıtı değildir. Fiziksel Android/iPhone üzerinde native paylaşım kabul testi yapılmadı; tarayıcı testlerinde paylaşım taklit edilir ve yalnız uydurma veriler kullanılır.

## Doğrulama

`tests/driver-customer-cash.test.mjs`: ayrı tarih SP1 gidiş/dönüşü, eski paket tarihi, alt müşteri/ana firma ve sabit tekrar anahtarı.

`tools/e2e/driver_cash.py`: geçmiş iş/ayrı tahsilat tarihi, taslak reload, iş ve nakdin ayrı onayı, çift gönderim, onaylı tutarın korunması, tarih adımında vazgeçme, yalnız tarih düzeltmesi, boş tutarla kaldırma, eşzamanlı kart/tekrar yazımı, geçersiz tarih ve bağlantı/personel yetki kontrolleri. İzole iki Chromium oturumu; gerçek IndexedDB.
