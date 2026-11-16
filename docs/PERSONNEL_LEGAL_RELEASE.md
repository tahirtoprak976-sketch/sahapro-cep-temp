# v3.10.14 — izin ve saatli puantaj

Kullanıcının 16.11.2026 kararı: 10 günlük parça şartı plan onayında korunur; geçmiş fiilî kullanım, aykırılığı gizlemek üzere reddedilmez, TEN_DAYS uyarısıyla kaydedilir. Taslak onay değildir ve kullanılabilir bakiyeyi rezerve etmez. Fiilî kayıt gelecekteki tarih için açılamaz.

## Geçiş ve eski veri

DB_VERSION/SCHEMA_VERSION 7→8 yalnız iki boş depo ekler: izin_kayitlari, puantaj_kayitlari. Eski personel, olay, iş, kimlik, tarih, bakiye veya dosya byte'ı değiştirilmez. Açılıştan önce mevcut kurtarma mekanizması tam v7 kopyasını saklar. Yedekler iki depoyu ve orijinal imzalı dosyaları içerir. İmzalı kayıt eski yedekle ezilemez; dosya özeti uyuşmazlığı reddedilir. Parçalı yedekte eksik dosya ancak mevcut parça takip sistemi kapsamında bekleyebilir; eksik yedek tam sayılmaz.

Yeni izinler eski personnel_events tablosuna çoğaltılmaz. İzin ve puantajın okuma köprüsü yeni kayıtları kaynaklarından okur. Personel üzerindeki doğrulanmış izin açılışı, hak yılı kalanları ve o yılda önceki parçaları işletme sahibi girer. Eski kayıtlara hak yılı atanmaz. Eski yöntemle açılıştan sonra girilmiş yıllık izin varsa otomatik dağıtım yerine uzlaştırma istenir. Tarih, doğum ve bakiye bilinmiyorsa sıfır varsayılmaz. Yeni kayıt bulunan kişinin açılışı sessizce değiştirilemez.

Eski izin formları/arşivleri görüntülenir; yeni form ve onaylar yeni akışa yönlendirilir. Eski geçmiş hareketleri otomatik dönüştürülmez. Normal izin girişi #/izinler veya #/izin-puantaj, saatli puantaj ayrıca eski Puantaj ve Maaş ekranından açılır.

## Hukuk ve kayıt sınırları

- Güncel kaynakların tarih/hash bilgisi PERSONNEL_LEGAL_SOURCES.json içindedir. Güncel 4857 Ek m.2 babalık iznini 01.05.2026'dan itibaren 10 gün yapmıştır (önce 5); olay tarihi esaslı saf API ve ekran açıklaması günceldir. Eski bakanlık PDF'indeki 5 günü güncel hüküm gibi kullanmadık. Karar numarası/metni doğrulanmış bir Yargıtay kararı eklenmedi; içtihat sertifikasyonu iddiası yoktur.
- Yıllık izin: 1 yıl bekleme, 14/20/26 hizmet yılı, 18 ve altı / 50 ve üstü tabanı 20, ayrı hak yılı bakiyesi, Pazar yerine personelin kayıtlı hafta tatili. Cumartesi kendiliğinden düşmez. 2026 dinî tatiller Diyanet kaynağından alınmıştır; sabit tatiller/yarım günler ayrıca sayılır. Doğrulanmamış yılda yıllık izin hesabı onaylanmaz. Bu sürümün doğrulanmış takvim kapsamı 2026'dır.
- Hesaplanan tarih/gün dökümü izin kaydında donar. Sonraki hafta tatili ayarı eski izin günlerini değiştirmez. Mazeret, rapor, ücretsiz ve yol izni yıllık bakiyeden düşmez; mazeretin hak sahibi/olay belgesi işletme sahibince kontrol edilir.
- İzin ve rapor ile çalışma çakışması aynı yazma transaction'ında engellenir. Koruma tekil iş, toplu iş, asistan/şoför yazımı, eski personel hareketi ve import yollarını kapsar. İkame çalışma başka personelin açık kimliğiyle yazılır; izinli zimmet sahibine otomatik iş yazılmaz.
- Fiilî ara dinlenmesi onaylanmadan net saat kesinleşmez. Mola yalnız önerilir; kullanılmayan mola kullanılmış gibi düşülmez. Günlük >11 saat, eksik mola, gece, genç çalışan, yarım gün tatil veya tatil çakışması kayıt üzerinde uyarılır. Gece/özel işkolu/denkleştirme/çocuk ve genç işçi rejimlerinde genel 11 saat eşiği uygunluk kanıtı değildir.
- Haftalık 45 saat, daha kısa sözleşmede fazla sürelerle çalışma ve günlük aşım ayrı saf hesaplanır. UI eksik kayıtlı haftadan/yıldan kesin ücret veya mevzuata uygunluk üretmez; saptanan alt sınır ile 240/270 riskini gösterir. UBGT ve hafta tatili ücretleri otomatik kesin bordroya çevrilmez. Eski ücret tahakkukları değişmez.
- Tek taraflı ceza/hasar Kesinti yazımı ortak kapıda kapalıdır. Belgeli avans mevcut Avans akışından izlenir; ikinci kez Kesinti açılarak düşülmez. Somut muvafakatlı mahsup için saf doğrulama API'si kişi/tutar/orijinal belge/hukuki inceleme/mahsup sınırı ister; genel bir checkbox ücret kesmeye yetki vermez. Bu sürüm genel otomatik muvafakatlı mahsup ekranı açmaz.
- Fazla mesai muvafakat tarihi kaydedilebilir; tarih belge yerine geçmez. Yönetmelikteki 30 gün önce yazılı geri alma hakkı ekranda belirtilir; yıllık muvafakat zorunluluğu varsayılmaz.

## Belge ve imza

İzin talebi gelecekteki kullanım için “kullandım” demez. Dönüş sonrası kullanım ve bakiye mutabakatı ayrı PDF'dir; önceki devir + yeni hak - önceki kullanım/plan - bu izin = kalan açıkça yazılır. Yalnız işçi (ad/T.C./imza) ve işveren (imza/kaşe) olmak üzere iki imza alanı vardır. Tek sayfalık PDF gerçek motorla kontrol edilmiştir.

Islak imzalı orijinal fotoğraf/PDF güvenli dosya yolundan geçer, sıkıştırılmaz, SHA-256 ve kaynak dosya bytes'ıyla atomik saklanır. İki imzayı insan kontrol eder; yüklemek veya hash eşleşmesi ıslak imzanın sahihliğinin otomatik kanıtı değildir. İmzalı kayıt/dosya ve imzalı aylık dönem değiştirilemez; yeni puantaj da eklenemez. Ayrı gerekçeli düzeltme/uyuşmazlık süreci olmadan kilit açılmaz.

## Test sözleşmesi

Eski testlerin iş/para güvenliği beklentileri korunur. Yalnız açıkça yetkilendirilmiş şema8/sürüm14 geçişi için sürüm sabitleri güncellenir. Yükseltme testleri eski bütün satır/metadata/taslak/orijinal bytes karşılaştırmasını korur; yalnız iki BOŞ depo ve schema_version_current=8 farkına izin verir; tam v7 kurtarma kopyasını ayrıca karşılaştırır. QA v3.11.07 uygulaması aynı kanonik hash'lerde kalır. Önceki “root byte'ları hiç değişmesin” QA yayınına özgü kontrol, yalnız manifestte tek tek hash'i olan HR root dosyalarını kabul eder; diğer root dosyaları eski hash'lerinde kalır.

Yerel saf testler, sentetik transaction/arşiv/yedek turu ve 320/360/768 mobil ekran/PDF testi geçti. Tam Node, CI tarayıcıları ve gerçek SW yükseltme kapılarının son sonuçları PR'da yazılır. Gerçek telefon, gerçek işletme kayıtları, ıslak imza sahihliği ve somut uyuşmazlığın mahkeme değerlendirmesi test edilmedi. Gemini/WhatsApp canlı ölçümü bu çalışmanın kapsamı değildir.

## Yayın / geri dönüş

APP_VERSION=3.10.14, schema8, yeni SW cache ve bütün HR modülleri ASSETS'te. Kapılar geçmeden merge yok. Şema8 açıldıktan sonra schema7 kodunu doğrudan dağıtmak VersionError verir; geri dönüş gerektiğinde v8 depolarını/yedek desteğini koruyan uyumlu düzeltme veya revert PR kullanılmalı. Depolama/veritabanı silinmez; yeni kayıtlar atılmaz.
