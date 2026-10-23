# SOLO v3.9.61 — Müşteri panosunda mazot tahsilatı

## Sorun ve sonuç

Mazot karşılığı çalışan müşterilerde işin parasal tutarı sıfırdır. Eski müşteri grafiği yalnız TL iş tutarı ve TL tahsilatını topladığı için, litre hakkı ve teslimler mevcut olsa da boş görünüyordu. Bu bir grafik/veri sunumu eksikliğiydi; bu değişiklik eski işleri yeniden fiyatlandırmaz veya mazot alınmış saymaz.

- Müşteri panosunda **Son 12 ay · Mazot (L)**: turuncu **hak edilen mazot**, yeşil **alınan mazot**. İki seri aynı litre ölçeğinde, işin/teslimin kendi ayında gösterilir. Toplamlar, ay/yıl ve açılabilir kesin aylık döküm bulunur.
- Seçili dönem kutularına **Mazot tahsilatı** eklendi. Dönemde hak edilen/alınan litre, tüm zamanların güncel mazot alacağından ayrı gösterilir. Son 12 aylık grafik dönem düğmelerinden bağımsızdır ve bunu açıkça yazar.
- Yalnız mazot müşterisine boş TL grafiği gösterilmez. Son 12 ayda TL işi veya para tahsilatı bulunan karma müşteride **ayrı TL grafiği** korunur. TL ve litre birbirine çevrilmez, ortak sayıya/ölçeğe eklenmez.
- İş türü ve araç dağılımları mazotlu işlerde litreyi, karma işlerde TL ve litreyi birlikte yazar. Karma dağılım çubukları iş sayısına göre sıralanır; farklı birimler toplanmaz.
- Müşteri ve iç rapor PDF'leri aynı aylık kaynaktan mazot grafiğini, dönem mazot tahsilatını ve teslim dökümünü içerir. Karma müşteride iki grafik ayrı başlık/birimle basılır. Eski küçük TL değerlerini `0k` olarak yuvarlayan grafik etiketi yerine gerçek değerler yazılır; alınan seri de etiketlenir.
- Dar müşteri kartında mevcut TL/mazot alacağı rozeti satır atlar; 320 px ekranı taşırmaz.

## Kaynak ve kapsam

Hak edilen litre, aktif işin **kayıtlı `customer_fuel_allowance_l`** değeridir. Bugünkü kural eski işin litre hakkını değiştirmez. Alınan litre, mevcut `customerFuelLedger` hesabıyla aynı kaynaklardan okunur: müşteri bağlantılı `Müşteri Verdi` yakıt kaydı ve müşteri bağlantılı depo `GİRİŞ` hareketi. Depodan kendi aracımıza `ÇIKIŞ`, müşteriye mazot satışı, istasyon yakıtı, başka müşteri ve silinmiş kayıtlar mazot tahsilatına eklenmez.

Pano ve grafiğin **Taşeronlar dahil** seçimi aynı müşteri kapsamını kullanır. Mevcut kural kaldırılmış olsa da kayıtlı geçmiş mazot işi/teslimi kaybolmaz; henüz iş yapılmadan alınan mazot da gösterilir. Grafikte son 12 takvim ayı ve bugüne kadar olan kayıtlar bulunur; daha eski devir bu aylara taşınmaz. Güncel litre özeti de bugün itibarıyla hesaplanır. Tarihi eksik eski kayıtlar mevcut hesapta korunur, tarihli dönem/ay serisine atanmaz.

Gösterim ve PDF üretimi veritabanını/audit'i değiştirmez; DB şeması **6** olarak kalır. Açık müşteri kartı aynı origin/DB'de yeni yakıt teslimi commit edilince v3.9.60'ın bildirim mekanizmasıyla güncellenir; dönem seçimi korunur. Farklı telefonlar arasında senkronizasyon değildir.

## Doğrulama

- `node tests/customer-fuel-chart.test.mjs`: 10 senaryo — tarihli iki teslim kaynağı, kayıtlı hak/kural değişimi, iptal/yanlış yön/müşteri ayrımı, gelecek/12 aydan eski kayıtlar, dönem ayrımı, taşeron kapsamı, kaldırılmış kural/avans, karma TL/litre, erişilebilir grafik/aylık döküm ve PDF verisi.
- `python tools/e2e/customer_fuel_chart.py [URL] [artefakt-öneki]`: gerçek Chromium/IndexedDB; 375 L hak, 300 L teslim, 75 L kalan; dönem 150/100 L; depo çıkışını ikinci kez saymama; 320/390/768 px; gerçek PNG etiketleri ve indirilen müşteri PDF'i; ikinci sekmeden yeni teslimde grafik yenileme ve dönem koruma; ayrı TL hesabı ve iki grafikli gerçek iç PDF. Okuma/PDF öncesi-sonrası kayıt/audit eşitliği.
- `customer_snapshot`, `work_fuel_refresh`, `customer_fuel`, `pano` tarayıcı gerilemeleri geçti.
- **117/117 Node test dosyası**, **161 JS dosyası sözdizimi**, **160 SW modülü** doğrulandı.

Tüm senaryolar uydurma TEST verisi ve yalıtılmış tarayıcı profili kullanır. Kullanıcının gerçek Güneş Hafriyat kayıtları/telefonu okunmadı; test litreleri gerçek anlaşma olarak varsayılmaz. Yayın sonrası değişen uygulama dosyaları canlı baytlarla karşılaştırılır ve yeni grafik akışı canlı URL'de ayrı TEST profiliyle tekrar edilir.
