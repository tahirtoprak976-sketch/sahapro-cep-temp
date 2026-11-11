# Aynı tarih teyidini bir kez sorma — aday v3.10.09

Telefonun kaynak satırından doğruladığı tarih, toplu konuşmada aynı miktarın geçtiği başka bir satırın tarihiyle karıştırılmamalıdır. Tarih kanıtı önce o kayıtla eşleşen telefon kanıtından alınır, sonra bağlı fişin tarihiyle karşılaştırılır. Model/mesaj veya fotoğraf çelişkisi kartı işaretsiz bırakmaya devam eder.

Aynı geçerli telefon tarihini teyit etmek isteyen iki veya daha fazla kart tek soruda toplanır. Fotoğraf çelişkisi, geçersiz tarih ve yalnız modelden gelen tarih bu gruba alınmaz. Tek kartın mevcut soru kimliği korunur. Cevap yalnız hedef kartların tarih alanına uygulanır; başka tarihler, elle düzeltilmiş açıklama ve zorunlu işaretsiz tahsilat kartı korunur. Kaydet olmadan işletme kaydı yazılmaz.

| Dondurulmuş takma adlı sınav | Önce | Aday |
|---|---:|---:|
| Tek tek 20 mesaj: hazır doğru kart | 23/38 | 24/38 |
| Tek tek: gereksiz soru | 7 | 6 |
| Toplu 20 mesaj: hazır doğru kart | 15/38 | 15/38 |
| Toplu: gereksiz soru | 21 | 9 |
| Toplu: soru adedi | 29 | 17 |
| Sessiz yanlış / kaçırılan soru | 0 / 0 | 0 / 0 |
| Genel dondurulmuş gold: doğru işaretli | 30/73 | 30/73 |
| Genel sessiz yanlış / para tahmini / zorunlu işaret | 0/0/0 | 0/0/0 |

Toplu sette kalan tarih sorularının çoğu kayıtlı model yanıtının mesajdaki tarihle çelişmesindendir. Kartları otomatik işaretleyerek güvenlik kuralı gevşetilmedi. Toplu hazır kart artışı iddia edilmez. Sınav metni, takma adlar ve beklenen cevaplar değiştirilmez; uygulamaya sınav adı eklenmez. Gerçek Gemini, gerçek telefon ve WhatsApp denenmedi.

Birim testi aynı tarih/farklı tarih, tek soru kimliği, geçersiz/kanıtsız tarihler ve fiş çelişkisini korur. Gerçek Chromium/IndexedDB testi iki kartın ortak cevabını, üçüncü kartın ve manuel açıklamanın korunmasını, tahsilatın işaretsiz kalmasını ve sıfır işletme yazmasını ölçer. Sağlayıcı yanıtı taklittir.

Bu çalışma v108 denetim onarımlarına bağlı ayrı adaydır; önceki yayın kapıları tamamlanmadan birleştirilmez.
