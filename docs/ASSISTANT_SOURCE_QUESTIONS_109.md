# Mesaj hazırlığı, tarih teyidi ve arayüz kurtarması — v3.10.09

Telefonun kaynak satırından doğruladığı tarih, toplu konuşmada aynı miktarın geçtiği başka bir satırın tarihiyle karıştırılmamalıdır. Tarih kanıtı önce o kayıtla eşleşen telefon kanıtından alınır, sonra bağlı fişin tarihiyle karşılaştırılır. Model/mesaj veya fotoğraf çelişkisi kartı işaretsiz bırakmaya devam eder.

Aynı geçerli telefon tarihini teyit etmek isteyen iki veya daha fazla kart tek soruda toplanır. Fotoğraf çelişkisi, geçersiz tarih ve yalnız modelden gelen tarih bu gruba alınmaz. Tek kartın mevcut soru kimliği korunur. Cevap yalnız hedef kartların tarih alanına uygulanır; başka tarihler, elle düzeltilmiş açıklama ve zorunlu işaretsiz tahsilat kartı korunur. Kaydet olmadan işletme kaydı yazılmaz.

| Dondurulmuş takma adlı sınav | Önce | Aday |
|---|---:|---:|
| Tek tek 20 mesaj: hazır doğru kart | 23/38 | 24/38 |
| Tek tek: gereksiz soru | 7 | 6 |
| Toplu 20 mesaj: hazır doğru kart | 15/38 | 15/38 |
| Toplu: gereksiz soru | 21 | 9 |
| Toplu: soru adedi | 29 | 17 |
| Sessiz yanlış / kaçırılan soru | 0 / 0 | 0 / 0 |
| Genel dondurulmuş gold: doğru işaretli | 30/73 | 30/73 |
| Genel sessiz yanlış / para tahmini / zorunlu işaret | 0/0/0 | 0/0/0 |

Toplu sette kalan tarih sorularının çoğu kayıtlı model yanıtının mesajdaki tarihle çelişmesindendir. Kartları otomatik işaretleyerek güvenlik kuralı gevşetilmedi. Toplu hazır kart artışı iddia edilmez. Sınav metni, takma adlar ve beklenen cevaplar değiştirilmez; uygulamaya sınav adı eklenmez. Gerçek Gemini, gerçek telefon ve WhatsApp denenmedi.

Birim testi aynı tarih/farklı tarih, tek soru kimliği, geçersiz/kanıtsız tarihler ve fiş çelişkisini korur. Gerçek Chromium/IndexedDB testi iki kartın ortak cevabını, üçüncü kartın ve manuel açıklamanın korunmasını, tahsilatın işaretsiz kalmasını ve sıfır işletme yazmasını ölçer. Sağlayıcı yanıtı taklittir.

Bu çalışma, bütün kapıları geçen ve canlıda dosya/servis çalışanı doğrulanan v3.10.08 üzerine hazırlanmış ayrı sürümdür. Şema 7 ve kayıt biçimi değişmez; eski işletme kayıtları otomatik düzeltilmez.

Açılış kurtarması: veri deposu açılamadığında eski hata metni verilerin güvende olduğunu doğrulamadan söylüyordu. Yeni ekran verileri silmemeyi belirtir ve açık bir yeniden deneme sunar. Geçici IndexedDB açılış hatası gerçek tarayıcıda zorlanır; yeniden denemede mevcut TEST kayıtları aynı kalır. Bu, fiziksel veri kaybının kurtarıldığı veya bütün depolama hatalarının düzeltildiği iddiası değildir. Otomatik sıfırlama yoktur.

Gecikmeli soru penceresi odağı da kullanıcı seçimini korur: kullanıcı Vazgeç düğmesine geçmişse eski 250 ms zamanlayıcı odağı tekrar giriş alanına taşımaz. Önceki sürümde düşen gerçek klavye/odak testi adayda geçer; iptal cevap üretmez ve işletme kaydı yazmaz.

Kilit ekranı: şifre alanına erişilebilir ad ve modal odak sınırı eklendi. Kilit açıkken arka plan kontrol edilemez; doğru şifreyle önceki etkinlik durumu geri gelir. Gerçek tarayıcıda sentetik şifreyle yanlış girişin reddi, doğru girişin kabulü, Tab odağının kilitte kalması ve işletme kayıtlarının aynı kalması denetlenir. PBKDF2, deneme sınırı, biyometrik kararlar ve kayıt biçimi değiştirilmez. Fiziksel parmak izi/Face ID denenmedi; bu cihaz içi UI kilidi veri şifrelemesi veya sunucu yetkisi değildir.


İlk tam CI (`42948679286`) yeni tarih/kilit/kurtarma testlerini ve 10 `assistant_turn` koşusunu geçti; mevcut `command_selection` testinde aynı adlı iki aracın seçim sorusu beklenirken zaman aşımına uğradı. İlk teşhisli yerel koşular v108 10/10, aday normal yükte 10/10 ve CPU yükünde 15/15 geçti. Ardından özgün test, yalnız hata teşhisi eklenmiş hâliyle aynı yerde düştü: mesaj ve çıktı boş, buton etkin, ekran hazır, konsol/sayfa hatası ve sağlayıcı isteği yok, SW engelli, ekran `inert` değil.

Aynı mesaj kaybını deterministik üreten bir yönlendirme yarışı bulundu: hızlı çıkış/dönüşün kuyruktaki iki gerçek `hashchange` olayı aynı son hedefi tekrar çizer ve yazılmış metni siler. Yeni `route_race109` testi gerçek hash olaylarının dinleyiciye teslimini test içinde geciktirir. Değişmemiş v108'de mesaj kaybolur; adayda aynı hedef tekrar çizilmez, mesaj ve iki ayrı araç seçeneği korunur. Gerçek başka ekrana geçiş ve `renderCurrent()` ile açık yenileme çalışır; işletme kaydı yazılmaz. Bu zorlanmış yarış ve boş mesaj teşhisi CI belirtisiyle uyumludur; ilk CI'deki olayların tam zaman çizelgesi kaydedilmediği için tek nedenin bu olduğu iddia edilmez.

Yönlendirme onarımından sonra özgün test yerelde yine aynı boş mesajla düştü; bu onarım tek başına CI hatasını çözdü sayılmadı. İkinci bağımsız açık: mesaj alanı ilk çizimde düzenlenebiliyor, dosya/sohbet kurulumu bittikten sonra taslak okunurken salt okunur yapılıyordu. Kullanıcının odaklanması ile harf girişi arasına bu geçiş girebilir. Alan artık HTML'nin ilk çiziminden hazır olana kadar salt okunur; dosya/taslak ve gönderme dinleyicisi tamamlanınca açılır. `assistant_ready109` gerçek IndexedDB dosya okumasını taslak okumasından önce geciktirir, sonra taslak okumasını ayrı geciktirir ve tek yazma denemesinin ikisi boyunca beklemesini doğrular. Aynı test v108'de ilk aşamada düşer; mevcut 6 koşulu taslak yarışı testi de değişmeden geçer. İki yarış için kayıt biçimi değişmez ve işletme verisi yazılmaz.


Eski testin mesajları, beklediği iki araç, müşteri bağlamı, 30 sn bekleme sınırı ve tüm beklentileri korunarak yalnız başarısızlık teşhisi eklendi: ekran görüntüsü, çıktı/metin, odak, kilit durumu, konsol/sayfa hataları, sağlayıcı istekleri ve servis çalışanı denetleyicisi. İkinci tam CI'de aynı test ayrıca 10 kez tek başına çalışır; hata olursa anında durur, tekrar denemez. İkinci tam kapı başarısız olursa sürüm yayınlanmaz.

Son yerel doğrulama: iki onarımdan sonra özgün `command_selection` 15/15 geçti (CPU yüküyle aynı zaman aralığında); 193 Node dosyası ve 60 menü geçişi geçti. Bu yerel tekrarlar tam CI yerine geçmez. İkinci tam CI kapısı: 193 Node dosyası, 93 tarayıcı süiti, ayrı 10 `assistant_turn` + 10 `command_selection` ve 39 yükseltme komutu.
