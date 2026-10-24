# SOLO v3.9.67 — Parça kaydında görünür gider durumu

v3.9.66 parça formu varsayılan olarak **Yalnız parça ve garanti takibi** seçiyor,
kayıt mesajı da gider oluşup oluşmadığını açıklamıyordu. Fiyat yazılmış olsa bile
bu seçimle yalnız garanti kartı kaydediliyordu. Bu sürüm seçimi zorunlu kılar ve
kayıtlı parçayı yeniden oluşturmadan maliyet ekleme yolu sunar.

## Yeni kayıt

Maliyet seçimi başlangıçta boştur; belge okuma bu seçimi yapmaz.

- **Yeni gider oluştur:** miktar × KDV dahil birim fiyat, Yedek Parça kategorisinde
  bir gider oluşturur. Parça ve gider tek transaction'da yazılır. Kaydet düğmesi
  ve önizleme bunun giderlere yazılacağını açıkça söyler.
- **Mevcut gider / bakım / alışa bağla:** aynı araçtaki geçerli kayıt seçilir.
  İkinci gider oluşmaz. Veresiye alış, ilgili alış belgesine bu yolla bağlanır.
- **Yalnız garanti takibi:** gider yazılmayacağı önizlemede, düğmede ve sonuçta
  açıkça görünür. Kart ve listede **Gider kaydı yok** yazar.

Maliyet seçimi yapılmadan uygulama kayıt yazmaz; çekirdek doğrulama da eksik
seçimi reddeder. Eski taslakta kullanıcının seçmediği varsayılan “tracking”
değeri yeni formda sessiz onay sayılmaz. Açıkça yapılmış seçim korunur.

## Daha önce kaydedilmiş aküyü giderlere işleme

**Daha Fazla → Yedek Parçalar → ilgili akü → Gider Oluştur / Mevcut Maliyete
Bağla** yolunu kullanın. Yeni gider için gerçek KDV dahil birim bedeli girin;
toplam ekranda gösterilir. Maliyet daha önce kaydedildiyse mevcut kaydı seçin.
Akü kartı, miktarı, garanti bilgileri ve orijinal belgeleri korunur.

Bağlı kart/listede **Gider kaydına bağlı**, **Bakım kaydına bağlı** veya
**Alış belgesi kaydına bağlı** görünür. Gider varsa ayrıntıdaki **Maliyet Kaydını
Aç** düğmesi kayda gider. Bağlantısı kaldırılmış maliyet hâlâ duruyorsa bu da
açıkça gösterilir; yeni gider oluşturulması engellenir. Mevcut maliyeti yeniden
bağlamak veya önce eski maliyeti düzeltmek gerekir.

## Kayıt korumaları ve sınırlar

- Gider, parça bağlantısı ve audit aynı IDB transaction'ındadır. Hata olursa
  hiçbiri kalmaz. Belgeler bu işlemde taşınmaz, silinmez veya yeniden yazılmaz.
- Aynı işlem kimliği ve içerikle tekrar tek sonuç döner. Değişen içerik,
  eskiyen parça ve zaten bağlı maliyet ikinci gider üretmez. Farklı kimliklerle
  eşzamanlı onaylardan yalnız biri aynı parça revizyonuna maliyet ekler.
- Miktar/araç/tarih bu küçük maliyet formundan değiştirilemez. Başka araca ait,
  silinmiş veya iptal edilmiş kayıt bağlanamaz. Devir ve depo stok alışları
  parça maliyeti olarak seçilemez.
- Fiyat bilinmiyorsa gider tutarı tahmin edilmez. Gider oluşturulması nakit veya
  banka ödemesi yapıldığı anlamına gelmez; bu işlem ödeme hareketi oluşturmaz.
  Garanti belgesi de tek başına ödeme kanıtı değildir.
- DB sürümü 6 kalır. Daha önceki kullanıcı kayıtları otomatik değiştirilmez.
  Kullanıcının telefon veritabanına uzaktan kayıt yapılmadı; bu sürüm telefondaki
  mevcut kaydı düzeltmek için gerekli yolu sağlar.

## Testler

`parts-ledgers.test.mjs` açık seçim zorunluluğunu ve doğru maliyet durumlarını
sınar. `part_cost.py` gerçek Chromium/IDB ile iki akünün takip kartını bir kez
6.000 TL gidere bağlar; parça sayısı değişmez, kasa/banka hareketi oluşmaz.
Eksik fiyat, yanlış araç kaydı, gerçek gider insert hatası, tekrar, içerik
çakışması, iki eşzamanlı onay, eskiyen düzenleme, bağlantıyı kaldırıp yeniden
bağlama, orijinal belgeyi koruma, mobil genişlikler ve temiz profile yedek
geri yükleme de sınanır. Yapay zekâ çağrısı ve gerçek kullanıcı verisi yoktur.

Doğrulama: 122/122 Node test dosyası, 171 JS sözdizimi dosyası/170 SW modülü ve
beş tarayıcı suiti (`part_cost`, `part_documents`, `part_document_guards`,
`parts_ledgers`, `transaction_errors`) geçti. Önizleme üretimi de geçti.
