# SOLO v3.9.35 — Alt müşteri ve şoför nakit bildirimi

## Düzeltilen müşteri seçimi

Şoförün açıkça yazdığı `Çatıcı (Ulaş Rondela)` adı, benzerlik/geçmiş iş aramasıyla `Ulaş Rondela` kartına dönüştürülebiliyordu. SP1 içindeki açık müşteri kimliği artık korunur; açık yeni adlar da fuzzy/geçmiş eşleştirmeye gönderilmez.

- Bilinen tek ana firma parantez içinde belirtilmişse (`Mermerci (Demir İnşaat)`), o firmaya bağlı aynı adlı alt müşteri aranır. Varsa kendi kimliği seçilir; yoksa ana firmaya bağlı yeni alt müşteri önerilir.
- Başka ana firmadaki aynı meslek/ad seçilmez. Birden fazla eşleşme veya bulunamayan ana firma varsa belirsizlik gösterilir, tahminle ana firmaya yazılmaz.
- Yeni oluşturulan şoför bağlantılarındaki müşteri listeleri ve patronun seçim listesi, alt müşterinin yanında ana firmayı gösterir. Mevcut bağlantı listesinin yenilenmesi için ayrıca yeni bağlantı paylaşılabilir; eski bağlantı otomatik iptal edilmez.
- Yeni müşteri oluşturma ad + ana firma kapsamında tek IndexedDB transaction'ıyla yapılır. İki eşzamanlı onay aynı kartı kullanır.

Bu değişiklik yeni önizleme/kayıtlara uygulanır. Önceden yanlış müşteriye kaydedilmiş işler otomatik taşınmaz; mevcut düzenleme ve hakediş korumalarıyla ayrıca kontrol edilmelidir.

## Şoför tarafı

İş formuna **Alınan nakit (₺, varsa)** eklendi. Şoför tutarı açıkça girer; boş/0 ödeme bildirimi oluşturmaz. Pozitif tutar en fazla iki ondalık hane içerir. Nakit fiyat veya iş bedeli yerine geçmez. Taslakta korunur, iş kaydedildikten sonra alan temizlenir.

Kayıt kartında **Nakit bilgisi** ile eski/önceden paylaşılmış işe de tutar eklenebilir veya yanlış bildirim düzeltilebilir. Kayıt kimliği ve fotoğrafları korunur, iş yeniden paylaşılmayı bekler. Tutar, SP1 imzasının kapsamındadır ve okunur mesajda da yer alır. Önceden onaylanmış bir tahsilatın tutarını değiştirmek/silmek onu otomatik düzeltmez veya geri almaz; şoföre patrona ayrıca haber vermesi söylenir. Aynı iş için sonradan alınan ayrı bir ödeme, patronun mevcut Tahsilat ekranından ayrı işlem olarak girilmelidir.

## Patron tarafı ve muhasebe

İş kartlarıyla birlikte ayrı, **işaretsiz** nakit tahsilat kartı hazırlanır. Müşteri, tutar, tarih ve parayı alan şoför gösterilir. Şoförün kimliği nakit bildiriminde sabittir; ödeme şekli Nakit'tir. İşler kaydedilip nakit onaylanmazsa tahsilat yazılmadığını belirten uyarı ve yalnız nakit bildirimlerini yeniden açan düğme gösterilir. Daha sonra aynı mesaj tekrar alınabilir.

Patron kartı işaretleyip Kaydet'e bastığında tahsilat alt müşteriye yazılır; para **PERSONELDE** (örneğin Soner'de) durumunda izlenir. Kasaya teslim ayrı mevcut işlemdir. İş bedeli normal fiyat kurallarından hesaplanır; alınan nakit birim fiyat olarak kullanılmaz. Tutarı bilinmeyen eski mesajlardan ödeme üretilmez.

Kaynak kimliği şoför iş kimliğine bağlıdır. Aynı rapor, değiştirilmiş mesaj veya farklı request_id ile tekrar gelirse ikinci tahsilat yazılmaz. Aynı raporda farklı tutar/müşteri/tarihle ikinci kayıt çakışma olarak reddedilir; daha önceki tahsilat sessizce değişmez.

`saveCashEvent` transaction'ında nakit, cari hareket ve audit birlikte yazılır. Şoför iş kimliğinin doğrulanmış bağlantısı, bağlantı iptali/süresi ve aktif personel tekrar denetlenir; para sahibinin doğrulanan şoför olması gerekir. Bu kontrol önizlemeden sonra bağlantı iptal edilse de geçerlidir. Normal manuel kasa akışı korunur; yeni şema veya sunucu yoktur.

## Doğrulama

Saf model: açık alt müşteri adları/ana firma kapsamı, mevcut seçilmiş kimlik, yeni alt müşteri, bilinmeyen ana firma, tutar sınırları ve sabit kaynak kimliği.

Gerçek Chromium + IndexedDB: iki farklı ana firmanın alt müşterileri, taslakta nakit, fiyat/nakit ayrımı, onaysız para yazılmaması, onay sonrası Soner'de para ve tek cari hareket, tekrar mesaj, sonradan nakit düzeltme, farklı request_id ile tekrar, eşzamanlı müşteri oluşturma, doğrulanmamış/iptal edilmiş bağlantıda sıfır mali kalıntı. Dört tür/fotoğraf ve şoför teslim regresyonları da çalıştırıldı. Tüm veriler yapaydır; gerçek WhatsApp/Gemini çağrısı yapılmadı.

Fiziksel Android/iPhone kabulü henüz yapılmadı. İşle nakit iki ayrı patron onayıdır; birlikte tek transaction oldukları iddia edilmez. Mevcut yanlış müşteri ve önceden onaylanmış tahsilat için otomatik tarihsel düzeltme yapılmaz.
