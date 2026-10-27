# v3.9.73 — Döküm maliyeti: kesinleşen + kalan tahmin

## Kullanıcıya görünen davranış

- Fişsiz yeni iş: **tahmini sefer yükü × sefer sayısı × ton tarifesi**.
  Araç kartındaki yük veya tür varsayımı, tarife/birim, iş tarihi, miktar ve
  varsa girilen tonajın kapsamı kayıtta ayrı bir tahmin kopyasıdır.
- Fiş geldikçe yalnız kapsadığı seferin tahmini kalkar. Örnek: 3 sefer × 20 ton
  × 100 TL = 6.000 TL tahmin; bir seferin fişi 2.500 TL ise kesinleşen 2.500,
  kalan tahmin 4.000, beklenen toplam 6.500 TL olur.
- Kalan tahmin, ilk tahminin kalan seferlere oransal payıdır. Bu pay gerçek
  ölçülmüş artık tonaj değildir. Fişteki gerçek ton yalnız fiş kapsamındadır.
- Müşteri ödediği fişin kapsadığı tahmin kalkar ama şirket maliyeti oluşmaz.
  Şirketin doğrudan ödediği fiş maliyettir; ortak saha bakiyesini azaltmaz.
- Fişe bağlı gider bir kez sayılır. İşe bağlanmamış fiş de genel maliyette
  görünür. Masraflar ve aylık Finans aynı maliyet satırlarını kullanır.
- İşe bağlı maliyetin tarih ataması önceki davranış gibi iş tarihidir;
  işe bağlanmamış gerçek fiş kendi tarihindedir. Banka/kasa tarihi değişmez.
- Yükleme, açılış, iade ve mutabakat belgesi tahmini gider yaratmaz.
  Ortak bakiye yalnız gerçek hareketlerle hesaplanır; tahmin bakiye kesintisi değildir.

## Eski kayıtlar ve veri koruma

Hiçbir geçmiş kayıt topluca yazılmaz veya gerçek gider/gerçek tonaja çevrilmez.
Eski kaydın yük/tarife/kapsamı kayıtlı değilse bugünkü karttan geçmiş varsayımı
üretilmez. Bilinmeyen kalan maliyet görünür biçimde **doğrulama bekliyor** olur;
gösterilen bilinen alt toplam eksik olabilir. Kaydedilmiş eski elle maliyet veya
kapsamı açık tonaj + eski tarife kopyası yalnız doğrulanmamış tahmin olarak
kullanılabilir. Birden çok seferin kapsamı belirsiz tonajı araç yüküne bölünerek
tahmin edilmez.

Araç yükü/türü veya tarife kartı değişince yeni işin kayıtlı tahmini değişmez.
Açıklama düzenlemesi de kopyayı yenilemez. İşin miktarı/tonajı açıkça düzeltilirse
aynı araç ve tarih/saha için ilk yük/tarife korunur ve miktar hesabı yenilenir.
Araç ya da saha/tarih açıkça değiştirildiğinde ilgili yeni varsayım alınır.
Fişe bağlı işin maliyet dayanağı doğrudan değiştirilemez. Yedek geri yükleme
kopya bağlantılarını ve aritmetiğini doğrular. Tekrar iş yeni varsayım alır.

KDV bilinmiyorsa bilinmiyor kalır. Müşteriye ek borç, hakediş veya sözleşme
fiyatı yazılmaz. İç maliyet sütunları müşteri nüshasında gizli kalır.
Geçmiş aktarımına devam edilmedi; gerçek kullanıcı verileri testlere alınmadı.

## Doğrulama

- `tests/dump-cost-reliability.test.mjs`: kısmi/tam/iptal/müşteri/doğrudan ödeme,
  değişmeyen dayanaklar, fiş bağlantısı, bilinmeyen eski kayıt, geçersiz kapsam,
  ortak bakiye, KDV ve görünüm toplamları.
- Aynı test `BASELINE_PROOF=1` ile değişmemiş `fbfb32c9` üzerinde dört eski
  hatayı kanıtlar; bu mod adayın doğruluğu sayılmaz.
- `tests/dump-estimate-db.test.mjs`: gerçek kayıt fonksiyonlarıyla yeni kayıt,
  düzenleme, toplu giriş yolu, değiştirme koruması, eski kaydı doldurmama.
- Var olan aritmetik testleri yeni kaydı temsil eden açık tahmin kopyalarıyla
  korunmuştur. Tek davranış beklentisi değişikliği: kısmi fiş kalan tahmini
  artık yok etmez. Eski belirsiz tonajlı rapor fixture'ı açık `total` kapsamlıdır.
- `tools/e2e/dump_cost_reliability.py`: izole sentetik IndexedDB ve gerçek UI;
  iptal/tekrar gönderim, fiş iptali, dört ekranda toplam ve kaynak uyarıları.
- Mevcut resmi Node/Chromium CI, tüm Node/browser testleri, eski hata kanıtı
  ve v3.9.72 dahil kurulu sürümden güncelleme korumasını çalıştırır.

Yerel Chromium normal başlatmada `socket() failed: Operation not permitted`
ile durdu; tarayıcı sonucu yerel olarak geçmiş sayılmaz, CI kanıtı gerekir.

### Alış belgesinin sefer kapsamı belirsizse

Bir döküm alış belgesinde yalnız iş bağlantısı olması, bütün seferlerin faturalandığını
kanıtlamaz. Önceki tanıma uygun olarak alış belgesi kendi tarihinde bir kez maliyete
girer; fiş aynı iş üzerinden ikinci kez genel toplama eklenmez. Ancak kalan seferlerin
belgeyle örtüşmesi bilinmiyorsa kalan tahmin ve beklenen toplam **eksik / doğrulama
bekliyor** olur. Kayıtlı kalan tahmin ayrı kontrol ipucu olarak korunur; fatura miktarı
ve fiş miktarı eşleşiyor diye örtüşme varsayılmaz. Belge başka ayda olsa da iş ayındaki
kontrol satırı kaybolmaz. Belge/fiş/kasa kayıtları değişmez.
