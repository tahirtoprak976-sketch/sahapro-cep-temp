# v3.9.76 — Operasyon ve kayıt bağlantıları

Taban: canlı v3.9.75, `e8dd2c019d99b3d7b213e2e51d4de457b2300bca`. Şema7 değişmez. Kimi'nin yerel adayındaki yenilikler, bağımsız incelemede bulunan beş hata düzeltilerek bu sürüme alınır. Kullanıcı geçmiş iş aktarımı başlatılmasını istemedi; gerçek telefon kayıtları taşınmadı veya topluca değiştirilmedi. YZ2 kapsam dışıdır.

## Kullanım

- Ana ekranda **Operasyon Masası**: Bugün, Bekleyenler, Kapanış. Gün, araç ve personel filtreleri bağlantıda korunur. Plan gerçekleşmiş iş veya gelir değildir; **Planı iş taslağına dönüştür** ile gerçek miktar/fiyat kontrol edilerek kaydedilir.
- İş detayında **İş Dosyası**: fiyat, belge, hakediş ve tahsilat durumları ayrıdır. Genel müşteri tahsilatı işe keyfi dağıtılmaz; aynı araç/gün gideri kesin iş maliyeti sayılmaz. İşe sahiplik bağıyla eklenen genel belgelere buradan ulaşılır.
- Asistanda en fazla beş açık araçlı metin görevi listelenir. Açık ve sonucu inceleme gerektiren görevler geçmiş sınırından dolayı kaldırılmaz; tamamlanan/iptal geçmişi son20 kayıtla sınırlanır. İnceleme gereken görev otomatik yeniden uygulanmaz.
- **Belgeyi Kayda Bağla** ekranı mevcut belge, parça ve döküm servislerini kullanır. Garanti tek başına gider/ödeme, fatura ödeme kanıtı değildir. Özgün dosyalar ve ortak ek güvenliği korunur.
- Teklif detayındaki **Tekliften tahsilata zincir**, açık teklif/sözleşme/plan kimlikleriyle bağlı kayıtları gösterir. Aynı şantiyedeki diğer işler ayrı bağlamda görünür; bunların tahsilatı bu teklifin bağlı ödemesi sayılmaz.

## İncelemede bulunan hataların kapanışı

1. **RT76-01:** Planın güncel durumu ve revizyonu, iş, işlem kimliği ve iki audit kaydı aynı IndexedDB transaction'ında kontrol edilip yazılır. Plan iptal/değişmişse sıfır iş yazılır. İş eklendikten sonra plan yazımı hata verirse tamamı geri alınır. Eşzamanlı aynı içerik tek iş döndürür; farklı içerik OP_CONFLICT olur. Genel kayıt yolu plan bağlantılı işi tek başına oluşturamaz.
2. **RT76-05:** Açık/applying/review görevleri kapanmış geçmişten ayrılır; geçmiş sınırı bunları atmaz. İnceleme görevleri, çok sayıda kapanmış kayıt olsa da görünür kalır. Görev değişiminde gecikmiş dosya taslağı yazımı tamamlanır/durdurulur; eski ekran yeni dosya seçimini ezmez.
3. **RT76-03:** Ortak şantiye ve tarih, teklif sahipliği kanıtı değildir. Başka teklifin açık kimliği veya iptal edilmiş kayıt zincire dahil edilmez. Kaynak kayıtları yeniden bağlayan otomatik yazım yoktur.
4. **RT76-02:** İş sahibi belgeler documents üzerinden kendi ekleriyle okunur; doğrudan iş ekleriyle karıştırılmaz/çift sayılmaz. Silinmiş veya çelişkili sahiplik bağı olan belge dayanak sayılmaz. İş ve belgeler aynı salt okunur snapshot'tan gösterilir.
5. **RT76-04:** Filtreli araç/personel özeti ile tüm şirketin günlük kapanışı ayrı etiketlidir. Saklanmış şirket kapanışı aynı şirket kapsamındaki güncel kaynakla karşılaştırılır. Kapanış formu seçilen gerçek günü taşır.

Maliyet yaması: ham aylık seri, operasyon/dağıtılmış sonuç ve ekran/PDF/CSV, bilinmeyen döküm maliyetini sayısal kâra veya0TL'ye çevirmez. Bilinen gider ara toplamı görünür kalır. Fiyat/KDV/tarife snapshotları, mazot hak/alınan ayrımı ve maliyetlerin mevcut gelir politikaları korunur.

## Doğrulama kapsamı

- Tüm Node test dosyaları, JS sözdizimi ve SW modül listesi.
- Mevcut28 tarayıcı paketi + Kimi'nin yeni7 paketi + `workflow_release_guards`, `assistant_agent`, `assistant_workflow`, `assistant_conversation`: toplam39 paket CI kapsamındadır.
- Yeni gerçek Chromium/IndexedDB testi: iki sekmede plan iptali; iş eklendikten sonraki gerçek IDB yazma hatası ve rollback; eşzamanlı aynı/farklı içerik;20'den çok kapalı görev arasında açık görev ve dosya korunması; gerçek belge ekranından iş dosyasına belge/özgün bayt; aynı şantiyede iki teklif; iki araç/personel ve şirket kapanışı ayrımı.
- Eski workflow testindeki silinecek müşteri artık finansal geçmişi olmayan gerçek yeni karttır. Müşteri silme koruması kaldırılmadı; seçili grup ön denetiminin sıfır yazma iddiası korunur. Eski sohbet testinin gerçek depo girişi, sınanan geçmiş çıkıştan önceye yerleştirildi; sonraki girişin geçmişi karşılamama koruması değişmedi.
- Şema7 yükseltme fixture'ındaki desteklenmeyen metin/SVG, geçmişten var olan özgün ekler olarak ekilir. Yeni yükleme sınırı atlatılmaz; eski dosyaların baytları, karantinası ve kaynak/audit/taslak karşılaştırmaları aynen sınanır. v3.9.75→76 kurulu profil ayrıca CI'ya eklendi.

Sonuç kanıtı son commitin CI çıktısıdır; bu kapsam listesi çalıştırılmamış bir kontrol için PASS beyanı değildir. Gerçek Gemini dil başarısı, fiziksel Android/iOS WhatsApp teslimi veya kullanıcı telefonundaki gerçek kayıtlar sentetik testlerden çıkarılamaz.

## Sınırlar

WhatsApp grubu kendiliğinden okunmaz; mesaj/paket uygulamaya verilmelidir. Görsel/ses/PDF girişleri mevcut belge akışlarındadır; araçlı metin görevleriyle her fotoğraflı isteğin baştan sona aynı görevde devamı bu sürümde genel bir garanti değildir. Uygulama cihazlar arasında otomatik senkronize olmaz. Kimi'nin ilk adayındaki10.000 kayıt/ana ekran ölçümü yaklaşık53 saniyeydi; bu teslimat yeni bir hızlanma iddiası taşımaz. Eksik veya yanlış kaydedilmiş işi otomatik doğru hakediş saymak yerine dayanak ve eksiklikler gösterilir.
