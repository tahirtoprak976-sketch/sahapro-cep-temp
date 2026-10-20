# SOLO v3.9.40 — paylaşım reddinde indirme yolu

## Bildirilen hata

Telefonda `Paylaşılamadı: Permission denied` görülüyor; kullanıcı WhatsApp/alıcı ekranının hiç açılmadığını doğruladı. Bu, native paylaşım ekranına geçişin reddedildiğini gösterir; cihazın kesin ret nedeni ölçülmedi. ZIP biçiminin o telefonda kesin engellendiği iddia edilmez.

[MDN share() hata tanımı](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share#exceptions), NotAllowedError için Permissions Policy, geçici kullanıcı etkinliğinin bulunmaması veya dosya paylaşımının güvenlik gerekçesiyle engellenmesi gibi farklı nedenler sayar. Mevcut çağrı hâlâ doğrudan yeni düğme tıklamasında, öncesinde await/ağ/ZIP üretimi olmadan yapılır. Tarayıcının izin denetimi devre dışı bırakılmaz; dosya türü gizlenmez.

## Yeni yol

Paket ekranında **Paketi indir · WhatsApp’tan belge gönder** bulunur. Native paylaşım desteklenmese veya Permission denied/NotAllowedError ile reddedilse bile önceden hazırlanmış aynı `.sahapro.zip` dosyası bu düğmeden indirilebilir. Ret sonrasında açıklama ve indirme düğmesi öne çıkar. Otomatik indirme veya sessizce başka paylaşım yolu açılması yoktur; kullanıcı ayrıca düğmeye basar.

Telefonda WhatsApp → alıcı → ataç → **Belge** → İndirilenler’deki SAHAPRO paketini seçip gönderin. Patron tek dosyayı Asistan’a ekler. İş, fotoğraflar ve imzalı kod aynı dosyadadır; uzun kod mesajda görünmez.

İndirme **gönderildi/teslim edildi sayılmaz**. Kaynak kayıtlar ve fotoğraflar değişmez; kayıtlar beklemede kalır. Aynı kayıtları tekrar paylaşmak aynı kimliklerle yapılır. İndirme girişiminin başlatılması, tarayıcıda dosyanın başarıyla kaydedildiğinin kanıtı değildir; ekran bu yüzden “indirme isteği açıldı” der. İndirme başlamazsa uygulamayı doğrudan Chrome/Safari’de açıp deneyin. Bu da gerçek cihazda doğrulanmış bir başarı garantisi değildir.

İndirme öncesinde kayıt ve bağlantı anlık görüntüsü/süre denetimi yeniden yapılır. Başka sekmede değişen/silinen kayıt veya değişen bağlantı varsa eski hazırlanmış paket indirilmez. Aktif native paylaşım sürerken indirme düğmesi de kilitlidir.

## Testler

`driver_share_recovery.py`: iki izole Chromium/IndexedDB oturumu, taklit native NotAllowedError/Permission denied/AbortError, gerçek tarayıcı indirmesi. İndirilen dosyanın patrona yeniden yüklenmesiyle orijinal kimlikte iş ve fotoğraf onaylanır. Synchronous ve Promise retleri, otomatik indirme olmaması, değişmeyen bekleyen kaynak kayıt, Web Share hiç bulunmadığında aynı baytların indirilebilmesi, değişen kayıt/bağlantıda indirme engeli ve 360 px taşma kontrol edilir.

Cihazdaki native paylaşım engelinin kalktığı iddia edilmez. Gerçek Android/iPhone WhatsApp Belge gönderimi bu ortamda yapılamadı. Amaç izin engeline bağlı kalmadan aynı paketi dışarı alabilmektir. Gemini, DB şeması, finans hesapları ve aktarım biçimi değişmedi.
