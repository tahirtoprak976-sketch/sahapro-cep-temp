# SOLO v3.9.60 — Mazotlu iş kaydı ve güncel hesap görünümü

## Bildirilen olay ve doğrulama sınırı

İşletme sahibi Güneş Hafriyat müşterisini ve mazot kuralını oluşturduktan sonra manuel iş kaydettiğini, iş listesinde/müşteri mazot hesabında sonucun daha sonra göründüğünü bildirdi. Açıklığa kavuşturulan yön: **Güneş bize iş/sefer karşılığında mazot veriyor**. Bizim Güneş'e malzeme karşılığı mazot teslim etmemiz değil.

Telefondaki gerçek kayıt/yedek okunmadı. Kullanıcının özel olayının kesin kök nedeni iddia edilmiyor. Araştırma ayrı bir tarayıcı profilinde uydurma TEST Güneş kaydıyla yapıldı; 75 L/sefer test değeridir, kullanıcının gerçek anlaşması olduğu varsayılmadı.

## Tekrarlanan bulgular

1. Temiz aynı-ekran testinde müşteri kuralı yaklaşık 0,20 sn'de görünür oldu; 2 seferlik iş yaklaşık 0,09 sn'de 150 L ve 0 TL olarak kaydedildi. Bu ölçüm fiziksel telefon/ağ performansı garantisi değildir. Dakikalar süren veritabanı hesaplaması tekrarlanmadı; zamanlayıcıyla sonradan mazota dönüştüren bir iş de bulunmadı.
2. **Açık kalan hesapta eski görüntü tekrarlanabildi:** A ekranında mazot hesabı açıktı. Aynı origin/DB'deki B ekranından kuralı uygulanmış iş kaydedildi. Veritabanında 150 L hemen vardı; A hâlâ eski toplamı gösteriyordu. A yenilenince 150 L göründü. Açık görünümler kayıt değişikliklerini dinlemiyordu.
3. Manuel iş formunda mevcut kuralın eşleşip eşleşmediğini ve litre sonucunu kayıt öncesinde gösteren bölüm yoktu. Sadece kayıt sırasında `applyFuelPay` çalışıyordu. Birim/tarih/kelime uyuşmazlığı bu nedenle sessiz kalabiliyordu.
4. Genel `db.put` yardımcısı transaction tamamlanmasını değil, tek isteğin `success` olayını bekliyordu. Bu, başarıdan hemen sonra transaction iptal edilirse yanlış başarı sonucuna yol açabiliyordu. Aynı test gerçek IndexedDB üzerinde iptal enjekte edilerek doğrulandı. Bu açık kullanıcının gecikmesinin kesin sebebi olarak sunulmuyor.

## Uygulanan karar ve davranış

- Manuel iş formu tarih, müşteri, miktar, birim, malzeme, açıklama ve saha/ocak seçimleri değiştikçe **ana satırın** mazot önizlemesini anında hesaplar. Kuralın miktar/tarih/birim/kelime gereksinimleri açıklanır. Önizleme iş, litre hakkı, yakıt teslimi veya cari hareket yazmaz.
- Müşteri kuralı başka açık sekmede değiştiğinde formdaki önizleme güncellenir. Forma geri dönüldüğünde ve Kuralı yenile düğmesiyle de güncel müşteri kartı okunur. Form alanları ve seçili fotoğraf yeniden yüklenmez.
- Kayıt anında güncel kural tekrar doğrulanır. Görülen önizlemeyle mali sonuç değişmişse iş yazılmadan durulur, güncel litre gösterilir ve kullanıcı yeniden Kaydet'e basar. Bildirim göndermeyen eski istemciden gelen kural değişimi de bu kontrolden geçer.
- Yalnız mazotla ödenen iş için gereksiz TL fiyat çakışması sorusu sorulmaz. Karma ücrette TL fiyat seçimi korunur. Mevcut motorun mazotun alınmış sayılmaması, yakıtın ayrıca kaydedilmesi ve TL/litre ayrımı korunur.
- Kayıtlı mazotlu iş düzenlenirken eski litre/birim oranı korunur; yeni kural geçmiş hakkı yeniden hesaplamaz. Kullanıcı açıkça başka müşteriye/birime geçerse yeni hedefte eşleşmeyen eski mazot alanları ve eski sıfır-TL mazot snapshot'ı taşınmaz; yeni fiyat uydurulmaz, gerekiyorsa iş fiyatsız kalır.
- Müşteri kartındaki mazot bölümü pano ve ayrıntılı iş dökümünden önce oluşturulur.
- `db.put` artık transaction `complete` sonrasında başarı döndürür. İptal edilen işlem için bildirim ve başarı yoktur. Normal iş, müşteri, kural, yakıt ve ilgili toplu/şoför kayıt yolları commit sonrasında yalnız **DB adı ve etkilenen depo adlarını** bildirir.
- Aynı origin ve aynı DB'deki açık İş Kayıtları listesi, müşteri listesi/kartı ve Mazotla Ödeme Hesapları listesi bu bildirimle güncel veriden yeniden çizilir. Bildirimler kısa aralıkta birleştirilir. Müşteri dönem/taşeron seçimi ve kaydırma konumu korunur; kullanıcı arama/filtre alanında yazarken yenileme bekler. Arka plandaki görünüm, bildirilen değişimi tekrar görünür olduğunda alır. Düzenleme formları, asistan, inceleme/onay ekranı, açık modal, süren işlem ve kaydedilmemiş referans litre fiyatı otomatik yeniden çizilmez.

Bu, farklı telefonlar veya farklı origin'ler arasında veri senkronizasyonu değildir. `BroadcastChannel` aynı origin/depolama bölümü içindeki modern tarayıcılarda sekmeler arası bildirimi sağlar; desteklenmeyen ortamda aynı sayfanın yerel bildirimi çalışır, diğer sekme yeniden açıldığında güncel veriyi okur. Bildirim para/iş oluşturmaz, müşteri içeriği taşımaz ve sunucuya gitmez. Eski kayıtlar topluca mazota dönüştürülmez; geçmiş incelemesi mevcut önizleme/onay akışında kalır.

## Kaynaklar

- [MDN — IndexedDB transaction complete](https://developer.mozilla.org/en-US/docs/Web/API/IDBTransaction/complete_event): transaction başarıyla commit edildiğinde `complete` oluşur. Tek isteğin başarı olayı bunun yerine geçmez.
- [MDN — Broadcast Channel API](https://developer.mozilla.org/en-US/docs/Web/API/Broadcast_Channel_API): aynı origin ve depolama bölümü içindeki bağlamlara bildirim; farklı cihaz senkronizasyonu değildir.

## Doğrulama

- `node tests/work-fuel-preview.test.mjs`: eşleşme, eksik alan, birim/tarih/kelime, ocak adı, karma ücret, müşteri değişimi, kayıtlı oran, miktar ve mali karar anahtarı; salt okunur davranış ve yenilenebilir/güvenli ekran ayrımı.
- `python tools/e2e/work_fuel_refresh.py [URL]`: müşteri + kuralı gerçek formdan açma; iki eş öncelikli TL tarifesine rağmen yalnız mazot işini sorusuz doğru kaydetme; 75→90→100 L kural değişimleri, fotoğrafı/alanları koruma, eski istemciden sessiz değişimde kayıt öncesi durma; tam bir kez 200 L/0 TL iş; açık hesap ve müşteri kartının güncellenmesi; eski 100 L oranının güncel 150 L kurala rağmen korunması; müşteri değişiminde eski mazot snapshot'ını temizleme; gerçek IndexedDB abort ve sıfır bildirim; referans taslağını koruma.
- **116/116 Node test dosyası**, **161 JS sözdizimi**, **160 SW modülü**. Önceki 17 tarayıcı suiti + eski mazot inceleme suiti + yeni kayıt/yenileme suiti: **19 suiti geçti**.

Testler yalıtılmış uydurma veriyle gerçek Chromium/IndexedDB üzerinde çalışır. Gerçek Güneş kaydı, gerçek ödeme veya Gemini servisi kullanılmaz. Yayından sonra değişen uygulama dosyaları canlı bytes ile karşılaştırılır; yeni akış ve ortak döküm gerilemesi canlı URL'de de yalıtılmış profillerle doğrulanır.
