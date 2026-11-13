# Aşamalı önizleme — v3.11.04 taslağı

Android esas alınarak geliştirilen, henüz yayımlanmamış çalışma.

İlk yeni metin isteğinde cihazdaki okuyucu ayrı bir Worker içinde WhatsApp
bloklarını sırayla işler. Küçük, açık iş cümlesi için önce para alanlarını boş
bırakan hızlı bir önizleme çizilir. Eski açık taslak, düzeltme, şoför kodu veya
ek varsa bu önizleme kullanılmaz. Ayrı işleyici yalnız telefondaki kayıtlardan
beslenir; modele gönderilecek bağlamı genişletmez, kayıt yazmaz.

Önizleme kaydedilemez. Tüm alanlar ve seçimler kilitlidir. Asıl model yanıtı,
mevcut doğrulama, izin/bütçe, çelişki ve görev saklama adımlarından geçtikten
sonra normal kontrol ekranı açılır. Kaynak satırları bire bir ve tekil eşleşen
aynı iş/yakıt kartlarında mevcut alan düğümleri, olay dinleyicileri bağlanmadan
önce korunur. Yinelenen kaynak, farklı kart sayısı, yeni para/belge işlemi gibi
durumlarda tam normal çizim kullanılır. Beş hassas kartın onayı değişmez.

İptal/hata/sonuç geldiğinde işleyici kapatılır; geç paketler çizilmez. Kalıcı
şema, kayıt biçimi ve geçmiş işletme kayıtlarında değişiklik yoktur.

## Henüz kanıtlanmayanlar

Bu çalışma **50 ms** ve **sıfır CLS** kabulünün geçtiği anlamına gelmez.
Kapsayıcı kaydırma alanı sabittir; fakat son kontrol panelinin eklenmesi,
sohbet yanıtı ve alt komut alanının yüksekliği ayrıca ölçülmelidir. Fiziksel
Android, gerçek WhatsApp panosu ve canlı Gemini denenmedi. Dondurulmuş
başarı ölçümleri yeni gerçek model başarısı olarak sunulamaz.

Testler: tüm kaynak dökümünde mevcut okuyucuyla aynı satırlar; kaynak
kanıtının worker aktarımında korunması; para alanlarının hızlı aşamada boş
kalması; eski tarih/yanlış plaka/gelecek iş korumaları; geç paket reddi;
gerçek Chromium Worker; model öncesi kilitli kart; model sonrası aynı alan
düğümünün korunması ve elle düzenlenebilmesi; yeni tahsilatın işaretsiz
çıkması; iptalde önizlemenin kaldırılması. Model yanıtları taklittir.
