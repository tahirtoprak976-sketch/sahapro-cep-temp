# Müşteri takip dosyası — v3.10.28

Müşteriler → müşteri kartı → Müşteri panosu içindeki **Müşteri takip dosyası**.

1. Dönemi seçin. Kontrol gerektiren ve eksik bilgili işlerin sayısını görün; hazırlık ekranında kaynak kayıtları kontrol edin.
2. Hazır işler varsa hakediş hazırlığına geçin. Taslak hakediş varsa önce mevcut taslağı kontrol edin; aynı işler yeniden hazırlanmaz.
3. **Miktar mutabakatı / fiyatsız PDF** ile ilgili müşterinin ve dönemin hakediş oluşturma ekranını açın. İşleri seçip mevcut **Fiyatsız Mutabakat PDF** düğmesini kullanın. PDF üretmek müşteri onayı oluşturmaz.
4. **Tahsilat takibi** ile müşteri hesabındaki mevcut takip ekranını açın. Bu bölüm genel tahsilatı tek bir hakedişe ödeme olarak atamaz.

Takip yalnız seçilen müşteriye aittir; panodaki “Taşeronlar dahil” seçeneği bu dosyanın muhatabını değiştirmez. Mazot, sözleşmeye dahil ve iç işler TL hazırlığından ayrı gösterilir. Fiyatı bilinmeyen işe fiyat atanmaz. KDV politikası değişmez: yalnız hakedişte ayrıca seçilip kesinleştirilince cariye eklenir.

Bu ekranda kayıt, şema, müşteri onayı veya geçmiş tutar değişikliği yapılmaz. İş sayıları mevcut hakediş hazırlığı denetiminden, hakediş durumları kayıtlı hakedişlerden gelir. Müşteri kartının mevcut ortak anlık verisi kullanılır; ilave veritabanı dökümü alınmaz.

Otomatik ölçüm: aynı telefon testi değişmemiş v3.10.27’de `CUSTOMER_DESK_MISSING` ile başarısız, adayda başarılıdır. Gerçek telefonda zaman kazancı, gerçek müşteri onayı ve gerçek PDF paylaşımı bu otomatik testle ölçülmez.
