# SAHAPRO SOLO v3.9.46 — kontrol listesi ve fiyat tamamlama

## Sorun ve sonuç

Ana ekran, iş listesi, cari fiyat tamamlama ve işletme panosu farklı ölçütlerle
“fiyatsız” iş sayıyordu. Özellikle açıkça sıfır fiyat girilmiş işler cari ekranında
toplu fiyat uygulamasına tekrar dahil olabiliyordu. Artık ortak kontrol şu kayıtları
fiyat tamamlama listesinden ayırıyor:

- Açıkça girilmiş sıfır veya geçerli pozitif fiyat.
- Kilitli fiyat ve kesinleşmiş hakedişe dahil iş; taslak hakediş aynı sayılmaz.
- Mazot karşılığı, sözleşmeye dahil ve iç iş.

Kilitli fakat fiyat bilgisi eksik eski kayıtlar işletme panosunda “Fiyat kilitli”,
kesinleşmiş hakedişin böyle kayıtları “Hakedişe dahil” olarak görünür. Bunlara
fiyatlı iş değeri uydurulmaz ve geçmiş tutarlar yeniden yazılmaz.

Cari ekranındaki toplu Uygula işlemi, tıklama anında güncel grubu yeniden okur ve
yalnız ekranda ilk gösterilen, halen fiyatı eksik işleri değiştirir. Başka sekmede
sıfır/pozitif fiyat girilmiş, kilitlenmiş, müşteri/grup değiştirmiş veya hakedişe
alınmış iş bu işlemden ayrılır. Sonradan eklenen işler eski seçime dahil edilmez.
Yazım sırasında değişen kayıtlar için mevcut veritabanı çakışma koruması korunur.

Aylık grafikte tutarı ayrıca saklanmamış fakat geçerli birim fiyatı bulunan eski
işlerde mevcut `workAmount` hesabı kullanılır: örneğin 2 saat × 125,25 ₺ = 250,50 ₺.
Sıfır fiyat artık eksik fiyat sayılmaz. Bu grafik düzeltmesi veritabanına tutar
yazmaz; mevcut KDV, tahsilat ve cari hesap yöntemini değiştirmez.

## PDF aktarımını sürdürme

Ana ekrandaki Dikkat isteyen işler listesi, yarım kalan PDF’lerin dosya ve satır
sayısını gösterir. Dokununca mevcut PDF aktarım listesi açılır; kullanıcı kaldığı
taslağı seçer. Tamamlanan bütün satırlar sonrasında ana ekran maddesi kalkar.

Ana ekran, işletme panosu ve PDF aktarım ekranı aynı salt okunur tamamlanma
kontrolünü kullanır. İş/yakıt/gider satırı, ancak doğru kayıt türünde aktif hedefi
bulunan işlem bağlantısıyla tamamlanmış sayılır. Silinmiş hedef tekrar bekler.
Yanlış türde aktif hedefe bağlı satır bekleyen olarak görünür, alanları kapatılır
ve bağlantının incelenmesi istenir; otomatik bağlantı düzeltmesi veya ikinci kayıt
oluşturulmaz. Açıklama ve özet satırları bekleyen işlem sayısına katılmaz.

PDF okumak için mevcut Gemini izni, kaynak dosya kontrolü, satır seçimi ve kayıt
onayı devam eder. Bu değişiklik kendiliğinden PDF göndermez veya kayıt oluşturmaz.
Orijinal dosya bulunamazsa mevcut yeniden seçme uyarısı gösterilir.

## Doğrulama

- Node: 100/100 test dosyası PASS; sözdizimi 139 dosya ve SW 138 modül dahil.
- `tests/review-consistency.test.mjs`: tüm korunan fiyat durumları, taslak/kesin
  hakediş farkı, ekran modelleri arasındaki eksik fiyat sayısı, eski birim fiyat
  hesabı, PDF tür/aktiflik kontrolleri ve kaynak verinin değişmemesi.
- `tools/e2e/review_consistency.py`: gerçek Chromium + IndexedDB, 360 px ekran;
  ana ekran/list/cari/pano eşitliği, PDF’ye devam, yanlış tür bağlantı uyarısı,
  iki sekmede değişen sıfır fiyat ve yeni işin korunması, yalnız bir işin fiyatının
  güncellenmesi, tamamlanınca PDF görevinin kalkması ve ağ çağrısı olmaması.
- Mevcut PDF geçmiş aktarımı ve PDF iş akışı tarayıcı suitleri: kaynak dosya,
  satır onayı, eşleştirme, yeniden açma, kısmi hata, tekrar deneme, mevcut işe
  bağlantı ve eşzamanlı kayıt korumaları.
- Mevcut müşteri dizini ve müşteri anlık görüntü suitleri: TL/litre, alt müşteri,
  kuruş hassasiyeti, ekran boyutları ve salt okunur gezinme.
- Mevcut iş listesi ve işletme panosu suitleri: tarih/arama/çoklu filtre, CSV,
  sıfır fiyat, grafiklerden kaynağa geçiş, çevrimdışı yeniden açma ve taşmayan
  telefon/tablet ekranları.
- Mevcut hızlı şoför paylaşımı ve grup paylaşımı suitleri: imzalı SP1/orijinal
  fotoğraf/nakit, temiz grup metni, izin hatası ve bekleyen durumunun korunması.

Testler yapay verilerle çalışır; Gemini ve yerel paylaşım arayüzleri gerektiğinde
taklit edilir. Gerçek telefon/WhatsApp teslim testi bu raporun parçası değildir.
Veritabanı şeması değişmez; hizmet çalışanı önbelleği v3.9.46 için yenilenir.
