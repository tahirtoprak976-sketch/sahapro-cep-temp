# Araç türü denetimi ve ortak sınıflandırma — v3.9.97

Bu sürüm sınıflandırma zincirini denetler; gerçek telefondaki verileri okumaz veya fiyatlarını değiştirmez. Test verisi sentetiktir. Sınırsız olası kullanıcı metninin hatasız anlaşılması iddia edilmez: belirsiz kayıt açık doğrulamaya gider.

## Doğrulanan bulgular

| Kaynak sorun | Önceki davranış | Çözüm ve kanıt |
| --- | --- | --- |
| Tür yazımları | `Kamyonet (N1)` / birleşik etiket tanınmaz | Ortak sınıf/alias tanımı; 290 büyük/küçük harf, Unicode, boşluk ve yazım varyantı |
| Belge kanıtı | `Kamyon` kelimesi `Kamyonet` içinde bulunur | Tam sözcük/alias kanıtı; doğrulanmayan model türü yeni karta taşınmaz |
| Eski TYPE tarifeleri | `vehicle_type` birebir ham metinle eşleşir, VAN grubu başka sonuç verir | Ortak tür eşleştirmesi; eski genel `Araç/Makine` tarifesi gerçek araç grubunun önüne geçmez |
| Veri kaynağı | Boş kart türünü eski işteki yanlış `vehicle_type` geçersiz kılar | Var olan araç kartı esas alınır; iş kopyası kartı ezmez |
| Belge ailesi | Plakalı forklift için karayolu belgesi istenir | Açık tür/familya kullanılır; bilinmeyen tür yeşil “tam” olamaz |
| Tür değiştirme | Asistan genel kart işlemi türü kaynakta yokken veya null olarak değiştirebilir | Kaynakta olumlu tür ifadesi gerekir; boşaltma ve açık olumsuz emir engellenir |
| Çelişkiyi çözme | Uyarı var, türü güvenle doğrulama yolu yok | Filo → Araç türlerini kontrol et: ad, plaka, ham tür, öneri ve açık onay |
| Eski önizleme | Aynı sınıfta kartın adı/revizyonu değişse de eski fiyat önizlemesi geçerli kalabilir | Fiyat onayı ilgili araç adı/türü/onayı/revizyonunu da sabitler |
| Yetim/silinmiş kart | Eski işteki tür ile araç kapsamı karşılanabilir | Eksik veya silinmiş kart kapsam dışında; neden görünür |

Değişmemiş v3.9.96 üzerinde tarayıcı karşılaştırması ilk dört somut çıktıyı doğrular: N1 sınıfı tanınmaz, Kamyon/Kamyonet kanıtı karışır, eski TYPE kuralı eşleşmez, plakalı forklift yanlış belge ailesine gider. Diğer denetimler saf testler ve gerçek IndexedDB akışlarıyla kapsanır.

## Karar ve kullanım

Tek kaynak `vehicle-type-core.js`: desteklenen türler ve eşanlamları, taşıma grubu, makine/karayolu ailesi, kanıt, öneri ve doğrulama. Kamyonet, kamyon ve tır/çekici ayrı; yarı römork/römork ve minibüs/binek karışmaz. Plakadan, araç modelinden veya iş açıklamasından taşıma grubu uydurulmaz. Belirsiz ve çelişkili ham etiket tür/grup kapsamına sessizce alınmaz. Bilinen eski tür eşanlamları okunur; bilinmeyen özel sınıf tarifeleri birbirine benzetilmez.

Filo listesindeki **Araç türlerini kontrol et**, araç kartındaki **Araç türünü kontrol et** veya fiyat kartındaki bağlantı aynı ekrana gider. Ad/plaka araması, aynı adlı/plakalı kart uyarısı, mevcut tür ve öneri görünür. Öneri yazılmaz. Gerçek tür seçilip **Türü doğrula** denir; açık ad/tür çelişkisinde ayrıca onay sorulur. Doğrulama yalnız ilgili araç kaydını ve denetim günlüğünü yazar. Son işlem mevcut Geri Al altyapısıyla geri alınabilir.

`type_review` kimlik/tür eşleşmesine bağlı açık doğrulama kaydıdır; yeni DB şeması gerektirmez. Ad veya tür değişirse geçersizleşir; eski uygulama sürümü alanı temizlemese bile okuma sırasında bu eşleşme aranır. Türü doğrulanmış ama adı farklı bir kartta açık kullanıcı kararı esas alınır. Türü genel/boş kalmış eski kartlarda açık sınıf adı geçici eşleştirme sağlar; ekranda öneri olduğu görülür.

Kart ekleme, belge okuma, asistan kart işlemi, geçmiş aktarım ve manuel düzenleme aynı tanımı kullanır. Yeni/değiştirilen tür bilinen bir eşanlamsa ortak ada dönüşür; eski karta başka bir alan için yapılan düzenleme ham türünü kendiliğinden değiştirmez. Belge modelinin türü metinde doğrulanmazsa yeni araç genel türde kalır.

## Muhasebe ve tahmin sınırları

Pasif araçların kimliği ve geçmiş işleri geçerlidir; sırf pasif oldukları için tarihî fiyat uygulaması engellenmez. Denetim ekranında pasif kartlar ayrıca işaretlenir.

Tür doğrulaması geçmiş işlerin `vehicle_type` kopyalarını, `price_snapshot` tutarlarını, hakedişleri, yakıtı, para hareketlerini ve belgeleri yeniden yazmaz. Fiyat kuralı uygulaması ayrıca önizleme ve onay ister. Yeni fiyat hesabında mevcut araç kartı kullanılır. Kilitli/hakedişli işler ile müşteri, şantiye, iş türü ve birim koşulları korunur.

Eski donmuş döküm tahminleri yeniden hesaplanmaz. Araç için açıkça girilmiş yük/ton veya depoda araca özel katsayı tür varsayımından önceliklidir. Depo yük sayımı gibi mevcut araç türünü kullanan canlı tahminler doğru tür seçimiyle değişebilir; bu, yeni bir müşteri borcu/ödeme yazılması değildir. Belge aileleri mevcut uygulama takibini düzeltir; burada yeni bir mevzuat doğrulaması yapılmadı.

## Doğrulama

- `vehicle-taxonomy97.test.mjs`: 290 yazım varyantı, eksik/yanıltıcı sınıf, kanıt, model mutasyonu/null/olumsuz emir, makine/karayolu, depo ve yük öncelikleri.
- `vehicle-price-audit97.test.mjs`: eski TYPE/grup uyumu, genel tarifeye karşı gerçek grup önceliği, eski iş kopyası, yetim/silinmiş kartlar; pasif aracın geçerli geçmişi korunur, araç kimliği/revizyonunun sabitlenmesi, şantiye/hakediş sınırları.
- `vehicle_type_audit.py`: mobil Chromium ve gerçek IndexedDB; salt okuma, ad/plaka arama, açık onay, iptal, sayfa değişiminden geç kalan onay, tam Undo, kart değişince onayın düşmesi, eski revizyon ve yazma hatasında atomiklik, gerçek kart düzenleme. İş fiyatı 3.000 TL kalır; testte eski TYPE kuralı 7.000 TL olarak doğru çözülür, otomatik uygulanmaz.
- Mevcut `price_vehicle_type.py` testi araç revizyonu değişince yeni bir önizleme açar; kaynak kimliği sabitlemesinin bilinçli sonucudur. Mevcut fiyat/finans testleri ve eski sürümden gerçek SW güncellemesi de çalışır.
- Tam CI bütün Node dosyalarını, tarayıcı paketlerini, önceki sürümlerden yükseltmeleri ve değişmemiş v3.9.96 karşılaştırmasını çalıştırır. Canlı yayın dosya hashleri ve ayrı TEST veritabanındaki tarayıcı akışıyla ayrıca doğrulanır.
