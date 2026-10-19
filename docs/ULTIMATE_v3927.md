# SOLO v3.9.27 — İşletme Panosu ve asistan işlem rehberi

Bu paket mevcut kayıtların okunmasını ve doğru işleme ulaşmayı kolaylaştırır. Şema 5 olarak kalır; geçmiş fiyatlar, hakedişler ve tahsilatlar topluca değiştirilmez. Yeni ücretli servis veya hesap kurulmaz.

## İşletme Panosu

Ana ekrandaki asistan alanından veya Daha Fazla → İşletme Panosu bağlantısından açılır. Doğrudan rota `#/isletme-panosu`.

- Bugün, son 7 gün, bu ay, geçen ay ve en fazla 366 günlük özel aralık. Gelecek bitiş veya gerçek olmayan/ters tarih reddedilir; eski rakamlar yeni aralık gibi gösterilmez.
- İş sayısı, fiyatlı iş değeri, tahsilat ve kayıtlı maliyet ayrı kartlardır. İş sayısındaki karşılaştırma, aynı uzunluktaki hemen önceki dönemledir.
- İş değeri kayıttaki bedeldir; KDV esasları farklı olabilir. Tahsilatla aynı şey değildir; kâr veya cari bakiye olarak sunulmaz.
- Maliyet mevcut `costRows` tanımıdır: gider, araca verilen fiyatlı yakıt, bakım, bağlantısız esnaf alışı, döküm bedeli ve ücret tahakkuku. Döküm depozitoları/bağlı alışlar ikinci kez sayılmaz. Ana sayfanın yüklediği verilere ücret tahakkukları da eklenmiştir; eski aylık grafik maliyet başlığı netleştirilmiştir.
- Saat, sefer, yevmiye, ton, m³ ve adet ayrı tutulur. Litre, miktar toplamına veya TL alacağına eklenmez.
- İş sayısı/tahsilat/maliyet grafiğinde çubuk seçimi, ilgili tarihin kaynaklarını açar. 31 güne kadar günlük; daha uzun aralıkta aylık çubuklar vardır. Müşteri/araç sıralamasına dokunmak da seçilen dönemin işlerini filtreler.
- Kaynak listesinde ilk 30 satır, ardından Daha fazla göster vardır. Kayıt düğmeleri gerçek detay ekranına gider. Pano tutar, miktar veya kayıt oluşturmaz. Yenile bu cihazdaki verileri yeniden okur; ekran canlı sunucu akışı değildir.
- Okuma hatasında sıfır faaliyet izlenimi verilmez; rakamlar gösterilmez ve yeniden deneme sunulur.
- Kontrol listesi dönemden bağımsız tüm kayıtlardır: mevcut inceleme adayları, yarım yedek, yaklaşan bakım kuralları ve PDF’de bekleyen satırlar. Otomatik düzeltme yapılmaz.
- Mazot hesabı tüm zamanlara ait hak/alınan/kalan veya fazla litreyi gösterir. Dönem filtresi bu bakiyeyi değiştirmez.

## Yerel asistan ve işlem rehberi

Asistan → Neler yapabilirim? içinde 16 işlem/kısayol; metin arama ve Rapor/Kayıt/Aktarım/Kontrol grupları. Yeni iş, tahsilat, yakıt, gider ve bakım mevcut formları açar. Miktar düzeltme mevcut kayıt seçimi/önizleme/onay yolundadır. Yetkisiz veya sınırsız otomatik kayıt sistemi eklenmez.

Örnek seçmek mesajı doldurur; göndermez. Mevcut metni değiştirmeden önce onay sorulur. Yeni örnek, önceki kartın düzeltmesi olarak uygulanmaz. Fotoğraf/ses ekliyken yerel örnek seçilirse kullanıcı Ekleri temizle ile açıkça temizlemeye yönlendirilir; dosya kendiliğinden kaldırılmaz. Yerel komut tamamlandığında eski gecikmeli taslak yazımı yeniden mesaj oluşturmamalıdır.

Anahtarsız/internetsiz örnekler: “Bugünkü durum”, “Bugün ne yaptık?”, “Bu ayın özeti”, “Bana bu ayın özetini göster”, “Son 7 günün özeti”, “Geçen ayın özeti”, “Bekleyen işler”, “İşletme panosunu aç”. Yanıtlar cihazda hesaplanır ve kaynak panoya/listelere bağlanır. Bekleyen işler yerel denetimleri anlatır; PDF taslağı ve geri yükleme bilgisi için panoya bağlantı verir. Mevcut Sesli oku düğmesi tarayıcının ses desteğini kullanır; otomatik konuşma başlatılmaz.

Gemini ile mesaj/fotoğraf/PDF/ses okuma mevcut anahtar, internet, izin ve günlük bütçe koşullarını korur. Diğer asistan araçları açılır bölümde toplanmış; geçmiş PDF aktarımı görünür bırakılmıştır.

## Açık sıfır fiyat

`hasWorkPrice`, hiç fiyat girilmemesi ile açıkça girilmiş 0 tutarı ayırır. Pano, dikkat listesi, sabah özeti ve Fiyatsız filtresi aynı ayrımı kullanır. Para hesabı `workAmount` değişmemiştir; bu değişiklik kayıtları yeniden fiyatlamaz. Boş/boolean/sonlu olmayan bedel fiyat sayılmaz.

## Doğrulama kapsamı

`tests/business-overview.test.mjs`: yıl/ay geçişi, artık gün, gerçek tarih/süre sınırları, ayrı birimler, sıfır fiyat, maaş ve mükerrer maliyet, mazot bakiyesi, dönem kaynağı, PDF bekleyen satırları, doğal dil örnekleri ve rehber araması.

`tools/e2e/ultimate.py`: gerçek Chromium/IndexedDB; pano kartları, grafik → kaynak, fiyat eksikleri, geçersiz aralıkta eski metriklerin gösterilmemesi, yenile, kayıt/audit değişmezliği, HTML içeren ad, örnek seçimi/iptal/ek koruması, gecikmeli taslak yarışı, çevrimdışı yanıt,320/360/768/1280px görünüm ve okuma hatası → yeniden deneme.

`tools/e2e/ultimate_offline.py`: gerçek servis çalışanı kurulur, ağ kesilir, sayfa tamamen yeniden yüklenir; yeni pano, rehber ve yerel yanıt önbellekten açılır.

Diğer kontroller: tam Node suiti, redteam, miktar düzeltme, PDF devam/bağlama, fiş kurtarma, tarih/kart seçimi, mevcut yönetim panosu ve genel ekran taraması. Sentetik işletme verisi kullanılır. Fiziksel telefon, gerçek Gemini ve gerçek WhatsApp teslimi bu kontrollerde doğrulanmaz.

Teslim sonucu: **86/86 Node test dosyası**, sözdizimi **122 dosya**, SW listesi **121 modül**; yeni pano/çevrimdışı testleri ve belirtilen regresyonlar PASS. Mevcut 131 ekran + 3 yeni rota = **134 ekran**, 0 sorun.
