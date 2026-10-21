# SOLO v3.9.49 — tek formda güvenli kaydetme

## Sorun ve sonuç

Gerçek Chromium/IndexedDB üzerinde yakıt formunda Kaydet'e iki kez art arda
basmak aynı bilgilerle iki yakıt kaydı oluşturuyordu. Kaydet düğmesi ilk
tıklamada kilitlenir; işlem sürerken ikinci olay işlenmez. Yeni yakıt, yeni
normal gider, gider formundan veresiye alış ve yeni/düzenlenen bakım bu ortak
akışı kullanır.

Gider/bakım/alış kaydı yazılıp fotoğraf aşaması başarısız olursa kullanıcıya
kaydın oluştuğu açıkça söylenir. Parasal alanlar kilitlenir; fotoğraf alanı ve
“İşlemi tamamla” düğmesi açık kalır. Aynı formdan tekrar denemek mevcut kayda
fotoğraf ekler; ikinci gider, borç, stok çıkışı veya bakım güncellemesi yazmaz.
“Kaydedilen kaydı aç” bağlantısı gerçek kayda götürür.

Kayıt henüz oluşmadan hata olursa alanlar düzenlenebilir kalır. Mükerrer kayıt
uyarısından vazgeçmek kayıt oluşturmaz ve formu açar. Sonucu alınamayan yazma
işleminde aynı işlem kimliği kontrol edilir; bulunan kayıt yeniden kullanılabilir.
Kaydedilmiş kayıt başka yerde değişmiş/silinmişse fotoğraf denemesi durdurulur;
eski form yeni tutarın üzerine yazmaz. İşlem sürerken başka ekrana geçilmişse
tamamlanan işlem kullanıcıyı eski ekranına zorla geri götürmez.

## Uygulama ve sınırlar

- Form değerleri, düğmeler/alanlar kilitlenmeden önce alınır; checkbox ve dosya
  seçimleri korunur. Hatalar görünür bir açıklamayla bildirilir.
- Yeni kayıtlar mevcut atomik DB işlem kimliğini; veresiye alış mevcut
  `request_id` korumasını kullanır. Mevcut mükerrer/onay kontrolleri korunur.
- Fotoğraf aşaması, kaydın kimliği tutulduktan sonra çalışır; mevcut SHA256
  dosya tekilleştirmesi devam eder.
- Bu kurtarma **açık kalan form içindir**. Sayfayı kapatma/yenileme sonrasında
  kalıcı bir form kurtarma kuyruğu eklenmedi. Yeni bir formdan aynı kaydı elle
  tekrar girmek için genel bir “asla mükerrer olmaz” garantisi verilmez.
- Finansal hesaplama, DB şeması (5), Saha Akışı dönüşleri, SP1 imzası ve
  şoförün patron/grup paylaşımı değiştirilmedi. Sunucu veya yeni servis yok.

## Doğrulama

- Node: 103/103 test dosyası PASS; syntax 142 dosya, SW 141 JS modülü.
- Yeni birim testleri: kayıt öncesi hata, kayıp yazma sonucu/okuma hatası,
  içerik uyuşmazlığı, fotoğraf tekrarı, değişmiş/silinmiş kayıt, bakım
  güncellemesi ve veresiye alışın vazgeçme/kurtarma yolları.
- Yeni gerçek tarayıcı suiti: dokuz kontrol grubu; hızlı çift olay, tek yakıt
  ve stok hareketi, ön işlem hatası, çevrimdışı fotoğraf tekrarı, bakım
  düzenleme, tek veresiye borcu, mükerrer uyarısında vazgeçme, başka editörün
  değişikliği, kayıp sonuç ve işlem sırasında başka ekrana geçme.
- Yedi Chromium suiti PASS: `safe_form_save`, `field_entry`,
  `work_productivity`, `business_priorities`, `review_consistency`,
  `driver_fast_share`, `driver_group_share`.

Tarayıcı denemeleri yapay verilerle çalışır; gerçek müşteri, mesaj veya AI
isteği kullanılmaz. Sürüm ve hizmet çalışanı önbelleği v3.9.49'a güncellenir.
