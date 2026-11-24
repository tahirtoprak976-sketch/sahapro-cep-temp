# Asistan incelemesi — v3.10.23

## Amaç ve kanıt sınırı

Kullanıcı, PDF dışındaki normal mesajların da sürekli “yoğun” hatası verdiğini bildirdi. Telefonun anahtarı, gerçek belgeleri veya gerçek kayıtları alınmadı. Kaynak incelemesi, sentetik kayıtlar, yerel Node/Chromium testleri ve Google'ın birincil dokümanları kullanıldı. Kullanıcının gerçek Gemini/Neon erişimi bu ortamdan doğrulanamaz. Taklit HTTP yanıtlarında başarı, Google hizmetinin erişilebilirliğini kanıtlamaz.

## Bulgular ve düzeltmeler

| Bulgu | Önce | Sonra / doğrulama |
|---|---|---|
| Bekleyen PDF, selamlaşmayı da model isteğine dönüştürüyordu | Yerel sohbet dalı yalnız ek yokken çalışıyordu | Tam selamlaşma/teşekkür ifadeleri ek varken de yerelde cevaplanır; dosya korunur ve okunmadığı söylenir. 4 mesajda 0 HTTP. İş talimatı içeren cümle bu kısa yola girmez. |
| Kısa yazı için aşırı geniş çıktı sınırı | Araçlı istekte 32.768 token sınırı | Asistan kısa yazıda 8.192, uzun dökümde 32.768 ister. Bu sınırdır; harcanan token veya gerçekleşmiş hız kazancı değildir. Genel sağlayıcı fonksiyonunun eski varsayılanı ve eski model sınırına geri dönüş testi korunur. |
| Normal yazı başlangıcında toplu işletme bağlamı | 150 müşteriye kadar tüm müşteri listesi; ilgili olmayan bakiyeler/facts | Yalnız yazı araçlı yolunda başlangıçtan kaldırıldı. Model ilgili kayıtları salt okunur find_records/get_records ve yerel hesap araçlarıyla ister. Global gerçekler, telefondaki cevap doğrulamasında kullanılmaya devam eder. Belge okuma yolundaki mevcut bağlam bu pakette ayrıca değiştirilmez. |
| Belgeye soru sorunca paralel ikinci model | Medya okuması yanında bağımsız askWithTools çağrısı açılabiliyordu | Ekli belge/ses tek okuma yolunda kalır. “Bu PDF hangi araç için?” 1 model çağrısıyla denetlendi. |
| Modern model parametre uyumu | Her aileye temperature:0 | Gemini 3+ için varsayılan örnekleme; eski ailelerde mevcut ayar. Model adı sabitlenmedi. Google, yeni ailelerde özel örnekleme alanlarını kaldırmayı/varsayılanda bırakmayı öneriyor. |
| Küçük bağlantı ile büyük asistan isteği ayırt edilemiyordu | Ayrı kullanıcı aracı yok | Asistan → Bağlantı: seçili modele tek kısa istek. Sistem yönergesi, araçlar, mesaj, dosya ve işletme kayıtları gönderilmez. 200 yalnız bağlantı sonucu; belge okunmuş sayılmaz. |
| Hata bilgisi yetersizdi | Genel mesaj, eksik HTTP/model sınıflaması | 401/403, 400, 429, 503, yerel bütçe ve iptal ayrılır. Panelde model/kod/HTTP gösterilir; anahtar ve ham sağlayıcı metni teşhis paneline yazılmaz. |

## Korunan sınırlar

- Şema8; kalıcı işletme kayıt biçimi veya eski kayıtlar değiştirilmedi.
- Yeni bağlantı testi mevcut atomik izin/günlük bütçeden geçer; 0 bütçede 0 HTTP. Otomatik döngü yok; tek istek.
- Küçük testte ayrı 15 saniye sınırı ve Durdur; normal asistanın 90 saniye sınırı, 503 geri çekilmesi ve kullanıcı iptali korunur.
- İş, tahsilat, personel para hareketi ve mazot yönleri; beş zorunlu işaretsiz kart; Kaydet, işlem kimliği, revizyon, mükerrer belge/fiş ve şoför imza kapıları korunur.
- Eski kontrol kartları, yazılmış mesaj ve bekleyen ekler bağlantı testiyle değiştirilmez. Yeni veritabanı deposu veya sürekli hata günlüğü yok; teşhis paneli geçici bellektedir.
- Salt okunur araçlar, araç imzası/call-ID devamı, bilinmeyen araç reddi, yarım kalmış yanıt reddi ve kapalı görevi yeniden uygulamama korunur.
- Ücretli hizmet, sunucu veya sağlayıcı eklenmedi; YZ2/yerel model değişmedi.

## Test kanıtı

- Yeni aynı Node testi değişmemiş v3.10.22'de SHORT_REQUEST_BUDGET_MISSING ile kırmızı: 32.768 yerine 8.192 istenemiyordu.
- Yeni test: modern/eski model ayarı, yerel tam ifade eşleştirme, gizli veri göndermeyen tek istek, 503/403/401/400 ayrımı ve bütçe0.
- Gerçek Chromium: bekleyen özgün PDF ile 4 yerel mesaj, küçük bağlantı isteği, 503/403, iptal, bütçe0, normal araçlı yorum, ilk istekte alakasız müşteri göndermeme, belge sorusunda tek model, 320/360/768 genişlik.
- Kurulu v3.10.22 → aday: gerçek SW güncellemesi, tüm kayıt/meta/taslak/eklerin birebir korunması, yeni modül ve çevrimdışı tekrar açılış.
- Mevcut Node, tüm tarayıcı ve yükseltme kapıları PR'da ayrı çalışır. Başarılı olmadan merge/yayın yapılmaz.

Fiziksel Android, gerçek WhatsApp, gerçek Gemini/Neon ve kullanıcının gerçek belgesi denenmedi. Özellikle 503'ün Google tarafında devam etmeyeceği söylenemez. Bağlantı panelindeki küçük test, telefondaki gerçek model erişimini belgesiz ölçmek içindir.

## Birincil kaynaklar

- https://aistudio.google.com/docs/troubleshooting — model parametreleri, varsayılan örnekleme ve sınırlı tekrar.
- https://aistudio.google.com/docs/api-errors — 400/401/403/429/503 ayrımı. Interactions API adları ile generateContent ayrıntıları aynı varsayılmadı; uygulama HTTP statüsünü ve kendi hata sınıfını gösterir.
