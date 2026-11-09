# KDV ve cari — onaylanmış işletme kararı

**09.11.2026, işletme sahibinin açık seçimi:** “KDV yalnız hakedişte ayrıca seçilip kesinleştirilince cariye eklensin; öncesinde hariç bakiye gösterilsin.” Bu karar, önceki brüt cari önerisinin yerine geçer.

- Hakedişe girmemiş fiyatlı işin carisi ana paradır. KDV dahil tarife varsa yalnız kayıtlı oranla nete ayrılır; %20 tahmin edilmez. KDV hariç fiyatın ana parası zaten kayıtlı tutardır.
- Yeni hakedişte **KDV ekle** başlangıçta seçili değildir. Seçilirse kayıtlı oranlar kullanılır. Seçilmezse ana para üzerinden taslak hazırlanır. Cari ancak açık kesinleştirme onayından sonra hakedişin saklanan toplamını alır.
- Örnek: 6 × 4.500 TL hariç iş ve 20.000 TL tahsilat için önce bakiye **7.000 TL**; KDV seçilmeden kesinleşirse **7.000 TL**; kayıtlı %20 seçilerek kesinleşirse **12.400 TL**.
- Dahil fiyat için 3 × 1.200 TL, kayıtlı %20: ana para **3.000 TL**. KDV seçilmezse 3.000; seçilip kesinleşirse 3.600 TL. İkinci KDV eklenmez.
- Tahsilat gerçek paradır; ana para/KDV paylarına tahminen dağıtılmaz. Hakediş PDF’inde gösterilen müşteri tahsilatı belirli hakedişe yapılmış ödeme sayılmaz.
- Önceden kesinleşmiş hakedişlerin, tahsilatların ve cari hareketlerin saklanan tutarları **değişmez**. Eski taslak da yeniden fiyatlanmaz: kesinleştirme onayı kayıtlı ana para + KDV + toplamı açıkça söyler. KDV istenmiyorsa eski taslak iptal edilerek yeni seçimle hazırlanır.
- İş kayıtlarına toplu düzeltme, veri dönüşümü, şema değişikliği veya sıfırlama yoktur. Yeni taslak, mevcut `kdv_rate`, `kdv_included`, `source_price_snapshot` alanlarını kullanır; kaynak fiyatın aslı korunur. İşin fiyat kilidi yalnız mevcut açık kesinleştirme işleminin parçasıdır.
- Bu karar salt okunur cari hesabını etkiler: eski **hakedişe girmemiş dahil fiyatlı** işlerin cari görünümü nete iner. Kesinleşmiş hakedişler korunur. Bu, sahibin seçtiği hesap politikasıdır; işin kayıtlı fiyatı değiştirilmez.
- Oran/temel eksik veya kilit/bağlantı çelişkili eski kayıtta fiyat tahmin edilmez; bilinen kayıtlı tutar kontrol uyarısıyla korunur. Yeni hakedişte belirsiz dahil fiyat engellenir. Nete çevirme tam kuruşluk birim tarifesiyle aynı toplamı vermezse otomatik farklı fiyat yazılmaz; tarife kontrolü istenir.
- Müşteri PDF özetinde dönem deviri + caride ana para + kesinleşen hakediş KDV’si + diğer cari hareketler − tahsilat = dönem sonu bakiye. Dönem cari tarihleriyle hesaplanır; farklı dönem işlerine ödeme/KDV ataması yapılmaz.

%0 geçerli kayıtlı orandır. Fatura numarasının yokluğu, ücretsiz iş, %0 KDV veya tahsilat anlamına gelmez. Genel kâr/maliyet `workAmount` hesabı değiştirilmemiştir; net politika yalnız müşteri cari yolundadır.
