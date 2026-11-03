# Paket 1 — güven seviyeli doldurma, v3.10.00

Başlangıçtaki 63 sentetik mesaj ve bağımsız beklentileri değiştirilmedi. Kayıtlı model yanıtları gerçek doğrulama katmanında yeniden oynatıldı; bu ölçüm gerçek Gemini başarısını göstermez.

| Ölçüt — aynı 63 örnek | v3.9.99 | v3.10.00 |
|---|---:|---:|
| İşaretli doğru kart | 22 / 63 (%34,9) | 24 / 63 (%38,1) |
| Sessiz yanlış | 0 | 0 |
| Para tahmini | 0 | 0 |
| Zorunlu işaretsiz kart ihlali | 0 | 0 |

Artış +3,17 yüzde puan, önceki doğru işaret sayısına göre %9,1. Kolay örnek ekleyerek bu oran yükseltilmedi. Alan doğrulukları, sorular ve kalan eksikler yanındaki JSON raporlarında bulunur. İşaretsiz yanlış/eksik alanlar hâlâ vardır; sıfır sessiz yanlış bütün alanların doğru olduğu anlamına gelmez.

## Başlangıçtaki 41 işaretsiz kart

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

Bu bayraklar dışında gerekli alan/kanıtı eksik 9 kart vardır. Ayrıntı: unchecked-v3.9.99.json.

En büyük grup finansal onaydır: otomatik açılmadı. Fiyat belirsizliği ikinci gruptur: para tahmini yapılmadı, fiyat sorusu korundu. Güvenle çözülebilen ilk iki neden tek şantiye sahibinden ve aynı gün aracın tek gerçek işinden müşteri çıkarımıdır. Bu iki örnek artık işaretli; gerçek çoklu müşteri adayları sessiz elenmez.

## Alan davranışı

- Kesin / Çıkarım / Doğrulayın rozetleri görünür; çıkarımın gerekçesi kartta tek satırdır. Kullanıcının son talimatı uyarınca BİLİNMİYOR alanın mevcut önerisi silinmez, kart işaretsiz kalır. Model değer vermemişse alan boş kalır. Doğrulama katmanının reddettiği para tutarı yeniden gösterilmez.
- Tam kayıtlı ad/takma ad, tek şantiye sahibi, aracın aynı günkü tek işi ve müşterinin tek açık sözleşmesi telefondaki kayıtlardan değerlendirilir. Üç günlük yakın geçmiş ve bulanık eşleşme kendiliğinden kesinleşmez.
- Kayıtlı fiyat ayrı gösterilir; manuel fiyat alanına aktarılmaz. Mevcut fiyat kaynağı, KDV ve cari hesabı korunur. Bağlam değiştiğinde fiyat mevcut motorla yenilenir.
- Para alanı çıkarım olamaz. Beş zorunlu işaretsiz sınıf değişmez. Kaydet öncesi kayıt yazılmaz.
- Veresiye kartta esnafı boşaltmak kendiliğinden peşin işlem oluşturmaz. Esnaf veya peşin ödeme açıkça seçilir; bütün seçimin kontrolü ilk yazmadan önce yapılır.
- Güven bilgisi yalnız geçici taslaktadır. Şema7 ve kalıcı kayıt biçimi değişmedi; eski kayıtlar düzeltilmez. YZ2, sağlayıcı ve sunucu değişikliği yoktur.

## Fotoğraf, tarih ve rakamlı araç düzeltmeleri

Ek sınav seti confidence-cases.json içindedir: çok tarihli/fotoğraflı yakıt ve gider; mesaj–fotoğraf tarih çelişkisi; açık eski tarih, WhatsApp başlığı ve dün karşısında modelin bugünü; JCB3CX ve CAT320 miktarları. Bu 9 ek örnek başlangıçtaki orana katılmadı. Toplam72 örnekte eski v3.9.99 kaynaklarında4 sessiz yanlış görülürken adayda0; adayın yeni9 örneğinde alan/işaret/soru beklentileri birebir geçer.

Tarih kanıtı mesaj satırı/başlığında ve ilgili fotoğrafta ayrı aranır. Birleşik metin mesaj içinde aranmaz. Tarih çelişirse modelin önerisi görünür ve işaretsiz kalır; mesajdaki tarih tek dokunuşla önerilir. Eski WhatsApp başlığındaki dün, gönderenin gününe göre hesaplanır. Açık sayı+birim, araç kodundaki rakamla karıştırılmaz.

## Tekrar çalıştırma ve önce/sonra kanıtı

- `node tests/assistant-gold/prove-confidence.mjs`: değişmemiş v3.9.99 kaynaklarıyla aynı ölçüm ve odaklı testler; adayla karşılaştırma.
- `node tests/assistant-gold/run.mjs`: değişmemiş63 örnek. `--confidence`: yeni9 dahil72 örnek.
- `python tools/e2e/prove_confidence_photo.py`: aynı, değiştirilmemiş assistant_large_batch testini v3.9.99 ve onarım öncesi PR commit6faebb1 üzerinde çalıştırır. Canlı99 geçer; eski PR100 iş aşamasını geçip fotoğraflı25 kartın kayıt sonucunda düşer. Aday aynı özgün testte tüm100+25 kontrollerini geçmelidir.
- 17 odaklı Node kontrolü ve16 gerçek ekran senaryosu: önerilerin görünür/işaretsiz kalması, eksik alanın boşluğu, tarih önerisinin yalnız ilgili alanı değiştirmesi, KDV/fiyat kaynağı, veresiye ön kontrolü ve Kaydet öncesi sıfır yazma.
- Eski dört tarayıcı testinin tüm özgün assert ifadeleri AST karşılaştırmasıyla korunur. Önceki boş alan ek kontrolleri son kullanıcı talimatına göre görünür öneri/Doğrulayın olarak güncellendi. Son kayıt, bakiye, görev kilidi, iptal ve sıfır yazma beklentileri değiştirilmedi.
- Yerel tests/gold ayrıca raporlanır:80 mesaj,0 yanlış. Tüm Node dosyaları,75 tarayıcı suiti ve30 yükseltme senaryosu CI kapısıdır.

Gerçek telefon, gerçek Gemini ve gerçek WhatsApp bu sentetik testlerde sınanmadı.
