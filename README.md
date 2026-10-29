# SAHAPRO SOLO — Tek Kullanıcılı Mobil ERP (Muratoğlu Hafriyat)

Statik PWA. Backend yok; tüm veriler cihazda (IndexedDB) tutulur. Ana SAHAPRO değildir.

Site: https://tahirtoprak976-sketch.github.io/sahapro-cep-temp/

Sürüm: **SAHAPRO SOLO v3.9.86** — 29.10.2026

Kartları Birleştir ekranında Döküm sahası seçilebilir. Bağlı işler, döküm hareketleri ve belgeler
tutarları korunarak taşınır; çift açılış ve mükerrer fiş gibi hesap çakışmaları engellenir.
[Kullanım ve kapsam](docs/DUMP_CARD_MERGE_v3986.md).

Dijital fiş ve iş birlikte kaydedilir. Eski bağsız fişler, imza ve müşteri belgesi korunarak
mevcut işe bağlanabilir veya onayla yeni fiyatsız iş açabilir; otomatik toplu aktarım yapılmaz.
[Kullanım ve doğrulama kapsamı](docs/DIGITAL_SLIP_WORK_v3985.md).

Kayıt bütünlüğü: işleme ait güvenli geri alma, atomik fiş ve depo birleştirme, güncel kart/hakediş bağlantısı denetimleri. [Onarım ve doğrulama kapsamı](docs/INTEGRITY_RELEASE_v3984.md).

Hakediş hazırlığı: müşteri ve dönem bazında hazır işler, eksik bilgiler, kontrol gerektiren kayıtlar,
anlaşma kapsamındaki işler ve mevcut hakediş bağlantıları. Hazır işler mevcut hakediş formuna aktarılır;
taslak ve kesinleştirme onayları ayrıdır. [Kullanım ve kapsam](docs/HAKEDIS_PREPARATION_v3983.md).

Asistan: fiş numarasındaki tire/boşluk ve harf büyüklüğü farkı kayıt anındaki mükerrer kontrolünü aşamaz;
yakıt taslağında “20 litre” / “20 lt” yanıtları doğru alana uygulanır.
[Bağımsız inceleme ve onarım kapsamı](docs/ASSISTANT_REVIEW_v3982.md).

Asistan ekleri: boş görev dosyası taslağı silinir; “Ekleri temizle” kalıcı bekleyen ekleri doğrudan temizler.
Bağımsız incelemede doğrulanan kapsam: [ASSISTANT_FILES_v3981.md](docs/ASSISTANT_FILES_v3981.md).

Asistan denetimi: kaynak/fotoğraf eşleştirme, geçmiş tarihler, eksiksiz model yanıtı, taslak koruma, okuma iptali ve güncel kayıt onayı. Ayrıntı: [ASSISTANT_AUDIT_v3980.md](docs/ASSISTANT_AUDIT_v3980.md).

Finans denetimi: ondalıklı nakit girişi, çek/söz çifte sayımı, borç doğrulaması,
işlem kimliği çatışmaları, atomik tahsilat tarafları ve aylık tarih sınırı onarıldı.
[İnceleme, kapsam ve korunan hesap politikaları](docs/FINANCE_AUDIT_v3979.md).

Cari listesi ve müşteri cari kartında tahsilat öncesi ana para + KDV = toplam ayrı görünür.
Tahsilat, devir/düzeltme ve mevcut kayıtlı bakiye korunur; tahsilatın ana para/KDV dağılımı varsayılmaz.
KDV hariç işlerin henüz cariye eklenmemiş KDV'si ve belirsiz eski kayıtlar açıkça belirtilir.

Bağlantılı kartlar uygulamanın yazı rengini ve blok düzenini korur; ziyaret edilmiş kartlar morlaşmaz.
Operasyon Masası'nın Bekleyenler görünümünde başlık, durum, açıklama ve kaynak işlemi ayrı gösterilir.
Bu sürüm yalnız görünümü ve uygulama önbelleğini günceller; veri şeması ve hesaplama kuralları değişmez.

Operasyon Masası, kimlik bağlantılı İş Dosyası, bağımsız asistan görevleri, ortak belge bağlama ve teklif zinciri:
[v3.9.76 davranış ve doğrulama notları](docs/WORKFLOW_v3976.md).

Eklerin güvenli açılması, açık tonaj kapsamı ve eksik döküm maliyetinde kâr gösterilmemesi:
[v3.9.75 davranış ve doğrulama notları](docs/REDTEAM_v3975.md).

Geçmiş yakıt için ayrı mutabakat bekleme, atomik iş/yakıt onayı ve eklemeli şema7:
[v3.9.74 davranış ve doğrulama notları](docs/HISTORICAL_FUEL_v3974.md).

Kesinleşen döküm maliyeti, kalan tahmin ve değişmeyen kayıt dayanağı:
[v3.9.73 davranış ve doğrulama notları](docs/DUMP_COST_v3973.md).

Finans kayıtlarının ve hakediş/fatura tutarlarının korunması:
[v3.9.72 denetim ve doğrulama notları](docs/FINANCE_v3972.md).

Taslak koruması, tutarlı şantiye seçimi ve rapor kapsamının açıklığı:
[v3.9.71 karar ve doğrulama notları](docs/ENTRY_CLARITY_v3971.md).

Geçmiş aktarımında iş açıklamasından ayrı, yalnız kontrol amaçlı not ve kurulu
uygulamanın güvenli güncellenmesi: [v3.9.70 kullanım ve test notları](docs/HISTORY_REVIEW_NOTES.md).

Finans / stok denetimi: geçersiz tutarları reddetme, tarih sıralı depo koruması,
atomik kayıt/geri yükleme ve açık hesapların yenilenmesi:
[v3.9.69 denetim ve kullanım notları](docs/AUDIT_v3969.md).

İş/yakıt notlarında yalnız ilgili kayıt mesajı, kapalı tam kaynak ve eski notların
geçmiş eşleştirmelerini kirletmemesi: [v3.9.68 kullanım ve test notları](docs/RECORD_NOTES_v3968.md).

Parça kaydında açık gider seçimi ve daha önce kaydedilmiş parçayı giderlere bağlama:
[v3.9.67 kullanım ve test notları](docs/PART_COST_v3967.md).

Asistan ve parça kartından garanti fotoğrafı/PDF okuma, alan kontrolü ve orijinal belge saklama:
[v3.9.66 kullanım ve test notları](docs/PART_DOCUMENTS_v3966.md).

Asistanla toplu tarih/fiyat talimatları, hazır iş seçimi ve güncel stok ön denetimi:
[v3.9.64 kullanım ve test notları](docs/ASSISTANT_BATCH_v3964.md).

Toplu geçmiş giriş: ortak kart soruları, tek onayda atomik kayıt ve kalan taslağa devam.
[v3.9.65 kullanım ve test notları](docs/BULK_ENTRY_v3965.md).

Telefona eşleştirilmiş şifreli bağlantıyla geçmiş iş önizlemesi ve kontrollü kayıt:
[v3.9.63 kullanım ve güvenlik notları](docs/SECURE_TRANSFER_v3963.md).

Müşteri kartında tutarlı okuma ve Kimi denetimi sonrası test düzeltmeleri: [v3.9.62 notları](docs/KIMI_REVIEW_v3962.md).

Müşteri panosunda mazot tahsilatı grafiği: [v3.9.61 notları](docs/FUEL_CHART_v3961.md).

Şoförde alt müşteri ve nakit bildirimi: [v3.9.35 notları](docs/DRIVER_CASH_v3935.md).

İş girişinde verimlilik: [v3.9.34 notları](docs/PRODUCTIVITY_v3934.md).

Şoför dosya eşleştirme denetimi: [v3.9.33 notları](docs/CRITIC_v3933.md).

Şoför kayıt ve iletim akışı: [v3.9.32 notları](docs/DRIVER_JOURNEY_v3932.md).

Günlük Saha Akışı: [v3.9.31 notları](docs/FIELD_STREAM_v3931.md).

Araştırma bulguları, tutarlı yedek ve güvenli güncelleme: [v3.9.30 notları](docs/RESEARCH_v3930.md).

İş Kayıtları filtreleri, özet ve CSV: [v3.9.29 notları](docs/WORK_ULTIMATE_v3929.md).

Şoför gönderim merkezi: [v3.9.28 notları](docs/DRIVER_ULTIMATE_v3928.md).
