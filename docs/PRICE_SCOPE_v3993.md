# Asistan fiyat kapsamı — SOLO v3.9.93

01.11.2026. Şema 7 korunur; eski kayıtlarda otomatik veri düzeltmesi yapılmaz.

## Davranış

“Ahmet.bey müşterisin Tarabyadan Kamyonetle alinan moloz seferlerine 7000 TL yap” fiyat kuralında müşteri Ahmet Bey, şantiye Tarabya, iş Moloz Nakliye, araç grubu Yalnız Kamyonet, birim Sefer, fiyat 7.000 TL + KDV olarak birlikte önizlenir. Yer adı modelin site_id alanında eksik olsa da mevcut müşterinin şantiyelerinden doğrulanır. Modelin kimliği yanlışsa metindeki doğru ve tek şantiye kullanılır. Aynı müşteride birden çok şantiye eşleşirse veya yer bulunamazsa seçim gerekir. Başka müşterinin şantiyesi seçilemez. Şantiye kartı bu akışta kendiliğinden açılmaz.

İş türü ve araç birbirini genişleten alternatifler değildir. Yeni kural gelecekteki fiyat motorunun mevcut araç grubu desteğini kullanır. Plaka verilmişse tek araç korunur; genel “kamyonetle” ifadesinde plaka tahmin edilmez. Kartta müşteri, şantiye, iş+araç kapsamı, birim, KDV hariç fiyat ve etkilenecek eski işlerin sayısı görünür. Müşteri değişince şantiye seçimi boşalır; tüm şantiyelere kendiliğinden geçilmez.

“Fiyatı boş eski işlere uygula” başlangıçta seçilidir; farklı fiyatı olan eski işleri değiştirme ayrı, başlangıçta işaretsiz seçenektir. Hakedişe bağlı (taslak dahil), kilitli ve mazotla ödenen işler korunur. Açıkça 0 TL fiyatlı iş boş fiyat sayılmaz; değiştirmek için farklı fiyatları uygulama seçeneği gerekir. Formüllü fiyat ve aynı kapsamdaki birden çok kural topluca değiştirilmez. Şantiye alanı boş, açıklamasında yer yazan iş otomatik eşleştirilmez; sayısı ayrıca bildirilir. Bu sürüm önceki hatalı kuralı veya telefondaki eski fiyatları sessizce değiştirmez. Önceden müşteri geneline onaylanan kural varsa Fiyat Listesi ekranından kapsamı kontrol edilmelidir.

Tarih sınırlı aynı kapsamlı fiyat otomatik genişletilmez; Fiyat Listesi ekranında tarihle incelenmesi istenir. Önceki basit kuralın KDV oranı korunur; fiyat kutusu KDV hariçtir. Bu komut tahsilat veya kasaya para girişi oluşturmaz.

## Kayıt güvenliği

Önizlenen işler ve kural aynı transaction içinde yeniden doğrulanır. Yeni/değişen iş, miktar, fiyat veya hakediş bağlantısı onaylanan kapsamı değiştirdiyse işlem durur. Kural + eski işlerin fiyatları + denetim kaydı atomiktir; yazma hatası hepsini geri alır. Aynı işlem anahtarı eşzamanlı tekrarlansa da tek işlem yazılır. Farklı içerik aynı anahtarla kabul edilmez. Geri alma makbuzu yalnız bu işlemin kuralını ve değiştirdiği işleri kapsar; geri alınmış işlem tekrar gönderilerek canlandırılamaz.

## Doğrulama

- Node: mevcut fiyat ve fiyat tamamlama testleri; yeni price-scope93.test.mjs ile bildirilen tam cümle, modelin şantiye alanını atlaması, yabancı/eksik/belirsiz şantiye, kamyonet grubu, diğer şantiye/kamyon/iş türü, şantiyesiz kayıt, hakediş/kilit/mazot istisnaları, gelecekteki fiyat seçimi ve değişmiş önizleme.
- tools/e2e/price_scope.py: gerçek Chromium + IndexedDB + asistan formu, taklit Gemini yanıtı, yalnız TEST verisi. Önizleme ve dar ekran; gerçek Kaydet; yalnız iki doğru işin fiyatlanması; Geri al; write-failure rollback; eski önizlemenin reddi; eşzamanlı tekrar; müşteri değişimi; bulunamayan şantiye. --baseline-proof değişmemiş v3.9.92'de yanlış kapsamı aynı TEST işleriyle kanıtlar.
- Mevcut tüm Node/tarayıcı ve kurulu sürüm yükseltme testleri yayın öncesi CI'de koşar. Bu belge gerçek telefon veya gerçek Gemini doğruluk ölçümü iddia etmez.
