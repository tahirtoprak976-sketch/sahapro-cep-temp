# v3.9.75 — üç redteam bulgusunun kontrollü düzeltmesi

Taban: `57da7b2a0a5372f74cbb486ffc88eb2a2ea76fcc` (v3.9.74). Şema **7** olarak kalır. Yeni kayıt göçü, geçmiş iş aktarımı veya toplu kayıt düzeltmesi yoktur.

## Değişen davranış

1. **Ek güvenliği (RT-01).** JPEG/PNG/WebP/PDF dosyaları dosya adı veya bildirilen MIME yerine baytlarından denetlenir. Rasterlar tarayıcının güvenli resim çözücüsünden geçer; PDF başlığı ve sonlandırma yapısı denetlenip yalnız PDF MIME ile açılır. Yeni SVG/HTML, taklit MIME ve bozuk dosyalar görünür hata ile reddedilir. Ortak sınır iş/belge/imza/parça/döküm, şoför paketi, paylaşılan dosya ve PDF taslağı girişlerinde uygulanır. Dosya seçimi tamamlanmadan bağımlı okuma/kayıt başlamaz; eski, geç tamamlanan seçim yeni seçimin üstüne yazılmaz.

   Önceden saklanmış veya yedekten gelmiş desteklenmeyen özgün ekler **silinmez veya yeniden yazılmaz**. Görüntüleme anında tekrar denetlenir; aktif sekmede veya ham resim önizlemesinde açılmak yerine `application/octet-stream` ve `.quarantined.bin` adıyla açık uyarılı indirme sunulur. Resimlerin uzun basma/“yeni sekmede aç” yolu da yalnız doğrulanmış raster baytlarını görür. Eski e-fatura XML/ZIP içe aktarma özelliği için dar, ayrık arşiv yolu bulunur: fatura olarak ayrıştırılmış özgün dosya atomik saklanır, fakat aynı ortak görüntüleyici onu da yalnız inert indirmeye alır. Arşiv bayrağı güven yetkisi değildir. Özgün XML/ZIP'nin dosya adı ve baytları yedekte korunur.

2. **Tonaj kapsamı (RT-02).** Ortak çözümleyici `total` değerini tüm seferlerin toplamı olarak korur; `per_trip` seferle çarpar. Çok seferli kayıtta belirtilmemiş/`unknown` kapsam araç kartından tahmin edilmez. Metraj, kantar ortalaması, katsayı öğrenme, döküm hesabı ve müşteri raporları aynı anlamı kullanır. Kapsamı belirsiz metrajdan gelir/kâr üretilmez. Örneğin 2 sefer + toplam25ton, araç tahmini değişse de25ton ve aynı yoğunlukta12,8m³ kalır. Girilmiş özgün değer değiştirilmez; ekranda toplam/sefer başı/belirsiz etiketi gösterilir.

3. **Eksik maliyet (RT-03).** Bekleyen yakıt, bilinmeyen döküm veya doğrulanamayan kalan döküm maliyeti kâr, marj ve m³ başına kârı `null` yapar. Bilinen gider ara toplamı görünür kalır. Gerekçe dökümse “döküm maliyeti eksik” denir; her eksiklik yakıt olarak adlandırılmaz. Sözleşme panosu/listesi ve iç araç raporu/PDF aynı eksiklik kararını kullanır. Asistanın mevcut eksik maliyet korumaları regresyonla doğrulanır. İç maliyet kesinliği değişince müşteri raporunun finansal/özel bilgi kapsamı değişmez.

## Koruma ve doğrulama

- Yerel son toplu koşuda **144/144 Node test dosyası** geçti (assertion sayısı değildir).
- Yeni Node regresyonları: `attachment-safety`, `tonnage-scope`, `redteam-incomplete-cost`.
- Taban ağacında iki hesap hatası `BASELINE_PROOF=1` ile yeniden üretildi. Baseline sonucu adayın geçtiği anlamına gelmez.
- Yeni gerçek tarayıcı paketleri: `attachment_safety.py`, `redteam_finance.py`, `upgrade_schema7.py`.
- Ek güvenliği canary deneyi yalnız localhost/CI sentetik profilde çalışır. Tek script isteği test tarafından yerel zararsız yanıtla doldurulur; yalnız deneyin kendi sentetik DB işareti okunur. Dış veri/anahtar okunmaz veya gönderilmez. Canlı siteye kötü niyetli dosya yüklenmez.
- Mevcut26 tarayıcı paketi korunur; yeni2 paketle28 olur. Beş eski kurulu profil yükseltmesi korunur, yeni .74 şema7→.75 yükseltmesi eklenir. Gerçek SW bekleme, iptalde form koruma, açık onay, çevrimdışı açılış, müşteri raporu, audit, taslak ve özgün ek baytları sınanır.
- Eski tonaj testlerinin sayısal beklentileri korunup kapsamı açık fixture'lar kullanıldı; eski belirsiz örneklerin aynısı ayrıca belirsizlik regresyonudur. Eski “one/two” JPEG taklitleri gerçek3×3 sentetik görsellerle, sahte PDF geçerli tek sayfalı PDF ile değiştirildi; sıra/aynı ad/tam bayt/dedup/geri yükleme iddiaları korunur. İki eski tarayıcı kurulum fixture'ındaki SVG/metin, artık yeni yükleme gibi değil **önceden var olan özgün kayıt** olarak ekilir; bütün Python assertion AST'leri aynıdır. Sürüm beklentisi tam .75 olarak güncellenir; test gevşetilmez.

## Ortam ve yayın durumu

Yerel normal Chromium başlatma, uygulama açılmadan `process_singleton_posix.cc:297 socket() failed: Operation not permitted (1)` / SIGABRT ile engellendi. Güvenlik sınırını aşan bayrak, taşıma veya tekrar denenmedi. Node ve sözdizimi kontrolleri yerelde çalışır; gerçek tarayıcı, baseline canary ve kurulu profil yükseltmelerinin sonucu **tam commit için resmî CI** ile değerlendirilmelidir.

Bu belge veya taslak PR canlıya alındı beyanı değildir. Tam CI ve bağımsız inceleme sonrası yayın kararı ana sorumludadır.
