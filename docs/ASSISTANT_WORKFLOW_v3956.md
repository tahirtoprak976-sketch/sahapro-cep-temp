# Ortak iş asistanı taslak motoru — v3.9.56

Önceki müşteri oluşturma diyaloğunun ardından kullanıcı tüm iş akışının güçlendirilmesini istedi. Bu dilim, iş/tahsilat/gider/yakıt/bakım kartları için aynı tamamlama motorunu ekler. Model ilk serbest mesajı okuyabilir; açık karttaki desteklenen devam cevapları yeniden model çağrısı yapmadan uygulanır.

## Kullanım

“Yeni iş kaydı oluştur”, “Tahsilat gir”, “Yeni gider ekle”, “Yeni yakıt kaydı oluştur”, “Yeni bakım kaydı oluştur” boş kontrol kartı açar. Bu başlangıçlar ve kartların desteklenen cevaplarla tamamlanması internetsiz/anahtarsız çalışır. Anahtar yokken eşleşmeyen bir devam mesajı açık taslağı silmez; kullanıcı alanlardan devam edebilir. Yerel başlangıçta tarih boş bırakılır.

Kullanıcı karttaki listeleri de kullanabilir; konuşma örnekleri:

- “Dün”, “müşteri Gürçelik Sürücü Kursu”, “araç 34ABC123”, “Makine Çalışması”, “2 saat”.
- “birim fiyat 1.500 TL”, “personel Soner”.
- “ikinci iş 3 sefer”, “tahsilat tutarı 20.000 TL”, “ödeme şekli Havale”, “banka İş Bankası”.
- “açıklama Yağ alındı”, “litre 20”, “kaynak Depo Tankı”.

Bunlar isimlere özel kurallar değildir. Seçimler açık kartın gerçek listelerinde tam ad/plaka/kimlikle çözülür. Yalın ad yalnız eksik bir liste alanını tamamlar; açık alan adı verilirse mevcut değer düzeltilebilir. Aynı adlı/aynı plakalı birden fazla kartta seçim yapılmaz. Birden fazla uygun taslakta hedef seçimi istenir; diğer kartlar korunur. Şoförün imzalı aktarım kartları ortak otomasyona alınmaz; mevcut aktarım ve kontrol yolu korunur.

## Kullanıcıya görünen kontrol

“İşlem taslakları” kutusu kartları, eksik alanları ve seçili sayısını güncel form değerlerinden hesaplar. İş miktarları birimleri ayrı tutularak gösterilir. Kart düğmesi eksik alana götürür. Sohbetle değişen kart tekrar işaretsiz olur; yalnız Kaydet düğmesiyle kayıt gerçekleşir. “Onayla” mesajı yazma işlemi değildir.

Modelin iş planı, kaynak alıntısı ve fotoğraf dizisi korunur; desteklenen değişiklikler ilgili satırda tutulur. Yeni bağımsız iş mesajları eski taslağa eklenmez. Kullanıcının yeni bir isteği seçmesi ve normal model planlayıcısı mevcut akışında çalışmaya devam eder.

## Kayıt kontrolleri

- Birim fiyat, toplam bedel ve tahsilat ayrı rollerdir. İş taslağına gelen yalın TL tutarı birim fiyata dönüştürülmez; anlamı sorulur.
- Sayı/tarih kontrolleri; havalede banka, müşteri verdi kaynağında veren müşteri gibi koşullu alanlar vardır.
- Seçili desteklenen kartların tamamı, ilk yazma başlamadan önce güncel DB görüntüsüyle kontrol edilir. Eksik tarih veya artık mevcut olmayan müşteri/araç/personel/banka/tedarikçi kaydı tüm seçili grubun başlamasını engeller.
- Bu kontrol, bütün grubu tek transaction yapan yeni bir sunucu değildir. Mevcut işlem bazlı transaction, işlem kimliği, mükerrer, undo ve kısmi hata yolları devam eder.
- Genel “Yeni iş kaydı oluştur” cümlesi her işte aynı olacağından, yerel başlangıca ayrı taslak kimliği verilir. Aynı gün ikinci bağımsız işin işlem kimliği ilk işle çakışmaz. Aynı taslağın tekrar kaydı mevcut işlem kapısıyla korunur. Model/WhatsApp kaynaklarının mevcut mesaj kimliği değişmez.
- Tamamlanan temel eksik alanların eski uyarıları temizlenir; diğer kaynak/tahmin uyarıları korunur. Sohbet düzeltmeleri kaynak notuna eklenir.

## Sınırlar

Serbest metin, yeni karmaşık/çoklu işler, fotoğraf/PDF/ses okuma mevcut Gemini bağlantısını kullanır. Yerel devam dili sınırlı ve açık alan/kimlik eşleştirmesidir; her Türkçe cümlenin anlaşıldığı iddia edilmez. Onaylanmamış çoklu işlem/formlar sayfa yenilemesinden sonra yeniden kurulmaz; fotoğraf veya taslaklar otomatik yeniden gönderilmez. Fişler, sözleşmeler, KDV ve fiyat seçimi mevcut kurallarla hesaplanır; bu dilim yeni bir muhasebe yöntemi getirmez.

## Kontroller

`tests/assistant-workflow.test.mjs`: beş başlangıç, çoklu kart hedefi, tam kimlik ve aynı adlı kartlar, para rolleri, geçersiz/negatif değer, tarih, yeni bağımsız mesaj, değişmez plan ve güncel kayıt kontrolü.

`tools/e2e/assistant_workflow.py`: gerçek mobil Chromium/IndexedDB/SW; beş gerçek kayıt türü, çevrimdışı tamamlama, açık kayıt onayı, aynı gün ikinci bağımsız başlangıç, modelden gelen çoklu kartta hedef seçimi, eksik tarih/silinmiş müşteri ön kontrolü, birim ayrımı ve dar ekranlar. Model gereken bölümde deterministik yanıt kullanılır; gerçek kullanıcı verisi ve gerçek AI çağrısı yoktur.

Teslim kontrolü: **110/110 Node test dosyası**, **151/151 JS sözdizimi**, **150 SW modülü**. Gerçek tarayıcıda ortak workflow, istek/düzeltme, sohbet, müşteri oluşturma, model müşteri eylemleri, iş miktarı düzeltme, şoför nakit, şoför dosya aktarımı, müşteri mazot teslimi ve fiş kurtarma paketleri geçti. Canlı yayının dosya ve tarayıcı doğrulaması dağıtım sonrası ayrıca yapılır.
