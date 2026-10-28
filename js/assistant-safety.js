// Reject incomplete batches before rendering. Never silently discard business rows.
import {foldTr} from './parser.js';
export const PLAN_LIMITS={works:20,expenses:10,fuel:10,customer_fuel:10,tank_in:5,collections:10,maintenance:10,personnel:10,edits:10,memory:10,price_rules:5,tickets:20,documents:10,actions:10,settings:8,part_documents:20,photo_texts:20,questions:5};
const object=x=>!!x&&typeof x==='object'&&!Array.isArray(x);
export function assertAssistantPlan(plan){
 if(!object(plan))throw Error('Asistan geçerli bir işlem planı döndürmedi. Mesaj ve dosyalar korunuyor.');
 for(const [group,limit] of Object.entries(PLAN_LIMITS)){
  const rows=plan[group];if(rows==null)continue;
  if(!Array.isArray(rows))throw Error('Asistanın '+group+' listesi geçersiz; hiçbir satır kaydedilmedi.');
  if(rows.length>limit)throw Error('Bir seferde en fazla '+limit+' '+({works:'iş',fuel:'yakıt'}[group]||group)+' satırı kontrol edilebilir. Hiçbir satır kaydedilmedi; mesajı daha küçük gruplara bölün.');
  const texts=['questions','photo_texts'].includes(group);
  if(rows.some(x=>texts?typeof x!=='string':!object(x)))throw Error('Asistanın '+group+' satırı eksik veya bozuk; hiçbir satır kaydedilmedi.');
 }
 if(plan.cards!=null){
  if(!object(plan.cards))throw Error('Yeni kart listesi geçersiz.');
  for(const rows of Object.values(plan.cards))if(!Array.isArray(rows)||rows.length>200||rows.some(x=>!object(x)))throw Error('Yeni kart listesi eksik veya çok büyük; mesajı bölün.');
 }
 return plan;
}
const norm=s=>foldTr(String(s||'')).replace(/[^\p{L}\p{N}]+/gu,' ').trim();
export function rowEvidence(row,{message='',photoTexts=[],photoCount=photoTexts.length,implicitPhoto=null}={}){
 const quote=String(row.quote||'').trim(),q=norm(quote),source=norm(message);
 const quoted=!!q&&q.length>=2&&(' '+source+' ').includes(' '+q+' ');
 const explicit=row.photo!=null&&row.photo!=='';
 const photo=explicit&&Number.isInteger(row.photo)&&row.photo>=0&&row.photo<photoCount?row.photo:!explicit?implicitPhoto:null;
 const issues=[];
 if(quote&&!quoted)issues.push('Kaynak alıntı bu mesajda bulunamadı; satırı kontrol edin.');
 if(explicit&&photo===null)issues.push('Belgenin fotoğraf sırası geçersiz; doğru eki yeniden seçin.');
 if(photoCount>1&&photo===null)issues.push('Bu satırın hangi fotoğrafa ait olduğunu doğrulayamadım; kontrol edin.');
 return {photo,message:quoted?quote:quote?'':message,text:photo===null?'':String(photoTexts[photo]||''),issues};
}
