# SOLO v3.9.28 — Şoför bağlantısı ve gönderim merkezi

20.10.2026. SOLO statik PWA'dır; bu sürüm YZ2 veya ortak sunucu kurmaz. İşletme şeması 5 olarak kalır. Mevcut kayıtlar, SP1 kimlikleri ve imza doğrulaması korunur. Eski şoför bağlantılarıyla açılabilir; sırf bu güncelleme için yeni bağlantı gerekmiyor.

## Şoför ekranı

- Üstte Gönderim merkezi: telefonda bekleyen kayıtlar, paylaşım ekranı açılan kayıtlar ve fotoğraf bağlantısı sayısı. Fotoğraf bağlantısı sayısı diskte bütün dosyaların bulunduğu anlamına gelmez; kayıt üzerindeki kontrol düğmesi gerçek dosyaları okur.
- Kayıtlar tarih başlıkları altında gösterilir. İş, yakıt, gider ve bakım ayrı giriş sekmeleridir. Bekleyenlere git, tek kaydı paylaş ve geçmişten tekrar paylaş düğmeleri vardır.
- Yakıt fişi fotoğrafı eklenebilir. Fotoğraf önizlemeleri, hazırlama sırasında form kilidi, boyut/adet kontrolü ve sırayla küçültme vardır. Bir forma eklenmiş fotoğraflar başka kayıt türüne sessizce taşınmaz: önce kaydedilir veya kaldırılır.
- Sayılar sonlu, pozitif/sıfır ve en fazla 1 trilyon olmalıdır; zorunlu miktar/litre sıfır olamaz. Gerçek olmayan ve gelecek tarihler reddedilir. İstasyon tutarının eski şablon hatası giderildi.
- Alanlar ve seçimler taslağa hemen alınır. Taslak fotoğrafları yeni anahtar altında yazılır; yeni fotoğraflar ve taslak bilgisi saklanmadan önceki dosyalar silinmez. Eski `draft` anahtarı okunmaya devam eder.
- Hafıza veya fotoğraf saklama hatasında kayıt başarı mesajı gösterilmez; form ve eldeki fotoğraflarla yeniden deneme yapılabilir. Başarılı kaydın ardından çift dokunma ikinci kayıt oluşturmaz.
- İki sekmede kayıt listesi yazımı ayrı küçük bir IndexedDB'nin readwrite kilidiyle sıralanır; iş verileri mevcut localStorage biçiminde kalır. Yeni satırlar birleştirilir; aynı satırda çakışan değişiklik reddedilir. Diğer sekmede silinen satır tekrar paylaşım tamamlandı diye diriltilmez. **Yarım form taslağı cihazda ortaktır; aynı anda iki ayrı form doldurmak yerine tek sekmede çalışılmalıdır.**

## Paylaşma ve kurtarma

- Kayıt saklanması, paylaşım ekranının açılması ve patronun uygulamada kaydetmesi ayrı aşamalardır. WhatsApp teslim/okundu bilgisi bu uygulamada yoktur. İptal, hata ve desteklenmeyen fotoğraflı paylaşım kaydı paylaşıldı durumuna geçirmez.
- Eksik fotoğraf veya eski sürümce temizlenmiş fotoğraf referansı sessizce atlanmaz. Fotoğrafları kontrol et → yeniden seç ile onarılır. Henüz paylaşılmamış kayıt, açık onayla fotoğrafsız hale getirilebilir. Paylaşılmış kaydın fotoğrafları yenilenirken eski paketin fotoğraf sayısı korunur.
- Taslakta eksik fotoğraf varsa kayıt engellenir. Yeni fotoğraflar taslakta korunur; eksikleri yok sayma kullanıcı onayı gerektirir. Görünen fotoğraflarla devam edilir.
- Mesaj metni mevcut 3600 bayt sınırına göre parçalara ayrılır. Tek paylaşım en fazla 20 ek / 20 MiB içerir; kalan kayıtlar bekler. Tek kayıt sınırı aşıyorsa kullanıcıya küçük fotoğraflarla yeniden seçmesi söylenir. Hiçbir kayıt bölünerek yanlış fotoğraf sırasına yol açılmaz.
- Tarayıcı fotoğraf paylaşamıyorsa resimler sessizce düşürülüp yalnız metin paylaşılmaz; Chrome/Safari yönlendirmesiyle bekleyen durum korunur. Fotoğrafsız kayıtta mevcut WhatsApp metin bağlantısı yedeği çalışır.
- İmza dosyası eksikse imza sessizce atlanmaz. Dijital fiş yolu ve mevcut imzalı içerik korumaları devam eder.
- Tekrar paylaşım aynı kayıt kimliğini taşır. Patrona gelen aynı bildirimin yeniden işlenmesi yeni iş oluşturmaz. Fotoğraf değişikliği, patronda zaten kaydedilmiş kayıtların kendiliğinden güncellenmesi anlamına gelmez.
- Kayıt ve fotoğraflar 7/14 gün sonra otomatik silinmez. Paylaşılan kaydı telefondan kaldırmak açık silme onayı ister; teslimin doğrulanamadığı hatırlatılır. Tarayıcı verilerini kullanıcı/işletim sistemi temizlerse kayıp yine mümkündür; bu bir sunucu yedeği değildir. Daha önce silinmiş dosyalar geri getirilemez.
- Şoför uygulamasının güncelleme bildirimi form düğmelerini örtmez. Başka sekme yeni service worker'ı etkinleştirince açık form kendiliğinden yenilenmez; güncelleme kullanıcının düğmesiyle yapılır.

## Patronun bağlantı ekranı

Kişi, araç ve geçerlilik günü aynı bağlantının tekrar kullanım anahtarına dahildir. Gün sayısı değişirse yeni bağlantı üretilir. Oluşturma sırasında çift işlem engellenir. Yenileme eski bağlantıları otomatik iptal etmez: WhatsApp paylaşımı iptal edildiğinde şoförün elindeki bağlantı geçerli kalır. Kayıp telefon/eski bağlantı iptali Güvenlik ekranından yapılır. Geçerli bağlantılar ve bitiş tarihleri gösterilir; sırlar burada gösterilmez.

Süresi dolmuş bağlantıdan paylaşım engellenir; telefondaki kayıt korunur ve Ayarlar'dan aynı kişinin yeni bağlantısı kurulabilir. Başka kişiye ait bağlantı, telefonda önceki kişinin kaydı/taslağı varken kurulmaz. Ayrı telefon veya tarayıcı profili gerekir; eski kayıt başka kişinin adına gönderilmez.

## Patronun fotoğraf aktarımı

- Yakıt ve giderde ilk fotoğrafla sınırlı kalınmaz; tüm fotoğraflar ilgili kayda bağlanır. Veresiye giderin ilave fotoğrafları borç belgesine eklenir. Bakım ve iş fotoğrafları sıralarını korur.
- Eksik sayıda fotoğrafla gelen SP1 paketinde otomatik fotoğraf eşleştirme yapılmaz; tek işe kalan tüm fotoğrafları bağlayan genel kestirme de bu durumda çalışmaz. Uyarı tüm fotoğrafları kayıt sırasıyla yeniden seçmeye yönlendirir.
- **Fotoğraflar tam olsa bile WhatsApp'tan seçilen dosyaların sırası kullanıcı tarafından korunmalıdır.** Aynı sayıda yanlış/sırası değiştirilmiş fotoğrafın içerik kimliğini kanıtlayan protokol bu sürümde yoktur; kartlar kontrol edilerek kaydedilir.
- Yapılandırılmış şoför işlerine yalnız isteğe bağlı fiş no/tonaj eksik diye ikinci Gemini okuması başlatılmaz. SP1 aktarımı anahtar mevcutken de Gemini çağrısı yapmadan çalışır. Normal fotoğraf/OCR asistanı mevcut davranışını korur.

## Doğrulama

Sentetik verilerle gerçek Chromium/IndexedDB/Cache Storage üzerinde çalışıldı. Native paylaşım taklit edildi; gerçek WhatsApp mesajı gönderilmedi. Fiziksel Android/iPhone paylaşım paneli ve kamera izinleri bu ortamda doğrulanmadı.

- `node tests/driver-delivery.test.mjs`: eşzamanlı birleştirme, silinen kaydı diriltmeme, çakışma, bağlantı/tarih/sayı doğrulama, özel cache alanlarını pakete taşımama, yakıt→iş fotoğraf sırası ve eksik paket kestirmesi.
- `python3 tools/e2e/driver_ultimate.py`: 23/23 kontrol; kota/cache hatası, çift dokunma, iptal/hata/desteklenmeyen paylaşım, eksik fotoğraf onarımı, aynı paketle tekrar, iki sekme, kişi karışması, süre dolması, gerçek SW çevrimdışı yenileme, taslak fotoğraf kurtarma ve ek sayısıyla parçalama.
- `python3 tools/e2e/driver_import.py`: dört tür kayda 8/8 fotoğraf, anahtar varken sıfır Gemini çağrısı; bağlantı süresi değişiminde yeni kod ve önceki bağlantının geçerliliği.
- Mevcut şoför, şoför çıkışı, denetim, redteam, işletme panosu ve gerçek SW çevrimdışı panosu tarayıcı akışları.
- Node: 87/87 test dosyası. Sözdizimi: 123 dosya. SW: 122 modül.
- Üç şoför + patron işletme simülasyonu (tohum 73): 17 beklenen iş/6 yakıt, gider/bakım/maaş/hakediş/WhatsApp içe aktarma akışları, çift kayıt denetimi, 0 veri sağlığı hatası ve şifreli yedeğin ayrı tarayıcıya birebir geri yüklenmesi geçti.
- 360 px genel tarama: 131 ekran, 0 sorun.

Tarayıcı paketlerinin eski sürümlerinde sistem Chromium'u bulunmayan varsayılan Playwright binary'si yerine `/usr/bin/chromium --no-sandbox` ile başlatıldı; senaryolar veya doğrulamalar atlanmadı. Eski paketlerde sonuç metni de incelendi (bazıları başarısız kontrolde bile sıfır süreç kodu verebilir).
