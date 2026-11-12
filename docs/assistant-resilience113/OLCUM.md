# Gemini önerileri — uygulama ve ölçüm sınırları

Üçüncü paket yeni bir veritabanı deposu veya görev kayıt biçimi oluşturmaz. Mevcut assistant_tasks_v1, assistant_task_v1 ve görev dosyası taslakları kullanılır. Yerel metin okuma + İşlem çekmecesindedir; iş ve araç yakıtı metnini okur, fotoğrafı veya para hareketini okumuş saymaz. Daha sonra oku, metin ve belgeleri okunmamış görev olarak saklar. Yerel kaynağı yeniden açmak mevcut görev kimliğini korur; eski kesinleşmiş plan otomatik tekrar uygulanmaz.

Kota / bağlantı hatasında, ek veya açık kontrol kartı bulunmuyorsa desteklenen metin yerel okuyucuya geçer. Açık kart veya ek varsa üzerine yazılmaz. İptal/süre aşımı bu geçişi tetiklemez. Fotoğrafı internet olmadan çözebildiği iddia edilmez.

İkinci model kontrolü yalnız yeni, metin tabanlı iş/yakıt önerilerinde; en az iki bilinmeyen zorunlu alan veya doğrulama çelişkisi varsa çalışır. İlk sonuçtaki açık müşteri/tarih/fiyat çelişkisi ikinci modelle otomatik onaylanmaz. Manuel devam isteği, şoför kodu, belge ve para hareketleri ikinci sonuçla değiştirilmez. Kayıtlı model listesinde uygun muhakeme sınıfı aday yoksa veya erişim/kota yetmezse ilk sonuç korunur. Model sürüm adı sabit değildir. Model listesi/rol adı, ücretsiz erişim veya kalite garantisi değildir; mevcut anahtar, izin ve günlük bütçe kapısı aynen kullanılır. İkinci kontrol bir ağ isteğiyle sınırlıdır; bozuk JSON, şema veya kota hatasında üçüncü deneme yoktur. Ana model ayarı değiştirilmez. Yeni satır, kaynak veya işlem türü getiren ikinci sonuç reddedilir. Hiçbir model doğrudan kayıt yazmaz.

## Ölçüm

| Hat | Canlı v110 başlangıcı | Üç paket sonrası |
|---|---:|---:|
| Dondurulmuş tekil hazır doğru | 23/38 | 25/38 |
| Dondurulmuş tekil gereksiz soru | 7 | 3 |
| Dondurulmuş toplu hazır doğru | 15/38 | 15/38 |
| Dondurulmuş toplu gereksiz soru | 21 | 14 |
| Dondurulmuş toplu yanlış alan | 9 | 3 |
| Yerel okuyucu toplu hazır doğru | Ayrı hat | 25/38 |
| Yerel okuyucu toplu gereksiz soru | Ayrı hat | 3 |
| Sessiz yanlış / para tahmini / zorunlu işaret ihlali | 0/0/0 | 0/0/0 |

Gemini'nin 28/38 hazır ve en fazla 5 soru hedefi dondurulmuş model hattında sağlanmış değildir. İlk modelin yanlış tarihleri, daha yüksek hazır oranı elde etmek için onaylı hale getirilmez. Yerel okuyucunun sonucu gerçek Gemini başarısı diye sunulmaz. Aynı 38 kartlık sette para tutarı bulunmadığından finansal güvenlik ayrıca genel 73 kartlık altın setinde ölçülür. Genel hazır doğru 30/73; eski yerel gold 80 mesaj/369 alan/0 yanlış ayrı raporlanır.

## Açık canlı komut

Canlı koşucu yalnız takma adlı fixture kayıtlarını kullanır; cihaz veritabanına veya Kaydet akışına erişmez. CI'de çalışmaz. Anahtar ortamdan okunur; rapora yazılmaz. Gerçek ücretsiz model kimliği kullanıcı tarafından doğrulanır. Sayaç dosyası tekrarlarda aynı tutulmalıdır.

```sh
node tests/assistant-gold/real-messages/live.mjs --live --consent --free-tier-confirmed --owner-pseudonyms \
  --model "$TEST_FREE_GEMINI_MODEL" --budget 63 --repeats 3 --mode both \
  --usage-file /tmp/sahapro-owner-live-usage.json --output /tmp/sahapro-owner-live.json
```

Başarısız yanıt dondurulmuş yanıtla tamamlanmaz; eksik ağ turunda başarı oranı verilmez. Single 20, batch 1 istek; both ve üç tekrar 63 istek üst sınırına göre seçilmiştir. Her örnekte tek ağ isteği, ortak günlük sayaç, iptal ve 90 saniyelik süre kapısı vardır. Bu çalışma ortamında GEMINI_API_KEY bulunmadığından gerçek canlı koşu yapılmadı. Gerçek telefon/WhatsApp ve insanla tek el işlem süresi ölçülmedi.
