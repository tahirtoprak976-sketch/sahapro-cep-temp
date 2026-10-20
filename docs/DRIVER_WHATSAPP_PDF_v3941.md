# SOLO v3.9.41 — WhatsApp grubunda okunur iş mesajı ve PDF

## Hedef ve kullanım

WhatsApp grubundaki günlük iş takibi devam eder. Personel kayıtları girer ve ana düğme **WhatsApp’a gönder · mesaj + iş özeti** ile paylaşım ekranını açar; WhatsApp’ı ve mevcut iş grubunu seçip gönderir. Uygulama aynı native paylaşım çağrısına okunur iş mesajı (`text`) ile bir `application/pdf` iş özeti (`files`) verir. Uzun SP1 satırı mesajda ve PDF sayfalarında gösterilmez.

PDF sayfaları Unicode Türkçe iş özeti, şoför, miktar/birim, varsa alınan nakit ve fotoğraf önizlemelerini içerir. Orijinal imzalı kayıtlar ve orijinal fotoğraflar standart bir PDF EmbeddedFile eki olarak korunur; gizli yazı, beyaz metin veya sahte dosya uzantısı kullanılmaz. Aktarım bilgisi dosya eki olarak bulunabilir; bu bir gizleme/şifreleme iddiası değildir.

Patron aynı `.sahapro.pdf` dosyasını Asistan’a ekler veya desteklenen PWA paylaşım hedefinde SAHAPRO’yu seçer. Asistan sayfalardan yeniden tahmin yapmak yerine gömülü orijinal kaydı okur, aynı HMAC/bağlantı/personel kontrollerini uygular ve kartları onaya getirir. İş ve tahsilat ayrı onaylanır. PDF’i almak kayıtları otomatik yazmaz. Eski ZIP/TXT/kodlu yöntemler ve indirme yolu korunur; günlük ana yol manuel indirme değildir.

## Paylaşım sınırları

Önceki hata için cihazın kesin ret nedeni ölçülmedi. [MDN share() belgesi](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share#shareable_file_types) PDF’i genelde paylaşılabilen uygulama dosyaları arasında listeler; bu her cihazda başarı garantisi değildir. Native çağrı hâlâ dosya hazırlandıktan sonra yeni kullanıcı tıklamasında yapılır. `navigator.canShare` ve native hata/iptal denetimleri korunur.

WhatsApp mesaj metnini belge açıklaması olarak gösterebilir; mesaj/PDF sunumu ve gruba teslim WhatsApp’a bağlıdır. Uygulama hedef grubu kendiliğinden seçemez. Gerçek Android/iPhone WhatsApp grup gönderimi bu ortamda yapılamadı; metin ve PDF’in birlikte görünmesi telefonda kabul edilmelidir. Başarı/indirme teslimat kanıtı sayılmaz.

PDF toplamı en fazla 20 MB. Unicode fontları ve önizlemeler boyuta eklenir; sınır aşılırsa daha az kayıtla hazırlama uyarısı verilir, fotoğraf sessizce düşürülmez. PDF üzerindeki görünür sayfalar ayrıca dijital imzalı değildir; Asistan için güven kaynağı gömülü SP1 imzasıdır. PDF başka uygulamada düzenlenirse/gömülü veri silinirse özgün dosya yeniden istenir.

## Teknik kapsam ve doğrulama

`document-engine.js` yalnız isteğe bağlı `sahaproTransfer` için standart EmbeddedFile/Filespec/Names ve özel trailer referansı üretir. Normal PDF’lere aktarım verisi eklenmez. `.sahapro.pdf` okuyucusu yalnız uygulamanın sınırlı xref/stream biçimini, en fazla 4096 nesne ve 20 MB dosya ile okur; PDF JavaScript’i çalıştırmaz, genel PDF yorumlayıcısı değildir. İç ZIP yine boyut/CRC/dizin kontrolünden ve SP1 doğrulamasından geçer. Sıradan PDF’ler mevcut **Geçmiş işleri PDF’den aktar** aracına yönlendirilir.

- `driver-pdf-transfer.test.mjs`: gömülü orijinal içerik, boyut/biçim/ref reddi, görünür sayfa ile imzalı kaynak ayrımı.
- `driver_pdf.py`: iki izole Chromium/IDB oturumu; ZIP reddedilirken PDF kabul eden paylaşım taklidi, doğrudan tıklama, kodsuz grup metni ve tek PDF, pypdf ile gerçek sayfa metni/standart ek doğrulaması, iş/nakit/fotoğraf aktarımı, tekrar, bozuk/geçersiz imza/eksik/karışık dosya reddi, gerçek service-worker yönlendirmesi. Normal PDF çıktısının değişmemesi de kontrol edilir.
- Gerçek PDF ayrıca PyMuPDF ile açılıp ilk sayfa görüntüsü incelendi; görünen metinde SP1 yok.
- Önceki ZIP, metin, native hata/iptal ve indirme geri dönüş suitleri korunur. Veri tabanı sürümü ve finans hesaplamaları değişmez. Testler uydurma veriyle; gerçek kişiye mesaj gönderilmez.
