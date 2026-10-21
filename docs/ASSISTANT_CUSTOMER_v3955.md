# Asistandan müşteri oluşturma — v3.9.55

Kullanıcı Gürçelik Sürücü Kursu ve Kemer Country No 53 kartlarını açamadığını bildirdi. Eski akışta müşteri açma yalnız modelin `actions:create/customers` üretmesine bağlıydı; ad → “bunu yeni oluştur” için yerel bir diyalog yoktu. Telefonun eski model yanıtı paylaşılmadığı için tek bir geçmiş yanıtın kök nedeni kesinleştirilmiş değildir.

## Kullanım

- “Gürçelik Sürücü Kursu adında müşteri oluştur”
- “Kemer Country No 53 için yeni müşteri aç”
- “Yeni müşteri oluştur” → asistanın ad sorusuna yalnız adı yazın.
- Önce yalnız adı, hemen ardından “bunu yeni oluştur” yazılabilir. Yalnız önceki kullanıcı mesajındaki ad kullanılır; modelin önerdiği bir ad seçilmez.

Bu komutlar anahtarsız ve çevrimdışı çalışır. Oluşturulacak ad düzenlenebilir; telefon ve ana firma isteğe bağlıdır. Kullanıcı **Müşteriyi oluştur** düğmesine basana kadar kayıt oluşmaz. Sohbete “onayla” yazmak işlemi uygulamaz.

## Kayıt doğruluğu

- Adın özgün yazımı ve `No 53` gibi sayılar korunur; Türkçe büyük/küçük harf ve boşluk farkları aynı kimlik sayılır.
- Ad + seçilen ana firma kimliği birlikte değerlendirilir. Ana firma kendiliğinden atanmaz.
- Tam aynı kart varsa mevcut kart açılır. Birden fazla aynı kart varsa kullanıcı seçer.
- Benzer isimler otomatik eşleştirilmez. Yeni adın ayrı kart olduğu ayrıca işaretlenmelidir; ad/ana firma değişirse bu seçim sıfırlanır.
- Müşteri ve audit aynı IndexedDB transaction içinde yazılır. İki sekmedeki onay aynı kartı kullanır; mevcut telefon/not değiştirilmez.
- Yeni sohbet açılması, eski sekmedeki taslağın kaydetmesini aynı transaction içindeki sohbet kimliği kontrolüyle engeller.
- Modelden gelen müşteri oluşturma eylemleri de aynı atomik yardımcıyı kullanır; telefon ve not korunur, diğer keyfi alanlar taşınmaz. Diğer eylem türleri değişmedi.
- Bu işlem yalnız müşteri kartı açar; iş, tahsilat, borç, yakıt veya gider üretmez.

## Sınırlar

Yerel isim akışı bilinçli olarak kısa, açık müşteri oluşturma isteklerini karşılar. İşlem cümlesi, olumsuz talimat, telefonla birlikte karmaşık istek veya birden fazla müşteri isteği ad kabul edilmez; mevcut model planlayıcısına gider. Yalnız ad yazmak tek başına kart açma yetkisi değildir. Ad sorusunun durumu sohbetle saklanır; onaylanmamış form alanları sayfa yenilendikten sonra otomatik işleme alınmaz. Genel konuşma/belge okuma mevcut Gemini bağlantısına bağlıdır.

## Doğrulama

- `tests/assistant-customer.test.mjs`: kullanıcının iki adı, Türkçe/ASCII komutlar, sayıların korunması, kısa devam mesajları, olumsuz/finansal cümlelerin reddi, ana firma kimliği.
- `tests/assistant-conversation.test.mjs`: yalnız izin verilen müşteri niyetinin saklanması/temizlenmesi.
- `tests/assistant-actions.test.mjs`: aynı adlı farklı ana firmalardaki müşteriler.
- `tools/e2e/assistant_customer_actions.py`: modelden gelen müşteri eylemlerinin gerçek doğrulama/önizleme/kayıt akışı; ikinci sekmedeki eski önizleme de ikinci kart açmaz.
- `tools/e2e/assistant_customer.py`: gerçek mobil Chromium + IndexedDB + SW; çevrimdışı/anahtarsız kullanım, yenileme, gerçek düğmeyle onay, iptal, benzer kayıt, iki sekmeden kayıt, eski sohbet engeli, audit hatasında geri alma ve tekrar deneme, alan izin listesi, dar ekranlar. Yalnız sentetik veri.

Teslim öncesi: Node **109/109 test dosyası**, JS sözdizimi **150/150**, SW asset listesi **149 modül** geçti. İki yeni müşteri tarayıcı paketi ve mevcut sohbet, istek/düzeltme ayrımı, müşteri mazot teslimi, şoför nakit, şoför dosya aktarımı, iş düzeltme paketleri geçti. Model kullanılan senaryolarda yanıtlar deterministik taklittir; canlı Gemini doğruluk ölçümü yapıldığı iddia edilmez.
