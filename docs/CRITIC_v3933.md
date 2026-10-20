# SOLO v3.9.33 — Şoför dosya eşleştirme denetimi

Bu sürüm, kayıt ve fotoğrafların patron telefonunda yanlış eşleşebildiği somut durumları düzeltir. Veri şeması ve finansal hesaplama değişmedi.

## Bulgular ve düzeltmeler

1. `payloadsToPlan` yalnız eksik dosya sayısında eşleştirmeyi durduruyordu. Fazla dosya varsa ilk dosyalar sırayla kullanılıyordu. Artık dosya sayısı **tam olarak** beklenen sayıya eşit olmalıdır; negatif/kesirli/metin/aşırı fotoğraf sayısı ve geçersiz imza işareti de eşleştirmeyi engeller.
2. İmzası/süresi/iptali nedeniyle reddedilen mesaj çıkarılınca dosya listesi aynı kalıyordu. Geçerli mesajın beklediği sayıya tesadüfen eşit sayıda dosya olması, dosyaların o mesaja ait olduğunu kanıtlamaz. Aynı girdide reddedilmiş paket ve dosya varsa otomatik fotoğraf/imza eşleştirmesi yapılmaz; geçerli mesaj ve kendi ekleri ayrı gönderilmelidir.
3. Tek işe boştaki tüm fotoğrafları bağlayan genel geri dönüş, yeni eşleştirme engelini delmemelidir. Şoför dosya eşleştirmesi engellendiğinde bu geri dönüş de kapalıdır. Hiç fotoğraf beklemeyen mesaj da ilgisiz fotoğrafı kendine alamaz.
4. Şoför çıkışı 20 dosya, patron girişi ise 10 dosyayla sınırlıydı. Asistan dosya seçimi, ses ekleme ve PWA share-target girişi 20'ye eşitlendi. 20'nin üzerindeki seçim açık hata verir, işleme engellenir; yeni seçim kabul edilmez ve önceki ekler korunur. Harici paylaşımdan 20'nin üzerinde dosya gelirse ilk 20 geçici olarak tutulur ama **girdi eksik diye işlenmez**; kullanıcı doğru paketi yeniden seçmeli veya ekleri açıkça temizlemelidir. Sohbet TXT/ZIP ithalatı ayrı yolunu korur.

## Kullanım ve kayıt güvenliği

Eksik/fazla dosyada yeniden seçim, bütün paket dosyalarını değiştirir ve aynı mesajı yeniden hazırlar. Sıfır dosya bekleyen mesaja ek gelmişse, **Bu mesajın eklerini kaldır ve yeniden hazırla** düğmesi sunulur. Geçerli/iptal karışımında otomatik yeniden eşleştirme sunulmaz; mesajlar ayrılmalıdır.

Eşleştirme engelliyken seçili şoför satırlarını kaydetmek ayrıca onay ister. Bu onay fotoğraf ve dosya olarak gelen imzaların eklenmeyeceğini, tekrar aynı mesajı almanın sonradan bu dosyaları tamamlamayacağını açıklar. Vazgeçmek hiçbir kayıt yazmaz. Kodun içinde taşınan imza çizgileri bu dosya eşleştirme kontrolünden ayrı kalır. Kaydetme işleyicisi çift tıklamaya karşı kilitlidir ve hazırlık hatalarını görünür kılar.

## Doğrulama ve sınırlar

Saf model testi: eksik/fazla/sıfır dosya, reddedilmiş paket, bozuk dosya adedi, imza dosyası ve tek iş geri dönüşü. Gerçek Chromium/IndexedDB/Cache testi: iptal/salt dosyasız onay, yeniden seçim, karışık geçerli/iptal mesaj, iki işe 20 dosyanın adlarıyla birebir dağıtılması, 21 dosyada işleme engeli ve gerçek Service Worker POST share-target yolu. Karma dört tür içe alma regresyonu sekiz fotoğrafı doğru kayıtlara ekler; Gemini veya WhatsApp'a gerçek çağrı yapılmaz.

Dosya sayısının eşit olması içerik kimliği veya sıra doğrulaması değildir. WhatsApp sıralamayı değiştirirse kullanıcı fotoğrafları kontrol etmelidir; dosya hash manifesti veya teslim makbuzu eklenmedi. Gerçek Android/iPhone paylaşım kabulü ayrıca yapılmalıdır. Bu düzeltmeler önceden yanlış bağlanmış dosyaları kendiliğinden taşımaz veya silmez.
