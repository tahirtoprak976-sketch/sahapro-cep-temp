# SOLO v3.9.53 — müşterinin forkliftine mazot teslimi

## İhtiyaç ve doğrulanan muhasebe yönü

İşletme sahibi müşterinin adıyla, müşterinin kendi forkliftine verilen 20 L
mazotu yazdığını, asistanın istediği kaydı oluşturmadığını bildirdi. Mevcut
`fuel` kartı şirket listesinde araç ister; `customer_id` yalnız **Müşteri Verdi**
kaynağında korunur. Dış alıcıya verilen mazot için ayrı bir yol yoktu.
Bu yapısal eksiklik kaynak kodunda ve sentetik önizlemede doğrulandı;
kullanıcının telefonundaki eski model yanıtı elde olmadığı için o çağrının
birebir nedeni kanıtlandı denmez.

Kullanıcı açıkça **kendi depomuzdan düşsün + müşteriye TL borç yazılsın**
seçeneğini onayladı. Litre fiyatı bildirilmedi. 45 ₺/L ve 900 ₺ yalnız test
örnekleridir; gerçek kayda fiyat kendiliğinden atanmaz.

## Davranış

- Dar, belirgin tek teslimat cümlesi yerelde okunur: “Kaya'nın forkliftine
  20 litre mazot verildi, litresi 45 TL”. `20 ltnmazot` yazımı da desteklenir.
  Anahtar veya internet gerekmez; önce kontrol kartı oluşur, onay olmadan
  depo/cari/audit kaydı yazılmaz.
- Kartta teslim tarihi, alıcı müşteri, müşterinin makinesi, verilen litre ve
  müşteriye yazılacak son litre fiyatı görünür. Stok çıkışı ve borç birlikte
  gösterilir. Şirket filosuna sahte forklift açılmaz.
- Fiyat eksikse boş kalır; depo alış ortalaması müşterinin bedeli sayılmaz.
  Açık toplam bedel yazılmışsa litre fiyatı bundan hesaplanır. Birim fiyat ile
  toplam çelişirse kart işaretsiz gelir. Kullanıcı fiyatı gözden geçirir.
- “Verilmişti” gibi geçmiş anlatımında tarih yoksa tarih boş gelir;
  “dün” veya açık tarih okunur. Geçersiz/gelecek tarih otomatik kaydedilmez.
- Aynı adı paylaşan müşterilerde seçim kullanıcıya bırakılır; yeni müşteri
  sessizce açılmaz. Stok yetersizse kayıt engellenir.
- Onayda **fuel_tank_movements ÇIKIŞ + cari_movements MazotTeslimi +
  işlem kimliği + audit** tek IndexedDB transaction'ında yazılır. Aynı işlem
  kimliğinin tekrarında tek çift kalır; farklı içerik reddedilir. İki sekmenin
  stok çıkışları aynı transaction kapsamıyla sıralanır.
- Şirketin araç yakıtı, müşteri tarafından bize verilen mazot, iş ve kasa
  kaydı oluşmaz. TL borç müşterinin cari ekstresinde **Mazot teslimi** adıyla,
  makine/litre/fiyat açıklamasıyla görünür. Bu işlem tek başına para alındı
  veya resmi fatura kesildi anlamına gelmez.
- Depo listesi alıcı/makine/cari bedelini gösterir. Ayrıntıdaki iptal işlemi
  stok çıkışını ve borcu birlikte iptal eder. Asistanın mevcut “Geri al”
  işlemi de iki kaydı birlikte geri alır. Genel düzenleme yolları bu iki
  kaydı ayrı ayrı değiştiremez; aktif teslime bağlı müşteri silinemez.
- Tam yedekte iki taraf da bulunur. Geri yükleme ve Veri Sağlığı kopuk
  bağlantıyı denetler. DB şeması 5; yeni tablo veya veri taşıma yoktur.

## Sınırlar

Bu teslimat bir cari borçlandırmadır; iş/hakediş veya yakıt satış faturası
değildir. İş değeri/kâr grafikleri mevcut iş kapsamını kullanmaya devam eder;
bu dış teslimat şirket aracının tüketimi/maliyeti gibi eklenmez. KDV ve yakıt
satış faturası otomasyonu eklenmedi.

Yerel okuyucu yalnız belirgin tek forklift teslimatını kapsar. Karışık/çoklu
mesaj, ödenmiş/nakit/hediye işlemi, farklı kaynak, yön belirsizliği ve başka
makine türleri için genel mesaj okuması veya mevcut formlar gerekir; bu
kapsamın dışında otomatik depo/TL işlemi yapılacağı söylenmez. Modelden
`customer_fuel` gelirse bile alıntıda yön, alıcı ve rakamlar ayrıca doğrulanır.
Bu sürüm “her cümleyi anlar” garantisi vermez.

## Doğrulama

- `tests/customer-fuel.test.mjs`: yazım hatası, fiyat/tarih yokluğu,
  müşteri çakışması, Türkçe ondalık, tarih/fiyat ayrımı, ters yön, negatif ve
  aralık miktarı, modelin uydurduğu alıntı/rakamlar, stok, cari etiketleri,
  yedek bağlantıları ve müşteri mazot hakkından düşmeme.
- `tools/e2e/customer_fuel.py`: gerçek Chromium/IndexedDB/SW ile anahtarsız
  çevrimdışı önizleme → alanları tamamlama/onay → 100 L→80 L ve 900 ₺ borç;
  çift gönder; geri al; iki sayfada aynı kimlik; farklı içerik; ikinci yazımda
  enjekte edilen hata ve transaction rollback; eşzamanlı stok yarışı; çift
  iptal; tam yedek→ayrı boş DB; kopuk yedek reddi; tek taraflı düzenleme
  engeli; gerçek depo ekranından iptal; dar ekranlar. Tamamı TEST verisi.
- Mevcut asistan istek/düzeltme, iş düzeltme, tarih/araç seçimi, şoför nakit
  ve aktarım, fiş kurtarma, ödeme ajandası akışları ayrıca çalıştırılır.
- Gerçek Gemini veya dış mesaj gönderimi kullanılmaz. Yeni yerel teslimat
  yolu taklit model yanıtına bağlı değildir.
