# Hakediş hazırlığı — v3.9.83

Finans → Hakediş → **Hakediş hazırlığı**, veya müşteri kartındaki **Hakediş hazırlığını kontrol et** bağlantısı. Müşteri ve ay seçin; tarih aralığını ayrıca değiştirebilirsiniz.

## Ne gösterir?

- **Hazır:** Kayıtlı fiyat/KDV, miktar, taraf ve gerekiyorsa nakliye fişi sayımı kontrolleri tamam görünen işler. Ana para + KDV + toplam ayrı gösterilir.
- **Eksik bilgi:** Fiyatı, KDV bilgisi, aracı, miktarı veya gerekli fiş numaraları eksik işler. Eksik fiyat sıfır sayılmaz ve güncel fiyat listesi otomatik uygulanmaz; açıkça kayıtlı 0 fiyat geçerlidir.
- **Kontrol gerekli:** Olası mükerrer iş/fiş, tarih veya şantiye bağlantısı, kilitli fakat hakedişsiz fiyat ya da kayıtlı tutar ile miktar/fiyat uyuşmazlığı. Benzer kayıt kesin mükerrer sayılmaz ve silinmez. Tarihi olmayan eski kayıtlar seçilen aya dahil varsayılmadan ayrıca belirtilir.
- **Anlaşma kapsamı:** Mazot karşılığı, sözleşmeye dahil ve iç işler TL hazırlık toplamından ayrılır.
- **Hakedişe bağlı:** Aktif taslak veya kesinleşmiş hakedişteki işler yeniden hazır listesine girmez. Kaydedilmiş manuel/eskiden net tutarlı hakediş fiyatı yeni iş tarifesi gibi yeniden yorumlanmaz. İptal edilmiş hakediş bağlantısı aktif rezervasyon sayılmaz; kayıtta kilit kalmışsa ayrıca kontrol gerekir.

Borçlu müşteri kimliği esas alınır; ana firma ile taşeron birleştirilmez. Aynı araç/gün tek başına çakışma sayılmaz; kullanıcı bir günde farklı müşterilere çalışabilir.

## Mazot ve fişler

Mazot için dönem başı devir + dönemde hak edilen − alınan = dönem sonu litre farkı gösterilir. Hak, teslim ve TL tahsilatı ayrıdır; farkın sıfır olmaması hata değildir. Hesap müşterinin tüm şantiyelerini kapsar, teslimler işlere dağıtılmaz. Geçersiz tarih/litre varsa kesin kalan gösterilmez. Dönemden sonraki teslimler geçmiş hesaba düşülmez.

Fiş sayımı işe kimlikle bağlı aktif Döküm Fişi belgeleri ve işin fiş numarası üzerinden yapılır; aynı numara iki kez sayılmaz. Fotoğraf/ham mesajın gerçek doğruluğunu veya WhatsApp'ta kalmış ama uygulamaya girilmemiş işleri bu ekran ölçmez. Saat/yevmiye işi sırf döküm fişi olmadığı için eksik sayılmaz.

## Taslak oluşturma

**Hazır işleri hakedişte incele** güncel kayıtları yeniden okuyan mevcut hakediş formunu açar. **Listelenen hazır işleri seç** sadece kontrol kutularını işaretler. **Hakediş Oluştur** ve onayı taslak oluşturur; cari borç kesinleştirmeye kadar yazılmaz. Kaydetmeden önce hazırlık durumu yeniden okunur; örneğin seçilen seferin fişi silinmişse taslak oluşturma durur. Müşteri/dönem/filtre değişince seçim temizlenir. Normal hakediş formundan diğer işleri elle inceleme olanağı korunur.

## Doğrulama ve sınırlar

Yeni saf mantık testi, gerçek Chromium/IndexedDB/servis çalışanı testi: dönem/taşeron ayrımı, eksik ve sıfır fiyat, KDV/vinç, fiş sayımı, benzer kayıtlar, anlaşmalar, eski tarihsiz kayıt, litre hesabı, önizleme/iptalde sıfır yazma, güncelliğini yitirmiş fişin reddi, açık onayla yalnız taslak oluşturma ve çevrimdışı açılış. Tam CI ve kurulu sürüm geçişlerinin sonuçları teslim raporunda verilir.

Yeni veri şeması veya muhasebe politikası yok; eski işler, fiyatlar ve hakedişler topluca değiştirilmez. Hazırlık bir kontrol görünümüdür; fişlerin gerçekliğini doğrulamaz ve eşzamanlı belge düzenlemeleri için yeni bir atomik muhasebe sistemi kurmaz. Mevcut sunucu/YZ2 işi ayrıdır.
