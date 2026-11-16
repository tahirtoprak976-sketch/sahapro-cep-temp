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

## Yeni müşteri kararı ve doğrulama

2026-11-16 tarihinde işletme sahibi yeni müşteri için ayrıca onay alınmasını açıkça seçti (“Alınsın”). Bu karar doğrultusunda aşağıdaki iki testin yalnız otomatik hazır beklentisi true → false olarak güncellendi; isim, taşeron ilişkisi ve şantiye kontrolleri korundu:

- tests/assistant.test.mjs: açık yeni müşteri.
- tests/customer-ambiguity.test.mjs: açık yeni taşeron.

Yeni Chromium senaryosu, müşteri onayından önce kartın işaretsiz olduğunu; soru cevabının yalnız ilgili müşteriyi doğruladığını; diğer karttaki elle değiştirilen miktarı koruduğunu ve Kaydet olmadan iş/müşteri kaydı yazılmadığını doğrular. Bu senaryoyla birlikte confidence100 tarayıcı dosyasındaki 17 senaryo geçti. Tam Node, CI tarayıcı ve yükseltme kapıları devam ediyor.

Aday sürüm v3.11.06, SW önbelleği güncel. Telefon sınav paketine yeni ölçüm yardımcısı eklendi. Kalıcı şema veya eski işletme kayıtları değiştirilmedi. Ana uygulamaya yayın yapılmadı. Gerçek Android kabulü ve üç tekrarlı yeni Gemini ölçümü tamamlanmış değildir.
