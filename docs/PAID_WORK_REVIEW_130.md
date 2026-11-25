# Peşin iş ve tahsilat kontrolü — v3.10.31

Kullanıcı, sohbette onaylı iki peşin işin de uygulamaya hazırlanmasını istedi. Mevcut otomatik geçmiş aktarımı yalnız ödenmemiş iş kabul ediyordu; peşin işin bu yoldan geçirilmesi yanlış cari doğururdu. Yeni taşıma sözleşmesi iş ve tahsilatı **kontrol taslağı** olarak telefona getirir. Var olan ödenmemiş iş, belge/mahsup, yakıt ve şoför yolları korunur.

## Yetki ve kayıt

`SAHAPRO_PAID_WORK_REVIEW_V1`: tek satır, açık güncel sohbet onayı, kaynak kimliği, tarih, tam kart adları, miktar/birim/iş türü, doğrulanmış birim fiyat ve tahsilat tutarı, para yeri, ham kaynak. Yeni müşteri yalnız `create_customer:true` ile açıkça onaylanır. Tutar, KDV ve kişi model tarafından tahmin edilmez. Kaynak, alıntı içindeki talimatları yetki saymaz.

Paket AES-GCM ve mevcut SPAR bağlantısıyla yalnız meta deposunda sahnelenir. Bu aşamada iş, müşteri veya para kaydı yoktur. Ayrı panelde tahsilat kutusu **her zaman işaretsizdir**. Telefonda bu kutu işaretlenip **İşi ve Tahsilatı Kaydet** seçilmeden finans kaydı oluşmaz. Mevcut kilit/reauth, görünür yönetici oturumu, bağlantı iptali, güncel kaynak özeti ve kart kontrolleri işlem içinde yeniden denetlenir. Otomatik kontrol döngüsü bu yerel onayı veremez.

KDV dahil/hariç ve oran için varsayılan yoktur. Kullanıcı oranı açıkça girer veya KDV belirsiz/fiyat beklesin seçer. İkinci durumda iş fiyatı null kalır, gerçek tahsilat kaydedilir; bu hesap tam fiyatlandırılmış iş değildir. Mevcut KDV/cari işletme kararı değişmez: kesinleşmemiş iş için ana para; KDV yalnız hakedişin açık seçimiyle.

Tek transaction: gerekirse müşteri + mevcut biçimde work_records + cash_records + negatif Tahsilat cari satırı + kaynak indeksi + inceleme sonucu + mevcut aktarım makbuzu. Tahsilat kaynak cash kaydına, cash da işe bağlanır. Banka veya depo hareketi yazılmaz. PERSONELDE, kasaya teslim değildir. KASAYA_TESLIM_EDILDI şirket kasasıdır. Aynı kaynak/aynı yerel seçim tekrarında yazma yok; farklı içerikte OP_CONFLICT. Aynı iş veya gün/müşteri/tutardaki manuel tahsilat varsa inceleme için durur; eski kayda otomatik bağlanmaz/dokunmaz.

Önce tam kurtarma yedeği alınır. Son makbuz yazımı hatasında iş/tahsilat/cari/yeni müşteri birlikte geri alınır. Şema8, mevcut işletme kayıt alanları ve finans düzenleme/silme kuralları korunur. Yeni meta anahtarları yalnız taşıma, inceleme ve kaynak tekilliğidir; veri göçü yoktur. Yedekte kayıtlar taşınır; yeni telefonda aktarım yetkisi veya para kaydı kendiliğinden etkinleşmez.

## Doğrulama sınırı

Sentetik Node ve gerçek Chromium/IndexedDB testleri: sahnelemede sıfır işletme kaydı (yalnız meta inceleme denetim izi), iki işaretsiz kart, yerel KDV/boş fiyat, kasa/personel ayrımı, tek cari tahsilat, sıfır banka/depo, kullanıcı düzeltmelerini koruma, kaynak çatışması ve tekrar, transaction rollback, iptal edilmiş yetki, yedek dönüşü ve 360px. Gerçek işletme verisi ve anahtarlar testlerde/depoda yoktur. Gerçek Gemini veya gerçek telefon başarısı iddia edilmez.

Bu sürüm yayımlandıktan sonra gerçek iki onaylı paket ayrı şifreli teslimle gönderilir. Kullanıcı KDV durumunu seçer, tahsilat kutusunu işaretler ve Kaydet der; telefon sonucu gelmeden işler kaydedildi sayılmaz.

Canlı v3.10.30 ticari takip güncellemesi korunarak birleştirildi; sürüm v3.10.31 oldu. Ticari takip modülleri, menü bağlantıları, var olan testler ve CI adımları korunur.
