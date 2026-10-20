# SOLO v3.9.43 — kodlu patron aktarımı için hızlı hazırlık

## Sorun ve değişiklik

v3.9.42, patron aktarımı önizlemesini açmadan önce dosyalı alternatifleri de
hazırlıyordu: fotoğraflar ZIP içine kopyalanıyor, ardından fotoğraflı PDF çizilip
belge fontları yükleniyordu. Kullanıcı ana kodlu mesaj yöntemini seçse bile bu
işler tamamlanmadan önizleme açılmıyordu.

Kodlu mesaj ve özgün fotoğraflar için bu hazırlık kaldırıldı. Dosyalı alternatifler
“Dosyayla aktarım seçenekleri → Dosya seçeneklerini hazırla” ile açıkça istenir.
Hazırlık paylaşım API'sini çağırmaz; kullanıcı hazır olduktan sonra yönteme ayrıca
basar. Böylece native paylaşım taze tıklamada kalır. Hazırlık sırasında çift tık
ve kapanış kilitlenir; başlangıçta ve tamamlandığında kaynak kayıt/bağlantı kontrolü
uygulanır. Her gerçek gönderimde ve indirmede mevcut kontroller yeniden uygulanır.

PDF üretimi hata verirse kodlu aktarım ve başarılı hazırlanmış diğer alternatifler
kullanılabilir. İzin reddi halinde otomatik dosya hazırlama veya indirme yapılmaz.
Kullanıcı isterse açılan alternatifler bölümündeki hazırlama düğmesini kullanır.

SP1 biçimi, HMAC, kimlikler, nakit bildirimi, fotoğraf sırası, tekrar kontrolü,
patron onayı ve gruba yalnız iş özeti paylaşımı değişmez. DB şeması değişmez.
Gerçek telefonlarda bir hız yüzdesi veya WhatsApp teslimatı ölçülmedi.

## Doğrulama

- Node: 97/97 test dosyası; sözdizimi 137 dosya; SW listesi 136 modül.
- driver_fast_share: ana gönderimde sıfır File.arrayBuffer çağrısı ve sıfır PDF
  font isteği; imzalı kod + özgün fotoğraf + nakit korunur. Ağır alternatifin
  yalnız açık istekte başlaması, çift tık kilidi, ayrı native tıklama, PDF hatası,
  izin reddi ve değişmiş kayıt kontrol edilir.
- driver_journey ve driver_group_share: ana gönderim, tekrar, depolama hatası,
  bağımsız grup paylaşımı ve değişmiş kayıt/bağlantı kontrolleri.
- driver_pdf, driver_share_recovery, driver_transfer, driver_bundle: mevcut dosya
  alternatifleri, gerçek dosya içe aktarımı, bozuk paket/yanlış imza ve izin reddi
  kurtarması. Native paylaşım taklit edilir; gerçek gruba gönderim yapılmaz.

Sürüm ve SW önbelleği v3.9.43 için yenilendi.
