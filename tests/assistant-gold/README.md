# Asistan altın seti (Paket 0)

Bu set `tests/gold` yerel ayrıştırıcı sınavından ayrıdır. Ölçüm kodu uygulama kaydı yazmaz. v3.9.99 aynı PR içinde doğrulayıcıdaki üç güvenlik onarımını da içerir. `cards.json` yalnız `TEST_` kimlikli kartlar; `cases.json` 63 sentetik mesaj, sentetik fotoğraf metni, sabit model yanıtı ve bağımsız beklenen alan/işaret/soru kararını içerir. Gerçek yedek, işletme kaydı veya şoför bağlantısı kullanılmaz.

`node tests/assistant-gold/run.mjs --report /tmp/assistant-gold.json` gerçek `validatePlan`, `validateExtras`, `validateTickets` ve model güven sınırı `untrustedWorkPlan` ile tekrar oynatır. Ağ/anahtar/veritabanı kullanmaz. Üç güvenlik metriğinden biri sıfır değilse komut başarısızdır; beklenen başarısızlığı başarıya çeviren bayrak yoktur. `tests/assistant-gold.test.mjs` normal Node taramasına ve CI'ye dahildir. Eski `tests/gold` değişmez ve ayrı raporlanır.

Ölçüm tanımları:

- Sessiz yanlış: işaretli kartın beklenen türü veya sınanan alanlarından en az biri yanlış (kart başına bir). Zorunlu işaretsiz sınıf dışında, işaretlenmemesi beklenen kartın işaretlenmesi de sessiz yanlış sayılır. Eksik/fazla kart sayısı ayrıca raporlanır.
- Para alanında tahmin: işaretsiz kart dahil herhangi bir dolu para alanı, o alana ait bağımsız beklenen tutarla uyuşmuyor. Litre × açık fiyat ve açık toplam ÷ litre gibi kesin aritmetik, beklenen sonuçta açıkça tanımlıdır; tahmin sayılmaz.
- Zorunlu işaretsiz kartta işaret: a–e sınıfı beklenen kartta `ok=true`. Tahsilat, kasaya teslim, personel ödemesi/avans, müşteriye borç doğuran mazot, müşteriden cari etkili depo girişi ayrı örneklerle korunur. Normal petrolcü depo girişi kapsam dışıdır.
- İşaretli doğru kart oranı: alanları doğru ve işaretlenmesi beklenen işaretli kartlar / tüm beklenen kartlar. Alan doğruluğu ayrıca `correct/total` verilir.
- Soru ölçümü bu saf katmanda **yaklaşıktır**: modelin açık soruları ve doğrulayıcının soru/seçim/alan istemi cümleleri, mesaj içinde tekilleştirilerek sayılır. Gereksiz oran, `shouldAsk=false` mesajlarındaki istemler / tüm istemlerdir. Bu ölçüm DOM'daki gerçek soru kutusu sayısı veya kullanıcının harcadığı dokunma sayısı değildir. Arayüz testleri ayrıca gereklidir.

Model yanıtları elle hazırlanmış deterministik test girdileridir; gerçek Gemini'den alınmış yanıtlar veya onun başarı oranı değildir. Hatalı model çıktıları da güven sınırını sınamak için kasıtlı olarak bulunur. Eşleşme beklentileri sonraki paketlerin hedefini tarif eder; güvenlik eşiği başlangıçta da gevşetilmez.

## İsteğe bağlı canlı sentetik komut

CI'de çalışmaz; gerçek telefon veritabanına bağlanmaz. Anahtar yalnız `GEMINI_API_KEY` ortam değişkeninden okunur. Kullanıcı modelin ücretsiz katmanını doğrular; model adı kodda sabit değildir. İzin, kalıcı günlük sayaç (aynı sayaç dosyasını kullanın), tek süreç kilidi, SIGINT/SIGTERM iptal ve 90 saniyelik ortak süre sınırı mevcut Gemini modülünden uygulanır. Bütçe HTTP denemelerini de sayar. Fotoğraflı örnekler bu canlı CLI'de desteklenmez; sentetik fotoğraf metni gerçek fotoğraf gibi sunulmaz.

```sh
node tests/assistant-gold/live.mjs --live --consent --free-tier-confirmed \
  --case work-complete --model "$TEST_FREE_GEMINI_MODEL" --budget 1 \
  --usage-file /tmp/assistant-gold-daily-usage.json --output /tmp/assistant-gold-live.json
```

Canlı komut otomatik çalıştırılmaz. Bu görevde gerçek Gemini, gerçek telefon ve gerçek WhatsApp sınanmış sayılmaz.

## v3.9.99 düzeltmesi ve karşılaştırılabilir taban

Ortak `TEST` ad önekleri kaldırıldı; sentetik işaret kimliklerde ve izole veritabanı adında tutulur. Ortak adlı iki müşteri örneği ayrıca korunur. 61 eski örneğe gerçek iki müşteri/fiyat belirsizliği ve başka müşteriye ait fiyat örneği eklendi (toplam 63). Eski adlarla alınmış rapor silinmez; yeni adlar ve aynı beklentilerle eski kaynak yeniden ölçülür. `node tests/assistant-gold/prove-baseline.mjs /tmp/assistant99-baseline.json` değişmemiş v3.9.98 arşivinde aynı 63 örneği ve aynı dokuz bağımsız regresyon testini çalıştırır; sekiz eski hata ile parasal olmayan değişmemiş kontrolü doğrular. Adayda bu dokuz testin hepsi geçmelidir.

Önceki `ok=true` finansal onay beklentileri `okData=true` ve `ok=false` olarak **sıkılaştırıldı**; tutar/geçerlilik kontrolleri korunur. Tarayıcıda önceden otomatik işaretli teslimat bekleyen sınama, artık işaretsizliği doğrular ve kaydetmeden önce kullanıcı seçimini açıkça yapar. Hiçbir eski iş/para hesabı beklentisi kaldırılmadı.
