# SOLO v3.9.62 — Kimi raporunun bağımsız doğrulanması

## Girdi ve kapsam

Kullanıcı, v3.9.61 (`d58e85897add668eb37c9e9ae50ae3ce6373a805`) kaynak paketini Kimi'ye inceletip rapor, bulgu JSON'u, test özeti ve altı dosyadan oluşan bir ZIP getirdi. Kimi raporu P0/P1 ürün hatası bulmadığını; beş eski tarayıcı testinde uyumsuzluk, iki tarihsel testte ortam engeli ve müşteri kartında bir okuma tasarımı notu bildirdi.

Bu rapor kaynak olarak ele alındı; içindeki sayılar otomatik olarak bizim ölçümümüz sayılmadı. İnceleme ve testlerde yalnız uydurma TEST verisi ve ayrı tarayıcı profilleri kullanıldı. Telefona, gerçek işletme yedeğine, gerçek Gemini'ye veya bir WhatsApp alıcısına erişilmedi.

## Bulguların karşılığı

| Bulgu | Bağımsız kontrol ve sonuç |
| --- | --- |
| KIMI-001 | Eski `customer_snapshot.py` paylaşım adımındaki sayaç hatası burada da tekrarlandı. Fixture yazımları yenilenmeyen ekranda hazırlanır; okuma ölçümü ekran hazır olduğunda, paylaşım ölçümü ise bekleyen gerçek teslim yenilemesi tamamlandığında başlar. Sayaç eşitliği ve salt okunur DB/audit kontrolü korunur. |
| KIMI-002 | Silinen referansın bütün seçimi yazmadan reddetmesi doğru mevcut davranıştır. `denetim.py` bu reddi ve aracı düzelttikten sonraki tek iş/tek gider kaydını ölçer. `kismi.py` hem ön denetim reddini hem de ön denetimden **sonra** gerçek maintenance transaction'ında üretilen ConstraintError ile kısmi yazım/geri alma yolunu ölçer. Bu ikinci yol ek bir gerçek ürün hatası ortaya çıkardı; aşağıda açıklanıyor. |
| KIMI-003 | `islem.py` eski DOM seçicisiyle bir sorun bildirdi. Seçim düğmelerindeki iki gerçek iş kimliği ve aday seçilmeden onay düğmesinin oluşmaması ölçülür. Kayıtların değişmemesi ve sıfır Gemini isteği kontrolleri korunur. |
| KIMI-004 | Eski `data-dep` seçicisi güncel kaynakta yoktur. Büyük simülasyon mevcut saha → TOPUP → tutar/referans → açık onay yoluna geçirildi. Yükleme `credit` alanıyla kontrol edilir. Simülasyon artık kalan WhatsApp toplu, iki sekmede aynı kayıt, Veri Sağlığı ve şifreli yedekten ayrı profile dönüş adımlarını da bitirdi. |
| KIMI-005 | ZIP'in git geçmişi içermemesi ürün hatası değildir. İki tarihsel test gerekli commit ağacını başlangıçta kontrol eder; kaynak ZIP'inde anlamsız 404/boş tar hatası yerine açıklamalı **SKIP, çıkış 77** verir. Git geçmişi olmayan geçici kaynak kopyasında iki testin de 77 verdiği doğrulandı; bu PASS yerine SKIP'tir. Tarihsel geri/ileri dönüş testlerinin tamamı bu turda yeniden koşulmadı. |
| KIMI-006 | Raporda gösterilen `m-crm.customerDetail`, normal müşteri ayrıntısının etkin yolu değildir; `pro.card` bu rotayı daha önce karşılar. Bu nedenle rapordaki dosya açıklaması aynen onaylanmadı. Bununla birlikte **etkin yolda** başlık/genel kart ile pano/ana firma bilgisi arasında karma görünüm gerçek IndexedDB üzerinde tekrarlanabildi ve düzeltildi. |

Kontrol sırasında müşteri kartının kayıt okumasına müşteri adı/ana firma ve tahsilat değiştiren bildirim göndermeyen bir TEST yazımı eklendi. Eski sürümde başlık ve genel kart eski müşteri adını, ana firma bölümü yeni müşteri adını gösterdi. Yeni sürümde müşteri kartının ilk çizimi tek `dumpAll` görüntüsünü paylaşır: kayıt başlığı, ad haritaları, genel kart, müşteri panosu, mazot ve ana firma/taşeron bölümleri aynı görüntüyü kullanır. Görüntü yalnız o render'ın context'inde tutulur; kalıcı/global önbellek değildir. İlişkisel sekmeler tıklanınca mevcut taze okuma davranışı devam eder. Mazot ekstresi paylaşımı da düğmeye basıldığında yeni veri okur.

## Ek bulgu — gerçek request hatası boş hata değeriyle kayboluyordu

Eski kısmi kayıt testi, referansı silerek ön denetimde durduğu için gerçek transaction hatasından sonraki kurtarma yoluna ulaşmıyordu. Test bu kez bakım transaction'ına aynı birincil anahtarla ikinci `add` ekleyerek gerçek ConstraintError üretti.

**Önceki gözlem:** bakım satırı ve işlem metası tamamen geri sarılıyor; fakat `putPlainOp` Promise'i `null` ile reddedilebiliyordu. Request'in `error` olayı transaction'a kabarcıklandığı anda `transaction.error` henüz dolmamış olabiliyor. `assistant.save` boş hatanın `message` alanına erişirken asıl uyarıyı ve kısmi kayıt için geri alma planını hazırlayamıyordu. Önceki ayrı işlemlerde kaydedilmiş havale/kasa/cari satırları yerinde kalıyor, kullanıcıya geri alma düğmesi gösterilmiyordu. Bu durum yalnız test beklentisi farkı değildir.

**Düzeltme:** `db.js` içindeki boş hata döndürebilen 27 transaction hata işleyicisi önce transaction hatasını, sonra request olayının hedef hatasını, son olarak açıklamalı Error nesnesini kullanır. Özel doğrulama/çakışma hataları önceliğini korur. Asistanın kayıt hata yolu da boş reddi açıklamalı hataya dönüştürür; dış uyarı yolu boş değerde ayrıca hata vermez. Hata başarıya çevrilmez; transaction'ın veri/audit/op kayıtlarını birlikte geri sarması korunur.

**Sonraki gözlem:** aynı bakım arızası ConstraintError olarak döner, bakım/audit/op artığı kalmaz; daha önce kaydedilen havale/banka/cari için açık kısmi kayıt uyarısı ve geri alma düğmesi oluşur. Geri alma üçünü birlikte kaldırır. Yeni müşteri/işin sonradan hakedişe bağlanması geri almayı engeller; bağlantı çözüldükten ve uygulama yeniden açıldıktan sonra geri alma çalışır. İki eşzamanlı geri almadan yalnız biri uygulanır. Eski işlere fiyat uygulaması da eski fiyatsız hâle döner.

Bu değişiklik mevcut gerçek kayıtları onarmaz veya silmez. DB şeması 6'dır; veri geçişi yoktur.

## Doğrulama ve ölçüm sınırı

- Kimi'nin eklediği 17 kontrol (`fake-indexeddb@6.2.6`, uygulama dosyaları değiştirilmeden ayrı dizin): **17 PASS / 0 FAIL**; son transaction hata düzeltmesinden sonra da tekrarlandı. Bu, gerçek tarayıcı/telefon kanıtının yerine geçmez.
- Yeni `transaction_errors.py`: gerçek Chromium/IndexedDB'de bakım/op, tahsilat/cari ve müşteriye mazot teslimi hataları. Her denemede Error nesnesi, değişmeyen kayıt/audit/op metası ve yarım işlem yokluğu doğrulanır. Öncesinde aynı bakım denemesi `isNull: true` döndürüyordu; sonrasında ConstraintError.
- Güncellenen `customer_snapshot.py`, `islem.py`, `denetim.py`, `kismi.py` ve `sim.py 7` geçti. Testte `FAIL` birikirse süreç artık sıfır çıkış koduyla başarılı görünmez.
- Müşteri mazot grafiği/PDF, asistan taslak akışı, müşteriye mazot satışı/stok/cari/yedek ve manuel mazot kuralı/yenileme suitleri geçti. Transaction hatasından etkilenen geri alma ve stok/cari akışları son hata düzeltmesinden sonra çalıştırıldı.
- 117 Node test dosyası, 161 JS sözdizimi ve 160 SW modülü denetlendi; son uygulama değişikliklerinden sonra tam Node denetimi tekrarlanır.

Büyük simülasyon son hata nesnesi düzeltmesinden önce bu dalda tamamlandı; bu düzeltme sonrasında hata/geri alma ve finansal bağlantı suitleri ayrıca tekrarlandı. Bu turdaki tarayıcı listesi Kimi'nin bildirdiği 68 PASS'in tamamını yeniden çalıştırdığımız anlamına gelmez. Gerçek model dil/OCR başarısı ve fiziksel WhatsApp teslimi ölçülmedi. Rapordaki “bütün kritik yazma yolları tek transaction” gibi genel ifadeler, tek tek testlerin kanıt kapsamından geniş bir güvence olarak alınmadı.
