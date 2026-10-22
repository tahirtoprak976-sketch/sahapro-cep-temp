# İşletme sahibinin öncelikleri — 21.10.2026

## Güncel hedef: uygulamayı sohbet ederek yönetme

Kullanıcı “ChatGPT gibi, istediğimi yapabilsin” istedi. v3.9.54'te bounded
cihaz içi sohbet geçmişi, seçilebilir konuşma bağlamı, eksik bilgiye devam
cevabı ve gerçek işlem sonucu ayrımı eklendi. Genel dil Gemini ile çalışır;
keyfi kod/yetki veya sınırsız işlem iddiası yoktur. Sonraki araçlar gerçek
kullanıcı kabul örnekleriyle genişletilecek. Dosyalı kalıcı görev ve çoklu
bağımsız taslak henüz yoktur. Ayrıntı: [sohbet katmanı](ASSISTANT_CONVERSATION_v3954.md).

v3.9.55: kullanıcının açamadığı **Gürçelik Sürücü Kursu** ve **Kemer Country No 53**
örnekleriyle müşteri oluşturma yerel diyaloğu eklendi. Ad → “bunu yeni oluştur”,
ad sorusuna devam, benzer kartı kullanıcıya seçtirme ve atomik mükerrer koruması.
Ayrıntı: [müşteri oluşturma](ASSISTANT_CUSTOMER_v3955.md).

v3.9.56: beş işlem türünde ortak taslak motoru, eksik alan panosu, hedef seçimi,
yerel devam cevapları ve kayıt öncesi güncel alan/kart kontrolü. Ayrıntı:
[ortak iş asistanı motoru](ASSISTANT_WORKFLOW_v3956.md).

v3.9.57: çevrimiçi serbest yazılı istekte native kayıt arama/okuma/hesap/soru
döngüsü; tek kalıcı açık istek, hedef satır yamaları, sohbet/revizyon koruması
ve gerçek kayıt onayından önce kalıcı görev kilidi. Yeni sohbet görevi de
temizler; tamamlanan/kısmi görevi otomatik tekrar uygulamaz. Dosyalı görev
ve çoklu görev arşivi hâlâ yoktur. Ayrıntı:
[sorgulayan iş asistanı](ASSISTANT_AGENT_v3957.md).

## Öncelik 1: asistanın istenen işi doğru anlaması

Kullanıcı: “Asistanı geliştirmemiz lazım; yazdığım şeyleri tam istediğim gibi
yapmıyor.” Döküm geliştirmelerinden önce bu ihtiyaç ele alınacak.

- Kullanıcının gerçek başarısız mesajı ve beklediği sonuç birlikte toplanacak;
  doğrulanmamış kök neden, kullanıcının özel olayının sebebi diye sunulmayacak.
- Yeni istek, önceki taslağa düzeltme ve mevcut kayıt üzerinde değişiklik
  ayrılacak. Yeni mesaj eski işlerin içine sessizce katılmayacak.
- Müşteri/ana firma/taşeron, personel, araç, tarih, miktar, para ve mazot
  birbirinin yerine geçirilmeyecek. Belirsiz hedef rastgele seçilmeyecek.
- İstenen iş mevcut kapasitenin dışındaysa yapılmış gibi cevap verilmeyecek;
  eksik bilgi veya kullanılabilecek kaynak ekran açıkça belirtilecek.
- Her doğrulanan kullanıcı örneği anlamlı bir regresyon senaryosu olacak.
  Model okuması ve uygulamanın doğrulaması ayrı incelenecek.
- Kullanıcının verdiği somut örnek: müşteri adı yazılmış olmasına rağmen
  müşterinin kendi forkliftine verilen 20 L mazot istediği şekilde işlenmedi.
  Bu, “müşteri bize mazot verdi” işleminden ayrılmalı. Kullanıcı açıkça onayladı: kendi depodan düşsün, müşteriye TL borç yazılsın.
  Bedel mesajda yoksa kullanıcı tamamlayacak; depo alış fiyatı satış bedeli sayılmayacak.
  v3.9.53 bu yönü ayrı teslimat kartı ve atomik depo/cari kaydıyla karşılar. Mevcut yakıt doğrulaması kayıtlı araç
  istiyor ve müşteri alanını yalnız “Müşteri Verdi” kaynağında koruyor.
- Mali kayıtlar, imzalı şoför aktarımı, fiş/fotoğraf kimliği ve mükerrer
  korumalar korunacak. “Her şeyi anlıyor” garantisi verilmeyecek.

## Sonraki döküm geliştirmeleri (henüz yapılmadı)

1. **Tarihli tarife ve korunmuş geçmiş maliyet:** ton/sefer birimi, KDV ve
   geçerlilik tarihi; eski işi yeni fiyatla sessizce değiştirmeme. Geçmişe
   düzeltmede etkilenen kayıt/tutar farkı önizlemesi.
2. **Sefer–fiş eşleştirme:** şoför fotoğrafındaki tarih, saha, plaka, fiş no,
   net ton; çok seferli işlerde fişin hangi sefere ait olduğu; gerçek/tahmini
   miktar ve eksik fişlerin açık ayrımı.
3. **Anlaşılır saha hesabı:** yatırılan para, fişli kullanım, tahmini kullanım,
   açılış bakiyesi ve tarihli saha bildirimi; aynı tarih üzerinden karşılaştırma.
4. **Ekstre/fatura mutabakatı:** belgedeki gerçek dönem, eksik/mükerrer fiş,
   tarife/tonaj farkları; belge tarihinden rastgele dönem tahmin etmeme.
5. **Asistandan kaynaklı cevap:** saha kalanı, eksik fişler ve ekstre farkını
   ilgili kayıtlarla açıklama.

Karar sırası: önce asistanın doğrulanmış yanlış anlamaları; dökümde önce tarife
geçmişi ve doğru bakiye, ardından fiş eşleştirme ve mutabakat.

İncelemede yapay veriyle doğrulandı: mevcut döküm hesabında 25 tonluk eski
işin maliyeti, saha tarifesi 160'tan 200'e değiştirilince 4.000'den 5.000 TL'ye
çıkabiliyor. Gerçek kayıtlar üzerinde değişiklik yapılmadı. Bu bulgu, döküm
iyileştirmesinin tamamlandığı anlamına gelmez.
