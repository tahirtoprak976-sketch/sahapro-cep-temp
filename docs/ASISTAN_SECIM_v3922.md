# v3.9.22 — Yerel asistan kart seçimi

Bu paket PR #141'deki tarih filtrelerinin üzerine eklenir; ayrı bir yayın değildir.

## Doğrulanan sorunlar
- JCB ve JCB 2 kartları varken “JCB 2 kartını aç” tek aracı bulamıyordu.
- Önceki müşteri Kılıç iken “kart JCB 2 aç” müşteriye gidiyordu.
- “ekstre Yeni Firma göster” tanınmayan adı görmezden gelip önceki müşterinin ekstresini açıyordu.

## Düzeltmeler
- Araç adları sözcük sınırıyla ve iç içe eşleşmede uzun tam ad önceliğiyle değerlendirilir. Plaka sınırları korunur: 34ABC123 ile 34ABC1234 farklıdır.
- Aynı isimli birden fazla araç veya birden fazla açık araç adı varsa seçim gösterilir. Düzenleme komutu belirsiz araçla tüm işlerde arama yapmaz.
- Personelde tam ad eşleşmesi ilk ada göre önceliklidir; ortak ilk ad belirsizse seçim gösterilir.
- Önceki müşteri yalnız “mazot hesabını göster”, “ekstresini hazırla”, “bu müşterinin kartını aç” gibi tanımlı devam komutlarında kullanılır. Tanınmayan isim içeren komut yerelde eski müşteriye bağlanmaz; mevcut Gemini/form yolu korunur.
- Müşteri adı ile araç adı aynı komutta çakışıyorsa, kart açmada “Müşteri mi, araç mı?” sorulur. İş düzeltme komutunda müşteri ve araç birlikte filtre olmaya devam eder.

## Doğrulama
- Birim regresyonları: benzer araç adı, plaka öneki, aynı isimli araç, tam/ilk personel adı, eski müşteri bağlamı, bilinmeyen yeni isim, silinmiş araç ve müşteri/araç çakışması.
- Chromium mobil ekran: önceki müşteri bağlamıyla doğru araç açılması, aynı isimli iki araç için seçim ve açık devam komutunda müşterinin korunması; sıfır Gemini isteği ve sayfa hatası.
- Önceki tarih filtresi tarayıcı testi yeniden geçti.
- Gerçek telefon denenmedi; serbest Gemini yorumlama yolu bu değişiklikle yeniden tasarlanmadı. Seçim kartları mevcut kart ekranlarını açar; çok turlu işlem kuyruğu eklenmedi.
- Veri şeması ve finans hesapları değiştirilmedi. Yeni komutlar kayıt yazmaz.
