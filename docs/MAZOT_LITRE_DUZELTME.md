# v3.9.04.2: mazot hesabı incelemesi ("alınan mazot alacaktan düşmüyor")

- **Taban:** canlı `gh-pages` = `1eaebf1` (v3.9.04).
- **Dal:** `sahapro-mazot-b` (PR #123).
- **Sözleşme modeli: AÇIK.**
  - Kullanıcı sefer başı litre anlaşması olduğunu belirtti.
  - "TL borcuna karşılık mazot" modelinin hiç kullanılmadığı **doğrulanmadı**.
  - Uygulama bu PR'da hiçbir müşteri için modeli varsaymaz.
- **Kılıç Hafriyat 300 L olayı:** kök neden **doğrulanmadı**. Gerçek kayıtlar incelenmedi. Aşağıdakiler test verisiyle yeniden üretilmiş **olası** nedenlerdir.

## Olası nedenler (`node tools/analiz/mazot_repro.mjs`)

| Durum | Görünen |
|---|---|
| İş, bugünkü kuralın kelimesine / birimine / tarihine uymuyor, ya da kural sonradan eklenmiş | İş TL fiyatlı görünür; alınan mazot yalnız litre hesabından düşer |
| Mazot kaydı müşteriye bağlanmamış ("müşteri verdi" ama müşteri alanı boş, ya da depoya müşterisiz giriş) | Litre kalanı düşmez |
| Yakıt formunda müşteri ön seçili geliyordu | Yanlış müşteriye bağlanabilir |
| Toplu "eski işlere uygula" ve iş düzenleme, eski litre hakkını bugünkü kuralla yeniden hesaplıyordu | Eski hak sessizce değişebilir |

## Değişiklik
- **İnceleme ekranı** (#/mazot-hesaplari ve #/mazot-hesaplari/<müşteri>):
  - Sonuçlar **"inceleme adayı"** olarak gösterilir, kesin hata olarak değil.
  - Açmak hiçbir kaydı değiştirmez; audit dahil, ekran testiyle doğrulandı.
- **Düzeltme yalnız seçilen işte yapılır.** Önce ayrı ayrı gösterilir:
  - gerçek kayıt (tarih, araç, miktar, malzeme, fiyat, mevcut litre hakkı);
  - mevcut kurala göre öneri (kural geçmişi tutulmuyor; tarih aralığının uyması, kuralın o tarihte bu içerikte olduğunu kanıtlamaz; geçmiş anlaşmayı kullanıcı doğrular);
  - tutar ayrımı: net, KDV, brüt ve carinin topladığı tutar, eski → yeni;
  - bugünkü kuraldan fark;
  - değişecek alanlar;
  - TL alacak eski → yeni;
  - litre hakkı eski → yeni, alınan (değişmez), kalan eski → yeni.
- **Onay koşulları:**
  - "Gerçek (geçmiş) anlaşmanın mevcut kuralla aynı olduğunu kendim doğruladım" işaretlenmeden uygulanmaz.
  - Litre hakkı zaten olan işe dokunulmaz (eski hak yeniden hesaplanmaz).
  - Hakedişteki ya da toplu fişe bağlı iş değişmez.
  - Koşul, yazma ve audit tek transaction'da (`db.updateIf`).
  - Kalıcı `fuel_fix_op` var; iki sekme ya da yeniden işleme tek sonuç verir.
- **Mevcut yakıt kaydını bağlama:** müşterisi boş "müşteri verdi" kaydı ya da petrolcüsüz, tutarsız depo girişi. Yalnız müşteri alanı doldurulur. Önizleme ve onay istenir. **Yeni yakıt, tahsilat ya da cari kaydı açılmaz.** İstasyon alışı ve depodan araca çıkış yalnız listelenir.
- **Müşteri kartındaki toplu "eski işlere uygula" kaldırıldı.** Yerine inceleme ekranına giden düğme var. TL işi, anlaşma doğrulanmadan "yalnız mazot"a çevrilmez.
- **İş düzenleme:** müşteri ve birim aynıysa kayıtlı litre hakkı korunur. Miktar değiştiyse kayıtlı litre/birim oranı kullanılır, bugünkü kural değil.
- **Yakıt formu:** "Mazotu veren müşteri" boş gelir ve seçilmesi zorunludur.
- **Kural genişletme önerilmez:** ekran, kuralı yalnız bakiyeyi düşürmek için değiştirmemeyi açıkça yazar.

## Testler
- **Birim:** `tests/fuel-audit.test.mjs` (11 grup). Yeni gruplar:
  - müşterisi boş 300 L kaydı bağlanabilir aday (yeni kayıt önerilmez);
  - önizleme içeriği yazmaz;
  - eski hak "FARKLI" diye gösterilir, düzeltilmez.
- **Ekran:** `tools/e2e/mazot.py` (16 kontrol, 3 koşu):
  - inceleme adayı etiketi;
  - açmak / önizlemek yazmaz;
  - anlaşma doğrulaması olmadan düğme kapalı;
  - iki sekmeden tek düzeltme;
  - tekrar uygulanmaz;
  - 300 L mevcut kayda bağlanır (ikinci yakıt / tahsilat / cari yok);
  - düzenlemede eski hak korunur;
  - toplu uygulama yok;
  - yakıt formunda ön seçim yok.

## Yapılmayanlar
- "TL borcuna karşılık mazot" (mutabakat fiyatı, cari mahsup): model doğrulanmadığı için yapılmadı ve varsayılmadı.
- Gerçek kayıtlar için kesin teşhis: kullanıcı inceleme ekranında kendi kayıtlarına bakmalı.
- Kural değişiklik geçmişi tutulmuyor. Ekran yalnız "mevcut kurala göre öneri" sunar; geçmiş anlaşmayı kanıtlamaz.
- Cari hesap yöntemi (hakedişe girmemiş işte fiyat nasıl girildiyse o tutar; KDV hariç girildiyse net) bu turda değiştirilmedi.
