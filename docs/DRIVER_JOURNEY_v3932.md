# SOLO v3.9.32 — Şoför kayıt ve patrona iletim akışı

## Kullanım

1. Şoför iş, yakıt, gider veya arıza/bakım formunu doldurur, fotoğrafları ekler ve kaydeder.
2. Başarılı kayıttan sonra **Telefona kaydedildi · henüz paylaşılmadı** kartı ve o kaydın paketini hazırlama düğmesi görünür. Yeni kayıt girmeye devam edilebilir; aşağıdaki düğme tüm bekleyenleri paketler.
3. **Paketi hazırla** dosyaları ve imzaları okur, mevcut boyut/adet/metin sınırlarına göre paketi oluşturur. Eksik dosya sessizce atılmaz. Hazırlık sırasında yeniden basma ve güncelleme engellenir.
4. Önizlemede kayıt türleri/sayıları, dosya sayısı/boyutu, kayıt dökümü, fotoğraflar ve sonraki pakete kalan kayıt sayısı görünür. Henüz dış uygulama açılmaz ve paylaşım durumu yazılmaz.
5. **WhatsApp’ta paylaş** düğmesi telefonun paylaşım ekranını açar; WhatsApp ve alıcı kullanıcı tarafından seçilir. İptal/hata durumunda önizleme açık kalır; tekrar denenebilir veya vazgeçilebilir. Başarılı API dönüşü yalnız mevcut **paylaşım ekranı açıldı** durumunu yazar, teslim/alındı/onaylandı sayılmaz.
6. Patron SP1 mesajını ve aynı paketin tüm dosyalarını Asistan'a ekler, kartları kontrol edip kaydeder. Patron önizlemesi kayıt türlerini, beklenen/eklenen dosya sayılarını, daha önce alınan satır sayısını ve henüz kaydedilmediğini açıklar. Tekrar paylaşılan aynı kimlik ikinci kayıt oluşturmaz.

## Teknik gerekçe ve sınırlar

[MDN Navigator.share](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share) transient user activation gerektirir. Önceki akış fotoğraf Cache okumaları, imza görseli hazırlığı ve mesaj sıkıştırmasından sonra native paylaşımı çağırıyordu. Yeni patron paketi akışında bu işler **önceden** biter; ayrı düğmenin click işleyicisinde hiçbir await veya hazırlık yapmadan `navigator.share` çağrılır. Üreticiye özgü WhatsApp teslim garantisi verilmez.

Paylaşım tıklamasında localStorage'dan kayıtlar ve bağlantı eşzamanlı kontrol edilir. Seçilmiş kayıt silinmiş/değişmişse, bağlantı değişmişse veya süresi dolmuşsa eski paket paylaşılmaz. Bağımsız yeni kayıtlar paketi geçersiz kılmaz. Native paylaşım sonrasında yerel durum yazılamazsa kayıt beklemede kalır ve aynı kimlikle tekrar denenebilir. Modal açıkken arka plan inert; focus/ESC ve object URL temizliği uygulanır. Ana ve bağımsız şoför ekranında güncelleme hazırlık/paylaşım süresince engellenir.

Fotoğraflı paylaşım desteklenmezse dosyasız gönderime sessizce düşülmez. Yalnız metin paketi için native paylaşım yoksa kullanıcı tıklamasıyla WhatsApp bağlantısı açılır; açılır pencere engellenirse durum ilerlemez. Büyük listeler mevcut 3600 bayt mesaj/20 dosya/20 MiB kurallarına göre bölünür; kalanlar otomatik paylaşılmaz.

Veriler hâlâ şoför cihazında localStorage ve Cache Storage'dadır. Sunucu, otomatik WhatsApp gönderimi veya teslim makbuzu eklenmedi. WhatsApp dosya sırasını değiştirebilir; patron fotoğraf eşleşmelerini kontrol etmelidir. Müşteriye ayrı dijital PDF fişi hazırlama/gönderme ekranı bu pakette yeniden tasarlanmadı. Fiziksel Android/iPhone native paylaşımı ayrıca kullanıcı kabulü gerektirir; otomasyon bu çağrıyı taklit eder.

## Doğrulama

- Node model testleri: eski kayıt/bağlantı, silinen kayıt, süre dolumu ve bozuk liste kontrolü.
- Gerçek Chromium/IndexedDB/Cache: kayıt sonucu, önizleme, mobil ölçü, sıfır erken paylaşım, iptal/hata/yeniden deneme, doğrudan click çağrısı, aynı kimlik, desteklenmeyen dosyalı paylaşım, engellenen metin penceresi, native dönüşten sonra depolama hatası, güncelleme kilidi.
- Önceki şoför kurtarma testleri ve imzalı patron içe alma: dört kayıt türüne sekiz fotoğraf, tekrar pakette tek iş, değiştirilmiş kod reddi, çevrimdışı kuyruk, çoklu sekme, eksik fotoğraf ve kota hataları.
