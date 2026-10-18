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

## 4. Paketler ve teslim durumu

Her paket ayrı commit ve ayrı PR. Sonraki paket öncekileri de içerir (sürüm v3.9.08 → v3.9.13).

| Paket | Commit | Yapılan | Sınır (yapılmayan) |
|---|---|---|---|
| **1. Görünüm** (v3.9.08) | `e6f25f0`, `0ead4f9` | **Ekranlar:** ilk ekranda asistan alanı ve 6 hızlı seçenek; alt menüde ASİSTAN (yüzen düğme kaldırıldı); tarih gruplu iş listesi; müşteri panosu (#125).<br>**"Bulunamadı" düzeltmesi:** Gemini boş dönerse yerel okumanın gördüğü satırlar eksikleriyle gösterilir; formlar dolu açılır, araç ve kaynak seçtirilir. WhatsApp metni "düzeltme" sayılmaz | — |
| **2. İşlem** (v3.9.09) | `96ae8ca` | **Yerel komut** (internetsiz, Gemini'siz): kart / ekstre / mazot hesabı / tahsilat / fiyat listesi / araç kartı / yedek / gün sonu / listeler (bugün, dün, geçen hafta, fiyatsız, fişsiz).<br>**Düzeltilecek işi bulma:** adaylar tarih · araç · müşteri · iş · miktar ile listelenir, rastgele seçilmez, değişiklik formda yapılır.<br>**Bağlam:** müşteri 30 dk tutulur, görünür ve temizlenebilir; yeni müşteri adı gelince eskisi taşınmaz.<br>**"Bu kayda fiş fotoğrafı ekle":** son açılan işi açar; aynı fotoğraf ikinci kez eklenmez | Asistan kaydı **kendisi değiştirmez**: düzeltme formda yapılır. Komutla PDF / ekstre **üretilmez**; ekran açılır, paylaşım oradaki düğmeyle yapılır |
| **3. Anlama** (v3.9.10) | `fab8373` | **Mesaj okuma:** "sa" = saat (sayıdan sonra); Türkçe ekli müşteri adları ("Kaya'ya", "Leda'dan", "inşaata"); tek kartta geçen ilk kelime.<br>**Kaynak etiketi:** iş kartında alanın nereden geldiği yazar (mesajdan / takma addan / geçmiş işlerden tahmin / fiyat listesinden / şoför ekranından) | Takma ad öğrenme mevcut onaylı hafıza ekranıyla. Yeni "takma ad düzelt" ekranı **yok** |
| **4. Yönetim** (v3.9.11) | `bbb19ed` | **Ana ekran:** dikkat isteyen işler, her birinde neden ve sonraki adım (fiyatsız, müşterisiz, bekleyen mesaj, yarım yedek, mazot inceleme adayı); son 14 gün iş grafiği (dokununca o günün işleri); araçlar bu ay (saat / sefer / yevmiye / ton ayrı); mazot anlaşmaları (litre).<br>**Kayıt temelli cevaplar:** mazot kalanı, bugün araçlar, alacak listesi. Rakamı uygulama hesaplar.<br>Gemini anahtarı yokken de yerel komutlar çalışır | Dönemlere göre iş tutarı / tahsilat ve müşterilere göre açık alacak grafiği ana ekrana **eklenmedi**: yönetici ve tahsilat ekranlarında mevcut olanlar kullanılır. "Bu rakam hangi kayıtlardan geliyor?" sorusu yalnız mazot cevabında kaynakla verilir |
| **5. Şoför / personel** (v3.9.12) | `f0ed047` | **Taslak:** yarım form ve fotoğraf (kapanma, WhatsApp'a geçiş, internet kesintisi).<br>**Fotoğraf:** ilerleme, sınırlar (10 adet / 25 MB), hata, kaldırma; yön korunur, sırayla küçültülür.<br>**Güvenlik:** çift basmada tek kayıt.<br>**Dürüst durumlar:** "telefonda kaydedildi", "paylaşım ekranı açıldı", "patronun aldığı doğrulanamaz". Paylaşılan fotoğraflar 7 gün tekrar paylaşılabilir.<br>**Patron tarafı:** anahtarsız da imzalı kodu içe alır; aynı bildirim ikinci kez kayıt olmaz | Gerçek WhatsApp'ta metin ve fotoğrafın ayrı gelmesi durumunda "eksik fotoğrafı sonradan doğru kayda ekleme" yalnız mevcut uyarı ve fotoğraf ekleme alanıyla yapılır; otomatik eşleştirme **yok**. Gerçek telefonda ve gerçek WhatsApp'ta **denenmedi** |
| **6. Ses** (v3.9.13) | `df32a94` | **Ses kaydı:** ilk kayıtta dış servise (Gemini) aktarım açıkça yazılır ve onay alınır.<br>**Sesli okuma:** cevaplar yalnız "🔊 Sesli oku"ya dokununca okunur.<br>**Duyulan komut:** yerel komuta uyarsa öneri olarak gelir, dokunmadan açılmaz | Cihazda (çevrimdışı) konuşma tanıma **yok**; ses kaydı Gemini'ye gider |

**Asistana bağlı gerçek işlemler (bugün):**
- Gemini ile: iş, yakıt, depo girişi, gider/fatura, tahsilat, bakım, puantaj, döküm fişi, belge, kart ekle / düzelt / sil, fiyat kuralı, ayarlar.
- Yerel (Gemini'siz): ekran açma, listeleme, düzeltilecek işi bulma, mazot kalanı ve araç özeti cevapları.
- Hepsi kontrol kartı ya da form üzerinden; finansal kayıtlar onaysız yazılmaz.

**Henüz desteklenmeyenler:**
- Komutla kaydı doğrudan düzeltme (form açılır).
- Hakediş kesinleştirme / iptal.
- Geri yükleme (yalnız ekran açılır).
- Komutla PDF üretip paylaşma.
- Müşterilere göre rapor üretme (Gemini soru-cevabıyla).
- Takma ad düzeltme ekranı.

**Her pakette korunacaklar:**
- ödeme–fiyat ayrımı, işlem kimliği ve mükerrer koruması;
- imzalı şoför paketi kapıları;
- kesinleşmiş hakediş ve kayıt kilitleri;
- Gemini günlük sınırı (ekran açılışında yapay zekâ çağrısı yapılmaz);
- gerçek kayıtlarda otomatik düzeltme yapılmaz;
- canlıya kendiliğinden geçilmez.
