# SOLO v3.9.30 — Araştırma, bulgular ve veri koruma

20.10.2026. Kaynak incelemesi gerçek IndexedDB, Cache Storage, service worker, dosya indirme ve ayrı tarayıcıya geri yükleme deneyleriyle desteklendi. Çalışma bütün sistemin veya tüm güvenlik olasılıklarının kapandığı iddiası değildir. İşletme şeması 5; YZ2, fiyat/KDV/hakediş hesapları ve şoför protokolü değişmedi.

## Araştırılan yollar

- Asistan: mesaj/fotoğraf önizlemesi, kaydetme düğmesinin durumu, güncelleme sırasında elde kalan seçimler.
- Yerel veri: `dumpAll`, tek/çok parçalı yedek, meta/sırlar, dosyalar, geri yükleme ve kurtarma kopyaları.
- Güncelleme: `controllerchange`, bekleyen worker, açık yeni/düzenleme formları ve kullanıcı tarafından yenileme.
- Ayarlar: son yedek tarihi, paylaşımın iptali, saklama izni/kota ve arşiv ZIP kapsamı.
- Regresyon: İşler filtreleri/CSV, şoför fotoğrafları, pano/offline, redteam, yedek hata matrisi ve işletme senaryosu.

## Bulgular ve yapılanlar

| Bulgu | Kanıt / önceki davranış | Son davranış |
|---|---|---|
| Bir yedek farklı anları birleştirebiliyordu | Önce müşteri tablosu okunup arada atomik yazma yapıldığında iş tablosu yeni, müşteri eski kalıyordu. `dumpAll` her tabloyu ayrı transaction'da; dosya/meta da daha sonra okuyordu. | `readSnapshot` istenen kayıt, dosya, ayar ve taslak tablolarını tek readonly transaction'da okur. `dumpAll` tüm iş tablolarını birlikte okur. Tam/parçalı/kurtarma yedeği aynı görüntüyü kullanır; parçalar üretilirken yeniden dosya listesi okunmaz. |
| Worker etkinleşmesi açık önizlemeyi yenileyebiliyordu | Eski koruma yalnız `/new` ve `#/gecmis` yolunu tanıyordu. `controllerchange` asistan/düzenleme ekranında otomatik reload başlatabiliyordu. | Worker etkinleşmesi otomatik yenilemez. Güncelle düğmesi açık mesaj/ek/önizleme, değiştirilmiş alan veya yeni/düzenleme formunda açık vazgeçme onayı ister. İşlem sürerken güncelleme durdurulur. |
| Yedek teslimi/tarihi yeterince açık değildi | Hazırlama başlamadan “Yedek alındı” audit kaydı yazılıyordu. Paylaşım panelinden dış teslim kanıtlanamaz. | Audit hazırlama ile indirme/paylaşım paneline vermeyi ayırır. İptalde son yedek zamanı ilerlemez. Başarılı handoff yöntemi/parça sayısı/şifre ve snapshot zamanı kaydedilir; dış teslim iddia edilmez. Kaynak telefonun bu handoff kaydı başka telefona restore edilmez. |
| “Tam ZIP” ekleri sessizce bırakabiliyordu | Ek toplamı 60 MB'ı aşınca veya bir dosya okunamayınca ZIP yine oluşturuluyordu. Aynı adlı iki dosyanın yolu çakışabiliyordu. | “Arşiv ZIP” tek snapshot kullanır. JSON, dizin, ZIP başlıkları ve tüm ekler 60 MiB bütçesine sığmalı; her dosya okunmalı. Aksi halde dosya indirilmez, parçalı `.sahapro` önerilir. Dizin + sıra/kimlik içeren benzersiz yollar eklenir. |
| Taslak ve saklama kapsamı görünür değildi | Henüz arşivlenmemiş PDF Blob'ları `drafts`, şoför kuyruğu ayrı localStorage/Cache alanında. Tam yedek bunları taşımıyor. | Ayarlar kapsamı ve hariç kalan PDF dosyası sayısını gösterir. İzin/kullanım/kota bilinmiyorsa sıfır veya garanti gibi sunulmaz. Arşiv ZIP/CSV şifresiz, `.sahapro` gerçek geri yükleme yolu olarak ayrılır. |

## Teknik sözleşmeler

- `readSnapshot({attachments,meta,drafts})` tüm istekleri transaction aktifken sıraya koyar; sonucu transaction tamamlanınca verir. Blob'lar base64'e çevrilmeden önce görüntü alınır. Şema/migration eklenmedi.
- `fullBackup` ve `backupParts` `coverage` bilgisi taşır. Modele `consistent_snapshot`, eklerin/taslak dosyalarının/şoför kuyruğunun dahil olup olmadığı ve dışarıda kalan PDF sayısı yazılır. Eski yedek doğrulayıcıların tanımadığı ek alanlara rağmen mevcut format/şema sözleşmesi korunur.
- Sır filtreleri korunur: Gemini/yedek parolası/PIN özeti dosyaya girmez; şoför bağlantı sırları yalnız şifreli yedekte. Test adaptörü `readSnapshot` sağlamıyorsa uyumluluk yolu kullanılabilir ama tutarlı snapshot iddiası `false` olur; gerçek uygulama yeni yöntemi sağlar.
- Aynı modülde iki yedek/arşiv başlatılması engellenir. Hazırlama veya geri yükleme sırasında işlem token'ı Güncelle düğmesini durdurur; başarı/hata/iptalde token bırakılır. Asistan/PDF okuma-kaydetme ve standart formun kaydetme düğmesi de meşgulken kontrol edilir.
- Değiştirilmiş alan izleri WeakSet'te DOM öğesine bağlıdır; eski ekranın alanı yeni ekrana taşınmaz. İşler araması/filtreleri kayıt formu gibi değerlendirilmez. Yeni/düzenleme formu için ek rota koruması vardır.
- Güncelleme bildirimi normal belge akışındadır. Yenilemeyi iptal etmek fotoğrafı/önizlemeyi bırakır; kullanıcı açıkça “Yine de yenile” derse yenilenir. Bu, bütün geçici dosyaların otomatik kalıcı kaydı anlamına gelmez.
- Yedek sonrası sadece tarih/durum öğeleri güncellenir; açık şirket formu komple yeniden çizilmez. Arşiv ZIP son geri-yükleme-yedeği zamanını ilerletmez; kullanıcı orijinal JSON ve dosyaları elle incelemek için kullanır. Otomatik geri yükleme `.sahapro` içindir.
- ZIP şifrelenmez. Ek dizini dosya-kayıt bağını ve byte sayısını taşır; iki aynı dosya adı çakışmaz. Sınır veya okuma hatasında kısmi arşiv başarı olarak indirilmez. Büyük yedek için parçalı `.sahapro` kullanılmalıdır.

## Doğrulama

`tools/e2e/research_integrity.py` gerçek Chromium/IndexedDB üzerinde:

1. Eski ayrı okumada `RESEARCH-0` müşteri + `RESEARCH-1` iş karışması yeniden üretildi.
2. 30 eşzamanlı yazma/okuma düzeninde müşteri, iş, dosya ve meta aynı sürümde kaldı.
3. Snapshot alındıktan sonra veri/dosya değiştirilse de tam ve parçalı yedek içeriği sabit kaldı.
4. Şifreli görüntü ayrı tarayıcıya tutarlı kayıt ve orijinal dosyayla geri yüklendi. Restore sırasında güncelleme kilitli; kaynak telefonun handoff metadata'sı taşınmadı.
5. Değiştirilmiş gerçek iş düzenleme formu aktivasyon ve iptalden sonra kaldı; kayıt değişmedi.
6. Gerçek asistan SP1 önizlemesi ve seçilmiş fotoğraf worker aktivasyonunda ve Güncelle'yi iptalde kaldı. Açık vazgeçme onayı yenilemeye izin verdi.
7. Aynı anda ikinci yedek başlatılmadı; paylaşım iptalinde son tarih kaldı ve kilit kalktı. Tamamlanan panel handoff'u yöntem/zamanıyla yazıldı; şirket formundaki kaydedilmemiş metin korunarak ekran güncellendi.
8. Tam çevrimdışı hazırlanan gerçek ZIP standart ZIP okuyucuyla açıldı; üç ekin tamamı benzersiz yol ve doğru byte sayısıyla bulundu. Arşiv son yedek zamanını ilerletmedi.
9. Mobil 320/390/768 px saklama paneli, sıfır Gemini isteği ve sıfır pageerror.

`tests/research-integrity.test.mjs`: tek capture çağrısı, snapshot sabitliği, sır ve kapsam filtreleri, işlem kilidinin hata sonrası bırakılması, bilinmeyen quota/izin, benzersiz arşiv yolları, büyük/eksik/okunamayan dosyada başarısızlık.

Regresyon: Node 89/89 dosya; syntax 127 dosya; SW 126 modül. İşler testinin 13 senaryo grubu, şoför 23/23, karışık şoför paketi 8/8 fotoğraf, pano ve gerçek offline pano, redteam geçti. Parçalı yedek matrisi: dört parça, 12 dosya; yanlış sıra/set, tekrar, bozuk içerik ve iki sekme kontrolleri geçti. Genel mobil tarama: 131 ekran, 0 sorun. Üç şoför + patron işletme simülasyonu (tohum 73): beklenen 17 iş/6 yakıt, gider/bakım/maaş/tahsilat/hakediş akışları, tekrar alma ve eşzamanlı kayıt kontrolleri geçti; Veri Sağlığı 0 hata/0 uyarı. Şifreli yedek ayrı tarayıcıya kayıt/dosya sayıları ve dosya byte toplamları birebir korunarak yüklendi.

## Sınırlar

- Snapshot tek bir veritabanı anını verir; farklı uygulama transaction'larına bölünmüş bir iş akışını kendiliğinden tek transaction'a dönüştürmez. Devam eden iş/fotoğraf kaydının bütün adımlarının bitmesini bekleyip yedek alınmalıdır.
- Henüz arşivlenmemiş PDF dosyaları ve şoförün ayrı telefonundaki kuyruk yedek dışında kalır; orijinaller ayrıca saklanmalı, şoför bildirimleri patron tarafından alınmalıdır. Bu sürüm yedeğe eksik dosyayı geri getirmez.
- İşletim sisteminin uygulamayı öldürmesi, tarayıcı verisini kullanıcının silmesi ve telefon kaybı önlenmez. Kalıcı saklama izni bunlara karşı sunucu yedeği değildir. `beforeunload` mobilde garanti sayılmadı.
- Fiziksel Android/iPhone, gerçek WhatsApp/Drive teslimi ve çok büyük yedeğin fiziksel telefon RAM ölçümü bu ortamda doğrulanmadı. Native paylaşım testte taklit edildi; ZIP ve yedek içerikleri gerçek dosyalardan doğrulandı.
- Koruma yeni kod çalışınca geçerlidir; eski sürümün açık sekmesini güncellemeden önce mevcut önizleme/formu tamamlayın.

## Güncel kaynak kontrolü

MDN sayfaları 20.10.2026 tarihinde doğrudan okunarak tasarımla karşılaştırıldı:

- [IDBTransaction](https://developer.mozilla.org/en-US/docs/Web/API/IDBTransaction): IndexedDB okuma/yazmalarının transaction içinde yapılması; ayrı transaction'ların ortak bir snapshot sayılmaması.
- [ServiceWorkerContainer.controllerchange](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerContainer/controllerchange_event): belgenin yeni etkin worker kazanması olayıdır; kullanıcının yenileme isteği değildir.
- [Window.beforeunload](https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeunload_event): mobilde güvenilir biçimde her zaman çalışmaz; veri koruma buna dayandırılmadı.

Kaynaklar uygulamada hatanın bulunduğunu tek başına kanıtlamaz. Hata kaynak okumaları ve yukarıdaki yerel tekrar üretimleriyle doğrulandı.
