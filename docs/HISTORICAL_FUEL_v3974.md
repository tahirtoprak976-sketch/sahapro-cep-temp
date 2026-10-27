# v3.9.74 — Kontrollü geçmiş yakıt mutabakatı

## Kullanım

Akıllı Asistan'ın normal Kaydet düğmesi mevcut stok ve tarih sıralı depo
korumasını aynen uygular. Geçmiş iş/yakıt paketinde depo geçmişi eksikse:

1. **Geçmiş işleri / yakıt mutabakatını kontrollü kaydet** bölümünü açın.
2. Kaynağı, tarihi, aracı ve operatörü kontrol edin; aynı çıkışın daha önce
   gerçek depo hareketi olarak kaydedilmediğini doğrulayın.
3. Mutabakat bekleme bölümünde **bugünden önce biten** açık tarih aralığını
   seçin. Bekleyecek yakıt satırlarını **tek tek** işaretleyin.
4. Onayda kaç iş, kaç bekleyen yakıt ve kaç gerçek depo çıkışı yazılacağını
   kontrol edin. Seçili satırda eksik bilgi veya normal stok engeli varsa
   bu modda hiçbir satır yazılmaz. Dışlamak istenen satır açıkça dışlanmalıdır.

Bekleyen kayıtlar `pending_fuel_records` adlı ayrı depoda tutulur. Bunlar
`fuel_records`, gerçek depo çıkışı, kasa hareketi, borç veya maliyet değildir.
Tarih, litre, araç, operatör, kaynak mesaj ve kaynakta yazan tutarlar korunur;
kaynak tutarı kesinleşmiş maliyet olarak kullanılmaz. Mevcut işler ve müşteri
raporlarındaki iş açıklamaları değiştirilmez. Geçmiş aktarım dosyalarının
hiçbiri kendiliğinden bu moda alınmaz.

Depo ekranı bekleyen kayıtları ve bunlar dahil **kayıt projeksiyonunu** ayrı
gösterir. Eksi projeksiyon, eksik tarihsel kayıtların açığıdır; fiziksel eksi
stok iddiası değildir. İlgili maliyet/kâr/rapor ve fiyat önerileri eksik olarak
işaretlenir; bilinmeyen maliyet sıfırmış gibi kesin kâr gösterilmez.

## Mutabakatı tamamlama

Gerçek tarihli eksik depo giriş/açılış kayıtları ve maliyetleri tamamlandıktan
sonra Depo ekranında kaydı **Yeniden hesapla ve incele** ile açın. Gelecekteki
veya çıkıştan sonraki giriş geçmiş açığı karşılamaz. O tarihe kadarki girişlerin
maliyeti eksikse kesinleştirme yapılmaz.

Ayrı onaydan sonra, aynı ayrılmış kimlikte bir gerçek yakıt ve ona bağlı tek
stok çıkışı atomik olarak oluşturulur. Bekleyen kayıt kaynak/audit dayanağı
olarak `reconciled` durumunda kalır. Kasa veya ödeme yaratılmaz. Yeniden basma,
iki sekme, eski önizleme ve tekrar aktarım ikinci çıkış oluşturamaz. Kaynak ve
onaylanan maliyet sonradan otomatik fiyat tamamlama/onarımıyla değiştirilmez.
Bağlı araç/personel kartları özgün dayanağı bozacak şekilde birleştirilemez
ve silinemez. Yanlış bir kesinleşmiş kayıt için mevcut yakıt iptal/geri yükleme
akışı kullanılmalıdır; geçmiş dayanak yedekle geriye çevrilmez.

## Veri ve güncelleme güvenliği

**Veritabanı şeması 6 → 7, yalnız eklemeli değişikliktir.** Yeni ayrı tablo
eklenir; eski kayıtlar, fiyatlar, audit, dosyalar ve taslaklar yeniden yazılmaz.
Yükseltme öncesi cihaz içi kurtarma kopyası alınır. Açık eski bağlantılar
`versionchange` ile kapanır; eski şema6 yazıcısı yeni veriyi açamaz. Uygulamayı
güncelleyin; **tarayıcı verilerini/depolamayı silmeyin**.

Tam/parçalı yedekler yeni tabloyu içerir; şema6 yedeği yeni tabloda kayıt
üretmez. Bekleyen/iptal/tamamlanmış kayıtlar ve gerçek karşılıkları birlikte
doğrulanır. Eski yedek tamamlanmış mutabakatı tekrar beklemeye döndüremez.
Aynı tarih/araç/litreyle mevcut gerçek veya bekleyen çıkış varsa ikinci bir
bekleyen kayıt kabul edilmez; bu akışta desteklenmeyen “ayrı çıkış” onayı
verilip sonradan kesinleştirilemeyen kayıt oluşturulmaz.
Toplu geri alma, bekleyen yakıt için iptal kaynak izi bırakır; aynı kaynak
sessizce yeniden alınmaz. Kesinleştirmeden sonra eski toplu geri alma reddedilir.

## Doğrulama

- Eski normal stok/tarih, toplu kayıt ve iş/rapor testleri gevşetilmedi.
- Yeni saf testler: tarih aralığı/tek satır onayı, karma seçimin atomikliği,
  kaynak tutarları ve operatör, ayrı projeksiyon, restore izleri, rapor/öneri
  eksiklik uyarıları, müşteri görünümünde özel kaynak bilgilerinin korunması.
- Yeni tarayıcı paketi `tools/e2e/historical_fuel.py`: yalnız sentetik TEST
  verisi, gerçek IndexedDB, iptal/yenileme/tekrar/yarış/rollback ve mutabakat.
- Kurulu .73 → .74 güncelleme deneyi, eski verinin tüm baytlarını, dosyaları,
  taslakları, şema7'nin boş ek tablosunu ve eski yazıcı engelini denetler.
- Bu dot ortamında yerel Chromium soket açılışı önceki denemede izin nedeniyle
  engellendi. Bu engel aşılmadı/yeniden denenmedi; gerçek tarayıcı doğrulaması
  mevcut salt-okunur GitHub Actions Chromium çalışma ortamında yürütülür.

PR ve CI'daki veri yalnız sentetiktir; özel geçmiş mesajlar, ekran görüntüleri
ve kaynak dosyalar yayımlanmaz. Bu sürüm geçmiş içe aktarma işlemi başlatmaz.
