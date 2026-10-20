# SOLO v3.9.38 — sade şoför mesajı

## Kullanım

Şoför **Paketi hazırla** sonrasında **Sade mesajla paylaş · kod ayrı dosyada** seçer. WhatsApp'a okunur iş özeti ile `SAHAPRO-….sahapro.txt` aktarım dosyası ve varsa fotoğraflar verilir. Uzun SP1 satırı mesaj metninde bulunmaz. Aktarım dosyası orijinal SP1 mesajını değiştirmeden taşır; gizli bağlantı anahtarı bu dosyaya eklenmez.

Patron SAHAPRO Asistan'da aktarım dosyasını ve paketin bütün fotoğraflarını **aynı dosya seçiminde** ekler, **Asistana Gönder** der, kartları kontrol edip kaydeder. PWA paylaşım hedefi destekleyen telefonlarda dosya ve fotoğraflar SAHAPRO'ya paylaşılabilir. Aktarım dosyası seçildiğinde kayıtlar o dosyadan okunur; ayrıca yapıştırılmış mesaj yeniden işlenmez. Fotoğraflar mevcut sıralı eşleştirme ve eksik/fazla kontrolünden geçer.

## Güvenilir aktarım

SP1 kaldırılmadı; dosyaya taşındı. Mevcut HMAC imza, bağlantı iptal/süre/personel denetimleri, aynı kayıt kimliğinin tekrar yazılmaması ve patron onayı aynen devam eder. Bu dosyalar Gemini'ye gönderilmez. Değiştirilmiş imza veya bozuk dosyada metinden AI yoluyla alternatif kayıt türetilmez. Nakit yine ayrıca onay ister.

Yeni dosya, fotoğraf gibi yorumlanmaz. `.sahapro.txt` dosyası paylaşım hedefinde sohbet dışa aktarımıyla karıştırılmaz; normal sohbet `.txt` dosyası WhatsApp toplu işleme yolunu korur. Bozuk dosya, 64 KB üstü dosya ve aynı işlemde birden fazla aktarım dosyası engellenir.

## Sınırlar

Bu seçenek bir aktarım dosyası daha ekler: toplam en fazla 20 dosya / 20 MB. Paket zaten 20 fotoğraf içeriyorsa veya toplam sınır aşılacaksa sade seçenek kapatılır; daha küçük paket ya da **Kodlu mesajla paylaş · eski yöntem** kullanılabilir. Tarayıcı dosyalı paylaşımı desteklemiyorsa sade seçenek kapalı ve nedeni görünürdür. Dosya paylaşımı başarısızken otomatik olarak yalnız metin gönderilmez. İptal/hata kayıtları beklemede bırakır; tekrar aynı kayıt kimlikleriyle yapılır.

WhatsApp'ın belirli Android/iPhone sürümlerinde karışık belge+fotoğraf sunumu fiziksel telefonla doğrulanmadı. `navigator.canShare` yalnız tarayıcı desteğidir, WhatsApp'ın içeriği teslim ettiğini kanıtlamaz. Bu nedenle eski kodlu yöntem korunur; gönderen dosyanın da WhatsApp'ta bulunduğunu kontrol etmelidir. Patron dosyayı almadan yalnız sade özetten doğrulanmış kayıt aktaramaz.

## Testler

- `driver-transfer.test.mjs`: sade metin, orijinal kodun değişmeden dosyada kalması, sabit dosya ismi/içeriği, fotoğraf sırası, boyut/biçim sınırları.
- `driver_transfer.py`: iki izole gerçek Chromium/IndexedDB oturumu; native paylaşım taklit. Doğrudan tıklamayla sade paylaşım, iptal, dosyadan imzalı iş/nakit ve fotoğraf aktarımı, tekrar, bozuk dosya, birden çok dosya ve değiştirilmiş imza; gerçek service worker POST ile aktarım/sohbet yönlendirmesi; dosya sınırı/desteklenmeyen paylaşım.
- Önceki kodlu paylaşım ve fotoğraf güvenlik suitleri korunur. Gerçek kişiye mesaj gönderilmez; tüm veri uydurmadır.
