# WhatsApp mesaj işleme: inceleme ve tasarım (kod değişikliği yok)

Kapsam: canlıdaki kod (`gh-pages`, v3.9.04). PR #121'deki v3.9.05 güvenlik değişiklikleri ayrıştırıcıya dokunmaz; aşağıdaki sorunlar orada da aynıdır.

Yeniden üretme: `node tools/analiz/wa_repro.mjs`. Örnekler sentetik test verisidir, **gerçek mesaj ölçümü değildir**.

## 1. Mevcut özellikler (kod kanıtlı)

| Yol | Giriş | Ayrıştırıcı | Doğrulama / kesin kayıt | Kaynak saklama |
|---|---|---|---|---|
| Akıllı Asistan (yapıştırılan metin, foto, ses) | `assistant.js` `screen` | **Gemini** (`geminiJson`) | `assistant-core.js` `validatePlan` (sayılar mesajda olmalı, şantiye / personel / tür kuralları), kart onayı, işlem kimliği (v3.9.05) | `internal_note = "Asistan: " + message.slice(0,300)` |
| WhatsApp toplu (TXT / ZIP) | `wa-bulk.js`, `wa-bulk-core.js` `parseChat` (tarih, saat, gönderen, metin, dosyalar, `key`) | gün gün parçalanıp **Gemini**'ye (Asistan) | Asistanla aynı; işlenen mesaj anahtarları `wa_bulk_done` | Mesaj zamanı / gönderen yalnız parça metninde; kayıtta ayrı alan yok |
| Gelen mesaj kutusu / Mesaj kontrolü | `solo-ui.js` `messageForm` → `inbox_messages` | **yerel** `message-engine.js` `analyzeMessage` (`sahapro-parse/4`) + `message-smart-core.js` `assistedRows` | Satır inceleme (`validateReviewRows`), revizyon denetimi, kaynak satır no değişmez, aktarılınca kilit (`messageLocked`) | Ham metin `inbox_messages`'ta; kayıtta `history_source.row_id = inbox-<id>-<satır>` |
| Şoför bildirimi (SP1) | `driver-core.js` `extractPayloads` | **LLM yok** (`payloadsToPlan`) | İmza / bağlantı denetimi (`security.js`), `driver_entry_id` kalıcı tekilleştirme (veritabanı) | Şoför kimliği, giriş kimliği, imzalı fiş içeriği |
| Geçmiş aktarımı | `history-core.js` | Yapılandırılmış JSON (`SAHAPRO_HISTORY_V1`), serbest metin **tahmin edilmez** | `prepareHistory` | `history_source` |
| Telefonda çalışan model | `ai-assist.js` | `analyzeMessage` + yerel model | `validatePlan` benzeri | — |

Zaten var olan ve yeniden yazılmaması gerekenler:
- **Niyet ayırma:** `intentOf` → `correction`, `add_to_existing`, `payment_notice`, `fuel`, `new_work`, `unknown`. Düzeltme ve ekleme mesajları **yeni iş satırı üretmiyor** (denendi: "3 değil 2", "çalışmadı", "dünkü işe … ekle" → 0 satır).
- **Dayanak türleri:** `exact_name`, `alias`, `ascii_fold` / `spelling_candidate` (otomatik doldurmaz), `context_candidate`, `role_candidate`, `plate`, `machine_code`.
- **Diğer:** birleştirme önerisi (`mergeSuggestions` / `mergeEligibility`), benzer kayıt (`similarRecords`), sohbet eleme (`isChatter`), yapıştırma tekrarı (`markPasteDuplicates`), SP1 kalıcı tekilleştirme.

**Ana yapısal bulgu:** Aynı mesaj iki ayrı ayrıştırıcıdan geçebiliyor: Gemini + `validatePlan` ya da yerel `message-engine`. Kesin kayıt kuralları ortak değil. Örneğin v3.9.04 / v3.9.05'teki şantiye, makine + saat, tek süre ve personel kuralları yalnız `validatePlan`'da var.

## 2. Yeniden üretilen ilk 5 sorun ve beklenen çıktı

| # | Sorun | Yol | Gerçek | Beklenen |
|---|---|---|---|---|
| 1 | **Ödeme tutarı birim fiyat olarak kabul ediliyor** (finansal) | Asistan | "34 KM 101 Kaya İnşaat 5 sefer hafriyat, 20.000 TL verdi" + Gemini `unit_price: 20000` → kabul, kart işaretli, iş tutarı 100.000 TL | Ödeme bağlamındaki (verdi, ödedi, havale, aldık, tahsil) sayı birim fiyat yapılmaz; kart işaretsiz gelir; ödeme ayrı tahsilat kartı olur. Ödeme sefer sayısına bölünmez (4000 zaten reddediliyor ✓) |
| 2 | **Çok işli mesajda sınır ve süre** | Yerel | "…1,5 sa / ağırtaş … 1 sa / mahir bey … kazma-kapatma, mıcır tesviyesi 2,5 sa" → **1 satır**, miktar yok, tür "Mıcır Nakliye" (başka işin kelimesinden) | 3 satır: 1,5 / 1 / 2,5 Saat. "sa" = saat. " / " yalnız iki yanında miktar varsa ayraç sayılır ("Hisar Polat / Kemerburgaz" bölünmez ✓). Malzeme kelimesi yalnız kendi satırında kalır ve tür belirlemez |
| 3 | **Müşteri bir sonraki satıra sızıyor** | Yerel | "jcb Şenol abi … 1,5 saat⏎kum taşıma 1 saat" → 2. satır müşteri = Şenol, dayanak **"exact_name"** | 2. satırda müşteri boş, "önceki satır bağlamı" dayanaklı aday (onay gerekir). Araç bağlamı önerilebilir; yeni araç yazılırsa taşınmaz (bu doğru çalışıyor ✓) |
| 4 | **Büyük harfte onaylı takma ad kaçıyor** | Yerel | "MAHIR BEY …" → müşteri boş (tr-TR küçük harfte I → ı), yalnız `ascii_fold` adayı | Onaylı takma ad büyük / küçük harf ve ASCII farkından bağımsız eşleşir → Hisar Polat; şantiye seçilmez |
| 5 | **Kaynak zinciri eksik** | Asistan / toplu | Kayıtta yalnız mesajın ilk 300 karakteri | Kayıtta içe aktarma kimliği (varsa), ham metin (ayrı ve değişmez saklı), gönderen, mesaj zamanı, iş tarihi ve dayanağı, satır / karakter aralığı, medya adı, ayrıştırıcı sürümü. Kaynakta olmayan WhatsApp mesaj kimliği **uydurulmaz** |

Ayrıca görülen ama ilk beşe girmeyenler:
- `payment_notice` "ödedi" / "verdi" kelimelerini tanımıyor ("ödeme", "ödendi" var).
- Aynı mesajda iş + ödeme olduğunda yerel yol ödemeyi ayırmıyor.
- Malzeme + saat olup makinesi önceki satırdan gelen işte tür boş kalıyor ve öneri sunulmuyor (yanlış kayıt üretmiyor).

## 3. En küçük ilk geliştirme paketi

İstenen öncelik: **"Çok işli mesajlarda doğru sınır + doğru süre + doğru müşteri bağlamı."**

1. **Süre birimleri** (`message-engine` `tokenize`): "sa", "sa.", "saat", "st" yalnız sayıdan hemen sonra gelince saat sayılır. "sa" tek başına geçiyorsa birim sayılmaz.
2. **Sınır:**
   - Satır sonu her zaman sınırdır.
   - " / " ile ";" yalnız **iki yanında miktar + birim varsa** sınırdır. Bir yanında yoksa bölünmez, kullanıcıya "bölünsün mü?" sorusu çıkar.
   - Nokta, virgül ve "ve" kendi başına sınır **değildir**: 1.5, 1,5, 12.10.2026, 34 KM 101, 2.500 TL korunur.
   - Bir segmentteki tek süre o segmentteki faaliyet listesine bağlıdır ve bölünmez.
3. **Bağlam:**
   - Müşteri sonraki satıra **otomatik taşınmaz**; `context_candidate` (önceki satır) olarak önerilir.
   - Araç ve tarih önerilebilir; yeni araç ya da tarih yazılınca eskisi taşınmaz.
   - Malzeme ve iş türü kelimeleri segment dışına çıkmaz.
4. **Takma ad eşleşmesi:** iki taraf da `foldTr` ile katlanır (büyük harf, ı / i, ç / c). Onaylı takma ad eşleşmesi bu katlamayla `alias` sayılır. Onaysız ad farkları `ascii_fold` adayı kalır.
5. **Paket 0 (finansal, çok küçük, ayrı):** `validatePlan`'da ödeme bağlamındaki sayı birim fiyat olarak kabul edilmez.

Bu turda bilerek **paket dışı** bırakılanlar:
- tek ortak doğrulama sözleşmesi (büyük iş; 2. aşama);
- kaynak zinciri alanları;
- fotoğraf–mesaj eşleştirme;
- toplu onay kuralları.

## 4. Test ve veri uyumluluğu planı

**Regresyon kümesi** (`tests/wa-parse.test.mjs`, sentetik):
- JCB örneği şu varyantlarla: gerçek Türkçe yazım, ASCII, BÜYÜK HARF, satır sonu, virgül, " / ", "sa", parantez.
- Olumsuz örnekler (bölünmemeli): "Hisar Polat / Kemerburgaz", tarih, plaka, "2.500 TL", "1.5", "1,5".
- Bağlam: araç önerisi, yeni araç, müşteri sızıntısı.

**Ölçüm** (sonraki aşama):
- Kaynak: kullanıcının **açıkça onayladığı** mesajlar (`ai_examples` + aktarılmış gelen kutusu mesajları).
- Ad, telefon ve plaka maskelenir.
- **Ayar kümesi** ile **bağımsız kabul kümesi** ayrı tutulur.
- Ayrı ölçülenler: iş satırı sayısı; müşteri / şantiye / araç / personel; miktar / birim / tarih; yanlış birleştirme; kaçırılan düzeltme; yanlış tekrar engeli; kayıt başına kullanıcı düzeltmesi.
- Genel doğruluk yüzdesi verilmez.

**Veri uyumluluğu:**
- `ENGINE_VERSION` → `sahapro-parse/5` olur ve satırlara yazılır.
- Mevcut `inbox_messages` taslakları yalnız kullanıcı "yeniden çözümle" derse (`reanalyzeMessage`) yeni ayrıştırıcıdan geçer.
- Aktarılmış ve kilitli kaynaklara dokunulmaz. Onaylı takma adlar değişmez. Kayıt göçü yok.
