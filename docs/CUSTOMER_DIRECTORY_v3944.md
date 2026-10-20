# SOLO v3.9.44 — müşteri listesi ve hesapların anlaşılır gösterimi

Müşteri listesinde yalnız ad/telefon yerine her kartın kendi TL bakiyesi, varsa
mazot bakiyesi, ana firması, iş sayısı, fiyatı eksik iş sayısı ve son iş tarihi
gösterilir. Pasif müşteriler işaretlenir; silinenler ve Kendi Depo listelenmez.

Filtreler: Tümü, TL alacağı, Mazot alacağı, Fiyatı eksik, Taşeronlar, Pasif.
Arama ad, ana firma, yetkili ve telefonu kapsar; yazarken odak kaybolmaz. Sıralama
ad, TL alacağı veya son işe göre yapılabilir. Arama/filtre/sıralama URL'de tutulur,
yenilemede geri gelir. Liste 30'ar kartla açılır. Müşteri ekleme başlıktadır.

Açılır hesap özeti yalnız filtrelenmiş listedeki müşterileri kapsar. Pozitif TL
alacağımız ile müşterilerin TL alacağı netleştirilmeden ayrı gösterilir. Mazot
alacağı ve fazla alınan mazot da ayrı litre toplamlarıdır. Taşeron hesabı ana
firmaya eklenmez. Her kartın kendi hesabı mevcut collect-core/customerFuelLedger
kaynaklarından gelir; muhasebe veya mazot hesaplama yöntemi değiştirilmez.

Fiyatı açıkça 0 TL girilmiş iş ile fiyatı hiç girilmemiş iş ayrıldı. Müşteri
listesi, müşteri panosu ve yapılan işler aynı sunum denetimini kullanır.
Kesinleşmiş hakedişe dahil, kilitli, mazot karşılığı, iç iş veya sözleşmeye dahil
kayıtlar eksik fiyat uyarısı üretmez. PDF iş dökümü açık sıfır fiyatı “0,00 ₺”,
sözleşmeye dahil işi kendi etiketiyle gösterir. Pano tutarları kuruşları gizlemez.
Bu değişiklikler kayıtlı fiyat, borç, tahsilat veya hakediş tutarını değiştirmez.

Rapor merkezinin bağımsız filtreleri olduğu müşteri listesindeki bağlantıda açık
belirtilir; listedeki yeni hesap filtreleri rapor merkezine otomatik taşınmaz.

## Doğrulama

- 98/98 Node test dosyası; sözdizimi 138 dosya; SW listesi 137 modül.
- customer-directory.test: ayrı taşeron hesapları, kuruşlar, hakediş, tahsilat,
  pozitif/negatif TL ve litre, sıfır/eksik fiyat, filtreler, sıralama ve veri
  değişmezliği.
- customer-panel.test: açık sıfır fiyatın eksik sayılmaması ve müşteri PDF tanımı.
- customer_directory.py: gerçek IndexedDB, arama/filtre/sıralama, yenileme,
  320/360/768 px, doğru karta geçiş, iş/tahsilat/fuel/müşteri/hakediş ve audit
  kayıtlarının birebir değişmezliği. Yalnız sentetik TEST verisi.
- pano.py: Kılıç örneği 1575 L hak / 525 L alınan / 1050 L kalan, dönem/TL
  ayrımı ve read-only pano korunur.
- driver_fast_share.py: önceki sürümün kodlu gönderim/dosya alternatifi ayrımı
  korunur; native paylaşım taklit edilir, gerçek WhatsApp mesajı gönderilmez.

Sürüm ve SW önbelleği yenilendi. DB şeması ve sunucu durumu değişmez.
