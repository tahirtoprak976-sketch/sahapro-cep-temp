# SOLO v3.9.47 — kayıt temelli işletme öncelikleri

## Ürün kararı

Mevcut sabah brifingindeki “Ne yapmalıyım?” düğmesi Gemini’den yorum istiyordu.
Oysa açık alacaklar, ödeme sözleri, bakım planı ve eksik kayıtlar cihazda zaten
hesaplanabiliyor. Bu sürüm, mevcut brifing ve asistan içinde neden ve kaynak
ekranı içeren yerel öncelikler sunar. Yeni bir işletme hesabı veya servis gerekmez.

## Kapsam

- Geciken/yaklaşan bakım planları, kalan gün/sayaç ve varsa tahmini saat bilgisi.
- Ödeme sözü geçmiş veya bugün olan müşterilerin mevcut açık bakiyesi. Gelecek
  tarihli söz, güncel hatırlatma ve kapanmış alacak aynı uyarıyı üretmez.
- Ödeme sözü bulunmayan 60 günden eski açık kalemler için takip önerisi. Kayıt
  yaşı, sözleşmesel vade geçmiş gibi sunulmaz.
- Vadesi geçmiş/üç gün içinde gelen veya karşılıksız kayıtlı çek/senetler.
- Müşteriden alınmış nakitte PERSONELDE ve TESLIM_BILDIRILDI durumları ayrı
  açıklanır. KASAYA_TESLIM_EDILDI ile takip maddesi kalkar. Bu tutar müşterinin
  yeniden ödemesi gereken alacak sayılmaz.
- Mevcut ortak kontrol listesindeki PDF, fiyat, müşteri, mesaj, yedek, mazot ve
  ölçüm incelemeleri. Bunlar otomatik düzeltilmez.
- Aktif işi olmayan kurulumda ilk iş formu ve geçmiş PDF aktarımına giriş.
  Bekleyen PDF zaten varsa ikinci bir başlangıç PDF maddesi eklenmez.

Alt müşteri önerisi kendi müşteri kimliği ve ana firma bağlamıyla gösterilir;
ana firmaya borç aktarılmaz. Kuruşlar korunur ve farklı takip türlerinin tutarları
tek bir “para kaybı” veya “kazanç” toplamında birleştirilmez.

Önce gecikmiş plan/söz/vade kayıtları, ardından bugün/yaklaşan işler ve nakit
teslimi, sonra yaşlandırma ve kayıt incelemeleri sıralanır. Bu sabit bir takip
önceliğidir; kredi skoru, işin güvenliği veya şirketin bütün risklerinin ölçümü
değildir. Aynı madde kimliği bir kez görünür ve eşit öncelikler tutarlı sıralanır.

## Kullanım ve doğruluk

Ana ekran → Sabah brifingi → Ne yapmalıyım? ilk üç maddeyi açar; diğerleri
“Diğer öncelikleri göster” ile gelir. Yenile yeni veriyi okur. Asistanda
“Bugün ne yapmalıyım?”, “Önceliklerim”, “İşletme önerileri” ve “Nereden
başlamalıyım?” aynı kuralları kullanır; ilk beş ve kaynak bağlantıları gösterilir.
Komut rehberi yeni örneği sunar. İş kaydı içeren uzun/çok satırlı mesajlar bu
kısa komutlarla tüketilmez; ekli dosyalar yerel cevaba sessizce alınmaz.

Ana ekran önerileri ve yazılı öncelik komutu, kayıtları ve meta verisini aynı
salt okunur IndexedDB transaction'ında alır. Ödeme sözü ve PDF bilgisi böylece
aynı kaynağa aittir. Öneriler Gemini, API anahtarı veya internet kullanmaz;
kendi başına kayıt, teslim onayı, ödeme, dış paylaşım veya mesaj göndermez.
Okuma hatası “takip maddesi yok” gibi sunulmaz; açık hata ve yeniden deneme vardır.
Boş liste de tüm işletme kayıtlarının eksiksiz olduğunun kanıtı sayılmaz.

Sabah brifingindeki dün/hafta sonu satırı artık doğru tarih filtreli işleri açar
ve ortak eksik fiyat kontrolünü kullanır. Ödeme sözü “bugün ödeyecek” garantisi
olarak yazılmaz. Aylık iş değeri − kayıtlı maliyet farkı kâr veya kasa bakiyesi
olarak sunulmaz; KDV farkları açıklanır. Tutar hesabı değiştirilmez.

## Doğrulama

- Node: 101/101 test dosyası PASS; sözdizimi 140 dosya, SW 139 modül.
- Yeni saf model testi: tahsilat/kasa ayrımı, ödeme sözü, kapanmış hesap, güncel
  hatırlatma, alt müşteri, iki nakit teslim aşaması, bakım, çek/senet, PDF,
  başlangıç, deterministik sıralama, komut sınırları ve kaynakların değişmemesi.
- Yeni gerçek Chromium/IndexedDB suiti: ana ekran/asistan eşitliği, tam kaynak
  bağlantıları, XSS metninin kaçırılması, 320/360/768 px, iki sekmeden güncel söz
  ve nakit durumu, okuma hatası/tekrar deneme, gerçek SW çevrimdışı yeniden açılış,
  yeni kurulum, iş/audit verisinde sıfır yan etki ve sıfır Gemini isteği.
- Mevcut asistan işlem, işletme panosu, fiyat/PDF tutarlılığı ve şoförün hızlı/grup
  paylaşım tarayıcı suitleri PASS. Şoför SP1/nakit/fotoğraf ve onay kapıları korunur.

Tarayıcı testleri yapay veri kullanır; gerçek kişilere mesaj gönderilmez.
DB şeması aynı kalır; sürüm ve atomik hizmet çalışanı önbelleği v3.9.47’ye geçer.
