# Araç dosyasından işlem — v3.10.35

Filo → araç/makine dosyasında Araç takip dosyası artık başlığın hemen altında yer alır. Belge kontrolü, açık bakım/arıza, bakım kuralları ve son kayıtlı sayaçlar aynı mevcut kaynaklardan gösterilir. Maliyet uyarıları, kaynağa dönüşler ve bakım PDF'i korunur.

Üstteki dört işlem:

- Yakıt ekle: araç ve bugün seçili açılır. Litre, birim fiyat, tutar, kilometre/saat ve personel boş kalır. Kaynağı kontrol edin; örneğin depodan verilen ile istasyondan alınanı ayırın. Kaydetmeden yakıt yazılmaz.
- Bakım / arıza aç: araç ve tarih seçilidir; maliyet boş, mevcut varsayılan durum Açık'tır. Bakım türünü ve maliyet/kayıt biçimini mevcut alanlardan seçin. Açmak veya ödeme yapmak bakım tamamlandı demek değildir.
- Belge ekle: mevcut belge formunda araç sahibi hazır seçilir. Varsayılan Muayene Belgesi türü değiştirilebilir; geçerlilik bitişi boş kalır. Belgeyi açmak eski süreyi yenilemez; mevcut dosya ve kaydetme şartları geçerlidir.
- Sayaç oku: araç seçili, yeni değer boştur. Son okuma yeni okuma diye kopyalanmaz.

Yakıt veya bakım kaydedilince araç dosyasına dönülür. Formda aracı değiştirdiyseniz kaydın gerçekten yazıldığı aracın dosyası açılır. Bulunamayan/pasif araç bağlamıyla yakıt ve bakım girişi durdurulur. Pasif araçta üstteki yeni işlem bağlantıları sunulmaz; mevcut takip ve raporlar korunur.

Son yakıt kaydı aynı araca ait en yeni geçerli iş tarihli kaydı açar. Gelecek, geçersiz tarihli, silinmiş ve iptal edilmiş kayıtlar bu özete alınmaz. Litre bilinmiyorsa sıfır yazılmaz. Verilen yakıt, ölçülmüş tüketim değildir.

Şema ve kayıt biçimi, mali hesaplar, stok/para kuralları, revizyon ve kayıt onayları değişmez. Form bağlamı yalnız araç ve tarihi taşır; tutar, belge, yeni sayaç veya önceki yakıt miktarı taşımaz. Gerçek Android/WhatsApp/Gemini bu paket için denenmedi; sınavlarda yalnız TEST kayıtları kullanılır.
