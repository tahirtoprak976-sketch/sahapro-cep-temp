# SOLO v3.9.52 — yeni istek ve önceki sonuca düzeltme

## Doğrulanan sorunlar

Gerçek Chromium'da yapay veri ve taklit Gemini yanıtıyla ölçüldü:

- İlk sonuçtan sonra “Ödemelerim” yazmak yerel ödeme yanıtı yerine ikinci
  Gemini isteği oluşturuyor, metin `[DÜZELTME]` ile önceki mesaja ekleniyordu.
- Önceki sonuç açıkken yeni fotoğrafı yazısız göndermek “Düzeltme yazın ya da
  yeni mesaj girin” uyarısıyla engelleniyordu.
- Gönder düğmesinin kilidi ilk asenkron okumalardan sonra konuyordu; aynı
  isteğin eşzamanlı işlenmesini baştan engelleyen bir kilit yoktu.

Kullanıcı daha sonra örnek verdi: müşterinin kendi forkliftine verilen 20 L
mazot, müşteri adı yazılmasına rağmen istenen şekilde işlenmemiş. Bu ayrı yakıt
yönü/alıcısı senaryosudur; depodan düşme ve müşteri hesabına bedel yazma tercihi
netleştirilmeden finansal sonuç varsayılmaz. Bu sürüm o yeni kayıt yolunu
eklemez. Yukarıdaki bulgular o olayın kesin sebebi diye sunulmaz. Öncelikler ve bekleyen döküm işleri
[plan dosyasına](ONCELIKLER_ASISTAN_DOKUM.md) kaydedildi.

## Yeni davranış

Yeni iş/istek, yerel komut ve önceki kontrol kartlarına düzeltme ayrılır.
Göndermeden önce metnin “yeni istek” veya “önceki sonuca düzeltme” olarak
okunacağı görünür. “Müşteri Kaya olacak”, “2 sefer”, “ilk işin müşterisi Leda”
gibi belirgin düzeltmeler önceki kaynak ve planla birlikte gider. Bağımsız yeni
iş eski mesaja katılmaz. “Önceki sonucu düzelt” kutusuyla seçim değiştirilebilir;
her sonuçtan sonra elle yapılmış seçim sıfırlanır.

Boş/yalnız cevap içeren eski sonuç, sonraki kısa mesajı otomatik düzeltme yapmaz.
Kullanıcı isterse önceki boş sonucu da açık seçimle yeniden inceletebilir. Yerel
komut işlendiğinde eski görünmeyen taslağın düzeltme hedefi temizlenir; müşteri
kartı konuşma bağlamı kendi mevcut kurallarıyla devam eder. Kaydedilmiş sonuç
yeni bir düzeltme hedefi sayılmaz.

Yeni fotoğraf/ses yazı olmadan gönderilebilir. İmzalı SP1 ve dosya aktarımı,
WhatsApp dışa aktarımı ve aynı mesajı yeniden okuma bağımsız kalır. Fotoğraf
kimliği, imza, paket adet/sıra ve doğrulama kontrolleri değiştirilmez.

Gönder ilk tıklamada kilitlenir. Metin, dosya ve eski kontrol kartları işlem
sürerken düzenlenmez; ikinci gönder olayı işlenmez. Hata/erken dönüşte önceden
etkin kontroller açılır; zaten devre dışı olanlar açılmaz. Hatalı istekte metin
korunur. Bu akış kendiliğinden işletme kaydı oluşturmaz; mevcut onaylı Kaydet
adımı devam eder.

## Sınırlar ve doğrulama

Bu değişiklik girişin nasıl bağlama alınacağını düzeltir. Gemini'nin her serbest
cümleyi kusursuz anladığı veya bütün işletme işlemlerini yapabildiği anlamına
gelmez. Otomatik ayrım belirgin kurallardır; belirsiz ifadede kullanıcı seçimi
vardır. Uzun yeni metin varsayılan yeni istektir; önceki sonuca uzun düzeltme
göndermek için kutu açıkça seçilebilir. Konuşma geçmişi sunucusu veya kalıcı
çoklu taslak sistemi eklenmedi.

- Node 106/106 test dosyası PASS; syntax 147 dosya, SW 146 JS modülü.
- Yeni saf test: bağımsız mesajlar, alan/miktar/satır düzeltmesi, açık seçim,
  boş/kaydedilmiş sonuç, fotoğraf/ses, SP1/WhatsApp ve değişmeyen kaynak.
- Yeni Chromium suiti: gönderilen gerçek HTTP gövdesi ve ekrandaki kartlar
  kontrol edilir. Kısa yeni iş yalnız gönderilir; miktar/müşteri düzeltmesi eski
  kaynakla gider; yerel komut Gemini'ye gitmez; yeni fotoğraf kabul edilir;
  çift olay tek istek, hata/tekrar ve gerçek SW ile çevrimdışı komut çalışır.
- Model yanıtları bu suitte belirlenmiş taklit yanıtlardır. Test, gerçek
  Gemini'nin belirsiz mesajları anlama başarısını ölçmez. Gerçek dış AI isteği
  veya mesaj gönderimi yapılmaz.
- On tarayıcı suiti PASS: assistant_turn, assistant_operations,
  command_selection, command_dates, driver_import, driver_cash, driver_transfer,
  driver_pdf, payment_agenda, business_priorities.

Okuma ve kart hazırlama testlerinde işletme/audit verisi değişmez. Şoför ithal
etme ve açık onaylı düzeltme regresyonları kendi yapay verilerine kasıtlı kayıt
yazar. DB şeması 5; sürüm ve atomik SW önbelleği v3.9.52.
