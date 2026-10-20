# SOLO v3.9.31 — Saha Akışı

Ana sayfa ve Daha Fazla üzerinden açılan günlük saha ekranı. İş, yakıt, gider ve bakım kayıtları tek listede; her kart mevcut ayrıntı ekranına gider. Gün seçimi, önceki/sonraki gün, bugüne dönüş, son 7 günün kayıt sayıları, tür/araç/metin filtreleri ve hızlı yeni kayıt bağlantıları vardır.

Özet seçili gün ve filtrelere aittir. Haftalık gezinmedeki sayılar tüm tür/araçları kapsar. İş miktarları birimlerine göre ayrılır, yakıt litre olarak gösterilir; para/maliyet/kâr toplanmaz. İş tarihleri kullanılır, kayıt oluşturma saati saha olay saati gibi sunulmaz. Gün içinde tür ve kayıt kimliğine göre sabit sıra vardır. Gelecek tarihli mevcut kayıtlar gün seçilerek görülebilir. Geçersiz tarihler günlük akışa alınmaz ve sayıları belirtilir.

URL filtreleri yenilemede korunur. İlk 30 karttan sonra daha fazla gösterilir; özet bütün filtrelenmiş sonuçlara aittir. Veriler tek salt okunur snapshot ile alınır. Yeni modüller çevrimdışı uygulama önbelleğine dahildir. Yeni ekran veri yazmaz, mevcut fiyat/KDV/hakediş hesaplarını değiştirmez. Asistan bağlantısı mevcut asistanı açar; yeni model veya otomatik işlem yetkisi eklenmedi.

Doğrulama: saf model testi ve gerçek Chromium/IndexedDB mobil testi. Fiziksel telefon kabulü kullanıcıda yapılır. Veri cihazda kalır; şoförün başka cihazındaki gönderilmemiş kayıtları burada varmış gibi gösterilmez.
