# Asistan iş merkezi — v3.10.10

Taban: canlı v3.10.09 (`f54c0f5`). Amaç, asistanı günlük işin tarif edildiği, kayıtların bulunduğu ve kontrol taslaklarının hazırlandığı bir çalışma alanı yapmak.

## Kullanıcıya görünen davranış

- Aranabilen ve altı iş alanında gruplanan **47 somut işlem girişi**: iş/kayıt, para takibi, saha/filo, belge/rapor ve yönetim. İlk görünüm altı sık kullanılan işlemle başlar; diğerleri grup/arama veya Tüm işlemler ile bulunur. Her girişin Burada oluştur / hazırla / hesapla / bul veya Ayrıntılı ekran olduğu açıkça yazılır. 47 girişin tamamının yeni model aracı olduğu iddia edilmez.
- Altı yerel cevap: günlük, haftalık ve aylık özet, günlük öncelikler, kayıtlı ödeme takibi ve eksikler. Mevcut doğrulanmış okuma modelleri kullanılır. Sonuç bağımsız panelde gösterilir; yenileme ve kaynak kayıtları vardır. Görüntüleme sohbet/metaveri veya işletme kaydı yazmaz.
- Müşteri, şantiye, araç, personel, iş ve belgelerde cihaz içi arama. Kayıtlı takma adlar da bulunur. Ana firma ve taşeron ayrı seçenekler olarak görünür; müşteri kimliği sessizce değiştirilmez. Silinmiş kayıtlar getirilmez. Önce 60 sonuç gösterilir; fazla sonuçta aramayı daraltma istenir.
- Seçilen müşteri/şantiye kaydıyla asistan içinde iş taslağı hazırlama. Müşteri ve şantiye açık kullanıcı seçimiyle doldurulur; tarih, miktar ve fiyat uydurulmaz. Gecikmeli kayıt okuması sırasında müşteri elle değiştirilirse üzerine yazılmaz. Beş yerel iş/tahsilat/gider/yakıt/bakım başlangıcı gerçek kontrol kartlarını hazırlar; Kaydet olmadan işletme kaydı oluşmaz.
- v109'daki dört müşteri/şantiye/araç/personel oluşturma akışı korunur. Model/Gemini anahtarı gerekmez. Banka, hakediş kesinleştirme, ücret ve benzeri işlemler mevcut özel ekran/onaylarıyla ilerler; model yeni yazma yetkisi almaz.
- Açık kartların elle düzeltilen alanları, işaretler ve yazılmış mesaj salt okuma/arama sırasında korunur. Yeni taslak eskisinin yerine geçecekse açık seçim istenir. Ekler otomatik silinmez veya yerel komutla modele gönderilmez. Anahtar yokken anlaşılmayan mesaj, açık kartları silmek yerine tek uyarı gösterir.
- Masaüstünde alan menüsü ve görev çalışma yüzeyi, telefonda yatay alan seçimi ve büyük işlem kartları. İş merkezinin görünümü konuşma başladıktan sonra daralır; isteğe göre açılır. Sonuç paneli açıkken mesaj kutusu içeriği kapatmaz. Eski sohbet/görevler ve mevcut tüm işlemler korunur.

## Güvenlik ve veri

Şema7, kayıt biçimi, para rolleri, zorunlu işaretsiz beş kart, KDV kararı, işlem kimlikleri, şoför imzaları, strict revizyon, izin/bütçe/iptal/süre kapıları değişmez. Hesapları mevcut telefon okuma modeli yapar. YZ2 ve sağlayıcı değiştirilmez. Yeni veritabanı alanı, kayıt türü veya metaveri anahtarı eklenmez; arama/alan seçimleri yalnız görünüm belleğindedir. Gerçek kayıt/yedek/şoför bağlantısı veya anahtar testlerde kullanılmaz.

## Kanıt ve ölçüm

Yeni aynı tarayıcı testi değişmemiş v109'da iş merkezinin yokluğunda düşer. Adayda salt okumanın metaveri dahil aynı kalması, takma ad araması, taşeron/şantiye kimliği, geciktirilmiş gerçek DB okumasında manuel müşteri seçiminin korunması, bilinmeyen tarihin boş kalması, tahsilatın işaretsiz gelmesi, eski kartı kapatmadan önce vazgeçme, eklerin korunması ve sıfır işletme yazması doğrulanır. 320/390/768/1280 genişlikleri ve kaynak metninin HTML olarak çalışmaması denetlenir. Test yanıtı modelden gelmez.

| Dondurulmuş ölçüm | v109 | Aday |
|---|---:|---:|
| Genel doğru işaretli | 30/73 | 30/73 |
| Sessiz yanlış / para tahmini / zorunlu işaret ihlali | 0/0/0 | 0/0/0 |
| Takma adlı 20 mesaj tek tek hazır doğru | 23/38 | 23/38 |
| Toplu hazır doğru / gereksiz soru | 15/38 / 21 | 15/38 / 21 |

Bu paket modelin anlama oranının arttığı iddiası değildir. Gerçek Gemini, telefon ve WhatsApp denenmedi. Yerel 194 Node dosyası, yeni iş merkezi uçtan uca testi, mevcut dört kart ve asistan iş akışı testleri geçti. Tam CI ve yayın kanıtı PR'da ayrı raporlanır; bütün kapılar geçmeden birleştirme yoktur. Yeni görevin iki başarısız tam kapıda durma sınırı korunur.

Telefon görsel incelemesinde ilk işlem başlığı sabit mesaj kutusunun altında kalıyordu. Küçük ekran giriş alanı daraltıldı; 320 ve 390 pikselde ilk işlem başlığının mesaj kutusunun üzerinde görünmesi aynı tarayıcı testine eklendi. Önceki commit üzerindeki devam eden CI, bu düzeltme nedeniyle yeni commit ile geçersiz kılınır; yayın için yalnız son commitin tam kapıları geçerlidir.

Ayrıntılı ekrana geçişte de açık, kaydedilmemiş kart varsa onay istenir. Vazgeçme kartın elle yazılmış tutarını, işaretini ve eklerini korur; bu durum yeni tarayıcı testine eklendi. Kaydedilmiş kartlar gereksiz açık-taslak uyarısı sayılmaz. Mevcut asistan çalışma alanı testi değiştirilmeden geçer. Önceki adayın devam eden CI'si bu son koruma eklendiği için yeni commit ile geçersiz kılınır; yalnız son commitin tam sonuçları yayın kapısıdır.
