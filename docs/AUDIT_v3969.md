# SOLO v3.9.69 — Finans, stok ve kayıt bütünlüğü denetimi

Bu turda iş/müşteri, asistan ve şoför aktarımı, işletme defterleri, yakıt/depo,
döküm, parça, belge/PDF, yedek/geri yükleme, kayıt hataları ve mobil ekranlar
birlikte incelendi. Başlangıçtaki 123 Node test dosyası ve 12 geniş tarayıcı suiti
geçiyordu. Yeni karşı örnekler mevcut testlerin kapsamadığı aşağıdaki açıkları
ortaya çıkardı. Liste teknik bulguları ve bu sürümün değişikliklerini anlatır;
uygulamanın bütün olası durumlarının kanıtı değildir.

## Finansal giriş ve taşma

İşletme defterlerinin ortak `money()` doğrulaması `true` değerini 1 TL, `[25]`
değerini 25 TL kabul edebiliyordu. Fatura miktarında da boolean değeri 1 adet
oluyordu. Çok büyük miktar × fiyat sonlu olmayan veya kuruş hassasiyetini aşan
bir toplam oluşturabiliyordu. Gözlemlenen örnekler saf fonksiyonlarla ve gerçek
alış/ödeme işlemleriyle sınandı.

- Yalnız dolu sayısal metin veya sonlu sayı kabul edilir. Boolean, dizi, nesne,
  boşluk, NaN ve Infinity reddedilir. Açık 0 fiyat / %0 KDV desteklenmeye devam
  eder; miktar ve gerçek ödeme pozitif olmalıdır.
- Pozitif tutar gereken yerde 0,001 TL gibi kuruşa yuvarlandığında sıfır olan
  ödeme/gider kabul edilmez. Doğrudan kasa API'si de normal kayıt doğrulamasını
  kullanır; ekranı atlayarak geçersiz tahsilat oluşturulamaz.
- Fatura satırı, vergili tutar, belge toplamı ve bakım parçası toplamı güvenli
  tam sayı kuruş sınırında denetlenir. Geçersiz işlem kayıt/audit bırakmaz.

## Tarih sıralı depo ve maliyet

Gerçek IDB denemesinde 23 Ekim girişinden 7 Eylül yakıtı ve müşteriye mazot
teslimi yazılabildi. Kontrol yalnız bugünkü toplam stoğa bakıyordu.

- Yeni araç yakıtı, müşteri teslimi, istasyondan depoya kaynak düzeltmesi,
  giriş tarih/litre düzenlemesi ve yakıt geri yüklemesi aynı tarih sırası
  kontrolünden geçer. Gelecekteki giriş geçmiş çıkışı karşılayamaz. Geçmişe
  eklenen çıkış daha sonraki mevcut tüketimi de eksiye düşüremez.
- Aynı günün saat sırası bilinmediği için gün sonu bakiye denetlenir. Önceden
  var olan açığı büyütmeyen sonraki geçerli işlemler devam edebilir. Eksik
  geçmişi kapatmak için sahte stok veya otomatik açılış üretilmez.
- Araç yakıtı ile depo çıkışının tarih/litre/kaynak/araç bağlantısı tek taraftan
  değiştirilemez. Normal açıklama ve maliyet alanı düzenlemeleri korunur.
- Tarih/litre/hareket türü geçerli olmalıdır; gerçek yakıt/depo işlemi geleceğe
  tarihli yazılamaz. Kontrol son yazma transaction'ında da yapılır. İki sekmede
  giriş azaltma ve yakıt tüketimi birlikte aynı stoğu harcayamaz.
- Asistan ortak ön denetimi de seçili giriş/çıkışları tarihleriyle hesaplar.
  Geçmiş stok seçimi geçersizse önceki bir iş dahi yazılmadan bütün seçim
  uyarıyla durur. Son transaction kontrolü, önizlemeden sonra gelen değişiklikleri
  ayrıca yakalar.
- Yakıtın kendi tarihine kadar fiyatlı giriş yoksa sonraki alışın fiyatı
  maliyet yerine kullanılmaz. Otomatik doldurma da aynı sınırı izler. Eski
  tahmini bedel otomatik sıfırlanmaz; o tarihte fiyatlı giriş bulunmuyorsa Veri
  Sağlığı geçmiş fiyatı kontrol etmeyi önerir.
- Alış belgesine veya aktif maliyet dağıtımına bağlı yakıt, ortalama fiyat
  yenilenirken yeniden yazılmaz. Bu koruma ve silme/kaynak düzeltme engeli
  transaction içinde güncel bağlantıları okur.

**Yeni görünüm:** Depo'daki **Tarih sırası kontrolü**, bugün stok pozitif olsa
bile geçmiş açığın ilk gününü gösterir. **Veri Sağlığında İncele** düğmesi
ilgili denetime götürür. Veri Sağlığı ve yazma kontrolü ortak gün bazlı hesap
kullanır; geçersiz depo hareketi de ayrı işaretlenir.

## Kayıt, işlem günlüğü ve çöp kutusu

Normal kayıt eklemede kayıt ve audit iki ayrı transaction'da yazılıyordu.
İkinci isteğe gerçek `DataCloneError` verilerek yarım kayıt ihtimali sınandı.

- Normal yeni kayıt ile audit artık tek transaction'dadır. İkinci request
  başarısızsa birinci yazma da geri alınır. Normal kart geri yüklemesi de kendi
  audit'iyle atomiktir ve güncel satırı transaction içinde okur.
- Yakıtı çöp kutusundan geri yüklemek yakıt ve depo çıkışını birlikte geri
  getirir. Tarih sırası, eşleşen litre/tarih/kimlik ve araç/personel bağlantısı
  kontrol edilir. Stok başka işlemde kullanılmışsa iki satır da silinmiş kalır.
  Sürüm damgası artar; tekrar yükleme ikinci stok hareketi yaratmaz.
- Cari/kasa gibi bağlı finans satırının tek başına geri yüklenmesi engellenir;
  işlemin bütününü kapsayan geri alma / tam yedek yolu kullanılmalıdır.

## Açık görünümlerin güncellenmesi

Tahsilat, müşteriye mazot teslimi/iptali ve bazı hakediş/sözleşme işlemleri,
açık müşteri kartına commit bildirimi göndermiyordu. Geçerli kayıt yazılmış olsa
da ekran eski bakiyeyi gösterebiliyordu.

Commit sonrası bildirimler tamamlandı; kasa/cari/hakediş/banka değişiklikleri de
izlenir. Açık müşteri, iş/yakıt/bakım listeleri ve ana sayfa uygunken yenilenir.
Bildirim kayıt metni veya sır taşımaz. Açık form, yazılan filtre/alan, modal ve
meşgul işlem korunur. Başarısız transaction bildirim üretmez; aynı tahsilatın
tekrarı ikinci kayıt veya fazladan commit bildirimi üretmez.

## Test kanıtı ve kapsam sınırı

Sonuçlar: **124/124 Node test dosyası**, **33/33 farklı tarayıcı suiti**, 174
JavaScript dosyasında sözdizimi ve 173 SW modülü kontrolü geçti. Geniş tarayıcı
koşusundaki iki hata giderildikten sonra ilgili suitler tekrarlandı; son kod
değişikliğinden sonra 10 suitlik doğrulama grubu da 10/10 geçti. Test
düzeltmesinde eksik maliyet hedefi tamamlandı; şoför tahsilatı için doğrulama
sırası düzeltilirken son transaction'daki yetki kontrolü korundu.

Mobil görünüm taraması 131 adresi hatasız tamamladı. Üç şoför ve patronun ayrı
oturumlarıyla işletme simülasyonu (seed 19), yedek/geri yükleme ve sağlık
kontrolü geçti. Ayrıştırıcı altın kümesi: 80 mesajda 369 alan doğru; 756 bozma
denemesinde sessiz yanlış seçim sıfır. İzole önizleme paketi üretildi. Canlıya
eşzamanlı eklenen cihaz bağlı şifreli aktarım dosyası korunarak güncel canlı
taban üzerine alındı; içeriği açılmadı veya değiştirilmedi.

`tests/integrity-audit.test.mjs` bozuk finansal tür, kuruş/taşma, tarih sırası,
sonraki tüketim ve değişmeyen eski açık durumlarını sınar.
`tools/e2e/integrity_audit.py` gerçek Chromium/IDB üzerinde ikinci-request
hatasını, sıfır yazmayla reddi, iki sekme yarışını, gerçek alış/ödeme, tarih/litre
düzenlemesini, çöp kutusu dönüşünü, maliyet kilitlerini ve açık müşteri bakiyesinin
diğer sekmeden yenilenmesini çalıştırır. Veriler sentetiktir; gerçek telefon
veritabanı değiştirilmez.

Genel görünüm taraması `tarama.py` artık bulunan sorunda sıfır olmayan çıkış
kodu döndürür; sistem Chromium'u desteklenir. Denediği 131 liste/kart/form
adresi, arayüz/taşma kontrolüdür; 131 bağımsız modülün bütün işlevleri anlamına
gelmez. Asistan görev testinin 21 Ekim teslimi için başlangıç yakıtı 20 Ekim'e
kondu: bugünkü girişin geçmiş çıkışı karşılamasına dayanan test verisi düzeltildi.

DB sürümü 6 kalır; eski kayıtları toplu dönüştürme, gerçek stok/fiyat tahmini veya
otomatik finansal düzeltme yoktur. Gerçek Gemini/OCR kalitesi, Android/iOS
WhatsApp teslimi ve fiziksel telefon izinleri bu tarayıcı testleriyle kanıtlanmaz.
İşletme simülasyonunda paylaşım ve model yanıtları taklit; tarayıcı, IDB, imza,
transaction ve yedek/geri yükleme işlemleri gerçektir.
