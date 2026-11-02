# Asistanın uzun iş listesi desteği — v3.9.98

## Sorun ve karar

Gelen ekranda bir WhatsApp mesajı ve iki fotoğraf, model 20'den fazla iş döndürünce tamamen reddediliyordu. Koruma sessiz satır kesilmesini engelliyordu, ancak günlük toplu giriş için sınır düşüktü. Sadece ilk sınırı değiştirmek yeterli değildi: iş doğrulaması 20'de kesiyor; görev temizleyicisi 30 satır/60 bin karakter; terminal araç parametreleri 16 bin karakter; toplu kontrol 20 iş/30 toplam satır; düzeltme bağlamı 20 bin karakter ile sınırlıydı.

İş limiti **100** olarak ortak `PLAN_LIMITS.works` kaynağına bağlandı. Doğrulama iş listesini dilimlemez. Görev, görev merkezi ve kontrollü geçmiş giriş aynı kapasiteyi taşır. 100 iş + mevcut 10 yakıt kapasiteli toplu taslak desteklenir; diğer işlem gruplarının ve 20 dosya/fiş sınırları değişmez. 101 iş dönmesi, bozuk grup veya sınırı aşan diğer işlem türleri hâlâ hiçbir satırı kesmeden reddedilir.

Plan sınırı 256.000 JSON karakteri, görev kaynak mesajı 40.000 karakter ve toplu taslak 1.000.000 karakterdir. Bunlar sınırsız veri/görev kabulü değildir. Büyük plan terminaline yeterli parametre alanı ayrılır; salt okuma araçlarının 16.000 karakterlik sınırı aynı kalır. Tek terminalde en fazla 200 taslak alan düzeltmesi kabul edilir. Yeni plan büyüklükleri için güncel uygulama kullanılmalıdır; eski sürümler bu büyüklükteki planları okuyamaz.

Düzeltmede önceki planın JSON'u bütünüyle gönderilir; 20 bininci karakterde kesilip geçersiz/eksik bağlam oluşturulmaz. Fazla büyük plan açıkça reddedilir. Büyük kaynak mesajı görevden/görev merkezinden okurken de sessizce kesilmez.

## Model ve kayıt güvenliği

Asistanın araç kullanan çağrısı 32.768 çıktı jetonu ister; bu bütçeyi desteklemeyen eski modelde mevcut küçük bütçeye kontrollü dönüş vardır. Günlük izin/bütçe kapısı her istekte çalışır. `MAX_TOKENS` ile biten bir yanıt geçerli JSON veya araç çağrısı gibi görünse de uygulanmaz. Normal JSON akışının mevcut daha geniş bütçe ile yeniden denemesi korunur. Modelin gerçek okuma doğruluğu ya da her uzun metni mutlaka eksiksiz anlayacağı iddia edilmez; kartları kullanıcı inceler.

20'den fazla işte ekranda işlerin tamamının kontrol listesinde olduğu gösterilir. Kaydetmeden önce iş/araç/müşteri/tarih ve kaynak kontrolleri devam eder. İşlerin miktarları birleştirilmez; fiyat bekletme, kaynak alıntısı, mükerrerlik, yakıt stok kontrolü ve açık kullanıcı onayı korunur. Fotoğraf dizisi veya fotoğraf numaraları yeniden sıralanmaz. Karma fotoğraflı kayıtlar mevcut kayıt yolunu; uygun, fotoğrafsız geçmiş iş/yakıt grubu mevcut atomik toplu kayıt yolunu kullanır.

Kayıt sonucu ilk 20 bağlantıyla sınırlı görünmez: kalan kayıtlar “Diğer N kaydı göster” içinde açılır. Bu bir görünüm gruplamasıdır; kayıt yazımı veya kaydedilen satır sayısı kesilmez. Yerel şema ve mevcut işletme kayıtları değiştirilmez.

## Gerçekten denenenler

- `assistant-large-batch98.test.mjs`: 21, 25, 31 ve 100 satır; doğrulama/toplu planın son satırı; >60 bin JSON; >12 bin kaynak; >20 bin düzeltme bağlamı; fiyat bekletme; 101/bozuk/aşırı planı reddetme; yakıt/fiş limitlerinin korunması.
- `assistant-large-task98.test.mjs`: >16 binlik native terminal argümanı, 100 değişmez satır yaması, tam plan ve kaynağın görev/görev merkezinden geri okunması, aşırı kaynakta yazmama, kapanmış planı tekrar uygulamama.
- `assistant-agent-provider.test.mjs`: eski model çıktı bütçesine dönüş; tam görünen ama `MAX_TOKENS` ile kesilmiş araç çağrısının hiç çalıştırılmaması; mevcut izin ve günlük kota denetimi.
- `assistant_large_batch.py`: gerçek mobil Chromium/IndexedDB. 100 satırlık native planın yeniden yüklenmesi; 100 işin atomik toplu kaydı ve Undo; son satır ve fiyat bekletme. Ardından 25 iş + 38 L yakıt + 250/300 TL gider ve iki fotoğraf; >20 bin karakterlik düzeltme bağlamının kuyruğu; 101 satır ve kesilen model yanıtında eski kart/metin/eklerin korunması; 25 işin tamamı, doğru fotoğraf sahipleri ve 28 kayıt bağlantısı.
- `--baseline-proof`: değişmemiş v3.9.97'de aynı 25 iş + yakıt + iki fotoğraf 20 sınırında reddedilir; iş kaydı yazılmadığı, mesaj ve iki fotoğrafın kaldığı kanıtlanır.
- Mevcut “21 olursa reddet” testleri yeni 101 sınırına taşındı; pozitif 21/31/100 ve sınır sonrası ret ayrı testlerle doğrulanır. Mevcut diğer iş gruplarının sınırları gevşetilmedi.
- Kurulu v3.9.97'den gerçek servis çalışanı yükseltmesi kayıt, fotoğraf ve taslakları korur. Tam CI tüm Node dosyalarını, tarayıcı paketlerini, eski kurulum yükseltmelerini ve karşılaştırmayı çalıştırır. Canlı dosyalar ve ayrı TEST veritabanındaki akış yayın sonrası ayrıca kontrol edilir.

Model yanıtları testlerde taklittir; tarayıcı, form etkileşimleri, IndexedDB ve kayıt kodu gerçektir. Gerçek telefonun kayıtlarına erişilmez veya bu testlerle kayıt eklenmez.
