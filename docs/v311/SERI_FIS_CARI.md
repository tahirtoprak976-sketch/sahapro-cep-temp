# Seri fiş ve cari etki — taslak

Seri çekim çekmecesi kamera/galeri üzerinden birden çok fotoğrafı doğrular, cihaz destekliyorsa sıkıştırır ve mevcut assistant-pending-files taslağına yazar. Yeni tablo/şema/kayıt biçimi yoktur. Her kabulün kalıcı yazımı tamamlanmadan “cihazda saklandı” denmez. Çekmece okunmuş/kaydedilmiş iş oluşturmaz. Eski görevde sakla ve Gemini Gönder akışları kullanılır; ücretli servis veya yeni sunucu eklenmez.

Cari önizleme mevcut customerBalances hesabını aynen alır; kesinleşmiş KDV düşülmez. Yeni işin kayıtlı fiyatının ana parası veya açıkça yazılan tutar yerelde hesaplanır; yeni KDV eklenmez. Bilinmeyen fiyat/tutar 0 gösterilmez. Her satır kendi etkisini gösterir; taslaklar toplamı değildir. Kaydedilen kartın etkisi ikinci kez önizlemeye eklenmez.

Müşteri grubunun Hazır kartları kaydet düğmesi yalnız eksiksiz normal iş/standart gider/normal araç yakıtını kapsar. Beş hassas kart, müşteri mazotu, şoför ve belirsiz kartlar dışarıda kalır. İşaretli hassas kart bile bu düğmeyle yazılmaz. Hassas kartın tekil düğmesi önce kendi kutusunu işaretlemenizi ister. Mevcut global seçilenleri Kaydet akışı ayrı ve değişmemiştir. Grup/tekil kayıt, mevcut preflight, işlem kimliği, OP_CONFLICT, fiş, stok ve görev revizyonu korumalarından geçer. Diğer açık kartların alanları ve seçimleri korunur.

Sentetik tarayıcıda dört fişin yenileme sonrasında korunması, gruptan tek normal işin kaydı, seçili tahsilatın kaydedilmemesi ve diğer elle düzenlenen miktarın korunması geçti. Gerçek kamera, gerçek fiş OCR ve ücretsiz Gemini kotası denenmedi; dört fişin45sn kabulü henüz ölçülmedi. Tam CI ve v3.11 genel kabul tamamlanmadan merge/yayın yoktur. Akşam arayüzünün iki aşamalı kaymasız yerel önizlemesi hâlâ ayrıca tamamlanmalıdır.
