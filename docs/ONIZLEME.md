# Önizleme (birleşme öncesi telefon kabulü)

## Ne değildir
Aynı GitHub hesabının iki deposu (`kullanici.github.io/sahapro-cep-temp/` ve `kullanici.github.io/sahapro-onizleme/`) **aynı origin**'dir. Aynı origin'deki her sayfanın JavaScript'i tarayıcı depolamasının tamamına erişebilir: IndexedDB, Cache Storage ve localStorage.

`tools/preview/build.py` depolama adlarını değiştirir. Bu yalnız iki uygulamanın **kazara** birbirinin verisini açmasını ya da silmesini önler; bir **güvenlik izolasyonu değildir**. Aynı origin'deki önizleme yalnız **örnek verili işlevsel test alanı** olarak kullanılır.

## Denetlenen ortak alanlar (aynı origin'de)

| Alan | Canlı | Önizleme | Not |
|---|---|---|---|
| IndexedDB | `sahapro_cep_db`, `…_recovery`, `?db=` testi | `sahapro_onizleme_db…` | Göç yedeği (`backupBeforeUpgrade`) yalnız kendi adını açar; `indexedDB.databases()` yalnız listeler |
| localStorage | `sp_role`, `sp_driver*` | `spx_*` | Origin genelinde ortak alan; yalnız adlar ayrı |
| sessionStorage | `solo_unlocked`, `solo_history_*` | `solox_*` | Aynı sekmede ortak |
| Cache Storage | `sahapro-solo-*`, `-share`, `-wa`, `-driver` | `sahapro-onizleme-*` | Her çalışan yalnız kendi önekini siler (`onizleme.py` doğruladı) |
| Service Worker | kapsam `/sahapro-cep-temp/` | kapsam `/sahapro-onizleme/` | Ayrı kayıt |
| Paylaşım hedefi | var | **yok** (manifestten kaldırıldı) | Paylaşılan dosya yalnız canlıya gider |
| Şoför bağlantıları | canlı adres | önizleme adresi | **Gerçek şoförlere önizleme bağlantısı gönderilmez.** Önizlemeden gelen kod canlıda "tanınmayan bağlantı" diye reddedilir |
| Kalıcı depolama izni | `navigator.storage.persist()` | aynı | Origin geneli; zararsız |
| Temizlik / sıfırlama | uygulamada genel `caches.delete`, `deleteDatabase`, `unregister` yok | aynı | Kod taramasıyla doğrulandı |

## Önerilen: farklı origin (gerçek veriye erişemez)
En küçük düzen (ücretsiz, token gerektirmez):
1. GitHub'da ücretsiz bir **organizasyon** açın (ör. `sahapro-test`). Organizasyonun Pages adresi `https://sahapro-test.github.io/` olur; bu **ayrı bir origin**'dir.
2. Organizasyonda herkese açık bir depo açın: `sahapro-test.github.io`.
3. `SAHAPRO_ONIZLEME_*.zip` içeriğini web arayüzünden yükleyin: Add file → Upload files.
4. Settings → Pages → Branch: `main`, klasör: `/` → Save.

Gerekmeyenler: GitHub Actions, gizli anahtar, token, ödeme.

Paketi Claude'un göndermesi isteniyorsa, yalnız bu tek depo için GitHub uygulamasına yazma izni verilir. Canlı depoya ek bir izin gerekmez.

## Kurallar
- Önizlemeye kişisel yedek, şoför sırrı ya da gerçek kayıt konmaz. Derleme, depoda yedek dosyası bulursa durur.
- Önizlemede yalnız elle girilen örnek veri kullanılır.
