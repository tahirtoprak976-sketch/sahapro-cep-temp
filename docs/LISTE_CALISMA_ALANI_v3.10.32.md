# İş, yakıt ve masraf listelerini kullanma

İşler, Yakıt Kayıtları ve Masraflar ekranlarında aynı kayıt listesi görünümü kullanılır. Sayılar hizalıdır; arama doluyken Temizle düğmesi görünür. Tutarların, litrelerin ve muhasebe toplamlarının hesaplanması değişmez.

İş veya yakıt listesini filtreleyin, gerekiyorsa eski kayıtları yükleyin ve bir kaydı açın. Kaydın geri düğmesi veya Android/tarayıcı Geri ile döndüğünüzde aynı arama, filtre, açılmış sayfalar ve liste konumu korunur. Liste yenilendiğinde de görüntülenen sayfalar korunur. Yeni bir filtre bağlantısı kendi kapsamıyla açılır. Ana menüden listeye yeniden giriş, önceki filtreyi gizlice uygulamaz.

Masraf ayrıntısı mevcut alt pencerede açılır; Kapat ile aynı listeye dönülür. Kayıt ve güvenlik uyarıları saklanmaz. Liste konumu yalnız açık uygulama oturumunun belleğindedir; kapatıp açınca korunacağı taahhüt edilmez. Formlar, asistan mesajları ve ekler bu liste belleğine alınmaz.

Veritabanı şeması ve kayıt biçimi değişmez. Listeyi açma, arama, filtreleme veya geri dönme hiçbir mali kayıt oluşturmaz; Gemini çağrısı yapmaz.

## Ölçüm

Aynı TEST tarayıcı sınavında v3.10.31, filtreli iş kaydından listenin geri bağlantısıyla dönünce LIST_FILTERS_LOST sonucu veriyor. v3.10.32 iş ve yakıtta hem bu dönüşü hem tarayıcı Geri dönüşünü, yüklenmiş sayfaları ve kaydırma konumunu koruyor. 320/360/390/768 piksel yatay taşma kontrolü geçiyor. Fiziksel Android, gerçek WhatsApp veya canlı Gemini bu paket için denenmedi.
