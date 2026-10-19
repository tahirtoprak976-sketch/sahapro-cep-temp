# SAHAPRO SOLO v3.9.21 — Fiş okuma düzeltmesi

Taban: gh-pages 1339f415fc7d2511711111be6f2c34a132b76953 (v3.9.20). Kullanıcının yüklediği paket için hazırlanan düzeltme güncel canlı dala çakışmasız uygulandı. Kullanıcı canlı yayını açıkça yetkilendirdi. Gerçek kullanıcı verisine erişilmedi. Veritabanı şeması değişmedi (v5).

## Doğrulanan neden
validateTickets yalnız photoTexts[photo] metnini kullanıyor, metin yoksa numara/tonajı atıyor ve tarihi bugüne çeviriyordu. rereadSlips yalnız iş kartlarının fotoğraflarını kapsıyordu.

## Değişiklik
- Fiş nesnesinde text ve photo_id desteklenir; fotoğraflar ilk istekte kimlikle etiketlenir. Kimlik-sıra çelişkisi kartı işaretsiz bırakır. Modelin kimliği de hatalı okuyabileceği için bu, bağımsız görüntü doğrulaması değildir.
- Ham metin yoksa makul biçimli numara/tonaj/tarih doğrulanmamış öneri olarak korunur; otomatik seçilmez. Eksik/geçersiz/çelişkili tarih bugüne çevrilmez.
- Fotoğrafların metinleri birleştirilmez. Doğrulanmamış fiş iş kartına otomatik eritilmez.
- İkinci okuma doğrudan fiş kartlarına genişletildi. En fazla altı fotoğraf sırayla, her istekte bir fotoğraf olacak şekilde mevcut Gemini bütçesi ve model-fallback yolu ile okunur. Her fotoğraf için bir ikinci okuma işlemi vardır; mevcut fallback birden fazla HTTP denemesi yapabilir.
- Başarısız/eksik ikinci okuma önceki önerileri silmez. Başarılı sonuç da açık kontrol gerektirir. Form gösterildikten sonra otomatik yeniden okuma yapılmaz.
- Sürüm v3.9.21; SW önbelleği yeni ad kullanır.

## Test
79/79 Node test dosyası geçti; sıfır başarısız/atlanan. Sözdizimi ve SW varlık kontrolleri dahil.
Yeni regresyon: boş metin, ters sıra, çapraz fotoğraf değeri, kimlik çelişkisi, eksik/geçersiz tarih, ikinci okuma başarısızlığı, kullanıcı düzeltmesi bayrağı, mükerrer fiş ve iş kartına doğrulanmamış veri aktarımı.
Gerçek Chromium + IndexedDB, 412x900: iki sentetik fotoğraf ve taklit Gemini ile gerçek asistan ekranında alanların korunması, kartların işaretsiz olması, sıfır iş/belge yazımı, tek fotoğraflık tekrarlar; ayrıca başarılı ikinci okumanın ters sıradaki kartlara doğru uygulanması doğrulandı.
Gerçek Gemini, gerçek telefon ve gerçek fişlerin okuma doğruluğu denenmedi. Aynı modelin ürettiği ham metin bağımsız OCR kanıtı değildir.

## Teslim/kullanım
Bu ZIP tam uygulama kaynak paketidir, önizleme için dönüştürülmüş paket değildir. Canlı depoya doğrudan yüklemeden önce güncel kaynakla farkları incelenmelidir; daha yeni değişiklikleri ezmeyin. Önce ayrı origin veya localhost üzerinde örnek verilerle deneyin. Güncelleme için site verilerini silmeyin.
Telefon kabulü: iki fişi gönderin; eksik OCR durumunda öneriler kaybolmamalı, tarih bugüne dönüşmemeli, kartlar işaretsiz olmalı. Fotoğraflarla karşılaştırıp tarih/numara/tonaj, müşteri ve bağlanacak işi doğrulamadan kaydetmeyin.
