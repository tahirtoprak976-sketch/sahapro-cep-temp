# Konuşma merkezli asistan — v3.9.92

## Kullanım

Asistan açılışında mesaj alanı ve üç başlangıç vardır: İş / gider kaydet, Mesajlarla karşılaştır ve Hakediş hazırla. İlk seçenek yalnız mesajı doldurur; kendiliğinden göndermez. Diğer ikisi mevcut günlük iş kontrolü ve hakediş hazırlığı ekranlarını açar. Yazılı mesaj varsa değiştirme / ayrılma sorulur. Bu geçişlerde seçilmiş dosya taslağı gecikmeli kaydı beklenmeden saklanır.

Mesaj alanı mobilde alt menünün, geniş ekranda pencere altının üstünde sabittir. Visual viewport / pencere ve alan yüksekliği değişikliklerinde konumu ve ayrılan boşluk yeniden hesaplanır. Enter satır atlar; Ctrl/⌘+Enter gönderir. IME yazımı sırasında gönderim yapılmaz. Okuma iptali ve ağ hata davranışı mevcut kapsam / süre sınırını kullanır.

`Ekle` fotoğraf, ses, PDF veya desteklenen aktarım dosyasını mevcut eklere ekler. Her ek ayrı kaldırılabilir. Aynı adlı farklı dosyalar korunur; aynı ad + aynı SHA-256 içerik tekrarı elenir. PDF, bozuk resim önizlemesi yerine belge kartıdır. Dosya hazırlığı sürerken ek kontrolleri kilitlenir; hata önceki ekleri silmez. Dahili `data-photos` değişim girişi şoför paketi ve mevcut entegrasyonların tüm seçimi değiştirme davranışını korur. Tür / bayt doğrulaması, 20 dosya sınırı ve kalıcı taslak altyapısı korunur. Önizleme URL'leri kaldırma / yeniden çizim / sayfadan ayrılmada bırakılır. Mikrofon kaydı sayfadan ayrılınca durdurulur; gecikmeli izin sonucu eski sayfada kayıt başlatamaz.

## Kontrol ve onay

İş / tahsilat / gider / yakıt / bakım ve belge kartları kısa özetle açılır; ayrıntıları gerektiğinde açılır. Özetler modelin anlatımından değil, gerçek taslak form alanlarından üretilir ve düzeltme sırasında yenilenir. Seçili / kaydedilmiş / devre dışı kartlar ayrı sayılır. Eksik alanlar tür + alan bazında toplu gösterilir; bu gruplama aynı müşteriyi varsaymaz ve cevapları bütün kayıtlara sessizce uygulamaz.

Belirsiz düzeltmenin hedef seçimi ve diğer asistan soruları kapalı ayrıntı içinde saklanmaz. Önceki çok satırlı alan kontrol listesi gerektiğinde açılır. Hazır iş seçimi ve fiyat bekletme mevcut doğrulamayı kullanır. Geçmiş aktarım seçenekleri tek kayıtta ayrı açılır; çok satırlı iş / yakıt paketinde kısayol başlangıçta görünür tutulur. Silme / mevcut kayıt değiştirme / ayar / fiyat / hafıza / yeni kart gibi kapsamı önemli öneriler ilk gelişte ayrıntıları açık gösterir; seçim ve onay davranışı değiştirilmez.

Kullanıcı bütün ayrıntıları açıp kapatabilir; tercih bu tarayıcıda saklanır. Tercih sadece görünümü etkiler. Yeni özet katmanı checkbox işaretlemez, kayıt uygunluğu vermez, form alanı veya veritabanı değiştirmez. Kaydet düğmesinde gerçek seçili sayı gösterilir. Yazmadan önce mevcut toplu alan kontrolü, güncel kart / revizyon kontrolü, stok ve fiyat kararları, işlem kimliği ve tekrar korumaları çalışır. Hatalı kartın ayrıntısı açılır. Metne “onayla” yazmak iş kaydı oluşturmaz.

Başarılı sonuçta gerçek yazma makbuzlarından iş / gider / yakıt / bakım kayıtlarına bağlantı çıkarılır. Model iddiası, zaman aralığı veya ada göre kayıt araması makbuz sayılmaz. Mevcut geri alma ve kısmi işlem uyarıları korunur. Modelin metni başarılı kayıt makbuzu yerine kullanılmaz.

## Geçmiş, görevler ve kapsam

Son iki sohbet turu ana alanda, önceki turlar açılabilir geçmiştedir. Yerleşik 20 tur sınırı, metin güvenliği ve farklı sekmede yeni sohbet açılınca eski yanıtı geçersiz kılan epoch kontrolü korunur. Geçmiş salt okunur; eski sohbet kayıt yazma talimatı değildir. Yarım kalan görevler ve dosyaları Geçmiş üzerinden açılır. Yeni sohbet onayı iş / kasa kayıtlarını silmez. Bağlam paylaşımı ve önceki sonucu düzeltme seçenekleri Araçlar bölümündedir; eski varsayılan paylaşım seçimi genişletilmez. Anahtarsız yerel işlevler, Gemini izin / bütçe / iptal kapıları ve gerçek belge okuma altyapısı korunur. Model değiştirilmedi; yeni bir sunucu / sohbet arşivi kurulmadı.

## Doğrulama

- `tests/assistant-workspace.test.mjs`: gerçek seçili sayı tanımı, devre dışı / kaydedilmiş satırlar, eksik soru gruplama, tek mesaj alanı ve HTML kaçışları.
- `tools/e2e/assistant_workspace.py`: varsayılan kısa görünüm, 320 / 390 / 768 / 1280 genişlik, sabit mesaj alanı, Enter / Ctrl+Enter, konuşarak düzeltirken manuel açıklamanın korunması, fiyat bekletme, açık onayla tek kayıt, gerçek kayıt bağlantısı, salt okunur geçmiş, ekleme / kaldırma / içerik tekliği, aynı adlı farklı fotoğraflar, PDF kartı, geçişte dosya taslağı, çevrimdışı yerel taslak / iptal, taklit modelle görünür hedef sorusu ve okuma iptali.
- Mevcut ayrıntılı düzenleyici testleri gerçek kullanıcı görünüm tercihini açar; kayıt / güvenlik assertion'ları korunur. Görev / PDF testinin iki görsel bekleyicisi, PDF artık resim olmadığı için dosya kartını bekler. Görev, dosya, CAS ve çevrimdışı veri assertion'ları korunur.
- CI bütün Node dosyalarını, 66 tarayıcı suitini ve kurulu eski sürümlerden güncellemeleri çalıştırır. Yeni modüller servis çalışanı önbelleğine dahildir. Şema 7 kalır.

Testler ayrı TEST veri tabanlarında ve taklit model yanıtlarıyla çalışır. Gerçek telefonun sistem klavyesi / paylaşım ekranı ve gerçek Gemini okuma doğruluğu bu paketle ölçülmez. İşletmenin gerçek verilerine otomatik toplu değişiklik yapılmaz.
