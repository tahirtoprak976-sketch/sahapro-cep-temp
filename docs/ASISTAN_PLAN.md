# SAHAPRO SOLO — Akıllı asistan, görünüm ve şoför akışı: mevcut durum ve plan

- **Taban:** canlı `e80a45a` (v3.9.06).
- **Kapsam:** yalnız SOLO; YZ2'ye dokunulmaz.
- **Bu belge** mevcut kodun incelenmesinden çıkarıldı. "Var" denen her şey kodda bulunuyor; gerçek telefonda tek tek denenmiş değildir.

## 1. Mevcut durum

| Hedef | Durum | Not |
|---|---|---|
| Asistan ekranı (mesaj, fotoğraf, ses → kontrol kartları → onay → kayıt) | **Var** | `assistant.js`. Gemini gerekir (internet, anahtar, günlük sınır). Kartlar işaretlenmeden kayıt yazılmaz |
| İlk ekranda belirgin asistan | **Yok → Paket 1'de yapıldı** | Önceden küçük yüzen 🎤/🤖 düğmeleri vardı ve kayıtları örtüyordu |
| Ekran açma ("X'in ekstresini aç") | **Var, iyileştirilecek** | `assistant-actions.js` `SCREENS` (≈35 ekran). Gemini üzerinden. Çevrimdışı ya da anahtarsız çalışmaz |
| Kart oluşturma / düzeltme / silme (müşteri, şantiye, araç, personel, esnaf, ocak, döküm yeri, fiyat, belge) | **Var** | Silme her zaman işaretsiz gelir |
| İş, yakıt, depo girişi, gider/fatura, tahsilat, bakım/arıza, puantaj/avans, döküm fişi, belge | **Var** | Doğrulama (`validatePlan`/`validateExtras`), işlem kimliği, ödeme–fiyat ayrımı, mükerrer kontrolü |
| Mevcut kaydı düzeltme | **Kısmen** | İşte miktar, birim, müşteri, şantiye, araç, iş türü, tarih; giderde tutar, kategori; yakıtta litre, tutar; kasada tutar, tarih. Aday listeli seçim yok: model ID seçer, kart gösterir |
| Fiyat kuralı ("sefer 3.500, pazartesiden itibaren") | **Var, iyileştirilecek** | `price-rule-core.js`. `valid_from` var, ama asistan yolu tarihi `null` bırakıyor |
| Kayda fiş fotoğrafı ekleme (mevcut kayda) | **Yok** | Yalnız yeni kayıtla birlikte eklenir |
| Rapor / ekstre hazırlama komutla | **Kısmen** | Ekranı açar. PDF ve paylaşım ekrandaki düğmeyle yapılır |
| Kayıtlara dayalı soru-cevap | **Var, iyileştirilecek** | `businessFacts` + `checkAnswer` / `answerMetricIssues` modelin rakamını denetler. Dönem ve net/brüt ayrımı her cevapta yok |
| Konuşma bağlamı ("kartını aç" → "ekstresini hazırla") | **Kısmen** | "Önceki sonucu düzelt" var. Müşteri bağlamı taşıma kuralı yok |
| Geri alma | **Var** | Son asistan kaydı 24 saat geri alınabilir (`undo.js`) |
| Ses | **Var** | Ses kaydı Gemini'ye gider (dış servis). Sabah özeti kullanıcı isteğiyle cihazda sesli okunur |
| Tarih gruplu iş listesi | **Yok → Paket 1'de yapıldı** | |
| Müşteri panosunda para / mazot ayrımı | **Yapıldı** (PR #125) | |
| Yönetim panosu ve grafikler | **Kısmen** | Ana sayfa "Bugün" kutuları, sabah brifingi, yönetici ekranı, müşteri panosu. Dokununca filtreli liste açan grafik yok |
| Dikkat isteyen işler | **Kısmen** | "Bugün Dikkat" ve uyarılar var. Mazot incelemesi, eksik yedek ve mesaj kontrolü tek bölümde değil |
| Şoför ekranı: iş, yakıt, gider, bakım/arıza, fotoğraf | **Var** | `driver.js`. İmzalı paket (SP1), WhatsApp ile elle paylaşım |
| Şoför: form taslağı / kesinti dayanıklılığı | **Kısmen** | Kaydedilen giriş gönderilene kadar saklanır ("Gönderilmemiş"). Yarım form ve hazırlanmış fotoğraf taslak olarak tutulmaz. "Gönderildi" işareti yalnız paylaşım ekranının açıldığını gösterir |

## 2. İşlem envanteri (asistan)

| İşlem | Bugün | Yol | Onay |
|---|---|---|---|
| Ekran aç / müşteri kartı / ekstre / mazot hesabı / yedek ekranı | Var (Gemini) | `open` | Yok (salt görüntüleme) |
| Kayıt arama ve listeleme ("bugünkü işler", "eksik fiyatlı işler") | Kısmen | Ekran açma + filtre parametresi | — |
| İş / yakıt / gider / tahsilat / bakım / puantaj oluşturma | Var | Kartlar | Kart işareti; tahsilat her zaman işaretsiz gelir |
| İş düzeltme (süre, miktar, müşteri…) | Kısmen | `edits` | Kart. Aday listeli seçim **yok** |
| Fiyat kuralı ekleme / güncelleme | Var | `prices` | Kart; geçmiş işlere uygulama ayrı seçim |
| Kart ekle / düzelt / sil | Var | `actions` | Kart; silme işaretsiz |
| Ayarlar (kural, ödeme sözü, IBAN, mazot kuralı) | Var | `settings` | Kart |
| Mevcut kayda fotoğraf ekleme | **Yok** | — | — |
| Rapor / PDF / mazot ekstresi hazırlama | Ekranı açar | `open` | PDF ve paylaşım kullanıcı düğmesiyle |
| Yedek alma / geri yükleme | Ekranı açar | `open` | Geri yükleme yalnız ekrandan, onaylı |
| Hakediş kesinleştirme / iptal | **Yok** (ekrandan) | — | — |

**Desteklenmeyen komutta** asistan bunu açıkça söylemeli ve uygun ekranı önermeli. Bugün çoğu durumda modelin `answer` metnine bırakılmış; Paket 2'de yerel komut yönlendiricisiyle sabitlenecek.

## 3. Ekran taslağı (telefon)

```
┌──────────────────────────────┐
│ SAHAPRO · çevrimiçi · tarih  │
├──────────────────────────────┤
│ Ne yapmak istiyorsunuz?      │  ← ilk ekranda, büyük
│ [ yazın…                   ] │
│ [   🤖 Asistana gönder     ] │
│ [Mesaj yapıştır][Sesle][Fiş] │
│ [İş ekle][Tahsilat][Rapor]   │
├──────────────────────────────┤
│ Sabah brifingi · Dikkat      │
│ Bugün: iş / sefer / saat …   │
└──────────────────────────────┘
 Ana · İşler · ASİSTAN · Fişler · Finans · Daha   ← alt menü (yüzen düğme yok)

İşler
 16 EKİM 2026 · CUMA           25 iş
 ┌ Kaya İnşaat                 3 Sefer ┐
 └ Moloz Nakliye · araç — personel     ┘
 15 EKİM 2026 · PERŞEMBE       10 iş
 …
 [ Daha eski tarihler (n iş kaldı) ]
```

## 4. Paketler

| Paket | İçerik | Durum |
|---|---|---|
| **1. Görünüm** | İlk ekranda asistan; alt menüde Asistan (yüzen düğme kaldırıldı); tarih gruplu iş listesi; müşteri panosu (#125) | **Bu PR** |
| **2. İşlem yetenekleri** | Yerel komut yönlendiricisi: ekran açma, arama ve filtreleme internetsiz ve Gemini'siz. İş / yakıt / tahsilat oluşturma mevcut kartlarla. Düzeltmede **aday listesi** (tarih, araç, iş, miktar). Mevcut kayda fotoğraf ekleme. Desteklenmeyen komutta açık cevap + ekran önerisi | Sırada |
| **3. Anlama** | Çok işli mesaj sınırları, "sa" kısaltması, Türkçe ekler ve takma ad. Bağlam: müşteri değişince eski bağlamın taşınmaması. Alan kaynağı etiketleri (mesaj / fiyat listesi / takma ad / kullanıcı) | Sırada |
| **4. Yönetim** | Gerçek hesaplardan grafikler; dokununca filtreli liste. Kayıt temelli cevaplar (dönem, net/brüt, kayıt bağlantısı). "Dikkat isteyen işler" tek bölümde (fiyatsız iş, mesaj kontrolü, müşteri bağlantısı, yarım yedek, mazot inceleme adayı) | Sırada |
| **5. Şoför / personel deneyimi** | Basit formlar; yarım form ve fotoğraf taslağı (IndexedDB); fotoğraf ilerleme / hata / tekrar dene; aynı işlem kimliğiyle tekrar paylaşım; durumların dürüst adları ("paylaşım ekranı açıldı" ≠ "teslim edildi"); patron tarafında eksik ek eşleştirmesi; kabul senaryoları 1–10 | Sırada |
| **6. Ses ve kapsam genişletme** | Sesli komut aynı onay kurallarıyla; isteğe bağlı kısa sesli özet; kalan işlemlerin asistana bağlanması | Sırada |

**Her pakette korunacaklar:**
- ödeme–fiyat ayrımı, işlem kimliği ve mükerrer koruması;
- imzalı şoför paketi kapıları;
- kesinleşmiş hakediş ve kayıt kilitleri;
- Gemini günlük sınırı (ekran açılışında yapay zekâ çağrısı yapılmaz);
- gerçek kayıtlarda otomatik düzeltme yapılmaz;
- canlıya kendiliğinden geçilmez.
