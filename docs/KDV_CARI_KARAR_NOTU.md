# KDV ve cari için tutar sözleşmesi: karar notu (v3.9.04)

Durum: **karar bekliyor**. Bu sürüm hesapları değiştirmez. Yalnız karışık ya da belirsiz veriyi **Veri Sağlığı**'nda işaretler (`vat-mixed`, `vat-ambiguous`) ve raporlar (`js/vat-contract.js`).

## 1. Bugün tutarlar nasıl tutuluyor (kodla doğrulandı)

| Kalem | Nerede | Tutarın temeli |
|---|---|---|
| İş (fiyatlı, hakedişe girmemiş) | `work_records.price_snapshot.amount` | **Fiyat neyse o.** `kdv_included: false` ise net, `true` ise brüt. |
| Kesinleşmiş hakediş | `cari_movements` tür `Hakedis` = `hakedis.grand_total` | **Brüt** (KDV dahil, `calcHakedisLine`) |
| Tahsilat | `cash_records.amount` → `cari_movements` tür `Tahsilat` (eksi) | **Gerçek para** (fatura kesilmişse çoğunlukla brüt) |
| Düzeltme | `cari_movements` tür `Duzeltme` | Kullanıcının yazdığı |
| Fatura durumu | `work_records.invoice_no` (eLogo eşleştirme) | KDV hesabından **ayrı** bir bilgi |
| Para birimi | alan yok | Her yerde TRY varsayılıyor |

Müşteri bakiyesinin hesabı (`collect-core.js` → `customerOpenItems` / `customerBalances`) şöyle:

> **Bakiye = Σ hakediş (brüt) + Σ düzeltme + Σ faturasız iş (`amount`: net YA DA brüt) − Σ tahsilat (gerçek para)**

**Doğrulanmış sorun:** Aynı toplamda bazı işler net, bazıları brüt toplanıyor. Kural "fiyat KDV hariç" ise iş net, aynı müşterinin hakedişi ve tahsilatı brüt. Bu yüzden faturalı müşteri, hakediş kesilene kadar **fazla ödemiş gibi** görünebiliyor. Hatırlatma mesajları da düşük tutar gösterebiliyor.

Örnek (`tests/vat-contract.test.mjs`): 1000 TL KDV hariç iş + 1200 TL KDV dahil iş (%20).

| | Tutar |
|---|---|
| Bugünkü toplam | 2200 TL (karışık) |
| Net | 2000 TL |
| Brüt | 2400 TL |

## 2. Önerilen sözleşme

Her iş tutarı açık temeliyle türetilir. Kayıtlar değişmez; `workMoney(w)` hesaplar:

- `net`, `kdv`, `gross`, `rate`, `basis` (dahil / hariç), `currency: "TRY"`
- `invoiced` (belge durumu; KDV hesabından ayrı)
- `ambiguous` + `issues` (oran ya da temel kayıtlı değilse)

**Cari tek temelde tutulur: brüt (müşterinin ödeyeceği para).**

- Hakediş zaten brüt. Tahsilat gerçek para. Faturasız iş de brüt eklenince üçü aynı temelde karşılaştırılır.
- Faturasız / KDV'siz çalışılan müşteride oran **%0** olur, brüt = net. (v3.9.04'te %0 artık korunuyor.)
- "Faturalandı mı" ayrı bir durumdur. KDV oranı fiyatla birlikte gelir; belge durumundan **türetilmez**.

## 3. Geçiş etkisi (eski kayıtlar otomatik dönüştürülmez)

- Fiyat kuralından gelen snapshot'larda `kdv_rate` ve `kdv_included` her zaman yazılı (`business.priceSnapshot`). Bu işler kesin hesaplanır.
- Oranı kayıtlı olmayan eski işler `vat-ambiguous` olarak işaretlenir. Kullanıcı onaylamadan değiştirilmez.
- Örnek etki (tek müşteri, 10 iş × 3500 TL KDV hariç, %20):

| | Tutar |
|---|---|
| Bugünkü bakiye | 35.000 TL |
| Önerilen bakiye | 42.000 TL |

  25.000 TL tahsilat alınmışsa kalan 10.000 TL yerine 17.000 TL görünür.
- Kesinleşmiş hakediş ve tahsilat tutarları değişmez. Yalnız hakedişe girmemiş işlerin cariye eklenen tutarı değişir.

## 4. Kullanıcıdan istenen karar (az sayıda, açık seçenek)

1. **Cari brüt olsun (önerilen).** Müşteri başına varsayılan KDV oranı: faturalı %20, faturasız %0. Eski oranı belirsiz işler listede gösterilir ve tek tek onaylanır.
2. **Cari net olsun.** Hakediş ve tahsilat net'e çevrilerek karşılaştırılır. Tahsilatın KDV payı bilinmediği için **önerilmez**.
3. **Şimdilik değişmesin.** Hesap aynı kalır, karışım yalnız Veri Sağlığı'nda uyarı olarak görünür (bu sürümün durumu).

Karar verilene kadar 3. seçenek geçerlidir.
