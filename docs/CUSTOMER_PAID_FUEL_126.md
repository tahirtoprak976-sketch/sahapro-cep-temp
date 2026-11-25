# Müşterinin ödediği istasyon yakıtı — v3.10.27

İş sahibi, bu sohbette onayladığı mevcut yakıt mahsubunu koruyarak fiziksel yakıt kaydının tamamlanmasını istedi. Yeni kayıt ve bağlantı eklenir; önceki cari hareketin hiçbir alanı değiştirilmez. Şema8 ve mevcut işletme kayıt biçimleri korunur. Yeni menü/sunucu/sağlayıcı yoktur.

## İş anlamı

Müşteri istasyondan makinenin yakıtını öder. Bu, depodan çıkış veya müşteriden mazot hakkı teslimi değildir. Yeni standart `fuel_records` kaydı: istasyon kaynağı, gerçek tarih/araç/personel/litre, ödeyen müşteri ve açıklama. Aynı müşteriye ait kaydedilmiş onaylı cari Duzeltme ile ilişki mevcut meta deposunda tutulur. Kasa/banka/depo/gider kaydı ve ikinci cari hareket oluşmaz.

`reference` fiyat dayanağı: mevcut anlaşılmış cari tutar korunur; fiziksel yakıt kaydında `unit_price:null`, `total:null`, `cost_source:"Müşteri ödedi · fiş maliyeti bekliyor"`. Referans gerçek fiş bedeli sayılmaz. Litre araç yakıt geçmişine girer, maliyet bilinmeyendir; işletme sonucu ve ilgili finans/araç raporları kesin kâr hesaplamaz. Bu, ölçülmüş motor tüketimi değildir.

`receipt` dayanağı: yalnız sohbette açıkça doğrulanmış gerçek tutar fiziksel yakıta maliyet yazılabilir. Eski referans mahsubunu bu gerekçeyle otomatik değiştirme/yeniden fiyatlama yoktur. Sonradan fişle tutar düzeltme ayrı, somut onaylı iş gerektirir; bu sürüm eski kayıtları topluca düzeltmez.

## Aktarım

Aynı mevcut belge/mahsup izni ve SPAR1 bağlantısı kullanılır. V1 aynen desteklenir. V2: `{format:"SAHAPRO_REMOTE_ACTIONS_V2",id,approved,offsets,documents,fuel_links}`. Her fuel_links satırı V1 offset alanlarının aynısını taşır; `source_key` yeni yakıt kaynağı, `offset_source_key` kaydedilmiş offset kaynağıdır. Kaynak tarih/müşteri/araç/personel/litre/fiyat/toplam/gerekçe/dayanak metni önceki onaylı kaynakla SHA-256 üzerinden aynı olmalıdır. Telefon, eski kaynak metası ve mevcut cari tutar/müşteri/tarihini transaction içinde denetler. Yanlış/silinmiş/değişmiş mahsupta durur. Mevcut cari kimliği açıklamada korunur.

V2 yalnız mevcut mahsuba yakıt bağlayabilir; yeni açıkça onaylı işlem için offsets+fuel_links aynı transaction'da da taşınabilir. Model çıktısı yetki değildir; CLI yalnız somut sohbet onayı sonrası çalıştırılır. Gerçek mesajlar/paketler/anahtarlar repo dışında kalır; yalnız AES-GCM kutusu yayımlanır. İzin/oturum/form/süre/şoför kapıları aynen sürer.

## Tekrar, düzenleme ve yedek

Global mahsup-kaynak bağlantısı: `meta customer-paid-fuel:<offset_source_key>`. Aynı mahsup başka paket/kaynak kimliğiyle tekrar gönderilse ikinci yakıt/cari oluşmaz. Aynı araç/tarih/litreyle zaten yakıt veya geçmiş mutabakat varsa ikinci fiziksel kayıt yerine inceleme istenir. Silinmiş bağlantı diriltilmez.

Yeni yakıt, kaynak metası, bağlantı ve makbuz tek transaction'da yazılır; öncesinde tam kurtarma yedeği alınır. Makbuz hatasında bütün yeni yazmalar geri alınır. Bağlandıktan sonra normal yakıt/cari düzenleme, düşük seviye put, depoya çevirme, silme ve tek taraflı geri yükleme ilişkiyi bozamaz. Eski cari hareketin tutarı/açıklaması/müşterisi bu özellik tarafından yazılmaz. Bağlı yakıtın araç/personel kaynak kartı tek başına birleştirilemez; kullanıcıya bağlantıyı incelemesi söylenir. Müşteri kartı birleştirmesinde standart aynı işlemde müşteri referansları korunur.

Tam yedek mevcut yakıt/cari ve meta ilişkiyi taşır. Yeni telefona dönüşte eşleşme korunur; yetki kendiliğinden açılmaz. Bir tarafı veya bağlantısı eksik yedek reddedilir; kayıtlar yarım aktarılmaz.

## Görünüm ve doğrulama

Yakıt listesinde ödeyen müşteri; yakıt detayında mevcut mahsup tutarı ve müşteri carisine bağlantı gösterilir. Bu yakıtta depoya çevirme/silme ve tekrar tedarikçi borcuna yazma seçenekleri sunulmaz; doğrudan kayıt çağrısı da reddedilir. Maliyet bilinmiyorsa açıkça gösterilir.

Sentetik testler: v3.10.25 aynı V2 sözleşmesini PAID_FUEL_LINK_NOT_SUPPORTED ile reddeder, aday kabul eder. Eski V1 offset, belge ve depo yolları korunur. Yeni Node/tarayıcı: eski cari byte-identical, fiziksel istasyon litreleri, sıfır yeni kredi/kasa/depo, müşterinin mazot hakkına karışmama, referansı sıfır maliyet saymama, aynı/yeni paket tekrarı, yanlış kaynak/tarih/para, 6 düzenleme/borçlandırma yolu, atomik rollback, tam yedek/restore ve eksik bağlantı reddi, 360px. Kurulu v3.10.25→26 yükseltmesi eski kayıt/dosya/meta/taslakları korumalı; bütün CI kapıları geçmeden yayın yoktur.

Gerçek telefon, gerçek Gemini/WhatsApp ve gerçek fiş testte kullanılmaz. Gerçek işletme yakıtı yalnız kullanıcı tarafından onaylı kaynakla, yayın sonrası ayrı şifreli teslimdir; makbuz gelmeden kaydedildi denmez.

## Güncel tabanla birleşim

Çalışma sürerken canlıya gelen v3.10.26 günlük Saha Akışı ve kayıt yenileme koruması aynen korundu. Yakıt özelliği bu tabanın üzerine v3.10.27 olarak birleştirildi. İki akışın modülleri, testleri ve CI adımları tutuldu; güncel kurulu26→27 yükseltmesi ve bütün birleşik testler yayın kapısıdır.
