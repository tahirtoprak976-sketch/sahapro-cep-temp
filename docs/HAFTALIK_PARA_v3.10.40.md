# Haftalık para takibi — v3.10.40

Finans → Tamamlanacak işler ve diğer kontroller → **Haftalık tahsilat ve ödeme takibi**.

Ekran bugün dahil önümüzdeki yedi günü gösterir. İki ayrı toplam vardır: kayıtlı plan/sözlerden beklenen tahsilat ve alış belgelerinden ödenecek kalan borç. Bu tutarlar kasa/banka mevcudu değildir; birbirinden çıkarılıp elde kalacak para olarak sunulmaz. Mevcut para için Kasa kayıtları ve Banka hesapları bağlantılarını kullanın.

- Kesinleşmiş hakedişin açık vade planı varsa, bağlı tahsilat eşleştirmeleri bugüne kadar düşülür. Aynı müşterinin ödeme sözü ikinci bir alacak gibi toplanmaz.
- Açık vade planı yoksa kayıtlı ödeme sözü kullanılır. Tamamen ödenmiş eski plan, yeni iş için verilen yeni ödeme sözünü engellemez. Tarihi veya tutarı eksikse müşteri bakiyesi söz tutarı yerine doldurulmaz.
- Plan toplamı, kaynak hakediş, tahsilat eşleştirmesi veya müşteri bakiyesi uyuşmuyorsa kayıt Kontrol / tarihsiz bölümüne gider; haftalık toplama alınmaz. Kaynaktan kontrol edip eşleştirin.
- Alış borçlarında mevcut Ödeme Takibi hesabı kullanılır. Bağlı bugünkü/geçmiş ödemeler düşer; ileri tarihli ödemeler bugün ödenmiş sayılmaz. İleri tarihli alış belgeleri ayrıca belirtilir.
- Tarihsiz alacak/borç otomatik gecikmiş veya bu haftaya ait sayılmaz. Tarihi geçmiş kayıtlar ayrı gruptadır. Maaş, kira ve alış belgesi olmayan diğer borçlar bu alış borcu toplamında yer almaz.

Taraf/kaynak araması, yön ve tarih grubu filtreleri vardır. Her satırdan asıl vade planı, müşteri tahsilat takibi veya alış belgesi açılır. Ekrandan ödeme, tahsilat veya eşleştirme otomatik yazılmaz. Tarayıcının/telefonun Geri düğmesiyle dönünce aynı oturumdaki filtreler korunur. Güncelle, arama alanını değiştirmeden kaynakları yeniden okur; gün değişince kapsam yenilenir.

**Filtreli CSV**, yalnız gördüğünüz filtre kapsamını aktarır. Üstteki iki toplam filtrelerden etkilenmez. Boş tutar sıfır değildir. KDV ve kayıtlı cari hesaplama politikası değişmez. Eski kayıtlar otomatik düzeltilmez; şema8 ve kayıt biçimi korunur.

Ölçüm sentetik Chromium/IndexedDB verileriyledir. Fiziksel Android, gerçek WhatsApp ve gerçek Gemini bu pakette denenmedi.
