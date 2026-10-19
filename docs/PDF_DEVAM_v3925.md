# SOLO v3.9.25 — PDF aktarımına devam

Asistan → Geçmiş işleri PDF’den aktar ekranı geliştirilmiştir. Şema sürümü 5 olarak kalır; eski kayıtların fiyatı, miktarı veya anlaşması topluca değiştirilmez.

- PDF’de tekrarlanan müşteri, araç veya personel adı bir satırda seçilince diğer boş eşleşmelere uygulama önerilir. Kullanıcı onayı gerekir. Yalnız aynı PDF içindeki aynı kaynak adı, tamamlanmamış ve alanı boş satırlar etkilenir; genel kart/rumuz hafızası oluşturulmaz.
- Eksikleri tamamla, tarih, araç, müşteri, miktar, yakıt kaynağı gibi gerekli alanları sırayla sorar. Yanıtlar yalnız taslağı değiştirir. Gemini çağrılmaz; kayıt ayrıca seçilip onaylanır.
- PDF listesi bekleyen, kaydedilen ve mevcut işe bağlanan satır sayılarını gösterir. Devam et, düzeltilmiş taslağı ve varsa cihazdaki dosyayı açar; yeniden Gemini okuması gerekmez.
- Yeni iş açmadan mevcut işe bağlama, tarih/müşteri/araç/iş türü/birim/miktarı eşleşen işleri gösterir. Kullanıcı seçimi ve son onay gerekir. Yalnız kaynak belge/sayfa/alıntı metaverisi eklenir; kilitli işin fiyatı, miktarı, hakedişi ve diğer finansal alanları korunur. Aynı kaynak satırın işlem kimliği oluşturma ve bağlama için ortaktır. Eşzamanlı tekrar tek bağlantı/audit üretir; onaydan sonra değişmiş iş reddedilir.

## Dosya saklama sınırı
Her PDF en fazla 15 MB; cihazdaki taslak PDF dosyaları toplam en fazla 60 MB olabilir. Kapasite veya tarayıcı depolama hatasında satır taslağı korunur; dosyanın yeniden seçilmesi gerekir. Dosyalar otomatik silinmez. Henüz arşivlenmemiş taslak PDF dosyaları uygulama yedeğine dahil değildir: orijinalleri ayrıca saklayın. Kaydedilen/bağlanan satırların arşiv PDF’si mevcut belge eki/yedek yoluyla korunur. Eski taslakların dosya adı yoksa kısa belge özeti gösterilir.

## Doğrulama
84/84 Node test dosyası; gerçek Chromium ve IndexedDB üzerinde yeni PDF iş akışı, önceki PDF aktarımı ve asistan işlem testleri. Kaynak dosyalar sentetik, Gemini yanıtları taklittir; gerçek Gemini okuma kalitesi veya fiziksel telefonda kabul testi bu sonuçlarla doğrulanmış sayılmaz.
