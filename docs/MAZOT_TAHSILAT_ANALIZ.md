# Mazotla tahsilat alacaktan düşmüyor: kök neden, mevcut model, yeniden üretim

- **Taban:** canlı `gh-pages` = `1eaebf1` (v3.9.04).
- **Dal:** `sahapro-mazot-analiz`. Bu dalda yalnız inceleme notu ve yeniden üretim betiği var; uygulama kodu değişmedi.
- **Veri:** Gerçek kayıt kullanılmadı.
- **Yeniden üretim:** `node tools/analiz/mazot_repro.mjs`. Uygulamanın kendi hesap fonksiyonlarını test verisiyle çağırır ve hiçbir şey yazmaz.

## 1. Uygulamada bugün olan sözleşme modeli

Uygulamada yalnız **Model B (litre hakkı)** var. **Model A (TL borcuna karşılık mazot) hiç yok.**

| Parça | Dosya / fonksiyon | Ne yapıyor |
|---|---|---|
| Müşterinin mazot kuralı | `js/assistant-rules.js` → `fuelRulesOf`, `matchFuelRule` | Müşteri kartındaki `fuel_rules`: `{per: 75, unit: "Sefer", match, only_pay, from, to}`. Eski kartlarda `fuel_per_trip` |
| İşe uygulanması | `applyFuelPay` | İşe `customer_fuel_allowance_l = sefer × L` yazılır. `only_pay` ise işin TL tutarı **0** olur ("Mazot karşılığı") |
| Müşteriden alınan yakıt | `fuel_records` (`fuel_source: "Müşteri Verdi"`, `customer_id`) ya da `fuel_tank_movements` (`GİRİŞ`, `customer_id`) | **Yalnız litre** tutulur |
| Litre hesabı | `customerFuelLedger`, `fuelLedgers`, ekran `js/fuel-pay.js` (#/mazot-hesaplari) | Hak edilen − alınan = kalan litre |
| TL alacak | `js/collect-core.js` → `customerLedgerMovements`, `customerOpenItems`, `receivables`, `customerBalances` | Yalnız `cari_movements` (hakediş, tahsilat, düzeltme) + fiyatlı ama hakedişe girmemiş işler. **Yakıt kayıtlarını hiç okumaz** |
| Ekstre / raporlar | `js/statement.js` `customerStatement`, `js/customer-report.js`, `js/report-core.js` (tahsilat = `type: "Tahsilat"`) | Hepsi aynı cari kaynağı okur |

## 2. Kök neden

**Yakıt kaydı oluşuyor, ama TL karşılığı ve cari bağlantısı hiç oluşmuyor.** Bu bir "toplam ekranı okumuyor" hatası değil. Sorun, okunacak bir hareketin hiç yazılmaması.

1. Üç giriş yolu da müşteri verdiğinde TL değerini **zorla siler**, cari hareket de açmaz:
   - **Asistan:** `js/assistant.js`, kayıt fonksiyonunun yakıt dalı: `total: byCustomer ? null : total`, `unit_price: null`.
   - **Yakıt formu:** `js/m-ops.js`: `...(byCust ? { customer_id, total: null, unit_price: null, receipt: "Müşteri" } : {})`.
   - **Şoför paketi:** aynı yakıt kaydı alanlarıyla gelir; `customer_id` dışında TL bağı yoktur.
2. Bu silme Model B için bilinçli bir tasarım: müşterinin verdiği mazot masraf ya da gelir sayılmasın diye. Kâr hesabında da hariç tutulur (`finance-chart.js`, `report-core.js`).
3. Model A'ya karşılık gelen hiçbir şey yok:
   - TL karşılığı olan bir kayıt türü yok ("mazotla tahsilat" / ayni ödeme).
   - Mutabık kalınan TL/litre alanı yok.
   - Hangi borca mahsup edildiği bilgisi yok.
   - `cari_movements`'a yazan bir yol yok.
4. Sonuç: TL borcu olan ve kuralı olmayan bir müşteri 200 L verince:
   - TL alacak **değişmez**.
   - Litre hesabında "−200 L" (hak edilmemiş alım) oluşur.
   - Bu müşteri `fuelLedgers` listesine de girmez (yalnız kuralı ya da hakkı olanlar girer). Yakıt **hiçbir ekranda TL olarak görünmez**.
5. Kafa karıştırabilecek ikinci nokta (#/mazot-hesaplari):
   - Ekran kalan litreyi **maliyet fiyatıyla** (depo alış ortalaması ya da `fuel_ref_price`) TL'ye çevirip "toplam alacak ≈ … ₺" yazıyor.
   - Bu tutar müşteri carisinde ya da toplam alacakta yok, yalnız gösterim.
   - Maliyet fiyatı ile mutabakat fiyatının aynı sayılması tam da kaçınılması istenen durum.

## 3. Yeniden üretim (`node tools/analiz/mazot_repro.mjs`)

| Durum | Toplam alacak | Ekstre | Litre hesabı | Değerlendirme |
|---|---|---|---|---|
| **A:** 10 sefer × 3.000 = 30.000 ₺ borç; 200 L mazot verdi (beklenen kalan 21.000 ₺) | **30.000 ₺** | 30.000 | 0 hak / 200 alındı / **−200 L** | **HATA** (bildirilen sorun) |
| **B:** 75 L/sefer, yalnız mazot; 5 sefer; 200 L alındı | 0 ₺ | 0 | 375 / 200 / **175 L** | Doğru |
| **Para + mazot:** 5 × 3.000 ₺ + 75 L/sefer; 200 L alındı | 15.000 ₺ | 15.000 | 375 / 200 / 175 L | Doğru (iki hak ayrı) |
| **Depo:** müşteriden depoya 200 L, sonra depodan araca 200 L | 0 ₺ | 0 | 375 / 200 / 175 L | Doğru: depodan çıkış ikinci ödeme sayılmıyor |

## 4. Kullanıcıya soru (cevap gelmeden bakiye değiştirilmez)

Bildirimdeki müşteri hangi modelde?
- **A:** Müşterinin TL borcu var (işler fiyatlı). Verdiği mazot, anlaştığınız litre fiyatıyla borcundan düşülecek. Örnek: 200 L × 45 ₺ = 9.000 ₺.
- **B:** İşin karşılığı litre olarak anlaşılmış (Kılıç gibi, sefer başı 75 L). TL borcu yok.
- **Karma:** İşin bir kısmı TL, bir kısmı litre.

Bu müşteride mazot kuralı tanımlı mı, ve verdiği mazot için bir litre fiyatında anlaştınız mı? Cevap düzeltmenin hangi yola gideceğini belirler. Uygulama verisini benim görmem mümkün değil (gerçek kayıt kullanılmıyor). Kontrol için:
- müşterinin kartındaki "Mazotla ödeme kuralları";
- #/mazot-hesaplari ekranında müşterinin görünüp görünmediği.

## 5. Düzeltme planı (ayrı dal / PR; PR #122'den bağımsız, ondan sonra birleşir)

1. **Yeni işlem: "Mazotla tahsilat (ayni ödeme)", Model A.**
   - Alanlar: müşteri, tarih, litre, mutabık TL/litre **ya da** toplam mahsup tutarı, hangi borç/iş, teslim yeri (depo / araç), belge, açıklama.
   - Fiyat kendiliğinden doldurulmaz. Pompa fiyatı ve depo ortalaması yalnız "bilgi" olarak gösterilir.
   - Fiyat bilinmiyorsa kayıt **TL mahsupsuz** kalır ve "değer bekliyor" olarak listelenir.
2. **Tek olay, tek bağ, atomik yazım.** Tek IndexedDB transaction'ında:
   - yakıt kaydı (yeni ya da **mevcut kayda bağlama**);
   - `cari_movements` (`type: "Mazot Mahsubu"`, eksi tutar, `fuel_record_id` / `tank_movement_id`);
   - audit kaydı.
   - Kasa (`cash_records`) **yazılmaz**, çünkü nakit değil.
   - Kalıcı işlem kimliği: aynı teslim → tek mahsup. Aynı kimlik farklı içerikle gelirse → çakışma.
3. **Ekranlar.** Bunlar aynı cari hareketi okur:
   - toplam alacak, ekstre, müşteri raporu;
   - tahsilat raporu ("Mazotla tahsilat" ayrı sütun; nakit tahsilattan ayrı);
   - #/mazot-hesaplari (Model A'da litre hakkı oluşmaz; "TL karşılığı mahsup edildi" yazar).
4. **Depo / araç.**
   - Depoya teslim: depo GİRİŞ hareketi + mahsup. Sonraki araca çıkış ödeme sayılmaz.
   - Araca teslim: yakıt kaydı + mahsup. Depoya girmiş gösterilmez.
   - İstasyon alışı müşteri ödemesi seçilemez.
5. **Fazla ödeme, iptal ve eski kayıtlar.**
   - Fazla ödeme: borç sıfırın altına sessizce kırpılmaz. Fazla tutar "avans / alacaklı" olarak gösterilir, kullanıcı karar verir.
   - İptal: ters cari kaydı. Yakıt sonradan tüketilmiş ya da hakedişe girmişse uyarı verilir.
   - Eski kayıtlar: "Müşteri Verdi" yakıtlar için yalnız **önizlemeli liste** sunulur, toplu ya da sessiz düzeltme yapılmaz. Liste üç gruba ayrılır:
     - müşterisi belli ama TL değeri yok;
     - bağlantılı;
     - elle düzeltme ile zaten mahsup edilmiş olabilir (aynı müşteri, yakın tarih, eksi "Düzeltme").
     Kullanıcı tek tek değer girip onaylar; her onay kalıcı işlem kimliğiyle yazılır.
6. **Testler:** görevdeki kabul listesinin tamamı.
   - TL+mahsup, yalnız litre, para+mazot, depo, araç;
   - fiyatsız, yanlış müşteri, tekrar, eşit iki teslim, iki sekme;
   - bağlama, kısmi / fazla / iptal, eski kayıt önizlemesi.
   - Ekstre, toplam alacak, tahsilat raporu ve yakıt ekranının aynı sonucu verdiği ayrıca doğrulanacak.
