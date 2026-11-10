# İşletme sahibinin karar özeti — v3.10.07

Ana sayfanın ilk bölümü tarihli kasa+banka beyanını, kayıtlı alış belgelerinde geçmiş/önümüzdeki 7 gün vadeyi, 31+ günlük müşteri alacağını ve personeldeki tahsilatı gösterir. En fazla üç kaynak bağlantılı aksiyon vardır. Kapsam gerekçeleri aynı kartta açılır. Mevcut asistan, formlar ve operasyon masası korunur.

Banka tahsilatları artık ana sayfadaki personelde/teslim onayı bekleyen tutara girmez. PERSONELDE ve TESLIM_BILDIRILDI ayrı gösterilir; teslim bildirimi kasa onayı sayılmaz. İleri tarihli, silinmiş veya personel ödeme kayıtları bu toplama alınmaz.

Nakit Tahmini mevcut normal ve vade/söz senaryolarını korur; üçüncü stres senaryosu gelecek bütün tahsilatları (ödeme sözü ve çek dahil) sıfır kabul eder. Kayıtlı/tahmini çıkışlar aynı kalır. Başlangıç nakdi bilinmiyorsa stres bakiyesi boş/bilinmiyor kalır; sıfır para varmış gibi gösterilmez. Tarihli manuel beyan otomatik banka mutabakatı değildir. Eski tarih açıkça gösterilir. Eksik borçlar, vergi/SGK/kredi ve bilinmeyen maliyetler için tamlık iddiası yoktur.

## Ölçüm ve doğrulama

| Sentetik senaryo | v3.10.06 | v3.10.07 |
|---|---:|---:|
| Yalnız bankaya alınmış 20.000 TL'nin bekleyen personel/kasa tutarı | 20.000 TL yanlış | 0 TL |
| 100 TL nakit, 1.000 TL ödeme sözü, 300 TL yakın ödeme: tahsilatsız haftalık bakiye | Ayrı senaryo yok | −200 TL |
| Ana sayfada karar özeti | Yok | 4 kaynak kapsamlı gösterge, en fazla 3 aksiyon |
| Dondurulmuş asistan doğru işaretli kart | 30/73 | 30/73 |
| Sessiz yanlış / para tahmini / zorunlu işaret ihlali | 0/0/0 | 0/0/0 |
| Yerel eski gold | 80 mesaj, 369 alan, 0 yanlış | 80 mesaj, 369 alan, 0 yanlış |

Yeni Node testi para rolü, teslim, gelecek/silinmiş kayıtlar, net KDV politikası, eski/geçersiz nakit ve stres hesabını denetler. Yeni tarayıcı testi gerçek TEST IndexedDB ile banka ayrımını, eski nakit etiketini, cari yaşını, kaynaklara gezinmeyi, stres hesabını, 320/360/390/768 px taşmayı ve kayıt/meta/taslak/eklerin tam eşitliğini denetler. Değişmemiş v106 üzerinde banka sınıflama hatası ayrıca tekrar üretilir. Önceki test beklentileri korunur; yalnız sürüm sabitlemesi 107 olur. Şema 7 ve kayıt biçimi değişmez, eski kayıtlar düzeltilmez.

Bu paket toplu mesaj soru azaltma veya gerçek Gemini doğruluk artışı iddiası içermez. Gerçek telefon, gerçek WhatsApp, gerçek Gemini ve işletmenin gerçek hesapları denenmedi.
