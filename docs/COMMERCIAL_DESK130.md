# Hakediş ve Tahsilat Masası — v3.10.30

**Finans → Genel müşteri alacağı tutarına dokun → Hakediş ve Tahsilat Masası** veya **Hakediş → Hakediş ve Tahsilat Masası**.

1. İş başlangıç ve bitiş tarihlerini seçip **Dönemi uygula** düğmesine dokunun. Bu seçim iş hazırlığı sayılarını etkiler. Tarihi eksik / geçersiz işler ayrıca kontrol listesine girer.
2. Üstte eksik/kontrolü olan, hazır işi olan, taslağı bekleyen, açık TL alacağı ve ödeme sözü olan müşteri sayıları görünür. Aynı müşteri birden fazla sayıya dahil olabilir; üst sayılar arama filtresinden etkilenmez.
3. Müşteriyi adı, ana firma adı veya telefonuyla arayın. Takip türünü seçin ya da üst sayılardan birine dokunun. Her müşteri ayrı borçludur; ana firma ve taşeron bakiyeleri toplanmaz.
4. Satırdaki öncelikli düğmeyi kullanın: önce iş eksikleri/kontrolü, sonra gecikmiş veya geçersiz ödeme sözü, taslak hakediş, hazır işler ve tahsilat takibi. **İş hazırlığı** bağlantısı doğru müşteri ve seçilen dönemi taşır.
5. **Güncelle**, filtreleri ve yazdığınız tarih alanlarını koruyarak kayıtları ve ödeme sözlerini yeniden okur. Uygulamaya dönüşte de okuma yenilenir. Dönemi değiştirmek için ayrıca **Dönemi uygula** gerekir.

**Kapsam ayrımı:** iş sayıları seçili dönem; taslak hakedişler, kayıtlı TL bakiye ve ödeme sözleri tüm tarihler içindir. Tüm tarihlerde bekleyen taslaklar açılabilir. Bir taslağa ayrılmış iş yeniden hazır sayılmaz. Sıfır bakiyesi olsa da eksik işi veya söz kaydı olan müşteri listede kalır. Aktif müşteri bağlantısı bulunmayan işler ayrıca kaynak bağlantılarıyla uyarılır.

**Para kuralları:** bakiye mevcut cari hesabından gelir; taslak toplamı ikinci kez borca eklenmez. KDV yalnız hakedişte ayrıca seçilip kesinleştirilince cariye eklenir. Ödeme sözü para değildir; boş / geçersiz söz tutarı sıfır olarak uydurulmaz. Pozitif bakiyesi kalmamış müşteride eski söz, otomatik “sözünü tutmadı” sayılmaz; güncelliği kontrol edilir. Genel tahsilat bir hakedişe ödeme olarak atanmaz. Mazot litre hesabı TL alacağına katılmaz. Fiyat veya fiş eksikliği kendiliğinden düzeltilmez.

Bu masa kayıt/şema eklemez; ödeme sözü, hakediş, tahsilat veya eski kayıtlar üzerinde otomatik yazma yapmaz. Kayıtlar ve tahsilat ayarı aynı salt okunur anlık görüntüden alınır. Son işlemler mevcut ekranlarının onaylarıyla yapılır.

Test sınırı: takma adlı/sentetik veriyle Chromium ve IndexedDB ölçülür. Gerçek Android, WhatsApp, gerçek müşteri mutabakatı ve gerçek zaman kazancı bu testlerle ölçülmez. Bu paket canlı Gemini çağrısı yapmaz.
