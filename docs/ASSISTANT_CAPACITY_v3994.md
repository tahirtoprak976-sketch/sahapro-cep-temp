# Asistan görev kapasitesi — SOLO v3.9.94

01.11.2026, şema 7. İşletme kayıtları veya eski görevler yükleme sırasında otomatik değiştirilmez.

## Sorun ve davranış

Beş açık taslak biriktiğinde altıncı öneri modelden doğru dönse de görev koleksiyonuna kaydedilirken reddediliyordu. Kullanıcının yeni fiyat isteği kontrol kartına ulaşamıyor, tekrar deneyince aynı hata önceki uyarının üstüne ekleniyordu.

Artık beş istek doğrudan açık tutulur. Yeni bir istek hazırlanırken en eski açık taslak **beklemeye alınır**; kaynak, plan, sohbet, kimlik ve dosya bağlantıları korunur. Eski isteğe **Geçmiş → Açık görevler → Göreve ve dosyalarına dön** ile dönülebilir. Bekleyen görev açılınca eski draft/clarify durumu korunur ve revizyon yükselir; başka eski bir açık istek gerektiğinde bekler. Sadece cevap veren salt okuma mesajları görev oluşturmaz.

**Kapat**, yalnız seçilen açık/bekleyen taslağı iptal eder; iş/para kaydı oluşturmaz veya silmez. Diğer görevler ve aktif sohbet korunur. Aktif taslak kapatılırsa kendi dosyaları görevde kalır, sonraki yeni isteğe ek olarak taşınmaz. Yazılan mesaj ve diğer seçili görev dosyaları ekrandaki yeniden yüklemede korunur. applying/review durumları bekletilmez, bu düğmelerle kapatılmaz veya otomatik yeniden uygulanmaz.

Görev işlemleri tek metadata transaction'ında yapılır. Başka sekmenin eski revizyonu kaynak üzerine yazamaz; kota/yazma hatası eski görevleri kısmen bekletmez. Bekleyen kaynaklara otomatik zaman aşımı/silme uygulanmaz. Tamamlanan/iptal edilenlerin mevcut 20 kayıt geçmişi sınırı sürer.

Aynı istekte tekrarlanan hata ekranda **tek güncel uyarı** olur. Mevcut form düğümleri, elle yazılan değerler ve olay bağları korunur. Hata bir kayıt onayı veya işin uygulandığı anlamına gelmez.

## Doğrulama

- assistant-task-center.test.mjs, assistant-capacity94.test.mjs: beş açık + dört bekleyen, kaynak/plan/sohbet, eski durumuna dönme, revizyon denetimi, yalnız seçilen isteği kapatma, applying/review koruması ve kota rollback.
- assistant_capacity.py: gerçek Chromium/IndexedDB, taklit native Gemini. Beş görev doluyken altıncı/yedinci Tarabya 7.000 TL fiyat kartının açılması; salt cevabın görev oluşturmaması; iki gerçek metadata write-failure sonrası tek uyarı ve 7.100 TL elle düzenlenmiş formun korunması; bekleyen özgün dosyasını geri getirme; başka ve aktif görevi kapatma; mesaj/dosya korunması; işletme kayıtlarının değişmemesi.
- --baseline-proof değişmemiş v3.9.93 üzerinde altıncı isteğin reddini ve iki uyarı birikmesini kanıtlar. Bu beklenen eski hata adayın doğruluğu sayılmaz.
- Yayın öncesi mevcut tüm Node/tarayıcı/yükseltme kontrolleri çalışır. Gerçek Gemini veya kullanıcının telefonundaki veriler bu sentetik testlerle ölçülmez.
