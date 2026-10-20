# SOLO v3.9.34 — İş girişinde verimlilik

## Yeni yollar

- İş ayrıntısında **Benzer iş oluştur**: seçilen işin müşteri, uyumlu şantiye, araç, personel, iş türü, birim, malzeme, döküm/ocak seçimleriyle yeni form açılır.
- Yeni iş formunda **Bu kayıttan sonra benzer iş aç**: normal kaydetme tamamlanınca liste/ayrıntı yerine bir sonraki iş formu açılır. Seçenek yalnız o kaydetme için geçerlidir, yeni formda yeniden seçilir.
- **Son İşten Başla**: UUID/IndexedDB sırası yerine oluşturulma zamanına göre son aktif iş seçilir. Oluşturulma zamanı yoksa iş tarihi, eşitlikte kimlik kullanılır.

Yeni formun tarihi bugündür; miktar boştur ve tekrar girilmelidir. Eski fiyat snapshot'ı, KDV tercihi, manuel fiyat, mazot karşılığı miktarı, fiş numarası/dosyası, imza, hakediş/fatura/şoför kimliği, puantaj, açıklama/notlar ve nakliye grup kimliği taşınmaz. Yeni fiyat ve sözleşme/mazot koşulları mevcut kayıt yolunda tekrar değerlendirilir. Kullanıcı tarihi değiştirebilir; geçmiş iş girişi devam eder. Kaynak iş değişmez.

Silinmiş/listede olmayan kartlar ve başka müşteriye ait şantiye boş bırakılır; hangi seçimlerin yenilenmesi gerektiği açıklanır. Kaynak iş bulunamaz/silinmişse kaydedilebilir boş form yerine açık hata ve iş listesine dönüş sunulur.

## Taslak ve kayıt davranışı

Başka bir iş taslağı varsa benzer form onun üzerine sessizce yazılmaz: kullanıcı benzer işe geçmeyi seçer veya mevcut taslağa döner. Benzer form açıldığında yalnız form taslağı saklanır, gerçek iş oluşmaz. Aynı kaynak form yenilendiğinde girilmiş miktar/tarih ve manuel fiyat/KDV taslağı geri yüklenir; kaynak seçimleri tekrar dayatılmaz. Normal taslaklarda da manuel fiyat ve KDV alanları artık doğru geri yüklenir.

Formda değişiklik veya fotoğraf varken Son İşten Başla, mevcut formun yerini alacağını sorar. Onay yalnız o formu bırakmak içindir. Fotoğraf Blob'ları iş formu taslağında tutulmaz; bu mevcut sınır korundu ve geçiş uyarısında açıklandı. Taslak saklama hatası görünürdür.

Tek kayıt ve çok satırlı nakliye kaydetme yolları aynı sonraki-form seçeneğini destekler. Çok satırlı kayıttan sonra ilk oluşturulan işin seçimleriyle tek satırlı boş miktar formu açılır; ek nakliye satırları tekrar edilmez. Varsayılan Kaydet davranışı ayrıntı ekranına gider. İş kaydı kullanıcı Kaydet düğmesine bastığında oluşur; mali alanlar kopyalanmaz. Şema veya asistan çağrısı eklenmedi.

## Doğrulama

Saf model: izin verilen alanlar, kimlik/fiyat/kanıt dışlama, bugün/boş miktar, geçersiz kart ve uyumsuz şantiye, son oluşturulma zamanı ve değişmez kaynak. Gerçek Chromium/IndexedDB: seçilen işten açılış, taslak ve manuel fiyat/KDV yenileme, güncel fiyatla tek kayıt, eski işin birebir korunması, batch sonrası temiz form, var olan taslak onayı/iptali, miktarsız kaydın engeli, çevrimdışı açılış, kayıp kaynak ve mobil genişlik.

Gerçek telefonda kullanıcı kabulü henüz yapılmadı. İş formu fotoğrafları ve yarım kalan yüklemeler ayrıca kontrol edilmelidir; bu sürüm cihaz kapanması veya depolama temizlenmesine karşı yeni bir garanti sunmaz.
