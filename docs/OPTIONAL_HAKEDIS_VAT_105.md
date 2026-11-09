# v3.10.05 — Seçimli KDV ve sade hakediş

İşletme sahibinin 09.11.2026 kararı [KDV notuna](KDV_CARI_KARAR_NOTU.md) işlendi. Hakedişe girmeyen işler net ana para üzerinden cariye yansır. Yeni hakedişte KDV seçimi başlangıçta kapalıdır; seçilen kayıtlı oran, yalnız kesinleştirme onayıyla cariye girer. Kesinleşmiş hakedişler, tahsilatlar ve kaynak fiyatlar otomatik değiştirilmez.

| Sentetik kontrol | Önce | Aday |
|---|---|---|
| 27.000 hariç iş − 20.000 ödeme, hakediş öncesi | 7.000 | 7.000 (karar gereği) |
| Aynı iş, KDV seçilmeden kesinleşme | Otomatik 12.400 | 7.000 |
| Aynı iş, %20 ayrıca seçilerek kesinleşme | 12.400 | 12.400 |
| 3 × 1.200 dahil fiyat, hakediş öncesi ana para | 3.600 | 3.000 |
| Fiyatsız mutabakat PDF | Yok | Para sütunu/tutarı ve mali kayıt yok |
| Az kalemli fiyatlı PDF | Yaklaşık 1,7 MB | Ölçülen örnek yaklaşık 747 KB, tek sayfa |
| Genel asistan hazır doğru | 30/73 | 30/73 |
| Asistan sessiz yanlış / para tahmini / zorunlu işaret ihlali | 0/0/0 | 0/0/0 |

Müşteri PDF özeti cari dönemindeki ana para, kesinleşen KDV, diğer hareketler, tahsilat ve devri ayrı gösterir; aynı ekstre bakiyesine tam kuruşla ulaşır. Tahsilatın belirli hakedişe ait olduğu varsayılmaz. Hakediş ekranı ve fiyatlı PDF satırlarında net tutar etiketlenir. Fiyatsız mutabakat fiyat bulunmadan da dışa aktarılabilir; 0 fiyatlı hakediş oluşturmaz.

Fiş zorunluluğu kayıtlı kendi depo varışında kalkar. Bilinmeyen varışta ve diğer döküm yerlerinde koruma devam eder; mükerrer fiş/tarih/araç çelişkisi gevşetilmez. Fiş vermeyen diğer yerler için yeni bir kayıt alanı uydurulmadı.

Banka ekleme ilgili banka hesabı ekranına gider ve dönünce kaydedilmemiş tahsilat alanlarını korur. Açılış tarihi uyarısı vardır; açılış öncesi hareket yasağı değişmez. Hakediş işlem düğmeleri iş satırını kaplamaz; hata balonu Kaydet’in üstüne binmez. Saatlik işin toplam etiketinde saat gösterilir.

Şema 7, mağazalar ve kayıt biçimi aynı. Yeni hakediş mevcut vergi alanlarını kullanır; orijinal fiyat `source_price_snapshot` içinde korunur. %0 geçerlidir, eksik oran %20 olmaz. Dahil fiyatı net birim tarifesine çevirirken toplam kuruşu korunamıyorsa kayıt engellenerek açık tarife kontrolü istenir. Eksik temel/kilit/bağlantı verisi olan eski kayıtta bilinen tutar korunur ve uyarı verilir. Bu istisnalar otomatik onarılmaz.

Sahibin yeni politikası nedeniyle eski karma cari testlerindeki kesin bakiye beklentileri net tutara güncellendi; tolerans eklenmedi ve finansal koruma testleri kaldırılmadı. Hakediş tarayıcı testleri KDV’yi açıkça seçer; özgün assert ifadeleri değişmez.

Fontlar ve Unicode eşleştirmesi PDF içinde standart Flate ile sıkıştırılır; Türkçe harfler korunur. Sıkıştırma API’si olmayan tarayıcıda tam fontla eski sıkıştırmasız çıktı kullanılır. Çok kalemli belge birden fazla sayfa olabilir. Gerçek telefon, gerçek WhatsApp bağlantısı ve gerçek Gemini denenmedi; model ölçümleri dondurulmuş yanıtlardır.

Yükseltme testindeki eski “müşteri PDF tanımı birebir aynı” sözleşmesi, sahibin istediği yeni KDV özetine göre tam eşitlikle güncellendi: unpriced sentetik başlangıç için yalnız onaylanmış özet satırları ve açıklama referansa açıkça eklenir. Kaynak hücreleri, adlar, tarihler, açıklamalar ve diğer bütün belge alanları hâlâ tam nesne eşitliğiyle karşılaştırılır. Her veritabanı kaydı, meta, taslak ve ek dosya baytı ayrıca birebir karşılaştırılmaya devam eder; alan dışlama veya tolerans yoktur.
