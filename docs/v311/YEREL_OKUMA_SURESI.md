# Yerel okuma süre ölçümü — telefon / Gemini değildir

13.11.2026 çalışma ortamında Node ile20takmaadlımesaj/38kart ölçüldü. Önceki bfb0055 kaynağında ilk çağrı606ms, sıcak çağrılar280/267/264ms idi. Yalnız metin normalizasyonunun sınırlı oturum önbelleği eklenince ilk çağrı417ms, sıcak çağrılar103/89/89/89/86ms oldu. Sayılar donanıma/JIT/yüke bağlıdır; telefon süresi veya garanti değildir.

Önce/sonra bütün planın JSON çıktısı byte byte aynıydı: SHA256 95466250f7ce38c1bc1e244b13a0b933891803c032c6f9fdf7bfca6178aaeb54. Bu eşitlik yalnız bu sentetik/takmaadlı korpusun çıktısı içindir; gerçek Gemini başarısı anlamına gelmez. Eski tests/gold beklentileri değişmedi;202Node ve offline_whatsapp104/assistant_turn/assistant_large_batch/assistant_receipts311 tarayıcı kontrolleri geçti.

Önbellekte yalnız saf metin dönüşümü vardır; müşteri/araç kimliği veya eşleşme sonucu tutulmaz. Silinen/değişen kayıtlar ve farklı veritabanları bu yüzden önceki kimliği kullanmaz.Her dönüşümün önbelleğinde512girdi/131072toplamkarakter sınırı vardır;2048karakterden uzun metin ve metin olmayan girdi saklanmaz. Bu bellek uygulama kapanınca kaybolur; IndexedDB, öğrenme hafızası, fiyat, sağlayıcı veya işlem kuralları değişmez.

Tekrar ölçüm: `node tools/benchmark-assistant-offline.mjs`. Koşucu yalnız kayıtlı takma adlı fixtürü kullanır, API/veritabanı/Kaydet çağrısı yapmaz. Yeni fixtür/tarih/değişiklikte hash farklı olabilir; eski hash'i zorla eşitlemek için kaynak veya beklenti değiştirilmez.

Bu hızlanma50msilkboyama/aynıalanlardakaymasızrender kabulünü TAMAMLAMAZ. İlk kartın parça parça hazırlanması ve arayüzde aynı düğümlerin korunması ayrıca uygulanmalı ve gerçek telefonda ölçülmelidir.
