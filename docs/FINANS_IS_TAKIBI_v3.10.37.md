# Finans iş takibi — v3.10.37

Finans ekranının üstündeki **Tamamlanacak işler** açılımına dokunun. İş kaydı düzeyindeki liste, seçili Finans dönemini kullanır. Dönem özeti ve ana para/KDV ayrımı aynı hesaplarla korunur.

- **Kontrol gerekli:** kayıtlı çelişkilerin gerekçeleri görünür.
- **Bilgisi eksik:** fiyat, miktar, araç veya fiş gibi mevcut hakediş hazırlığı eksikleri görünür. Kayıtlı olmayan fiyat otomatik uygulanmaz.
- **Hakedişe hazır:** hazırlık kontrollerini geçmiş işlerdir; kesinleşmiş borç veya alınan para anlamına gelmez.

Müşteri, şantiye, araç, iş türü ve tarihle arayın. Sayılar iş adedidir, para değildir. Üçer kayıt gösterilir; önceki/sonrakiyle bütün eşleşmeleri açabilirsiniz. Eksikleri tamamla, ilgili işin mevcut düzenleme formunu açar. Kaynağı aç, iş ayrıntısını açar. Kaydetmeden iş değişmez. Hazır işin düğmesi doğru müşteri ve dönemle hakediş hazırlığını açar; iş kendiliğinden seçilip kesinleştirilmez.

Telefonun/tarayıcının Geri düğmesiyle dönünce aynı oturumda dönem, arama, filtre, sayfa ve açılım korunur. Bunlar kalıcı işletme kaydı değildir; uygulama tamamen kapanınca sıfırlanabilir. Başka TEST/veritabanı veya dönemle karıştırılmaz.

Hakediş ve Tahsilat Masası'nda da aynı liste açık görünür. Müşteri kartlarının arama/takip filtresi müşteri özetleri içindir; üst iş listesinin kendi filtresi vardır. Taslak veya kesinleşmiş hakedişe bağlı işler yeniden hazır listeye eklenmez; sözleşme/mazot/iç işler TL hazırlığından ayrı kalır. Ödeme sözü ve kasa/banka/personeldeki para mevcut bölümlerde ayrı izlenir. KDV yalnız seçilip kesinleşen hakedişte cariye eklenir.

Bu paket otomatik eski kayıt düzeltmez; veri şeması ve para/izin kuralları değişmez. Ölçüm sentetik Chromium/IndexedDB senaryolarıdır; gerçek Android kullanım süresi değildir. Fiziksel Android, gerçek WhatsApp ve canlı Gemini bu pakette denenmedi.
