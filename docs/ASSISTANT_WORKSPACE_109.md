# Asistan çalışma alanı — v3.10.09 (yeni görev)

Taban: canlı v3.10.08 / `fc56ee3`. Önceki #234 adayı engelli taslak olarak durur; bu dal o adayın birleştirilmesi değildir. Müşteri ve şantiye oluşturma ile profesyonel mobil asistan isteği için canlıdan ayrı hazırlanır.

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

Tam CI, yükseltmeler ve canlı doğrulama henüz tamamlanmadı. Bu sürüm taslaktır; bütün kapılar geçmeden birleştirme/yayın yapılmaz. Araç/personel başlangıçlarının kapsamı ve testleri son uygulamaya göre PR'da güncellenecek.
