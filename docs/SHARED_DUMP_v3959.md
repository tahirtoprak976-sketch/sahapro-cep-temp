# SOLO v3.9.59 — Ortak ön ödemeli döküm hesabı

## İşletmedeki kullanım

**Daha Fazla → Ortak Döküm Hesapları → saha**. İş kartındaki Döküm Maliyeti / Ortak Hesap bağlantısından da açılır. Hesap firmaya/sahaya aittir; farklı araçlar aynı bakiyeyi kullanır. Araç/müşteri filtresi yalnız işleri ve fişleri süzer, ortak bakiyeyi değiştirmez. Her kayıt kullanıcı kontrolüyle kaydedilir.

1. Geçmişe geçişte sahanın bildirdiği **gün başı açılış bakiyesini** tarih ve kaynağıyla girin. Aynı günün yükleme ve kesintileri bu tutara dahil değildir. Gün sonu bakiye biliniyorsa ertesi günün açılışı olarak kullanın. Tek aktif açılış vardır; düzeltmek için önce gerekçeyle iptal edilir.
2. **Para Yükle:** gerçekten yatırılan tutar, tarih, ödeme bilgisi, dekont referansı, isteğe bağlı barkod ve orijinal fotoğraf/PDF. Personel cebinden ödeme varsa personel seçilir; mevcut personel masraf iade takibinde Bekliyor olarak korunur. Yükleme faaliyet gideri değildir.
3. **Gerçek Döküm Kesintisi:** sahadaki gerçek fiş/ekstre tutarı, araç, fiş no veya açıklama, kapsanan sefer, varsa net ton ve ilgili iş. Tutar tahminle doldurulmaz. İş henüz belli değilse araçlı fiş kaydedilip daha sonra aynı araç/saha işine bağlanır. Bağlamak yeni kesinti oluşturmaz; mevcut iş tahmini gerçek maliyetle yer değiştirir.
4. Ödeyen açıkça seçilir: **ortak hesabımız**, **şirket ayrıca ödedi**, **müşteri doğrudan ödedi**. Yalnız ortak hesaptan ödeme ön ödemeyi azaltır. Şirketin iki ödeme türü maliyettir; müşterinin doğrudan ödediği fiş şirket gideri değildir. Döküm dahil işte fiş eklemek müşteriye ayrıca TL borç yazmaz; müşteri işinin anlaşılmış fiyatı korunur.
5. **Sahadan Para İadesi:** gerçek iade ön ödemeyi azaltır; faaliyet maliyeti veya müşteri tahsilatı oluşturmaz. Banka/kasa hareketi bu ekrandan otomatik yazılmaz; gerçek ödeme/iade bilgisi ve referans saklanır.
6. **Bakiye Karşılaştır:** sahanın gün sonu bakiyesini ve tarihini girin. Aynı günün kayıtlı bakiyesiyle fark gösterilir. Fark kendiliğinden düzeltme veya ödeme oluşturmaz.

Örnek: yükleme 20.000 TL; A aracı fişi 3.000 TL; B aracı fişi 4.000 TL → ortak bakiye **13.000 TL**, iki işe toplam **7.000 TL** maliyet. Yükleme ve kesintiler birbirine eklenerek 27.000 TL masraf yapılmaz.

## Gerçek tutar, tahmin ve fatura

- Kayıtlı bakiye = gün başı açılışı + gerçek yüklemeler − ortak hesaptan doğrulanmış kesintiler − iadeler. Açılış öncesi hareketler tekrar sayılmaz. Eksik eski yüklemeler yüzünden negatifse gerçek kesinti gizlenmez; kullanıcı eksik geçmişi incelemeye yönlendirilir.
- İşin tonajı × tarifesi veya aracın ortalama yükü yalnız maliyet tahminidir. Kesinti kontrolü bekleyen işler ve tahmini bakiye ayrı gösterilir. Ton/tarife yoksa bilinmeyen tutar açıkça belirtilir. Yeni toplu iş formunda tonajın toplam mı sefer başı mı olduğu seçilebilir; eski belirsiz tonajlar kesin fiş yapılmaz.
- Fişli bölüm gerçek maliyettir; kısmen fişlenen işte kalan sefer kontrol bekler. Henüz fişlenmemiş iş tahminleri mevcut maliyet raporunda tahmin etiketiyle kalır. Bu nedenle toplam masrafın tamamı belgeli gerçekleşmiş maliyet demek değildir. Genel masraf sayfası tahmin bölümünü ayrıca açıklar.
- Yeni işte tahmin tarifesi kaydedilir. Tarife değişiminde önce eski kaydedilmemiş tarife kopyaları dondurulur. Bilinmeyen eski tarife geçmişi sonradan doğrulanmış gibi üretilmez. Gerçek fiş tutarı tarifeden bağımsızdır.
- **Fatura ödeme kanıtı değildir.** Asistandaki eski “faturayı ödenmiş say” seçeneği kaldırıldı. Fatura yalnız belge olur. Kullanıcı dönem başlangıç/bitişini belirtirse o dönemin ortak hesap fişleriyle karşılaştırılır; kendiliğinden 31 günlük dönem seçilmez. Kredi, kesinti veya ikinci gider oluşturmaz. Eski `invoice_paid` varsayımları silinmez fakat gerçek yükleme bakiyesine katılmaz; ayrı uyarılır.
- Eski sıradan Döküm gideri otomatik yükleme sayılmaz. Gerçek yükleme olduğu doğrulanırsa tek tek dönüştürülebilir. Gerçek sefer maliyetiyse aynı tutar/araç/sahadaki fişe bağlanır ve genel/işletme maliyetinde ikinci kez sayılmaz. Borç, banka, dağıtım veya yedek parça bağlantılı gider bu yolla taşınamaz.

## Bütünlük, belgeler ve yükseltme

Yeni `dump_entries` deposu, IndexedDB sürüm 6, yedek şeması 6. v5→v6 açılışından önce mevcut kayıtların ve dosyaların telefon içi kurtarma kopyası alınır; eski işletme kayıtları para hareketi uydurularak taşınmaz. Şema 5 yedekleri kabul edilir.

Yeni yükleme + gider bağlantısı + belgeler + audit aynı transaction içindedir. Aynı işlem anahtarı ve içerik tek kayıt döndürür; içerik çakışması ve iptal edilmiş işlemin tekrarı reddedilir. Aynı saha/tarih/normalize fiş no farklı araçtan da gelse ikinci kez yazılmaz. Dekont referansı varsa aynı tarih/tutar/referanslı yükleme reddedilir. Referansı olmayan gerçekten ayrı işlemler yalnız tutar benzerliği nedeniyle silinmez.

Bağlı fişin seferi işin toplamını aşamaz; araç/saha farklılığı reddedilir. Tutar, takvim tarihi, tonaj, sefer ve aktif kaynaklar denetlenir. Bağlı iş/gider/kart doğrudan silinemez veya finansal bağlamı değiştirilemez. Gerekçeli iptal audit ve dosyayı korur; yükleme iptalinde bağlı yükleme gideri de iptal edilir. Eski gider bağlanmış fiş ancak gideri de iptal etme açıkça seçilirse iptal edilir. Aktif maliyet dağıtımı varken önce dağıtım çözülür.

JPEG/PNG/WebP/PDF için mevcut özgün belge doğrulaması: en fazla 8 dosya, dosya başına 15 MB, toplam 30 MB. Bozuk fotoğraf reddedilir. Hash aynıysa aynı işlemde tek dosya saklanır; orijinal baytlar korunur. Belge işlem detayından açılır/indirilir. Tam ve parçalı yedek kapsamındaki kayıt deposuna dahildir. Geri yüklemede aktif kaynak, gider karşılığı, mükerrer fiş/işlem, sefer ve tarife kopyası bağları kontrol edilir; uygunsuz yedek işletme verisine yazılmaz. Döküm faturalarının `dump_site` belge sahibi de geri yükleme doğrulamasına alındı.

Form açıkken veya kayıt sürerken uygulama güncellemesi engellenir. Kaydedilen hesap ve belgeler çevrimdışı açılır. Kaydedilmemiş döküm formu cihaz taslağı olarak saklanmaz; kullanıcı formdan ayrılmadan kaydetmelidir. Yeni özellik ayrı cihazları senkronize etmez; gerçek saha/barcode servislerine bağlanmaz. Düzenli, belgeleri içeren tam yedek alınmalıdır.

## Araştırma dayanağı ve sınırı

23.10.2026 tarihinde birincil kaynaklar incelendi:

- [İBB — Atık Bertarafı](https://cevre.ibb.istanbul/atik-yonetimi-mudurlugu-sube-mudurlugu/atik-bertarafi/): inert atık için ön ödeme/dekont ve barkodla giriş süreci açıklanıyor. Bu prosedür tüm hafriyat sahalarının değişmez kuralı olarak alınmadı; ortak hesap modelinin asıl dayanağı işletme sahibinin doğruladığı kendi çalışma şeklidir.
- [İSTAÇ — Hafriyat Toprağı Yönetimi](https://www.istac.istanbul/faaliyet-alanlarimiz/atik-yonetimi/hafriyat-topragi-yonetimi): Döküm Ekstresi Talep Formu ve Para İade Dilekçesi bağlantıları bulunuyor. Ekstre ve iade ayrı işlem olarak desteklenir; bu sayfa muhasebe kuralının kanıtı diye sunulmaz.

Güncel tarife/izin koşulları kesin varsayılmadı; sahalardaki eski kullanıcı tarifeleri internetten yeni rakamlarla değiştirilmedi. Hesap ekranı hukuki/mali beyan veya İSTAÇ çevrimiçi hesap bakiyesi değildir.

## Tekrarlanabilir doğrulama

- `node tests/dump-ledger.test.mjs`: ortak araçlar, maliyet tekliği, müşteri borcu yokluğu, ödeyen, gerçek/tahmin ayrımı, açılış ve tarih, tarife kopyası, ton kapsamı, mükerrer ve bozuk yedek.
- `python tools/e2e/shared_dump.py [URL]`: gerçek Chromium/IndexedDB/SW ile 20.000→13.000 örneği, filtre, orijinal belge, çift gönderim/eşzamanlı mükerrer, dosya reddi ve transaction ortası hata, kaynak koruması, tarife, fatura dönemi, işsiz fişi bağlama, gider tekliği, personel iadesi, saha iadesi, açılış, gerekçeli iptal, ayrı profile tam yedek dönüş, çevrimdışı ve 320/360/768 px.
- `python tools/e2e/shared_dump_assistant.py [URL]`: fotoğraflı fatura önizlemesi yalnız belge kaydeder; ödeme varsayılmaz. Asistandaki gerçek yükleme tek karşılıklı bağlantı oluşturur, faaliyet giderine girmez. Model yanıtları taklittir.
- `python tools/e2e/shared_dump_migration.py [URL]`: gerçek v5 DB→v6, eski satır/dosya ve yükseltme öncesi kurtarma kopyası, eski tahminin tarife değişiminde korunması, bozuk yedeğin hiçbir işletme satırı yazmadan reddi, şema 5 yedeğinin ayrı v6 profile dönüşü.
- Mevcut asistan, şoför, müşteri yakıtı, fiş kurtarma, güvenli yedek/güncelleme, parçalar, defter bağlantıları, menüler, metraj ve sözleşme tarayıcı suitleri; tüm Node test dosyaları, modül sözdizimi ve service-worker varlık denetimi.

Yerel doğrulama: **115/115 Node test dosyası**, **159/159 JS sözdizimi**, **158 SW modülü**; mevcut 14 tarayıcı suiti ve 3 yeni döküm suiti.

Tarayıcı testleri yalıtılmış profillerde uydurma TEST verisi kullanır. Gerçek müşteri verisi, gerçek ödeme ve gerçek Gemini çağrısı kullanılmaz. Fiziksel telefon kabul testi yapılmış sayılmaz. Yayından sonra Pages commit'i, değişen uygulama dosyalarının bayt eşitliği ve yayımlanan URL üzerinde ortak hesap/yükseltme akışları ayrıca doğrulanır.
