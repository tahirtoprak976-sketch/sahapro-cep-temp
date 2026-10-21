# SOLO v3.9.50 — yakıt ve bakım geçmişi

## Sorun ve kullanıcıya etkisi

İş listesi tarih başlıklarıyla düzenlenmişken yakıt ve bakım listelerinde günler
ayrılmıyordu. Yakıtta yalnız basit arama vardı; bakımda arama yoktu. Bu sürüm
iki listeyi gerçek kayıt tarihlerine göre gruplar, en yeni günü üstte gösterir.
Aynı gün 30 kaydı aşsa da sayfalama o günü bölmez.

- Bugün, son 7 gün, bu ay, tüm tarihler ve özel tarih aralığı.
- Araç/personel filtreleri; yakıtta ayrıca kaynak seçimi. Bakıma ait açık,
  tamamlanan ve tüm kayıtlar seçenekleri korunur; varsayılan görünüm açıktır.
- Yakıtta kaynak, mazotu veren müşteri ve pompa; bakımda parça/servis/açıklama
  dahil arama. Arama yazıldıktan hemen sonra döneme basmak yazıyı kaybetmez.
- Uzun adlar/açıklamalar kartta okunur. Yakıt kartındaki kayıtlı tutar,
  sayaçlar, fiş ve kaynak bilgileri korunur. Bakım kartı durum, önem,
  servis/parça ve girilmiş maliyeti gösterir.
- Filtreler ve CSV bölümü açılınca uygulama, tek tek kaldırma/temizleme ve
  filtreli CSV bulunur. Sayfalama yalnız gösterimi sınırlar; CSV bütün filtre
  sonucunu kapsar. Ayrı rapor merkezi kendi filtreleriyle açıldığını belirtir.

## Özetlerin anlamı

Yakıt toplamı litre olarak gösterilir; kaynakların litreleri ayrıdır. Müşteri
mazotu, mazotu veren müşteriyle görünür. Litreler ölçülmüş motor tüketimi veya
nakit çıkışı sayılmaz; müşteri hakedişine otomatik para eklenmez. Müşterinin
verdiği yakıtta eski kirli bir TL değeri varsa liste bunu alış maliyeti diye
sunmaz. Detay kaydı değiştirilmez.

Bakımda yalnız girilmiş, sonlu ve negatif olmayan maliyetler kuruş bazında
toplanır. Boş/geçersiz maliyet sıfırmış gibi sunulmaz; kaçının eksik olduğu
yazılır. Açıkça 0 girilmiş kayıt, maliyeti girilmiş sayılır. Kayıtlı bakım
maliyeti toplamı kasa çıkışı/ödeme değildir.

Arşivdeki araç/personel adları geçmiş kayıtlarda okunur. Seçili arşiv veya
bulunamayan filtre kimliği sessizce tüm kayıtlar hâline gelmez. Tarihi eksik veya
imkânsız eski kayıtlar tüm tarihler görünümünde en altta uyarıyla gösterilir;
tarih filtresinde kapsama alınmaz. Geçersiz tarih aralığı sonuç ve CSV üretmez.
Okuma hatası boş liste/sıfır özet diye sunulmaz.

## Kapsam ve doğrulama

Bu değişiklik salt okunur listeleme/CSV katmanıdır. Yeni kayıt, fotoğraf, çift
kayıt koruması, bakım detay/düzenleme, SP1 ve WhatsApp akışları korunur. DB
şeması 5 olarak kalır; sunucu/servis kurulmaz.

- Node 104/104 test dosyası PASS; syntax 144 dosya; SW 143 JS modülü.
- Saf test: dönem/aralık ve kesişen filtreler, gerçek takvim, kaynak litreleri,
  eski kaynaklar, boş/0/negatif/geçersiz maliyetler, kuruş toplamı, değişmeyen
  kaynak verisi, tam gün sayfalama, formül enjeksiyonuna karşı CSV hücreleri.
- Yeni Chromium/IndexedDB suiti: 41 kayıtlı günün bölünmemesi, 44 kaydın tümünü
  içeren CSV ve filtreyle tek satıra inmesi; müşteri mazotu; arşiv/kayıp
  filtreler; detay bağlantıları; geçersiz gün; arama zamanlayıcısı; 320/360/768px;
  gerçek SW ile çevrimdışı açılış; okuma hatası.
- Yedi tarayıcı suiti PASS: operation_history, safe_form_save, field_entry,
  business_priorities, review_consistency, driver_fast_share, driver_group_share.
- Liste/arama/filtre/CSV denemelerinde iş verileri, audit ve taslaklar birebir
  aynı kalır. Veriler yapaydır; gerçek müşteri/mesaj/AI isteği kullanılmaz.

Sürüm ve atomik hizmet çalışanı önbelleği v3.9.50 olarak güncellenir.
