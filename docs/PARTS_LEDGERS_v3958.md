# SOLO v3.9.58 — Yedek Parça / Garanti ve işletme bağlantıları

## Kullanım

Daha Fazla → **Yedek Parça / Garanti**. Filo → araç kartından da aynı aracın parçaları açılır. Bakım Parça / İşçilik, mevcut bakımın bedel dökümü olarak korunur; yeni sayfaya bağlantısı vardır.

Örnek: aracı seç → parça “Akü” → miktar 2 → isteğe bağlı KDV dahil birim fiyat → marka/model, her akünün seri numarası, satıcı, fatura no, garanti tarihleri → fotoğraf/PDF ekle → kaydet. Eksik garanti tarihi uydurulmaz. Erken başlamış (ör. ikinci el parça) garanti tarihleri korunabilir; başlangıçtan önce bitiş reddedilir. Süresi dolmuş, 30 gün içinde dolacak ve tarihi eksik parçalar filtrelenebilir. Garanti bilgileri sonradan düzenlenebilir; başka ekrandaki değişiklik ezilmez.

Maliyet seçimi açıkça yapılır:

- **Yalnız takip:** mali hareket yok; yazılan fiyat yalnız parça bilgisidir.
- **Mevcut gidere/bakıma/alışa bağla:** aynı aracın aktif maliyeti seçilir; ayrıca gider yazılmaz.
- **Yeni gider oluştur:** parça toplamı bir kez `expense_records` içine yazılır. KDV bilinmiyor olarak kalır; kasa/banka veya ödeme yapılmış varsayılmaz. Veresiye alış için mevcut Alış Belgeleri / Borçlar akışı kullanılır ve parça o belgeye bağlanır.

Parça, yeni gider ve belgeler tek IndexedDB transaction içindedir. Aynı işlem anahtarı + aynı içerik tek kayıt; aynı anahtar + farklı içerik reddedilir. Yarım işlem tümüyle geri alınır. Bağlı maliyetin tutarı/bağlamı değiştirilemez veya kaydı silinemez; gerekçeli bağlantı kaldırma gideri silmeden düzeltmeye imkân verir. Araç/bakım silinirken parça bağlantıları aynı transaction içinde yeniden kontrol edilir.

JPEG/PNG/WebP ve PDF: bir seferde en fazla 8 dosya, dosya başına 15 MB, toplam 30 MB. Fotoğraf gerçekten açılabiliyor olmalıdır. Garanti kanıtının özgün dosya baytları saklanır; fotoğraflar yeniden sıkıştırılmaz. Aynı belge aynı parçada SHA-256 ile tekrar eklenmez. Belgeler bu cihazda tutulur; ekli tam yedeğe/geri yüklemeye dahildir. Yeni parça formunun alanları ve seçili dosyaları cihaz taslağında korunur. Kaydedilmemiş taslak dosyaları dış yedeğe dahil değildir; yedek kapsamındaki `parts_draft_files_not_included` sayacı bunu belirtir. Bu bölüm araç parçası takibidir; ambar stok yönetimi veya başka telefona sunucu senkronizasyonu eklenmedi.

## Denetimde düzeltilen bağlantılar

- Açılış/devir ve depoya yakıt alışı faaliyet maliyeti sayılmaz. Yakıt tüketildiğinde sayılır. Gider/bakım/yakıtın kaynak bağlı alış belgesi varsa tek kaynak kullanılır. Kalemsiz eski özet belgelerde özgün maliyet korunur. Bağımsız taşeron/ocak alışları genel masrafa dahil edilir. Aynı işe bağlı döküm borcu varsa hesaplanan döküm bedeli ayrıca eklenmez; depozito ve müşteri mazotu maliyet dışıdır.
- Maliyet ve Sonuç raporları ile araç kartının Maliyet sekmesi aynı maliyet dağıtımlarını kullanır. Onaylanmış, eşleşen cari hareketi bulunan götürü/metraj tahakkukları net gelire girer. Genel tahsilat veya açılış borcu gelir diye eklenmez. Tüm sözleşme bedeli rastgele bir araca/personeline atanmaz.
- Nakit tahmini, bağlı `payable_id` üzerinden gerçek belge kalanını kullanır; bir belgenin ödemesi başka belgeden FIFO ile düşülmez. Ocak/taşeron/döküm borçları da kapsanır. Vadesiz belgelerde +30 gün kesin tarih gibi sunulmaz. Eski belgesiz ödeme yalnız tek belgeli tarafta düşülür; çok belgeli tarafta eşleştirme gerekliliği yazılır.
- Kapalı çek/senetle eşleşen tedarikçi ödemesi geri alınamaz; ödeme ve banka hareketi korunur. Yedek kontrolü aktif çekin silinmiş banka hareketine bağlanmasını reddeder.
- Bakım planı ve periyodik takvim aynı sayaç kaynaklarını kullanır. Son okumadan sonraki iş saatleri tahmin olarak belirtilir; araç kartındaki ölçülmüş sayaç değiştirilmez. İki ekran birbirine bağlanır.
- Ücret/avans ödeme yöntemi zorunlu; yöntem eksikse hiçbir ödeme kaydı yazılmaz. Personel kartında yalnız defter bakiyesi olduğu açıkça yazılır; saha avansları ve aylık kalan için Puantaj bağlantısı verilir.
- Gün sonu kapanışı listesinde saklanan kaynak imzası güncel kaynaklarla karşılaştırılır. Geçmişe iş eklemek yasaklanmaz; kapanış “Kaynaklar değişti” diye işaretlenir. Detayda zaten var olan karşılaştırma korunur.
- Aktif özel gider kategorileri asistan bağlamı, doğrulaması ve seçim listelerinde korunur; tanınmayan kategori sessizce onaylanmaz. Yeni Yedek Parça kategorisi elle gider formunda da bulunur.
- Sözleşme Belgeleri (metin/imza) ve İş Sözleşmeleri (şantiye/fiyat/tahakkuk) karşılıklı bağlantı ve açıklamalarla ayrılır. Mevcut belge kaydı kendiliğinden aktif fiyat anlaşmasına dönüştürülmez. Müşteri tahsilatının tek sözleşmeye kesin dağıtımı bu değişiklikte eklenmedi; mevcut yaklaşık ödeme görünümü kesin sözleşme tahsilatı diye sunulmaz.

## Tekrarlanabilir doğrulama

- `node tests/parts-ledgers.test.mjs`: parça/fiyat/tarih/garanti doğrulama, belge tür/boyut/orijinal bayt, maliyet politikası, dağıtım, sözleşme geliri, gerçek belge kalanları, sayaç tahmini, özel kategori.
- `python tools/e2e/parts_ledgers.py [URL]`: gerçek Chromium/IndexedDB/SW, 2 akü + fotoğraf, taslak+dosya yenileme, çift gönderim, aynı anda iki kayıt, farklı içerik çatışması, bozuk dosya, bağlı kaynak koruması, eski garanti formu, transaction ortası hata/rollback, yöntem eksik ödeme, çek geri alma engeli, ayrı tarayıcıya belgeyle tam yedek geri yükleme, çevrimdışı erişim, 320/360/768px.
- `python tools/e2e/ledger_links.py [URL]`: gerçek kayıtlarla sözleşme/cari/rapor, tank/tüketim/alış, dağıtım, vade, puantaj, çek, sipariş, özel kategori ve kapanış bağlantıları.
- `python tools/e2e/menu_routes.py [URL]`: menüleri açarken işletme kaydı değişmediği ve ekran hatası olmadığı kontrolü.
- Mevcut Node testleri, JS sözdizimi ve SW varlık denetimi; asistan agent/workflow/customer/operations, driver cash/transfer, customer fuel, ticket recovery, research integrity ve mevcut metraj/sözleşme tarayıcı suitleri.

Tarayıcı testleri yalıtılmış profillerde uydurma TEST/AUDIT verisi kullanır. Gerçek müşteri kayıtları, gerçek ödeme ve Gemini çağrısı kullanılmaz. Telefon donanımı üzerinde yeni kullanıcı kabulü bu testlerin yerine geçmez.
