# SOLO v3.9.88 — fiş, hakediş ve yedek kayıt bütünlüğü incelemesi

Taban: canlı v3.9.87, `66da1caaed0437c1e0673ac96c17b5b00efbaaf8`.
Şema 7 kalır. YZ2 ayrı kalır. Telefonun mevcut işletme kayıtlarına toplu dönüşüm uygulanmaz.

## Doğrulanmış yedi bulgu

Her satır `tools/e2e/integrity_review88.py --baseline-proof` ile değişmemiş v3.9.87 üzerinde yeniden üretilmiştir. Varsayılan test modu aynı hataların engellenmesini bekler; taban kanıtı yayın testi sayılmaz. Veriler geçici Chromium profillerinde oluşturulan TEST verileridir.

| Bulgu | Önceki sonuç | Onarım |
| --- | --- | --- |
| Koşullu mazot düzeltmesi taslak hakedişin kaynak fiyatını değiştirebiliyor | 1.000 TL'lik iş 0 TL + 75 L olurken taslak hakediş 1.200 TL kalıyor | `updateIf`, güncel hakediş ve fiş ilişkilerini yazma transaction'ında denetler. Mazot incelemesi taslak hakedişli işi de kilitli listeler. |
| İmzalı dijital fişin kaynak işi silinebiliyor | İmzalı fiş duruyor, iş müşteri listesinden kayboluyor | Aktif fişe bağlı kaynak iş aynı transaction içinde korunur. İş detayında silme kapalıdır; eski açık ekran da kaydı silemez. |
| İmzalı fişin kaynak hizmeti değişebiliyor | Fiş 1 saat, müşteri işi 2 saat oluyor | Tarih, müşteri, şantiye, araç, personel, iş türü, miktar, birim ve kaynak fiş bağlantısı genel düzenlemede korunur. Fiyat ve not tamamlanabilir. İmzasız yeni fişin kendi düzeltme yolu korunur. |
| Geri yükleme başka sekmenin yeni düzenlemesini ezebiliyor | Yedek önizlemesinden sonra yazılan iş notu eski yedekle değişiyor | Yazılacak/silinecek satırların önizleme temeli yazma kilidi altında karşılaştırılır. Eskiyen işlem bütünüyle reddedilir. İlgisiz yeni kayıtlar birleştirmeyi engellemez. |
| Eski revizyon durumundaki imzalı fiş yedekle değişebiliyor | İmzalı eski fişin miktarı 1 → 9 yapılabiliyor | İmza tarihi/eki olan fiş durum etiketinden bağımsız korunur. İmzalı sözleşmenin imza tarihi/snapshot'ı da korunur. |
| Yeni telefon geri yüklemesi eşzamanlı bakımın aracını silebiliyor | Yeni bakım duruyor, başlangıç kartı sanılan araç siliniyor | Başlangıç kartlarını ayıklama kararı güncel işlem geçmişiyle transaction içinde yeniden doğrulanır. Yeni bakım varsa tüm geri yükleme durur; araç ve bakım korunur. |
| Eski sekmenin iptal işlemi yeni imzayı silebiliyor | Bir sekme fişi imzaladıktan sonra diğer sekmenin eski iptali imza bağlantısını düşürüyor | İmza kilidi son yazma anında da denetlenir. Fiş/sözleşme imzalama ve eski fişi revizyon durumuna geçirme sürüm damgasını kesin artırır. |

## Normal kullanım

- Fişe bağlı işin fiyatı ve iç notu iş düzenleme ekranından tamamlanabilir. Hizmet alanlarının korunması ekranda açıklanır.
- İmzasız, henüz fiyatlanmamış yeni fişin hizmet düzeltmesi fiş ekranında iş ile birlikte yapılabilir. İmzalı içerik eski imzayla değiştirilmez.
- Mazot ve sözleşme bağlantısı toplu işleminde sonradan kilitlenen satır varsa değişmeyen/atlanan sayısı ve ilk hata açıklanır; başarı gösterilip geçilmez.
- Eskiyen yedek işlemi herhangi bir satırı değiştirmeden reddedilir. Kullanıcı güncel durumu yeniden önizler. Birleştirme sırasında ilgisiz yeni kayıtlar korunur.
- Silme engeli veri kaybını önler. Eski tutarsız fiş/iş kayıtları otomatik eşitlenmez; gerçek hizmeti değiştiren düzeltme ayrıca incelenmelidir.

## Kontrol kapsamı

Kaynak incelemesi kayıt oluşturma/düzenleme/silme sınırları, koşullu güncellemeler, imza ve fiş ilişkileri, hakediş kesinleştirme, nakit/banka/cari ilişkileri, yakıt-tank ve döküm hareketleri, kart birleştirme, parça-garanti maliyet bağlantıları, asistan onayı/tekrar koruması, dosya güvenliği, yedek ve çevrimdışı güncelleme yollarına odaklanır. Mevcut regresyon testleri bu alanlarda genişletilmeden korunur.

Yeni tarayıcı suiti yedi hata senaryosuna ek olarak dört kontrol içerir: gerçek iş formunda fiyat/not tamamlama ve imzayı koruma; koşullu işlemin bir kez yazması ve korunan hakedişin kesinleşebilmesi; gerçek IndexedDB istek hatasında tam geri dönüş ve güvenli yeniden deneme; iki imzalı sözleşmenin korunması ve iptal/silinmiş taslağın imzalanmaması. İki sekmeli yarışlarda yalnız bekletme noktası ölçüm için araçlandırılır; imzalama, düzenleme ve yazma gerçek üretim fonksiyonlarıyla yapılır. 320/390/768 px görünüm kontrol edilir.

`tests/integrity-review88.test.mjs`, geri yükleme karar katmanını yeni kimlik çakışması, değişmiş/silinmiş kayıt, yeni bakım, ilgisiz kayıt, değiştirilmemiş girdi ve taslak hakedişli mazot incelemesiyle sınar.

CI bütün Node dosyalarını, 62 tarayıcı suitini, v3.9.87 dahil 18 kurulu sürüm yükseltmesini ve değişmemiş tabandaki yedi hatanın yeniden üretimini çalıştırır. Sonuçlar ilgili commit'in Actions kaydından değerlendirilir; pipeline tanımı tek başına PASS kanıtı değildir.

## Sınırlar

Bu çalışma bütün olası hataların bittiği iddiası değildir. Gerçek telefondaki kayıtlar, gerçek Gemini okuma doğruluğu ve WhatsApp teslimi burada ölçülmez. Yeni sunucu veya muhasebe yöntemi eklenmez. Geçmiş hatalı veriye tahmini fiyat, stok açılışı veya otomatik kayıt düzeltmesi yazılmaz.

Sürüm `SAHAPRO SOLO v3.9.88`; önbellek `sahapro-solo-v3-20261030-integrity-review-88`.
