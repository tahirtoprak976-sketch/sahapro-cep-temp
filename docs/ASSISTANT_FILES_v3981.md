# Asistan ekleri — v3.9.81

Kimi'nin v3.9.80 adayındaki iki küçük düzeltme bağımsız incelemeden sonra alındı:

- Görevdeki dosyaların tamamı kaldırıldığında boş dosya taslağı bırakmak yerine o görevin dosya taslağı silinir. Başka görevlerin dosyaları korunur.
- “Ekleri temizle” bekleyen ek taslağını doğrudan siler; temizleme hatası kullanıcıya bildirilir. Sonraki taslak yazımının 250 ms gecikmesini beklemez.

Boş görev taslağı sorunu gerçek IndexedDB ile eski ve yeni sürümde karşılaştırıldı. Gecikmeli temizlemenin kullanıcıda eski fotoğrafı geri getirdiği iddiası bağımsız denemede tekrarlanamadı; ikinci değişiklik zamanlama iyileştirmesi olarak alındı.

Kapsam: asistanın ek ve taslak yönetimi. Şema 7, hesap kuralları ve kayıt onayı korunur. Eski kullanıcı kayıtları topluca değiştirilmez; gerçek Gemini doğruluğu bu sentetik testlerle ölçülmez.

Doğrulama: tüm Node dosyaları, mevcut tarayıcı suitleri ve yeni gerçek IndexedDB ek temizleme testi CI'da çalışır. Güncelleme kontrollerine kurulu v3.9.80 → v3.9.81 geçişi eklendi; kayıtlar, meta veriler, taslaklar ve orijinal ek baytları karşılaştırılır. Çalıştırma sonuçları PR ve teslim raporunda verilir.
