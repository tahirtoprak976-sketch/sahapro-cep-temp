# Ekstre ve rapor tutarlılığı — v3.10.42

Cari → müşteri → Ekstre Gönder bölümündeki kısa metin ve CSV, müşteri PDF'i ve ayrıntılı müşteri raporu aynı para rollerini ayırır.

- **Tahsilat:** yalnız tahsilat türündeki borç azaltan kayıtlar.
- **Diğer azalış:** düzeltme ve diğer tahsilat dışı borç azaltan hareketler. Bunlar para alınmış gibi gösterilmez.
- **Bakiye:** hesap değişmedi; son sütundadır. Devir + borç artışı − tahsilat − diğer azalış = bakiye.

Örnek: 1.000 TL borç ve 300 TL düzeltme varsa, tahsilat0 TL, diğer azalış300 TL, bakiye700 TL görünür. İç düzeltme nedenleri müşteriye giden metin/CSV/PDF'e eklenmez.

Sıfır bakiyeli kısa ekstre artık hesabın kapandığını söylemez. Fiyatsız veya dönem dışı işler bulunabileceği açıklanır. Gerçek fazla tahsilattan doğan avans davranışı korunur; tahsilat dışı azalışla oluşan müşteri alacağı otomatik avans sayılmaz.

Geçersiz tarih veya başlangıcı bitişinden sonraki dönemle rapor/PDF/CSV oluşturulmaz. Girilen tarihler hata ekranında korunur; tarih alanını düzeltince rapor yeniden açılır. Aynı gün başlangıç/bitiş geçerlidir. Boş sınırlar mevcut tüm-dönem davranışını korur.

Bu değişiklik görüntüleme/rapor doğrulamasıdır. Şema8, kalıcı kayıt biçimi, kayıtlı bakiyeler, KDV politikası ve eski kayıtlar değişmez. Düzeltme/tahsilat eklemez veya eski kayıtları topluca düzenlemez. Fiziksel Android, gerçek WhatsApp ve canlı Gemini bu pakette denenmedi.
