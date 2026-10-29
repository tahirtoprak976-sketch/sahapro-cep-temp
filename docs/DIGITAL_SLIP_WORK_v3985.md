# SOLO v3.9.85 — dijital fiş ve müşteri işi bağlantısı

29.10.2026 kullanıcı örneği: Kendo Evleri'nin FS-000001 numaralı, 1 saatlik imzalı fişi Fişler'de vardır; Yapılan işler listesinde yoktur. Kök neden: doğrudan Yeni Fiş Oluştur yolu yalnız `slips` kaydı açıyordu. Müşteri işleri ve hakediş `work_records` üzerinden çalışır. İşten başlayan fiş ve şoför fişi zaten iş kaynağına sahipti; bunlar korunur.

Yeni fiş:

- Doğrudan oluşturulan fiş ve yeni iş tek transaction'da kaydolur. Araç zorunludur. İşlem kimliği, fiş sırası, audit ve çift yönlü bağlantı birlikte kesinleşir; request hatasında yarım iş/fiş/sıra kalmaz.
- İş, müşterinin Yapılan işler listesine eklenir. Fiyat tahmin edilmez ve mevcut fiyat listesi otomatik uygulanmaz; `price_snapshot:null` ile fiyatsız görünür. Tahsilat, hakediş veya cari hareketi oluşturulmaz.
- Benzer müşteri/tarih/araç/şantiye/miktar/birimde iş varsa mevcut işe bağlama veya açıkça ayrı iş seçimi gerekir. Başka fişi olan işe sessizce yeni fiş/iş yazılmaz. Onay sırasında araya giren aday da transaction içinde tekrar denetlenir.
- Mevcut tek işten açılan fiş aynı işi kullanır. Toplu sefer fişi mevcut işlerin toplamını kullanmayı sürdürür; yeni iş oluşturmaz. Şoför fişleri yeniden aktarılmaz.

Mevcut imzalı fiş:

1. Güncellemeden sonra müşteri Yapılan işler bölümündeki bağlantı uyarısından veya Fişler → ilgili fiş → **Fişi müşteri işlerine bağla** yolundan açılır.
2. Mevcut uygun iş seçilir; yoksa yeni iş olarak onaylanır. Eski fişte araç eksikse kullanıcı açıkça seçer. Müşteri, tarih, miktar ve birim fişten gelir; başka müşteriye/ana firmaya tahminle yazılmaz.
3. İmza, imza zamanı, teslim alan ve müşteri PDF içeriği korunur. Yalnız iş bağlantısı metadatası eklenir. Aynı fiş iki sekmeden onaylansa veya yanıt kaybolup tekrar denense de bir iş oluşur.

Güncelleme eski fişleri topluca işe dönüştürmez. Bazı hizmetler daha önce elle girilmiş olabilir; otomatik aktarım mükerrer borç doğurabilir. Bağsız fişler iş/TL toplamına eklenmeden açık uyarı olarak gösterilir. Kaynağı silinmiş fişten ikinci iş açılmaz; kaynak incelemesi istenir. Yanlış/eksik bağlantı ve revizyonla değişen hizmet bilgisi görünür uyarı taşır.

Taslak ve revizyon:

- Bu fişten yeni açılmış, henüz fiyatsız ve finans kaydına bağlanmamış iş, taslak hizmet düzeltmesiyle birlikte atomik güncellenebilir. Fiyat/hakediş/başka finans bağlantısı oluşmuşsa fiş üzerinden iş değiştirilmez.
- Önceden var olan işe bağlanmış fiş hizmeti kaynak işten alır; açıklama ve teslim alan düzenlenebilir. Kaynak değişmişse kontrol istenir.
- İmzalı fiş değişmez. Revizyon yeni belge açar, yeni iş veya borç açmaz; hizmet farklıysa kaynak işin ayrıca incelenmesi gerektiği belirtilir. Fiş iptali bağlı işi otomatik silmez.
- Serbest hizmet metni korunur; yalnız bilinen iş türlerinin birebir harf/boşluk farkları normalleştirilir. Özel iş türü düzenleme formunda kaybolmaz. Araç adından plaka uydurulmaz.

Doğrulama: `tests/digital-slip-work.test.mjs` saf kararları; `tools/e2e/digital_slip_work.py` gerçek Chromium, imza çizimi, IndexedDB ve SW ile yeni fiş, Kendo saat/adet/TL örneği, eski imza/PDF kaynağını koruyarak aktarım, iki sekmede tek kayıt, mevcut fiyatlı işi kullanma, gerçek request hatası/rollback/retry, yanlış müşteri ve eksik araç reddi, taslak düzeltmesi, revizyon, tek iş/toplu kaynak ve çevrimdışı görünümü sınar. Açık `--baseline-proof` modu değişmemiş v3.9.84'te hatayı üretir; onarım başarısı sayılmaz.

Şema 7 değişmez. Üç yeni modül çevrimdışı varlık listesinde; sürüm `SAHAPRO SOLO v3.9.85`, önbellek `sahapro-solo-v3-20261029-digital-slip-work-85`. Gerçek telefon verisine erişilmedi; kullanıcı mevcut FS-000001 bağlantısını cihazında bir kez onaylar.
