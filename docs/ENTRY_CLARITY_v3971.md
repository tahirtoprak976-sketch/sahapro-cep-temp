# SOLO v3.9.71 — Daha açık, daha güvenli iş başlangıcı ve raporlar

## Redteam → seçenekler → karar

Amaç menüleri veya muhasebeyi yeniden kurmak değil; yanlış anlamaya ve veri
kaybına yol açan dar noktaları düzeltmek.

| Bulgu | Seçilen düzeltme | Seçilmeyen yaklaşım |
|---|---|---|
| Müşteri kartından veya mesajdan yeni iş açmak eski iş taslağını sessizce geçebiliyordu. İlk düzenleme eski taslağın üzerine yazıyordu. | Taslak varsa tümünü korumak veya açıkça yeni başlangıçla değiştirmek; alanları karıştırmamak. | Otomatik birleştirme, sessiz silme veya farklı müşterinin açıklama/fiyatını yeni işe taşıma. |
| Yeni müşteri başlangıcı yanlışlıkla “yarım kalan taslak” diye sunuluyordu. | Gerçek kaynak ayrı etiketlenir: saklanmış taslak, müşteri, mesaj veya Saha Akışı. | Her ön dolumu taslak diye adlandırma. |
| İlk şantiye listesi ile müşteri değişimindeki liste farklıydı; veritabanının reddedeceği başka müşterinin/sahipsiz şantiyeleri gösteriyordu. | Her iki yerde aynı kesin müşteri ilişkisi; müşteri seçmeden şantiye açılmaması. | Kaydetme denetimini gevşetme veya mevcut şantiyelerin sahibini topluca değiştirme. |
| Aynı adlı alt müşteriler seçimde ayırt edilemiyordu. | Mevcut ortak etiketle ana firma adını da gösterme; kimlikler değişmez. | Otomatik müşteri birleştirme veya yeni bir tekilleştirme sistemi. |
| Cari hareket raporu, daha geniş müşteri bakiyesi gibi okunabiliyordu; boş fiyat sıfır gibi görünüyordu. | Kaydedilmiş cari hareket kapsamını, fiyat durumunu, TL ve litreyi açıkça ayırma. | Hesapları tek toplamda birleştirme veya mali kuralları değiştirme. |
| İç düzeltme gerekçesi müşteri raporuna taşınabiliyordu. | Mevcut müşteri ekstresi görünürlük kuralını rapor çıktısında yeniden kullanma. | Özel kaynak metnini silme veya genel raporlardan kaldırma. |
| Finans içindeki bazı bağlantılar altta “Daha Fazla” seçimini yakıyordu. | Yalnız bölüm eşlemesini düzeltme; altı sekme ve yollar değişmez. | Yeni menü hiyerarşisi veya kapsamlı gezinme tasarımı. |

Eksik hakediş fiyatının sessizce `0` kabul edilmesi ayrıca yüksek öncelikli bir
mali risk olarak ele alındı. Eksik değer ile açıkça girilmiş sıfır farklıdır:
yeni önizlemede fiyat boşsa “0”a çevrilmez, seçili eksik kalem varken oluşturma
durur. Oluşturma ve kesinleştirme veritabanı sınırında da bütün kalemler denetlenir;
tek geçersiz kalem kısmi finansal yazım oluşturmamalıdır. Eksik vinç tarifesi,
geçersiz miktar ve KDV ayrıca açıklanır. Açıkça girilmiş **0 geçerlidir**.
Hesap/yuvarlama formülleri değişmez; geçmişte kaydedilmiş sayısal sıfırın gerçekten
boş fiyattan geldiği tahmin edilmez ve eski kayıtlar yeniden fiyatlandırılmaz.
Tarayıcıdaki eski-risk kanıtı ve aday koruma testi CI'de ayrı adımlardır.

## İş başlangıcı davranışı

- Farklı müşteri veya mesaj eldeki taslağı değiştirecekse ekran içinde iki açık
  seçenek vardır. **Taslağa dön** özgün taslağın tamamını açar. **Yeni başlangıcı
  aç** yalnız açık seçimden sonra yeni taslağı yazar; önce silme yapılmaz.
- Aynı müşteri için mevcut taslak veya Saha Akışı'ndan açılan mevcut taslak tüm
  alanlarıyla korunur. Tarih, araç, açıklamalar, manuel fiyat ve ek döküm satırları
  yeni bağlamla karıştırılmaz.
- Müşteri kartı bağlantısı tek kullanımlık başlangıçtır. Başlangıç saklandıktan
  sonra adresin müşteri ön dolumu tüketilir; kullanıcı müşteriyi değiştirip
  sayfayı yenilerse eski bağlantı tekrar devreye girmez.
- Geri gitmek, başka ekrana geçmek veya gecikmiş eski düğmeye basmak yeni ekranı
  ele geçirmez. Yeni kart penceresi iptal edilince eski seçim korunur. Müşteri
  veya şantiye gibi yalnız seçimle değişen alanlar da taslağa kaydedilir.
- Eski kaydın artık uygun olmayan şantiye seçimi düzenleme ekranında açık
  uyarıyla görünür; ekranı açmak kaydı düzeltmez veya yeniden yazmaz. Kaydetme
  denetimi aynen sürer.

Korunan taslak, cihazda saklanmış iş taslağıdır. Mevcut 600 ms yazma gecikmesi
dolmadan sayfadan ayrılan son tuş vuruşu veya henüz kaydedilmemiş dosya seçimi
için kalıcılık garantisi verilmez. “Son İşten Başla” düğmesinin mevcut kirli-form
onayı ve taslak temizleme akışı bu dar değişikliğin dışında kalır; yeni müşteri/
mesaj çakışma korumasıyla aynı kapsamda olduğu iddia edilmez.

## Korunan sınırlar

DB şeması **6**, uygulama kimliği ve mevcut yedek/şifreli aktarım biçimleri
değişmez. Geçmiş açıklamalar, müşteri notları, iç notlar, kaynak mesajlar ve
`review_notes` topluca temizlenmez veya yeniden üretilmez. Mevcut şifreli aktarım
dosyaları değiştirilmez. Ana SAHAPRO/YZ2 bu çalışmanın dışındadır.

Sürüm ve atomik servis çalışanı önbelleği birlikte değişir. Açık form varken
güncelleme iptali alanları korumalı; açık onayla güncelleme ise kayıtları, audit'i,
ek dosyalarının gerçek baytlarını ve saklanmış taslakları aynen korumalıdır.

## Doğrulama ve yayın kapısı

Değişmemiş v3.9.70 tabanında **125/125 Node test dosyası geçti**. Yeni testler
eski iddiaları kaldırmadan eklenir. Yeni adayın tam sonuçları taslak PR/CI'de
gösterilir; yalnız hazırlanmış veya derlenmiş test “tarayıcıda geçti” sayılmaz.

Yerel Chromium önceki denemede işlem tekilliği için gereken AF_UNIX soketini
açamıyordu (`Operation not permitted`); bu ortam sınırını aşmaya yönelik bir
bayrak, farklı soket veya izin denemesi yapılmaz. Gerçek tarayıcı doğrulaması
standart GitHub-hosted Ubuntu üzerinde Node 24 Debian konteyneri, sistem
Chromium'u ve Playwright ile yürür; yalnız sentetik profiller/veriler kullanılır.

CI kapsamı:

1. Bütün Node test dosyaları; iş başlangıcı, rapor açıklığı ve bölüm seçimi için
   yeni saf regresyon testleri.
2. Önceki `secure_transfer`, `record_notes`, `customer_snapshot`,
   `operation_history` gerçek tarayıcı paketleri.
3. Yeni `work_entry_safety`: eski taslak çakışması, iptal/açık değiştirme,
   gecikmiş yanıt, seçim autosave, şantiye ilişkileri, yeni kart iptali,
   eski kayıt/ek korunması ve 320/390/768 px.
4. `report_clarity`: gerçek ekran/CSV/PDF ile sıfır/eksik/sözleşmeye dahil fiyat,
   TL/litre ayrımı, müşteri mahremiyeti ve finans bölümünün etkin seçimi.
   `work_productivity` ve `field_entry`: benzer iş, kayıt sonrası yeni iş,
   geçmiş tarihli Saha Akışı ve saklanmış taslakların korunması.
5. Gerçek kurulu v3.9.69 ve v3.9.70 profillerinden yeni sürüme ayrı güncelleme;
   gerçek bekleyen servis çalışanı, iptal/onay, dosya hash'leri, çevrimdışı ekran
   ve tam kayıt/audit/ek/taslak eşitliği.
6. Değişmemiş v3.9.70 üzerinde ayrı negatif kontrol: eski taslak kaybı ve
   eksik fiyat riski beklenen hata olarak **yeniden üretilir**. Bu adımın
   başarılı olması eski uygulamanın doğru olduğunu göstermez.
7. Yeni adayda ayrı gerçek UI/IndexedDB fiyat testi: boş fiyat reddi, açık ve
   eski sıfırın kabulü, karma seçimin atomik reddi, eski bekleyen bozuk taslak,
   vinç tarifeleri, iptal ve gecikmiş kesinleştirme onayı.
8. Test dosyalarının çalıştırma sırasında değiştirilmediği doğrulanır. Sentetik
   ekran görüntüleri ve gerçek PDF/CSV çıktıları görsel inceleme için üç gün
   saklanır; gerçek kullanıcı verisi bu artefaktlara konmaz.

Taslak PR, başarılı yayın anlamına gelmez. Yeni mali güvenlik denetimleri ve tüm
ilgili tarayıcı koruma sonuçları incelenmeden birleştirme/yayın yapılmaz.
