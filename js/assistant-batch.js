// Explicit user instructions only. Quoted chat messages and model flags cannot set batch policy.
import { foldTr } from './parser.js';
import { calcTankBalance, isActive, todayStr } from './core.js';
import {assertTankChange} from './tank-timeline.js';
const fold=s=>foldTr(String(s||'')).trim().replace(/\s+/g,' ');
const CHAT=/^\s*\[?\d{1,2}[./]\d{1,2}(?:[./]\d{2,4})?[\s,\]]+\d{1,2}:\d{2}/;
const months=['ocak','subat','mart','nisan','mayis','haziran','temmuz','agustos','eylul','ekim','kasim','aralik'];
function calendar(value){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))return false;
 const d=new Date(value+'T12:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===value;
}
function exactDate(value,today){
 const s=fold(value);let y,m,d;
 if(s==='bugun')return today;
 if(s==='dun'){const dt=new Date(today+'T12:00:00Z');dt.setUTCDate(dt.getUTCDate()-1);return dt.toISOString().slice(0,10);}
 let a=/^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
 if(a)[,y,m,d]=a;
 else if((a=/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/.exec(s)))[,d,m,y]=a;
 else if((a=/^(\d{1,2})\s+([a-z]+)\s+(\d{4})$/.exec(s))){d=a[1];m=months.indexOf(a[2])+1;y=a[3];}
 if(!y||!m||!d)return null;
 const iso=`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
 return calendar(iso)&&iso<=today&&Number(y)>=1900?iso:null;
}
export function readBatchPolicy(message,today=todayStr()){
 let result={date:null,dateIssue:null,deferPrices:false,hasPriceDirective:false,onlyDirectives:true};
 // A later explicit correction replaces the earlier directive; conflicts in one instruction ask.
 for(const segment of String(message||'').split(/\n\s*\[DÜZELTME\]\s*/u)){
  const lines=[];
  for(const line of segment.split(/\r?\n/)){if(CHAT.test(line)){result.onlyDirectives=false;break;}if(!/^\s*[>“"]/.test(line))lines.push(line);else if(line.trim())result.onlyDirectives=false;}
  const clauses=lines.join('\n').slice(0,4000).split(/[;!?\n]+|(?<!\d)\.(?!\d)/u).map(fold).filter(Boolean);
  const dates=[];let dateDirective=false;
  for(let c of clauses){
   c=c.replace(/^lutfen\s+/,'').replace(/\.$/,'');
   let recognized=false;
   if(/^(?:tum (?:islerin|isler)|butun (?:islerin|isler))?\s*fiyatlar(?:i)?\s+(?:beklesin|bekleyecek|beklemede kalsin|bos kalsin|bos birak|sonra belirlensin|sonra belirle|sonra girilecek)$/u.test(c)||/^guncel fiyat listesini uygulama$/u.test(c)){result.deferPrices=true;result.hasPriceDirective=true;recognized=true;}
   if(/^fiyatlari (?:simdi belirle|listeden uygula)$/u.test(c)){result.deferPrices=false;result.hasPriceDirective=true;recognized=true;}
   const a=/^(?:(?:butun|tum) isler(?:in)?\s+(?:tarihi\s*[:=]?\s*)?|bu islerin tarihi\s*[:=]?\s*)(.+?)\s*(?:tarihine ait|tarihli|olsun|olacak)?$/u.exec(c)||/^bunlar\s+(.+?)\s+isleri$/u.exec(c);
   if(!a){if(!recognized)result.onlyDirectives=false;continue;}
   dateDirective=true;dates.push(exactDate(a[1],today));
  }
  if(dateDirective){
   const unique=[...new Set(dates)];
   result.date=unique.length===1&&unique[0]?unique[0]:null;
   result.dateIssue=result.date?null:'Toplu iş tarihini gün, ay ve yıl olarak tek bir geçerli geçmiş tarihle belirtin; örn. 7 Eylül 2026.';
  }
 }
 return result;
}
export function bulkWorkReady(row,data){
 if(row.kind!=='work'||row.saved||row.disabled)return false;
 const blocked=['fromDriver','driver_entry_id','driverDup','unverified','rejectedSource','guessed','hinted','badQuote','badNew','vehicleGuess','dateUnsure','customerGuess','typeDoubt','pasteDup','ambiguous'];
 const reviewed=data?.ok===true||data?._workflowWasReady===true||data?._workflowCompleted===true&&!data.issues?.length;
 return !!data&&reviewed&&!blocked.some(k=>data[k])&&(data.price_pending||!data.priceInfo?.ambiguous);
}
// Only the verified SP1 decoder can supply trusted driver rows, after the model boundary.
export function untrustedWorkPlan(plan){
 if(!Array.isArray(plan?.works))return plan;
 return {...plan,works:plan.works.map(row=>({...row,from_driver:false}))};
}
export function selectedFuelBudget(movements,rows){
 const live=(movements||[]).filter(isActive),seen=new Set();
 let incoming=0,need=0;
 for(const r of rows){
  if(r.kind==='fuelout'||r.kind==='fuel'&&r.source==='Depo Tankı')need+=Number(r.liters)||0;
  if(r.kind!=='tank')continue;
  if(r.linkId){
   if(seen.has(r.linkId))return {ok:false,error:'Aynı depo girişi iki faturaya seçilmiş; tek teslimat bağlantısını kontrol edin.'};
   seen.add(r.linkId);
   const old=live.find(m=>m.id===r.linkId&&m.move_type==='GİRİŞ');
   if(!old)return {ok:false,error:'Faturanın bağlanacağı depo girişi artık kullanılamıyor; yeniden kontrol edin.'};
   incoming+=(Number(r.liters)||0)-(Number(old.liters)||0);
  }else incoming+=Number(r.liters)||0;
 }
 const current=calcTankBalance(live).remaining,have=current+incoming;
 const ok=need===0&&incoming>=0||need<=have+0.001;
 const result={ok,current,incoming,have,need,error:!ok?`Depoda kayıtlı ${Math.max(0,Math.round(have))} L var; seçili çıkışlar ${need} L. Gerçek depo girişini veya başlangıç stokunu kontrol edin. İşleri ayrı kaydetmek için yakıt kartlarının seçimini kaldırabilirsiniz.`:null};
 const stockRows=rows.filter(r=>r.kind==='tank'||r.kind==='fuelout'||r.kind==='fuel'&&r.source==='Depo Tankı');
 if(ok&&stockRows.some(r=>r.date)){
  try{let projected=[...live];
   for(const [i,r]of stockRows.entries()){
    const old=r.kind==='tank'&&r.linkId?live.find(m=>m.id===r.linkId):null,date=old?.date||r.date;
    if(date>todayStr())throw Error('Gerçek yakıt / depo tarihi gelecekte olamaz');
    const move={...(old||{}),id:old?.id||'preview:'+i,date,move_type:r.kind==='tank'?'GİRİŞ':'ÇIKIŞ',liters:Number(r.liters)};
    projected=old?projected.map(m=>m.id===old.id?move:m):[...projected,move];
   }
   assertTankChange(live,projected);
  }catch(e){result.ok=false;result.error=e.message;}
 }
 return result;
}
