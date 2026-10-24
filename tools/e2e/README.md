# Uçtan uca testler (her sürümden önce)

Depo kökünde `python3 -m http.server 8841`, sonra:

- `python3 tools/e2e/record_notes.py http://localhost:8841/` — U55/43 L biçimindeki çok mesajlı eski notun salt okunur görünümü, kaynağın kapalı kalması/HTML kaçışları, ilgisiz müşteriyle arama eşleşmemesi, iş düzenlemesinde orijinali koruma, yeni iş/yakıt notlarının ayrılması, tam kaynağın yedek/geri yüklemesi ve müşteri PDF'sine girmemesi. Kaynaklar anonim test mesajları; model taklit, Chromium/IDB/transaction gerçek.

- `python3 tools/e2e/part_cost.py http://localhost:8841/` — parçada zorunlu açık maliyet seçimi, eski varsayılan taslağın sessiz onaylanmaması, kayıtlı aküyü yeniden oluşturmadan giderlere işleme, mevcut maliyete bağlama, tekrar/eşzamanlı onay, eskiyen kayıt, gerçek transaction hatasında geri sarma, belgeleri koruma ve temiz profile yedek geri yükleme. Chromium/IDB gerçek; AI/ağ hesabı yok.

- `python3 tools/e2e/part_documents.py http://localhost:8841/` — Asistanla garanti fotoğrafı, eski model yanıtını kurtarma, parça kartından yeniden okuma, PDF, belirsiz alanlar, elle yazılmış değerleri koruma, tekrar yükleme ve ayrı profilde fotoğraf/PDF yedek geri yüklemesi. Model yanıtları taklit; orijinal dosyalar, Chromium, DOM, IDB ve SW gerçek. Pillow + ReportLab + DejaVu Sans gerekir.
- `python3 tools/e2e/part_document_guards.py http://localhost:8841/` — dosya içeriğinden tür denetimi, kayıt/güncelleme sırasında gerçek transaction hatası, aynı belgenin eşzamanlı kaydı, eskiyen garanti düzenlemesi, okuma iptali/zaman aşımı/yanıt sınırı/izin reddi, taslak yedek kapsamı ve temiz profilde geri yükleme. Gerçek Gemini çağrısı yok.

- `python3 tools/e2e/bulk_entry.py http://localhost:8841/` — 20 geçmiş iş/3 ortak kart sorusu/tek atomik onay, fiyat bekletme, geçmiş stok, çevrimdışı taslak sürdürme, hata/yeniden deneme/eşzamanlı onay ve yalnız kendi kayıtlarını geri alma. Model taklit; DOM, IDB, SW ve request hataları gerçek.
- `python3 tools/e2e/bulk_entry_race.py http://localhost:8841/` — iki gerçek sekmede aynı onay, önizleme sonrası depo tüketimi ve yeni sohbet, alias tekilliği, geri alma sırasında gelen düzenleme/bağlantı. Model çağrısı yok.

- `python3 tools/e2e/assistant_batch.py [uygulama-adresi]` — açık toplu iş tarihi, fiyat bekletme, yerel düzeltme, güvenli toplu seçim, modelin şoför işareti taklidi, gerçek boş fiyatla kayıt, önizleme sonrası değişen stok, faturayla eşleşmiş stok ve kalıcı görev. Model/OCR taklit; Chromium, DOM olayları ve IndexedDB gerçek. Stok testleri kaynak/finans kaydı yazılmadan reddi denetler.

- `python3 tools/e2e/secure_transfer.py [uygulama-adresi]` — cihaza bağlı şifreli geçmiş aktarımı; CLI, gerçek Chromium/IndexedDB, önizleme, yedek/yazma hatası, eşzamanlı tekrar, farklı tarayıcı/bozuk dosya reddi, çevrimdışı dosya ve eşleştirme kaldırma. Teslim HTTP yanıtı sentetik test paketiyle doldurulur; gerçek veri yayımlanmaz.

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

v3.9.62 doğrulaması: `customer_snapshot.py` müşteri kartında aynı okuma görüntüsünü ve taze paylaşımı; `transaction_errors.py` gerçek request hatasında Error nesnesi ve transaction geri sarmasını; `kismi.py` ön denetim reddini, transaction sırasında hata sonrası kısmi kayıt uyarısını ve geri almayı ölçer. `islem.py`, `denetim.py` ve `sim.py` güncel akış/seçicileri kullanır; FAIL varsa sıfır olmayan çıkış kodu döner. Bu eski dört suiti sistem Chromium'uyla çalıştırmak için `CHROMIUM_PATH=/usr/bin/chromium` verilebilir.

`eski_preview.py` ve `geri_donus.py`, git geçmişindeki `1eaebf1` ağacını gerektirir. `.git` içermeyen kaynak ZIP'inde açıklamalı SKIP ve **77** çıkış kodu verir; bu sonuç PASS değildir. Yardımcı denetim `support/history_fixture.py` içindedir.
