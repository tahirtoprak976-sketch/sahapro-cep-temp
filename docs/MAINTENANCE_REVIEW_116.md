# Bakım, doğrulanmış sayaç ve tek harcama — v3.10.17

Taban: v3.10.16 / `87411c0642bab0ed3f3f1acbaf6f5d5865fc3567`. Tahir yeni bakım kayıtlarında `cost_mode`, `cost_source_store`, `cost_source_id`, `meter_reading_id` eklenmesini açıkça onayladı. Şema **8** kalır; eski kayıtlara alan eklenmez, geçmiş kayıt/fotoğraf/okuma topluca değiştirilmez. YZ2 değişmez.

## Kullanım

Mevcut Akıllı Asistan bakım kartının ayrıntıları, Bakım Takvimi → Yapıldı ve yeni bakım formu ortak incelemeyi kullanır. Yeni menü yoktur. Kullanıcı Kaydet'e basmadan iş kaydı oluşmaz. Model yeni bağlantı/okuma onayı veremez.

- **Yeni harcama:** belgedeki tutar. KDV hariç ve oran açıkça seçilmişse yerelde brüt hesaplanır. Örneğin 2.100 + %20 = 2.520 TL; maliyet/borç brüt 2.520 kalır. KDV bilinmiyorsa net hesaplanmaz, oran varsayılmaz. Boş tutar bilinmiyor; açık 0 ile aynı değildir. Normal manuel formun mevcut “KDV dahil maliyet” sözleşmesi korunur; asistan/fiş varsayılanı KDV bilinmiyor.
- **Önceki alıştan kullanım:** kullanıcı gider veya alış seçer. Bakım `cost=null` taşır, ikinci gider/kasa/borç yazmaz. Kaynak başka araca ait olamaz; araçsız atölye alışı açık seçimle bağlanabilir. Kaynak seçimi stok miktarı veya alışın tamamını makineye dağıtma değildir. Yeni işçilik varsa ayrı bakım kartında yalnız işçilik tutarı girilir. Malzeme maliyeti sıfır veya tahmin kabul edilmez.
- **Yalnız takip:** yeni maliyet yoktur; bilinmeyen tutar null kalır.

Sayaçta geçmiş gösterge ve varsa işlerden tahmin açıklanır; yeni okuma alanı boş başlar. Aynı gün/araç okuması seçilir veya yeni fiziksel değer girilir, ayrıca sayaç onayı işaretlenir. Tarih sırası, araç, önceki/sonraki okuma ve önizleme sonrası değişiklik kontrol edilir. Toplam araç sayacı sıfırlanmaz; seçilen tamamlanmış bakım kuralı onaylı noktaya dayanır. Yeni bakım, yalnız açıklamasındaki “yağ” sözcüğüyle diğer bakım periyotlarını sıfırlamaz. Tek kart tek sayaç türü bağlar; birlikte km+saat gerektiren kural açık hata verir.

Asistanın aynı isteği tekrar okumasında araç/tarih ve kaynak aynıysa maliyet/sayaç alan seçimleri korunur; sayaç onayı tekrar istenir. Sayfa kapatıldıktan sonra ek inceleme seçimlerinin kalıcı geri yüklendiği iddia edilmez. Eksik önizleme kapanmadan kaydedilmelidir.

Mevcut 20 belge seçimi korunur; aynı fotoğraf aynı bakımda bir kez saklanır. Bakım + yeni okuma + seçili fotoğraflar + işlem kimliği tek IndexedDB transaction içinde yazılır. Hata tümünü geri alır. Aynı kimlik farklı içerikte OP_CONFLICT; geri alınmış işlem tekrar oynatılmaz. Mevcut esnaf veresiye ve personel geri ödeme yolları korunur; esnaf belgesi onayı ayrı mevcut adımdır. Eski kayıtların düzenleme akışı değiştirilmez; yeni bağlantılı bakımın kanıtı genel düzenlemeden koparılamaz.

Kaynak bağlantıları bakım ayrıntısında açılır. İptal edilmiş/kayıp kaynak uyarı verir. Yeni kayıt biçimi yedek doğrulamasında kontrol edilir. HR/izin/puantaj iş mantığı ve QA önizleme dosyaları değişmez. Yayın hash manifesti yalnız bu pakette açıkça değiştirilen kaynaklar ve yeni modüller için güncellenir; mevcut byte eşitliği testinin hiçbir assertion'ı kaldırılmaz veya gevşetilmez.

## Kanıt ve sınırlar

- Saf test: KDV net/brüt, bilinmeyen maliyet, kaynak damgası, ayrı onay, kural seçimi ve yeni kayıtların yedek tutarlılığı.
- Gerçek Chromium/IndexedDB: eski 4512 tahminin onaysız mühürlenmesi v116'da üretilir; adayda 4502 açık okuma, 4752 hedef, kaynak maliyetinin bir kez kalması, idempotency/OP_CONFLICT/transaction rollback, kanıt düzenleme koruması, manuel form ve asistan + düzeltme akışı, 360px.
- Gerçek SW yükseltmesi: şema8→8, mevcut bakım, okuma, metadata, gerçek PNG TEST baytları ve açık form taslağı birebir korunur; üç modül cache'e alınır ve offline açılır. Test sunucusu her GET'te aktif ağacı seçer ve aynı saniyede değişen dosya için mtime/304 yanılsaması oluşturmaz.
- Tüm Node / mevcut CI tarayıcı / eski yükseltme denetimleri yayın kapısıdır. Çalıştırılmayan test PASS sayılmaz.
- Dondurulmuş asistan altın seti ve yerel ayrıştırıcı ayrı ölçülür. Gerçek telefon, gerçek WhatsApp, gerçek Gemini ve üretici bakım periyotları denenmez. Reçete/filtre muadilliği, stok envanteri ve otomatik parça ömrü bu ilk paketin kapsamında değildir.

Paralel yayımlanan #261 personel başlangıcı korunarak taban v3.10.16, bakım sürümü v3.10.17 olarak yenilendi. Personel UI / kılavuz dosyaları yeni tabanla byte eşittir; onun tarayıcı/baseline testleri de CI’de korunur.
