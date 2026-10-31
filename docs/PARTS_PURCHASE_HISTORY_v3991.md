# Yedek parça alışları ve garanti takibi — v3.9.91

## Sorun ve davranış

Parça / Garanti listesi yalnız `maintenance_parts` kayıtlarını okuyordu. Esnafın alış belgesindeki veya giderdeki akü / yedek parça alışı maliyetlerde vardı fakat parça listesinde görünmüyordu. Liste artık aynı salt okunur IndexedDB anlık görüntüsünden mevcut parça kartlarını ve açıkça parçayla ilgili gider / alış kaynaklarını okur. Listeye bakmak yeni kayıt, ödeme veya gider oluşturmaz; eski kayıtlar topluca değiştirilmez.

- Yedek Parça, Parça, Akü, Akü Alımı, Lastik, Filtre kategorileri ve alış belgesinin yapılandırılmış parça kalemleri gösterilir. Salt işçilik ve belirsiz onarım açıklaması parça sayılmaz.
- Açık kaynak bağlantısı ve aynı araçla bağlı gider + alış tek kaynak grubudur. İsim, tutar veya tarih benzerliğiyle birleştirme yapılmaz. İptal, silinmiş, açılış / devir ve depo yakıt alışı dışlanır.
- Kaynak grubu mevcut parça kartına bağlıysa tek kalemli alış ikinci parça olarak gösterilmez. Çok kalemli belgeler kalan kalemlerin unutulmaması için kaynak belgesi olarak görünür kalır; bağlı kartlar açıkça gösterilir. Kaynak belge toplamı tek parçanın fiyatı değildir.
- Garanti bilgileri olmayan alış, **Garanti bilgileri eksik** etiketiyle görünür. **Garanti Bilgilerini Tamamla** mevcut maliyeti seçili açar. Parça fiyatı, garanti süresi ve seri numarası uydurulmaz. Miktar yalnız tek kalemli, adet birimli alıştan alınır; diğer durumlarda kullanıcının girmesi gerekir. Araçsız kayıtta önce kaynak araç bilgisi tamamlanır.
- Bu akış yeni gider / kasa / banka hareketi oluşturmaz. Eski maliyet, özgün belgeler ve ödeme ilişkileri korunur. Kaynak değişmişse işlem durur; eşzamanlı iki tamamlamadan yalnız biri yazılır. Normal yeni kart ekranı ayrı parçaları aynı belgeye bağlamak için kullanılabilir.
- Parça detayında kendi belgeleri ve bağlı gider / alış / bakım belgeleri birlikte okunur. Eski `payable` / `payables`, `expense` / `expense_records`, `maintenance` / `maintenance_records` ek türleri desteklenir. Özgün ikili dosyalar taşınmaz veya çoğaltılmaz. Kaynağa sonradan eklenen belgeler parça detayı yeniden açıldığında da görünür.
- Bakımın parça kalemine garanti eklenebilir; bakım bağlantısı, miktar ve maliyet korunur. Garanti düzenlemesi güncel kayıt revizyonunu gerektirir. İşçilik kalemi garanti kartına çevrilmez.
- Takvimde geçersiz veya ters tarih aralığı aktif garanti sayılmaz. Gelecekte başlayacak garanti ayrıca belirtilir.
- Açık liste aynı veri tabanındaki kayıt değişikliklerinde ve pencereye dönüşte güncellenir; arama / filtre ve açık düzenleme formları korunur. Kaynak okuma hatası boş liste / sıfır maliyet olarak sunulmaz.

## Test ve sınırlar

`tests/parts-purchase-history.test.mjs` salt okunur kaynak gruplama, yanlış araç, prototip adları, karma belge, iptal / devir / yakıt dışlama, miktar / fiyat ve garanti takvim kontrollerini kapsar.

`tools/e2e/parts_purchase_history.py` gerçek Chromium / IndexedDB ile: esnaf + gider alışı görünürlüğü, üç özgün ek, formdan garanti tamamlama, 6000 TL maliyetin bir kez kalması, eski bağlantıdan ikinci kartın engellenmesi, değişmiş kaynak, eşzamanlı yazma, revizyonsuz düzenleme, bakım kalemine garanti ekleme, sekmeler arası yenilenme, çevrimdışı okuma, ekli yedek geri yükleme ve 320 / 390 / 768 piksel genişlikleri. `--baseline-proof` değişmemiş v3.9.90 üzerinde görünmeyen alış ve geçersiz tarihin aktif garanti sayılmasını kanıtlar.

CI tüm Node dosyalarını, tarayıcı suitlerini ve v3.9.90 dahil kurulu eski sürümlerden veri korunmasını çalıştırır. Testler ayrı TEST profillerindedir; gerçek telefon, gerçek işletme verisi veya gerçek Gemini okuma doğruluğu ölçümü değildir. Şema 7 korunur. Sunucu / hesap değişikliği yoktur.
