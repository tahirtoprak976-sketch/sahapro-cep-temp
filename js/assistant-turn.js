// Decide whether text starts a new request or corrects a pending result.
const groups=['works','expenses','fuel','collections','maintenance','personnel','edits','cards','memory','tickets','docs','tankIn','prices','actions','settings'];
export function pendingAssistantCards(result){if(!result||result._done)return 0;return groups.reduce((n,k)=>n+(Array.isArray(result[k])?result[k].length:0),0);}
const fold=s=>String(s||'').trim().toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ı/g,'i').replace(/\s+/g,' ');
export function assistantTurn({text='',previous=null,manual=null,transfer=false}={}){
 const typed=String(text).trim(),pending=pendingAssistantCards(previous?.v);
 const fresh=reason=>({mode:'new',pending,reason});
 if(transfer||/SP1:[A-Za-z0-9_-]{8,}/.test(typed))return fresh('Şoför aktarımı ayrı okunacak.');
 if(!typed)return fresh('Yeni belge veya ses kaydı olarak okunacak.');
 if(/^\s*\[?\d{1,2}[./]\d{1,2}[./]\d{2,4}[ ,]+\d{1,2}:\d{2}/m.test(typed))return fresh('WhatsApp mesajları yeni kayıtlar olarak okunacak.');
 if(typed===previous?.message)return fresh('Mesaj yeniden okunacak.');
 if(manual===true&&previous&&!previous.v?._done)return {mode:'refine',pending,reason:'Önceki mesaj için düzeltme seçildi.'};
 if(!pending)return fresh('Yeni istek olarak okunacak.');
 if(manual===false)return fresh('Yeni istek seçildi.');
 if(typed.length>160)return fresh('Yeni mesaj olarak okunacak.');
 const f=fold(typed);
 const quantity=/^\d+(?:[.,]\d+)?\s*(?:sefer|saat|sa|yevmiye|ton|adet)(?:\s+(?:olacak|olsun|yap))?[.!?]?$/u.test(f)&&!!previous.v.works?.length;
 const explicit=/^(?:hayir|pardon|duzeltme)\s*[,;:]?\s+\S/u.test(f);
 const field=/^(?:musteri|arac|plaka|sofor|operator|personel|tarih|miktar|birim|fiyat|tutar|fis|tonaj|malzeme|santiye|dokum yeri)(?:si|i|yi|yu|u|nin|nu|ni)?\s*[: ]\s*\S/u.test(f);
 const row=/^(?:ilk|ikinci|ucuncu|son|\d+\.)\s+(?:is|kayit|satir|fis)(?:in|i|e|te|ta|de|da)?\s+/u.test(f);
 const correction=/(?:olacak|olsun|degil|yerine|duzelt|degistir|\byap\b)/u.test(f);
 const navigation=/(?:\bac\b|goster|listele|ekran|kart|takip|rapor|nedir|ne kadar|\bkac\b|hangi|\boku\b|incele|hesapla|hazirla|paylas|\bekle\b|olustur|\bsil\b)/u.test(f);
 const independent=/(?:yapildi|calisti|tasindi|alindi|aldim|aldik|yaptik|yaptim|odendi|verdim|yatirdim|yuklendi|indirildi|goturuldu)/u.test(f)||(!correction&&!row&&/^(?:musteri|arac|sofor|operator|personel)\s.+\d+(?:[.,]\d+)?\s*(?:sefer|saat|yevmiye|ton|litre|lt)\b/u.test(f));
 const rowField=/\b(?:musteri|arac|personel|tarih|miktar|birim|fiyat|tutar|fis|tonaj|malzeme|santiye)/u.test(f);
 if(quantity||(!navigation&&!independent&&(explicit||field||row&&(correction||rowField))))return {mode:'refine',pending,reason:'Önceki sonuçtaki '+pending+' kontrol kartı için düzeltme olarak okunacak.'};
 return fresh('Yeni istek olarak okunacak.');
}
