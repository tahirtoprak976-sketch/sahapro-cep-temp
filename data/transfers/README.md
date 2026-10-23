Bu dizine yalnız `tools/create-secure-transfer.mjs` tarafından üretilen şifreli
`<rastgele-uuid>.json` dosyaları konur. Kaynak mesajı, düz iş JSON'u, eşleştirme
dosyası, telefon yedeği ve özel anahtar burada yayımlanmaz.

İşletme bilgisi ciphertext içindedir; hedef telefonun dışarı aktarılamayan anahtarı
olmadan açılamaz. Dosya adı, boyutu, açık anahtar kimliği ve zaman bilgileri açıktır.
GitHub/Git geçmişinden silme, bütün kopyaların silinmesini garanti etmez.

Kurulum ve teslim: `docs/SECURE_TRANSFER_v3963.md`.
