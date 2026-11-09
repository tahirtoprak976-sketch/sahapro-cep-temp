# v3.10.03 — yeni kurulumda işletme listesi yok

Kullanıcı kararı (09.11.2026): yayımlanan uygulamanın başlangıç personel/plaka listesi kaldırılır. Telefonda kayıtlı kartlar silinmez, taşınmaz veya yeniden adlandırılmaz. Şema 7 ve kayıt biçimi aynıdır. Bu paket KDV/cari politikasını veya yerel ayrıştırıcıyı değiştirmez.

| Yeni kurulum | v3.10.02 | Aday |
|---|---:|---:|
| Hazır personel | 10 | 0 |
| Hazır araç | 17 | 0 |
| Araç takma adı | 19 | 0 |
| Özel plakaya bağlı tür eşleştirmesi | 4 | 0 |

Araç kartı bulunamayan başlangıç araç fiyatları oluşturulmaz: boş vehicle_id, araca özel tarifeyi genel saat/yevmiye tarifesine çevirmemelidir. Önceden kaydedilmiş fiyatlar korunur. Mevcut iki genel iş türü fiyatı bu paketin kapsamı değildir ve değişmez.

Tür atama yardımcısı açık bir eşleştirme verildiğinde aynı kontrolleri korur; uygulamanın otomatik açılış çağrısında özel plaka kataloğu yoktur. Yard testi aynı sonuçları sentetik fixture eşleştirmesiyle denetler. Dört eski tarayıcı suiti başlangıçtaki özel araç/personeli örtük fixture olarak kullanıyordu; bu suitlere açık TEST kartları eklendi, bütün assert ifadeleri aynı kaldı.

Yerel doğrulama: 185 Node dosyası, yeni kurulum/güncelleme gizlilik tarayıcı testi ve ilk üç fixture uyarlaması geçti. Aynı gizlilik testi değişmemiş v3.10.02 üzerinde başarısızdır. Altın setlerin güvenlik ve hazır kart sonuçları korunur (73 asistan örneği; toplu 15/38 hazır, 21 gereksiz soru, sessiz yanlış 0). Bunlar dondurulmuş yerel yanıt ölçümüdür, gerçek Gemini değildir.

Tam CI, tarayıcı ve tarihsel yükseltmeler geçmeden merge yapılmaz. Kayıtlı personel/araç/takma ad/fiyatların açılış sonrası byte eşitliği sentetik tarayıcı profiliyle kontrol edilir. Yayın sonrası yeni servis çalışanı, kaynak dosya özetleri ve boş ilk kurulum ayrıca doğrulanır.

Sınır: değişiklik yeni yayınlanan uygulamanın özel başlangıç kataloğunu kaldırır; Git geçmişini veya daha önce indirilen dosyaları silmez.

İlk tam CI (42605931357) integrity_review88 taze-cihaz senaryosunun da hazır bir araç beklediğini yakaladı; varsayılan liste boş olduğundan undefined.id ile durdu. Bu senaryoya sentetik araç fallback'i eklendi; bütün güvenlik assert'leri aynı kaldı, ilgili suit yerelde 12/12 geçti. CI artık dört fixture uyarlamasının bütün assert AST'lerini değişmemiş v102 ile karşılaştırır. İkinci tam kapı ayrıca zorunludur.

İkinci tam koşu öncesinde henüz çalışmamış son 10 tarayıcı suiti de yerelde geçti. Uygulama kaynakları ilk tam koşudan beri değişmedi; yalnız sentetik fixture kurulumu ve bunu koruyan CI assert denetimi eklendi.
