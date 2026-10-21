# SOLO v3.9.54 — sohbetle uygulamayı yönetmenin temeli

Kullanıcının hedefi: “Asistan adeta ChatGPT gibi olsun; ne istersem yapabilsin.”
Karar: yalnız yeni cümle kalıpları eklemek yerine mevcut kayıt/hesap araçlarının
üstüne konuşma devamlılığı ve doğrulanmış işlem sonucu katmanı koymak.
Bu sürüm kullanılan modeli değiştirmez: genel dil/belge okuma mevcut Gemini
bağlantısını kullanır. Yeni sunucu, abonelik veya OpenAI hesabı kurulmadı.

## Gerçekten eklenenler

- Ana asistan ekranında kullanıcı/asistan mesajları ve durumları ayrı görünür.
  Rehber ve ek araçlar mesaj alanından sonraya taşındı. Son **20 konuşma turu**
  bu cihazın IndexedDB meta alanında tutulur; yenilemede okunur, AI otomatik
  çağrılmaz ve eski kayıtlar otomatik tekrar işlenmez.
- Geçmiş için kullanıcıya görünen paylaşım kutusu vardır. Açıkken son en fazla
  **6 tur / 6500 karakter** genel planlayıcıya ve gerekiyorsa hesap araçlı
  soruya **atıf bağlamı** olarak gider. Eski müşteri/araç konuşması anlaşılabilir;
  eski rakamlar güncel bilanço veya yeni işlem talimatı sayılmaz. Sayısal
  doğrulama mevcut istek/düzeltme metni ve güncel kayıtlardan devam eder.
- Model komutu doğal dilde yanıtlamaya, desteklenen şemadaki işlemleri ayrı
  kontrol kartlarına hazırlamaya ve eksik bilgiyi kısa sorularla netleştirmeye
  yönlendirilir. Rastgele araç, kod/SQL veya yürütme yetkisi eklenmez.
- Boş işlem planından sonra gelen “Kaç sefer?” sorusuna “3 sefer” cevabı, önceki
  açık isteğe bağlanır. Müşteri/araç adları yalnız somut soruda ve tek kesin
  eşleşmede devam cevabı sayılır. Yeni bağımsız işler ve yerel komutlar önceki
  isteğe sessizce eklenmez. Mevcut manuel yeni/düzeltme seçimi korunur.
- Tek açık müşteriye forklift mazotu taslağında “litresi 45 TL”, “toplam 900 TL”
  veya eksik tarihe “dün” cevabı, aynı kontrol kartının alanını **internetsiz ve
  modelsiz** tamamlar. “900 TL” gibi birim/toplam ayrımı belirsizse sorulur;
  bu tutar doğrudan litre fiyatı kabul edilmez. Kart yine işaretsizdir ve onay
  ister. Bu aşamada stok veya cari yazılmaz.
- “Merhaba / neler yapabilirsin” yerel yardımcı yanıttır. “Onayla / kaydet”
  metni tek başına iş/para kaydı oluşturmaz; gerçek kontrol düğmesine yönlendirir.
  “Vazgeç” açık taslağı bırakır; kaydedilmiş finansal işlemi iptal etmez.
- **Bilgi gerekiyor / Onay bekliyor / Kaydedildi / Kontrol gerekiyor /
  Tamamlanamadı** durumları programatik tutulur. Kayıt öncesi modelin belirgin
  “kaydettim/gönderdim/sildim” iddiaları kayıt sonucu sayılmaz. Gerçek kayıt
  düğmesinin sonucu, başarı/çatışma/kısmi hata bilgisiyle ayrıca sohbet notuna
  yazılır. Sohbet notu kaydedilemezse başarılı iş/para kaydı geri alınmış gibi
  gösterilmez.
- Yeni sohbet mevcut sohbeti temizler. Başka sekmede sıfırlanmış sohbete eski
  ağ yanıtı geri yazılmaz; geç yanıt eski kontrol kartlarını diriltemez. Sohbet
  başlangıcında depolama hatası olursa mesaj korunur ve Gönder kilidi açılır.
- Sohbet metninde SP1 ve devamı, görünen API anahtarı/bearer token örüntüleri
  saklanmadan önce maskelenir. Fotoğraf/ses veya imzalı ham paket sohbet
  kaydına gömülmez. Maskelenen mesajdan otomatik işlem tekrarı yoktur.

## Sınırlar ve sonraki yön

Bu, bütün istekleri yapabilen veya ChatGPT modelini kullanan sınırsız bir ajan
değildir. Uygulanabilecek işlemler mevcut doğrulanan modüllerin yetenekleriyle
sınırlıdır. Hakediş kesinleştirme, her ekrandaki her alanı değiştirme veya
uygulama dışı WhatsApp gönderimini kendi başına tamamlama eklenmedi. Sistem
desteklemediği işlemi yapmış gibi göstermemelidir.

Sohbet kaydı **metin geçmişidir**. Eski kontrol kartları, seçili dosyalar ve
fotoğraf sırası kalıcı çalışma taslağı olarak geri açılmaz; sayfadan ayrılınca
belgeler tekrar seçilmeli ve kayıt önerisi yeniden kontrol edilmelidir. Aynı
anda birden fazla bağımsız işlem taslağını açık tutan görev listesi ve birden
fazla konuşma arşivi eklenmedi. “Yeni sohbet” son sohbeti siler; cihazlar arası
eşitleme veya sınırsız hafıza yoktur.

Genel dilin anlama başarısı gerçek Gemini ile bu turda ölçülmedi. Testteki model
yanıtları kontrollüdür; test edilenler bağlam aktarımı, doğrulama, UI ve kayıt
bütünlüğüdür. Yerel mazot devam yanıtları taklit modele bağlı değildir.

Sonraki geliştirmeler: desteklenen işlemlerin görünür yetenek envanteri;
kaynak kayıt seçimi ve önizleme isteyen eksik işlem araçları; dosyalı kalıcı
görev taslakları; aynı konuşmada birden çok görevin ayrı ilerlemesi. Bunlar
gerçek kullanıcı mesajı + beklenen sonuç kabul örnekleriyle genişletilecek.
Döküm yol haritası ayrı öncelik belgesinde korunur.

## Doğrulama

- Node **108/108 dosya**, syntax **149/149**, SW **148 JS modülü**.
- `assistant_conversation.py`: gerçek Chromium/IndexedDB/SW, boş plan→soru→kısa
  cevap, hazırlık ile gerçek kayıt ayrımı, metin onayıyla sıfır yazım, gerçek
  Kaydet sonucu, ayrı model bağlamı ve kapatma kutusu, yenileme, 320/360/768 px,
  çevrimdışı fiyat/toplam/tarih yanıtları, belirsiz tutar sorusu, taslak iptali,
  iki sekmede sıfırlama/geç yanıt, depolama hatası/tekrar ve 20 tur sınırı.
- `assistant_turn`, `customer_fuel`, `assistant_operations`, `command_selection`,
  `command_dates`, `driver_cash`, `driver_transfer`, `ticket_recovery`,
  `payment_agenda` ve `business_priorities` regresyonları ayrıca çalıştırılır.
- Kalıcı sohbet hata metnini de gösterdiği için üç eski UI testinin hata
  araması mevcut sonuç bölgesine daraltıldı; beklenen davranış gevşetilmedi.
- Testler yalnız sentetik veri kullanır. Gerçek mesaj gönderilmez, gerçek AI
  çağrısı yapılmaz, kullanıcının telefondaki verisi değiştirilmez. DB şeması 5.
