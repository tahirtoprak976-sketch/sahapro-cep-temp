# Android kabul alanı

Bu PR uygulama sürümünü değiştirmez. Kök uygulama v3.10.13 ve servis çalışanı 113 bayt bayt korunur. v3.11.05 adayının takma adlı telefon sınavı ve örnek uygulaması `qa-v311-phone/` altında yayımlanır. Asıl ürün PR'ları #240–245 bu PR ile birleştirilmez.

Telefon sınavı: anahtar yalnız bellekte; açık izin, dinamik model seçimi ve günlük 100 istek sınırı. Üç turda 20 mesaj, bir toplu döküm ve 12 finansal güvenlik örneği ölçülür. İş/kasa/cari Kaydet işlemi yoktur. JSON raporu ham model yanıtlarıyla yeniden puanlanır. Dondurulmuş başarı canlı Gemini başarısı sayılmaz.

Örnek uygulama ayrı veritabanı, localStorage, manifest ve servis çalışanı adları kullanır. Aynı origin üzerinde ad ayrımı bir güvenlik sınırı değildir. Gerçek yedek veya şoför bağlantısı buraya yüklenmez. Yalnız onaylı takma adlı fixture ve dört sentetik fiş kullanılır. Kaydet yalnız örnek alanı etkiler.

Otomatik doğrulama: canlı dosyaların SHA karşılaştırması; adayın telefon dosyalarının birebir kaynak karşılaştırması; uygulama iş kodunda yalnız depolama adı değişikliği; aktarım payload'larının dışlanması; gerçek üretilen telefon paketinin tarayıcıda açılması; kök servis çalışanıyla birlikte örnek alanın açılması ve çevrimdışı yeniden açılmada test taslağının korunması.

Ölçüm önce → sonra: kök canlı sürüm 3.10.13 → 3.10.13; canlı işletme dosyası değişikliği 0 → 0. Dondurulmuş toplu ölçüm 15/38 hazır, 14 gereksiz soru, 3 yanlış alan; tekil 25/38, 3 soru, 3 yanlış alan. Bu PR ölçüm sonucunu değiştirmez. Gerçek Gemini ve fiziksel Android kabulü henüz yapılmadı; rapor gelmeden v3.11 ana yayını yapılmaz.
