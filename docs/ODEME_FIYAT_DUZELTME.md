# v3.9.04.1: ödeme / fiyat karışması düzeltmesi

## Taban ve dal
- **Canlı dal:** `gh-pages` = `1eaebf1` (PR #120 birleştirmesi, v3.9.04).
- **Bu düzeltmenin dalı:** `sahapro-v39041-odeme`, doğrudan canlı tabandan açıldı. PR #121'in (v3.9.05) birleşmemiş değişiklikleri bu dala **taşınmadı**.
- **Sürüm:** `v3.9.04.1`, önbellek adı `sahapro-solo-v3-20261018-odeme-1`. Canlıdaki v3.9.04 ve PR #121'deki v3.9.05 ile çakışmaz.

## Hatanın en küçük gerçek örneği

```
34 KM 101 Kaya İnşaat 5 sefer moloz yaptık, 20.000 TL ödeme geldi
```

| Yol | Önce (v3.9.04) |
|---|---|
| Asistan (model yanlışlıkla `unit_price: 20000` döndürürse) | Birim fiyat 20.000 kabul ediliyor, iş kartı işaretli, **iş tutarı 100.000 TL**. Tahsilat kartı da işaretli: "Kaydet" ile tahsilat yazılıyor |
| Yerel mesaj kontrolü | Mesajın tamamı "ödeme bildirimi" sayılıyor, **iş satırı kayboluyor** (0 satır) |

## Kök neden
- `js/assistant-core.js` → `validatePlan`: `unit_price` için tek denetim "sayı mesajda geçiyor mu" (`amountOk(w.unit_price, [moneyInText(message)])`). Sayının **ne olduğuna** bakılmıyordu: ödeme, toplam, söz ya da belirsiz tutar da birim fiyat sayılıyordu.
- `js/assistant-core.js` → `validateExtras` (tahsilat): aynı denetim. "Yarın verecek", "henüz vermedi", "fiyat verdi", "toplam" de tahsilat sayılabiliyordu ve kart işaretli geliyordu.
- `js/message-engine.js` → `intentOf`: "ödeme" kelimesi bulunan yan cümle grubu bütünüyle `payment_notice` oluyordu. Aynı grupta iş miktarı olsa da iş satırı çıkmıyordu.
- `js/assistant.js` → tahsilat kaydı: istek kimliği her basışta yeni (`uuid`) üretiliyordu. Aynı mesaj tekrar kaydedilince ikinci tahsilat yazılabiliyordu.

## Değişiklik
- **`js/money-roles.js` (yeni, saf):** mesajdaki her tutara bir rol verir.

| Rol | Örnek | Ne olur |
|---|---|---|
| `unit_price` | "sefer fiyatı 3.000", "3.000 TL/sefer", "seferi 3.000'den", yalın "sefer 1800" (önünde miktar yoksa) | Birim fiyat olabilir |
| `total` | "toplam", "tutar", "eder", "bedel" | Birim fiyat değil |
| `payment` | "ödedi", "ödeme geldi", "havale", "tahsil", "hesaba yatırdı", "para verdi", "nakit aldık", "parası … geldi" | Tahsilat olabilir |
| `payment_possible` | yalnız "… TL verdi" | Tahsilat olabilir, doğrulama istenir |
| `promise` | "verecek", "yarın", "haftaya" | Tahsilat değil |
| `negative` | "vermedi", "ödemedi", "henüz" | Tahsilat değil |
| `corrected_away` | "20.000 değil 10.000" içindeki 20.000 | Geçersiz |
| `price_quote` | "fiyat verdi", "teklif" | Ödeme değil |
| `unknown` | — | Hiçbir alana yazılmaz |

  Türkçe biçimler okunur: 20.000 · 20.000,50 · 20000 · 20 bin. Tarih, plaka ve miktar ("50 litre") para sayılmaz.

- **`validatePlan`:**
  - Birim fiyat yalnız `unit_price` rolündeki tutardan alınır.
  - Diğer roller fiyat alanını **boş** bırakır ve kartta tutarın anlamını yazar.
  - Fiyat listesinin tarihli kuralı **ayrı dayanakla** gösterilir: fiyat, kapsam, tarih, KDV dahil / hariç ve oran. Kayıtta bu kural uygulanır.
  - Miktara bölme yapılmaz.
- **`validateExtras` (tahsilat):**
  - Yalnız `payment` / `payment_possible` rolündeki tutar tahsilat olabilir.
  - Kart **her zaman işaretsiz** gelir: finansal onay kullanıcıdadır.
  - Veri geçerliliği ayrıca `okData` alanında tutulur.
- **`message-engine`:**
  - `intentOf` artık "ödedi", "yatırdı", "para verdi", "nakit verdi" kelimelerini de ödeme sayar.
  - Yan cümle grubunda iş miktarı (sefer / saat / ton …) varsa grup iş olarak işlenir; ödeme ayrı bildirim kalır ve fiyat olmaz.
- **`db.saveCashEvent` + `assistant.js`:**
  - Tahsilatın istek kimliği mesajdan türetilir (mesaj + satır + tarih).
  - Aynı kimlik aynı transaction içinde bulunursa ikinci kasa / cari hareketi yazılmaz.
  - Havale tahsilatında aynı anahtar işletme defterine gider.

## Önce / sonra motor çıktıları
`node` ile, aynı test verisiyle (önce = `1eaebf1`):

| Mesaj | Önce | Sonra |
|---|---|---|
| "…5 sefer moloz yaptık, 20.000 TL ödeme geldi" | yerel: 0 iş satırı · asistan: fiyat 20000, iş kartı işaretli, **iş tutarı 100.000 TL** · tahsilat kartı İŞARETLİ | yerel: 1 iş, fiyat boş · asistan: fiyat boş, iş kartı işaretli · tahsilat kartı işaretsiz |
| "…5 sefer hafriyat, 20.000 TL verdi" | asistan: fiyat 20000, iş tutarı 100.000 TL · tahsilat İŞARETLİ | fiyat boş · tahsilat işaretsiz + "verdi ödeme olmayabilir" |
| "…5 sefer moloz toplam 20.000 TL" | asistan: fiyat 20000, iş tutarı 100.000 TL · tahsilat İŞARETLİ | fiyat boş · tahsilat sayılmadı |
| "Kaya İnşaat yarın 20.000 TL verecek" | tahsilat İŞARETLİ | tahsilat sayılmadı (ödeme sözü) |

## Testler
- `tests/odeme-fiyat.test.mjs`: 12 grup, iki yol, yanlış AI çıktıları dahil.
  - İş + ödeme; yalnız ödeme; açık fiyat + ödeme; AI'ın ters koyduğu fiyat ve ödeme.
  - Toplam iş bedeli (20.000 ve 20.000 / 5 = 4.000 ikisi de reddedilir).
  - Ödeme sözü; olumsuzluk ("vermedi", "ödemedi"); düzeltme ("20.000 değil 10.000").
  - "Fiyat verdi"; "50 litre mazot verdi"; Türkçe tutar biçimleri.
  - Farklı müşterilerin işleri ve ödemesi; iş satırı olmayan devam ödemesi.
  - Tarihli fiyat kuralı + farklı ödeme; eski "sefer 1800" davranışının korunması.
- `tools/e2e/odeme.py` (gerçek ekran, model bilerek yanlış çıktı veriyor):
  - Taslak hiçbir finansal kayıt yazmıyor.
  - Kartta fiyat boş; tutarın anlamı ve fiyat listesi dayanağı görünüyor.
  - İş fiyat listesinden kaydediliyor (3.200 × 5).
  - Onay verilmeyen tahsilat yazılmıyor; aynı mesaj iki kez onaylansa da tek tahsilat.
  - Hakedişe girmiş eski iş değişmiyor.
- **Bilerek değişen beklentiler:**
  - `tests/assistant.test.mjs`: tahsilat kartı artık işaretsiz; veri geçerliliği `okData`'da.
  - `tools/e2e/sim.py`: patron tahsilatı işaretleyerek onaylıyor.

## PR #121 ile birleştirme planı
1. Önce bu küçük PR telefonda denenip `gh-pages`'e birleştirilir.
2. PR #121'in dalına (`sahapro-v3905-kapilar`) `gh-pages` birleştirilir. Deneme birleştirmesinde 5 dosyada çakışma çıktı; çözümleri:
   - `js/core.js`, `js/m-dash.js`: sürüm v3.9.05 kalır.
   - `sw.js`: yeni önbellek adı; `ASSETS` listesine hem `vat-contract.js` hem `money-roles.js` girer.
   - `js/assistant.js` (tahsilat): PR #121'in işlem kimliği yolu (`opGate`, havale anahtarı) kalır; bu PR'ın `reqId` satırları kaldırılır. Rol denetimi `assistant-core.js`'te olduğu için çakışmadan gelir.
   - `js/db.js` `saveCashEvent`: PR #121'in işlem kimliği yolu + bu PR'ın `request_id` ön denetimi aynı transaction'da birleştirilir.
3. Birleşmiş hâlde bütün testler yeniden koşulur.
