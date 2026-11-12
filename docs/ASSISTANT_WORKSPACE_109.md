# Asistan çalışma alanı — v3.10.09 (yeni görev)

Taban: canlı v3.10.08 / `fc56ee3`. Önceki #234 adayı engelli taslak olarak durur; bu dal o adayın birleştirilmesi değildir. Müşteri, şantiye, araç ve personel oluşturma ile profesyonel mobil asistan isteği için canlıdan ayrı hazırlanır.

Müşteri oluşturma daha önce yalnız belirli fiilli mesajlarla bulunabiliyordu; görünür başlangıç düğmesi yoktu. “Yeni müşteri”, “Müşteri oluşturmak istiyorum” gibi açık istekler yerelde karşılanır. Şantiye için bağımsız yerel kart oluşturma eklendi. Şantiye müşterisi açıkça seçilir; müşteri eksikse aynı akışta müşteri oluşturulup şantiye adı/adresi korunarak geri dönülür. Model ve anahtar gerekmez. Butona basılmadan yalnız taslak gösterilir.

Şantiye adı + müşteri eşleşmesi, geçerli müşteri ve sohbet dönemi aynı IndexedDB yazma işlemi içinde doğrulanır. Eşzamanlı aynı istek tek kart ve tek denetim kaydı üretir. Var olan adres üzerine yazılmaz; eksik/pasif müşteri ve eski sohbet onayı reddedilir. Denetim yazması bozulursa kart da geri alınır. İş, borç, tahsilat, fiyat veya sözleşme oluşmaz.

Mobil başlangıç paneli, açık kayıt adımları ve kart oluşturma düğmeleri yenilendi. Kart formu açıkken mesaj kutusu sabit durup alanların üstünü kapatmaz. Açık taslağın yerine yeni kart açmadan önce açık seçim istenir. Dosya/sohbet kurulumundan önce yazmaya başlanıp mesajın kaybolmaması için mesaj kutusu ilk çizimden hazır olana kadar salt okunurdur; mevcut taslak yarışı testi korunur.

Şema7 ve kayıt biçimi değişmez. Yeni kayıtlar mevcut `customers`, `sites` alanları ve mevcut metadata yapılarıyla açılır. Sohbet biçimine yeni alan/intent eklenmez. YZ2, para güvenliği, Gemini sağlayıcısı/ücret politikası ve KDV kararı değişmez. Gerçek işletme verisi/yedek/şoför bağlantısı kullanılmaz.

## Ölçüm (dondurulmuş yanıt)

| Ölçüt | v108 | Aday |
|---|---:|---:|
| Genel doğru işaretli | 30/73 | 30/73 |
| Sessiz yanlış / para tahmini / zorunlu işaret ihlali | 0/0/0 | 0/0/0 |
| Takma adlı 20 mesaj, tek tek hazır doğru | 23/38 | 23/38 |
| Toplu hazır doğru / gereksiz soru | 15/38 / 21 | 15/38 / 21 |

Bu paket modelin anlama oranını artırdığı iddiasında değildir; kart oluşturma ve kullanılabilirlik sorunlarını giderir. Gerçek Gemini, telefon ve WhatsApp denenmedi.

Yeni tarayıcı testi değişmemiş v108'de görünür müşteri/şantiye başlangıcının yokluğunu göstererek düşer; adayda müşteri→şantiye zinciri, korunmuş taslak, açık onay, mükerrer/eşzamanlı kayıtlar, eksik müşteri, eski sohbet, işlem geri alma ve 320/360/768/1280 genişlikleri geçer. Eski müşteri ve asistan çalışma alanı testleri değiştirilmeden geçer. Hakediş hazırlığı adayda yerel olarak geçti; önceki adayın CI sorunu bu çalışma tarafından çözülmüş sayılmaz.

Tam CI, yükseltmeler ve canlı doğrulama henüz tamamlanmadı. Bu sürüm taslaktır; bütün kapılar geçmeden birleştirme/yayın yapılmaz.

Araç/makine ve personel kartları da görünür başlangıçlardan ve açık oluşturma mesajlarından yerelde hazırlanır. Araç türü kullanıcı tarafından seçilir; addan tahmin edilmez. Plaka eşleşmesi mevcut kartı gösterir, başka plaka altında aynı adlı ayrı araç açılabilir. Plakasız araç ve personelde aynı ad mevcutsa ikinci kart açılmaz; mevcut kart gösterilir. Eşzamanlı aynı kimlik tek kayıt ve denetim üretir. Önceki telefon/plaka üzerine yazılmaz. Serbest alanlarla ücret, avans, yakıt, bağlantı anahtarı veya başka bir kayıt türü oluşturulamaz; yazıcı yalnız izinli alanları alır.

Şantiye içinden müşteri açarken vazgeçme düğmesi şantiye taslağına geri döner; ad/adres korunur. Başlangıç düğmeleri ekleri Gemini'ye göndermeden yerel form açar. Mesaj alanı ve başlangıçlar kurulum bitmeden etkinleşmez.

Yerel kanıt: müşteri/site/araç/personel kullanıcı akışı, plaka çakışması, izinli alanlar ve eşzamanlı personel kayıtları testi geçti. Mevcut müşteri ve iş akışı beklentileri değişmedi. Tam CI hedefi 193 Node dosyası, 89 tarayıcı süiti, ayrı 10 assistant_turn ve 39 yükseltme komutudur. Bu yeni görevin CI denemeleri henüz başlamadı; iki başarısız tam kapıda durma sınırı korunur.
