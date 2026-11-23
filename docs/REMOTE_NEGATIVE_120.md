# Açık onaylı eksi depo bakiyesi — v3.10.20

Taban v3.10.19 /8444d496b7bc436c6881453d1d7a57b2ba5bf3d4.
Kullanıcı daha önce verdiği dört gerçek depo tüketimi için eksik girişler olabileceğini,
eksi bakiyeyi kabul ettiğini ve yakıt takibinin durmamasını açıkça bildirdi. Bu, önceki
geçmiş stok blokajına bu paket özelinde açık istisnadır. Hayali giriş/açılış, tahmini
maliyet ve geçmiş kayıt düzeltmesi yapılmaz. Asistanın diğer para güvenliği kuralları
ve zorunlu işaretsiz kartları değişmez. Bu istisna model metninden türetilemez.

## Davranış

Sohbette onaylı paket approved nesnesine isteğe bağlı negative_tank_rows eklenebilir.
Liste yalnız yakıt satırlarının kaynak kimliklerini içerir ve ayrı yakıt paketindeki
BÜTÜN satırları tam olarak kapsamalıdır. Eksik/fazla/iş satırı, boolean anahtar,
karışık iş/yakıt paketi veya normal satır içi 'kontrolleri kaldır' notu yetki değildir.
Eski paketler aynı sözleşme ve aynı özetle çalışır. Eski istemci yeni onay alanını
reddeder; önce uygulama güncellenmelidir. SPAR1 bağlantısı ve anahtar deposu değişmez.

Varsayılan history/normal aktarım stok kontrolü aynı kalır. Yalnız doğrulanmış özel
paket, mevcut tüm hareketler+planlanan çıkışların tarihli hesabında eksi bakiyeyi
uyarı olarak kabul eder. Geçersiz tarih, hareket türü veya litre yine bloklar. Yeni
kart, mükerrer, kaynak satır kimliği, işlem çatışması, yetki iptali ve transaction
kontrolleri korunur. Sahte veya sıfır açılış/giriş üretilmez. Bilinmeyen fiyat/maliyet
null kalır. Gerçek tüketim fuel_records ve bağlı ÇIKIŞ olarak bir kez kaydedilir.

Makbuz mevcut meta kaydında negative_tank_acknowledged, onaylanan kaynak kimlikleri ve
stock_warning ile izlenir. Sonuç ekranı eksi stok iznini gösterir. Depo Tankı ekranının
mevcut negatif bakiye ve tarih sırası uyarısı görünmeye devam eder; sayım yapılmış
kesin fiziksel stok izlenimi verilmez. Gerçek girişler daha sonra tarih ve miktarları
belge/sayımla doğrulanıp normal akıştan girilir. Çıkış kayıtları silinerek açık gizlenmez.

Şema8, eski iş/yakıt alanları ve eski kayıtlar değişmez. Yalnız yeni teslimin onay
sözleşmesi ve mevcut meta makbuzu ek bilgi taşır. Standart eski history seçeneği false;
UI'dan veya model yanıtından kendiliğinden aktif olmaz. Yazma tam yedekten ve aynı
transaction'daki yeniden doğrulamadan sonra yapılır. Hata tüm paketi geri alır.

## Test ve sınırlar

Yeni saf test değişmemiş v19'da bu onayı reddederek problemi gösterir; adayda açık
onayla negatif çıkış, eksik/kötü izin ve bozuk tarih/hareket/lt senaryolarını ölçer.
Sentetik Chromium: dört tüketim öncesi stok0; normal paket bloklu; açık onaylı paket
sonrası stok-10,4yakıt+4çıkış,0giriş,para/iş kaydı yok; kişi/araç bağlantıları, makbuz,
uyarı, tekrar koruması, atomik rollback, yedek ve ekran negatif tutarı kontrol edilir.
v19→20 gerçek servis çalışanı yükseltmesinde kayıt/meta/PNG/taslak baytları aynı,
şema8, cache modülleri kaynakla eşit ve offline açılış başarılı olmalıdır. Tüm eski
Node/tarayıcı/yükseltme kapıları korunur. Gerçek kullanıcı paketi test/CI'ye girmez.
Gerçek telefon/Gemini/WhatsApp ölçülmez; test verileri yalnız TEST kimlikleridir.

Kullanıcının gerçek yakıt paketi yazılım yayını doğrulandıktan sonra, daha önce
onaylanmış içerik+bu eksi bakiye izniyle ayrı şifreli kutuya eklenir. Mevcut iş paketi
kuyruktan silinmez veya değişmez. Telefon makbuzu gelmeden 'kaydedildi' denmez.
