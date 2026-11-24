# Sohbette onaylı belge ve müşteri yakıt mahsubu — v3.10.25

İş sahibi bu sohbette mevcut aktarımın dosya ve müşterinin ödediği yakıt mahsubu için geliştirilmesini istedi. Bu dar ek kapsam; nakit tahsilat, ödeme, müşteri mazot teslimi veya eski kayıt düzenleme yetkisi değildir.

## Kullanım ve izin

Geçmiş İş Aktarımı içindeki mevcut Sohbette Onayla · Telefona Kaydet panelinde **Belge ve Mahsup İznini Aç** seçilir. Yönetici doğrulaması ve kapsamı açıklayan onay gerekir. Mevcut SPAR1 kodu değişmez; eski izin kendiliğinden genişletilmez. Aynı düğmeden ek kapsam kapatılır. Bağlantıyı kapatma da bütün yazmaları keser. Form/kilit/şoför/çevrimdışı ve yedi günlük süre kapıları korunur.

Sohbette somut müşteri, tarih, litre, fiyat dayanağı ve tutar onayı alınmadan paket üretilmez. Belge için gerçek kaynak dosyası ve kaydedilmiş işin kararlı kaynak satır kimliği gerekir. Fotoğrafın yalnız sohbet ekranında görünmesi dosyanın uygulamaya eklendiği anlamına gelmez.

## SAHAPRO_REMOTE_ACTIONS_V1

Tam alan listesi `js/remote-actions-core.js` içindedir. Paket `{format,id,approved:{confirmed,at,summary},offsets:[],documents:[]}`; yalnız izinli alanlar, en çok 10 mahsup/10 belge, sınırlı gövde. Aynı CLI ve şifreli aynı-origin kutu kullanılır. Gerçek veriler, dosya ve bağlantı sırrı repo dışında tutulur. Yayımlanan içerik yalnız AES-GCM kutusudur.

- **offsets:** kaynak kimliği, tarih, mevcut müşteri/araç/personel, litre, birim fiyat, toplam, gerekçe, fiyat dayanağı (`receipt`/`reference`) ve kaynak. Yerel kod çarpımı kuruş cinsinden doğrular. Tarihli web referansı gerçek istasyon fişi sayılmaz; gerekçede açıkça görünür. Oran/tutar tahmin edilmez. Mevcut `cari_movements` deposuna `Duzeltme`, negatif tutar ve görünür gerekçe yazılır. Kasa/banka/stok/yakıt/gider/hakediş kaydı oluşmaz. Bu özellik fiziksel yakıt tüketimini ayrıca kaydettiğini iddia etmez.
- **documents:** yalnız İrsaliye; tarih/no, kaynak kimliği ve mevcut işin `history_source.row_id` değeri, dosya adı/türü, base64 ve SHA-256. Gerçek JPEG/PNG/WebP/PDF baytları mevcut dosya güvenliği sınırından geçer. Görseller tarayıcıda çözümlenir; bozuk/tür veya özet uyuşmayan dosya reddedilir. Dosya başına yaklaşık 1,5 MB; büyük dosya için ayrı, kullanıcı tarafından gözden geçirilmiş küçük kopya gerekir. Sessiz kalite kaybı yoktur.
- Belge mevcut `documents` deposunda `owner_type:work` ile, özgün Blob mevcut `attachments` deposunda belgeye bağlı saklanır. Belge işe eklenir, işin kendisi değiştirilmez. Aynı dosya özeti veya normalize belge numarası ikinci kez belge açmaz; mevcut kaydın incelenmesi istenir. İş bulunmadan belge yazılmaz.

## Atomiklik, tekrar ve yedek

Önce tam kurtarma yedeği; sonra cari/belge/dosya, global kaynak kimliği kaydı ve makbuz tek transaction. Açık izin ve oturum transaction içinde tekrar denetlenir. Kaynak kimliği özeti mevcut meta deposunda saklanır; aynı içerik başka paket/kanalda tekrar yazılmaz, farklı içerik OP_CONFLICT. Silinmiş işlemler yeni paketle diriltilmez. Metada dosya base64 yerine yalnız kaynak özeti vardır.

Şema8 ve mevcut işletme kayıt biçimleri korunur. İş sahibi tarafından onaylı yeni kayıtlar eklenir; eski kayıtlar dönüştürülmez/düzeltilmez. Tam dosyalı yedek belge, Blob ve cari düzeltmesini birlikte içerir; bağlantı izni ve anahtar yedekle etkinleşmez. Dosyasız yedeğin dosyaları koruduğu iddia edilmez.

## Doğrulama

Sentetik sözleşme testi v3.10.24'te `REMOTE_ACTIONS_NOT_SUPPORTED` ile başarısız, adayda geçer. Node: alan allowlist, para çarpımı, tarih, belirsiz kart, dosya tür/özet, tekrar/çelişki, silinmiş kaynak ve şifreleme. Chromium: izin kapalı/açık/iptal, kasasız-stoksuz mahsup, işe bağlı gerçek PNG baytları, tam yedek baytları, aynı/yeni paket tekrarı, atomik hata ve oturum kapısı, 360px. Kurulu v3.10.24→25 yükseltme eski kayıt/dosya/meta/taslakları birebir korur. Gerçek telefon/Gemini/WhatsApp veya gerçek işletme verisi testlerde kullanılmaz.
