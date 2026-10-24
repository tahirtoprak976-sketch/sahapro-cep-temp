# SOLO v3.9.68 — Kayıt bazında iç not ve kaynak mesaj

Asistan kaydında `source = "Asistan: " + mesajın ilk 1200 karakteri` bütün iş ve
yakıtlara aynı şekilde yazılıyordu. Bu değer bazı gider, tahsilat, depo ve
personel kayıtlarında da açıklama olarak kullanılıyordu. İş geçmişindeki
`description`/`internal_note` ayrıca müşteri ipucu ve mazot kuralı taramalarına
giriyordu; dolayısıyla ortak toplu not yalnız görüntüyü kalabalıklaştırmıyordu.

## Görünüm ve yeni kayıtlar

- Yeni işin iç notu ve yakıtın açıklaması yalnız kendi kaynak parçasını içerir.
  Ham mesajın bütünü ayrı `assistant_origin` alanında korunur; eski 1200 karakter
  kesmesi bu yeni kaynak alanına uygulanmaz. Kaynak kimliği/tekrar kontrolü ile
  not metni ayrı tutulur.
- İş detayında/düzenleyicisinde, yakıt ve bakım listesinde ve ortak detaylarda
  **Tam kaynak mesajı göster** başlangıçta kapalıdır. Listeye bütün sohbet
  dökülmez. Tam kaynak, müşteri PDF'sine veya CSV açıklamasına eklenmez.
- Önceden yazılmış `Asistan:` / `Bildiren: … · Asistan:` notları okunurken ilgili
  mesaj ayrılır. Sadece ekranı açmak eski kaydı, audit'i, miktarı veya maliyeti
  değiştirmez. Elle yazılmış sıradan notlar olduğu gibi kalır.
- Eski işin düzenleyicisi yerel notu gösterir. Kullanıcı Kaydet'e bastığında
  eski notun tamamı ayrıca kaynak kanıtı olarak saklanır; elle yaptığı yeni not
  düzenlemesi sonraki açılışta ezilmez.

Kaynak alıntısı kendi mesajında bulunmalıdır. WhatsApp'ın kısa/uzun tarihli,
köşeli parantezli veya Android başlıkları ve eski tek satıra çökmüş başlıkları
ayrılır. Araç/plaka, müşteri, gönderen ve litre/miktar bağlamı kullanılır.
Bilinen başka araç/müşteri satırı ilgili kayda yazılmaz. Birden çok eşit aday
varsa veya alıntı bütün paketi içeriyorsa rastgele ilk satır seçilmez; **Kayda
ait mesaj kesin eşleştirilemedi** uyarısıyla tam kaynak incelemeye bırakılır.
Bu kaynak eşleşmesi gerçek kayıt alanlarını düzeltme yetkisi vermez.

Eski sürüm yalnız ilk 1200 karakteri sakladıysa kaybolmuş son bölüm üretilemez.
İlgili mesaj bulunamadığında o kayda başka müşterinin mesajı yazılmaz.

## Genel taramada düzeltilen yollar

- İş, yakıt, depo girişi, gider, tahsilat, personel, müşteriye yakıt ve fiyat/
  ödeme sözü notları ortak kaynak katmanını kullanır. Kullanıcının kontrol
  kartına yazdığı açıklama korunur. Bakım gibi mevcut yerel açıklamalara ham
  sohbet eklenmez; tam kaynak ayrı kalır.
- Toplu geçmiş iş/yakıt kaydı kendi kaynak satırını kullanır. İmzalı şoför
  aktarımında not, doğrulanmış paketteki tek kayıttan oluşturulur; uzun SP1 kodu
  kısa nota girmez. Kimlik, imza kontrolü ve tekrar önleme mantığı değiştirilmez.
- Eski toplu notun ilgisiz bölümleri müşteri geçmişi, benzer müşteri önerileri,
  asistan kayıt araması, yakıt denetimi, mazot kuralı metni ve iş/yakıt liste
  aramalarına taşınmaz. Kullanıcının açıkça yazdığı normal notlar bu kapsamda
  silinmez.
- Toplu personel mesajındaki başka birinin “ücretsiz/yıllık izin” sözü,
  kaydedilen personelin izin açıklaması yerine kullanılmaz.
- Ortak rapor/PDF/CSV açıklamaları yerel metni kullanır. Kaynak metinler HTML
  olarak çalıştırılmaz; ekranda kaçırılmış düz metindir. `assistant_origin`
  müşteri belge alanı değildir.

DB sürümü 6 kalır. Toplu veri dönüşümü, geçmiş kayıt silme, tutar/fiyat, cari,
hakediş veya stok düzeltmesi yapılmaz. Yeni kaynak alanı normal tam yedekte
korunur; kontrol kullanıcı onayıyla mevcut kayıt akışından geçer.

## Test kapsamı

`record-notes.test.mjs` U55/(43) lt, birden çok gönderen/müşteri/araç, geçersiz
ve toplu alıntı, tarih başlıkları, tek satıra çökmüş sohbet, eşit adaylar,
kesilmiş kaynak, elle not ve müşteri ipucunun kirlenmemesini sınar.

`record_notes.py` anonimleştirilmiş aynı biçimdeki örnekle gerçek Chromium/IDB
üzerinde eski görünümün sıfır yazma yapmasını, iş düzenlemesinde kaynak koruma,
yeni iki iş/iki yakıtın ayrı notları, 1200 karakterden uzun tam kaynağı saklama,
HTML çalışmaması, değişmeyen tarih/miktar/stok, müşteri PDF'sine kaynak
sızmaması, mobil genişlikler ve temiz profilde yedek geri yüklemeyi sınar.
Yapay zekâ yanıtları taklittir; gerçek telefon verisi kullanılmaz.

Doğrulama: 123/123 Node test dosyası, 173 JS sözdizimi dosyası/172 SW modülü;
`record_notes`, `assistant_batch`, `assistant_workflow`, `assistant_agent`,
`bulk_entry`, `bulk_entry_race`, `parts_ledgers`, `denetim`, `kismi`,
`transaction_errors` tarayıcı suitleri geçti. Son kaynak koruma değişikliklerinden
sonra 123 Node dosyası, `record_notes` ve `assistant_agent` tekrar geçti.
Gold kümesinde 80 mesaj/369 doğru alan, 756 mutasyonda sessiz yanlış 0.
Önizleme üretimi de geçti.
