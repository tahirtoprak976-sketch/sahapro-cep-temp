# SOLO v3.9.64 — Asistanla toplu iş kontrolü

“Fiyatlar beklesin” talimatının kayıt aşamasında fiyat listesine dönmesi,
WhatsApp gönderim tarihleriyle iş tarihinin karışması ve eşit süreli farklı
müşteri işlerinin mükerrer sanılması düzeltildi. Toplu kontrol için iki düğme
eklendi; bilinmeyen stok ve kaynak bilgisi oluşturulmaz.

## Kullanım

Asistana mesajların önünde şu talimatlar verilebilir:

> Bütün işler 7 Eylül 2026 tarihine ait. Fiyatlar bekleyecek; güncel fiyat listesini uygulama.

Açık iş taslakları varken **“Tüm işler 8 Eylül 2026 olsun”** veya **“Fiyatlar
beklesin”** cevapları, sohbet bağlamı açıkken yerel olarak uygulanır. Model çağrısı
ve iş kaydı oluşturmaz. Gün, ay ve yıl açık olmalı; “bugün/dün” de desteklenir.
Birbiriyle çelişen, geçersiz veya yılı eksik toplu tarihlerde alan boş ve
işaretsiz kalır. Açıkça verilmiş eski bir geçmiş yıl bugüne çevrilmez.

Önizlemenin üstünde:

- **İşlerin fiyatını sonra belirle:** Uygun açık iş kartlarını fiyat bekliyor
  yapar. Kayıtta fiyat listesi, mevcut sözleşme ve mazotla ödeme kuralı otomatik
  uygulanmaz. Fiyat `null` kalır; otomatik 0 TL anlaşma oluşturulmaz.
- **Hazır iş kartlarını seç:** Eksiksiz, doğrulama engeli olmayan iş kartlarını
  birlikte seçer. Eksik/tahminli, olası mükerrer, belirsiz müşteri ve şoför
  kartlarını topluca onaylamaz. Yakıt, tahsilat, silme ve diğer işlemleri seçmez.
- Her işteki **Fiyatı sonra belirle** kutusu ayrı değiştirilebilir. Pozitif birim
  fiyatın açıkça girilmesi o kartta beklemeyi kaldırır; toplu bekletme düğmesi
  tekrar kullanılabilir. Alan düzenledikten sonra toplu düğmeye ilk dokunuşun
  kaybolmaması için düğmeler yeniden çizimde korunur.

Bu işlemler taslak hazırlama/seçmedir. **Seçilenleri Kaydet** son onaydır. Mevcut
şoför onayları, işlem kimlikleri ve geri alma akışı korunur. Toplu tarih yalnız
işlere uygulanır; yakıt, tahsilat veya belgenin tarihini değiştirmez.

## Doğruluk ve güvenlik

1. Toplu talimat yalnız kullanıcının doğrudan mesaj başlığından ve açık düzeltme
   turundan okunur. Alıntı, `>` satırı ve WhatsApp göndereninin satırı toplu
   talimat sayılmaz. Serbest iş cümlesi, önceki taslağa kısa cevap sanılmaz.
2. Modelin `from_driver` alanı güven sınırında temizlenir. Bu güvenilir işaret
   ancak sonradan eklenen SP1 çözümleyicisinden gelebilir. Toplu metin talimatı
   doğrulanmış şoförün kayıt tarihini değiştiremez.
3. Doğrulanamayan model iş tarihi bugüne çekilip seçili bırakılmaz. Kullanıcı
   doğru tarihi tamamlar. Salt yıl cevabı için yeni bir yerel dil çözümleyici
   eklenmedi; toplu tarihi gün/ay/yıl ile yeniden belirtmek gerekir.
4. Mükerrer yapıştırma anahtarı müşteri, şantiye ve iş türünü de içerir. Kayıt
   öncesi benzerlik kontrolü birim, şantiye ve malzemeyi de ayırır. Aynı aracın
   farklı müşterilerde birer saatlik işleri veya farklı malzemeleri ayrı kalır.
   Gerçek tekrarlar ve işlem kimliği kontrolleri sürer.
5. Kaydetmeden önce seçili satırların referansları ve depo bütçesi güncel DB'den
   okunur. Önizleme sonrasında tüketilmiş stok, eski bakiyeyle geçirilmez.
6. Faturayı mevcut depo girişine bağlamak aynı litreyi ikinci kez eklemez;
   yalnız miktar farkı hesaba girer. Silinmiş girişe bağlantı ve aynı girişe
   birden çok seçili bağlantı reddedilir. Müşteriye yakıt satışı bütçede sayılır;
   istasyon/müşteri kaynaklı araç yakıtı depodan tüketim sayılmaz.
7. Stok yetersizse ilk iş/finans kaydından önce uyarı verilir. Kullanıcı yakıtı
   seçimden çıkarıp işleri ayrıca kaydedebilir. Uyarı, yapay bir stok girişi
   yaratmayı veya gerçekte depo yakıtını istasyon diye değiştirmeyi önermez.
8. 20'den fazla iş içeren model/aktarılmış plan açık hata verir; 21. iş ve sonrası
   sessizce atılıp ilk 20 kaydedilmez. Kullanıcı mesajı küçük gruplara ayırır.

## Testler ve sınırlar

- `tests/assistant-batch.test.mjs`: toplu tarih/fiyat ifadeleri; alıntı/WhatsApp
  ayrımı, olumsuz ifade, eksik yıl/geçersiz/çelişkili tarih, eski geçmiş yıl,
  değişmez kaynak plan, modelin şoför işareti taklidi, gerçek şoför ayrımı,
  müşteri bazlı tekrar kontrolü, seçilebilir kartlar ve güncel/faturaya bağlı stok.
- `tools/e2e/assistant_batch.py`: gerçek Chromium/IndexedDB üzerinde iki müşteri
  için eşit süreli işler; farklı gönderim tarihleri; çevrimdışı toplu cevap;
  mevcut fiyat/sözleşme/mazot kurallarına rağmen boş fiyatla kayıt; eksik yıl ve
  model tarihi; elle fiyat sonrası tek dokunuşla tekrar bekletme; sonradan azalan
  stokta sıfır iş/audit yazma; yakıttan bağımsız iş kaydı; bağlı faturada stok
  şişmesinin reddi; kalıcı native görevin tarihi/kaynağı ve mobil taşma denetimi.

Model yanıtları ve belge ham metni testte taklittir. WebCrypto, SP1, IndexedDB,
form olayları ve kayıt/geri alma işlemleri ilgili suitlerde gerçek çalışır.
Gerçek Gemini/OCR başarısı, fiziksel telefon veya WhatsApp teslimi ölçülmedi.

Yerel doğrulama: **120/120 Node test dosyası**, 165 JS sözdizimi dosyası ve
164 SW modülü geçti. `assistant_batch`, `assistant_workflow`, `assistant_agent`,
`denetim` ve `kismi` tarayıcı suitleri geçti. Gold kümesinde 80 mesaj/369 doğru
alan; 756 mutasyonda sessiz yanlış 0. Önizleme üretimi de geçti.

Bu sürüm bütün asistan talimatlarını kapsayan genel bir dil motoru değildir.
Mevcut rol/kayıt türü ayrımları devam eder. Çok türlü asistan kaydı tek atomik
transaction'a çevrilmedi; mevcut kısmi sonuç uyarısı/geri alma mekanizması sürer.
Güncel stok ön denetimi, geçmiş stok başlangıcını tahmin etmez; Geçmiş İş Aktarımı
ekranındaki tarih sıralı tank kontrolünü de değiştirmez. Kullanıcının gerçek
telefon kayıtları bu geliştirme/test çalışmasında okunmadı veya değiştirilmedi.
