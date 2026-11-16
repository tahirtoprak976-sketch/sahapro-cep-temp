# İkinci canlı tur: kaynak ayrıntısı ve mazot yönü

Yüklemenin alıcısı mesaj alıntısında açıkken modelin açıklamasında kayboluyordu. Artık doğrulanmış aynı alıntıdaki tek yükleme alıcısı açıklamaya eklenir; müşteri/cari muhatabı değiştirilmez. Alıcı, eylem/malzeme veya olumsuzluk çelişiyorsa açıklama korunur, kart işaretsiz ve soru ile gelir. Sınav adı veya adresi koda eklenmedi.

“Müşteri sefer karşılığı depoya N litre mazot verdi” gibi tek, açık ve kayıtlı müşteriye ait girişte modelin ters yöne koyduğu kart, yerel doğrulamada depo girişine yönlendirilir. Söz, ters yön, karışık işlem, belirsiz müşteri, doğrulanmamış tarih/litre bu dar yola girmez. Modelin makine ve para önerileri taşınmaz. Kart her zaman işaretsizdir. Mevcut Kaydet/izin/revizyon/para güvenliği katmanı korunur.

| İkinci canlı turun aynı ham yanıtlarının tekrarı | Önce | Aday |
|---|---:|---:|
| Tekil hazır doğru | 24/38 | 25/38 |
| Toplu hazır doğru | 24/38 | 25/38 |
| Tekil / toplu sessiz yanlış | 1 / 1 | 0 / 0 |
| Tekil / toplu yanlış alan | 5 / 5 | 4 / 4 |
| Para güvenliği doğru kart | 11/12 | 12/12 |
| Para tahmini / zorunlu işaret ihlali | 0 / 0 | 0 / 0 |

Bu tablo yeni Gemini başarısı değildir: 5897109 kaynağındaki ikinci gerçek tur yeniden oynatılmıştır. İlk turun ham yanıtı ve eski dondurulmuş set korunur. Kalan malzemeler mesajda/kayıtta doğrulanamadığı için doldurulmadı; yeni müşteri adı kullanıcı onayında kaldı. 28/38 ve en fazla 2 yanlış alan hedefleri henüz sağlanmadı.

Değişmemiş v3.11.06 üzerinde hem açıklama hem mazot yönü hatası aynı ham yanıtlarla yeniden üretildi; adayda aynı regresyon geçti. Sınır testleri yanlış alıcı/malzeme, olumsuzluk, uzun açıklama, ödeme sözü, ters yön, mükerrer işlem, iki müşteri ve kopuk takma ad kaydı içerir. Yerel 212 Node dosyası ve confidence100 içindeki 20 Chromium senaryosu geçti. Tam CI, tarayıcı ve yükseltme kapıları çalıştırılacak.

Aday v3.11.07; SW önbelleği güncel. Şema, kalıcı kayıt biçimi, eski kayıtlar ve KDV/cari politikası değişmedi. Ana uygulama hâlâ v3.10.13. Yeni canlı Gemini, gerçek Android/WhatsApp ve fiziksel seri fiş kabulü henüz yapılmadı. Ürün terfisi yapılmaz; geçerse ayrı telefon sınav alanı güncellenir.
