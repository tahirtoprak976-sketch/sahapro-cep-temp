# SOLO v3.9.48 — seçili günden kayıt girişi

## Sorun ve sonuç

Saha Akışı’nda geçmiş bir gün ve araç seçiliyken + İş / Yakıt / Gider / Bakım
bağlantıları boş yeni form açıyordu. Gün tekrar bugüne dönüyor, araç yeniden
seçiliyordu. Bu sürümde bağlantılar seçili iş tarihini ve aracı forma taşır;
Kaydet’ten önce kaynak günü gösteren bir açıklama ve Saha Akışı’na dönüş vardır.

İş miktarı, litre, tutar, müşteri, fiyat, fiş, fotoğraf, imza veya şoför kimliği
kaynak aramasından kopyalanmaz. Kaydet olmadan işletme kaydı yazılmaz. İş fiyatı
mevcut fiyat kurallarıyla gerçek form tarihinden hesaplanır; geçmiş iş bugünkü
fiyatla varsayılan olarak doldurulmaz.

## Günlük kullanım

1. Ana ekran → Saha Akışı → günü ve gerekirse aracı seçin.
2. + İş, + Yakıt, + Gider veya + Bakım’a dokunun; tarih ve araç hazır gelir.
3. Gerçek miktar/tutar ve diğer alanları girip kontrol ederek kaydedin.
4. Kayıt tarihinin Saha Akışı açılır. Tarihi veya aracı değiştirdiyseniz dönüş
   yeni kayda göre yapılır. Arama temizlenir; etkin tür filtresi yeni kayıt türüne
   uyarlanır. Araç filtresi olmayan akış tüm araçları göstermeye devam eder.

Veresiye giderler önceki gibi esnaf hesabına borç yazıp orayı açar; Saha Akışı’na
ikinci bir gider yazılmaz. Bu istisna gider formunda açıklanır. Normal yeni form
ve düzenleme yollarının dönüşleri değişmez.

## Taslak ve benzer iş

Yarım kalan iş taslağı varsa seçimler, tarih, miktar, manuel fiyat ve notlar
korunur. Açıklama taslağın korunduğunu söyler; Saha seçimiyle sessizce üzerine
yazılmaz. Kaydedildiğinde formdaki gerçek tarih esas alınır.

Saha’dan açılan işte “Bu kayıttan sonra benzer iş aç” aynı iş tarihinde devam
eder; yeni miktar gerekir. Fiş/imza/fotoğraf/eski fiyat/şoför kimliği taşınmaz.
“Son İşten Başla” aynı Saha formunda tekrar kullanılabilir; mevcut formu değiştirme
onayı ve taslak koruması devam eder. Saha dışındaki benzer iş akışı bugünden başlar.

Geçersiz Saha günü dört formda da açık hatayla durur. İş formunda silinen tarih
sessizce bugüne tamamlanmaz; kullanıcıdan tarih istenir. Sonradan silinen veya
pasif araç otomatik seçilmez, kullanıcıya bildirilir. Düzenlenen kayıtlar yeni
formun kaynak parametrelerinden etkilenmez.

## Doğrulama

- Node: 102/102 test dosyası PASS; sözdizimi 141 dosya, SW 140 modül.
- Yeni saf test: dört yol, yalnız tarih/araç aktarımı, aktif araç, gerçek takvim,
  güvenli yerel dönüş, filtreli görünürlük, benzer iş ve değişmeyen kaynaklar.
- Yeni gerçek Chromium/IndexedDB suiti: dört form ve gerçek kayıtları, geçmiş
  fiyat kuralı (300 × 2 = 600; bugünkü 900 uygulanmaz), benzer iş, tekrar Son İş,
  değiştirilmiş tarih/araç, kuruşlu gider, bakiye oluşturmayan bakım, taslak/manuel
  fiyat, geçersiz gün, sonradan silinen araç, düzenleme, 320/360/768 px, gerçek SW
  ile çevrimdışı yeniden açılış ve sıfır Gemini isteği.
- Mevcut benzer iş, Saha Akışı, fiyat/PDF tutarlılığı, işletme öncelikleri ve
  şoförün hızlı/grup paylaşımı tarayıcı suitleri PASS.

Tarayıcı verileri yapaydır. Form gezinmesi iş/audit verisini değiştirmez; yeni
kayıtlar yalnız testin açık Kaydet adımlarında oluşur. Saha girişinin kendisi
hakediş, tahsilat veya cari hareket oluşturmaz. Mevcut finansal onay ve mükerrer
kontrolleri, şoför SP1/fotoğraf akışı ve DB şeması korunur. Sürüm ve atomik
hizmet çalışanı önbelleği v3.9.48 olarak güncellenir.
