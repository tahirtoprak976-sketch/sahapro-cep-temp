# KDV ve cari için tutar sözleşmesi: karar notu

Durum: **karar bekliyor**. Hiçbir hesap değiştirilmedi. Eski kayıtlar otomatik dönüştürülmüyor. Bu sürüm yalnız karışık ya da belirsiz veriyi **Veri Sağlığı**'nda işaretliyor (`vat-mixed`, `vat-ambiguous`) ve raporluyor (`js/vat-contract.js` → `workMoney`, `vatContractReport`).

## Ayrı tutulması gereken alanlar

Bunlar birbirinden **türetilmez**:

| Alan | Bugün nerede | Not |
|---|---|---|
| Net tutar | türetiliyor (`workMoney.net`) | — |
| KDV oranı | `price_snapshot.kdv_rate` | Fiyatın kendi verisi. **%0 geçerli bir orandır.** |
| KDV tutarı | türetiliyor (`workMoney.kdv`) | — |
| Brüt tutar | türetiliyor (`workMoney.gross`) | — |
| Fiyatın temeli | `price_snapshot.kdv_included` (dahil / hariç) | — |
| Para birimi | alan yok | Her yerde TRY varsayılıyor (`workMoney.currency`) |
| Belge / faturalama durumu | `work_records.invoice_no` | **KDV oranını belirlemez** |

**İlkeler:**
- Faturası kesilmemiş iş **kendiliğinden %0 değildir**. Faturası henüz kesilmemiş KDV'li bir iştir; oranı fiyattan gelir.
- Müşteri kartında ileride bir varsayılan oran olursa, yalnız **yeni** fiyat önerisinde ön değer olur. İşin doğrulanmış verisini (snapshot'taki oran ve temel) **ezmez**.

## 1. Mevcut hesap davranışı (kodla doğrulandı)

Müşteri bakiyesi (`collect-core.js` → `customerOpenItems` / `customerBalances`):

> **Bakiye = Σ hakediş (`grand_total`, brüt) + Σ düzeltme + Σ hakedişe girmemiş iş (`price_snapshot.amount`) − Σ tahsilat (gerçek para)**

`price_snapshot.amount = birim fiyat × miktar`:
- Fiyat "KDV hariç" ise net,
- "KDV dahil" ise brüt.

**Sorun:** Aynı toplamda net ve brüt tutarlar karışıyor. Örnek (`tests/vat-contract.test.mjs`): 1000 TL KDV hariç iş + 1200 TL KDV dahil iş (%20).

| | Tutar |
|---|---|
| Bugünkü toplam | 2200 TL |
| Net | 2000 TL |
| Brüt | 2400 TL |

## 2. Önerilen tutarlı davranış (öneri, onaylanmış işletme kararı değil)

Cari **tek temelde** toplanır. Önerilen temel **brüttür**, çünkü:
- Hakediş cariye zaten brüt yazılıyor.
- Tahsilat gerçek para (faturalı işte KDV dahil).

Hakedişe girmemiş işin cariye etkisi `workMoney(w).gross` olur. Brüt, işin **kendi** oranı ve temeliyle hesaplanır; belge durumu ve müşteri varsayılanı bu hesaba girmez. KDV'siz çalışılan bir işin brütü ancak o işin fiyatı %0 oranla girildiyse net'e eşit olur. Bu da kullanıcının fiyatta verdiği bir karardır, belge durumundan çıkarılmaz.

**Örnek hesaplar** (tahsilat brüt 25.000 TL):

| Durum | Bugün | Brüt temelde |
|---|---|---|
| 10 iş × 3500 TL **hariç** %20 | 35.000 − 25.000 = **10.000** | 42.000 − 25.000 = **17.000** |
| 10 iş × 4200 TL **dahil** %20 | 42.000 − 25.000 = **17.000** | 42.000 − 25.000 = **17.000** (değişmez) |
| 10 iş × 3500 TL hariç **%0** | 35.000 − 25.000 = **10.000** | 35.000 − 25.000 = **10.000** (değişmez) |
| 5 hariç + 5 dahil (aynı fiyat 3500) | 17.500 + 17.500 = 35.000 → **10.000** | 21.000 + 17.500 = 38.500 → **13.500** |

Net temel de mümkündür, ama tahsilatın içindeki KDV payı bilinmediği için tahsilatla karşılaştırma tutarsız kalır.

## 3. Belirsiz eski kayıtların ele alınması

- **Belirsiz:** `price_snapshot.kdv_rate` boş ya da yok. Rapor %20 varsayar ve bunu `ambiguous` + `issues` olarak açıkça gösterir. Veri Sağlığı'nda `vat-ambiguous` çıkar.
- `kdv_included` alanı olmayan eski snapshot "hariç" sayılır (uygulama bugün de böyle sayıyor) ve ayrıca işaretlenir.
- **Kendiliğinden düzeltilmez.** Kullanıcı ilgili işte oranı ve temeli onaylar; onaylanan iş tek tek güncellenir.
- Hakedişe girmiş (kilitli) işlerin snapshot'ı değişmez; onların cari etkisi zaten hakedişin brüt toplamıdır.

## 4. Geçişin bakiye etkisi

- Yalnız **hakedişe girmemiş ve fiyatı KDV hariç olan** işlerin cari etkisi değişir: oranı kadar artar.
- KDV dahil ya da %0 olan işler, kesinleşmiş hakedişler, tahsilatlar ve düzeltmeler **değişmez**.
- Geçişten önce müşteri başına "bugünkü / net / brüt" karşılaştırması gösterilir (`vatContractReport`: `booked`, `net`, `gross`, `dahil` / `haric` sayıları, örnek işler). Kullanıcı onaylamadan cari değişmez.
- Hatırlatma mesajları ve tahsilat ekranı aynı temele geçer. İki ekranın farklı tutar göstermesi istenmez.

## Kullanıcıdan istenen karar

1. **Cari brüt temelde toplansın.** Eski belirsiz işler listede onaya sunulsun.
2. **Cari net temelde toplansın.** Tahsilat karşılaştırması tutarsız kalacağı için önerilmez.
3. **Şimdilik değişmesin.** Karışım yalnız Veri Sağlığı'nda uyarı olarak görünsün (bu sürümün durumu).
