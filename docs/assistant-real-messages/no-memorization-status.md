# v3.10.02 ad ezberi temizliği ve ölçüm eşleştirmesi

Canlı sürüm v3.10.00; aday henüz yayımlanmadı. Önceki duruşun nedeni ölçüm eşleştirmesiydi: aynı seferlerin depo/Boluca yönleri çapraz eşleştiriliyordu. Kullanıcının incelemesi sonrası eşleştirmeye dump/quarry eklendi. Uygulama bu ölçüm hatası için değiştirilmedi. Önceki blocker JSON tarihsel kanıttır.

## Değişiklikler

- assistant-source-context içindeki müşteri/şehir/adres eşitlikleri ve takma adlı talimatlar kaldırıldı. Müşteri/yer diğer adları aliases ve sites kayıtlarından, dahil iş sites.deal kaydından okunur. Sahipsiz bir yer önceki müşteriye bağlanmaz.
- Ayarlar ekranında kendi depo anlamı, patron personel kartı ve pazar mesaisi tercihi düzenlenir. Mevcut assistant_rules metası STRING olarak kullanılır; yeni veri tabanı şeması, kayıt biçimi veya store yoktur. Düzenlenen kurallar bekleyen taslaktan farklıysa Kaydet yeniden kontrol ister. YZ2/model algoritması değiştirilmedi; eski örnekte sınavla çakışan yer adı yalnız örnek metni olarak genelleştirildi.
- js altında 60 sınav kimliği/adresi/takma adını 227 JS dosyasında tarayan koruma testi geçti. Birim/araç türü gibi teknik terimler kimlik sayılmaz; kişi, müşteri, şantiye, ocak/döküm diğer adları ve takma plaka taranır.
- Önceden var olan resmi saha kayıtları ve fatura yeri ipuçları data/reference-dump-sites.json dosyasına, ad/ücret/eşleme değerleri değiştirilmeden taşındı. Bu dosya sınav girdisi değildir; kaynak içinde sabit müşteri mantığı kullanılmaz. Mevcut işletme kayıtları otomatik değiştirilmedi.
- Fotoğraf tarih çelişkisi daha sonra eklenen telefon çıkarımıyla bastırılamaz. Mevcut geri-dönüş regresyon testi korundu; ayrıca sentetik fotoğraf alt setine üç çelişki ve bir tutarlı olumlu kontrol eklendi. Dördünde de alanlar doğru; çelişkili üç kart işaretsiz, tutarlı yakıt kartı hazır.

## Dürüst başlangıç

Önceki 24/38 yeni taban olarak kullanılmaz. 20 mesaj ve sahibinin onaylı expected sonuçları #225 ile byte-byte aynıdır; yeni bağlam ayrı fixture kayıtlarıdır. Yanıtlar değiştirilmemiş v3.10.00 yerel ayrıştırıcısından dondurulmuştur. Gerçek Gemini ölçümü DEĞİLDİR.

| Kategori | Hazır doğru | Gereksiz soru | Kaçırılan soru | Yanlış alan |
|---|---:|---:|---:|---:|
| Gönderen ve tek iş | 3/4 | 0 | 0 | 0 |
| Yakıt / yük ayrımı | 3/4 | 0 | 0 | 0 |
| Çok iş / eşleşme | 7/7 | 0 | 0 | 0 |
| Mesai | 1/1 | 0 | 0 | 0 |
| Sefer / döküm / patron | 5/11 | 7 | 0 | 10 |
| Eksik / ortak bilgi | 2/8 | 0 | 0 | 0 |
| Sözleşme | 2/3 | 0 | 0 | 0 |

Tekil toplam: {'messages': 20, 'expectedCards': 38, 'actualCards': 38, 'readyCorrect': 23, 'unnecessaryQuestions': 7, 'missedQuestions': 0, 'wrongFields': 10, 'missingCards': 0, 'extraCards': 0, 'silentWrong': 0}

Tek yapıştırma (ayrı sonuç): {'messages': 1, 'expectedCards': 38, 'actualCards': 38, 'readyCorrect': 14, 'unnecessaryQuestions': 21, 'missedQuestions': 0, 'wrongFields': 11, 'missingCards': 0, 'extraCards': 0, 'silentWrong': 1}

Sentetik fotoğraf/tarih alt seti (20 gerçek mesaja eklenip toplamı şişirmez): {'messages': 4, 'expectedCards': 4, 'actualCards': 4, 'readyCorrect': 1, 'unnecessaryQuestions': 0, 'missedQuestions': 0, 'wrongFields': 0, 'missingCards': 0, 'extraCards': 0, 'silentWrong': 0}

TEST sözleşmesi: 1.000 TL, %20 KDV hariç; oran kullanıcı tarafından %20 verildi. Ücret ve hariç bilgisi açık sentetik fixture varsayımıdır, gerçek işletme tarifesi değildir. Pozitif tarifenin gerçek parasal doğruluğu puanlanmaz; kayıt kaynaklı dahil yükleme ve para uydurmama sınanır. Bu fixture uygulama tarafından yüklenmez ve gerçek kayıtlara taşınmaz.

## Engel

Toplu r00/r13 parçasındaki 2 sefer (bir tanesi kendi depoya, bir tanesi başka döküm yerine) ayrılırken bir iş kartı yanlış döküm yeriyle işaretli kalıyor. Kaynağın açık dağılımını modele karşı öne alma denemesi de sonucu düzeltmedi. Sessiz yanlış 1 olduğu için merge/yayın yok. Test beklentisi değiştirilmedi, kartın yanlışlığını gizleyen bir istisna eklenmedi.

24/38 eşiği, kullanıcının ezber kaldırıldıktan sonra yeni dürüst taban istemesi nedeniyle 23/38 tabanıyla değiştirildi; onaylı kart beklentileri ve sıfır sessiz yanlış / sıfır para tahmini / zorunlu işaretsiz korumaları gevşetilmedi. Toplu sıfır hata testi halen kırmızı.

## Yapılmayan doğrulamalar

Tam Node/CI/tarayıcı/yükseltme koşuları ve yayın bu aday için tamamlanmadı. Ayarlar UI’sinin ve yeni fixture veri yolunun tam tarayıcı testi ile dalın CI bağlaması tamamlanmadı. Canlı yayın v3.10.00. Gerçek telefon, gerçek Gemini, gerçek WhatsApp denenmedi. Geri çekilmiş v3.10.01 raporları tarihsel karşılaştırma olarak korunur.

## Eşleştirme düzeltmesi sonrası

| Ölçüm | Önce | Sonra |
|---|---:|---:|
| Tek tek hazır doğru | 23/38 | 23/38 |
| Toplu hazır doğru | 14/38 | 15/38 |
| Toplu sessiz yanlış | 1 (yanlış eşleştirme) | 0 |
| Toplu gereksiz soru | 21 | 21 |
| Toplu yanlış alan | 11 | 9 |
| Kaçırılan soru | 0 | 0 |

Bu değişim model başarısı artışı değildir. Dondurulmuş yerel ayrıştırıcı önerileriyle ölçüldü; gerçek Gemini değildir. Araç iş türü yalnız kayıtlı türden okunur; isimdeki marka/tip kelimeleri kullanılmaz. Genel ekskavatör mini ekskavatör sayılmaz.

Yerel kontroller: 184/184 Node dosyası; r10/r19/toplu 38 kart/geçersiz tarih/göreli tarih ve düzenlenebilir işletme ayarları tarayıcıda geçti. CI tam tarayıcı ve yükseltme kapıları ayrıca zorunludur. Bir sonraki paketin hedefi 21 gereksiz soru ve toplu bağlam aktarımıdır.

İlk CI denemesi: assistant_confidence100 kayıtlı fiyat senaryosu Save sırasında `effectiveRules is not defined` nedeniyle durdu. Yeni ayar preflight kontrolüne eksik fonksiyon importu eklendi. Aynı değiştirilmemiş tarayıcı testinin 16 senaryosu yerelde geçti; ikinci tam CI koşusu zorunlu.

## Kullanıcı teşhisi sonrası taslak yarışı onarımı

5840236 üzerine sağlanan yama aynen uygulandı: assistant_draft okuması sırasında textarea readOnly, finally ile tekrar düzenlenebilir. Kalıcı assistant_draft_race tarayıcı testi gerçek IndexedDB dönüşünü testte geciktirip Playwright fill ile yarıştırır. 6/6 aday koşusunda yalnız yeni metin kalır, kilit açılır, işletme kayıtları değişmez. Aynı test değişmemiş 5840236 üzerinde readOnly korumasının yokluğundan kırmızıdır. Test eski beklentileri değiştirmez; CI'de hem eski sürüm kanıtı hem yeni tarayıcı suiti olarak çalışır. Kullanıcı devam yetkisiyle tam yayın kapıları yeniden yürütülür.

Yama sonrası ilk tam CI (42059555787): 10/10 assistant_turn, yeni yarış suiti ve confidence100 geçti. Eski assistant_startup testinin fill-bittiğinde-okumayı-serbest-bırak sırası, salt okunur kutuda test içi kilitlenme yarattı. Yalnız bu zamanlama uyarlandı: kutu salt okunursa bekletilen okuma fill öncesi serbest bırakılır; düzenlenebilir tarihsel sürümde önceki yarış sırası korunur. Bütün mevcut assert ifadeleri AST ile birebir aynı doğrulandı; CI bu eşitliği de denetler. Yerelde startup ve yeni yarışın 6/6 koşusu geçti. Uygulama yaması aynen kaldı; ikinci tam CI kapısı beklenir.
