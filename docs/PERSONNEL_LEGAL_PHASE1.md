# İzin ve puantaj: ilk aşama — geçiş hazırlığı ve saf doğrulama

16.11.2026. Bu dal uygulamayı/veritabanını güncellemez. Canlı sürüm, `openDB`, DB_VERSION=7, SCHEMA_VERSION=7, mevcut personel/izin/maaş kodu ve SW değişmemiştir. Yeni modüller henüz import veya precache edilmez. İlk aşama isteğine uygun olarak migration ve JS API hazırlanmıştır; PDF, ekran ve bütün yazma yolları sonraki aşamadır. Bu kodda izinli çalışmayı engellemek, bugünkü canlı uygulamadaki bütün giriş yollarının şimdiden kilitlendiği anlamına gelmez.

## Veri ve geçiş sözleşmesi

- Mevcut gerçek depo adı `personnel`; ikinci bir `personel` tablosu açılmaz. `start_date` / `birth_date` okunabilir. Eski personel satırları yeni alanlarla topluca güncellenmez. IndexedDB şemasız nesne yapısında yeni alanlar sonraki açık kullanıcı kaydında eklenebilir; bilinmeyen tarih/bakiye 0 sayılmaz.
- Hazır v8 geçişi yalnız `izin_kayitlari` ve `puantaj_kayitlari` depolarını, `id` anahtarını ve sorgu indekslerini ekler. Puantajda da id zorunludur. Eski `personnel_events`, `work_records`, ekler ve kayıt kimlikleri değiştirilmez/taşınmaz.
- Yıllık izne ayrıca `izinHakYili` (kazanılan hizmet yıldönümünün ISO tarihi) gerekir. Bu, takvim yılı değildir. Toplam devreden bakiye ile bir hak yılının bakiyesi karıştırılmaz. Validator seçili yılın ayrı bakiyesini/parçalarını ister; farklı personel veya yıl parçalarını reddeder.
- `hakEdilenYillikIzin` ve diğer bakiye sayaçları ile `yillikFazlaMesaiSaat`, kaynak kayıtların yerine geçmez. İzin hesabında onaylı devir tarihi ve eski kayıtların bir defa sayıldığı köprü gerekir. `leave_open_days` / `leave_open_date` göz ardı edilip işe girişten tekrar hak eklenirse çift sayım olur. Eski izinlere hak yılı otomatik atanmayacak.
- `imzaliBelgeData` içine büyük base64 kopya yerine mevcut `attachments` deposundaki orijinalin kimlik/hash referansı konacak. Orijinal bytes saklanır. Yüklenen dosya tek başına ıslak imzayı doğrulamaz; iki imza insan tarafından kontrol edilir. Dosya türü/boyutu/orijinal güvenliği mevcut attachment-safety yolundan geçmeli.

Etkinleştirme sonraki sürümde: temel store'lar oluşturulduktan sonra `onupgradeneeded` içinde `upgradePersonnelLegal(db, tx, oldVersion)` çağrılır. Öncesinde `assertPersonnelLegalActivation` kapısı; ENTITY_STORES, yedek/geri yükleme kapsamları, offline ASSETS, eski olay köprüsü ve tüm yazma kapıları hazır olmalıdır. Yeni kayıtlar yedekten sessizce düşürülemez. v8 açıldıktan sonra eski v7 yazılımına veritabanını silerek dönülmez; geri dönüş kodu da v8 okuyabilmelidir. Bu nedenle ilk aşamada DB_VERSION yükseltilmedi.

## Hesap ve kilit kuralları

- Bir yıl dolmadan yıllık hak 0; yaş tabanı bu beklemeyi kaldırmaz. Tamamlanan 1–5 yıl (5 dahil) 14, 6–14 yıl 20, 15+ yıl 26; 18 ve altı / 50 ve üstü en az 20. Doğum/işe giriş eksik veya tarih geçersizse hak uydurulmaz. Yaş değişen yıldaki tarihsel hak/özel rejim ayrıca gözden geçirilmeli.
- İlk izin mutlaka 10 gün olmak zorunda değildir: örneğin 4+10 mümkün; 14 günlük hakta 7+7 kapatması engellenir. Henüz 10 günlük parça yoksa kalan seçili yıl bakiyesinde o parça için yer ayrılır.
- Hafta tatili işletme/çalışan düzeninden gelir (varsayılan kullanıcı talebindeki Pazar). Cumartesi otomatik çıkarılmaz. Dini tatilleri ve yarım günleri içeren, kapsadığı yıllar açıkça belirtilmiş takvim gerekir. Eksik yılda hesap durur. Yarım gün izni için açık politika olmadan varsayım yapılmaz. Kodda doğrulanmamış otomatik resmî/dinî takvim yoktur.
- Rapor, mazeret, ücretsiz ve yol izni yıllık bakiyeden düşmez. Evlilik/evlat edinme ve yakın ölüm için 3, babalık için 5 takvim günü temel parametresi vardır; hak sahibi/olay/belge ve daha lehe sözleşme kontrolü UI aşamasında eklenmeli.
- Yeni ve eski izin/rapor işaretleri, gece yarısını aşan vardiyanın iki gününde de kontrol edilir. İzin girişi de mevcut açık çalışmayla çakışırsa durur; geçmiş çalışma silinmez. İkame başka, izinli olmayan, uygun personel olmalı. İkamenin eski `work_records` kaydı da kendi `personnel_id` alanıyla yazılmalı; izinli kişinin zimmetinden otomatik çalışma çıkarılmamalı.
- Mola yasal asgari olarak önerilir; kullanıldığı onaylanmadan fiili çalışma kesinleşmez. Gerçekte verilmemiş mola otomatik düşülerek kanıt üretilemez. Eksik mola uyarılır, gerçek saatler azaltılarak gizlenmez.
- Günlük 11 saat üzeri gerçek çalışma kırmızı risk olarak tutulur; kaydı reddedip ihlali görünmez yapmak yerine uyarı üretilir. Fazla mesai tam haftanın 45 saat eşiğine göre hesaplanır; daha kısa sözleşmede fazla sürelerle çalışma ayrı gösterilir. Günlük limit aşımı ayrıca gösterilir; haftalık/günlük örtüşmede teknik uyarı hesabı büyük olanı gösterir, günlük aşım bulunan hafta hukuki inceleme gerektirir. Bu değerler otomatik kesin bordro/ücret hesabına aktarılmaz. Bu hesap gece çalışması, özel iş kolları, denkleştirme ve genç işçi rejimlerinin tamamı için ücret motoru değildir; devreye alma öncesi bu kapsamlar ayrılmalı.
- Yıllık 240 saat erken işletme uyarısı, 270 saat yasal limit uyarısıdır. Eksik kayıtlı yıl kesin uygun sayılmaz; yıllık sayaç eski personel kartından körlemesine alınmaz. Gerçek aşım kaydı silinmez/kırpılmaz.
- İmzalı aylık döneme yeni kayıt da eklenemez. İmzalı satır değiştirilemez/silinemez; ileride ayrı, iz bırakılan düzeltme/iptal akışı gerekir. Kontroller UI yanında ortak yazma transaction'ında da çalışmalı. Import, asistan, işler ve eski personel hareketleri bu kapıyı atlayamaz. Bu entegrasyon henüz yapılmadı.
- Ceza/hasar türü tek taraflı kesinti kabul edilmez. Avansın gerçekten ödenmiş, belgelenmiş ve aynı personele ait kaydı gerekir. Somut muvafakatli mahsupta kişi/tutar/belge/hukuki inceleme ve dönemin mahsup sınırı gerekir; genel muvafakat veya bir dosya kimliği tek başına yetmez. Saf API'ye verilen bağlam DB'den doğrulanmalı; model veya formdaki boolean yetki değildir.

## PDF ve hukuki kanıt için sonraki aşama

Gelecekteki izin talebinde “iznimi kullandım” beyanı üretilemez. Başlangıçta talep/onay; dönüşte kullanım ve bakiye mutabakatı ayrı belge amacıyla hazırlanmalı. Mutabakat yıllık izin hakkından feragat/ibraname yerine geçmez. Sadece imzalı bir talebin arşivlenmesi, iznin gerçekten kullanıldığının otomatik kanıtı sayılmaz. TC/imza ve yasal saklama kapsamları, iki imza bloğu ve mevcut PDF hattı bu aşamada bağlanacak.

## Hukuki kaynakların doğrulama durumu

Uygulanan genel parametrelerin dayanağı olarak 4857 m.41, 46, 47, 53–56, 63, 68 ve Ek m.2; tatil takvimi için 2429; ücret korumasında 4857 m.32,35,38 ve TBK m.407 gözden geçirilmelidir. 16.11.2026'da resmî mevzuat PDF'ine ve Diyanet takvimine erişim denemeleri zaman aşımı/HTTP hatası verdi. Güncel metin ve Yargıtay karar numaraları çevrimiçi doğrulanamadı; uydurulmuş içtihat veya sertifikalı takvim eklenmedi. Bu teknik taslak güncel hukuk/içtihat bakımından doğrulanmış nihai ürün olarak yayınlanamaz.

Resmî kontrol adresleri: https://www.mevzuat.gov.tr/MevzuatMetin/1.5.4857.pdf ve https://vakithesaplama.diyanet.gov.tr/ . İnternet erişimi ve somut çalışma rejimi doğrulaması tamamlanmadan otomatik bordro/ücret kesintisi açılmamalı.

## Test

Tüm mevcut Node testleri korunmuştur. Yeni saf testler kıdem/yaş, geçersiz tarih, eksik takvim, yarım tatil, hak yılı, 7+7/4+10, mazeret, çakışma/ikame, gece yarısı, dönem kilidi, mola, haftalık/günlük fazla mesai, yıllık limit, eksik yıllık veri ve belge kontrollerini kapsar. Chromium testi yalnız TEST IndexedDB'lerinde v7→v8 eklemeyi, eski nesneler ve PDF blob bytes'ının aynen korunmasını ve abort ile tam rollback'i doğrular. Yerel 200/200 Node test dosyası ve gerçek Chromium geçiş/rollback testi geçti. Tam CI taslak PR üzerinde çalıştırılır; geçmeden birleştirme yapılmaz. Gerçek işletme kaydı/yedeği/şoför bağlantısı kullanılmaz. PDF, yeni UI ve gerçek telefon bu aşamada test edilmedi.

## 16.11.2026 sonraki karar ve kaynak güncellemesi

Bu belge ilk, etkin olmayan be72cbd taslağının tarihsel açıklamasıdır. Kullanıcı daha sonra canlı entegrasyonu yetkilendirdi. Güncel kapsam, doğrulanmış mevzuat, 01.05.2026 sonrası **10 günlük** babalık izni ve yayın kapıları `PERSONNEL_LEGAL_RELEASE.md` / `PERSONNEL_LEGAL_SOURCES.json` içindedir. Yukarıdaki “kaynağa ulaşılamadı / babalık 5” notları ilk hazırlık anına aittir; güncel hüküm olarak kullanılmamalıdır.
