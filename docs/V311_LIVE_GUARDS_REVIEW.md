# İlk canlı Gemini yanıtları: güvenlik düzeltmesi adayı

Bu çalışma yayın adayı değildir. Yeni canlı API çağrısı yapılmadı; ee50c21 kaynaklı, sahibinin dışa aktardığı 33 gerçek Gemini yanıtı yeniden oynatıldı. Onaylı takma adlar korundu. Eski dondurulmuş yanıtlar ve beklentiler değiştirilmedi.

| Ölçüm | İlk canlı sürüm | Bu kodla aynı yanıtların tekrarı |
|---|---:|---:|
| Tekil hazır doğru | 24/38 | 24/38 |
| Toplu hazır doğru | 26/38 | 27/38 |
| Toplu gereksiz soru | 4 | 1 |
| Toplu kaçırılan soru | 2 | 0 |
| Toplu yanlış alan | 7 | 4 |
| Toplu sessiz yanlış | 2 | 0 |

Son sütun yeni Gemini başarısı değildir. Hazır kart artışının biri, kaynağın da doğruladığı yükleme/yüklendi eşdeğerliğinin ölçümde tanınmasıdır. Yanlış malzeme, alıcı, işlem ve olumsuzluk için negatif testler eklendi. Modelin kanıtsız miktar önerisi silinmez; doğrulama ister.

## Yayın engeli

209 mevcut Node dosyası çalıştırıldı: 207 geçti, 2 dosya düştü. Sonradan eklenen açıklama eşleştirme testi ayrıca geçti; tüm dosyalar henüz yeniden koşulmadı.

- tests/assistant.test.mjs:17: açık yeni müşteri adı için ok=true bekliyor.
- tests/customer-ambiguity.test.mjs:60: açık yeni taşeron adı için ok=true bekliyor.
- Gerçek mesaj oracle'ı ise yeni müşteri için seçim sorusu ve işaretsiz kart bekliyor.

Bu iki eski beklenti değiştirilmedi. Yeni müşteri için her durumda insan seçimi zorunluluğu eski hazır-kart sözleşmesiyle çeliştiği için birleştirme/yayın durduruldu. Tarayıcı ve yükseltme kapıları henüz çalıştırılmadı. Sürüm ve SW yayını yapılmadı. Kalıcı şema veya eski işletme kayıtları değiştirilmedi.

Gerçek Android kabulü ve üç tekrarlı yeni Gemini ölçümü tamamlanmış değildir.
