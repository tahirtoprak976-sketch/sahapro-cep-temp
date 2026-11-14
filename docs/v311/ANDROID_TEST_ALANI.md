# Android kabul alanı

Bu PR uygulama sürümünü değiştirmez. Kök uygulama v3.10.13 ve servis çalışanı 113 bayt bayt korunur. v3.11.05 adayının takma adlı telefon sınavı ve örnek uygulaması `qa-v311-phone/` altında yayımlanır. Asıl ürün PR'ları #240–245 bu PR ile birleştirilmez.

Telefon sınavı: anahtar yalnız bellekte; açık izin, dinamik model seçimi ve günlük 100 istek sınırı. Üç turda 20 mesaj, bir toplu döküm ve 12 finansal güvenlik örneği ölçülür. İş/kasa/cari Kaydet işlemi yoktur. JSON raporu ham model yanıtlarıyla yeniden puanlanır. Dondurulmuş başarı canlı Gemini başarısı sayılmaz.

Örnek uygulama ayrı veritabanı, localStorage, manifest ve servis çalışanı adları kullanır. Aynı origin üzerinde ad ayrımı bir güvenlik sınırı değildir. Gerçek yedek veya şoför bağlantısı buraya yüklenmez. Yalnız onaylı takma adlı fixture ve dört sentetik fiş kullanılır. Kaydet yalnız örnek alanı etkiler.

Otomatik doğrulama: canlı dosyaların SHA karşılaştırması; adayın telefon dosyalarının birebir kaynak karşılaştırması; uygulama iş kodunda yalnız depolama adı değişikliği; aktarım payload'larının dışlanması; gerçek üretilen telefon paketinin tarayıcıda açılması; kök servis çalışanıyla birlikte örnek alanın açılması ve çevrimdışı yeniden açılmada test taslağının korunması.

Ölçüm önce → sonra: kök canlı sürüm 3.10.13 → 3.10.13; canlı işletme dosyası değişikliği 0 → 0. Dondurulmuş toplu ölçüm 15/38 hazır, 14 gereksiz soru, 3 yanlış alan; tekil 25/38, 3 soru, 3 yanlış alan. Bu PR ölçüm sonucunu değiştirmez. Gerçek Gemini ve fiziksel Android kabulü henüz yapılmadı; rapor gelmeden v3.11 ana yayını yapılmaz.

## 14 Kasım — eksik rapordaki hata teşhisi

İlk gerçek raporda r01 için sıfır yanıt ve yalnız FAILED kodu vardı. Bu bilgi gerçek nedeni ayırmaya yetmez. Telefon aracı artık ilk sağlayıcı/yanıt hatasını tek istek korumasının arkasında kaybetmez; HTTP kodu ve sabit Türkçe neden gösterir. Anahtar, URL veya ham sağlayıcı hata metni teşhise girmez. Yeni altı taklit HTTP testi reddedilen istek, ücretsiz erişim yokluğu ve çıktı sınırını ayırır; eski 102 taklit istek testi korunur. Ürün/kök uygulama v3.10.13, örnek uygulama v3.11.05 kalır. Corpus, iş kodu, veritabanı ve sayaçlar değiştirilmez veya sıfırlanmaz. Gerçek ilk hatanın kökü henüz bilinmiyor.

## HTTP400 için uyumlu ilk istek

Modelin kendisinin bildirdiği çıktı sınırı, zaten yapılan model listesi sorgusundan alınır; yeni sorgu eklenmez. İlk istek, SDK'nın mevcut şemasız JSON yoluyla gönderilir; JSON modu ve tam yerel doğrulama korunur. Sınav tek istek kuralı böylece normal şema alternatifiyle çatışmaz. Gerçek HTTP400'ün tam alan nedeni henüz kanıtlanmış değildir; bu sınıfı reddeden taklit modelde aynı test eski kodda kırmızı, yeni kodda yeşildir.

Google teknik yanıtı anahtar ve API anahtarı kalıpları ayıklandıktan sonra yalnız telefon ekranında gösterilir, JSON rapora/IndexedDB'ye/sunucuya yazılmaz. Raporda kullanılan JSON yolu ve çıktı sınırı açıklanır. diag=3 giriş URL'leri aynı TEST sayacını korur. Ana ürün/kayıtlar/SW/corpus değişmez; gerçek Gemini yeniden denenene kadar başarı iddiası yoktur.
