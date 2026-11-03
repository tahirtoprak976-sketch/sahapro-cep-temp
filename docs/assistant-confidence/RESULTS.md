# Paket 1 — güven seviyeli doldurma, v3.10.00

Aynı 63 sentetik mesaj ve aynı bağımsız beklentiler kullanıldı. cases.json ve cards.json değiştirilmedi. Kayıtlı model yanıtları gerçek doğrulama katmanında yeniden oynatıldı; bu ölçüm gerçek Gemini başarısını göstermez.

| Ölçüt | v3.9.99 | v3.10.00 |
|---|---:|---:|
| İşaretli doğru kart | 22 / 63 (%34,9) | 24 / 63 (%38,1) |
| Sessiz yanlış | 0 | 0 |
| Para tahmini | 0 | 0 |
| Zorunlu işaretsiz kart ihlali | 0 | 0 |

Artış +3,17 yüzde puan, önceki doğru işaret sayısına göre %9,1. Daha çok kolay örnek ekleyerek oran yükseltilmedi. Alan doğrulukları, sorular ve kalan eksikler yanındaki JSON raporlarında bulunur. İşaretsiz yanlış/eksik alanlar hâlâ vardır; sıfır sessiz yanlış, bütün alanların doğru olduğu anlamına gelmez.

## Başlangıçta 41 işaretsiz kartın nedenleri

Bayraklar çakışabilir; toplamları 41 olmak zorunda değildir.

| Bayrak | Kart |
|---|---:|
| needsApproval | 21 |
| priceUncertain | 3 |
| customerGuess | 2 |
| dateUnsure | 2 |
| ambiguous | 2 |
| ownerMismatch | 2 |
| guessed | 1 |
| parentMismatch | 1 |
| blocked | 1 |
| dup | 1 |

Ayrıca bu listede bayrağı olmayan fakat gerekli alan/kanıtı eksik 9 kart vardır. Ayrıntı: unchecked-v3.9.99.json.

En büyük grup finansal onaydır: otomatik açılmadı. Fiyat belirsizliği ikinci gruptur: para tahmini yapılmadı, fiyat sorusu korundu. Güvenle çözülebilen ilk iki neden tek şantiye sahibinden ve aynı gün aracın tek gerçek işinden müşteri çıkarımıdır. Bu iki örnek artık işaretli; gerçek çoklu müşteri adayları sessiz elenmez.

## Davranış ve sınırlar

- Alanlar Kesin / Çıkarım / Bilinmiyor olarak gösterilir. Çıkarımın gerekçesi kartta tek satırdır. Bilinmeyen alan düzenleme ekranında boştur.
- Tam kayıtlı ad/takma ad, tek şantiye sahibi, aracın aynı günkü tek işi ve müşterinin tek açık iş sözleşmesi telefondaki kayıtlardan değerlendirilir. Üç günlük yakın geçmiş ve bulanık eşleşme kendiliğinden kesinleşmez.
- Kayıtlı fiyat salt okunur gösterilir; manuel fiyat alanına aktarılmaz. Mevcut otomatik fiyat kaynağı, KDV ve cari hesabı korunur. Bağlam değiştiğinde fiyat önizlemesi mevcut fiyat motoruyla yenilenir.
- Para alanı çıkarım olamaz. Beş zorunlu işaretsiz sınıfın kuralı değişmez. Kaydet öncesi yazma yoktur.
- Fişte adı bulunmayan esnaf borcu otomatik seçilmez. Kullanıcı esnafı doğrular veya açıkça peşin gider seçer. Önceki fotoğraf testi bu yönde sıkılaştırıldı: tutarın doğru okunması tek başına isimsiz esnafı yetkilendirmez; eski tutar/fiş kontrolleri korundu.
- Güven bilgisi yalnız geçici taslaktadır; kayıtlara yazılmaz. Şema7 ve kalıcı kayıt biçimi değişmez, eski kayıtlar düzeltilmez.

## Tekrar çalıştırma

`node tests/assistant-gold/prove-confidence.mjs` değişmemiş v3.9.99 kaynaklarını arşivleyip aynı ölçümü ve aynı yeni testleri çalıştırır. Eski sürümde eksikler görünür; adayda 15 odaklı Node kontrolü ve 9 gerçek ekran senaryosu doğrulanır. Yerel tests/gold ayrı raporlanır; eski finansal taban kanıtı da CI'de tutulur.

Gerçek telefon, gerçek Gemini ve gerçek WhatsApp bu sentetik testlerde sınanmadı. Sağlayıcı, sunucu, ücretli servis veya YZ2 değişikliği yoktur.

Eski dört tarayıcı testindeki tüm özgün assert ifadeleri AST karşılaştırmasıyla korundu. Yeni kurala göre boşalan alanlar için kullanıcı seçimi eklendi; kanıtsız araç/müşteri ve modelin uydurduğu miktarın önce boş olduğu ayrıca doğrulanır. Son kayıt, bakiye, görev kilidi, iptal ve sıfır yazma beklentileri değiştirilmedi.
