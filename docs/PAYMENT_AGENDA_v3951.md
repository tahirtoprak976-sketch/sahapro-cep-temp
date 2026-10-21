# SOLO v3.9.51 — kayıtlı ödeme takibi

## Karar ve kullanım

Günlük işletme öncelikleri alacak/tahsilat, bakım ve nakit teslimini izliyordu;
alış belgelerindeki ödenecek borçlar için aynı yerden izlenen bir vade listesi
yoktu. Finans → **Ödeme Takibi** bu ihtiyacı karşılar. Yeni sunucu veya veri türü
eklemez; mevcut alış belgeleri, taraf kartları, bağlı tedarikçi ödemeleri ve
çek/senet kayıtlarını okur.

Kayıtlı vadesi geçmiş, bugün, önümüzdeki 7 gün, daha ileri vade ve vade/kayıt
kontrolü grupları ayrıdır. “Önümüzdeki 7 gün” yarından başlayıp bugünden 7 gün
sonraya kadar olan vadeleri kapsar; bugün ayrıca gösterilir. Taraf/belge/açıklama
aranabilir. Vade kartına dokunmak o grubu açar; kart toplamları mevcut aramanın
gruplara dağılımıdır. CSV seçili arama/gruptaki bütün belgeleri kapsar; ilk 30
satır sınırı yalnız görüntülemeye aittir.

Her kart belge toplamı, bugüne kadar bağlı ödenen ve kalanı gösterir. Kaynak
bağlantısı gerçek alış belgesini açar. Burada “ödeme yap” işlemi yoktur; mevcut
ödeme formu ve korumaları kaynak ekranda kalır. Yenile son kayıtlardan tekrar
hesaplar. Açık kalan borç ödendiğinde ilgili takip satırı düşer.

## Hesap ve sınırlar

- Kalan, mevcut `billBalance` ile aynı belgeye bağlı ödemelerden kuruş bazında
  hesaplanır. Farklı tarafa/başka belgeye yapılmış ödeme rastgele dağıtılmaz.
- Yalnız bugüne kadar girilmiş belge/ödeme tarihleri bugünkü duruma alınır.
  İleri tarihli belge bugünkü listeye alınmaz; ileri tarihli ödeme aynı belgede
  uyarıyla gösterilir, bugünkü ödenenden düşülmez. Bu, yeniden ödeme talimatı
  değildir; belge ve ödeme tarihi kontrol edilmelidir.
- İptal/silinmiş belgeler ve silinmiş ödemeler dışarıda; tamamen ödenmiş belge
  takipte gösterilmez. Arşivdeki tarafın mevcut borcu sessizce gizlenmez.
- Eksik/geçersiz vade, belge tarihi, toplam, taraf, onay durumu veya tutarsız
  ödeme bağlantısı vade/kayıt kontrolüne gider. Hesap güvenilir değilse tutar
  “Hesaplanmadı” görünür. Bunlar vade toplamlarına/ödeme önceliğine alınmaz.
  Belge tarihinden ödeme vadesi tahmin edilmez.
- Aynı tarafa verilmiş açık çek/senet, belgede ayrıca uyarı ve kaynak
  bağlantısıyla görünür. Bu belgenin ödemesi olduğu varsayılmaz; borçtan ayrıca
  düşülmez. Aynı borç için tekrar ödeme yapmadan önce kontrol edilmesi istenir.
- Bu ekran alış borçlarını izler. Müşteri alacakları, maaş, kira, kaydı olmayan
  yükümlülükler veya kullanılabilir kasa/banka parası toplamı değildir. Kayıtlı
  vade, gerçek ödeme anlaşmasıyla kullanıcı tarafından kontrol edilir.

Ana sayfa → Ne yapmalıyım? yakın vadeli borçların kaynağını da önerir. Kayıtlı
vadesi geçmiş belge önce, bugün ikinci, sonraki 7 gün daha sonra gelir. Eksik
bilgilerden “ödenmeli” önerisi üretilmez. Asistana **“Kime ödeme yapacağım?”**,
**“Ödemelerim”** veya **“Ödeme takibini aç”** yazmak aynı kayıtlardan yerel
yanıt verir; Gemini kullanılmaz. Neler yapabilirim rehberine örnek eklenir.

## Doğrulama

- Node 105/105 test dosyası PASS; syntax 146 dosya; SW 145 JS modülü.
- Yeni saf test: kısmi/gelecek tarihli/yanlış taraflı/geçersiz ödeme, iptal ve
  kapanmış belge, eksik/imkânsız vade, arşiv kartı, taraf türleri, kuruş toplamı,
  çek uyarısı, kaynak değişmezliği, yerel komut sınırları ve güvenli CSV.
- Yeni gerçek Chromium/IndexedDB suiti: gerçek alış/ödeme API'leriyle 39 açık
  belge; ilk 30'un ötesini içeren CSV; arama/grup/toplam uyumu; 750,15 ₺ kısmi
  bakiye; ileri tarihli ödeme; kuruşlu toplamlar; kaynak belge;
  ana sayfa ve asistanla aynı hesap; gerçekten ödeme sonrası yenileme; hatalı
  okumada rakamları gizleme ve yeniden deneme; 320/360/768px; çevrimdışı SW.
- Sekiz tarayıcı suiti PASS: payment_agenda, business_priorities,
  review_consistency, safe_form_save, operation_history, field_entry,
  driver_fast_share, driver_group_share.

Denemeler yapay verilerdir. Liste/filtre/CSV/yerel yanıt, işletme kayıtlarını veya
audit'i değiştirmez. Ödeme testi yalnız kendi açık ödeme adımında yazma yapar;
sonraki yenileme/çevrimdışı işlemlerde ek finansal yazım yoktur. Gerçek dış
mesaj/AI isteği yoktur. DB şeması 5; sürüm ve atomik SW önbelleği v3.9.51.
