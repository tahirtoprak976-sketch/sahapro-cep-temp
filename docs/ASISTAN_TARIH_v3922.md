# v3.9.22 — Yerel asistan tarih filtreleri

Taban: gh-pages 735012d (v3.9.21). Bu değişiklik yalnız yerel komutların tarih çözümlemesini ve sürüm/önbellek adını günceller; veri şeması ve finans hesapları değişmez.

## Yeniden üretilen sorunlar
19.10.2026 Pazartesi için `bu hafta` 13–19 Ekim, `geçen hafta` 6–12 Ekim dönüyordu. Bunlar takvim haftaları değildir. `bu ay` ve ISO tarih desteklenmiyordu. 31.02.2026 geçerliymiş gibi filtreye yazılıyordu.

## Yeni davranış
- Bu hafta: pazartesiden bugüne; geçen hafta: önceki pazartesi–pazar.
- Son 7 gün: bugün dahil yedi günlük kayan aralık, takvim haftasından ayrı.
- Bu ay / bu yıl: dönem başından bugüne; geçen ay: tamamlanmış önceki ay.
- YYYY-MM-DD ve gün.ay[.yıl] / gün/ay[/yıl] desteklenir. Yılsız tarihte mevcut yıl kullanılır; iki basamaklı yıl 20xx sayılır.
- Geçersiz açık tarih içeren açma/düzeltme komutlarında asistan açıklama gösterir; yanlış filtre açılmaz ve Gemini'ye gönderilmez.
- Mevcut kayıtları yazan ya da değiştiren yeni bir komut eklenmez.

## Doğrulama ve sınırlar
Node takımı: 80/80 test dosyası geçti. Son ekli ifade değişikliğinden sonra komut ve takvim regresyonları tekrar geçti.
Chromium: gerçek mobil asistan ekranında bu hafta / geçen hafta / bu ay / son 7 gün filtreleri, geçersiz tarih açıklaması, Gemini'ye sıfır istek ve iş/kasa kayıtlarına sıfır yazım kontrol edilir (`tools/e2e/command_dates.py`).
Fiziksel telefon denenmedi. Tek tarih ve tanımlı dönemler kapsamda; serbest tarih aralığı, birden fazla tarihli karmaşık mesaj ve Gemini'nin ayrı tarih yorumlama yolu bu değişiklikte genişletilmedi.
