# v3.9.04.2: sefer başı litre anlaşmasında "alınan mazot alacaktan düşmüyor"

- **Taban:** canlı `gh-pages` = `1eaebf1` (v3.9.04).
- **Dal:** `sahapro-mazot-b`.
- **İlgili dal:** PR #122 (v3.9.04.1, ödeme/fiyat). İkisi aynı dosyalara dokunmuyor; sürüm satırı (`core.js`, `m-dash.js`, `sw.js`) birleştirmede elle seçilir.
- **Kullanıcının modeli (2026-10-18 cevabı):** sefer başı litre anlaşması (Model B). Model A (TL borcuna karşılık mazot) bu PR'da **yapılmadı**.

## Kök neden
Model B hesabı tek başına doğru çalışıyor. `customerFuelLedger` 5 sefer × 75 L = 375 L hak, 200 L alındı, 175 L kalan veriyor. TL alacak 0. Şikâyet ancak şu durumlarda görülür (`node tools/analiz/mazot_repro.mjs`, B-1…B-3):

| Durum | Ne görünür | Neden |
|---|---|---|
| **B-1:** İşte kuralın kelimesi yok (kural "gravak" işleri için, iş "moloz" yazılmış), birim farklı ya da tarih aralık dışında | İş fiyat listesinden **TL** fiyatlandı → toplam alacakta 15.000 ₺. Alınan mazot litre hesabına "−200 L" olarak düşüyor, TL'ye dokunmuyor | `assistant-rules.js` `matchFuelRule` uymazsa `applyFuelPay` işi değiştirmez; fiyat listesi uygulanır |
| **B-2:** İş, kural müşteri kartına eklenmeden önce kaydedilmiş | Aynı: TL alacak, litre hakkı yok | Kural geriye dönük uygulanmaz. Müşteri kartındaki "kuralı uygula" düğmesi önizlemesiz ve toplu çalışıyordu |
| **B-3:** Mazot depoya müşteri seçilmeden girilmiş | Litre kalanı düşmüyor | Depo girişinde `customer_id` yok |
| Ek risk: Yakıt formunda "mazotu veren müşteri" ilk müşteriyle **ön seçili** geliyordu | Yanlış müşterinin hesabından düşebilir | `m-ops.js` varsayılan değer |
| Ek risk: Toplu "kuralı uygula", bugün kurala uymayan bir işin **var olan litre hakkını siliyordu** | Hak edilen litre sessizce azalabilir | `solo-ui.js`: eşleşme yoksa `customer_fuel_allowance_l: null` yazılıyordu |

Gerçek kayıtlara bakılmadı, bu yüzden hangisinin sizde olduğunu bilmiyorum. Yeni denetim ekranı bunu gösterir.

## Değişiklik
- **`js/fuel-audit.js` (yeni, saf, kayıt yazmaz).** Kurallı her müşteri için şunları listeler:
  1. Kurala uyan ama TL yazılmış işler (düzeltilebilir).
  2. Kurala uymayan TL işler ve **nedeni**: kelime / birim / tarih / kural sonradan.
  3. Kesinleşmiş hakedişteki TL işler.
  4. Hem litre hem TL yazılmış işler.
  5. Müşteri adı geçen ama müşteriye bağlanmamış yakıt / depo girişi.
  6. TL tutarlı "müşteri verdi" kayıtları.
- **#/mazot-hesaplari:** her müşterinin altında denetim özeti. **#/mazot-hesaplari/<müşteri>:** ayrıntı.
  - **1. grup:** yalnız **seçilen** işler düzeltilir. Önce önizleme: TL alacak eski → yeni, litre hakkı ve kalan eski → yeni. Sonra onay istenir.
  - Koşul, yazma ve audit tek transaction'da yapılır (`db.updateIf`). İş üzerinde kalıcı işlem kimliği `fuel_fix_op` tutulur.
  - İkinci kez işleme ya da iki sekmeden onay tek düzeltme üretir. Hakedişe girmiş ya da toplu fişe bağlı iş değişmez.
  - **5. grup:** yalnız petrolcüsüz ve tutarsız depo girişi "Bu müşteriye bağla" ile bağlanabilir (önizleme + onay). İstasyon alışı ve depodan araca çıkış müşteri ödemesi sayılmaz; yalnız listelenir.
  - **2, 3, 4, 6. gruplar:** yalnız listelenir. Kendiliğinden değişmez.
- **Müşteri kartı "kuralı geçmiş işlere uygula":**
  - Önce önizleme gösterir: kaç iş, TL eski → yeni, litre farkı. Onaysız yazmaz.
  - Var olan litre hakkını silmez. Kilitli işe dokunmaz.
- **Yakıt formu:** "Mazotu veren müşteri" artık boş gelir ve seçilmesi zorunludur.

## Testler
- **Birim:** `tests/fuel-audit.test.mjs` (8 grup):
  - litre hakkı 375/200/175;
  - kelime yok;
  - kural sonradan (düzeltme sonrası TL 0, kalan 175, ikinci denetimde listede yok);
  - birim / tarih nedeni;
  - hakedişte kilitli;
  - bağlanmamış depo / istasyon (başka müşteri karışmaz, sessiz atama yok);
  - depo giriş + çıkış tek alım, iki eşit gerçek teslim ikisi de;
  - karışık.
- **Ekran:** `tools/e2e/mazot.py`:
  - başlangıçta 21.000 ₺ / −200 L görüntüsü;
  - ekranı açmak hiçbir şey yazmaz;
  - nedenler ayrı ayrı görünür;
  - önizleme 21.000 → 6.000 ₺, kalan −200 → 175 L;
  - iki sekmeden onay tek düzeltme;
  - yeniden işleme yok;
  - depo girişi bağlama 175 → 75 L;
  - toplu uygulamada önizleme ve "Vazgeç" ile değişiklik yok;
  - yakıt formunda ön seçim yok.
  - Bu test, düzeltmeden önce üç koşudan ikisinde iki sekme yarışını yakaladı.

## Yapılmayanlar
- Model A ("mazotla TL tahsilatı", mutabakat fiyatı, cari mahsup, iptal ters kaydı). Kullanıcı Model B kullanıyor; gerekirse ayrı iş olarak yapılır.
- Kesinleşmiş hakedişteki TL işin düzeltilmesi (hakediş iptali / düzeltme kaydı) kendiliğinden yapılmaz.
- #/mazot-hesaplari'daki "toplam alacak ≈ … ₺", kalan litreyi maliyet fiyatıyla çevirir. Bu yalnız gösterimdir, cariye girmez; ekrandaki notta yazıyor.
