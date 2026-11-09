// Offline review adapter. Existing evidence/validation engines stay unchanged.
import {validatePlan,validateExtras} from './assistant-core.js';
import {analyzeMessage} from './message-engine.js';
import {foldTr} from './parser.js';
import {senderPersonnel} from './assistant-rules.js';
import {validDate} from './driver-delivery.js';
import {addDays} from './core.js';
import {confidenceReady} from './assistant-confidence.js';
import {readBatchPolicy} from './assistant-batch.js';
const norm=s=>foldTr(String(s||'')).replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const groups=['works','fuel','expenses','fuelOut','collections','maintenance','personnel','edits','cards','memory','tickets','docs','tankIn','prices','actions','settings','questions'];
function header(line,today){
 let m=/^\[(\d{1,2})[/.](\d{1,2})(?:[/. ](\d{2,4}))?(?:[, ]+(\d{1,2}:\d{2})(?::\d{2})?)?\]\s*([^:]+):\s*(.*)$/u.exec(line);
 if(!m){const t=/^\[?(\d{1,2}:\d{2})[, ]+(\d{1,2})[/.](\d{1,2})[/.](\d{2,4})\]?\s*([^:]+):\s*(.*)$/u.exec(line);if(t)m=[t[0],t[2],t[3],t[4],t[1],t[5],t[6]];}
 if(!m){const t=/^(\d{1,2})[/.](\d{1,2})(?:[/. ](\d{2,4}))?[, ]+(\d{1,2}:\d{2})(?::\d{2})?\s*[-–]\s*([^:]+):\s*(.*)$/u.exec(line);if(t)m=t;}
 if(!m){const bare=/^([^:\d]{2,80}):\s*(.*)$/u.exec(line);if(bare&&!/^(?:musteri|arac|tarih|not|is|toplam|personel|santiye|fis|fiyat|kdv|mazot|yakit)$/.test(norm(bare[1])))return {sender:bare[1].trim(),date:null,inferredYear:false,canonical:`[${today.slice(8)}/${today.slice(5,7)}/${today.slice(0,4)} 00:00] ${bare[1].trim()}: ${bare[2]}`,body:bare[2]};return null;}
 const year=m[3]?(m[3].length===2?'20'+m[3]:m[3]):today.slice(0,4),day=m[1].padStart(2,'0'),month=m[2].padStart(2,'0');
 return {sender:m[5].trim(),date:`${year}-${month}-${day}`,inferredYear:!m[3],canonical:`[${day}/${month}/${year} ${m[4]||'00:00'}] ${m[5].trim()}: ${m[6]}`,body:m[6]};
}
export function offlineBlocks(raw,today){
 const blocks=[];let current=null;
 for(const line of String(raw||'').split(/\r?\n/)){
  const h=header(line.trim(),today);
  if(h){current={...h,raw:line,canonical:h.canonical};blocks.push(current);}
  else if(current){current.raw+='\n'+line;current.canonical+='\n'+line;current.body+='\n'+line;}
  else if(line.trim()){current={raw:line,canonical:line,body:line,sender:null,date:null,inferredYear:false};blocks.push(current);}
 }
 return blocks;
}
const empty=()=>({works:[],fuel:[]});
const allRows=v=>[...v.works.map(r=>({kind:'work',r})),...v.fuel.map(r=>({kind:'fuel',r}))];
const quoted=r=>norm(String(r.source_quote||r.raw_message||r.description||'').replace(/^\[[^\]]+\]\s*[^:]+:\s*/,''));
const months=['ocak','subat','mart','nisan','mayis','haziran','temmuz','agustos','eylul','ekim','kasim','aralik'];
const days=['pazar','pazartesi','sali','carsamba','persembe','cuma','cumartesi'];
const iso=(y,m,d)=>`${String(y).padStart(4,'0')}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
function datesInLine(text,anchor,today){
 const found=[];let bad=false;
 const add=(y,m,d,explicit)=>{const value=iso(y,m,d);if(!validDate(value))bad=true;else found.push({date:value,level:explicit?'KESIN':'CIKARIM',reason:explicit?'Satırdaki açık iş tarihi':'Yıl mesaj bağlamından alındı'});};
 for(const m of text.matchAll(/(?<!\d)(\d{4})-(\d{2})-(\d{2})(?!\d)/g))add(m[1],m[2],m[3],true);
 for(const m of text.matchAll(/(?<!\d)(\d{1,2})([./])(\d{1,2})(?:[./ ]+(\d{2,4}))?(?!\d)/g)){
  if(!m[4]&&/^\s*(?:saat|sefer|lt|litre|ton|m3|yevmiye)\b/i.test(text.slice(m.index+m[0].length)))continue;
  if(!m[4]&&m[2]==='.'&&text.slice(0,m.index).trim()&&!/tarih|g[üu]n[üu]/i.test(text))continue;
  const year=m[4]?(m[4].length===2?'20'+m[4]:m[4]):(anchor||today).slice(0,4);add(year,m[3],m[1],!!m[4]);
 }
 const n=foldTr(text);
 for(const m of n.matchAll(/(?<!\d)(\d{1,2})\s*(ocak|subat|mart|nisan|mayis|haziran|temmuz|agustos|eylul|ekim|kasim|aralik)(?:\s+(\d{4}))?\b/g))add(m[3]||(anchor||today).slice(0,4),months.indexOf(m[2])+1,m[1],!!m[3]);
 const relative=/\b(?:evvelsi gun|onceki gun|dun|bugun)\b/.exec(n);
 if(relative&&!found.length&&!bad){if(anchor===false)bad=true;else found.push({date:addDays(anchor||today,/evvelsi|onceki/.test(relative[0])?-2:relative[0]==='dun'?-1:0),level:anchor?'KESIN':'CIKARIM',reason:anchor?'Göreli gün mesaj başlığına göre':'Göreli gün bugüne göre hesaplandı'});}
 const distinct=[...new Set(found.map(x=>x.date))];
 if(bad||distinct.length>1)return {date:null,level:'BILINMIYOR',reason:bad?'Mesajdaki tarih takvimde geçersiz':'Aynı satırdaki tarihler çelişiyor',conflict:true};
 const date=found[0];if(!date)return null;
 // A wage note such as Sunday pay does not assert a different work date.
 const weekday=days.filter(day=>new RegExp('\\b'+day+'\\b(?!\\s+(?:mesai|ucret|maas))').test(n));
 if(weekday.some(day=>days.indexOf(day)!==new Date(date.date+'T12:00:00Z').getUTCDay()))return {...date,level:'BILINMIYOR',reason:'Gün adı ile tarih uyuşmuyor; iş tarihini doğrulayın',conflict:true};
 return date;
}
function lineContexts(block,today){
 const anchor=block.date?(validDate(block.date)?block.date:false):null;
 let current=block.date?(anchor?{date:block.date,level:block.inferredYear?'CIKARIM':'KESIN',reason:block.inferredYear?'Başlıkta yıl yok; güncel yıl kullanıldı':'WhatsApp başlığındaki tarih'}:{date:null,level:'BILINMIYOR',reason:'Başlıktaki tarih geçersiz',conflict:true}):{date:today,level:'BILINMIYOR',reason:'İş tarihi mesajda yok; tarihi doğrulayın'};
 return block.body.split(/\r?\n/).map(text=>{const found=datesInLine(text,anchor,today);if(found)current=found;return {text,...current};});
}
function contextFor(row,block,contexts){
 const q=quoted(row);const candidates=contexts.filter(x=>{const t=norm(x.text);return t&&q&&(t.includes(q)||q.includes(t));});
 return candidates.find(x=>x.date===row.date)||candidates[0]||contexts[0];
}
export function offlinePlan(raw,{d,today,rules=''}){
 if(typeof raw!=='string'||!raw.trim())return null;
 if(raw.length>500000)throw Error('Mesaj çok uzun; daha küçük parçalar halinde ayrıştırın.');
 const result=validatePlan(empty(),{d,message:'',today,rules});Object.assign(result,validateExtras({},{d,message:'',today,rules}));
 for(const group of groups)result[group]=[];
 result.newCustomers=[];result._localOnly=true;result._businessRulesSnapshot=rules;result.rawCount=null;result._offlineNotices=[];
 const policy=readBatchPolicy(raw,today);
 const directive=[policy.date?`Tüm işler ${policy.date} olsun.`:'',policy.deferPrices?'Fiyatlar beklesin.':''].filter(Boolean).join('\n');
 for(const block of offlineBlocks(raw,today)){
  const contexts=lineContexts(block,today);
  const opts={d,message:[directive,block.canonical].filter(Boolean).join('\n'),today,rules};
  const primary=validatePlan(empty(),opts),rows=allRows(primary);
  const local=analyzeMessage({id:'offline',text:block.canonical,date:today},d);
  for(const n of local.notices||[])if(n.type==='payment_notice')result._offlineNotices.push('Ödeme notu iş veya tahsilat kaydı yapılmadı. Para hareketini ilgili ekrandan girin.');
  for(const row of local.rows||[]){
   if(!['work','fuel'].includes(row.kind))continue;
   const q=quoted(row);if(rows.some(x=>x.kind===row.kind&&(quoted(x.r).includes(q)||q.includes(quoted(x.r)))))continue;
   // A recognized sender's dedicated source reader owns shared context. The
   // evidence-led reader supplies additional/unknown-sender lines only.
   const text=row.raw_message||row.description||block.canonical;
   const fieldDate=contextFor(row,block,contexts);
   const rowDate=policy.date||fieldDate?.date||row.date;
   const plan=row.kind==='fuel'?{works:[],fuel:[{date:rowDate,vehicle_id:row.vehicle_id,personnel_id:row.personnel_id,customer_id:row.customer_id,liters:row.fuel_liters,source:row.fuel_source,quote:text}]}:{works:[{...row,date:rowDate,quote:text,date_source:fieldDate?.level!=='BILINMIYOR'?'mesaj':'yok'}],fuel:[]};
   const single=validatePlan(plan,{...opts,message:[directive,text].filter(Boolean).join('\n')});rows.push(...allRows(single));
  }
  const knownSender=block.sender&&senderPersonnel(d,block.sender,block.raw);
  for(const {kind,r} of rows){
   r.issues??=[];r.raw_message=block.raw;
   if(knownSender&&!r.personnel_id){r.personnel_id=knownSender.id;r.fieldConfidence.personnel_id={value:knownSender.id,level:'KESIN',reason:'Kayıtlı gönderen veya onaylı kişi diğer adı',source:'offline_sender'};r.issues=r.issues.filter(x=>!/^Personel .*mesajda yazmıyor/.test(x));}
   const scope=r.source_quote||block.body,n=norm(scope);
   if(/\b(?:teklif|yapilacak|planlandi)\b/.test(n)&&!/\b(?:yapti|yapildi|calisti|tamamlandi)\b/.test(n)){result._offlineNotices.push('Teklif veya iş planı, yapılmış iş / alınmış para olarak kaydedilmedi.');continue;}
   const field=policy.date?{date:policy.date,level:'KESIN',reason:'Mesajdaki açık toplu iş tarihi'}:policy.dateIssue?{date:r.date,level:'BILINMIYOR',reason:policy.dateIssue,conflict:true}:contextFor(r,block,contexts);
   if(field?.level==='BILINMIYOR'||!field?.date||!validDate(field.date)||field.date>today){
    if(field?.date==null&&field?.conflict)r.date='';
    r.ok=false;r.okData=false;r.dateUnsure=true;
    r.fieldConfidence.date={value:r.date,level:'BILINMIYOR',reason:field?.reason||'İş tarihini doğrulayın',source:'offline_date',...(field?.conflict?{conflict:true}:{})};r.issues.push(field?.reason||'İş tarihini doğrulayın');
   }else if(!r.calendarConflict){
    r.date=field.date;r.dateUnsure=false;r.dateConflict=false;
    r.fieldConfidence.date={...field,value:field.date,source:'offline_date'};
    r.issues=r.issues.filter(x=>!/^Önerilen tarih mesaj\/fiş tarihiyle|^Önerilen tarih mesaj\/fiş ile/.test(x));
    r.ok=!!r.okData&&confidenceReady(r,kind)&&!r.needsApproval&&(r.price_pending||!r.priceInfo?.ambiguous);
    if(field.level!=='KESIN'&&r.priceInfo?.candidates?.some(p=>p.valid_from||p.valid_to)){r.ok=false;r.okData=false;r.dateUnsure=true;r.fieldConfidence.date={value:r.date,level:'BILINMIYOR',reason:'Tarih sınırlı fiyat için yılı doğrulayın',source:'offline_price_date'};r.issues.push('Tarih sınırlı fiyat için iş yılını doğrulayın.');}
   }
   if(kind==='fuel'&&/\b(?:depoya|tanka|musteriye|musterinin|biz verdik)\b/.test(norm(r.source_quote||block.body))){result._offlineNotices.push('Depo girişi veya müşteriye mazot teslimi yakıt tüketimi olarak yazılmadı; ilgili depo / müşteri mazot ekranında inceleyin.');continue;}
   if(!knownSender&&block.sender)r.offlineSenderNote='Gönderen kayıtlı değil; zimmetli araç varsayılmadı.';
   result[kind==='work'?'works':'fuel'].push(r);
  }
  result.newCustomers.push(...primary.newCustomers||[]);
 }
 if(result.works.length+result.fuel.length>100)throw Error('Bir okumada en fazla 100 iş / yakıt kartı açılır; mesajı bölerek devam edin.');
 if(/SP1:[A-Za-z0-9_-]+/.test(raw)){
  result.driverSecWarn=['İmzalı şoför kodu bu ekranda doğrulanmadı; güvenli asistan ekranından kontrol edin.'];
  for(const {r} of allRows(result)){r.ok=false;r.okData=false;r.rejectedSource=true;r.unverified=true;r.issues.push(result.driverSecWarn[0]);}
 }
 result.newCustomers=[...new Set(result.newCustomers)];result._offlineNotices=[...new Set(result._offlineNotices)];
 result._bulkRaw={works:[],fuel:[]};
 return result;
}
