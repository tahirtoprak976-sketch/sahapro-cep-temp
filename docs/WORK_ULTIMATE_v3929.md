# SOLO v3.9.29 — İş Kayıtları kontrolü ve filtreli aktarım

Bu paket mevcut işleri bulmayı ve okumayı kolaylaştırır. İş, fiyat, hakediş, tahsilat veya müşteri bakiyesi yazmaz. İşletme şeması 5; YZ2 ve şoför protokolü değişmez.

## Günlük kullanım

İşler ekranında tarih ve kayıt durumu ayrı seçimlerdir. Tüm tarihler / Bugün / Son 7 gün / Bu ay; bunlarla birlikte Tüm işler / Fişsiz / Fiyatsız / Müşterisiz / Şoförden seçilebilir. Fişsiz, sistemde fiş bağlantısı, dijital fiş numarası veya açık “Fiş Var” durumu bulunmamasıdır; yalnız fiş numarası yazılması fotoğrafın varlığını kanıtlamaz.

Filtreler bölümünde özel başlangıç/bitiş, müşteri, şantiye, araç, personel, iş türü ve birim birlikte süzülür. Müşteri değişince ona ait olmayan şantiye seçimi temizlenir. Seçili filtreler görünür düğmelerdir; tek tek kaldırılabilir. Müşteri filtresi kaldırılırken ona bağlı şantiye de kaldırılır. Filtre paneli her aramada tekrar açılıp listeyi aşağı itmez; hatalı tarih düzeltmesinde açık gelir.

Arama; müşteri/şantiye/araç/personel, iş türü, açıklama, malzeme, fiş no ve dijital fiş noyu kapsar. Arama ve durum seçimi diğer filtreleri kaybetmez. Tarih kısayolu özel tarih aralığını kaldırır ama müşteri/araç/personel gibi seçimleri korur. Yarım saniye dolmadan arama yazıp kısayola basıldığında en son metin korunur; önceki ekranın arama zamanlayıcısı kullanıcıyı eski filtreye geri götürmez.

Filtreler URL'dedir; sayfa yenileme ve tarayıcı geri/ileri hareketlerinde korunur. Tümünü temizle bütün filtreleri kaldırır. Son 7 gün, bugün dahil tam yedi yerel takvim günüdür; önceki sürümde alt sınır yedi gün geriye gittiği için sekiz gün kapsayabiliyor, gelecek işleri de alabiliyordu. Bu ay ayın ilk gününden bugüne kadardır. Tüm tarihler görünümü mevcut ileri tarihli kayıtları saklamaz.

`?from=...&to=...` asistan/grafik bağlantıları çalışmaya devam eder. Tek `from` aynı günü ifade eder. Tek `to`, o tarihe kadar olan gerçek tarihli kayıtları getirir. Hatalı veya ters tarih aralığında eski liste/özet/CSV gösterilmez; düzeltme uyarısı vardır. Kapsamlı tarih filtresinde tarihsiz kayıtlar sayılmaz; tüm tarihlerde mevcut Tarih belirtilmemiş grubunda kalabilir.

## Kartlar ve özet

Müşteri adı ile miktar, iş türü/şantiye ve araç/personel ayrı satırlardadır. Uzun müşteri adları zorunlu tek satıra sıkışmaz. Fiş, fiyat eksikliği, şoför kaynağı ve mazot karşılığı etiketleri görünür. Kartın kendisi normal bağlantıdır; klavyeyle açılabilir.

Gerçek iş tarihine göre gruplama ve bir günü sayfalara bölmeme korunur. Daha eski tarihler düğmesi sonraki grupları yükler. Üstteki iş sayısı, gün sayısı ve birim özetleri **bütün filtre sonucudur**; yalnız yüklenen sayfa değildir. Sefer, saat, ton vb. ayrı tutulur. Özet alacak, ciro, hakediş veya kâr değildir.

Fiyatsız denetimi dikkat listesiyle aynı esasları kullanır: müşteri seçili olmalı; iç müşteri, açık sıfır fiyat, fiyat anlık görüntüsü, mazot karşılığı ve sözleşmeye dahil iş fiyat eksiği diye gösterilmez. Bu paket kayıtlara fiyat uygulamaz.

## CSV

Filtreli CSV, aynı kapsamın tüm satırlarını mevcut müşteri/araç/personel adlarıyla çıkarır. Filtre, sayfa veya dışa aktarma işlemi kayıt yazmaz. UTF-8 BOM ve noktalı virgül kullanılır; çift tırnak, satır sonu ve formül başlatan değerler kaçırılır. Kullanıcının müşteri/açıklama metnindeki `=`, `+`, `-`, `@` gibi başlangıçlar elektronik tabloda formül olarak çalıştırılmaz.

Üstteki eski rapor düğmesi “Rapor merkezi · ayrı filtreler” olarak adlandırıldı: ayrı rapor ekranı bu listenin tüm durum filtrelerini devralıyormuş gibi sunulmaz. Mevcut toplu fiyat düğmesi “Tüm işlerde fiyat uygula” der ve onayında bu ekranın filtreleriyle sınırlı olmadığını açıklar; fiyatlandırma algoritması bu pakette değiştirilmedi.

Dosya, tarayıcı desteklerse paylaşım paneline verilir; aksi halde indirilir. İptal iş verisini değiştirmez. Gerçek WhatsApp/e-posta gönderilmez; tarayıcı paylaşım panelinin teslim bilgisi yoktur. CSV finansal hakediş belgesi değildir; tutar/KDV/bakiye hesabı eklenmemiştir.

## Doğrulama

Sentetik verili gerçek Chromium; gerçek IndexedDB, indirme ve service worker ile:

- `node tests/work-explorer.test.mjs`: yedi gün sınırı, gelecek/tarihsiz kayıtlar, birleşik filtreler, fiyat eksikliği istisnaları, tarih doğrulama, URL parametreleri, CSV kaçırma ve prototip adıyla birim toplama.
- `python3 tools/e2e/work_ultimate.py`: 40 kaydın tek tarih grubunda korunması; 80 Sefer özeti; fiş no araması/tarih-müşteri kapsamı; hızlı yazıp filtre değiştirme; ayrı birimler; sayfalama; indirilen CSV'nin satır/kolon/formül kontrolü; 43 filtreli kayıt olup 41'i yüklenmişken tüm 43'ünün CSV'ye çıkması; müşteri/şantiye bağımlılığı; yeniden yükleme; tek filtre kaldırma; hatalı/ters tarihte eski sonuç göstermeme; sıfır fiyat; 320/360/768/1280 px görünüm; kaçırılmış kötü amaçlı etiket; gerçek SW ile tam çevrimdışı yenileme. Kayıtlar ve audit öncesi/sonrası birebir; AI çağrısı yok.
- Mobil genel tarama: 131 ekran, 0 sorun.
- Node: 88/88 dosya; syntax: 124 dosya; SW: 123 modül.
- Önceki şoför paketi: 23/23; işletme panosu, gerçek offline pano ve redteam paketleri geçti.

Bu ortam fiziksel telefondaki uygulama mağazası/işletim sistemi paylaşım panelini doğrulamaz. CSV masaüstü Excel'de açılmadı; dosyanın gerçek baytları standart CSV okuyucuyla doğrulandı. Ücretli servis eklenmedi.
