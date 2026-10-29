# Döküm sahası kartlarını birleştirme — v3.9.86

Daha Fazla → Kartları Birleştir → **Döküm sahası**. Kalacak gerçek saha kartı ve mükerrer kartlar seçilir; Önizle ile taşınacak kayıtlar ve ortak bakiye görülür. Birleştir onayıyla bütün işlem tek IndexedDB transaction içinde yapılır. Önizlemeden sonra yeni hareket veya kart değişikliği olursa yeniden önizleme gerekir.

İşlerin `dump_site_id` bağlantısı, döküm yükleme/kesinti/iade kayıtları, gider bağlantıları, belgeler, borç/ödeme tarafları, mevcut takma adlar ve mesaj taslakları taşınır. Belge ve döküm hareketinin kimliği değişmediği için fotoğraflar aynı kayda bağlı kalır. Kaynak kartlar gerekçeli olarak çöp kutusuna gider; denetim kayıtları değişmez. İşlerdeki eski tarife/tahmin kopyalarında yalnız saha kimliği değiştirilir; tarih, ücret, tonaj ve tutar yeniden hesaplanmaz. Kalacak kartın güncel tarifesi yeni işler için korunur; boş adres/telefon bilgisi tamamlanabilir.

İç depo ve ücretli saha karıştırılmaz. Birden fazla aktif açılış, diğer kartın açılıştan önceki kayıtlarını görünmez kılacak dönem farkı, mükerrer fiş/yükleme veya aynı numaralı borç belgesi birleştirmeyi durdurur. Hiçbir kayıt kendiliğinden silinmez veya netleştirilmez. Toplam kayıtlı bakiye değişiyorsa işlem yapılmaz. Bağlantısız eski metin gideri bu işlemle para yüklemesine çevrilmez.

Önceki kartlara ait saha bakiye bildirimleri toplanıp yeni mutabakat sayılmaz. Özgün bildirimler tarihçede korunur; ortak hesap ekranında görünür. Birleşik hesap için Bakiye Karşılaştır ile güncel saha ekstresi yeniden teyit edilir. Bu karşılaştırma para/gider oluşturmaz.

Saf karar testleri ve gerçek Chromium/IndexedDB testleri; önizleme/onay, eski maliyet ve toplam bakiye, ek bytes, taze önizleme, gerçek yazma hatasında rollback, yedek geri yükleme ve çevrimdışı ekranı doğrular. Gerçek telefon verisi otomatik birleştirilmez. Şema 7 değişmez.
