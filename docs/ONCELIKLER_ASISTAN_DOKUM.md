# İşletme sahibinin öncelikleri — 21.10.2026

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
