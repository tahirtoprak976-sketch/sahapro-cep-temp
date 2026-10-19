# v3.9.24 — Geçmiş faaliyet PDF aktarımı ve birleşik SOLO teslimi

Bu sürüm #141 (tarih/kart seçimi), #142 (onaylı iş miktarı düzeltme) ve PDF aktarımını birlikte içerir. Tek birleşik PR, tek Pages yayını yapılır; ara aday sürümler ayrı ayrı yayınlanmaz.

## Kullanım
Akıllı Asistan → Geçmiş işleri PDF’den aktar → PDF seç → Google/Gemini’ye gönderme onayı → Oku → ayrıntıları orijinal belgeyle karşılaştır → yalnız istenen satırları seç → kontrol onayı → Seçilenleri kaydet → son onay.

İlk okuma Gemini anahtarı, veri gönderme izni, internet ve mevcut günlük bütçeyi gerektirir. Okuma sırasında kart listeleri veya tüm işletme verisi gönderilmez; yalnız seçilen PDF, dosya adı ve okuma talimatı gönderilir. Dosya adı tarih kanıtı değildir. Bu işlem için ek ücretli servis/sunucu kurulmadı; Gemini kullanımının kullanıcının Google projesindeki koşulları değişmedi.

## Kayıt sözleşmesi
- İş, yakıt, gider, not ve özet ayrı türlerdir. Not/özet için kayıt yazma yolu yoktur.
- Hiçbir satır varsayılan seçili değildir. Tarih yoksa bugün konmaz. Tam ad/plaka eşleşmesi tekse kart önerilir; belirsiz adlar kullanıcı tarafından seçilir. Yeni müşteri/araç otomatik açılmaz.
- Geçmiş birim fiyat açıkça doğrulanamıyorsa boş bırakılır; ödeme/toplamdan fiyat türetilmez. KDV bilgisi belirsizken fiyat kaydedilmez. Güncel fiyat listesi geçmiş işe uygulanmaz.
- Fiyatsız iş, fiyatsız iş olarak kalır. Mazot anlaşması geriye dönük otomatik uygulanmaz; mevcut inceleme yolu kullanılabilir.
- Yakıt kaynağı belirsizse kullanıcı seçer. Depo Tankı gerçek stok çıkışı yaratır; eksik geçmiş depo girişi varsa stok kontrolü reddedebilir. Başarısız stok kontrolünü aşmak için gerçeğe aykırı kaynak seçilmemelidir.
- Giderin ödenip ödenmediği varsayılmaz; kasa/tahsilat/hakediş/cari hareketi oluşturulmaz. Gider kaydı maliyet raporlarında mevcut uygulama kurallarıyla görünür.
- Orijinal PDF şirket belgesi olarak tek kez arşivlenir. Arşiv belgesinin tarihi yükleme günüdür; bu tarih iş satırlarının gerçek tarihini değiştirmez. Satırlarda belge kimliği, PDF SHA-256 özeti, kaynak sayfa ve alıntı saklanır.
- Aynı PDF özetiyle okuma taslağı saklanır; yeniden seçilince Gemini tekrar çağrılmaz. Düzeltilmiş alanlar korunur. Seçimler yeniden kullanıcıya bırakılır.
- Aynı PDF/satır işlem kimliği kayıtla aynı transaction'da korunur. Aynı içerik mevcut kaydı döndürür; farklı içerik çakışır. Başarılı satırlar hata sonrası kilitlenir. Bütün PDF tek transaction değildir; sonuçlar satır bazında bildirilir.
- Başka kaynaktan girilmiş benzer tarih/araç/miktar kayıtları uyarılır. Aynı işse satırı seçmeden mevcut kaydı inceleyin. Gerçekten ayrı işlemse açık ayrı-işlem kutusuyla kaydedilebilir. İçerik benzerliği kesin mükerrer kanıtı sayılmaz.

## Sınırlar
En fazla 15 MB ve tek okumada 150 satır. Model kesildiğini bildirirse aktarım durur; daha küçük PDF gerekir. Modelin kesilmeyi bildirmemesi veya satır atlaması mümkün olduğundan kullanıcı orijinal belge ve toplamları kontrol etmelidir. Modelin kendi alıntısı bağımsız OCR kanıtı değildir. Karmaşık/taranmış PDF okuma doğruluğu garanti edilmez.

Örnekteki PDF yalnız biçim incelemesi için kullanıldı; dosya ve gerçek içerikleri depoya eklenmedi, gerçek kayıt oluşturulmadı. Asıl fiş görüntüsü PDF içinde korunur; ayrıca fiş/iş eşleştirme veya kesinleşmiş hakediş oluşturulmaz.

## Doğrulama
83 Node test dosyası; PDF normalizasyonu, not/özet dışlama, fiyat–ödeme ayrımı, eksik tarih/KDV/kaynak, dosya sınırı, benzer kayıt ve op çakışması testleri.
Gerçek Chromium + IndexedDB: iş/yakıt/gider ayrımı, salt önizleme, kesin kaynak zorunluluğu, tek PDF arşivi, sıfır hakediş/kasa/cari, yenilemede taslak devamı, aynı satırın tekrarını engelleme, farklı içerik çakışması ve kısmi başarısızlık/yeniden deneme. Gemini yanıtları taklit edilir.
Önceki tarih, seçim, asistan işlem ve fiş kurtarma tarayıcı testleri birleşik sürümde yeniden koşulur. Gerçek Google/Gemini ve fiziksel telefon test edilmedi. Veritabanı şeması v5 kaldı; site verilerini silmek gerekmez.
