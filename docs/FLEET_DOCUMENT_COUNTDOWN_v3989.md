# Filo belge süreleri — v3.9.89

Filo ekranındaki **Belge süreleri** bağlantısı `#/filo-belgeleri` sayfasını açar.
Ana sayfada özet, filo listesinde aracın öncelikli belgesi, araç kartında tüm
belgeler ve belge detayında kendi sayacı gösterilir. Kayıtlar cihazda kalır;
bu özellik için sunucu veya yeni hesap gerekmez.

## Gün hesabı ve görünüm

- Süresi geçmiş: “6 gün geçti”. Bitiş günü: “Bugün bitiyor”.
- 1–7 ve 1–30 gün kalan belgeler ayrı filtrelenebilir; sonraki günler de tam
  kalan gün sayısıyla gösterilir. 30 gün filtresi 1–30 gün aralığıdır;
  bugün biten belgeler ayrı sayılır.
- Hesap cihazın yerel bugünkü tarihiyle, takvim günü farkından yapılır.
  Yaz/kış saati farkı gün sayısını kaydırmaz.
- Belge tarihi ile isteğe bağlı **Geçerlilik başlangıcı** ayrı alanlardır.
  Başlangıç belirtilmemişse belge tarihi esas alınır. Gelecekte başlayacak
  yenileme belgesi, bugünkü belgenin süresini gizlemez.
- Aynı araç ve belge ailesinde, başlamış belgelerden en ileri bitişli olan
  öne çıkar; eskiler “Önceki belgeler” altında dosyalarıyla korunur.
- Bitiş tarihi eksik süreli belgeler, geçersiz tarihler ve çelişkili araç
  eşleşmeleri “Kontrol gerekli” altında gösterilir. Belirsizlik sıfır gün
  veya geçerli belge olarak sunulmaz. Ruhsat gibi bitişi girilmemiş belgede
  süre sınırının girilmediği belirtilir; yasal uygunluk iddiası yapılmaz.
- Araç, belge türü/numarası ve plaka ile filtreleme yapılır. Pasif araçlar
  isteğe bağlıdır. Silinmiş/iptal belgeler ve personele ait belgeler filo
  sayacına girmez. Hiç eklenmemiş zorunlu belge, mevcut araç uygunluk
  kontrolünün kapsamındadır; sayaç listesi yüklenmiş belgeleri izler.

## Belge ekleme ve tarih düzeltme

“Araç belgesi ekle” mevcut belge yükleme ekranına gider; araç sayfasından
açıldığında doğru araç seçili gelir. Fotoğraf/PDF mevcut belge sisteminde
saklanır. Tarihler belge üzerinden kontrol edilmelidir; OCR doğruluğu
garanti edilmez.

“Tarihi kontrol et / düzelt” yalnız seçilen belgenin tarih ve numara
alanlarını, denetim kaydıyla değiştirir. Geçersiz takvim tarihi, bitişten
sonraki başlangıç ve hatırlatma reddedilir. Eşzamanlı başka bir düzenleme
varsa eski form yeni veriyi ezemez. Fotoğraf/dosya baytları değiştirilmez.
Yenilenmiş poliçe veya muayene için eski belgenin bitişini ileri taşımak
yerine **yeni belge** eklenmelidir.

## Yenileme, çevrimdışı kullanım ve sınırlar

Sayaçları görüntülemek iş, yakıt, gider, tahsilat veya belge kaydı yazmaz.
Şema sürümü 7 kalır; geçmiş kayıtlar topluca dönüştürülmez.

Açık ekranda yerel gece yarısı, uygulamaya dönüş ve belge/araç değişikliği
sayacı yeniler. Başka sekmedeki belge değişikliği araç formunu veya açık
sekmeyi kapatmadan yalnız belge bölgesini günceller. Çevrimdışı açılış ve
filtrelerin korunması servis çalışanı önbelleğiyle desteklenir.

Uygulama kapalıyken push bildirimi, resmî kurum sorgusu veya otomatik
belge yenileme yapılmaz. Sayaç, girilen tarihlere ve cihaz saatine bağlıdır.

## Doğrulama

- `tests/fleet-document-countdown.test.mjs`: takvim sınırları, eksik/bozuk
  tarih, geçerlilik başlangıcı, eski/yeni belge, araç sahipliği, filtreler
  ve salt okunur hesap.
- `tools/e2e/fleet_document_countdown.py`: gerçek Chromium/IndexedDB ile
  320/390/768 px görünüm, ekleme/düzeltme, dosya baytları, eski form reddi,
  diğer sayfadan yenileme, çevrimdışı açılış, gece yarısı ve odağa dönüş.
- Sürümler arası kurulum testi: bekleyen güncellemede kaydedilmemiş form,
  kayıtlar, kaynaklar, denetim izleri, taslaklar ve ek dosyalar korunur.

Tarayıcı kontrolleri ayrı TEST profillerinde çalışır; gerçek telefondaki
işletme kayıtlarına erişilmez.
