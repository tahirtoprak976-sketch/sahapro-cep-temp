# Sistem denetimi — v3.10.08

## Kapsam ve yöntem

Taban: canlı v3.10.07 (`dfe5341`). Kaynak envanteri: 231 JS modülü, 53.105 satır, 191 Node test dosyası, 141 tarayıcı test dosyası. Bağıl modül bağlantılarında eksik dosya bulunmadı. Bu envanter her satırın elle incelendiği veya olası bütün hataların dışlandığı anlamına gelmez.

Uygulama başlatma/yönlendirme, güncelleme, ortak UI, kayıt ve finans yazıcıları, cari/KDV/hakediş köprüleri, kaynak notları, güvenlik/şoför imzaları, yedekleme ve aktarma kaynakları incelendi. Mevcut regresyon setinin yanında yeni çapraz ekran, para koruma ve menü taramaları eklendi. Gerçek işletme verisi, yedek, şoför bağlantısı veya Gemini anahtarı kullanılmadı. Bütün yazmalar yalıtılmış TEST profillerindeki sentetik kurulum ve denemelerdir.

## Kanıtlanan onarımlar

| Sorun | Değişmemiş v107 | Aday |
|---|---|---|
| Ekran değişince düzenleme izleyicisinin kopması | Ayar düzenlemesi için `unsaved=false` | Sabit belge üzerinde izlenir; onaysız güncelleme reddedilir |
| İzleyicinin SW kurulmasına bağlı olması | SW kullanılamayınca izleme kurulmaz | Başlatmada SW'den bağımsız kurulur |
| Görünen etiketin giriş alanına bağlı olmaması | Etikete dokunmak alanı odaklamaz | Ortak ve dinamik alanlarda gerçek `label` bağı |
| Açık pencerede güncelleme/klavye odağı | Güncelleme riski görülmez; odak dışarı çıkabilir | Açık pencere güncellemeyi engeller; ad/rol/Tab odağı korunur |
| Bozuk yüzde kodlu bağlantı | Reddedilmemiş Promise / açılış hatası | Açıklamalı kurtarma ekranı ve ana sayfaya dönüş |
| Tutarı bilinmeyen eski personel tahsilatı | 0 TL gibi görünür | Etkilenen toplam hesaplanmaz; doğrulama istenir |
| Kaynak mesajdaki sembollerin silinmesi | Görünüm simge temizleyicisi kaynak metni de değiştirir | Kaynak/notlar ekranda da birebir korunur; HTML yine kaçırılır |
| Hakediş kaynağı belirsizken özetler arası sonuç farkı | Finans hesaplamaz, ana sayfa/Yönetici sayısal kâr gösterebilir | Aylık okuma modeli, ana sayfa, Yönetici ve sabah özeti sonucu hesaplanmamış bırakır |
| Eski sürüm / yanıltıcı gönderim açıklaması | Daha Fazla'da v3.9.72 ve “hiçbir veri gönderilmez” | Gerçek çalışma sürümü ve izinli Gemini gönderimi açıklaması |
| Uzun modül listesinde bulma | Bağlantıları tek tek arama | Mevcut bütün bağlantıları yerinde arayan, odak koruyan arama |
| Finans ve saha işlemlerinde aynı anahtar + farklı bilgi | Bazı yazıcılar eski sonucu başarı gibi döndürür | Kayıtlı iş alanları farklıysa `OP_CONFLICT`; kayıt yazılmaz |
| İptal/geri alma sonrası aynı isteğin başarı gibi dönmesi | Eski sonuç dönebilir | `OP_REVERSED`; geri alınmış işlemi tekrar olmuş gibi göstermez |
| Banka açılışındaki boş / geçersiz tutar | Bazıları sıfır veya taşan tutar olarak kabul edilir | Geçerli, kuruş hassasiyetinde bilinen tutar zorunlu; negatif gerçek bakiye yasaklanmaz |

## İşlem kimliği denetimi

12 işletme/finans ailesi: tedarikçi kartı, banka kartı, banka transferi, alış belgesi, sipariş, ücret/avans, çek/senet, hakediş vade planı, tahsilat eşleştirme, bakım planı, takip görevi ve gün kapanışı. Değişen 31 alan/tarif senaryosu aynı kimlikte reddedilir. Transferin iki bacağı birlikte ve aynı kaynak kimliğiyle doğrulanır. İlk yanıt ve tekrar yanıtı aynı transfer kimliğini döndürür.

9 saha ailesi: sayaç, görev planı, zimmet, duruş, bakım kalemi, garanti/parça, maliyet dağıtımı, stok sayımı ve bakım yenileme. Değişen 17 senaryo reddedilir. Normalleştirme kendi eski satırını tekrar/çakışma olarak değerlendirmez; işlem sonrası durum ayrı tutulur. Stok sayımında aynı fiziksel sayım yeniden stok düzeltmesi üretmez.

Karşılaştırma mevcut kayıttaki iş alanlarından yapılır; yeni şema veya kayıt alanı yoktur. Belge satırı ve taksitlerin yeniden üretilen iç kimlikleri yerine miktar, tarih, fiyat, vergi, taraf ve kaynak karşılaştırılır. Kaynak kaydı belirsizleşmişse işlem güvenli biçimde reddedilebilir; eski kayıtlar düzeltilmez. Mevcut OP, strict revizyon, şoför imzası, fiş tekilliği, günlük bütçe/izin/iptal ve para kartlarının zorunlu işaretsiz olması kuralları korunur.

## Ölçüm

| Sentetik ölçüm | Başlangıç | Aday |
|---|---:|---:|
| Boş / dolu profilde ilk menü taraması | 129 / 132 geçiş | Yeni doğrudan ana menü kontrolleriyle en az aynı kapsam |
| Görünen alanlarda etiket bağı eksikliği | Her profilde 400 örnek, 64 ekran | 0 (tekrarlanan alanlar sayıma dahil) |
| Sayfa hatası / yatay taşma / kendiliğinden işletme kaydı | 0 / 0 / 0 | 0 / 0 / 0 |
| Sıralı isteklerde farklı bilgiyle sessiz eski sonuç | Yeni testler kırmızı | 21 aile, 48 değişiklik örneği reddedilir |
| Farklı tutarlı eşzamanlı transfer | İki çağrı da başarılı görünebilir | 1 kayıt + 1 OP_CONFLICT, toplam 2 bacak |
| Bağımsız banka korunum hesabı | — | 1.005 açılış + 100 tahsilat − 10 avans = 1.095 TL |
| Maliyet dağıtımı / bilgi amaçlı parça | — | 100 gider + 10 bakım = 110 TL; çift gider yok |
| Plan / gerçekleşen iş ayrımı | — | Görev planı oluşturmak 0 gerçekleşen iş üretir |
| Sıfır stok farkı | — | 0 depo hareketi |
| Dondurulmuş genel asistan: doğru işaretli kart | 30/73 | 30/73 |
| Sessiz yanlış / para tahmini / zorunlu işaret ihlali | 0/0/0 | 0/0/0 |
| Bağımsız yerel gold | 80 mesaj, 369 alan, 0 yanlış | Aynı |

Yeni tarayıcı testleri aynı kodla değişmemiş v107 üzerinde beklenen nedenlerle düşer, adayda geçer. Önceki test beklentileri gevşetilmez. Node, CI tarayıcı ve kurulu sürüm yükseltme sonuçları PR'da ayrıca raporlanır. Ekranları açmak, aramak ve kontrolleri incelemek kayıt değiştirmemelidir; çapraz ekran testinde tüm kayıt/meta/taslak/ekler, geniş menü taramasında bütün işletme kayıtları karşılaştırılır.

## Sınırlar ve kalan işler

Bu paket gerçek Gemini anlama başarısını ölçmez. Takma adlı 20 mesajın dondurulmuş genel asistan ölçümü bu pakette tek tek 23/38, toplu 15/38 hazır kart ve topluda 21 gereksiz soru olarak kalır; azaltıldığı iddia edilmez. Bu ayrı bir kaynak kapsamı incelemesidir. Gerçek telefon, gerçek WhatsApp, gerçek Gemini, cihaz kaybından fiziksel kurtarma ve gerçek işletme hesapları denenmedi. Safari/Android donanım davranışı Chromium ölçümüyle eşdeğer sayılmaz. Yedek dosyasının paylaşım paneline verilmesi dış teslim kanıtı değildir. Hatasızlık veya tam güvenlik garantisi verilmez.

## İlk CI'de yakalanan gerileme

İlk tam CI (`42941926547`) eski `shared_dump` testinde durdu. Yeni diyalog odağı, kullanıcı tutar alanına geçtikten sonra gecikmeli çalışıp odağı başka alana taşıyabiliyordu; tutar boş kaldığında doğal form doğrulaması kaydı haklı olarak engelliyordu. Otomatik odak artık kullanıcı pencerenin içinde bir alan seçmişse çalışmaz. Önceki aday `ba6030d` üzerinde zorlanmış odak yarışı aynı testle düşer; düzeltmede altı kez geçer. Eski ortak döküm testinin beklentileri değiştirilmedi. İkinci tam CI sonucu ayrıca PR'da yer alır; ikinci kapı başarısızlığında yayın yapılmadan durulur.
