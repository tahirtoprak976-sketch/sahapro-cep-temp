# Belge okuma incelemesi — v3.10.24

Kullanıcının telefonunda kısa bağlantı testi seçili modelde HTTP200, muayene fotoğrafı okuması ise beş denemede503 verdi. Bu gözlem, anahtarın o küçük istekte çalıştığını gösterir; belge isteğinin503nedenini tek başına kanıtlamaz. Gerçek anahtar veya belge alınmadı, gerçek Gemini çağrısı yapılmadı.

## Kanıtlanan istemci sorunu

v3.10.23 medya yolu muayene belgesi için de tüm iş/para/mazot/eylem şemasını, işletme kartlarını, facts/cari özetlerini ve sohbeti taşıyordu. Native yazı yolunun önceki sürümde hafifletilmiş olması medya yolunu değiştirmemişti. Bu gereksiz yük ölçüldü;503ile nedensellik iddia edilmez. Aynı Chromium testi değişmemişv3.10.23'te DOCUMENT_REQUEST_NOT_SCOPED ile kırmızı, adayda yeşildir.

| Ölçüm | Önce | Aday |
|---|---|---|
| Sistem talimatı + JSON şema karakteri (yerel ölçüm) |30.880|3.897|
| İlk çıktı sınırı (harcanan token değildir) |16.384|8.192|
| Belgeye ilgisiz müşteri/facts/sohbet |Gönderilir|Dar belge yolunda gönderilmez|
| Şema |Tüm işlemler ve eylemler|documents,photo_texts,questions,answer|
| Yerel plaka eşleştirme |Mevcut doğrulama|Aynı doğrulama; model kayıtlıIDalmadan plaka okur|

## Kapsam ve korumalar

- Yalnız açık muayene/ruhsat/sigorta/kasko/ehliyet/SRC/psikoteknik belge okuması. Mesaj boşsa bütün eklerin adı bu belge niyetini taşımalı. Dosya adı yalnız yönlendirir; yıl, plaka veya bitiş tarihi kanıtı sayılmaz.
- İş/para/fatura/mazot/müşteri/şantiye içeren karışık istek, önceki kartı düzeltme, ses veya şoför aktarımı mevcut genel yolda kalır. Bu talepler dar şemayla kaybedilmez.
- Modelden dar belge yanıtında dolu ilgisiz işlem gelirse reddedilir; iş/para kartı üretilemez.
- PDF baytları değişmez, görsel mevcut sıkıştırmadan geçer. Orijinal dosya arşivi, yerel tarih/no/plaka doğrulaması, mükerrer belge, işlem kimliği ve revizyon aynı kalır. Kaydet öncesi kayıt ve muayene sayacı değişmez.
- Aynı izin/günlük bütçe, iptal,90s, sınırlı model geri dönüşü. Yeni servis, sabit model, şema/depo değişikliği yok. YZ2/QAaynı.
- v3.10.23→24 gerçek SW güncellemesinde kayıt/meta/taslak/eklerin birebir korunduğu ve çevrimdışı açılış yerelde geçti. Yeni modülSW ASSETS'te.

Yeni Node sınavı dar/yaygın niyetler, Türkçe ekler, karışık finans talimatı, dosya adına tarihle güvenmeme, beklenmeyen model işlemi reddi ve istek boyutunu ölçer. Yeni Chromium testi eski muayene testinin PDF/fotoğraf, onay öncesi yazmama, özgün baytlar, son geçerlilik ve şoför imza kapısı beklentilerini koruyup dar istek kontrollerini ekler. Kayıtlı araç modelID'si verilmeden yerelde bulunur. Tüm mevcut Node/tarayıcı/yükseltme kapıları ayrıca geçmeden merge yapılmaz.

Fiziksel Android, gerçek WhatsApp, gerçek Gemini ve kullanıcının gerçek muayene belgesi denenmedi. Daha küçük isteğin Google503'ünü kesin çözdüğü veya gerçek belgeyi hatasız okuduğu iddia edilmez.

Birincil başvuru: https://aistudio.google.com/docs/troubleshooting ve https://ai.google.dev/gemini-api/docs/document-processing (belge girdisi/işlem sınırları). Servis erişilebilirliği bu dokümanlardan çıkarılmadı.
