# Bakım, gider ve esnaf geçmişi — v3.9.90

## Sorun ve nedenler

Esnaf Hesabı ve gider ekranındaki veresiye akışı, bakım bedelini `payables`
alış/borç kaydı olarak saklıyor. Bakım / Arıza ekranı yalnız
`maintenance_records` okuyordu. Bu nedenle doğru kaydedilmiş maliyet,
maliyet analizinde göründüğü halde bakım listesinde bulunamıyordu.
Açılıştaki “Açık” filtresi de tamamlanan geçmiş bakımları gizliyordu.

İncelemede iki ek kopukluk doğrulandı: takvim “Serviste” durumunu son
tamamlanan bakım sayabiliyordu; esnafın `payable` türündeki eki, alış detayının
yalnız `payables` araması nedeniyle kaynak ekranda görünmüyordu.

## Yeni davranış

**Daha Fazla → Bakım / Arıza** artık bakım kayıtlarını, bakım kategorili
giderleri ve esnaf/alış belgelerini tek geçmişte gösterir. Araç kartındaki
Bakım / Arıza sekmesi, filtreli bakım raporu, detaylı bakım PDF/CSV raporu da
bu kaynakları kullanır. Başlangıç filtresi “Tümü”dür. Açık/Tamamlanan
filtresi başka kayıtları gizlediğinde görünür bir bağlantıyla tümü açılır.

- Bakım/Onarım, Tamir, Servis, Lastik, Yağ/Filtre ve Periyodik Bakım gibi
  açık kategoriler kullanılır. Açıklamadan müşteri, araç, kategori veya
  tamamlanma durumu tahmin edilmez. Genel yedek parça satın alma,
  malzemenin araca takıldığını tek başına kanıtlamaz.
- Her satır asıl kaydını açar. Esnaf ve gider belgeleri “İş durumu
  belirtilmemiş” olarak görünür. Borcun açık/ödenmiş olması, arızanın
  açık/tamamlanmış olmasıyla aynı değildir.
- Alışın açık `source_store/source_id` bağlantısı varsa bakım/gider ve
  alış bedeli tek işlem olarak gösterilir. Aynı tarih/tutar/açıklama
  tek başına birleştirme kanıtı sayılmaz.
- Çelişkili araç bağlantısı ve eksik kaynak açıkça işaretlenir; yanlış
  araca bedel taşınmaz. Araçsız kayıt tüm listede görünür, araç
  filtrelerine isim benzerliğiyle eklenmez. Eksik maliyet sıfır değildir;
  açıkça girilmiş 0 ₺ ayrı korunur.
- İptal/silinmiş kayıtlar ve açılış/devir borcu bakım maliyeti sayılmaz.
  Gider/alış dosyasının iki eski kayıt türü de desteklenir. Fotoğraf/PDF
  güvenli görüntüleyiciyle açılır; özgün baytlar yeniden yazılmaz.
- Bakım takvimindeki son bakım yalnız gerçek tarihli, gelecekte olmayan,
  **Tamamlandı** durumundaki bakım kaydından alınır. Serviste/Parça
  Bekliyor/iptal kayıt ve finansal belge bu tarihi sıfırlamaz.

Bu bir okuma bağlantısıdır. Eski kayıtlar otomatik kopyalanmaz; ikinci
bakım, gider, kasa/banka hareketi veya esnaf borcu oluşturulmaz. Finansın
kaynak muhasebesi ve geçmiş tutarları değiştirilmez; şema 7 kalır.
Araç kartının bakım sekmesi, başka açık sayfadaki yeni/iptal kaynakları
sekmeyi sıfırlamadan yeniler. Açık araç düzenleme formu korunur.

## Doğrulama

`tests/maintenance-expense-history.test.mjs`: esnaf-only bakımın görünmesi,
kaynak bağlantılı tek maliyet, bağımsız aynı tutarlı işlemler, eski/eksik ve
çelişkili kaynaklar, ödeme/iş durumu ayrımı, kategori sınırları, rapor/CSV,
orijinal finans verisinin değişmemesi ve takvim tamamlanma sınırı.

`tools/e2e/maintenance_expense_history.py`: ayrı TEST profillerinde gerçek
Chromium/IndexedDB, gider → veresiye alış → bakım listesi akışı, kaynak
fotoğrafı ve bayt koruması, gerçek PDF/CSV, 320/390/768 px görünüm,
başka sayfadan yenileme, araç formu koruması, iptal, çevrimdışı açılış ve
okuma hatasının görünür kalması.

Aynı araç eski v3.9.89 üzerinde `--baseline-proof` ile görünmeyen bakım,
kaynak fotoğrafı ve Serviste/takvim sorununu kanıtlar; aday üzerinde doğru
davranışı doğrular. Test verileri kurgusaldır. Gerçek telefondaki işletme
verilerine erişilmez; kullanıcı kendi kaydını sürüm güncellemesinden sonra
kontrol eder.
