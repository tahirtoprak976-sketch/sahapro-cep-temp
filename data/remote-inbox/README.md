# Şifreli onaylı kayıt teslim kutuları

Yalnız UUID adlı SAHAPRO_REMOTE_BOX_V1 şifreli kutular yayımlanır. Kaynak mesaj,
SPAR1 kodu, ham paket ve anahtar bu dizine veya Git geçmişine konulmaz.
Telefon uygulaması yalnız kendi kanalını alır; dizin listesi istemez.
Dosyalar sunucuda kendiliğinden silinmez; süresi geçmiş şifreli kutular yayıncı
bakımıyla kaldırılmalıdır. Şifreleme Git geçmişindeki eski şifreli baytları da kapsar.
