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
| 2 | İş sözleşmesi (sefer / m³). Kapsam içi / ekstra ayrımı, çift fiyatlamaya karşı koruma (ekskavatör saati sefer veya m³ fiyatına dahilse ayrıca fiyatlanmaz). Sefer kaydında malzeme ve kantar tonu; şoför ekranında ton alanı. | v3.9.14 (bu PR) |
| 3 | Metraj: ara ödemeler avans olarak; iş sonu ölçümü; hakediş = m³ × fiyat + ekstralar − avanslar; ekskavatör saati (saat sayacı) ile verim (m³/saat) ve maliyet; katsayıyı onayla öğrenme (kantarlı seferlerin ortalaması kantarsızlara uygulanır). | v3.9.14 (bu PR) |

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

## Paket 2–3 ayrıntısı
- Anlaşma şantiye kartında durur (`sites.deal`): yeni veritabanı deposu yoktur, sürüm geri dönüşü bozulmaz.
  - Alanlar: `basis` (m³ / Sefer), `price`, `kdv_rate`, `kdv_included`, `start_date`, `material`, `status` (Açık → Ölçüldü → Kapandı), `measurement`.
- İşin hangi anlaşmaya bağlanacağı (`job-core.js` → `jobFor`):
  - Şantiye seçiliyse o şantiyenin anlaşması.
  - Şantiye seçili değilse müşterinin TEK açık işi; iş o şantiyeye kaydedilir ve bu kayıttan önce gösterilir.
  - Müşterinin birden çok açık işi varsa hiçbir şey uygulanmaz ve şantiye seçilmesi istenir.
- Fiyat (`applyJob`):
  - m³ anlaşmasında tüm kapsam içi işler `Sözleşmeye dahil` (0 ₺).
  - Sefer anlaşmasında sefer işleri sözleşme fiyatıyla; makine saati dahil (0 ₺).
  - "Ekstra" seçilirse ya da fiyat elle yazıldıysa fiyat listesi uygulanır.
  - Mazot karşılığı, iç iş ve kilitli işlere dokunulmaz.
- Uygulandığı yerler:
  - elle iş formu (`[data-jobbox]`, kayıttan önce dahil/ekstra seçimi)
  - asistan iş kartı (önizleme + "Sözleşme dışı ekstra iş" kutusu)
  - asistan döküm fişi
  - toplu satırlar
- Fiyatsız iş uyarıları `Sözleşmeye dahil` işleri saymaz: ana ekran, cari "fiyatsız" grupları, müşteri ve detaylı raporlar.
- Tahmin (`jobReport`), güven sırasıyla:
  1. Kantar fişli sefer (ton ÷ yerinde yoğunluk)
  2. Aynı işte aynı aracın kantar ortalaması
  3. Önceki işlerden onayla öğrenilmiş sefer başı m³ (meta `haul_calib`)
  4. Yük / kasa tahmini (paket 1)

  Ekstra seferler metraja girmez.
- Ölçüm (`db.saveJobMeasurement`):
  - Şantiye ve cari tek işlemde yazılır; ölçüm zaten varsa ya da iş açık değilse hiçbir şey yazılmaz.
  - Cari hareketi: `type: Hakedis`, `source: metraj`, `ref_id`: şantiye; tutar brüttür (net + KDV).
  - Ölçüm sonradan değiştirilemez, şantiye silinemez; yanlışsa caride düzeltme açılır.
  - Veri Sağlığı `metraj-cari` / `metraj-cari-amount` ile denetler.
- Ara ödemeler: carideki normal tahsilatlardır. İş ekranı müşterinin başlangıçtan beri ödemelerini (tüm işleri) gösterir.
- Kapatma: makine saati olup hiç ekstra yoksa "ekstra iş var mıydı?" diye bir kez sorulur.
- Mevcut işler (`#/is-sozlesmesi/<id>/bagla`):
  - yalnız seçilenler bağlanır, tutar farkıyla onay alınır, `updateIf` ile yazılır, geçmişe kaydedilir
  - hakedişli ya da kilitli iş listede yer almaz
- Testler: `tests/job.test.mjs` (12 grup), `tools/e2e/metraj.py`.

## v3.9.15 — Götürü sözleşme ve sözleşmeden kurulum
- **Anlaşma türü Götürü:** toplam bedel. Peyzaj, yıkım, bina kenarı kazısı, mıcır dolgu gibi işler; teklifin içeriğine göre.
- **Yeni alanlar:** `scope_in` (dahil), `scope_out` (hariç), `extra_rates` [{label, unit, price}], `scrap` (fiyattan / ayrica / musteri), `payment_plan`, `deadline`, `doc_id`, `read_quotes`.
- **Cari (işletme sahibinin seçimi A):** sözleşme bedeli imzada tamamıyla müşteri borcu olarak yazılır, ara ödemeler bundan düşer.
  - `db.saveJobCharge` şantiye ve cariyi tek işlemde yazar (`type: Hakedis`, `source: goturu`, tutar brüt). İkinci kez yazılmaz.
  - Bedel yazıldıktan sonra tür, bedel ve KDV değişmez, şantiye silinmez. Kapsam, ekstra fiyatları ve notlar düzenlenebilir.
- **Kapsam içi işler:** tamamı dahil (0 ₺), yalnız maliyet için tutulur.
- **Ekstra işler:** önce sözleşmedeki ekstra fiyatı uygulanır. Birim aynı olmalı, ad iş türünde geçiyorsa o seçilir; birden çok aday varsa sessiz seçim yapılmaz. Sözleşmede fiyat yoksa fiyat listesi uygulanır.
- **Hurda satışı:** `scrap: ayrica` ise işin geliri olarak tutulur. Kasaya ya da cariye yazılmaz.
- **İş özeti:** sözleşme geliri (net), ekstralar, hurda, döküm ücretleri, sefer ve makine saati. Mazot ve işçilik dahil değil.
- **Sözleşmeden oluştur** (`#/is-sozlesmeleri/oku`):
  1. PDF ya da fotoğraf Gemini'ye gider (`contract-read.js`: istem, şema, doğrulama).
  2. Belgede olmayan alan null kalır ve "kontrol edin" listesine düşer.
  3. Müşteri tek aday varsa eşleşir; yoksa yeni müşteri önerilir.
  4. Onaylayınca müşteri / şantiye açılır, belge "Sözleşme" olarak eklenir.
  5. Anlaşma formu belgedeki alıntılarla dolu açılır; anlaşma ancak **Kaydet** ile yazılır.
- **Testler:** `tests/contract-read.test.mjs` (5), `tests/job.test.mjs` (15), `tools/e2e/sozlesme.py`.

## Henüz yok
- Aşama aşama hakediş (işletme sahibi götürüde bedelin tamamını imzada yazmayı seçti).
- Gerçek sözleşme PDF'leriyle denenmedi (yalnız taklit Gemini).
- m³ başına mazot / operatör maliyeti: yakıt kaydı işe bağlanmadığı için hesaplanmıyor; yalnız makine saati ve m³/saat gösteriliyor.
- Ara ödemeyi belirli bir işe bağlama: ödemeler müşteri carisindedir.
- Gerçek telefonda test edilmedi.
