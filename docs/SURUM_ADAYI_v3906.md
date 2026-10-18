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
Tam takım `f9113b9` üzerinde koşuldu. Teslim düzeltmesinde yalnız `js/fuel-audit.js` ve `js/fuel-pay.js` değişti (metin ve net / KDV / brüt gösterimi). Bunlardan sonra birim testleri, `mazot.py`, `telefon.py`, `birlesik.py` ve `denetim.py` yeniden koşuldu.

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
| `telefon.py` | yeni, telefon adımı 3–5 provası (müşteri ekranı tutarı, net / KDV / brüt, iş kaydının korunması dahil) | 12/12 |

- **`birlesik.py` neyi doğruluyor:**
  - #122 anahtarı #121 işlem kaydına yazılıyor;
  - yeniden gönderimde yalnız #122 sorusu çıkıyor, ikinci kimlik oluşmuyor;
  - #121 "geri al" tahsilatı ve cariyi geri alıyor; aynı mesaj sonra yeniden yazılabiliyor;
  - #123 düzeltmesi, açık iş formundan gelen eski kayıtla ezilmiyor (STALE);
  - bütünlük denetimi yeni alanlarla çalışıyor.
- **Denenmeyenler:** gerçek telefon, gerçek Gemini, gerçek kayıtlar.

## Kılıç örneğinde tutarlar (5 sefer × 3.000 ₺, KDV %20 hariç)
- **Net 15.000 ₺, KDV 3.000 ₺, brüt 18.000 ₺.**
- **Müşteri ekranı ve toplam alacak 15.000 ₺ gösterir.** Hakedişe girmemiş işte cari, fiyat nasıl girildiyse o tutarı toplar; KDV hariç girildiyse net. 18.000 ₺ (brüt) yalnız hakediş kesinleşince cari harekete girer.
- **Bu turda değişmedi:** cari hesap yöntemi değiştirilmedi. KDV karar notu: `docs/KDV_CARI_KARAR_NOTU.md`.
- **Düzeltme önizlemesi** her iş için eski → yeni ayrı gösterir: net, KDV (oranıyla), brüt, carinin topladığı tutar, litre hakkı / alınan / kalan.

## Bilinen sınırlar (çözülmüş sayılmaz)
- **Eşit öncelikli iki fiyat kuralı:** yalnız asistan kaydı sorar. **Elle iş formu ve hakediş ekranı hâlâ sessizce birini seçer.** Telefon testinde bu yüzden müşteri başına **tek ve açık** fiyat kuralı kullanılır.
- **Kural geçmişi tutulmuyor:** inceleme ekranı "mevcut kurala göre öneri" verir. Geçmiş anlaşmayı kullanıcı doğrular; tarih aralığının uyması kanıt değildir.
- **Çözülen inceleme adayı** adaylar listesinden çıkar; **iş kaydı silinmez, korunur.**

## Telefon kabulü (5 adım, yalnız uydurma örnek veri)
Önizleme: "ÖNİZLEME" şeridi görünmeli; Ayarlar → Sürüm **SAHAPRO SOLO v3.9.06** olmalı. Gerçek yedek, gerçek şoför bağlantısı ve gerçek kayıt kullanılmaz. Gemini için yalnız test amaçlı bir anahtar kullanılır.

1. **Ödeme fiyat olmuyor.**
   - Hazırlık: müşteri "Kaya Test" ve "Leda Test" açın. Fiyat listesine **yalnız bir** kural ekleyin: Kaya Test, Sefer, 3.200 ₺, KDV hariç %20.
   - Asistana yazın: `<plaka> Kaya Test 5 sefer moloz, Leda Test 20000 ödeme geldi`.
   - Beklenen: iş kartında birim fiyat boş; altında "Fiyat listesinden … Birim 3.200 … Tutar 5 × 3.200 = 16.000" yazar. Tahsilat kartı **işaretsiz** ve Leda Test adına gelir.
   - İş ve tahsilatı işaretleyip kaydedin.
2. **Aynı ödeme tekrar yazılmıyor.**
   - Aynı mesajı tekrar gönderin, tahsilatı işaretleyip kaydedin.
   - Beklenen: "Tekrar mı, yeni ödeme mi?" sorusu çıkar. "Tekrar — yazma" deyin.
   - Kasa'da Leda Test için tek 20.000 ₺ kalmalı.
3. **Müşteriden alınan yakıt doğru litre hesabına bağlanıyor.**
   - Hazırlık:
     - Müşteri "Kılıç Test" açın (henüz kural yok).
     - İşler → + İş: Kılıç Test, malzeme "gravak", 5 sefer, elle fiyat 3.000 ₺, KDV %20.
     - Müşteri ekranında TL alacak **15.000 ₺** (net) görünmeli, 18.000 değil.
     - Sonra müşteri kartında "Mazotla ödeme kuralları": 75 L / Sefer, kelime "gravak", yalnız mazot.
   - Yakıt → + Yakıt Kaydı → Kaynak "Müşteri Verdi". Beklenen: müşteri alanı **boş** gelir. Kılıç Test'i seçip 300 L kaydedin.
   - Mazotla Ödeme Hesapları'nda Kılıç Test: alınan 300 L.
4. **İnceleme salt okunur.**
   - Kılıç Test altındaki "İnceleme adayı"na dokunun. Açıp kapatmak hiçbir rakamı değiştirmemeli.
   - İşi seçin. Önizlemede şunlar görünmeli:
     - "Mevcut kurala göre öneri" ve "geçmiş anlaşmayı siz doğrulayın" notu;
     - bu iş için net 15.000 → 0, KDV %20 3.000 → 0, brüt 18.000 → 0, carinin topladığı 15.000 → 0;
     - litre hakkı 0 → 375, alınan 300 (değişmez), kalan −300 → 75.
   - "Onayla ve uygula" düğmesi, doğrulama kutusu işaretlenmeden kapalı kalmalı.
5. **Onaylı düzeltme tekrar uygulanmıyor.**
   - Kutuyu işaretleyin → Onayla ve uygula → Uygula.
   - Beklenen: müşteri TL alacağı 15.000 düşer; litre 375 / 300 / 75 olur.
   - Sayfayı yenileyin: iş **inceleme adayları listesinden çıkar**. İş kaydı İşler'de **durur**; açtığınızda "Mazot karşılığı" yazar.
