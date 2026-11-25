# İlk paket — Günlük kontrol, v3.10.26

## Amaç

Mevcut Saha Akışı üzerinde, kaynak denetimlerini günlük bir çalışma listesinde toplamak. Yeni bir ana ekran veya yeni iş/para hesabı yok. Taban: ceabe18 (canlı v3.10.25); son uzaktan teslim değişiklikleri ve şifreli teslim dosyaları aynen korunur.

## Sonuç

- Ana sayfadaki Saha Akışı bağlantısı günlük kontrolü de açıklar.
- Seçilen gün ve araç/personel kapsamında mevcut Operasyon Masası kontrolleri okunur. Aynı hedefe ait farklı gerekçeler tek kartta korunur; bilgi maddeleri işlem bekleyenlerden ayrı görünür.
- Genel fiyatsız/müşterisiz iş kuyruğunun tüm satırları aynı günün tekil kontrol kartlarında temsil ediliyorsa tekrar kart çıkarılmaz. Başka tarihli veya temsil edilmeyen işler varsa genel kuyruk korunur. Sadece metin benzerliğine bakarak uyarı silinmez.
- Tarihli bir kasa kaynağı seçilen günden sonraysa listeye alınmaz. Bu ekran güncel kayıtların seçili gün kontrolüdür; geçmişin değişmez muhasebe görüntüsü değildir.
- Mesaj karşılaştırma bağlantısı günü; mevcut kapanış bağlantısı gün/araç/personel bağlamını korur. Şirket kapanışı eski ekranında açık onayla yapılır; yeni bölüm günü kapatmaz.
- İş kaydı olmayan aktif araçlar ayrı bilgi olarak listelenir. Çalışmadı/izinli diye varsayılmaz; tarihli taslak açmak kayıt üretmez.
- Yenile DB'den tekrar okur. Arama metni ve açık detaylar korunur; kayıt düzeltildikten sonra kaynak uyarısı yeniden hesaplanır. Okuma başarısızsa eski görünüm korunur ve hata söylenir; sıfır kontrol gibi sunulmaz.

## Ölçüm / kabul

| Sentetik durum | Eski | Aday |
|---|---|---|
| Saha Akışında günlük kontrol | Yok | Var |
| Aynı kasa kaynağının iki ayrı gerekçesi | Operasyon listesinde iki kart | Tek kart, iki gerekçe |
| Aynı günlük fiyatsız iş + tamamen aynı kapsamlı genel fiyat kuyruğu | Ayrı maddeler | Tekil iş kontrolü; ek eski iş varsa kuyruk korunur |
| Eksik günlük iş | Otomatik kayıt yok | Otomatik kayıt yok |
| Ekran/yenile/bağlantı açılışında iş veya para yazma | 0 | 0 |
| Gemini isteği | 0 | 0 |

Yeni aynı Chromium testi değişmemiş v3.10.25'te DAILY_REVIEW_MISSING ile kırmızı; adayda yeşil. Node testi kaynak gruplama, gerekçe kaybı olmaması, kapsamı farklı kuyruğun korunması, ileri tarihli kasa, araç filtresi, geçersiz gün, güvenli bağlantı ve değişmezliği doğrular. Tarayıcıda tarihli taslak, karşılaştırma, mevcut kapanış, düzeltilen kaydın yenilenmesi, yazılan arama ve açık filtrenin korunması, 320/360/390/768px, HTML kaçışları, sıfır UI yazımı/sıfır model çağrısı denetlenir.

## Korunanlar ve sınırlar

Şema8, kalıcı kayıt biçimi, eski işler, fiyat ve cari/KDV, tahsilat/teslim ayrımı, beş işaretsiz kart, Kaydet ve işlem/revizyon/imza/mükerrer kapıları değişmedi. Yeni durum kaydı veya otomatik düzeltme yok. QA/YZ2 ve uzaktan teslim dosyaları değiştirilmedi. Mevcut test beklentileri korunur; sürüm/cache pinleri26'ya taşınır. İki yeni modül SW ASSETS'te. Kurulu25→26 güncellemesinde tüm kayıt/meta/taslak/ekler ve offline açılış ayrıca test edilir.

Gerçek işletmede zaman tasarrufu, fiziksel Android ve gerçek WhatsApp kullanımı ölçülmedi. İlk hafta kontrol süresi ve tekrarlı girişler ölçülmeden tasarruf yüzdesi verilmez. Bu paket hakediş/tahsilat ve filo dosyalarının sonraki tasarımını tamamlamış sayılmaz.

## CI teşhisi

İlk koşuda değişmemiş v3.10.20 PDF reddini kanıtlama adımı başarısız oldu; eski adım beklenen hata metnini grep ile kontrol ediyor, başka alt hatanın içeriğini yazdırmıyordu. Aynı testte hazır beklemesinin düğme DOM'da yokken de true dönebildiği görüldü. Eski20 kaynağında yalnız açılış/handler bağlanması geciktirilerek bu yarış tekrarlandı: özgün bekleme dosya yükleme aşamasında30s zaman aşımı verdi, düğmenin varlığını da şart koşan bekleme orijinal beklenen PDF reddine ulaştı. İki hazır beklemesi sağlamlaştırıldı; bütün PDF/fotoğraf, özgün bayt, kayıt ve imza beklentileri aynı kaldı. İlk CI'daki alt hatanın dosyası eski adımda çıktı olarak tutulmadığından birebir aynı neden olduğu kesin sayılmadı. Sonraki koşuda ham sentetik teşhis de yazdırılır ve artifact'e eklenir. Uygulama koduna bu nedenle değişiklik yapılmadı.

## Kapanış geçişindeki yarışın çözümü

Kullanıcı devam yetkisi verdikten sonra birleşik başarısız kontrol alan bazında ayrıştırıldı. Kayıt/audit JSON'ları eşitti; kapanış kartı sayısı geçici olarak0oluyordu, kök ekran boşaltılmıştı. Önceki ekrandaki kayıt değişikliği için bekleyen80ms yenileme, yeni rota açılınca yeni ekranı tekrar yükleyebiliyordu. Testteki dumpAll meta/draft tablolarını kapsamaz; önceki teşhis metnindeki genel meta ifadesi bu nedenle daraltıldı. İşletme kaydı değişikliği bulunmadı.

Yenileme denetleyicisi artık bildirimi aldığı ekran kökünü tutar. Rota yeni köke geçtiyse eski kökün bekleyen yenilemesini atar; yeni ekran kayıtları kendi açılışında okur. Aynı kökteki değişiklik, görünürlük/süre kapısı ve açık form koruması aynen sürer. Yeni deterministik gerçek tarayıcı testi zamanı kontrollü ilerletir: değişmemişceabe18'de OLD_VIEW_REFRESHED_NEW_SCREEN ile kırmızı, adayda yeşildir; aynı ekranın yenilenmesi, açık formun korunması ve ertelemeden dönüş ayrıca doğrulanır. Yeni günlük testin kapanış sayısı ve JSON eşitliği beklentileri değiştirilmedi, yalnız hata ayrıntıları eklendi. Düzeltme sonrası altı günlük akış tekrarı geçti. Kalıcı kayıt, şema veya geçmiş veri değişikliği yok.
