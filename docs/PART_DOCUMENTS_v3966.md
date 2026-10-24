# SOLO v3.9.66 — Yedek parça ve garanti belgeleri

Akıllı Asistan genel belge okuması parça garantisini ayrı tanımıyordu. Yedek
Parçalar ekranı da fotoğraf/PDF saklayabiliyor, fakat belgeyi okuyamıyordu. Bu
sürümde iki ekran aynı parça okuyucusuna bağlanır. Okuma bir öneridir; parça,
gider, ödeme veya garanti kaydı kendi kendine oluşmaz.

## Kullanım

1. Asistan'da fotoğrafı/PDF'yi ekleyip **Yedek parça / garanti belgesi oku**
   düğmesine basın. Mesaja “Akü garanti belgesini oku” yazıp göndermek de aynı
   ekrana götürür. Yalnız fotoğraf gönderildiğinde modelin tanıdığı parça belgesi
   **Parça bilgilerini kontrol et** kartıyla açılır.
2. Orijinal belge ve önerilen alanlar birlikte görünür. Parça adı, marka/model,
   satıcı, belge numarası, ayrı seri numaraları, miktar, alış/garanti tarihleri,
   araç ve KDV dahil birim fiyat okunabilir. Belirsiz veya elle değiştirilmiş
   alanlar otomatik seçilmez. İstediğiniz alanları kontrol edip seçin.
3. **Seçili bilgileri forma aktar** yalnız formu doldurur. Aracı ve maliyet
   kaynağını kontrol ettikten sonra **Kaydet** ile gerçek kayıt oluşturun.
4. Mevcut parçada **Belgelerden garanti bilgilerini oku** saklı orijinalleri
   açar. Garanti düzenleme ekranına yeni fotoğraf/PDF de eklenebilir. Bu yol
   ikinci parça veya ikinci gider oluşturmaz.

Anahtar/izin yoksa belge okunmadan saklanabilir; alanlar elle doldurulur.
Fotoğrafın okunması için Ayarlar → Yapay Zeka'daki Gemini anahtarı ve veri
gönderme izni gerekir. Orijinal belge, normal parça kaydı ve tam yedek içindedir.

## Doğruluk ve veri kaybını önleme

- Belge metni ve alanın kendi kanıt satırı kullanılır. Ham metin gelmezse
  dönen değerler silinmez; işaretsiz öneri olarak görünür. Bir fotoğrafın boş
  metni diğer fotoğrafların birleşimiyle doğrulanmaz.
- Üretim tarihi alış/garanti başlangıcı değildir. “24 ay” garanti süresi miktar
  veya hesaplanmış bitiş tarihi olmaz. Geçersiz/ters tarih kontrol ister.
- Toplam bedel miktara bölünmez. KDV hariç/belirsiz fiyat, KDV dahil birim
  fiyat alanına kendiliğinden aktarılmaz. Belge tutarı ödeme kanıtı sayılmaz.
- Okuma sürerken veya sonrasında elle girilen değerler korunur. Farklı değerin
  üstüne yazmak için ilgili alanı açıkça seçmek gerekir. Okuma parça ekranına
  geldiğinde boş tarih/miktar bugüne veya 1'e tamamlanmaz.
- Genel modelin aynı fotoğrafı ayrıca gider/araç belgesi/fiş saydığı tanınmış
  parça belgeleri bu gruplardan ayrılır. Eski biçimde yalnız fotoğraf metni
  dönen parça garantisi de kendi metninden kurtarılıp özel okuyucuya yönlenir.
- Dosya türü baytlardan doğrulanır. Mobil cihazın boş/yanlış MIME başlığı
  nedeniyle geçerli JPEG/PNG/WebP/PDF reddedilmez; uzantısı değiştirilmiş HTML
  kabul edilmez. Yeni seçim eskileri silmez; bozuk ek dosya eskileri korur.
- Okuma için fotoğraf en fazla 3000 piksel kenarla hazırlanır, PDF kendi
  türünde gönderilir. Saklanan orijinal dosya yeniden sıkıştırılmaz. Seçili
  dosya ve tamamlanmış sonuç taslakta korunur; sayfa yenileme yeniden model
  çağrısı yapmaz. İptal/hata önceki başarılı sonucu silmez.
- Aynı dosyanın aynı kartta tekrarı tek ek kalır. Başka parçada bulunan aynı
  belge yeni kart açılmadan gösterilir. Gerçekten birden fazla parçaya ait
  ortak belge için kullanıcı açıkça izin verebilir. Dosya özeti tek başına
  “aynı parça” iddiası değildir.
- Parça, seçilmiş yeni gider, dosyalar ve audit tek transaction'da yazılır.
  Garanti güncellemesi ve yeni belgeler de atomiktir. Tekrar ve eşzamanlı
  gönderme ikinci kayıt üretmez; eskiyen garanti düzenlemesi başka değişikliği
  ezmez. Güncel kaydı yüklemek belge taslağını korur.

## Sınırlar ve yedek

En fazla 8 dosya, dosya başına 15 MiB, toplam 30 MiB ve fotoğrafta 40 megapiksel.
Modelin belge yanıtı 2 MiB ile sınırlıdır; her HTTP isteği, yanıt gövdesi dahil,
45 saniyede kesilir. Model değiştirme denemeleri aynı izin/günlük kota kapısından
geçer; ücretsiz veya kesin okunur garantisi verilmez. Okuma iptal edilebilir.

Kaydedilmiş dosyalar tam yedekle geri yüklenir. Kaydedilmemiş yeni parça,
garanti düzenleme ve belge okuma taslaklarının dosyaları tam yedeğin içinde
değildir; yedek kapsam raporu bunları sayar. Telefonda taslakta durmaları,
başka cihaza yedeklenmiş oldukları anlamına gelmez. DB sürümü 6 kalır;
veri dönüşümü veya mevcut kayıtların toplu değiştirilmesi yoktur.

## Doğrulama

`tests/part-document.test.mjs` alan kanıtını, tarih/miktar/fiyat rollerini,
seri numarası ayrımını, kullanıcı değişikliklerini, sınıflandırmayı ve eski model
yanıtını kurtarmayı sınar. `part_documents.py` gerçek fotoğraf ve PDF baytlarıyla
asistan → kontrol → form → kayıt → yedek → temiz profile geri yükleme yolunu
çalıştırır. `part_document_guards.py` gerçek IDB request hatasında sıfır kalıntı,
eşzamanlı tekrar, açık paylaşma izni, eskiyen düzenleme, gövde zaman aşımı/boyut
sınırı ve izin olmadan sıfır ağ çağrısını sınar. Eski `parts_ledgers.py` beklemesi
Promise yerine gerçek dosya-hazır durumunu denetler.

Yerel doğrulama: 122/122 Node test dosyası, 171 JS sözdizimi dosyası ve 170 SW
modülü geçti. On bir tarayıcı suiti geçti: `part_documents`,
`part_document_guards`, `parts_ledgers`, `assistant_batch`, `assistant_workflow`,
`assistant_agent`, `bulk_entry`, `bulk_entry_race`, `denetim`, `kismi`,
`transaction_errors`. Belge okuyucusunun ağ kodu ortak Gemini kapısına alındıktan
sonra 122 Node dosyası ve iki yeni belge suiti son kaynakla yeniden geçti.
Gold kümesinde 80 mesaj/369 alan doğru; 756 mutasyonda sessiz yanlış 0.
Önizleme üretimi de geçti.

Tarayıcı testlerinde model yanıtları taklittir; DOM, IndexedDB, Service Worker,
dosya baytları ve transaction hataları gerçektir. Kullanıcının gerçek akü fotoğrafı
bu çalışmada bulunmadığından o fotoğrafın Gemini ile okunduğu iddia edilmez.
Fiziksel telefon OCR kalitesi de bu testlerle kanıtlanmaz.
