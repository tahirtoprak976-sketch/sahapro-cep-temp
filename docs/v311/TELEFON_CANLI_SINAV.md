# Telefonda canlı Gemini sınavı — v3.11.05 taslağı

Bu araç asistanın gerçek Gemini yanıtlarını, sahibin onayladığı 20 takma adlı
mesajla ölçer. Telefonun gerçek işletme veritabanı okunmaz; fixtür RAM'dedir.
Yalnız `TEST_V311_…` adlı ayrı veritabanındaki mevcut meta tablosu,
izin/günlük bütçe/sayaç için kullanılır. İş, kasa, cari, şoför bağlantısı veya
yedek oluşturma/aktarma yolu yoktur. Yeni tablo veya kayıt biçimi gerekmez.
Aynı origin'de ad ayrımı güvenlik izolasyonu değildir; test kodu yalnız kendi
TEST adını açtığını tarayıcı kontrolünde doğrular.

Anahtar şifre alanına telefonda girilir, IndexedDB/localStorage/rapora
kaydedilmez. Yalnız Google API'ye gider. Sayfa açılınca otomatik model çağrısı
yapılmaz. Kullanıcı izin ve ücretsiz hesap doğrulamasını işaretler; günlük
sınırı seçer; modelleri bir istekle listeler ve modeli kendisi seçer. Model adı
sabit değildir. Ücretsiz erişim/kota sağlayıcıya bağlıdır; araç faturalandırma
açmaz. Her istek mevcut gatedFetch ve assistantRequestScope yolundadır.
Sayacı yeniden yükleyerek sıfırlamaz; iptal yeni istekleri keser.

Üç tekrarda 20 tekil + 1 toplu = 63 örnek isteği, model listesiyle 64 istek
vardır. Bir tekrarlı seçenek 21 örnek içindir. Her örneğin tek ağ isteği ve
90 saniye sınırı vardır. Ağ/kota/iptalde koşu eksik kalır; yerine eski JSON
konmaz. Sınav bağlam tarihi fixtürdeki tarihtir, telefonun saati değişmez.

## Aynı sınav, aynı puanlayıcı

Node ve tarayıcı aynı fixtür ve measureReal modülünü kullanır. Yeni test-JSON
okuyucusu yalnız Node fs / tarayıcı fetch farkını giderir. Taşımadan önce ve
sonra toplu dondurulmuş rapor birebir aynıydı; beklenen kartlar ve kayıtlı
model yanıtları değiştirilmez. Çıktıda ham yanıtlar, kaynak SHA, model,
tekrarlar ve kategori ölçümleri vardır. Gizli anahtar içeren JSON indirilmez.
`safety.measured` canlı bağımsız para güvenliği kontrolü yapılana kadar false
kalır; yanıtları almak yayın kabulünün geçtiği anlamına gelmez.

Boş taklit model yanıtı için testin ilk varsayımı “0 hazır kart” idi. Değişmemiş
f37b04f doğrulayıcısında da yerel kanıt doldurma 25/38 kart hazırlıyor: tekilde
4, topluda 3 yanlış alan, 3 gereksiz soru, 0 sessiz yanlış. Telefon testi bu
bilinen sonucu ve altı koşunun gerçekten puanlanmasını doğrular; 38/38 veya
gerçek model başarısı üretmez. Eski testler/beklenen sonuçlar gevşetilmez.

## Paket

Önce kaynak commit edilir. Ardından:

```
python tools/preview/build_phone.py --output /tmp/SAHAPRO_TELEFON_TESTI.zip
```

Derleyici yalnız git'teki o commitin uygulama modüllerini ve onaylı sınav
fixtürünü alır. Çalışma klasörünü, .git'i, anahtarı veya yedeği kopyalamaz.
Kaynak SHA ve dosya hashleri pakettedir. Servis çalışanı kaydedilmez;
kurulu canlı PWA'nın önbelleği temizlenmez. Paket HTTPS statik test yolunda
sunulur. Bu paketin yayınlanması, ana uygulamanın v3.11'e geçirilmesi değildir.

Telefonda: sınavı aç → kaynak sürümünü kontrol et → anahtarı telefonda gir →
izin ve bütçeyi seç → modeli listele/seç → canlı ölçümü başlat → raporu indir.
Gerçek WhatsApp panosu, düşük parlaklık, seri kamera ve kapanış süresi için
fiziksel uygulama kabulü ayrıca yapılır; bu rapor onun yerine geçmez.
