# Gerçek iş fiyatı ve finans dönemi — SOLO v3.9.95

01.11.2026, şema 7. Bu sürüm kullanıcının cihazındaki işleri kurulum sırasında otomatik fiyatlandırmaz. Açık önizleme ve Kaydet onayı gerekir.

## Kapanan akış eksikleri

Fiyat kuralı oluşturmak mevcut iş snapshot'larını tek başına değiştirmez. Eski asistan kartı başlangıçta yalnız fiyatsız işleri değiştiriyor; önceden fiyatlı işleri ayrı, işaretsiz seçenekte bırakıyordu. Şantiye alanı boş olan Tarabya kaynakları da kapsam dışında kalıyordu. Sonuçta “kural kaydedildi” doğru olsa bile kullanıcının hedeflediği işler aynı kalabiliyordu. Kaynak iş detayında birim fiyat gösteriliyor, ana para ve KDV'li toplam görünmüyordu.

“Fiyatı ... yap / güncelle / uygula” gibi açık mevcut iş talimatında artık uygun mevcut fiyatlı ve fiyatsız işler önizlemede seçilir. “Yalnız fiyat listesine kaydet” ayrı ve açık seçenektir; gelecekteki tarife isteğiyle geçmiş işler sessizce karıştırılmaz. Müşteri, şantiye, iş türü, araç ve birim koşulları birlikte korunur.

Her kaynak iş tarih, araç, miktar, mevcut fiyat ve öneriyle görünür. Birim fiyat aynı olsa da kayıtlı iş tutarı eski/bozuk veya KDV dahil esası farklıysa fiyat uygulaması tutarı ve esası yeniden hesaplar; yanlışlıkla zaten doğru diye atlamaz. Şantiye boşsa ve kaynakta seçilen yer geçiyorsa bağlantı önerilir. Tek, açık from_place eşleşmesi önizlemede seçili hazırlanır; yalnız açıklamada geçen yer kullanıcı seçimi ister. Kaynağın müşterisi/araç/iş türü farklıysa veya başka şantiye zaten kayıtlıysa değiştirilmez. Şantiyesi boş dijital fiş bağlantılı iş otomatik bağlanmaz. Hakediş ve mazot/sözleşme korumaları sürer. Her kapsam dışı işte neden gösterilir.

Mevcut işleri uygulama isteğinde değişecek iş yoksa ve hiçbir iş zaten bu fiyatta değilse işlem kaydetmeden durur. Böylece fiyat listesi kaydı, mevcut işlerin fiyatlandığı gibi sunulmaz. Yalnız listeye kaydetme açıkça seçilirse mevcut işler değişmez ve sonuç bunu söyler. Başarılı sonuç, gerçekten güncellenen her işin kimliği, tarih/miktarı, eski/yeni fiyatı, tutarı ve varsa şantiye bağlantısını gösterir. Her bağlantı kaynak kaydı açar.

Fiyat kuralı + seçili iş snapshot'ları + seçilen boş şantiye bağlantıları aynı transaction içinde yazılır. İş/miktar/şantiye/fiş/hakediş değişmişse tekrar doğrulanır. Yazma hatası fiyatları ve bağlantıları birlikte geri alır; işlem kimliği tekrarı ikinci kayıt üretmez. Geri al, bu işlemin fiyat ve şantiye değişikliklerini aynı kaynaklara döndürür. İş detayında kayıtlı ana para, KDV ve genel toplam birlikte gösterilir; KDV temeli belirsizse bu ayrım varsayımla kesin gibi sunulmaz.

## Finans görünümü

Eski Finans ana ekranı yalnız cihaz tarihinin mevcut ayını hesaplıyordu. Ayın ilk günü önceki ayın yoğun çalışmasına rağmen üç kartın sıfır görünmesi mümkündü; dönem değiştirme alanı yoktu. Bu görünüm veri silindiğini kanıtlamaz.

Artık ay seçici, Bu ay, Geçen ay, Son 3 ay ve Tümü vardır. Dönem başlık ve tarih aralığında açıkça yazılır. Varsayılan açılışta bu ay hiç kayıt yoksa en son kayıtlı ay seçilir ve bu seçim açıklanır. “Bu ay” açıkça seçilirse gerçekten mevcut ay gösterilir. Fiyatsız işlerin eksik toplam etkisi ayrıca belirtilir. Genel müşteri alacağı, ana para/KDV/tahsilat/bakiye ayrımıyla tüm tarihler için ayrı kartta gösterilir; kasa mevcudu diye etiketlenmez.

Dönem özetleri aynı monthlySeries hesap katmanını kullanır. İş değeri, tahsilat ve maliyet tanımları değiştirilmez; gelecekteki hareketler dönem toplamını şişirmez. Tahsilatın personel/kasa/banka durumları aynı dönemle süzülür. Başka sekmede iş fiyatı kaydedilince açık Finans okuma görünümü, düzenlenmekte olan formu ezmeden yenilenir.

## Kanıt ve sınırlar

- price-application95.test.mjs: eski/fiyatsız işler, açık şantiye bağlama, kapsam dışı/hakediş/imzalı fiş, sıfır işte durma, gelecek kayıtların dışlanması, boş ayın son aya geçişi ve açık dönem seçimi.
- price_application_finance.py: gerçek Chromium/IndexedDB ve taklit Gemini; geçmiş dört kayıt/toplam beş seferde 7.000 TL → 35.000 TL. Kaynak işte 2 sefer için 14.000 TL + 2.800 TL KDV = 16.800 TL; cari ve finans toplamı gerçek commit sonrasında doğrulanır. Yazma hatasında bağlantı/fiyat/kuralın atomik rollback'i, Geri al, sıfır işte kayıt yapmama, salt liste seçeneği ve diğer sekmeden finans yenilenmesi kontrol edilir.
- Değişmemiş v3.9.94 aynı TEST kaynağında yalnız bir fiyatsız bağlı işi değiştirir; eski fiyatları ve şantiyesiz Tarabya kaynaklarını bırakır. Kasım'da seçicisiz üç sıfır kartı yeniden üretilir. Bu beklenen eski hata adayın doğruluğu sayılmaz.
- Önceki fiyat kapsamı testi artık açık “yap” talimatıyla fiyatlı işin ve yapılandırılmış Tarabya kaynağının da güncellenmesini doğrular; farklı müşteri/şantiye/kamyon/hakediş korumaları sürer.
- Gerçek telefon verileri veya gerçek Gemini doğruluk ölçümü bu sentetik testlerle iddia edilmez. Önceden yanlış kapsamda kaydedilmiş fiyat kuralı/iş kendiliğinden düzeltilmez; önizlemede açık kayıt seçimi gerekir.
