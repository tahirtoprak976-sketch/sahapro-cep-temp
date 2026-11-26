# Müşteri işlem alanı — v3.10.34

Müşteri dosyasının üstündeki İşlem ve hesap alanında, yalnız açılan müşterinin tüm tarihlerdeki cari bakiyesi ve seçili dönemdeki iş hazırlığı sayıları görünür. Ana firma/taşeron hesapları ayrı kalır. Alt panoda Taşeronlar dahil seçilse de bu alandaki bakiye ve işlem bağlantıları yalnız açılan müşteriye aittir.

- İş ekle: müşteri seçili açılır. Başka bir iş taslağı varsa taslağa dönme/yeni başlangıç seçimi korunur; alanlar sessizce birleştirilmez.
- Tahsilat gir: müşteri seçili, tutar boş açılır. Müşterinin bakiyesi tahsilat tutarı olarak taşınmaz. Açmak kayıt oluşturmaz; mevcut Kaydet ve banka/para kuralları geçerlidir.
- Hakediş hazırla: seçili müşteri ve pano dönemini mevcut hazırlık ekranına taşır. Kesinleştirme yapmaz, KDV eklemez.
- Şantiye ekle: müşteri seçili yeni şantiye kartı açılır. Olmayan/pasif müşteri için bağlam reddedilir. Kartı kaydetmek ayrıca gerekir.

Son cari hareketler alanı aynı müşterinin seçili dönem ekstresinin son üç satırını gösterir. Borç artışı ve azalışı ayrıdır; her azalış tahsilat diye adlandırılmaz. Cari ekstreye dokunarak geçilir. Mazot litre hesabı TL bakiyeden ayrıdır. KDV yalnız seçilip kesinleşen hakedişte eklenir.

İş formundaki + Müşteri ekle ve + Şantiye ekle düğmeleri, daha önce seçim listesindeki Yeni... seçeneğiyle çalışan aynı küçük pencereyi açar. Adı yazıp Tamam'a basınca kart eklenip seçilir; işin miktarı, araç seçimi, açıklaması ve elle yazılmış fiyatı korunur. Vazgeç seçimleri değiştirmez. Müşteri değişince eski müşterinin şantiyesi taşınmaz. Müşteri seçmeden şantiye düğmesi kapalıdır. İş kaydını yazmak için ayrıca Kaydet gerekir.

Pasif müşteride yeni işlem bağlantıları gösterilmez; eski kayıtlar görünür kalır. İç müşteri için tahsilat/hakediş bağlantısı eklenmez. Veritabanı şeması, kayıt biçimi ve finansal hesaplar değişmez. Gerçek Android/WhatsApp/Gemini bu paket için denenmedi; otomatik sınavlarda yalnız TEST kayıtları kullanılır.
