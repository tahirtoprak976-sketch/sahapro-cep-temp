# Akıllı Asistan incelemesi — SOLO v3.9.80

Tarih: 28.10.2026. Taban: canlı v3.9.79, `c060530996e5162a07ed268944f30ab51df57ebc`.

Bu çalışma yalnız asistanın okuma, yönlendirme, taslak, onay ve belge bağlantısı sınırlarını değiştirir. Şema 7 korunur; eski iş/para/yakıt kayıtlarını kendiliğinden düzeltmez. YZ2 kapsam dışıdır.

## Kaynak araştırması ve yöntem

Google'ın [yapılandırılmış çıktı belgesi](https://ai.google.dev/gemini-api/docs/structured-output) JSON biçiminin iş anlamında doğruluk garantisi olmadığını ve uygulamada değer doğrulaması gerektiğini belirtir. [GenerateContent / FinishReason](https://ai.google.dev/api/generate-content#FinishReason) içinde `MAX_TOKENS` token sınırında durmayı, `STOP` olağan bitişi belirtir. Bu nedenle yalnız JSON'un açılması yeterli kabul edilmedi; bitiş nedeni ve satır/belge kanıtı da kontrol edildi.

İnceleme kod okuması, eski sürümde kusur üretimi, saf karar testleri, gerçek Chromium + IndexedDB onay akışı ve kurulu uygulamanın servis çalışanıyla yükseltilmesinden oluşur. Model yanıtları deterministik TEST yanıtlarıdır; gerçek mesaj, işletme yedeği, özel anahtar veya ücretli model isteği kullanılmaz. Bu testler Gemini'nin görsel okuma başarısını ölçmez.

## Doğrulanan kusurlar ve düzeltmeler

1. **Yarıda kesilmiş yanıt:** `MAX_TOKENS` ile gelen kapanmış JSON kabul edilebiliyordu; araç çağrılı yanıtta da öneri aracı çalışabiliyordu. JSON yolu bir kez kısaltılmış tam yanıt ister; yine kesilirse hata verir. Araçlı yolda eksik yanıtın hiçbir çağrısı çalışmaz. Güvenlik/bozuk yanıt nedenleri geçerli görünen içerikle aşılmaz. Hesap sorusundaki eksik yanıt da tamamlanmış cevap sayılmaz.
2. **Sessiz satır kaybı:** örneğin 11 bakım satırının yalnız ilk 10'u gösteriliyordu. Mevcut grup sınırları ortak plan denetiminde uygulanır. Sınır aşımında veya bozuk satırda tüm öneri açık hata verir; kullanıcıdan mesajı bölmesi istenir. Son satırlar sessizce atılmaz. Model araçları ve fotoğraflı eski JSON yolu aynı denetimden geçer.
3. **Tarih değişmesi:** geçersiz yakıt/gider/tahsilat/bakım/personel/depo tarihi bugüne dönüyordu. Artık tarih boş bırakılır, kart seçilmez ve tarih istenir. Dört aydan eski geçerli tarihleri reddeden 120 günlük sınır kaldırıldı. Gerçek takvim ve geleceğe ilişkin mevcut tarih sınırları sürer. Belirtilmeyen tarihin bugünkü varsayılanı bu sürümde genel olarak değiştirilmedi; yerel yeni taslaklar tarihi boş sorar. Kart/belge güncellemelerinde 31 Şubat gibi taşan takvim tarihleri de reddedilir.
4. **Belge karışması:** gider, yakıt ve depo girişinde bir fotoğrafın sayısı başka fotoğraftaki satırı doğrulayabiliyordu. Artık satırın gerçek mesaj alıntısı ve kendisine atanmış fotoğraf kullanılır. Geçersiz alıntı/indeks uyarı verir. Birden fazla fotoğraf varsa sahipsiz satır otomatik seçilmez. Fatura ayrıntısı da başka fotoğrafların birleşiminden doldurulmaz.
5. **Bakım eki:** modelin belirttiği bakım fotoğrafı kaybolabiliyor; ilk fotoğraf birden fazla bakıma kopyalanabiliyordu. Bakım şemasına `photo` eklendi; doğru fotoğraf özgün baytlarıyla bağlanır. Tek fotoğrafın örtük bağlanması yalnız başka belge sahibi olmayan tek bakımda yapılır.
6. **Bağlam kapalıyken eski isteğe müdahale:** sohbet paylaşımı kapatıldığı halde yerel taslak tamamlama ve önceki müşteri adı sorusu kullanılabiliyordu. Bu yollar da aynı bağlam seçimini uygular; eski taslağa bağımsız kısa mesaj yamalanmaz.
7. **Elle düzeltmenin kaybolması:** karttaki birim fiyat/açıklama değişikliği kalıcı görev planına geçmediği için sonraki model yaması eski değeri geri getiriyordu. Düzenlenebilir alanlardaki değişiklikler model çağrısından önce, açık görev ve revizyon denetimiyle, kullanıcı kaynaklı kart düzeltmesi olarak korunur. Ana/alt firma ve satır kimlikleri aynı kalır. Fiyat, tahsilat ve miktar ayrı alanlardır.
8. **Başarısız okumada taslak kaybı:** yükleniyor yazısı eski kartları siliyordu. Hata halinde mevcut DOM düğümleri ve kullanıcı alanları geri gelir; olay bağları korunur. Mesaj ve dosya taslağı saklanır. Hazırlık veya kayıt okuma hataları da mevcut kartların üzerine uyarı ekler.
9. **Süresiz okuma:** ana asistanın model turu için ortak iptal/zaman sınırı yoktu. Görünür **Okumayı durdur** düğmesi, 90 saniyelik toplam okuma süresi ve istek başına 2 MiB yanıt sınırı eklendi. Yeniden deneme, model değişimi, araçlı hesap ve fiş ikinci okuması aynı sinyali kullanır. Ekrandan ayrılmak okumayı iptal eder; geç gelen sonuç eski ekrana yazılmaz. İptal kayıt silme veya geri alma değildir. Ağ istekleri mevcut izin ve günlük bütçe kapısından geçer.
10. **Yanlış kısayol:** müşteri telefonu, ana firma, araç plakası veya muayene gibi kart/belge düzeltmeleri iş arama komutuna takılıyordu. Bunlar doğrulanan planlayıcıya gider; açıkça iş kaydının aracını/plakasını değiştiren komut yerel iş seçimini korur. Anahtarsız genel serbest güncelleme yeteneği eklendiği iddia edilmez.
11. **Eski önizlemenin yeni kaydı ezmesi:** asistan eski öneriyle kaydetmeden hemen önce yeni kaydı okuyup eski alanları üstüne yazabiliyordu. Seçili düzenleme kartları yazım öncesi topluca kontrol edilir; değişmiş kayıt varsa hiçbir seçili kart başlamaz. Güncellemenin gerçek yazımında orijinal önizleme kaydı ve transaction içi `strict` revizyon denetimi kullanılır. Silmede mevcut bağımlılık kontrolleri korunur; asistan ön denetimi yazma transaction'ı yerine geçmez.
12. **Ödeyen kişi belirsiz:** “Personel Ödedi” seçilmişken personel bulunmazsa şirket gideri gibi varsayılabiliyordu. Kart seçilmez; kullanıcı ödeyeni/ödeme şeklini belirlemeden kaydedemez. Boş dosya seçimi de gereksiz kalıcı boş dosya taslağı oluşturmaz.

## Kanıt ve testler

- `tests/assistant-audit80.test.mjs`: tüm grup sınırları, bozuk plan, farklı kaynak/fotoğraf, geçersiz ve eski tarihler, ödeyen kişi, ek sahipliği, kart yönlendirme, kesik yanıt, iptal, süre ve yanıt boyutu.
- `tools/e2e/assistant_audit80.py`: aynı test hem değiştirilmemiş v3.9.79 üzerinde kusuru kanıtlar hem aday sürümde düzeldiğini gösterir. Gerçek kart alanları, kalıcı görev, kayıtların hiç değişmemesi, başka ekran güncellemesi ve gerçek kırmızı/mavi PNG baytları kontrol edilir.
- Mevcut asistan konuşma/araç/taslak, müşteri oluşturma, toplu giriş, şoför, parça-belge ve hesap testleri sürer. CI artık bu ilgili tarayıcı suitlerini de her sürümde çalıştırır.
- Yükseltme: v3.9.79 dahil eski kurulu sürümlerden şema, kayıt, metadata, taslak ve ek baytlarının birebir korunması kontrol edilir.
- Yayına çıkış ölçütü: son commit'in tüm Node ve tarayıcı testleri, yükseltme ve eski sürüm kusur kanıtları başarılı; ana dalın tabanı değişmemiş; Pages yayını başarılı; canlı uygulama varlıkları kaynakla aynı ve gerçek tarayıcıda yeni servis çalışanı etkin.

Eski `assistant_turn` testi yanıtın mutlaka yavaş geleceğini varsayıyordu. Artık TEST yanıtı kilit kontrolüne kadar bekletilir; çift gönderme ve alan kilidi iddiaları korunur. Eski müşteri testi, alt müşterisi olan ana firmayı silmeye çalışıyordu; v3.9.79'un finans bağımlılığı korumasında zaten başarısız olduğu doğrulandı. Test şimdi bu korumayı ayrıca doğrular ve silinmiş ana firma senaryosunda ayrı, bağımsız TEST kartı kullanır. Sürüm sabiti testi v3.9.80'e güncellendi; güvenlik veya veri koruma iddiaları gevşetilmedi.

## Sınırlar

- Asistan genel bilgisayar yetkisine sahip değildir. Şema/araç sınırları, kullanıcı onayı ve mevcut veri kontrolleri sürer. Fotoğrafın ham yazısı da model çıktısıdır; görüntüyü doğrulayan bağımsız bir muhasebe belgesi sayılmaz.
- Birden fazla kartın kaydı tek dev transaction değildir. Kısmi hata olursa mevcut işlem kimliği, kayıt sonucu ve geri alma akışı izlenir; kör toplu tekrar yapılmaz. Eski hatalı kayıtlar bu sürüm tarafından tahminle değiştirilmez.
- Tarayıcı TEST verisi gerçek telefondaki müşteri/araç adlarının tamamını veya gerçek Gemini yanıtlarını temsil etmez. Gerçek fiş ve mesajların son kontrolü kullanıcıdadır.
- Önceki sohbet kapalıyken bu tur eski konuşma/açık taslağı kullanmaz. İşletmenin güncel kartlarını kullanma ve kayıtları sorgulama asistanın temel işidir; bu ayar tüm işletme verisini modelden gizleme ayarı değildir.

Son yayın ve CI kimlikleri teslim raporunda ayrıca verilir; test edilmiş commit ile canlı dosyaların eşitliği oradan izlenir.
