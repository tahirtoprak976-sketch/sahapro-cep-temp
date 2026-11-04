# Paket 2 — v3.10.01

20 takma adlı gerçek mesaj, 38 beklenen kart. Gemini yanıtı bulunmadığından öneriler değiştirilmemiş v3.10.00 yerel ayrıştırıcısından donduruldu; oracle yalnız ölçümde kullanıldı. Bu başarı gerçek Gemini başarısı değildir.

| Kategori | Hazır doğru önce → sonra | Gereksiz soru | Kaçırılan soru | Yanlış alan |
|---|---:|---:|---:|---:|
| Gönderen ve tek iş | 1 → 3 / 4 | 3 → 0 | 0 → 0 | 0 → 0 |
| Yakıt / yük ayrımı | 2 → 3 / 4 | 0 → 0 | 1 → 0 | 0 → 0 |
| Çok iş / eşleşme | 3 → 7 / 7 | 3 → 0 | 0 → 0 | 1 → 0 |
| Mesai | 0 → 1 / 1 | 2 → 0 | 0 → 0 | 3 → 0 |
| Sefer / döküm / patron | 0 → 6 / 11 | 3 → 7 | 0 → 0 | 14 → 10 |
| Eksik / ortak bilgi | 1 → 2 / 8 | 1 → 0 | 4 → 0 | 10 → 1 |
| Sözleşme | 1 → 2 / 3 | 0 → 0 | 0 → 0 | 1 → 1 |

Toplam: hazır doğru 8 → 24/38; gereksiz soru 12 → 7; kaçırılan soru 5 → 0; yanlış alan 29 → 12. Sessiz yanlış 3 → 0. Fiyat tahmini yok; eski 63 kartlık sınavda 24 hazır doğru ve güvenlik ölçütleri 0/0/0 korunur. Eski yerel tests/gold ayrı koşar.

Toplu 20 mesaj ayrı ölçülür: 38 kart, 15 hazır doğru; sessiz yanlış 0, eksik/fazla kart 0. Tekil ve toplu başarı aynı değildir.

Soru kutusu yalnız soru kümesi değişince çizilir; tek dinleyici en güncel soru kimliğine bağlı cevabı uygular. Miktar/birim birlikte sorulur; araç/müşteri/tarih önce, sözleşmeye dahil yükleme işinin süre sorusu sonra gelir. Bu işaret, fiyat veya kayıt doğrulamasını değiştirmez.

Eski test beklentileri korunur. Yalnız historical-fuel-reporting testinin tam sürüm sabitlemesi 3.10.00 → 3.10.01 güncellendi; şema ve iş beklentileri değiştirilmedi.

Kalan sınırlamalar: Lale sözleşmesinin sayısal sefer tarifesi ve KDV bilgisi fixture’da yok; TL uydurulmadı. r17’de beklenen hafriyat sözcüğü mesajda yok; varsayımla doldurulmadı. Bunlar işaretsiz kartlarda yanlış/eksik alan olarak raporda kalır. Gerçek telefon, gerçek Gemini ve gerçek WhatsApp denenmedi; ortamda Gemini anahtarı yok. Paket 3 kayıt araçları bu PR’ın kapsamı değildir.

Önceki soru kutusu hata raporları tarihsel teşhistir. Kullanıcının sağladığı tıklama yaması ve soru sırası düzeltmesinden sonra r10, r19 ve toplu r00 testleri, aynı beklentilerle geçti.

Yayın öncesi ek kontrolde kayıtlı gönderenin geçersiz/göreli tarihi başlıktaki güne düşürdüğü yakalandı; ilk CI koşusu birleşmeden iptal edildi. Aynı test değiştirilmemiş 8988778’de hatayı gösterir. Adayda geçersiz gün/ay ve başlık, çelişen tarihler işaretsiz kalır; dün/bugün mesaj başlığına göre çözülür. Modelin farklı tarih önerdiği iş/yakıt kartı da işaretsiz kalır. Yeni Node ve tarayıcı kontrolleri eklenmiştir.
