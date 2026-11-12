# Toplu mesaj bağlamı — ilk paket

Bu raporlar takma adlı işletme sınavının dondurulmuş model önerilerini ölçer; gerçek Gemini başarısı değildir. Sınav adları uygulama koduna eklenmez. `node tests/assistant-gold/diagnose-real.mjs RAPOR.json` soru alanlarını ve hazır gelmeyen kartlardaki bayrakları sayar; beklentileri veya eşleştirmeyi değiştirmez.

Başlangıç 21 gereksiz soru: tarih 15, müşteri 3, iş türü 1, malzeme 2. Başlıktaki günün modelde farklı dönmesi kullanıcıya sorulmaya devam eder; birleştirme yalnız aynı kaynak bloğu ve aynı önerilen tarihte yapılır. Fotoğraf tarihi çelişkileri birleştirilmez. Sayı azaltmak için koruma kaldırılmaz.

Önerilen 28/38 hazır ve en fazla 5 soru hedefi bu dondurulmuş model hattında sağlanmadı. Yerel çevrimdışı okuyucu ayrı hatta 25/38 hazır doğru ve 3 gereksiz soru üretir. Yeni müşterinin adını belirsiz metinden icat etmek veya yeni bloğa önceki malzemeyi taşımak bu sonuçlara ulaşmak için kullanılmaz.

Tarih/gönderen ve müşteri/şantiye/araç sınırları, devam satırı, gerçek tarih çelişkisi, ortak cevabın hedefleri ve manuel alan koruması yeni Node ve tarayıcı testleriyle doğrulanır. Tüm işletme verisi sentetik TEST kayıtlarıdır. Şema7/kayıt biçimi değişmez; kaynak bilgisi telefon belleğinde Symbol üzerinde yaşar. Gerçek telefon/Gemini/WhatsApp sınanmadı.
