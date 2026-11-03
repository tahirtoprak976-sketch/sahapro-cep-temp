# Paket 0 — başlangıç ölçümü ve yayın engeli

Taban: `20612ee8af15ca8823bca705df8acf7c1f56b063`, gh-pages, v3.9.98, şema 7.
Aday: v3.9.99; yayınlanmadı. Yalnız test/ölçüm/CI ve sürüm/önbellek etiketi değişti. Asistan davranışı ve YZ2 değişmedi; yeni uygulama modülü yok, SW ASSETS eklemesi gerekmiyor.

61 elle hazırlanmış sentetik mesaj ve sabit model yanıtı, gerçek uygulama doğrulayıcılarıyla oynatıldı. Bu sonuç gerçek Gemini başarısı değildir. Beklentiler hedef iş kurallarından yazıldı; adayın çıktısı beklenen sonuç olarak kopyalanmadı.

| Ölçüt | Başlangıç v3.9.98 | Aday v3.9.99 |
|---|---:|---:|
| Sessiz yanlış kart | 3 | 3 |
| Para alanında tahmin | 0 | 0 |
| Zorunlu işaretsiz kartta işaret | 9 | 9 |
| İşaretli doğru / tüm beklenen kartlar | 20/61 (%32,79) | 20/61 (%32,79) |
| Gereksiz soru/alan istemi | 9/21 (%42,86) | 9/21 (%42,86) |
| Mesaj başına soru/alan istemi | 21/61 (0,344) | 21/61 (0,344) |
| Kart sayısı hatası | 0 | 0 |
| Yerel tests/gold yanlış | 0 | 0 |

Soru sayısı saf katmandaki açık sorular ve doğrulama istemleri üzerinden yaklaşık ölçülür; DOM soru kutusu sayısı değildir. Ayrıntılar `tests/assistant-gold/README.md` içindedir. Alan beklentisi hataları ile işaretleme hataları ayrı raporlanır; zorunlu işaretsiz olduğu halde işaretlenmiş kart, işaretli doğru kart sayısına katılmaz.

Gerçek Chromium arayüzünde beş sınıf ayrı mesajlarla sınandı: tahsilat işaretsiz; kasaya teslim, personel avansı, müşteriye borç doğuran mazot teslimi ve müşteriden sefer karşılığı depo girişi işaretli geldi. Beş denemenin hiçbirinde Kaydet kullanılmadı; işletme kayıtlarının önce/sonra eşitliği doğrulandı. Bunlar yalnız izole TEST verileridir.

Üç sessiz yanlış örneği: açık saat fiyatının boş kalmasına rağmen işaretli kart (`work-explicit-price`), açık fiyat + kısmi tahsilatta aynı durum (`work-price-and-partial-payment`), Çatıcı yerine ana firmayı seçen işaretli model önerisi (`work-parent-wrong`). Her girdinin beklentisi ve ham model önerisi sürüm kontrollü JSON'dadır.

## Alan doğruluğu

| Alan | Doğru / sınanan |
|---|---:|
| customer_id | 36/38 |
| vehicle_id | 30/30 |
| quantity | 20/21 |
| unit | 21/21 |
| date | 61/61 |
| unit_price | 24/26 |
| amount | 23/23 |
| money_role | 8/8 |
| site_id | 1/1 |
| price_rule | 1/1 |
| personnel_id | 6/6 |
| event_type | 6/6 |
| liters | 11/11 |
| total | 11/11 |
| cost | 2/2 |
| ticket_no | 4/4 |
| tonnage | 4/4 |
| duplicate | 4/4 |
| link | 2/2 |

## Sınırlar

Gerçek telefon, gerçek Gemini ve gerçek WhatsApp denenmedi. Canlı sentetik CLI eklendi, çalıştırılmadı. Tarayıcı kanıtı beş zorunlu işaretsiz sınıfa aittir; 61 örneğin tamamını gerçek Gemini veya uçtan uca arayüz başarısı olarak sunmaz. Tüm tarayıcı ve yükseltme suitleri çalıştırılmadan birleştirme yapılmaz. Güvenlik kapısı başarısız olduğu için bu aday canlıya alınamaz.
