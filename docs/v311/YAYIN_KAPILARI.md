# v3.11 yayın kapıları — henüz tamamlanmadı

Kalıcı şema7 ve kayıt biçimleri değişmez. kaynak_onceligi yalnız oturum nesnesinde, JSON'a yazılmayan bir özelliktir. Kuyruk mevcut görev ve drafts depolarını kullanır. Eski sınav korunur; model–mesaj–fiş tarih çelişkisi yerel çıkarımla bastırılmaz.

Eski dondurulmuş toplu ölçüm15/38 hazır,14gereksizsoru,3yanlışalan.38kartın16'sı tarih çelişkisi nedeniyle işaretsiz; bu sabit yanıtlar değişmeden ve bu uyarılar korunarak teorik üst sınır22/38'dir.28/38 kapısı yeni ön-işlemeyle alınmış AYRI gerçek Gemini referansında ölçülmelidir. Eski yanıtları değiştirmek, yerel okuyucunun25/38 sonucunu Gemini başarısı diye göstermek veya beklentiyi gevşetmek yasaktır.

## Henüz geçilmemiş zorunlu kabul

- Yeni canlı Gemini referansı:20takmaadlımesaj,3tekrar; hazırdoğru>=28/38,gereksizsoru<=4,yanlışalan<=2; sessizyanlış/para tahmini/zorunlu işaret ihlali0/0/0. Eksik ağ turu puanlanmaz. Çalışma ortamında gerçek anahtar yok; henüz çalıştırılmadı.
- Fiziksel telefon/WhatsApp/gerçek ücretsiz kota ölçümleri; düşükparlaklıkta beşhassaskartın ayrışması;10mesaj+3fiş+2hassasişlemin<=8dakikada kapanışı. Henüz ölçülmedi.
- İlk yerel görüntüleme<50ms,aynı kart alanı güncellenirken ölçülmüş yerleşim kayması,1.5snvurgu/5snundo/manuelkoruma; tarayıcı ve telefonda ayrı raporlanacak. CLS birimsizdir; piksel sapması ayrı ölçülür. Hercihazda50msgarantisi verilmez.
- Tüm mevcut Node/tarayıcı/yükseltme testleri ve yeni paket testleri. İki başarısız tam kapıda durma kuralı korunur.

Bu kapılar tamamlanmadan taslak PR birleştirilmez/yayınlanmaz. Gerçek telefon/Gemini sonucu uydurulmaz. Yeni bağımsız gerçek yanıtlar eski v3.10.10 yerel ayrıştırıcı kayıtlarının yerine geçirilmez.

## Hibrit adayda doğrulanan dar kontroller

Taklit modelle tarayıcı: ilgisiz müşteri/araç/geçmiş kaydı gönderilmiyor; çözülmüş genel soru kaldırılıyor, parasal soru kalıyor; eksik alan tek başına ikinci modeli çağırmıyor; yön çelişkisi ve bozuk JSON birer ek okumayla sınırlı; iç içe fatura toplamı çelişkisinde gider işaretsiz kalıyor. Toplam sekiz taklit HTTP çağrısı, sıfır işletme yazımı, sıfır yakalanmamış sayfa hatası. Gerçek Gemini başarısı değildir.
