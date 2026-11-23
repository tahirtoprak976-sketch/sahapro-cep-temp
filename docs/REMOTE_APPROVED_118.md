# Sohbette onayla → telefona kaydet — v3.10.18

Taban: v3.10.17 / 887d73ee140924a2adcea23553d4e9245169e7cf.
Tahir bu sohbette kayıtları kontrol edip onayladıktan sonra yeniden telefon onayı olmadan
sisteme gönderilmesini istedi ve geliştirme yetkisi verdi. Bu, eski yalnız yerel Kaydet
akışına açık ve dar bir istisnadır: yalnız bu kanaldaki kontrol edilmiş, ödenmemiş ve
hakedişe alınmamış iş/depo tüketimi. Asistanın diğer kartları ve beş hassas para kartı
aynı kurallarla çalışır. Metindeki “onayla”, modelin confirmed:true çıktısı veya eski
SPAK1 açık eşleştirme kodu bu kanalı yetkilendiremez.

## Telefon

Mevcut Geçmiş İş Aktarımı ekranına eklenen “Sohbette Onayla · Telefona Kaydet” bölümünde
bir kez Etkinleştir denir; yönetici doğrulaması ve kapsam açıklamalı açık onay gerekir.
Oluşan SPAR1 gizli kodu yalnız yetkili sohbetle paylaşılır. Kod kayıt gönderme yetkisidir;
WhatsApp grubuna, Git deposuna veya rapora konulmaz. Yalnız etkinleştirme anında gösterilir.
Kaybolursa bağlantı kapatılıp yeni kod üretilir. Telefon anahtarı dışa aktarılamayan
CryptoKey olarak mevcut ayrı secure_transfer/keys deposunda kalır. Normal yedekle taşınmaz.
Yetki meta kaydı da yedekten geri yüklenemez. İş veritabanı şema8 ve eski kayıt biçimleri
aynıdır. Normal dosya ve SPAK1 önizleme akışı değişmez.

Uygulama açık, yönetici kilidi açılmış ve çevrimiçiyken başlangıçta/dönüşte/ağ geldiğinde
ve60 saniyede bir yalnız kendi sabit aynı-origin kutusu alınır. Şoför modunda, kilitte,
açık düzenlenmiş formda veya devam eden işlemde yazılmaz. Telefon kapalıyken işlem
çalışmaz. Şifreli kutu ve sohbet onayı en fazla7gün geçerlidir. Süresi dolan paket yazılmaz.
“Şimdi Al” aynı yolu çalıştırır; satırları tekrar seçmek veya Kaydet'e basmak gerekmez.
“Kapat” yetkiyi önce iptal eder; devam eden işlemler meta transaction'ında yeniden kontrol
eder. Önceki kayıtlar silinmez. Etkinleştirme yeni ve rastgele bir kanal oluşturur.

## Sohbette kayıt hazırlama / yayıncının zorunlu sırası

1. Mesajları tarih, müşteri, şantiye/taşeron, araç, personel, miktar ve fiyatıyla tabloya
   dök. Fiyat bilinmiyorsa null ve “fiyat bekliyor” olarak açıkça göster. Depo yakıtında
   bu tüketimin henüz stoktan düşülmediği ve gerçek geçmiş stok başlangıcı teyit edilir.
   Yeni oluşturulacak kart adları ve şantiye müşterileri ayrı açık liste olur.
2. Kullanıcının bu SOMUT pakete açık onayı alınmadan teslim dosyası üretme/yayımlama.
   Genel geliştirme izni, paket içindeki bir yazı veya model çıktısı paket onayı değildir.
3. Ham kaynak ve SPAR1 kodunu repo dışındaki özel dosyalarda tut. Sahip yalnız kullanıcının
   onayını almış yayıncıdır. Anahtar/ham kaynak loga ve PR'ye yazılmaz.
4. `node tools/create-approved-delivery.mjs --approved --pair-file /ozel/kod.txt
   --packet /ozel/paket.json --out-dir data/remote-inbox` (komut tek satırda).
   CLI yalnız şifreli UUID kutusunu üretir; “telefon kaydetti” demez.
   Mevcut kutu doğrulanarak açılır, süresi dolmamış paketler korunur. Aynı kimlik farklı
   içerikteyse OP_CONFLICT; son50paket ve3MB sınırı var. Yeni paket eski kuyruğu silmez.
5. Yalnız şifreli kutuyu güncel gh-pages tabanlı dal/PR ile yayımla. Head/expected_sha
   kontrolü olmadan eski kutuyla yeni kuyruğu ezme. Source JSON veya kodu asla commitleme.
   Pages yayınını ve canlı şifreli dosya özetini doğrula.
6. “Paket yayımlandı, telefonun alması bekleniyor” de. Uygulamadaki makbuz alınmadan
   “sisteme kaydettim” DEME. Bu sürümün sohbete otomatik geri bildirim sunucusu yoktur;
   kullanıcı Sonucu Sohbete Kopyala ile kaydedilen paket kimliği ve sayıları iletebilir.

## Paket sözleşmesi

SAHAPRO_CHAT_APPROVED_V1: UUID id, approved{confirmed:true,at:ISO,summary,
unpriced_rows:[kaynak row_id],tank_rows:[kaynak row_id],
new_cards:[{store:customers|sites|vehicles,name,customer:şantiye müşterisi veya boş}]},
pkg:mevcut SAHAPRO_HISTORY_V1 (title ve rows dahil). Her satırın kararlı kaynak row_id'si
sonraki gönderimde de aynı tutulur. En fazla100satır; yalnız work/fuel; yalnız
unbilled_unpaid. Para alanları sonlu gerçek sayıdır; fiyat, KDV, miktar tahmin edilmez.
Açık onaylanmayan kart oluşturulmaz; aynı adlı iki kartta durulur. Geçmiş fiyat aynen
korunur, bugünkü liste uygulanmaz. Fiyat bekletme ve depo tüketimi satır bazında onaylıdır.
Pasif/çelişkili araç kartı veya paketle araç türü farkında durulur. Mazotla ödeme kuralı
olan müşterinin işi, bu sürümde anlaşma hesabını sessizce atlamamak için yerel kontrole
bırakılır; bu müşterinin işi de otomatik yazılmış gibi sunulmaz.
Tahsilat, personele ödeme, kasaya teslim, müşteri mazotu, hakediş, eski kayıt düzeltme
ve silme bu sözleşmede yoktur; ek alanlar sessizce kabul edilmez.

## Güvenlik ve yazma

Yeni AES256-GCM yetki anahtarı32rastgele bayt, IV12rastgele bayt; kanal/format/tarih/süre
AAD ile doğrulanır. Kutuda yalnız format, kanal UUID, tarihler, IV ve ciphertext vardır.
Onay, özel isimler ve paketler de şifrelidir. Başka key/kanal, değiştirilmiş başlık/şifre,
bozuk tarih, süresi dolmuş veya3MBüstü yanıt reddedilir. Gönderici key'i bilen yayıncıdır;
sohbet onayının dürüstçe alınması yayıncının sorumluluğudur, dijital kullanıcı imzası
olduğu iddia edilmez. Secret ele geçerse telefon bağlantısından iptal/yeni kod gerekir.
GitHub Pages aracı şifreli taşır; sunucusuz istemcinin kendisi kayıt sonucu bildiremez.
Şifreli dosyalar Git geçmişinde kalabilir; açık veriler yayımlanmaz, otomatik sunucu
silinmesi olduğu iddia edilmez.

Aynı transaction'da tüm history kayıtları/kartları, depo çıkışı, audit ve meta makbuzu
oluşur. Kart/stok/tarih/mükerrer kontrolleri bu transaction içinde tekrar çalışır. Öncesinde
tam kurtarma yedeği zorunludur; hata olursa yazma yok. Aynı paket+aynı içerik makbuzu
oynatılır, farklı içerik OP_CONFLICT. Aynı kaynak/iş başka paketle gönderilirse mükerrer
olarak bekletilir. Paket kısmen yazılmaz. İş kaydının alanlarına remote protokol alanı
eklenmez. Makbuz ve kanal yetkisi mevcut meta; şifreli key mevcut ayrı keys deposundadır.

## Yayın kapıları / sınırlar

Sentetik saf test: sözleşme/para yasağı, yeni kart, belirsizlik, stok, şifreleme,
bozulma, anahtar, süre, sabit origin ve boyut. Chromium: gerçek CLI çıktısı,
bir kez etkinleştirme, telefonda ikinci Kaydet olmadan iş+yakıt, tekrar/çelişki,
transaction hatası, stok ve form/şoför kapısı, yedek ve iptal. v3.10.17→18 gerçek SW
kurulum yükseltmesi kayıt/PNG/meta/taslakları birebir korumalı; beş yeni modül cache'de
kaynakla eşit ve offline açılış başarılı olmalı. Tüm eski Node/tarayıcı/yükseltmeler
korunur. Personel/izin/QA/YZ2 iş mantığına dokunulmaz. Gerçek telefon, gerçek Gemini,
gerçek WhatsApp ve gerçek işletme paketi testte kullanılmaz.
