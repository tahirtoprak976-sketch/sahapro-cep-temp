# Paket 0 ve para güvenliği onarımları — v3.9.99

Taban: `20612ee8af15ca8823bca705df8acf7c1f56b063`, gh-pages v3.9.98. Aynı PR #223 içinde ölçüm ve üç onarım bulunur. Şema 7; kayıt biçimi, geçmiş kayıtlar, YZ2, KDV/cari politikası ve sağlayıcı değişmedi. Anahtar telefonda; ücretli servis veya sunucu eklenmedi.

## Ne değişti?

- Beş finansal sınıf doğrulama katmanında işaretsizdir. Geçerli veri `okData` ile, elle onay gereği `needsApproval` ile ayrı tutulur. Normal petrolcü alımı ve parasal olmayan puantajın kontrolleri korunur.
- Mesajdaki bir fiyat bu işe kesin bağlanamazsa kart işaretsiz kalır ve tek fiyat sorusu üretilir. Kullanıcı tutarı açıkça girmeden veya fiyatı sonraya bırakmadan bu kart kaydedilemez. Bu kontrol tüm yazmalardan önce yapılır. Fiş birleştirmek veya hazır kartları seçmek uyarıyı aşamaz.
- `Alt firma (Ana firma)` kalıbı ve kayıtlı bağlantı uyuşursa modelin yanlış ana firma seçimi engellenir; alt firma işaretsiz önerilir. Meslek takma adı öğrenilmez.

## Ölçüm düzeltmesi

Eski 61 örnekte ortak TEST ad öneki iki yapay fiyat belirsizliği yaratıyordu. Adlar gerçekçi ve ayrık yapıldı; TEST işareti kimliklerde/veritabanı adında tutuldu. Eski raporlar silinmedi. Yeni 63 örnek, iki gerçek fiyat belirsizliği örneğini de içerir. Aşağıdaki iki sütun aynı 63 örnek, aynı beklenti ve aynı ölçüm koduyla ölçülmüştür. Taban değiştirilmeden git arşivinden tekrar çalıştırıldı.

| Ölçüt | v3.9.98 (düzeltilmiş set) | v3.9.99 |
|---|---:|---:|
| Sessiz yanlış kart | 2 | 0 |
| Para alanında tahmin | 0 | 0 |
| Zorunlu işaretsiz kartta işaret | 9 | 0 |
| İşaretli doğru / tüm beklenen kartlar | 22/63 (34,92%) | 22/63 (34,92%) |
| Gereksiz soru/alan istemi | 3/16 (18,75%) | 3/19 (15,79%) |
| Mesaj başına soru/alan istemi | 0.254 | 0.302 |
| Kart sayısı hatası | 0 | 0 |
| Yerel tests/gold yanlış | 0 | 0 |

İki taban sessiz yanlışı: Çatıcı işinde ana firmayı seçen işaretli öneri; geçerli satır alıntısı yanında başka müşterinin fiyatını boşaltıp kartı işaretli bırakan öneri. Dokuz zorunlu işaret ihlali ayrı kaydedilir. Yanlış işaret kontrolü sıkılaştırıldı: finansal sınıf dışında, işaretsiz olması beklenen kartın işaretlenmesi de sessiz yanlış sayılır.

Soru ölçümü saf doğrulayıcıdaki açık sorular ve alan istemlerinin yaklaşık sayımıdır; arayüzdeki gerçek dokunma veya soru kutusu sayısı değildir. Bunlar elle hazırlanmış model yanıtlarıdır, gerçek Gemini başarısı değildir. Tam alan/işaret/soru hedefindeki kalan farklar JSON raporunda saklıdır; Paket 1–5'in tamamlandığı iddia edilmez.

## Alan doğruluğu

| Alan | Önce | Sonra |
|---|---:|---:|
| customer_id | 38/40 | 39/40 |
| vehicle_id | 32/32 | 32/32 |
| quantity | 22/23 | 22/23 |
| unit | 23/23 | 23/23 |
| date | 63/63 | 63/63 |
| unit_price | 28/28 | 28/28 |
| amount | 23/23 | 23/23 |
| money_role | 8/8 | 8/8 |
| site_id | 1/1 | 1/1 |
| price_rule | 1/1 | 1/1 |
| personnel_id | 6/6 | 6/6 |
| event_type | 6/6 | 6/6 |
| liters | 11/11 | 11/11 |
| total | 11/11 | 11/11 |
| cost | 2/2 | 2/2 |
| ticket_no | 4/4 | 4/4 |
| tonnage | 4/4 | 4/4 |
| duplicate | 4/4 | 4/4 |
| link | 2/2 | 2/2 |

## Doğrulama

- Aynı dokuz bağımsız Node regresyonu: değişmemiş v3.9.98'de sekiz hata, parasal olmayan bir kontrol başarılı; adayda dokuzu başarılı.
- Chromium'da beş sınıfın hepsi işaretsiz, Kaydet öncesi işletme kayıtları aynı. Açık saat fiyatı korunur; gerçek belirsizlik bir kez sorulur, zorla işaretleme yazmaz, elle fiyat onayından sonra tam tutar kaydedilir. Yanlış ana firma önerisi alt firmaya çevrilir ve hazır seçimi kartı açmaz.
- Eski finansal otomatik seçim beklentileri `okData=true` + `ok=false` olarak sıkılaştırıldı. Veri geçerliliği/tutar beklentileri korunur. Eski teslimat UI testi önce işaretsizliği doğrular, sonra açık kullanıcı seçimiyle aynı yazma kontrollerini sürdürür.
- Tüm Node, CI tarayıcı suitleri, yükseltme testleri ve Pages yayını: PR kontrol sonuçları esas alınır; hepsi geçmeden merge yok.

Gerçek telefon, gerçek Gemini ve gerçek WhatsApp sınanmadı. Canlı sentetik CLI çalıştırılmadı. Eski kayıtlar değiştirilmedi.

## İşlem masası testinin kararsızlığı

CI kaydı `operation_desk` testinde kapanıştan sonra rastgele ilk işin değiştirilirken düştüğünü gösterdi. 36 işten biri iki saatlik puantaj planına bağlıydı; bu iş seçilince uygulama miktarı üç yapmayı doğru biçimde reddediyordu. Kayıt kimliğine bağlı sıra, testi aralıklı başarısız yapıyordu.

Yalnız bu seçim `.find(x=>!x.plan_assignment_id)` ile puantajsız işe yöneltildi. Bütün eski assert ifadeleri aynen korundu. Ayrı iki assert, puantajlı işin miktarını değiştirme denemesinin doğru hata ile reddedildiğini ve tüm işletme kayıtlarının aynı kaldığını (miktarın iki saat olduğunu) doğrular.

Değişmemiş v3.9.98 kaynağında puantajlı iş bilerek seçilerek aynı CI hatası yeniden üretildi. Düzeltilmiş test hem v3.9.98 hem v3.9.99 adayında geçti. Uygulama kodu veya puantaj kuralı bu düzeltme için değiştirilmedi.
