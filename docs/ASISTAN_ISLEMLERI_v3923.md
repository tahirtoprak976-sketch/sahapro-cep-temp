# Asistan işlem çekirdeği — ilk çalışan dilim (v3.9.23 adayı)

## Amaç ve örnek
“Deneme'nin dünkü işini 3 saat yap” → aday işler → doğru işi seç → miktar ve net/KDV/brüt önizlemesi → Onayla ve uygula → kalıcı sonucu doğrula.

Bu dilim ekran açmanın ötesine geçer: yerel komut gerçekten iş miktarını günceller. Gemini anahtarı veya ağ isteği gerekmez. Var olan yeni iş/yakıt/gider/tahsilat kartları korunur; bu teslim onların tamamını yeni konuşma akışına taşımış değildir.

## Sözleşme
- Saf parseWorkQuantityChange yalnız tek pozitif miktarlı, açık yap/düzelt/değiştir/güncelle komutunu tanır. Artır/azalt, yerine/değil ve birden fazla miktar bu dilimde otomatik uygulanmaz.
- Saf previewWorkQuantity kaydı değiştirmeden geçerliliği, kapsamı ve mevcut fiyatla tutarı hesaplar. Birim değiştirilmez, güncel fiyat listesinden yeni tarife çekilmez.
- executeWorkQuantity açık onay ister, güncel kayıtla önizleme eşitliğini kontrol eder, bağlı kayıtları tekrar değerlendirir, mevcut saveExisting doğrulamasından geçirir ve sonucu yeniden okur.
- saveExisting'e isteğe bağlı strict seçeneği eklendi. Bu yol transaction içinde mevcut kaydın önizlemedeki kayda birebir eşitliğini ister; değişiklikte STALE ile durur. Diğer çağrıların mevcut alan birleştirme davranışı korunur.
- İş güncellemesi ve audit aynı mevcut IndexedDB transaction'ındadır. Çift basma UI kilidi; eski onayın tekrar kullanımı sürüm/içerik karşılaştırmasıyla korunur. Ayrı bir kalıcı kuyruk veya yeni DB store'u eklenmedi.
- Kaydedilmiş önizleme oturumlar arasında taşınmaz. Ekran kapanırsa komut tekrar verilir, güncel kayıtla yeni önizleme gerekir.

## Bilinçli sınırlar
Hakedişli, fişe/toplu fişe bağlı, dijital fişli, müşteri mazot kuralı/mazot hakkı veya şantiye sözleşmesi bulunan işler bu doğrudan işlemde engellenir ve forma yönlendirilir. Birim değiştirme, silme, fiyat değiştirme, toplu düzenleme, otomatik geri alma ve çok adımlı yakıt/gider/tahsilat soruları bu ilk dilimde eklenmedi.

Fiyatsız iş miktarı değişebilir; önizleme tutar hesaplanamadığını açıklar. Desteklenen fiyatlar mevcut birim fiyat ve tam tanımlı vinç ilk saat tarifesidir. KDV eksikse parasal önizleme uydurulmaz.

## Doğrulama
- 82/82 Node test dosyası geçti: komut, salt önizleme, KDV %0/dahil/hariç, kayıt kilitleri, onaysız işlem reddi, tekrar/no-op ve eski önizleme.
- Gerçek Chromium + IndexedDB, 412×900: iki adaydan seçim, önizleme ve vazgeçmede sıfır yazım; onayla miktar/tutar ve tek audit; aynı miktarda no-op; başka sekmede değişiklik sonrası STALE; iki gerçek Page/bağlantının aynı önizlemeyi eşzamanlı onayında bir update + bir STALE.
- Önceki fiş kurtarma tarayıcı testi tekrar geçti.
- Gerçek Gemini ve fiziksel telefon denenmedi. Gerçek kullanıcı verisi kullanılmadı.

## Bağımlılık ve yayın
Bu dal PR #141'in son commit'i 45c9ef3 üzerine kurulur. İnceleme tabanı codex/solo-v3922-asistan-tarih olmalıdır. #141 birleşmeden bu dal doğrudan gh-pages'e yayınlanmamalıdır; birleşme sonrası taban/çakışmalar ve nihai kaynak doğrulanır. Canlıya bu teslimde dokunulmaz. DB şeması v5 olarak korunur.
