# Finans masası — v3.10.06

## Tasarım kararı

| Yaklaşım | Değerlendirme |
|---|---|
| Yalnız renk ve kart yenileme | Uzun menüyü ve günlük işlere erişimi çözmez. |
| Çok sayıda yeni sekme | Aynı bilgiyi farklı yerlerde takip etmeyi gerektirir. |
| Öncelikli finans masası + aranan araç dizini | Seçilen çözüm: günlük dört işlem üstte; ayrıntılar gerektiğinde açılır. |

Lacivert metin, açık yüzeyler, mavi işlem vurgusu ve aynı çizgi simgeleri kullanılır. Değişiklik Finans ana ekranı kapsamındadır; banka, hakediş ve para girişlerinin mevcut kayıt/onay yolu korunur.

Üstte Tahsilat ekle, Gider ekle, Hakediş hazırla ve Cari hesaplar bulunur. Araç bul düğmesi arama alanına götürür. Tüm 29 araç, günlük işlemlerden ayrı gruplarda aranabilir. Esnaf, banka, vade, sözleşme ve diğer eski yollar kaldırılmadı. Arama, Türkçe büyük/küçük harfi destekler, alanı yeniden çizmez; odak korunur. Sonuç bulunamadığında bu açıkça söylenir.

Kayıtlı müşteri alacağı tüm zamanlardır; dönem özeti kendi tarih aralığını gösterir. İş değeri, tahsilat ve masraf aynı mevcut kaynak hesaplarından gelir. Para konumu personelde / teslim bildirildi / kasaya teslim / banka olarak ayrıdır; toplam banka veya kasa mevcudu olduğu iddia edilmez. KDV yalnız seçilip kesinleşen hakedişle cariye eklenmesi kararına dokunulmaz.

Fiyat eksikleri, kasaya teslim onayı, kayıt kontrolü, vadesi gelen belgeler, tahsilat sözleri ve taslak hakedişler kendi mevcut verilerinden salt okunur önceliklere dönüşür. İlk üçü görünür, diğerleri tek açılır bölümde kalır. Aynı aciliyetteki borçlarda kaynak gündemin vade sırası korunur; rastgele kayıt kimliği sırası kullanılmaz. Bu kartlar ödeme veya kesinleştirme başlatmaz; kaynağı inceletir. Ödeme sözü alınmış para, taslak hakediş kesin borç, teslim bildirimi kasa onayı sayılmaz.

Maliyet bilinmiyorsa sonuç hesaplanamadı olarak gösterilir. Döküm maliyeti varsa kesinleşen / kalan tahmin ayrımı açık kalır; diğer masraf ayrıntıları açılır bölümde yer alır. Veritabanı, şema 7 ve kayıt biçimi değişmez; eski kayıtlar düzeltilmez. Arama veya bölüm açma veri yazmaz.

## Aynı sentetik veri, 360 px telefon genişliği

| Ölçüm | v3.10.05 | v3.10.06 |
|---|---:|---:|
| Finans ekranı uzunluğu | 2941 px | 2374 px |
| Başlangıçta görünür kontrol | 37 | 25 |
| Üstte günlük işlem | 0 | 4 |
| Araç dizini | Uzun, dağınık bağlantılar | 29 araç, gruplu arama |
| Gezinme sırasında değişen kayıt / meta / taslak | 0 | 0 |

Görünür kontrol ölçümü tarayıcının checkVisibility API’sini kullanır; kapalı details içindeki araçlar görünür sayılmaz. Ekran uzunluğu ve kontrol sayısı bu örneğe aittir, gerçek telefon ölçümü değildir.

Aynı yeni tarayıcı testi değişmemiş v105’te günlük dört işlem kontrolünde başarısız olur; adayda bütün kontrolleriyle çalışır. Yeni test 320/360/390/768 px, öncelik sırası, 29 araç, arama odağı, boş sonuç, hızlı işlem yönleri, tek satır para ve bütün kayıt/meta/taslakların değişmemesini doğrular. Eski finans, fiyat uygulama ve döküm maliyeti testlerinin beklentileri korunur.

Gerçek telefon, gerçek WhatsApp ve gerçek Gemini denenmedi. Genel asistan ölçümü dondurulmuş yanıtlardır; model başarısı iddiası yoktur.
