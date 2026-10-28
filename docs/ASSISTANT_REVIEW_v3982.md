# Asistan onarımları — v3.9.82

Claude'un v3.9.80 incelemesindeki iki hata canlı v3.9.81 ile aynı kodda bağımsız olarak yeniden üretildi. Onarımlar son ek temizleme düzeltmeleri korunarak alındı.

- Kayıtlı `A-133427` fişi `A 133427` olarak tekrar okunduğunda önizleme mükerrer uyarısı veriyor, fakat kullanıcı kartı yeniden seçerse kayıt anındaki birebir metin karşılaştırması ikinci iş ve belgeyi oluşturabiliyordu. Kayıt kontrolü artık önizlemeyle aynı harf/rakam anahtarını kullanır. Gerçek tarayıcı karşılaştırmasında eski kodda 2 iş/2 belge, adayda 1 iş/1 belge görüldü. Bu değişiklik eşzamanlı sekmelerdeki tüm yarış koşullarına yönelik atomik bir kayıt sistemi kurmaz.
- Yakıt taslağındaki “20 litre”, “20 lt”, “yakıt 20 litre” ve “20,5 litre” önce litre olarak çözülüyor, ardından tutar dalında yeniden okunup reddediliyordu. Çözülmüş güncelleme artık bu dala girmez. Litre, para ve iş miktarı ayrımı korunur; gerçek ekranda önizleme kayıt oluşturmaz ve Kaydet onayı gerekir.

Doğrulama: yeni Node senaryoları, gerçek Chromium/IndexedDB ile mükerrer fiş testi ve mevcut asistan akışında “20 litre” ile gerçek yakıt kaydı. CI ayrıca mevcut testleri ve kurulu v3.9.81 → v3.9.82 dahil eski sürüm geçişlerini çalıştırır. Çalıştırma sonuçları PR ve teslim raporunda verilir.

Sınırlar: gerçek Gemini doğruluğu bu sentetik testlerle ölçülmez. Eski kayıtlar topluca değiştirilmez; şema 7 ve hesap kuralları korunur. Claude'un diğer gözlem ve önerileri bu iki onarıma eklenmedi.
