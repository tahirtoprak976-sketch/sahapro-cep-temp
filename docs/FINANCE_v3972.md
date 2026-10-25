# SOLO v3.9.72 — Finans kayıt bütünlüğü

Bu sürüm genel muhasebe politikasını değiştirmez. Cari, kayıtlı hareketler,
hakedişe girmemiş iş değeri ve mazot litreleri ayrı kapsamlar olmaya devam eder.
Kullanıcının mevcut kayıtları, fiyatları, kaynak mesajları ve ek dosyaları topluca
yeniden yazılmaz. DB sürümü **6**, uygulama kimliği ve yedek biçimleri korunur.

## İncelenen ve dar kapsamda düzeltilen noktalar

- **Müşteriye giden metin/PDF:** Düzeltmenin iç notu, açık kalemler tablosu ve
  tahsilat hatırlatmasından da çıkarılır. İç görünümde özgün not durur. Normal
  hakediş ve mazot teslimi açıklamaları korunur; tutarlar değişmez.
- **Hakediş ve fatura:** Eski kesinleştirme net hakediş tutarını, “KDV dahil”
  iş fiyatı kopyasına yazabiliyordu. Yeni kesinleştirme işin dondurulmuş tarife
  girdisini korur. Hakedişin net/KDV/brüt tutarı ve cariye yazılan borç değişmez.
  Kesinleşmiş işin fatura hazırlığı, doğrulanmış hakediş satırının net ve KDV
  kuruşlarını kullanır; KDV ikinci kez düşülmez veya toplu satırda yeniden
  yuvarlanmaz. Örneğin ayrı iki 0,03 TL satırın kayıtlı 0,02 TL KDV'si korunur.
  Yuvarlanan birim fiyat gösterimi yerine kayıtlı satır toplamı esastır.
- **Eski kayıtları okuma:** Yalnız tek, aktif, kesinleşmiş ve aritmetiği tutarlı
  kaynak hakediş; aynı müşteri/iş/miktar/birim/tarih ve kopyalanmış fiyat alanları
  birlikte doğrulanırsa iş değeri salt okunur görünümde düzeltilir. Kaynak
  belirsizse geçmiş fiyat değiştirilmez. Fatura ekranında kayıt görünür,
  hesaplanmış toplam/kopyalama/işaretleme kaynak kontrolüne kadar engellenir.
  Müşteri raporu, ayrıntılı rapor, finans grafiği ve Veri Sağlığı kontrolü açık
  uyarı gösterir. Hakedişsiz normal geçmiş aktarımı ve zaten kesilmiş faturalar
  yeniden işlenmez.
- **TL + mazot:** Faturasız işte pozitif TL varsa fatura kuyruğunda yer alır;
  litre tutara eklenmez. Yalnız mazot, fiyatsız ve açık sıfır işler hayali TL
  faturası oluşturmaz.
- **Bağlı kayıtlar:** Cariyle bağlı kasanın finansal alanları tek başına
  değiştirilemez. Taslak hakedişe bağlı iş, genel düzenlemeyle sessizce farklı
  hale getirilemez. Oluşturma/kesinleştirme güncel kaynakları ve kaydedilmiş
  toplamları aynı transaction içinde kontrol eder; bozuk eski taslak reddedilir,
  yeniden fiyatlandırılmaz. İptal/kesinleştirme yarışı tamamlanmış finansal
  işlemi geriye dönük iptal edemez.
- **Müşteri ve şantiye:** İş/finans geçmişi olan müşterinin silinmesi ve kullanılan
  şantiyenin sahibinin genel düzenlemede değiştirilmesi engellenir. Müşteri
  pasife alınabilir; geçmiş farklı kişiye taşınmaz. Özel birleştirme işlemleri
  bu genel düzenleme kısıtından ayrı kalır. Ana firma/taşeron birlikte raporunda
  hesapların ayrı olduğu ve avansların otomatik mahsup edilmediği açıklanır.
- **Eksik fiyat tamamlama:** KDV oranı ve dahil/hariç seçimi görünür biçimde
  onaylanır. İşlere ve isteğe bağlı gelecek fiyat kuralına aynı seçim tek atomik
  işlemde yazılır. Eskiyen/kilitlenen hedefte kısmi başarı veya önce fiyat
  kuralını değiştirip işleri yazamama yoktur.
- **Sözleşme ekstra fiyatları:** Formda gösterilen 6–12 satırın yalnız ilk 4'ünün
  kaydedilmesi düzeltildi. Görünen tüm geçerli satırlar korunur; boş satırlar
  atlanır, geçersiz satır tüm kaydı durdurur. Mevcut pozitif fiyat kuralı değişmez.

## Değişmeyen işletme kararları ve sınırlar

Hakedişe girmemiş KDV hariç işi brüt borca çeviren genel bir geçiş yapılmadı;
`KDV_CARI_KARAR_NOTU.md` kapsamındaki karar ayrıca verilmelidir. Ödeme planı
metninden kendiliğinden borç/vade oluşturulmaz. Sözleşme PDF'sinde aynı şantiyeye
bağlama, aynı dosyayı yeniden yükleme ve ilk onaydan sonra formdan ayrılınca kalan
şantiye/belge kayıtları bu sürümde yeniden tasarlanmadı. Tam yinelenme/iptal
akışı ayrı, açık bir tasarım gerektirir; uygulamanın bu sınırı gizlenmez.

Müşteri silme koruması **mevcut bağlı geçmiş** için sınanır; bütün genel yazıcılar
arasında evrensel referans bütünlüğü garantisi değildir. Örneğin henüz geçmişi
olmayan kartın silinmesi ile önceden doğrulanmış bağımsız yeni kaydın yazılması
arasındaki tüm olası yarışlar bu sürümde yeniden tasarlanmadı.

Yeni hakediş taslakları kaynak fiyat kopyasını da dondurur; kaynak fiyat daha
sonra değişirse kesinleştirme durur. Bu geçmiş kanıtı bulunmayan eski taslaklarda
fiyat geçmişi tahmin edilmez: kayıtlı taslak fiyatı ve toplamı açık uyarı/onayla
korunur, güncel fiyat kendiliğinden uygulanmaz. Ayrı manuel hakediş fiyatı
geçerlidir; kaynak fiyatın kendisi olduğu varsayılmaz.

## Doğrulama kapısı

Değişmemiş v3.9.71 tabanında **129/129 Node test dosyası** geçti. Yeni örnekler
bu mevcut testlerin kaçırdığı hataları gösterdi. `invoice-core.test.mjs` içindeki
“4.000 TL + 75 L iş fatura kuyruğunda olmamalı” beklentisi teşhis edilmiş yanlış
beklentiydi: pozitif TL'nin dahil edilmesi ve toplam/tarih/tevkifat beklenenleri
birlikte düzeltildi; sıfır, yalnız mazot ve eksik fiyat kontrolleri ayrıca eklendi.
Bu nedenle “bütün eski assertionlar aynen kaldı” iddiası yapılmaz.
Eksik alanlı eski sentetik hakediş örnekleri `integrity.test.mjs` ve
`ledger_links_fixture.js` içinde kanonik hesaplayıcıyla üretilecek şekilde
tamamlandı; bu örneklerin mevcut doğrulama beklentileri korunur.

Gerçek Chromium/IndexedDB testleri standart GitHub-hosted Linux'ta, yalnız
sentetik verilerle çalışır. Yerel Chromium'un AF_UNIX kısıtı aşılmaya çalışılmaz.
Tam Node koşusu, eski tarayıcı korumaları, yeni finans/sözleşme karşı örnekleri,
gerçek transaction hatası ve iki sekme yarışı, PDF/mesaj mahremiyeti ve kurulu
v3.9.69/.70/.71'den .72'ye veri/audit/ek/taslak eşitliği yayın öncesi kapıdır.
Değişmemiş .71'de kusurun yeniden üretilmesi adayın başarılı testi sayılmaz.
Kesin sonuç ve commit/tree kimliği taslak PR ve CI kanıtında yer alır; test
hazırlanması veya derlenmesi gerçek tarayıcı geçişi anlamına gelmez.
