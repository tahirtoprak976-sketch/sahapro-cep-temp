# Uçtan uca testler (her sürümden önce)

Depo kökünde `python3 -m http.server 8841`, sonra:

- `python3 tools/e2e/sim.py [tohum]` — **İşletme simülasyonu**: 3 şoför telefonu (gerçek şoför ekranı: iş, mazot, gider, arıza, fotoğraf, "Patrona gönder") + patron telefonu (kilit, imzalı bağlantılar, asistanla işleme, aynı mesajı tekrar yapıştırma, izin formları onay/red, maaş kapatma, geri alma, mazot faturası) + **2. tur para/belge**: fiyat kuralları, tahsilat (kasa↔cari tek kayıt), hakediş kesinleştirme, eLogo UBL faturası eşleştirme, döküm hesabı, WhatsApp toplu, aynı mesajı iki sekmede aynı anda kaydetme. Sonunda: Veri Sağlığı 0 hata, sayılar tutarlı, şifreli yedek → yeni telefona birebir geri yükleme. `SONUÇ: BAŞARILI` beklenir.
- `python3 tools/e2e/t105.py` — Bozuk veri üretip Veri Sağlığı "güvenli düzeltmeler"ini dener.

Gemini çağrıları sahte (page.route); şoför kodları Gemini'siz işlenir. Playwright + Chromium + Pillow gerekir.

- `node tests/syntax.test.mjs` — tüm js dosyalarının **gerçek** ES modülü sözdizimi denetimi (düz `node --check` bu projede bozuk modülü de geçiyor; güvenmeyin).
- `python3 tools/e2e/denetim.py` — **v3.9.04 denetimi** (test verisi, taklit Gemini): yarım kalan kayıtta tekrar Kaydet çift yazmaz; KDV %0 korunur, boş KDV sessizce dolmaz; asistan fiyat kuralı güncellemesi KDV hariç; Gemini onay metni gönderilenleri anlatır; internetsiz yerel kayıt; imzasız / tanınmayan / iptal edilmiş şoför kodu işaretsiz; imzalı dijital fiş imzadan sonra değişirse PDF imzalanan hâli basar ve uyarı çıkar; şifresiz yedekte şoför anahtarı yok. `SONUÇ: BAŞARILI` beklenir.
- `node tests/jcb-regression.test.mjs` — gerçek mesaj regresyonu (JCB / Şenol / Ağırtaş / Mahir Bey) yazım varyantlarıyla; şantiye kendiliğinden seçilmez, makine+saat nakliye sayılmaz, tek süre bölünmez, uydurma personel yazılmaz.
- `python3 tools/preview/build.py <klasör>` — **önizleme** derlemesi (örnek verili işlevsel test alanı): veritabanı, önbellek, localStorage/sessionStorage adları `onizleme` önekiyle ayrılır; paylaşım hedefi kaldırılır; ekranda "ÖNİZLEME" şeridi. Canlı adlardan biri kalırsa ya da depoda yedek dosyası varsa derleme durur. Aynı origin'de (aynı kullanıcı.github.io) bu bir güvenlik izolasyonu DEĞİLDİR — bkz. docs/ONIZLEME.md.
- `python3 tools/e2e/onizleme.py` — canlı ve önizleme aynı origin'de çalışırken kazara veri / önbellek / ayar karışmadığını doğrular (güvenlik izolasyonu kanıtı değildir).
- `python3 tools/e2e/eski_preview.py` — canlıdaki eski /preview/ (v3.7) çalışanının güvenli geçişi (`NOUPDATE=1` ile yalnız gezinme güncellemesi).
- `python3 tools/e2e/yedek_matris.py` — parçalı yedek hata matrisi.
- `python3 tools/e2e/kismi.py` — tek işlemde yazılmayan yollar ve geri alma.
- `python3 tools/e2e/geri_donus.py` — v3.9.05 verisiyle v3.9.04 koduna gerçek geri dönüş ve ileri dönüş.
