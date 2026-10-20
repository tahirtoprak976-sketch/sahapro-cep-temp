# SOLO v3.9.37 — tahsilatın kaynak işi

Şoförün aldığı nakit, onay önizlemesinde ve kaydedilmiş **Kasa / Tahsilat** detayında **Hangi işten alındı?** bölümüyle gösterilir. İş tarihi, bildirilen müşteri ve ana firma, araç/makine, iş türü, miktar/birim ve açıklama saklanır. Tahsilat tarihi ayrı kalır. Alanlar salt okunur kaynak bilgisidir; tutar işin fiyatı yerine kullanılmaz.

**İlgili işi aç** yalnız aynı `driver_entry_id` ile tek bir aktif iş varsa gösterilir. Müşteri adı, tutar, tarih veya sıra benzerliğinden iş tahmin edilmez. İş henüz kaydedilmemişse, silinmişse ya da aynı kimlikte birden fazla aktif iş varsa durum açıkça yazılır. Tahsilatın müşterisi kayıtlı işten farklıysa uyarı gösterilir; otomatik müşteri taşıması yapılmaz.

Tahsilat işten önce onaylanabilir. İş sonradan kaydedildiğinde bağlantı tahsilatı değiştirmeden açılır. Bu eşleştirme bir ödeme dağıtım sistemi değildir; işin tamamen ödendiği veya kalan borcun işe göre hesaplandığı iddia edilmez.

Yeni onaylarda `driver_work` kaynak özeti tahsilatla birlikte kaydedilir. Eski tahsilatlarda mevcut `source_quote` gösterilir; ikisi de yoksa iş özeti saklanmadığı belirtilir. Önceden kaydedilmiş tutarlar, kaynaklar ve yanlış müşteriye girilmiş işler değiştirilmez. Veri tabanı sürümü ve finans hesaplamaları değişmez.

## Doğrulama

- `driver-cash-context.test.mjs`: tam kimlik eşleştirme, henüz yok/silinmiş/çoğul/başka müşteri durumları, eski kaynak metni, HTML kaçışları.
- `driver_cash.py`: iki izole Chromium oturumu, uydurma veri ve taklit native paylaşım; onay öncesi özet, kayıtlı tahsilattan işe bağlantı, tahsilatı önce/işi sonra onaylama ve tahsilatın değişmeden kalması. Önceki nakit tarihi, alt müşteri, tekrar gönderim ve yetki kontrolleri de korunur.
- Fiziksel Android/iPhone kabul testi yapılmadı. WhatsApp paylaşımı teslim alındı kanıtı değildir.
