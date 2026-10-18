# Metraj ve iş sözleşmesi planı

Kaynak: "Kamyon kabarma payı ve metraj" araştırması (Ekim 2026) ve işletme sahibiyle görüşme.

## İşletmenin anlaşma tipleri
- **Sefer başı:** kamyon seferi × sefer fiyatı. Ekskavatörle yükleme fiyata dahildir.
- **Metreküp (yerinde):** ortak ölçümcü kazıdan önce ve sonra ölçer, iş sonunda m³ çıkar. Kazı, yükleme, nakliye ve döküm fiyata dahildir. Para iş sürerken (ara ödeme) alınır.
- **Ekstra iş:** anlaşma dışı işler ayrıca fiyatlanır: makine saat/yevmiye, kamyon sefer.
- **Yıkım anlaşmaları:** henüz tanımlanmadı (işletme sahibinden bilgi bekleniyor).

## Güven sırası
1. Ölçümcü metrajı: kesindir, hakediş ve cari buna göre yapılır.
2. Kantar fişi (net ton): güçlü tahmindir (ton ÷ yerinde yoğunluk). Belediye döküm sahalarında fiş alınır.
3. Kasa hacmi / ortalama yük: kaba tahmindir. Toprakçı ve dolgu sahalarında fiş alınmaz.

Tahminler hiçbir zaman cariye girmez.

## Paketler
| Paket | İçerik | Durum |
|---|---|---|
| 1 | Filo: dingil, dara, yasal toplam ağırlık, kasa m³ → araç kartında sefer başı yerinde m³ tahmini. Malzeme katsayıları ekranı. Döküm sahasında kantar var/yok. | v3.9.14 (bu PR) |
| 2 | İş sözleşmesi (sefer / m³). Kapsam içi / ekstra ayrımı, çift fiyatlamaya karşı koruma (ekskavatör saati sefer veya m³ fiyatına dahilse ayrıca fiyatlanmaz). Sefer kaydında malzeme ve kantar tonu; şoför ekranında ton alanı. | bekliyor |
| 3 | Metraj: ara ödemeler avans olarak; iş sonu ölçümü; hakediş = m³ × fiyat + ekstralar − avanslar; ekskavatör saati (saat sayacı) ile verim (m³/saat) ve maliyet; katsayıyı onayla öğrenme (kantarlı seferlerin ortalaması kantarsızlara uygulanır). | bekliyor |

## Paket 1 ayrıntısı
- `js/haul-core.js` yalnız hesap yapar, kayıt yazmaz:
  - Yasal toplam ağırlık: 4 dingil 32 t, 5 dingil 42 t; araç kartına elle girilen değer önceliklidir.
  - Yük sırası: kartta yazan ortalama yük (`load_ton`) → yasal net yük (alt tahmin) → varsayılan (kamyon 22 / tır 27, döküm ücreti varsayımıyla aynı).
  - Kasa hacmi silme/tepeleme ayrımı yapılmadan alınır.
  - Kantar tonu verilirse gerçek yük sayılır: kasa ile sınırlanmaz. Yasal sınır aşımı ve kasa uyumsuzluğu yalnız işaret olarak gösterilir.
- Varsayılan yoğunluklar (gevşek / yerinde t/m³):
  - toprak 1,55 / 1,95
  - kil 1,66 / 2,02
  - kum-çakıl 1,72 / 1,93
  - bitkisel 0,95 / 1,37
  - kaya 1,70 / 2,63 (doğrulanmamış)
  - moloz 1,3 / — (veri yok; yerinde m³ verilmez)
- Kullanıcı düzeltmeleri meta `haul_materials` içinde tutulur ve yedekle taşınır.
- Döküm sahası `has_scale`: `var` / `yok` / boş. Boşsa ton başı ücretli saha kantarlı sayılır (tahmin).
- Test: `tests/haul.test.mjs` (12 grup) ve `tools/e2e/filo.py` (360 px; iş/yakıt/kasa/cari kayıtlarının değişmediği doğrulanır).

## Bilinen sınırlar
- Gerçek araç darası ve kasa ölçüsü kullanıcı girişidir; uygulama doğrulamaz.
- Kaya değerleri doğrulanmamıştır; kilde kabarma kaynaklara göre %22–43 arasında değişir.
- Gerçek telefonda test edilmedi.
