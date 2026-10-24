# SOLO v3.9.65 — Asistandan toplu geçmiş iş girişi

Mesajı asistana gönderip **Geçmiş (ödenmemiş) işleri toplu kontrol et** düğmesine
basın. Aynı eksik müşteri/araç/şantiye için tek ortak soru gelir. Mevcut kartı seçin,
yeni kartı açıkça seçin veya ilgili satırları dışlayın. Sorulara cevap vermek
iş/müşteri kaydı yazmaz. Ana firma ve taşeron kapsamları ayrı kalır.

Özet seçili hazır işlerin müşteri/birim toplamını gösterir. **Onayla ve N kaydı
yaz** yalnız hazır seçimi yazar. Eksikler, kaydedilmişler, olası tekrarlar ve
paket içi tekrarlar nedenleriyle görünür. Hazır kayıtların tek tek kutularını
işaretlemek gerekmez; istenen satır seçimden çıkarılabilir veya düzeltilebilir.

Fiyatlar bu geçmiş akışında bekler: model fiyatı, güncel fiyat listesi/sözleşme,
mazotla ödeme ve saha kuralları otomatik uygulanmaz. Fiyat `null` kalır; 0 TL
anlaşma veya litre hakkı yaratılmaz. Fiyatlı veya farklı türdeki işlemler mevcut
ayrıntılı akışlarından incelenir. Geçmiş mazot anlaşması bugün tanımlı kurala göre
otomatik kurulmaz; kazanılan litre ile alınan yakıt birbirinden ayrıdır.

## Yakıt ve devam

Bu sürüm toplu geçmiş yakıtta yalnız **Depo Tankı** çıkışını destekler. Paket için
yakıtın daha önce stoktan düşülmediğini bir kez doğrulayın. Kaynak belirtilmemişse
ortak soruyla gerçek kaynak istenir; istasyon/müşteri yakıtı ayrı akışta kalır.
Depo gerçek tarihlerle sınanır; ileriki giriş önceki çıkışı karşılamaz. Geriye
dönük yeni çıkış, daha sonraki mevcut çıkışları da eksiye düşüremez.

Stok yetmezse iş hazır kalabilir. İşi kaydedin; yakıt taslakta beklesin. Sayfa
yenilendiğinde **Toplu taslağa devam et** ile geri dönün. Gerçek geçmiş giriş veya
açılış kaydını ekledikten sonra **Önizlemeyi yenile** düğmesine basın. Daha önce
kaydedilmiş işler yeniden yazılmaz. Sahte stok girişi veya kaynak değiştirme
önerilmez.

## Kayıt bütünlüğü

- Saf karar katmanı mevcut ayrıştırıcıları, isim/ana firma kapsamını ve iş/yakıt
  benzerlik imzalarını kullanır. `JCB 20 saat` gibi miktarın makine kodu sayıldığı
  durumda mevcut mesaj motorunun açık miktar/birim kanıtı kullanılabilir; yeni
  regex ayrıştırıcısı veya model değiştirilmedi.
- Kaynak kimliği özgün mesaj/metin parçasına bağlıdır; düzeltme, kart sırası ve
  seçim değişikliği kimliği değiştirmez. Kaynağı bağlanamayan satır kullanıcıya
  sorulur. Benzer iş imzası kesin tekrar değildir; ayrı kayıt kullanıcıca seçilir.
- Kalıcı `op:bulk:*` fişi, gerçek kayıtla aynı transaction'da yazılır. `request_id`
  alanının tek başına yakıtta/işte tekillik sağladığı varsayılmaz. Geri alınmış
  kaynaklar da otomatik yeniden oluşturulmaz. Değişen kaynak yorumu inceleme ister.
- Hazır seçimin kartları, işler, yakıt/depo çiftleri, audit, kaynak fişleri ve
  taslak sonucu tek IDB transaction'ındadır. Seçilmemiş satırın yeni kartı açılmaz.
  Transaction içinde güncel kart, stok, sohbet ve taslak revizyonu tekrar okunur.
  Değişiklik varsa sıfır yazmayla önizleme yenilenir. Yedek alınamazsa kayıt başlamaz.
- Yeni kart, ana firma ve şantiye sahipliği aynı yazma kilitleri altında kontrol
  edilir. İki eşzamanlı onaydan yalnız biri aynı revizyonu uygular.
- Geri alma yalnız bu onayın eklediklerini kapsar. Sonradan değişen/bağlanan
  kayıtlar transaction içinde de kontrol edilir. Kaynak fişi geri alma işaretini
  korur. Taslak sohbet kimliğine bağlıdır; yeni sohbet eskisini yeniden canlandırmaz.
- DB sürümü 6 kalır; kayıt silme veya toplu veri dönüşümü yapılmaz. Yeni bilgiler
  mevcut `meta`/kayıt alanlarındadır ve normal yedek kapsamındadır.

## Test ve kapsam

`tests/bulk-entry.test.mjs` ortak sorular, parantezli ana/alt müşteri, saflık,
kararlı kaynaklar, kesin/olası tekrar ayrımı, tarih, fiyat bekletme ve tarih sıralı
depo denetimini ölçer. `tools/e2e/bulk_entry.py` 20 iş/3 eksik kart/tek onay,
çevrimdışı kayıt, taslak sürdürme, yakıtın ayrı tamamlanması, gerçek request hatası,
yedek hatası, eşzamanlı onay, geri alma ve eskiyen referansları çalıştırır.
`bulk_entry_race.py` iki gerçek sekme, önizleme sonrası stok/sohbet değişikliği,
transaction içindeki alias eşleştirmesi ve geri alma kontrolü ile yazma arasına
giren düzenleme/bağlantı yarışlarını sınar.

Model yanıtları testte taklittir. Chromium, IndexedDB, transaction hataları ve
Service Worker gerçektir. Fiziksel telefon, gerçek Gemini ve WhatsApp teslimi bu
testlerle kanıtlanmaz. Kimi'nin paylaşılmamış modülündeki 12/12 sonucu devralınmadı.

Yerel doğrulama: **121/121 Node test dosyası**, 168 JS sözdizimi dosyası ve
167 SW modülü geçti. Sekiz tarayıcı suiti (`bulk_entry`, `bulk_entry_race`,
`assistant_workflow`, `assistant_batch`, `assistant_agent`, `denetim`, `kismi`,
`transaction_errors`) geçti. Gold kümesinde 80 mesaj/369 doğru alan; 756 yazım
mutasyonunda sessiz yanlış 0. Önizleme üretimi de geçti.

Sınırlar: paket başına en fazla 20 iş ve 10 yakıt; aşım açık hatadır, sessiz kesme
yoktur. Ekli fotoğraf/PDF, SP1, tahsilat, gider/bakım ve diğer karma işlem kartları
bu ilk toplu geçmiş moduna alınmaz; mevcut akışları korunur. Araç/personel kartı
eksikse mevcut doğru kart seçilir veya ilgili modülden açılır; toplu mod müşteri,
şantiye, ocak ve döküm kartını açık seçimle oluşturabilir.
