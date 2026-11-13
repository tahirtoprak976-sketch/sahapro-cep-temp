# v3.11 kabul planı — yayın henüz engelli

Bu dosya uygulama bitmiş veya canlıya alınmış anlamına gelmez. Adaylar taslak PR240/241/242/243 zinciridir; yayın v3.10.13'tür. İki aşamalı aynı alanda kaymasız önizleme henüz tamamlanmadı. Gerçek telefon ve canlı Gemini kanıtı henüz yoktur.

## Otomatik ve dondurulmuş hat

Her adayın tam SHA'sına bağlı Node, bütün tarayıcı suitleri ve yükseltme koruma koşuları tamamlanır. Atlanan/çalıştırılamayan test engeldir. Baseline kırmızı kanıtları, aynı yeni testin değişmemiş önceki kaynakta çalıştırılmasıdır; beklentiler değiştirilmez. CI başarısı gerçek telefon/model başarısı sayılmaz.

Eski kayıtlı yanıtlar değiştirilmez: toplu15/38 hazır,14gereksizsoru,3yanlışalan; tekil25/38,3gereksizsoru,3yanlışalan. Ayrı73örneklik assistant gold güvenliği0/0/0'dır; bütün alanların hatasızlığı anlamına gelmez. Eski yerel tests/gold sonucu ayrıca raporlanır.

## Gerçek Gemini referansı

Yalnız onaylı takma adlı kaynak kullanılır. Telefonun anahtarı sohbete, GitHub'a, çıktıya veya fixtüre yazılmaz. Güvenli yerel çalışma ortamında GEMINI_API_KEY ortam değişkeninden okunur. Model kimliği çalışma anında ücretsiz erişilebilir modellerden seçilir; model sürümü koda sabitlenmez. Kullanıcının telefonu/veritabanı modele veya testlere taşınmaz.

Canlı koşucuda --live --consent --free-tier-confirmed --owner-pseudonyms bayrakları, --model, --budget, --repeats3, --mode both, /tmp altındaki ayrı --usage-file ve --output yolları gerekir.20tekil+1toplu x3=63örnek isteği vardır; kota yeterli değilse eksik yanıt başarı sayılmaz. Her istek mevcut izin/günlük bütçe/iptal/90sn kapsamından geçer; Kaydet çağrılmaz. Kota biterse gerçek başarısızlık kaydedilir; yerine dondurulmuş yanıt konmaz. Sağlayıcı kotası garanti edilmez.

Yeni ham yanıtlar ayrı dosyada tutulur. Ana JSON çıkarımı ile araçlı gerçek asistan akışı ayrı değerlendirilir. Koşucudaki safety.measured=false, ayrı canlı para güvenliği değerlendirmesi yapılmadan true yapılamaz. Üç tekrarda toplu>=28/38,gereksizsoru<=4,yanlışalan<=2; sessizyanlış/para tahmini/zorunlu işaret ihlali0 olmalıdır. Tekil hazır kart önceki25/38'in altına düşmemelidir.

## Fiziksel telefon ve WhatsApp

Aynı aday sürümün ayrı TEST veritabanı/önizlemesinde yalnız takma adlı fixtür kullanılır. Üretim veritabanı sıfırlanmaz, gerçek yedek test için yüklenmez, eski kayıtlar topluca düzeltilmez. Uygun aday önizlemesi olmadan mevcut canlı sürümün sonucu yeni adaya yazılmaz.

1. Fiziksel cihaz/model/tarih/adayı kaydedin. Düşük parlaklıkta beş hassas kartın kehribar çerçevesini ve onay metnini ayrı ayrı görün. Hiçbiri kendiliğinden işaretli veya grup kaydına dahil olmamalı.
2. Gerçek WhatsApp panosundan10takmaadlımesajı yapıştırın. Gizli pano karakterleri, başlık tarihleri ve devam satırlarını kontrol edin. Yerel ilk boyama süresini, CLS'yi ve alanın piksel hareketini ayrı ölçün; CLS birimsizdir. Gemini yanıtı sırasında odak/elle düzenleme korunmalı.
3. Ortak soruyu cevaplayın,1.5snvurgu ve5sngeri alma davranışını kontrol edin. Sonradan elle düzelttiğiniz alanın kaybolmadığını doğrulayın. Yanlış müşteriye toplu uygulama olmamalı.
4.3sentetikfiş+2tahsilat/mazot işlemli kapanışı<=8dakikada yapın. Ayrıca4fişi seri çekip kartlaşma süresini<=45sn ölçün; fotoğrafın cihazda saklanması OCR bitişi sayılmaz.
5. Uçak modunda fişleri ekleyip kapat/açın; kalıcı kuyruk ve ekler korunmalı. İnternete dönünce açık onayla okuyun. Aynı fişi tekrar okutunca ticketKey korumasını ve çift gider oluşmadığını doğrulayın.
6. Cari önizlemede mevcut kesinleşmiş KDV korunmalı; yeni taslağa KDV eklenmemeli. Boş fiyat0gösterilmemeli. Grup kaydı sonrası diğer kartlar, elle miktar ve hassas kart onay seçimi korunmalı; sayaçlar doğru güncellenmeli.

Ölçülen sayıları kabul-kaniti.json dosyasının bir kopyasına ekleyin; bilinmeyen alanları0yazmayın. Araç `node tools/v311-release-gate.mjs kanit.json rapor.json` ile yalnız rapor üretir; eksik/başarısız maddede çıkış kodu1'dir. Ham canlı yanıtları tekrar puanlar, rapora yazılan hazır kart sayısına körü körüne güvenmez. Kaynak raporunun gerçekliğini kriptografik doğrulamaz; gerçek koşu kaynağı ve GitHub SHA'sı ayrıca incelenir.

Tüm kanıtlar tamamlanınca PR'lar sırayla birleştirilir; her Pages yayını bitince canlı kaynak hashleri, APP_VERSION, SW cache/ASSETS, yeni worker controller ve çevrimdışı açılış doğrulanır. Yayın sonrası sorun varsa önceki sürüme revert PR ile dönülür. İki başarısız kapıda durma ve test gevşetmeme kuralı sürer.
