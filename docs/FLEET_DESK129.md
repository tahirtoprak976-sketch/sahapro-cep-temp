# Araç takip dosyası — v3.10.29

**Filo → araç / makine → Araç takip dosyası**.

- Belge kontrolü, açık bakım / arıza, geciken bakım kuralı ve bakım geçmişi sayıları aynı araç için gösterilir. Öncelikli düğme önce belge kontrolüne, sonra açık bakıma, ardından bakım takvimine yönlendirir.
- Muayene yenilenince mevcut belge süre kuralları kullanılır. Henüz başlamamış bir belge, süresi geçmiş eski belgeyi gizlemez. Belge kaydı olmaması “muayene geçerli” sayılmaz.
- Son kayıtlı kilometre ve çalışma saati; tarih ve kaynakla görünür. Gelecek / geçersiz tarihli okumalar kullanılmaz; azalan okumalar uyarılır. İşlerden türetilen saatler kesin sayaç okuması olarak gösterilmez. Takvim kuralında iş saatlerinden tahmin varsa açıklanır.
- Bilinen maliyet satırları, mevcut maliyet hesabından brüt ara toplam olarak gösterilir. Bağlı bakım / alış bir kez hesaplanır. Tutarı bilinmeyen bakım / alış ayrıca uyarılır; yalnız takip kaydı yeni gider sayılmaz. Bu tutar ödeme veya kâr değildir.
- **Maliyet kaynakları**, mevcut maliyet ekranını; **Bakım raporu / PDF**, bu araca ait mevcut bakım raporunu açar.
- **Yenile**, yalnız takip alanını yeniler; açık bakım sekmesini değiştirmez. İlgili kayıtlardaki değişikliklerde ve uygulamaya dönüşte de alan yenilenir.

Yeni bir kalıcı durum, fiyat, bakım tamamlanması veya şema eklenmez. Belge, sayaç, bakım ve para kayıtları otomatik düzeltilmez. Önceki ekranların belge / bakım düzenleme ve kayıt onayları korunur.

Ölçüm sınırı: otomatik telefon genişliği testi fiziksel Android testi değildir. Gerçek araca, muayene belgesine ve işletme kayıtlarına erişilmez. Gerçek bakım maliyeti ve sahada zaman kazancı bu testlerle ölçülmez.
