# SOLO v3.9.26 — Dayanıklılık ve kötü girdi denetimi

Denetim yalnız yerel HTTP sunucusu, sentetik işletme verileri ve ayrı Chromium bağlamlarıyla yapılır. Canlı işletme verisi okunmaz/değiştirilmez. YZ2 kapsam dışıdır. Şema 5 olarak kalır; geçmiş işler topluca yeniden hesaplanmaz.

## Bulunan ve düzeltilen durumlar

| Alan | Tekrarlanan hata | Yeni davranış |
| --- | --- | --- |
| Asistan miktarı | `-3 saat`, `1/2 saat`, `1,234,5 saat` ifadesindeki son sayı pozitif miktar sanılabiliyordu; `1.000` ise 1 oluyordu. | İşaret/kesir/aralık/bozuk ayırıcı reddedilir. Belirsiz düzeltme yerel açıklama döndürür; Gemini'ye yorumlatılmaz. Ondalık için 1,5 veya 1.5; bin için 1000 kullanılır. Tarihli normal komut korunur. |
| Kayıt sayıları | `Infinity`, `NaN`, boolean ve nesneler bazı pozitif-sayı denetimlerini geçebiliyordu. | Yeni/düzenlenen kayıtların bilinen sayısal alanları ve fiyat snapshot'ı tip/sonluluk açısından denetlenir. Mutlak üst sınır 10¹²; türetilmiş iş/depo tutarı da denetlenir. Hata kayıt/audit oluşturmadan döner. %0 KDV ve sıfır birim fiyat korunur. |
| PDF model yanıtı | Boolean miktar 1'e dönüşebiliyor, bozuk satır/toplam nesneleri genel TypeError oluşturabiliyordu. | Boolean/nesne sayıya çevrilmez; bozuk satır için açık hata verilir. Geçersiz toplam girdisi atlanır. Fiyat çarpımı ve KDV dahil/hariç tipi denetlenir. |
| Yedek parçası | İlk parçadaki kayıt yükü büyükse ilk ek bütçe aşımına rağmen ekleniyordu; manifest/dizin bütçede sayılmıyordu. | Manifest ve tüm ek dizini dahil boyut planlanır. Gerekirse ilk parça yalnız kayıt taşır, dosya sonraki parçaya geçer. Üretilen gerçek JSON son kez bütçeyle karşılaştırılır. Bütçe karakter bazlıdır; dosya kodlayıcısının byte sınırı ayrıca geçerlidir. |
| Yedek manifesti | Eksik ekte parça sayacı da değiştirilirse geri yükleme tamamlandı görünebiliyordu. | Ek ID/sahip/tür/parça numarası dizinle eşleşir; mükerrer veya bozuk dizin reddedilir. Parça numaraları tam sayı ve en fazla 10000 olmalıdır. |
| Şoför doğrulama ömrü | İmzası doğrulandıktan sonra bağlantısı iptal edilen kart açık ekrandan kaydedilebiliyordu. | İş/yakıt/gider/bakım yazılırken doğrulama işareti, güncel bağlantı ve personelin aktifliği aynı transaction'da kontrol edilir. İptal/süre dolması/pasifleştirme yazımı engeller. |
| Şoför listesi eşzamanlılığı | Doğrulama sırasında eski bağlantı listesi yazılarak başka sekmenin iptali ezilebiliyordu; eşzamanlı yeni bağlantılar kaybolabiliyordu. | Bağlantı ekleme, iptal ve kullanım sayaçları tek meta transaction'ında mevcut liste üzerinden değiştirilir. Kullanım güncellemesi iptali geri alamaz. |
| Sıkıştırılmış şoför kodu | İmza kontrolünden önce sınırsız açma yapılıyordu. | Kod en fazla 1 MiB; açılmış JSON en fazla 2 MiB. Toplu metin en fazla 2 Mi karakter/200 kod; kabul edilen paketlerin JSON toplamı en fazla 8 Mi karakter ve paket başına 1000 giriş. Sınır aşımı açık hata verir; kayıt yazılmaz. |
| Güncelleme bildirimi | Mobilde sabit bildirim Kaydet düğmesini örtebiliyordu; uzun testte gerçek tıklama zaman aşımıyla yakalandı. | Bildirim sayfa başında normal akıştadır; form düğmelerini örtmez ve kapatılabilir. |

## Kalıcı kontroller

- `tests/redteam-inputs.test.mjs`: kötü miktarlar, normal ondalık/tarihli komut, PDF tipleri/çarpım sınırı, büyük ilk yedek, bozuk manifest, 25 farklı parça paketleme varyantı, şoför sıkıştırma bombası ve paket sayısı.
- `tools/e2e/redteam.py`: 38 bozuk sayısal kayıt denemesi; sıfır KDV/fiyat; geçersiz düzenlemede eski kaydın korunması; doğrulamadan sonraki iptal (iş/yakıt/gider/bakım), personel pasifleştirme, süre dolması; geçerli imza ve tekrar koruması; iki gerçek sayfada doğrulama/iptal yarışı; gizlenmiş eksik ek, gerçek Chromium sıkıştırma bombası, çevrimdışı kayıt, HTML içeren müşteri adının kaçışlanması ve güncelleme bildirimi varken gerçek mobil Kaydet düğmesinin tıklanabilirliği.
- Mevcut yedek matrisi: doğru/yanlış sıra, farklı set, eksik/bozuk/tekrarlı parça, yeniden açma ve eşzamanlı geri yükleme.
- Mevcut denetim, miktar işlemi, PDF aktarımı, PDF devam, komut tarih/seçim ve fiş kurtarma kontrolleri.
- İşletme simülasyonu: üç şoför ve patron, fotoğraflar, tekrar gönderim, gider/bakım, izin/maaş, tahsilat/hakediş, eşzamanlı kayıt, veri sağlığı ve şifreli yedek → yeni cihaz bağlamı.

## Sınırlar
Bu çalışma her olasılığın veya tüm güvenlik açıklarının kapandığı iddiası değildir. Gerçek Gemini yanıt kalitesi, fiziksel Android/iOS, gerçek WhatsApp teslimi ve cihaz/işletim sistemi güvenliği bu yerel denemenin dışında kalır. Şoför iptali patron telefonunun kayıt kabulünü engeller; uzaktaki şoför telefonundaki dosyaları silmez. SOLO cihaz içi uygulamadır; sunucu tabanlı çok kullanıcılı yetkilendirme sağlamaz. Henüz arşivlenmemiş PDF dosyaları taslak alanında kalır ve dosya yedeğine dahil değildir; orijinaller ayrıca saklanmalıdır.

## Teslim doğrulaması

- Node: **85/85 test dosyası PASS**, sözdizimi **119 dosya**, SW varlık listesi **118 modül**.
- Yeni gerçek Chromium redteam kontrolleri: tümü PASS; 38/38 geçersiz sayısal giriş reddedildi; sayfa hatası yok.
- Mevcut yedek matrisi, denetim, asistan miktar işlemi, PDF history/workflow, komut tarih/seçim ve fiş kurtarma: PASS.
- İşletme simülasyonu, tohum **73**: BAŞARILI. Tahsilat/hakediş ve eşzamanlı kayıt kontrolleri geçti; Veri Sağlığı **0 hata/0 uyarı**. Şifreli yedek ayrı tarayıcı bağlamına kayıt/dosya sayıları ve dosya baytları birebir korunarak yüklendi; yeni bağlamda da 0 hata.
- 360 px mobil görünümde **131 ekran**, **0 sorun**: boş ekran, uygulama/konsol hatası ve yatay taşma taraması.
- İlk uzun koşular, kod geliştirme sırasında gelen güncelleme bildiriminin Kaydet düğmesini örtmesi nedeniyle tamamlanmadı. Bildirim düzeltildikten sonra denetim ve simülasyon baştan çalıştırılıp geçti; başarısız ilk koşular başarı olarak sayılmadı.
- Son ürün değişikliği Unicode işaret/görünmez ayırıcı ayrıştırma sertleştirmesidir; ardından 85 dosyanın tamamı yeniden koşuldu. Uzun simülasyonda normal şoför/finans akışları; son Unicode sınırları ayrıca kötü girdi testinde doğrulandı.
