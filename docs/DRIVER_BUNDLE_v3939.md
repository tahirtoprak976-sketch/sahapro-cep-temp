# SOLO v3.9.39 — tek şoför paketi

## Günlük kullanım

Şoför kayıtlarını girer, paketi hazırlar ve ana düğme **Patrona gönder · tek paket** ile paylaşır. Uygulama WhatsApp paylaşım ekranına kodsuz okunur özet ve **bir** `SAHAPRO-….sahapro.zip` dosyası verir. İşler, nakit bildirimi, imzalı aktarım kodu ve fotoğraflar bu tek dosyanın içindedir. Ayrı aktarım dosyası/fotoğraf seçme adımı yoktur. Fotoğraflar WhatsApp'ta ayrı resimler olarak değil, paketin içinde taşınır.

Patron tek paketi Asistan'a ekler veya desteklenen telefonda SAHAPRO'ya paylaşır, **Asistana Gönder** der, kartları kontrol edip kaydeder. Paket içindeki fotoğrafların sırası pakette saklanır; aynı adlı fotoğraflar kaybolmaz. Nakit ayrıca onay ister. Sadece paketi almak kayıtları otomatik kaydetmez.

Eski kodlu mesaj ve ayrı .sahapro.txt aktarım yöntemi **Diğer gönderim yöntemleri** altında korunur. Eski gönderilmiş mesajları yeniden üretmek gerekmez. Veri tabanı sürümü ve hesaplama yöntemi değişmez.

## Bütünlük ve sınırlar

- Orijinal SP1 mesajı değiştirilmeden paketlenir; aynı HMAC imza, bağlantı iptal/süre/personel ve tekrar kayıt kontrolleri çalışır. CRC bozulma kontrolüdür; fotoğrafların gönderen tarafından kriptografik olarak imzalandığı iddia edilmez.
- En fazla 20 fotoğraf, paket toplamı en fazla 20 MB. 20 fotoğrafın tek dosya içinde olması önceki ayrı dosyalardaki 21 ek sınırını kaldırır; boyut sınırı sürer.
- Paket, uygulamanın ürettiği sıkıştırmasız ZIP biçimidir. En fazla 22 bölüm; dizin/yerel başlık, boyut, CRC, dosya adları, yinelenen/çakışan bölümler ve fotoğraf listesi kontrol edilir. Sıkıştırma açılmadığından sıkıştırma bombası işlenmez. Dosya sistemine çıkarma yapılmaz.
- Bozuk paket, eksik iç bölüm, farklı imza veya fotoğraf sayısı uyuşmazlığında başka metin/AI yolundan kayıt üretilmez. Paketler Gemini'ye gönderilmez; yanına eklenen ayrı fotoğraflar kabul edilmez. Her paketi tek başına işleyin.
- Tek paket desteklenmiyorsa nedeni gösterilir; sessizce kodlu veya fotoğrafsız gönderime geçilmez. İptal/hata kayıtları beklemede bırakır. Aynı paketi tekrar gönderme aynı kayıt kimliklerini kullanır.
- Native çağrı, ZIP önceden hazırlanıp önizleme açıldıktan sonra yeni kullanıcı tıklamasında yapılır. Fotoğraflar hazırlanırken kayıt/güncelleme kilitleri korunur.

WhatsApp'ın fiziksel Android/iPhone cihazında belge+mesaj sunumu doğrulanmadı. Tarayıcı paylaşım desteği ve paylaşımın tamamlanması, patrona teslim edildiği kanıtı değildir. Paket kendi içinde özeti de taşır; uygulama dışında ZIP'i açmak aktarım için gerekli değildir.

## Testler

`driver-bundle.test.mjs`: tek dosyada orijinal mesaj ve sıralı fotoğraflar, aynı dosya adları, sabit yeniden gönderim baytları, 0/20/21 fotoğraf, boyut ve bozuk/sıkıştırılmış/yinelenen/yol içeren paket reddi.

`driver_bundle.py`: iki izole Chromium/IndexedDB oturumu; taklit native paylaşım ve gerçek imza/service worker. Tek dosya + kodsuz özet, iptal, iş/nakit/fotoğraf aktarımı, tekrar, bozulma ve yeniden ZIP'lenmiş yanlış imza reddi, paylaşım hedefi yönlendirmesi ve 20 fotoğraf sınırı. Test verisi uydurma; dışarı mesaj gönderilmez.

Eski `driver_transfer`, `driver_journey`, `driver_ultimate` suitleri saklanan yöntemleri de kontrol eder; eski yöntemler testlerde **Diğer gönderim yöntemleri** açılarak seçilir.
