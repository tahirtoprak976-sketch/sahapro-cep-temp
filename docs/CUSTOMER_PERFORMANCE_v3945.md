# SOLO v3.9.45 — müşteri ekranlarında tekrarları azaltma

## Değişiklik

Müşteri listesi her müşteri için tüm iş/cari/yakıt/depo kayıtlarını yeniden
taramak yerine kaynakları bir kez müşteri kimliğine göre gruplar. Gruplar yalnız
bu hesaplama çağrısında yaşar; sonraki ekran açılışında yeni veriden kurulur.
Mevcut customerLedgerMovements ve customerFuelLedger hesapları gruplanmış girdiyi
isteğe bağlı üçüncü parametreden alabilir. Başka çağıranların normal veri yolu,
aktif kayıt/kaynak/kimlik kontrolleri, işlem sırası ve yuvarlama korunur. Bakiye ve
litre hesapları yeniden tanımlanmaz; para veya müşteri kaydı yazılmaz.

Müşteri kartındaki pano, yapılan işler, mazot ve ana firma bölümleri tek dumpAll
anlık görüntüsünü paylaşır. Önceki üç tam okuma ve ilave müşteri/iş okumaları
kaldırılır. Mazot ekstresi paylaşılırken taze veri okunur; kart açıkken sonradan
gelen bir yakıt kaydı ekstreye yansır. Kalıcı hesap önbelleği eklenmez.

## Doğrulama ve ölçüm

- 99/99 Node test dosyası; sözdizimi 138 dosya; SW listesi 137 modül.
- customer-performance.test: 80 müşteri ve her kaynakta 2400 kayıt; indeksli
  hesaplar normal muhasebe/mazot hesaplarıyla birebir karşılaştırılır. Silinenler,
  taslak/kesinleşmiş hakediş, tarihsiz iş, kuruşlar, litre yuvarlaması, farklı
  kaynaklar ve sonraki çağrıda yeni kayıtlar kapsanır. Beş ana kaynak havuzunun
  her birinin tek kez okunması doğrulanır; süre eşiğine bağlı test yoktur.
- customer_snapshot.py: gerçek IndexedDB'de dört müşteri bölümü için tek tam
  snapshot; 100,25 TL ve 75 L korunur. Kart açıkken eklenen 25 L yakıt sonrası
  paylaşılan ekstre 325 L alınan / 50 L kalan gösterir. Paylaşım veri yazmaz;
  yeniden açılan pano/liste güncel hesabı gösterir. Native paylaşım taklit edilir.
- customer_directory.py: filtreler, sıralama, mobil görünüm ve veri/audit
  değişmezliği; pano.py: Kılıç litre/TL/dönem ayrımı; driver_fast_share.py ve
  driver_group_share.py: mevcut personel aktarımı ve ayrı grup özeti korunur.

Yerel Node denemesi: 300 müşteri, 10000 iş, 5000 cari hareket, 5000 yakıt, 1000
  depo hareketi, 200 hakediş. v3.9.44 kaynak koduyla yeni sonuçlar deepEqual ile
  eşit; ısınma sonrası üç ölçümün medyanı önce 282,90 ms / sonra 27,12 ms.
  Bu değerler yerel hesaplama ölçümüdür; fiziksel telefonun sayfa açılışı veya
  WhatsApp teslimat süresi ölçülmedi. Yeniden üretmek için git checkout içinde
  `node tools/analiz/customer_perf.mjs` (v3.9.44 commit'i git geçmişinde bulunmalı).

Sürüm ve SW önbelleği yenilendi. DB şeması, sunucu durumu ve ekran düzeni değişmez.
