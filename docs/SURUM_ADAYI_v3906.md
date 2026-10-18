# Sürüm adayı v3.9.06 (#121 + #122 + #123)

**Canlıya birleştirme değildir.** Bu dal yalnız birleşik davranışı test etmek ve tek önizleme paketi çıkarmak içindir.

- **Taban:** canlı `gh-pages` = `1eaebf1` (v3.9.04).
- **Dal:** `sahapro-aday-v3906`.
- **Birleştirilenler, sırasıyla:**
  1. PR #121 `sahapro-v3905-kapilar` @ `35225c1`.
  2. PR #122 `sahapro-v39041-odeme` @ `fcca76f`.
  3. PR #123 `sahapro-mazot-b` @ `bea263e`.
- **Sürüm:** `SAHAPRO SOLO v3.9.06`, önbellek `sahapro-solo-v3-20261018-aday-1`.

## Çakışmalar ve çözümleri
"Yalnız sürüm satırı çakışır" varsayımı doğru çıkmadı. Mantık çakışmaları:

| Dosya | Çakışma | Çözüm |
|---|---|---|
| `js/db.js` `saveCashEvent` | #121: kalıcı işlem kimliği (op) + audit. #122: kaynak anahtarı (request_id) + içerik çakışması | İkisi **aynı transaction'da**: önce request_id (aynı içerik → mevcut kayıt, farklı içerik → OP_CONFLICT), sonra op, sonra yazma (+ op kaydı + audit) |
| `js/assistant.js` tahsilat | #121: `opGate` ("ayrı kayıt" = `Date.now()`), havale anahtarı mesaj + satırdan. #122: kaynak anahtarı, "tekrar mı yeni mi", deterministik `…:yeni:<n>` | #122 yolu kalır. Nakitte #121 işlem kaydına **aynı anahtar** verilir: `{ op: { id: anahtar, hash: içerik } }`. Havalede `customerBankReceipt` anahtarı da aynıdır. #121 sayaçları (`already`, `conflict`) korunur |
| `sw.js` | İki tarafın önbellek adı ve yeni dosyaları | Yeni ad. `ASSETS` içinde `vat-contract`, `money-roles`, `collection-key`, `price-decision`, `fuel-audit` |
| `js/core.js`, `js/m-dash.js` | Sürüm | v3.9.06 |
| #123, `js/db.js` `updateIf` ↔ #121 `saveExisting` iyimser kilit | Metin çakışması yok, davranış etkileşimi var | `updateIf` `updated_at`'i günceller. Açık formdan gelen eski kayıt #121 tarafından STALE olarak reddedilir; ekran testiyle doğrulandı |

## Testler
Uygulama kodu `f9113b9`'ten sonra değişmedi; sonraki commit'ler yalnız test ve belge.

- **Birim:** 66 / 66 dosya.
- **Ekran (yerel sunucu, test verisi, taklit Gemini):**

| Test | Kaynak | Sonuç |
|---|---|---|
| `denetim.py` | #121 | 56/56 |
| `kismi.py` | #121 | 13/13 |
| `yedek_matris.py` | #121 | 12/12 |
| `onizleme.py` | #121 | 9/9 |
| `eski_preview.py` | #121 | 9/9 |
| `geri_donus.py` | #121 | 10/10 + 4 bilinen geri dönüş bedeli uyarısı. İlk koşuda sürüm "v3.9.05" sabit yazıldığı için 1 hata verdi; test, dalın sürümünü dosyadan okuyacak şekilde düzeltildi |
| `odeme.py` | #122 | 9/9 |
| `kabul122.py` | #122 | 22/22 |
| `mazot.py` | #123 | 15/15 |
| `sim.py` | ortak, tohum 7 ve 42 | 72/72, 72/72 |
| `birlesik.py` | yeni, PR'lar arası | 8/8 |
| `telefon.py` | yeni, telefon adımı 3–5 provası | 10/10 |

- **`birlesik.py` neyi doğruluyor:**
  - #122 anahtarı #121 işlem kaydına yazılıyor;
  - yeniden gönderimde yalnız #122 sorusu çıkıyor, ikinci kimlik oluşmuyor;
  - #121 "geri al" tahsilatı ve cariyi geri alıyor; aynı mesaj sonra yeniden yazılabiliyor;
  - #123 düzeltmesi, açık iş formundan gelen eski kayıtla ezilmiyor (STALE);
  - bütünlük denetimi yeni alanlarla çalışıyor.
- **Denenmeyenler:** gerçek telefon, gerçek Gemini, gerçek kayıtlar.

## Telefon kabulü (en fazla 5 adım, yalnız örnek veri)
Önizleme paketi ayrı bir adreste açılır. "ÖNİZLEME" şeridi görünmeli; Ayarlar → Sürüm: **v3.9.06**.

1. **Ödeme fiyat olmuyor.**
   - Hazırlık: müşteri "Kaya Test" ve "Leda Test" açın; Kaya Test için 3.200 ₺/sefer kural ekleyin.
   - Asistana yazın: `<plaka> Kaya Test 5 sefer moloz, Leda Test 20000 ödeme geldi`.
   - Beklenen: iş kartında birim fiyat boş; altında "Fiyat listesinden … 3.200 … 16.000" yazar. Tahsilat kartı işaretsiz ve Leda Test adına gelir.
   - İş ve tahsilatı işaretleyip kaydedin.
2. **Aynı ödeme tekrar yazılmıyor.**
   - Aynı mesajı tekrar gönderin, tahsilatı işaretleyip kaydedin.
   - Beklenen: "Tekrar mı, yeni ödeme mi?" sorusu çıkar. "Tekrar — yazma" deyin.
   - Kasa → Leda Test'te tek 20.000 ₺ kalmalı.
3. **Müşteriden alınan yakıt doğru litre hesabına bağlanıyor.**
   - Hazırlık:
     - Müşteri "Kılıç Test" açın (henüz kural yok).
     - İş formundan bir iş girin: Kılıç Test, malzeme "gravak", 5 sefer, elle fiyat 3.000 ₺, KDV %20.
     - Sonra müşteri kartında "Mazotla ödeme kuralları" → 75 L / Sefer, kelime "gravak", yalnız mazot.
   - Yakıt → + Yakıt Kaydı → Kaynak "Müşteri Verdi". Beklenen: müşteri alanı **boş** gelir. Kılıç Test'i seçip 300 L kaydedin.
   - Mazotla Ödeme Hesapları'nda Kılıç Test: 300 L alındı görünmeli.
4. **İnceleme salt okunur çalışıyor.**
   - Kılıç Test satırının altındaki "İnceleme adayı"na dokunun. Beklenen: kural sonradan eklendiği için 3. adımdaki iş "TL fiyatla yazılmış" diye aday olarak görünür, kesin hata diye değil.
   - Ekranı açıp kapatmak hiçbir şeyi değiştirmemeli: müşterinin TL alacağı ve litre rakamları aynı kalmalı.
   - İşi seçin. Önizlemede şunlar görünmeli: kayıt, o tarihteki anlaşma, bugünkü kuraldan fark, TL ve litre eski/yeni, değişecek alanlar.
   - "Onayla ve uygula" düğmesi, "anlaşmayı doğruladım" işaretlenmeden kapalı kalmalı.
5. **Onaylı düzeltme tekrar uygulanmıyor.**
   - "Anlaşmayı doğruladım"ı işaretleyin → Onayla ve uygula → Uygula.
   - Beklenen: TL alacak 15.000 düşer; litre hakkı +375.
   - Ekranı yenileyin: iş artık listede değil, ikinci kez uygulanamaz.

Gerçek kayıtlar, yedekler, şoför bağlantıları ve gerçek Gemini anahtarı önizlemeye konmaz. Gemini gerektiren adım (1–2) için ayrı, test amaçlı bir anahtar kullanın ya da bu adımları canlı geçişten sonra gerçek telefonda ayrıca deneyin.
