# SOLO v3.9.70 — Geçmiş aktarımında açıklama ve kontrol notu

Uygulama sürümü ve atomik servis çalışanı önbelleği birlikte yenilenir. DB şeması
6 olarak kalır; mevcut telefon kayıtlarına toplu düzeltme veya veri dönüşümü
uygulanmaz. Dalda hazırlanmış değişiklik, birleştirme/yayın doğrulaması olmadan
canlıya geçmiş sayılmaz.

## Üç ayrı alan

`SAHAPRO_HISTORY_V1` satırlarında:

- `description`: yalnız o işin/yakıtın müşteriye gösterilebilecek açıklaması.
  Önizlemede kullanıcı düzenleyebilir; mevcut kayıt akışı bu alanı kaydeder.
- `raw_message`: gerçek kaynak mesajı. Kontrol notları buraya eklenmez;
  önizlemede başlangıçta kapalı kaynak bölümünde kalır.
- `review_notes`: isteğe bağlı **metin**, en fazla **2000 karakter**. Birden
  çok kontrol notu aynı metinde satır sonlarıyla ayrılabilir. Alan atlanabilir
  veya boş metin olabilir; sayı, nesne, dizi ve `null` kabul edilmez.

```json
{
  "description": "İki sefer moloz taşındı.",
  "raw_message": "TEST araç bugün 2 sefer moloz taşıdı.",
  "review_notes": "Geçmiş fiyatı ayrıca teyit edin. Bu not kayıt onayı değildir."
}
```

Kontrol notu önizlemede açıklamadan ayrı, salt okunur **Aktarım kontrol notu**
bölümünde düz metin olarak gösterilir. HTML çalıştırılmaz. Notu bulunmayan eski
V1 dosyaları aynı şekilde açılır; gereksiz boş bölüm gösterilmez. JSON şablonu
üç alanı ayrı sunar. Notu silmek/değiştirmek için kaynak paketi düzenleyip tekrar
açmak gerekir; notun kendisi herhangi bir kontrolü tamamlamaz.

## Kaynak ve mahremiyet

Kayıt sırasında not yalnız `history_source.original_row.review_notes` içinde
özgün kaynak kanıtı olarak kalır. İş/yakıt/depo kaydının `description`,
`internal_note`, `note` veya `customer_note` alanlarına kopyalanmaz. Aynı kaynak
normal audit ve tam yedekte korunur. Bu, yedeğin özel kaynak metni içerdiği
anlamına gelir; yedek müşteri belgesi değildir.

Kontrol notu müşteri PDF/CSV'sine, iş aramasına, müşteri geçmiş ipuçlarına veya
mazotla ödeme kuralı eşleştirmesine katılmaz. Mevcut **Kontrol PDF’si** de bu
alanı içermez; notun sunulduğu yer aktarım ekranıdır. Şifreli güvenli aktarım
aynı alanı korur, ancak yine yalnız önizleme açar; kullanıcı onayıyla kayıt
gerekir.

Yeni alan fiyat/KDV, ödenmemiş/hakedişe alınmamış olma, yeni kart, tarih sıralı
stok, yakıt seçimi, mükerrer/tombstone, kurtarma yedeği ve atomik kayıt
kontrollerini değiştirmez.

## Kök neden ve mevcut açıklamalar

Taban `89ed872` bu alanı izin listesinde olmadığı için atlıyordu. Açıklamaya
kontrol notu ekleyen bir uygulama davranışı bulunmadı: paketi hazırlayan kişi
veya asistan kontrol metnini `description` içine koyarsa uygulama bunu açıklama
olarak alır. Bu değişiklik üreticiye ayrı bir alan sağlar; metnin anlamını
tahmin ederek eski açıklamaları temizlemez ve kullanıcının yaptığı düzeltmeleri
geri almaz. Kaynak paket hazırlanırken üç alan doğru ayrılmalıdır.

## Kurulu uygulamanın güncellenmesi

Önceki servis çalışanı uygulama dosyalarını önce kendi önbelleğinden okur.
Bu nedenle yalnız JavaScript dosyalarını değiştirmek yeterli değildir:
v3.9.70 yeni bir atomik önbellek adı kullanır. Eski ekran açıkken yeni sürüm
bekler; kullanıcı **Güncelle** ile geçer. Açık form varsa **Vazgeç** değişiklikleri
korur; yalnız açık ikinci onay kaydedilmemiş formu bırakıp yeni sürümü açar.
Güncelleme mevcut kayıtları, audit'i, ekleri veya saklanmış taslakları dönüştürmez.

## Doğrulama

- `node tests/history-review-notes.test.mjs`: eski V1 uyumu, tür/uzunluk sınırı,
  tam kaynak korunması, gerçek önizleme HTML yardımcısında kaçış, açıklama
  düzenlemesi/boş açıklama, iş/yakıt/depo alan ayrımı, müşteri PDF/CSV kaynak
  modelleri, arama ve mazot eşleştirmesinden yalıtım, fiyat/kart/stok/mükerrer
  korumaları.
- `node tests/secure-transfer.test.mjs`: şifreli gidiş-dönüşte ayrı alanın tam
  korunması ve geçersiz kontrol notunun reddi; mevcut güvenlik testleri sürer.
- `python3 tools/e2e/secure_transfer.py http://localhost:8841/`: sentetik düz
  dosya/şifreli önizleme, HTML'in çalışmaması, eski V1, iptal, gerçek IDB/audit
  alan ayrımı, tam yedek/geri yükleme ve 320/390/768 px kontrolleri.
- `record_notes.py`, `customer_snapshot.py`, `operation_history.py`: eski
  açıklamaların kaynak ayrımı, müşteri raporlarının okuma tutarlılığı, geçmiş
  listeleri/filtre/CSV ve salt okunur işlemlerde kayıtların değişmemesi.
- `python3 tools/e2e/upgrade_review_notes.py --source-root .`: gerçek `89ed872`
  uygulamasını aynı profilde kurar; sentetik kayıt, açıklama, kaynak, audit,
  ek dosyasının gerçek baytları ve taslaklarıyla yeni sürüme geçirir. Bekleyen
  gerçek servis çalışanını, iptalde formun korunmasını, açık onayla yenilenmeyi,
  önbellekteki yeni dosyaların SHA-256 eşitliğini ve çevrimdışı yeni önizlemeyi
  doğrular. Servis çalışanı/controller taklidi kullanılmaz.

Yerel Chromium ortam kısıtı nedeniyle ilk tarayıcı denemesi başlamadı. Normal
GitHub-hosted Linux CI üzerinde `secure_transfer`, `record_notes` ve
`customer_snapshot` çalıştı. `operation_history` testinin ilk kurulum/bekleme
yarışı hem adayda hem değişmemiş `89ed872` tabanında görüldü: fixture bildirimleri
henüz tüketilmeden teste başlanıyor, yeni URL ile eski ekran hazır sayılıyordu.
Yalnız fixture hazırlığı ve yeni ekranı bekleme düzeltildi; bütün özgün assert
ifadeleri AST karşılaştırmasıyla aynı tutulur. Aynı düzeltilmiş test ayrıca
değişmemiş eski uygulamada kontrol olarak çalışır.

CI yalnız taslak dalı sınar; `contents: read`, kaydedilmeyen checkout kimliği ve
sentetik profiller kullanır. Genel Node kümesi, dört tarayıcı suiti, eski taban
kontrolü, gerçek sürüm yükseltmesi ve test dosyalarının değişmeme kontrolü son
yayın ağacında birlikte geçmeden sürüm hazır sayılmaz. Güncel çalışma sonuçları
[PR #193](https://github.com/tahirtoprak976-sketch/sahapro-cep-temp/pull/193)
üzerindedir; önceki başarısız çalışmalar başarı diye raporlanmaz.
