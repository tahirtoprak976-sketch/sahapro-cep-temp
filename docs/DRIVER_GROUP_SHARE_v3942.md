# SOLO v3.9.42 — patron aktarımı ve grup özeti

Personelin iki farklı ihtiyacı ayrı düğmelerle karşılanır:

- **Patrona gönder:** ana yöntem yeniden okunur mesaj + imzalı SP1 aktarımı +
  özgün sıradaki fotoğraflardır. Kayıt kimlikleri, nakit bilgileri ve mevcut
  doğrulama/tekrar kontrolü korunur. Dosyalı alternatifler ayrı açılır bölümde kalır.
- **WhatsApp grubunda paylaş · yalnız işler:** gönderim merkezinden açılır.
  Tarih ve iş seçilir, mesaj önizlenir. Bugünde iş varsa bugün, yoksa en yeni iş
  tarihi seçilir. Bekleyen ve daha önce paylaşılmış işler birlikte seçilebilir.

Grup özeti yalnız iş alanlarından üretilir: personel adı, tarih, araç,
müşteri/taşeron, şantiye, iş türü, miktar/birim, malzeme, döküm yeri, tonaj,
açıklama. Ayrı nakit alanları, fiyatlar, gider/yakıt/bakım kayıtları, kayıt/link
kimlikleri, doğrulama anahtarı, SP1, fotoğraf veya PDF eklenmez. Serbest açıklama
ve müşteri adları kullanıcının yazdığı metindir; kullanıcı önizlemede kontrol eder.

Grup paylaşımı hiçbir kayıt ya da gönderim durumu yazmaz. Kaydedilmemiş form
korunur. Patrona aktarımın yerine geçmez. Mesaj mevcut 3600 bayt sınırını aşarsa
kesilmez; daha az iş seçilmesi istenir. Seçili kayıtlar veya personel bağlantısı
başka sekmede değişirse ve bağlantı süresi dolarsa eski özet paylaşılamaz.

Native paylaşım taze kullanıcı tıklamasında yalnız `{text}` alır. İzin hatasında
veya Web Share olmadığında ayrıca WhatsApp bağlantısıyla açma seçeneği vardır.
Alıcı/grup seçimi ve gerçek Gönder işlemi WhatsApp'ta kullanıcıya aittir.
Paylaşım API'sinin tamamlanması gerçek teslimat olarak gösterilmez.

## Doğrulama

- Node: 97/97 test dosyası; sözdizimi 137 dosya; SW listesi 136 modül.
- `driver_group_share.py`: tarih/iş seçimi, taşeron bağlamı, yalnız metin,
  mali/özel alanların dışarıda kalması, çift tık kilidi, iptal, izin hatası,
  WhatsApp bağlantısı, engellenen pencere, değişen kayıt/kimlik, uzun mesaj,
  taslağın korunması ve bağımsız imzalı patron aktarımı.
- `driver_journey.py`, `driver_cash.py`: fotoğraf/kimlik/nakit aktarımı,
  açık tahsilat onayı, tekrar kontrolü ve yerel depolama hataları.
- `driver_ultimate.py`: 23/23; çevrimdışı, taslak, fotoğraf kurtarma ve iki sekme.
- `driver_pdf.py`, `driver_share_recovery.py`: açılır bölümdeki mevcut dosya
  alternatifleri ve izin hatası kurtarma yolları.

Tarayıcı testlerinde native paylaşım taklit edilir; gerçek WhatsApp grubuna mesaj
gönderilmez. Fiziksel telefonda alıcı seçimi ve WhatsApp teslimatı bu testlerin
kanıtladığı davranışlar arasında değildir. DB şeması değişmez; sunucu eklenmez.
