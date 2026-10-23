# SOLO v3.9.63 — Telefona güvenli geçmiş iş aktarımı

Bu sürüm, birlikte kontrol edilmiş geçmiş işlerin kullanıcıya bir bağlantıyla
gönderilmesini sağlar. Bağlantı açıldığında içerik telefonda çözülür ve mevcut
**Geçmiş İş Aktarımı** önizlemesine gelir. Son kontrol ve kayıt onayı kullanıcıdadır.
Sunucu kurulumu, yeni harici hesap veya sürekli çalışan servis gerektirmez.

## Kullanıcı akışı

1. Gerçek kayıtların bulunduğu SOLO uygulamasını/tarayıcısını güncelleyin.
2. **İşler → Geçmiş İş Aktarımı → Bu Telefonu Eşleştir** düğmesine basın.
   Yönetici kilidi açıksa yeniden doğrulama istenir.
3. **Kodu Kopyala** ile eşleştirme kodunu bu sohbete gönderin. Kopyalama engelliyse
   kod seçilir veya **Kodu Dosya Olarak İndir** kullanılabilir. Kodda iş kayıtları yoktur.
4. Eski mesajlar 10–20 satırlık gruplarla incelenir; müşteri, tarih, araç, miktar,
   geçmiş fiyat/KDV ve ödenmiş olup olmadığı teyit edilir. Belirsizler uydurulmaz.
5. Hazırlanan şifreli paketin yayımlanmasından sonra gönderilen bağlantıyı
   **eşleştirdiğiniz aynı SOLO uygulamasında/tarayıcıda** açın. Harici tarayıcı ayrı
   depolama kullanıyorsa bağlantıyı kopyalayıp SOLO'daki kutuya yapıştırın.
6. Yeni kart eşleştirmelerini, fiyatı ve son onayı kontrol edin. Fiyat bilinmiyorsa
   ayrıca fiyat bekliyor onayı gerekir. Kaydetmeden önce tam yerel kurtarma yedeği
   alınır; yedek alınamazsa hiçbir satır yazılmaz.

Şifreli dosya da aynı ekrandan seçilebilir; dosyayı aldıktan sonra açmak için
internet gerekmez. Bağlantıdan ilk indirme için internet ve Pages yayınının
tamamlanmış olması gerekir. Dosya henüz yayımlanmamışsa tekrar deneme mesajı çıkar.

## Gönderim aracı ve yayımlama

Kaynak mesaj ve iş JSON'u depo **dışında** tutulur. Araç yalnız şifreli paketi
`data/transfers/<rastgele-uuid>.json` olarak üretir:

```sh
node tools/create-secure-transfer.mjs \
  --pair-file /tmp/ozel/eslestirme.txt \
  --input /tmp/ozel/teyitli-isler.json
```

İsteğe bağlı `--days 1` … `--days 7`, `--out-dir`, `--base-url` vardır. Varsayılan
süre 7 gün, hedef mevcut SOLO GitHub Pages adresidir. Araç dosya yolu, kısa alıcı
kimliği, süre ve yayımdan sonra kullanılacak bağlantıyı verir; özel anahtar üretmez,
mevcut dosyanın üzerine yazmaz, kaynak mesajı konsola dökmez.

Yalnız üretilen şifreli JSON incelenip commit/push edilir ve Pages yayını
doğrulanır. Açık kaynak JSON'u, kullanıcı yedeği ve eşleştirme dosyası **yayımlanmaz**.
`tests/secure-transfer-publication.test.mjs` bu dizinde yanlışlıkla düz kaynak veya
anahtar dosyası bulunmasını reddeder. Bu sürümle hiçbir gerçek teslim paketi
oluşturulmadı/yayımlanmadı; ilk paket için kullanıcının eşleştirme kodu gerekir.

## Güvenlik ve sınırlar

- **Cihaza bağlı şifreleme:** WebCrypto ECDH P-256 + HKDF-SHA256 + AES-256-GCM.
  Her pakette yeni geçici anahtar, 16 bayt salt ve 12 bayt IV kullanılır. Biçim,
  paket/alıcı kimliği, zaman, algoritma, açık anahtar, salt ve IV, GCM AAD'sine bağlıdır.
  Dosyanın SHA-256 özeti bağlantıda ayrıca kontrol edilir.
- **Özel anahtar:** Dışarı aktarılamayan `CryptoKey`, iş DB'sinden ayrı,
  `<iş-db-adı>_secure_transfer` IndexedDB'sinde saklanır. İş yedeklerine, bağlantıya,
  GitHub'a ve sohbete çıkmaz. Aynı anda açılan sekmeler tek anahtarda birleşir.
  Telefon/tarayıcı değişimi veya tarayıcı verisinin silinmesi yeniden eşleştirme
  gerektirir; normal yedek eski şifreli teslimleri başka telefonda açtırmaz.
- **Kaynak güveni:** Uygulama yalnız kendi origin'i ve uygulama yolu altındaki
  sabit teslim dizininden indirir; başka URL, yönlendirme, çerez ve referrer
  gönderimi engellenir. GitHub depo/yayın yetkileri ve HTTPS güvenilir kabul edilir.
  Eşleştirme kodu açık anahtardır: tek başına gönderen kimliğini kanıtlamaz.
  Özellikle dışarıdan seçilen dosyaların içeriği kullanıcı tarafından incelenmelidir.
  Aynı origin'deki kötü amaçlı koddan/XSS'ten veya ele geçirilmiş telefondan koruma
  iddiası yoktur. GitHub Pages'de aynı kullanıcıya ait farklı depo yolları ayrı
  tarayıcı güvenlik origin'i değildir.
- **Açık metaveri:** Rastgele dosya adı, alıcı açık anahtar özeti, dosya boyutu,
  zamanlar ve geçici açık anahtar görünür. Müşteri/araç adları ve iş içeriği şifrelidir.
  Git geçmişinden dosya kaldırılması bütün kopyaların silinmesini garanti etmez.
- **Süre:** Uygulama 1–7 gün arası paket süresini ve telefon saatini kontrol eder.
  Bu, sunucuda geri çekme veya kriptografik kendini silme değildir. Daha önce çözülmüş
  kopyalar geri alınamaz; saat denetimi sunucusuz yapıldığı için cihaza dayanır.
  Eşleştirmeyi kaldırmak yerel özel anahtarı ve o ekrandaki önizlemeyi kaldırır;
  kaydedilmiş işleri silmez. Başka sekmede önceden açılmış içerik geri çekilemez.
- **Boyut:** En çok 2 MB açık içerik/1000 satır; en çok 3 MB şifreli dosya.
  Başlık ve akış sırasında indirme sınırı, 20 saniye istek zaman aşımı vardır.
  Dosyalar SW uygulama önbelleğine eklenmez, istek `no-store` kullanır.
- **Kayıt:** Bağlantı otomatik iş/cari oluşturmaz. Mevcut kontrollü içe aktarma;
  otomatik yedek, aynı transaction'da yeniden doğrulama, tekil kaynak satırı,
  mükerrer iş ve silinmiş kaynak için tombstone kontrollerini korur. Eşzamanlı iki
  aktarım tek kayıt grubu oluşturur. Bekleyen indirme/kayıt sırasında güncelleme
  ve aynı ekrandan ikinci aktarım engellenir.
- **Kapsam:** Yalnız `SAHAPRO_HISTORY_V1` içindeki ödenmemiş/hakedişe alınmamış işler
  ve açık onaylı Depo Tankı yakıt çıkışları. Yakıt başlangıçta seçili değildir;
  tarih sıralı stok yeterliliği ayrıca denetlenir. Geçmişte ödenmiş işler, tahsilat,
  hakediş, mazotla ödeme anlaşması ve fotoğraf eki bu bağlantıyla aktarılmaz.
  Bugünkü fiyat/mazot kuralı geçmişe sessizce uygulanmaz.
- **Teslim kanıtı:** Gönderen, kullanıcının bağlantıyı açtığını/kaydettiğini uzaktan
  göremez. Kullanıcı ekrandaki sonucu bildirir. Bu özellik tam uzaktan yönetim,
  cihazlar arası senkronizasyon veya şoför sunucusu değildir.

## Doğrulama

- `node tests/secure-transfer.test.mjs`: 13 senaryo; doğru/yanlış anahtar,
  sahte kimlik, bozulmuş içerik/başlık/özet, süre, boyut, origin/yol, 404,
  izin verilen geçmiş alanları, fiyat/KDV ve mükerrer/tombstone kontrolü.
- `node tests/secure-transfer-publication.test.mjs`: yayımlama gizlilik koruması.
- `python3 tools/e2e/secure_transfer.py [uygulama-adresi]`: gerçek Chromium ve
  IndexedDB, CLI ile üretilmiş sentetik paket. Yenilemede anahtarın korunması,
  eşzamanlı eşleştirme, bağlantı önizlemesi, kullanıcı iptali, gerçek IDB yazma
  hatasında tüm iş/audit geri sarması, yedek hatasında sıfır yazma, eşzamanlı
  aktarım, KDV/fiyat, çift kayıt ve tombstone koruması, farklı tarayıcı reddi,
  değiştirilmiş dosya, bekleyen indirme/güncelleme kilidi, çevrimdışı dosya açma,
  eşleştirme kaldırma ve 390px taşma denetimi.

Tarayıcı suitinde yalnız teslim HTTP yanıtı test paketiyle doldurulur; şifreleme,
CLI, kullanıcı ekranı ve IndexedDB işlemleri gerçektir. Gerçek kullanıcı verisi,
fiziksel telefon veya gerçek bir kullanıcı teslimiyle henüz denenmedi.

Son ağaç doğrulaması: **119/119 Node test dosyası**, 164 JS sözdizimi dosyası ve
163 SW modülü geçti. `secure_transfer.py`, `customer_snapshot.py` ve
`transaction_errors.py` yerelde geçti. Gold mesaj kümesi 80 mesajda 369 alanı
doğru buldu; 756 mutasyonda sessiz yanlış 0. Önizleme üretimi depolama adı
izolasyon denetimini geçti.
