# SOLO canlı sohbet bağlantısı

Telefonun IndexedDB kayıtları ana kaynaktır. Ayrı `SAHAPRO-SOLO` Supabase projesi yalnız AES-GCM ile şifrelenmiş talep ve yanıtları taşır. Mevcut STAGING uygulama tabloları ve YZ2 değiştirilmez. Yerel iş şeması 8 olarak kalır.

## Telefonda açılış

Mevcut Geçmiş İş Aktarımı ekranında **Canlı Sohbet Bağlantısı** bölümü bulunur; yeni menü yoktur. Önce mevcut SPAR1 bağlantısı açık olmalıdır. Operatörün bu kanal için hazırladığı SPAL1 kodu girilir. Kart ve sözleşme paylaşımı kutusu varsayılan olarak boş gelir ve yerel oturum doğrulaması gerekir. Onaylı paket yazımı ayrı, varsayılan kapalı kutudur. Kod ve şifreli tekrar yanıtları ayrı secure-transfer veritabanındadır; iş yedeği, audit veya genel meta içine konmaz.

Telefon açık, çevrimiçi, görünür ve kilidi çözülmüş olmalıdır. Açık/değişmiş form veya aktif işlem varken talepler bekler. Sürücü oturumu çalıştıramaz. Web Locks aynı tarayıcıdaki sekmeleri tek işlemde birleştirir. Bu özellik sürekli açık bağımsız bir sunucu veritabanına geçiş değildir.

## Desteklenen işlemler

`catalog`: customers, sites, vehicles, personnel, dump_sites, quarries, price_book. En fazla 50 satırlık, ID sıralı sayfalar; yalnız alan beyaz listesi. `sites.deal` gerçek iş sözleşmesini; müşterinin fuel_rules alanı müşteri yakıt kuralını gösterir. Bunlar aynı kavram değildir. Maaş, PIN, sürücü kodu, AI/API anahtarı, genel meta/audit ve dosya içeriği bu uçtan okunmaz. Yanıtlar anlık okuma zamanını taşır; sayfalar tek veritabanı anına ait toplu snapshot değildir.

`approved_packet`: yalnız ek yerel yazma izni açıkken mevcut `commitApprovedPacket` işlenir. Yeni serbest SQL/JS, genel kart CRUD veya geçmiş kayıt düzenleme yolu eklenmez. Kaynak satırı, paket özeti, mükerrer fiş, bakiye, araç türü ve OP_CONFLICT kontrolleri korunur. Peşin iş yerel kontrol kartında bekler; bu bağlantı onun Kaydet onayını vermez. Okuma izni tek başına iş/para yazamaz. Daha geniş işlemler ayrıca mevcut uygulama komutlarıyla bütünleştirilmelidir.

## Sunucu

`infrastructure/solo-access/schema.sql` yalnız yeni, ayrı SOLO projesine uygulanır. `solo_access` özel şeması API'ye açılmaz; RLS etkin, anon/authenticated şema ve fonksiyon erişimi kaldırılmıştır. Politika bulunmamasına dair Supabase INFO bildirimi burada kasıtlı varsayılan reddir ([açıklama](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)).

Tek public RPC `SECURITY INVOKER` çalışır ve yalnız service_role tarafından çağrılabilir. Bu anahtar Edge Function ortamından okunur; frontend veya operatör dosyasında bulunmaz. Fonksiyon platform JWT denetimi yerine kendi 256 bit cihaz token'ını doğrular; veritabanına yalnız SHA-256 özeti gönderilir. Kanal, etkinlik, süre, işlem ve yanıtın bağlı olduğu talep tekrar denetlenir. Tarayıcı Origin'i yalnız üretim GitHub Pages origin'i olabilir. Kimlik doğrulama yerine CORS'a güvenilmez.

Talep/yanıt ayrı AAD alanı, kanal, ID, yön ve süreye bağlanmıştır. Cihaz anahtarı olmadan token tek başına iş verisini okuyamaz veya yetkili talep üretemez. Talep süresi en fazla 24 saat (operatör varsayılan 1 saat), cihaz yetkisi 30 gündür. Süresi biten ciphertext sonraki cihaz kontrolünde silinir; cihaz hiç dönmezse fiziksel temizlik operatör bakımında yapılmalıdır. İptal, sunucuda kanal mesajlarını siler. Telefonda iptal önce yerel yetkiyi kaldırır; çevrimdışı sunucu iptali başarısız olsa da telefon yeniden veri göndermez.

## Operatör

`tools/live-access-operator.mjs` SPAR1 kodunu yalnız özel dosyadan okur. `provision` özel SPAL1 dosyası ve token özeti içeren SQL üretir; `request` yalnız desteklenen talepler için şifreli INSERT üretir; `response` şifreli sunucu yanıtını özel sonuç dosyasına çözer. SQL, bağlı Supabase aracı üzerinden doğru SOLO proje ID'sinde uygulanır. Gerçek kodlar, SQL paketleri ve iş yanıtları repoya eklenmez. Bir işin hazırlanması kayıt başarısı değildir; telefondan gelen gerçek `saved`/`review`/`HELD` yanıtı incelenir.

## Doğrulama

Node: kimliksiz/yanlış Origin/yanlış işlem, boyut sınırı, anahtarların yanıtlanmaması, AES-GCM değişiklik ve süre kontrolleri, katalog beyaz listesi. Chromium: boş izin kutuları, şifreli gerçek deal okuması, iş kayıtlarının aynen korunması, kapalı yazma izni, aktif işlem/sürücü engeli, yedekte token bulunmaması, iptal ve 360px görünüm. Canlı yeni projede yalnız sentetik kanal ile poll/respond/replay/conflict/revoke doğrulanır ve sentetik kanal silinir. Bunlar kullanıcının gerçek telefon bağlantısını doğrulamaz; ilk yerel etkinleştirmeden sonra gerçek katalog yanıtı ayrıca görülmelidir.
