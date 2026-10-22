# Kayıt sorgulayan ve isteği takip eden asistan — v3.9.57

Kullanıcının hedefi, belirli iki müşteri adına veya cümle kalıbına çözüm eklemek yerine asistanın amacı anlayıp kayıtları sorgulaması, eksikleri sorması ve aynı isteği takip etmesidir. Bu sürüm, çevrimiçi serbest yazılı isteklere Gemini'nin gerçek fonksiyon çağrısı döngüsünü bağlar. Yeni model, sunucu veya dış hesap kurulmaz.

## Kullanıcıya görünen davranış

- Asistan ihtiyacına göre müşteri/araç/iş gibi kayıtları arayabilir, seçilen kimlikleri okuyabilir ve mevcut hesap araçlarını kullanabilir. Soruyla kayıt hazırlama aynı akıştadır; ayrıca paralel ikinci soru çağrısı yapılmaz.
- “Anladığım istek” hedefi gösterir. “Kontrol edilenler” gerçekten çalıştırılan arama/hesap adımlarını ve hataları gösterir; modelin düşünce zinciri değildir.
- Eksik bilgi, bilinen satırları koruyan bir soruya dönüşebilir. Sonraki serbest cevap, açık isteğin ilgili satırını düzeltir; diğer iş ve tahsilat satırları yeniden üretilmeden korunur.
- Bir yerel güncel istek saklanır. Sayfa yenilenince “Devam eden istek” görünür; kullanıcı devam cevabı yazabilir veya “İsteğe devam et” düğmesine basabilir. Yenileme tek başına model çağrısı veya kayıt yapmaz.
- Önceki sohbet/açık istek bağlamı paylaşımı kapatılabilir. Bu durumda görev modele verilmez; devam düğmesi bağlamın açılmasını ister.
- Yeni sohbet, sohbeti ve açık isteği aynı meta transaction'ında temizler. İş/kasa kayıtlarını temizlemez.
- Yerel basit komutlar ve çevrimdışı taslak motoru devam eder. “Açıklar mısın?” artık “aç” ekran komutuna yakalanmaz.

## Model araçları ve gerçek kayıt sınırı

`assistant-agent-core.js`: `find_records`, `get_records`, mevcut 17 hesap aracının kaydı; `prepare_plan`, `revise_draft`, `ask_user` sonlandırıcıları. Modelde yazma aracı, SQL, JavaScript, keyfi store veya keyfi ekran yetkisi yoktur. Sonlandırıcı yalnız öneri döndürür. Kayıtlar mevcut doğrulama, kontrol kartı seçimi ve gerçek Kaydet düğmesinden geçer.

Arama/okuma her çağrıda yeni yerel görüntü kullanır. Ana firma kimliği korunur; tam ad/plaka önce gelir, silinen kayıtlar çıkarılır, toplam sonuç ve kesilme bilgisi gösterilir. Alan listesi izinlidir: meta/anahtar/yedek/audit/dosya içerikleri verilmez. Genel arama en fazla 12, kimlikle okuma en fazla 8 kayıt verir. Hesap sonucu büyükse sessizce kırpılmış toplam yerine daraltma hatası döner. Mevcut başlangıç kart/facts bağlamı devam eder; yeni okuma aracı bütün iş verilerinin gizlendiği anlamına gelmez.

Sağlayıcı döngüsü bir model denemesinde en fazla 6 tur, toplam 16 çağrı ve tur başına 6 çağrıdır. Her HTTP turu mevcut atomik günlük bütçe ve izin kapısından geçer. Mevcut model/kota geçişi en fazla 5 model denemesi yapabilir; dolayısıyla 6 tur bütün model geçişlerinin birleşik üst sınırı değildir. Model parçaları, thoughtSignature ve çağrı kimlikleri sağlayıcıya aynen geri gönderilir. Bilinmeyen araç çalıştırılmaz; aynı yanıtta okuma ve sonlandırma karıştırılırsa modelden sonuçları değerlendirmesi istenir.

Araç kullanmadan doğrudan JSON/metin dönen model için eski doğrulanan çıktı yolu desteklenir. Böyle bir yeni plan, kendiliğinden yeni kalıcı native görev sayılmaz; mevcut native görevi etkiliyorsa görev koruması korunur. Fotoğraf, ses, PDF ve imzalı şoför aktarımı mevcut belge/aktarım yolundadır; bu sürüm onları yeni döngüye taşımamıştır.

## Kalıcı istek ve tekrar uygulama

`assistant-task.js`, `assistant_task_v1` meta kaydında tek istek tutar: kimlik, sohbet kimliği, revizyon, durum, kısa hedef, kullanıcı kaynak metni ve öneri. Ham araç cevapları ve dosyalar saklanmaz. Kaynak en fazla 12.000, plan JSON'u en fazla 60.000 karakterdir; sınır aşılırsa kullanıcıdan isteği bölmesi istenir.

Durumlar: `clarify` / `draft` → `applying` → `complete` / `review`; açık isteği kapatma `cancelled` olur. Atomik sohbet kimliği + görev kimliği + revizyon kontrolü, eski sekmenin yeni revizyonu onaylamasını engeller. `applying` ilk iş kaydı yazılmadan önce kalıcılaşmalıdır; bu meta yazımı başarısızsa iş yazılmaz. Kısmi seçim, kayıt hatası, bekleyen nakit veya sonuç belirsizliği `review` gerektirir. Kapanmış/inceleme/uygulanıyor görevin ham planı modele tekrar verilmez; otomatik yeniden uygulanmaz.

Bu, bütün kayıt gruplarını tek transaction'a çevirmez. Mevcut işlem başına transaction, mükerrer, kaynak, undo ve kısmi hata mekanizmaları sürer. Çökme sonrası `applying` kalırsa kayıtlar elle incelenir. Seçilmemiş kalan kartlar incelemeden sonra ayrı yeni istek olarak hazırlanır; tüm eski grup yeniden oynatılmaz. Yeni bağımsız native isteğin ayrı işlem kimliği vardır; aynı içerikli bağımsız isteklerin genel olarak aynı işlem olduğu varsayılmaz.

## 20 litre mazot örneği

İlk teslimat cümlesi `quote` içinde birebir korunur. Sonraki fiyat/tarih cevapları `details_quotes` içinde sırayla birebir tutulabilir (tek `details_quote` da uyumluluk için desteklenir). Her alıntı kullanıcı kaynağında, teslimattan sonra ve sırasıyla bulunmalıdır; modelin kendi ürettiği fiyat/tarih kanıt olmaz. Yön, litre, müşteri ve fiyat mevcut teslimat doğrulamasından geçer. 20 L + litre fiyatı 50 TL örneği, onaydan sonra tek depo çıkışı ve 1.000 TL müşteri borcu üretir; şirket aracı yakıtı/iş/tahsilat üretmez. Alış fiyatı satış fiyatı sayılmaz. Belirsiz veya desteklenmeyen ifade kullanıcı kontrolünü gerektirir.

Mesajı okurken daha önce yapılan otomatik kendi-depo müşteri/saha kurulumu kaldırıldı. Salt sorgu veya başarısız model çağrısı işletme kartı açmaz. Yeni depo kurulumu mevcut ayar ekranından yapılır; kurulmuş depoların hesabı devam eder.

## Doğrulama ve sınırlar

Yeni Node testleri: izinli alan araması/ana firma/silinmiş kayıt/boyut/tarih, güncel görüntü, değişmez hedef satır yamaları, native sağlayıcı turları/çağrı kimliği/imza, tanımsız araç/karma sonlandırma, kota/izin, görev revizyonu/sohbet kimliği/ilk yazma kilidi/kapalı görevi yeniden uygulamama. Mazot ve komut yönlendirici testleri devam alıntıları ve “açıkla” ayrımını içerir.

`tools/e2e/assistant_agent.py`: gerçek Chromium + IndexedDB + SW, yapay müşteriler ve deterministik native fonksiyon çağrıları. Arama → depo hesabı → soru; yenileme → fiyat/tarih cevabı → aynı görev; iki gerçek sekmede eski onay reddi; tek 20L/1.000TL depo/cari çifti; gerçek bakiye sorgusu; bağlam kapatma; 6 tur sınırı; ikinci iş düzeltmesinde diğer iş/tahsilatın korunması; görev saklama/kilit hatalarında sıfır iş yazımı; kısmi seçimde review; diğer sekmede yeni sohbetle geç yanıtın reddi. Mevcut 10 tarayıcı paketi de regresyona alınır.

Genel Gemini doğruluğu bu testlerle ölçülmüş değildir: model yanıtları taklittir, gerçek API anahtarı veya gerçek kullanıcı kaydı kullanılmaz. Bu altyapı ChatGPT ile aynı kapasite ya da her talebin anlaşılacağı garantisi değildir. Desteklenen işlem şeması, kaynak kanıtı, mevcut araçlar ve kullanıcı onayı sınırdır. Aynı anda bir native istek saklanır; çoklu görev arşivi, dosyalı göreve devam ve forma elle yapılan her değişikliğin otomatik saklanması bu sürümde yoktur. Yerel açık görev aynı telefon/profil kapsamındadır; iki farklı telefon arasında senkron değildir.

Yerel doğrulama: 113/113 Node test dosyası, 153/153 JS sözdizimi ve 152 SW modülü. Yeni native araçlı tarayıcı paketi ile mevcut 10 regresyon paketi geçti. Canlı Pages dosya ve tarayıcı doğrulaması dağıtımdan sonra ayrıca kaydedilir; gerçek Gemini dil başarısı bu sayılara dahil değildir.
