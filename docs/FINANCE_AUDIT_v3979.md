# v3.9.79 — Finans incelemesi ve onarımlar

Taban: canlı v3.9.78, `6c75c4e5e99b2c75cd71653e01a6a0d7e88fa8c3`. Şema7 korunur. Gerçek telefon verisine erişilmedi; geçmiş iş aktarımı yapılmadı. YZ2 kapsam dışıdır.

## Kaynak incelemesi

Cari/tahsilat için `collect-core`, `vat-contract`, `statement`, `db.saveCashEvent`; hakediş için snapshot ve kesinleştirme korumaları; banka/borç/maaş için `enterprise-core` ve `enterprise-db`; finans/araç grafikleri için `finance-chart`; maliyet için `costs-core`, `ledger-policy` ve döküm bağlantıları; nakit planı için `cashflow-core` ve ekranı incelendi. Mevcut testler kaynak fiyat, gerçek tahsilat, mazot litresi, stok, faaliyet maliyeti, alış ve ödeme ayrımlarını ayrıca sınar. Bu inceleme bütün olası hataların bulunmuş olduğu iddiası değildir.

## Doğrulanan hatalar ve çözüm

1. Nakit girişinde `1000.5` biçimindeki ön değer değiştirilmeden onaylanınca `10005` oluyordu. Türkçe binlik/virgül ve noktalı ondalık açıkça ayrılır; boş/bozuk giriş mevcut tutarı değiştirmez.
2. 100 TL alacak, 100 TL söz ve 80 TL çek ile 180 TL tahsilat beklenebiliyordu. Çek payı önce ayrılır; söz yalnız çek dışında kalan alacağa uygulanır.
3. Nakit planı, Ödeme Takibi'nin kontrol istediği yanlış tarafa bağlı ödemeyi borçtan düşebiliyordu. İki ekran artık aynı borç doğrulamasını kullanır. Belgeye bağlanmamış ödeme tek borç var diye atanmaz. Eksik kayıtlar ayrı kaynak bağlantılarıyla görünür ve güven verici “para yeter” mesajı engellenir. Açık çek ile tedarikçi borcu aynıysa kullanıcıya kontrol gösterilir; taraf eşitliğinden borç eşitliği çıkarılmaz.
4. Kuruşlu kesin borçlar tam TL'ye yuvarlanıp küçük tutarlar kayboluyordu. Plan kalemleri ve ekran iki ondalık basamağı korur. Personel Ödedi / Bekliyor giderleri geri ödeme ihtiyacı olarak bir kez planlanır.
5. Aynı ayın ileri tarihli iş, tahsilat ve gideri bugünkü aylık özeti büyütüyordu. Aylık grafik, finans özeti ve sabah özeti `today` sonrasını saymaz. Nakit planında ileri tarihli tahsilat bugünkü alacağı azaltmaz; ileri tarihli cari kayıt ayrıca kontrol listesine çıkar. Ödeme alışkanlığı da ileri tarihli tahsilattan öğrenilmez. Cari ekranının bütün kayıtları içeren mevcut bakiye politikası değiştirilmedi.
6. Kasa işlem kimliği karşılaştırması işlem türünü ve parayı taşıyan personeli kapsamıyordu. Tür, taraf ve kaynak iş bağları karşılaştırılır. Aynı içerik tek kaydı döndürür; farklı içerik OP_CONFLICT olur. Sadece teslim durumu ilerlemesi yeni tahsilat üretmez.
7. Tekil/toplu tedarikçi ödeme kimliği farklı içerikte de eski ödeme döndürebiliyordu. Tarih, belge/tedarikçi, tutar, yöntem ve banka kontrol edilir. Geri alınmış toplu ödeme aynı kimlikle yeniden canlandırılamaz.
8. Tahsilat tarafı işlemden önce okunuyordu; kart arada silinirse sahipsiz tahsilat yazılabiliyordu. İlgili kartlar ve şantiye müşterisi kasa/cari/audit/işlem kimliği ile aynı transaction içinde yeniden kontrol edilir. Kart değişmişse hiçbir mali kayıt veya işlem fişi kalmaz.

## Kullanım iyileştirmesi

Finans ana ekranında bu ayki müşteri tahsilatı **Personelde**, **Teslim bildirildi / onay bekliyor**, **Kasaya teslim edilmiş** ve **Banka kaydı** olarak ayrılır. Toplam kasa/banka bakiyesi olduğu iddia edilmez. Eski kayıtta durum eksikse varsayımla sınıflandırılmaz. Nakit planındaki söz/vade, gerçekleşmiş para ya da ödeme garantisi olarak sunulmaz.

## Korunan sınırlar

- Cari bakiye yöntemi değiştirilmedi: henüz hakedişe girmemiş iş kaydedildiği fiyat temelinde; kesinleşmiş hakediş brüt; tahsilat gerçek para. Net/brüt politikası için önceki karar notu geçerlidir. v3.9.78'deki ana para/KDV ayrımı ve uyarılar korunur.
- Fiyatı olmayan iş bedelsiz değildir; %0 KDV geçerlidir; eksik KDV oranına yeni görünümde %20 atanmaz. Kesinleşmiş kaynaklar yeniden fiyatlanmaz.
- Personeldeki müşteri parası kasaya teslim değildir. Müşterinin verdiği mazot masraf değildir; litre hak/teslim ayrımı ve tarih sıralı depo korunur.
- Depo/döküm hesabına para yatırmak tek başına faaliyet gideri değildir. Alış ile kaynağı, ücret tahakkuku ile ödemesi, çek ile borcu iki ayrı kesin ödeme sayılmaz.
- Kaydı olmayan vergi/SGK/kredi veya fiziksel gerçek kasa tutarı tahmin edilmez. Kayıtlı vade/söz gerçekleşmezse nakit senaryosu da gerçekleşmez.

## Kanıt ve test planı

`baseline-probe.mjs` ve yeni Chromium denemesi değişmemiş v3.9.78'de tutar, tarih ve işlem kimliği hatalarını yeniden üretti. `finance-audit79.test.mjs` saf hesapları; `finance_audit79.py` gerçek IndexedDB çatışmalarını, kart silme yarışını, ondalıklı formu, belirsiz borç ekranını ve tahsilatın konumunu sınar. Eski nakit testi artık gerçek kayıt durumu Onaylandı kullanır ve belgesiz ödemenin varsayımla borçtan düşülmediğini doğrular. Son PASS sayısı teslim commit'inin CI çıktısından alınır.

İlk tam CI'da 153 dosya, 41 tarayıcı paketi ve 9 yükseltme geçti; eski v3.9.74'ün SVG saldırı kanıtı ana sayfadaki localStorage işaretini beklerken durdu. Kanıt artık blob sekmesinin uygulamayla aynı origin'de çalıştığını ve o sekmede test IndexedDB değerinin gerçekten okunup işarete yazıldığını doğrular; ana sayfanın localStorage önbelleğinin sekmeler arasında güncellenmesine dayanmaz. Aynı test verisi / betik / ağ engeli korunur; adayın SVG reddi ve karantina koşulları değişmez. Finans ekranı görüntüsü de kapanan modal kaldırıldıktan sonra alınır.
