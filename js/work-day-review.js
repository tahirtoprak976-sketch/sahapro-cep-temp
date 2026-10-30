// Read-only day review. A matching quantity alone never proves a WhatsApp item was saved.
import {isActive,WORK_UNITS} from './core.js';
import {workReviewContext,missingCustomerWorkPrice} from './collect-core.js';
import {realDate} from './work-explorer.js';
import {recordLocalText} from './record-notes.js';
import {analyzeMessage} from './message-engine.js';
import {isChatter} from './wa-bulk-core.js';
import {foldTr} from './parser.js';

const norm=s=>foldTr(String(s||'')).replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/\s+/g,' ');
const text=s=>typeof s==='string'?s:'';
const positive=n=>['number','string'].includes(typeof n)&&Number.isFinite(Number(n))&&Number(n)>0;
const live=(d,k)=>(d[k]||[]).filter(isActive);
export const reviewStorageKey=name=>'sp_work_day_review:'+encodeURIComponent(name);
export const reviewHandoffKey=name=>'sp_work_day_handoff:'+encodeURIComponent(name);
export const dayReviewURL=date=>'#/isler/kontrol'+(date?'?date='+encodeURIComponent(date):'');
export function recordSource(r){
  return {fragment:text(r.assistant_origin?.fragment)||text(r.driver_source_note),
    message:text(r.assistant_origin?.message)||text(r.bulk_source?.raw_message)||text(r.raw_message)||text(r.driver_source_note),
    verified:r.assistant_origin?.version===1&&r.assistant_origin?.status==='matched'};
}
export function workDayModel(d,date,{q='',personnel_id='',onlyIssues=false}={}){
  if(!realDate(date))throw Error('Gerçek bir iş günü seçin.');
  const context=workReviewContext(d),names=Object.fromEntries(['customers','vehicles','personnel'].map(k=>[k,Object.fromEntries((d[k]||[]).map(r=>[r.id,r.name]))]));
  const records=[];
  for(const [kind,store]of [['work','work_records'],['fuel','fuel_records'],['pending','pending_fuel_records']])for(const r of live(d,store).filter(r=>r.date===date&&(kind!=='pending'||r.reconciliation_status==='pending'))){
    const issues=[];
    if(!r.vehicle_id)issues.push('Araç belirtilmemiş');
    if(!r.personnel_id)issues.push('Personel belirtilmemiş');
    if(kind!=='work'&&!positive(r.liters))issues.push('Litre bilgisi kontrol edilmeli');
    if(kind==='work'){
      if(!r.customer_id)issues.push('Müşteri seçilmemiş');
      if(!r.work_type)issues.push('İş türü belirtilmemiş');
      if(!positive(r.quantity)||!WORK_UNITS.includes(r.unit))issues.push('Miktar / birim kontrolü');
    }
    const priceWaiting=kind==='work'&&!!r.customer_id&&!context.internal.has(r.customer_id)&&missingCustomerWorkPrice(r,context.billed.has(r.id));
    records.push({kind,store,record:r,issues,priceWaiting,note:recordLocalText(r,d,kind==='work'?'work':'fuel'),source:recordSource(r)});
  }
  const used=new Set(records.map(x=>x.record.personnel_id).filter(Boolean)),groups=new Map();
  const search=norm(q);
  for(const row of records){
    const r=row.record;
    if(personnel_id&&r.personnel_id!==personnel_id||onlyIssues&&!row.issues.length&&!row.priceWaiting&&row.kind!=='pending')continue;
    if(search&&!norm([names.customers[r.customer_id],names.vehicles[r.vehicle_id],names.personnel[r.personnel_id],r.work_type,row.note].join(' ')).includes(search))continue;
    const key=r.personnel_id||'',g=groups.get(key)||{id:key,name:names.personnel[key]|| (key?'Personel kartı listede yok':'Personel belirtilmemiş'),rows:[],units:Object.create(null),fuel:0,pendingFuel:0};
    g.rows.push(row);
    if(row.kind==='work'&&positive(r.quantity))g.units[r.unit||'Birim yok']=Math.round(((g.units[r.unit||'Birim yok']||0)+Number(r.quantity))*1e6)/1e6;
    if(row.kind==='fuel'&&positive(r.liters))g.fuel+=Number(r.liters);
    if(row.kind==='pending'&&positive(r.liters))g.pendingFuel+=Number(r.liters);
    groups.set(key,g);
  }
  return {date,names,records,groups:[...groups.values()].sort((a,b)=>(a.id===''?-1:b.id===''?1:a.name.localeCompare(b.name,'tr'))),
    noRecords:live(d,'personnel').filter(r=>r.active!==false&&!used.has(r.id)),
    counts:{work:records.filter(x=>x.kind==='work').length,fuel:records.filter(x=>x.kind==='fuel').length,pending:records.filter(x=>x.kind==='pending').length,
      missing:records.filter(x=>x.issues.length).length,price:records.filter(x=>x.priceWaiting).length}};
}
// Full and copied short WhatsApp headers. The selected year supplies a missing year;
// the message's actual day/month is retained, including messages sent the next day.
export function reviewMessages(raw,date){
  if(!realDate(date))throw Error('Gerçek bir iş günü seçin.');
  raw=text(raw);if(raw.length>20000)throw Error('En fazla 20.000 karakter karşılaştırılabilir. Mesajları daha küçük parçalar halinde yapıştırın; hiçbir satır kesilmedi.');
  const blocks=[];let current=null;
  for(const line of raw.replace(/^\uFEFF/,'').split(/\r?\n/)){
    const h=/^\s*\u200e?\[?(\d{1,2})[./-](\d{1,2})(?:[./-](\d{2,4}))?[,\s]+(\d{1,2})[:.](\d{2})(?::\d{2})?\]?\s*(?:[-–]\s*)?([^:\r\n]{1,80}):\s*(.*)$/.exec(line);
    if(h){
      const year=h[3]?(h[3].length===2?'20'+h[3]:h[3]):date.slice(0,4),day=`${year}-${h[2].padStart(2,'0')}-${h[1].padStart(2,'0')}`,time=h[4].padStart(2,'0')+':'+h[5];
      current={date:realDate(day)?day:null,sender:h[6].trim(),header:line.slice(0,line.length-h[7].length).trim(),body:h[7],key:[day,time,norm(h[6])].join('|')};blocks.push(current);
    }else if(line.trim()){
      if(!current){current={date,sender:'',header:'',body:'',key:''};blocks.push(current);}
      current.body+=(current.body?'\n':'')+line;
    }
  }
  if(blocks.length>150)throw Error('Bir karşılaştırmada en fazla 150 mesajı inceleyin; hiçbir mesaj kesilmedi.');
  return blocks.filter(b=>b.body.trim());
}
function compatible(expected,r,kind){
  if(r.date!==expected.date)return false;
  if(kind==='work'&&(r.unit!==expected.unit||Number(r.quantity)!==Number(expected.quantity)))return false;
  if(kind==='fuel'&&Number(r.liters)!==Number(expected.fuel_liters))return false;
  if(kind==='fuel'&&expected.fuel_source&&r.fuel_source&&r.fuel_source!==expected.fuel_source)return false;
  return ['customer_id','vehicle_id','site_id','personnel_id'].every(k=>!expected[k]||!r[k]&&k==='personnel_id'||r[k]===expected[k]);
}
function exactSource(block,expected,r){
  const source=recordSource(r);if(!source.verified||!source.fragment||!block.key||norm(source.fragment)!==norm(expected.description))return false;
  try{const matches=reviewMessages(source.message,expected.date).filter(b=>norm(b.body).includes(norm(source.fragment)));return matches.length===1&&matches[0].key===block.key;}catch{return false;}
}
export function compareDayMessages(d,date,raw){
  const blocks=reviewMessages(raw,date),items=[],notices=[],seen=new Set();let chatter=0;
  const indexes=Object.fromEntries(['work_records','fuel_records'].map(store=>{
    const dates=new Map(),fragments=new Map();
    for(const r of live(d,store)){
      if(!dates.has(r.date))dates.set(r.date,[]);dates.get(r.date).push(r);const s=recordSource(r);
      if(s.verified&&s.fragment){const k=norm(s.fragment);if(!fragments.has(k))fragments.set(k,[]);fragments.get(k).push(r);}
    }
    return [store,{dates,fragments}];
  }));
  for(const block of blocks){
    if(isChatter({text:block.body,files:[],omitted:false})){chatter++;continue;}
    if(!block.date){notices.push({text:'Mesaj başlığındaki tarih geçersiz; kontrol edin.',quote:block.header+' '+block.body});continue;}
    const inputKey=block.key+'|'+norm(block.body);
    if(seen.has(inputKey)){notices.push({text:'Aynı mesaj bu pakette tekrar ediyor; ikinci kez eşleştirilmedi.',quote:block.header+' '+block.body});continue;}seen.add(inputKey);
    const analysis=analyzeMessage({text:block.body,date:block.date},d);
    for(const n of analysis.notices||[])notices.push({text:n.text,quote:block.body.slice(n.span?.start||0,n.span?.end||block.body.length),block});
    if(analysis.blocking)notices.push({text:'Bu mesajda düzeltme veya çelişki var; mesajın tamamını inceleyin.',quote:block.body,block});
    for(const expected of analysis.rows||[]){
      const kind=expected.kind==='fuel'?'fuel':'work',store=kind==='fuel'?'fuel_records':'work_records',pending=kind==='fuel'?live(d,'pending_fuel_records').filter(r=>r.reconciliation_status==='pending'&&compatible(expected,r,kind)):[];
      const candidates=(indexes[store].dates.get(expected.date)||[]).filter(r=>compatible(expected,r,kind));
      const sourceRefs=(indexes[store].fragments.get(norm(expected.description))||[]).filter(r=>exactSource(block,expected,r)),exact=candidates.filter(r=>sourceRefs.some(s=>s.id===r.id));
      const complete=realDate(expected.date)&&!!expected.vehicle_id&&(kind==='fuel'?positive(expected.fuel_liters):!!expected.customer_id&&positive(expected.quantity)&&WORK_UNITS.includes(expected.unit));
      const reviewReasons=[...(expected.notes||[])];
      if(!expected.vehicle_id)reviewReasons.push('Araç tekil olarak eşleşmedi; araç adını kontrol edin.');
      if(kind==='work'&&!expected.customer_id)reviewReasons.push('Müşteri tekil olarak eşleşmedi.');
      if(!realDate(expected.date))reviewReasons.push('Gerçek iş tarihi doğrulanmalı.');
      if(kind==='fuel'?!positive(expected.fuel_liters):!positive(expected.quantity)||!WORK_UNITS.includes(expected.unit))reviewReasons.push('Miktar ve birim doğrulanmalı.');
      const uncertain=!complete||expected.inference_confirmed===false||(expected.notes||[]).length>0;
      const sourceAmbiguous=sourceRefs.length>1,sourceConflict=sourceRefs.length>0&&(!exact.length||sourceAmbiguous);
      let status=!realDate(expected.date)?'review':expected.date!==date?'other_date':uncertain||sourceConflict?'review':exact.length===1?'linked':candidates.length||pending.length?'similar':'not_found';
      items.push({kind,store,expected,block,status,sourceConflict,sourceAmbiguous,reviewReasons,candidates:sourceConflict?sourceRefs:status==='linked'?exact:candidates,pending,quote:expected.description||block.body});
    }
  }
  if(items.length>200)throw Error('Çok fazla iş/yakıt satırı bulundu; daha küçük mesaj parçalarıyla karşılaştırın.');
  // A saved record cannot account for two distinct incoming items automatically.
  const used=new Map();for(const x of items.filter(x=>x.status==='linked')){const key=x.store+':'+x.candidates[0].id;used.set(key,(used.get(key)||0)+1);}
  for(const x of items)if(x.status==='linked'&&used.get(x.store+':'+x.candidates[0].id)>1)x.status='similar';
  return {date,items,notices,chatter,unheaded:blocks.some(b=>!b.header),counts:Object.fromEntries(['linked','similar','not_found','review','other_date'].map(k=>[k,items.filter(x=>x.status===k).length]))};
}
