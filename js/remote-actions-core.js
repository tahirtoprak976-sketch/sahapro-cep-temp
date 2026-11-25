import {offsetFromFuelLink,paidFuelPlanRow,paidFuelKey,assertPaidFuelPair} from './customer-paid-fuel.js';
import {prepareAttachment,safeAttachmentName} from './attachment-safety.js';
// Explicitly approved, additive actions. Never cash, stock, or edits to existing work.
import {newRecord,isActive,normKey,toKurus,fromKurus,stableStringify} from './core.js';
import {validHistoryDate} from './history-core.js';
export const ACTION_FORMAT='SAHAPRO_REMOTE_ACTIONS_V1';
export const ACTION_FORMAT_V2='SAHAPRO_REMOTE_ACTIONS_V2';
export const isActionsFormat=f=>[ACTION_FORMAT,ACTION_FORMAT_V2].includes(f);
const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const text=(s,max=200)=>typeof s==='string'&&s.trim()===s&&s.length>0&&s.length<=max;
const fail=m=>{throw Error(m);};
const iso=s=>typeof s==='string'&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString()===s;
export function readActionsPacket(p,{now=Date.now()}={}){
 const v2=p?.format===ACTION_FORMAT_V2;
 if(!exact(p,['format','id','approved','offsets','documents',...(v2?['fuel_links']:[])])||!isActionsFormat(p.format)||!ID.test(p.id))fail('Belge/mahsup paket biçimi geçersiz');
 const a=p.approved;
 if(!exact(a,['confirmed','at','summary'])||a.confirmed!==true||!iso(a.at)||Date.parse(a.at)>now+300000||now-Date.parse(a.at)>7*86400000||!text(a.summary,2000))fail('Belge/mahsup için açık güncel sohbet onayı gerekli');
 if(v2&&(!Array.isArray(p.fuel_links)||p.fuel_links.length>10))fail('Yakıt bağlantısı listesi geçersiz');
 if(!Array.isArray(p.offsets)||!Array.isArray(p.documents)||p.offsets.length>10||p.documents.length>10||p.offsets.length+p.documents.length+(p.fuel_links?.length||0)===0)fail('En fazla 10 mahsup ve 10 belge');
 const seen=new Set();let bytes=0;
 for(const r of [...p.offsets,...p.documents,...(p.fuel_links||[])]){if(!text(r.source_key,120)||seen.has(r.source_key)||!validHistoryDate(r.date,new Date(now).toISOString().slice(0,10)))fail('Kaynak kimliği veya gerçek geçmiş tarih geçersiz');seen.add(r.source_key);}
 for(const item of [...p.offsets,...(p.fuel_links||[])]){
 const isLink=(p.fuel_links||[]).includes(item);if(isLink&&(!text(item.offset_source_key,120)||item.source_key===item.offset_source_key))fail('Bağlanacak mahsup kaynağı geçersiz');
 const r=isLink?offsetFromFuelLink(item):item;
  if(!exact(r,['source_key','date','customer','vehicle','personnel','liters','unit_price','amount','reason','price_basis','price_source'])||!text(r.customer)||!text(r.vehicle)||!text(r.personnel)||!text(r.reason,2000)||!['receipt','reference'].includes(r.price_basis)||!text(r.price_source,1000))fail('Mahsup alanları eksik/geçersiz');
  if([r.liters,r.unit_price,r.amount].some(v=>typeof v!=='number'||!Number.isFinite(v)||v<=0)||!Number.isSafeInteger(Math.round(r.liters*r.unit_price*100))||toKurus(r.amount)!==Math.round(r.liters*r.unit_price*100)||r.amount!==fromKurus(toKurus(r.amount)))fail('Mahsup tutarı litre × doğrulanmış fiyat ile uyuşmalı');
 }
 for(const r of p.documents){
  if(!exact(r,['source_key','date','category','doc_no','owner_source_key','name','mime','base64','sha256'])||r.category!=='İrsaliye'||!text(r.doc_no)||!text(r.owner_source_key,120)||!text(r.name)||!['image/jpeg','image/png','image/webp','application/pdf'].includes(r.mime)||typeof r.base64!=='string'||r.base64.length>2100000||!/^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(r.base64)||!r.base64||!/^([a-f0-9]{64})$/.test(r.sha256))fail('İrsaliye dosya alanları geçersiz');
  bytes+=r.base64.length;if(bytes>2100000)fail('Dosyalar tek pakette çok büyük; ayrı paketleyin');
 }
 return structuredClone(p);
}
export async function decodeActionFiles(p){
 const out=new Map();out.signatures=new Map();out.offsetSignatures=new Map();
 for(const r of [...p.offsets,...p.documents,...(p.fuel_links||[])]){const bytes=new TextEncoder().encode(stableStringify(r));out.signatures.set(r.source_key,[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join(''));}
 for(const r of p.fuel_links||[]){const bytes=new TextEncoder().encode(stableStringify(offsetFromFuelLink(r)));out.offsetSignatures.set(r.source_key,[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join(''));}
 for(const d of p.documents){const b=Uint8Array.from(atob(d.base64),c=>c.charCodeAt(0));
  const starts=(a)=>a.every((x,i)=>b[i]===x);
  if(!(d.mime==='image/jpeg'&&starts([255,216,255])||d.mime==='image/png'&&starts([137,80,78,71,13,10,26,10])||d.mime==='application/pdf'&&starts([37,80,68,70,45])||d.mime==='image/webp'&&starts([82,73,70,70])&&String.fromCharCode(...b.slice(8,12))==='WEBP'))fail('Dosyanın türü içeriğiyle uyuşmuyor');
  const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',b))].map(x=>x.toString(16).padStart(2,'0')).join('');if(hash!==d.sha256)fail('Dosya özeti uyuşmuyor');out.set(d.source_key,await prepareAttachment(new Blob([b],{type:d.mime}),{maxBytes:1600000}));
 }
 return out;
}
export const actionSourceKey=s=>'remote-action-source:'+s;
const unique=(data,store,label)=>{const rows=(data[store]||[]).filter(x=>isActive(x)&&normKey(x.name)===normKey(label));if(rows.length!==1)fail('Mevcut kart tek olarak eşleşmeli: '+label);return rows[0];};
export function actionsPlan(p,data,files){
 const writes={cari_movements:[],documents:[],attachments:[],meta:[]};if(p.format===ACTION_FORMAT_V2)writes.fuel_records=[];let repeated=0;
 for(const r of [...p.offsets,...p.documents,...(p.fuel_links||[])]){
  const old=(data.meta||[]).find(x=>x.key===actionSourceKey(r.source_key));
  const signature=files.signatures?.get(r.source_key);if(!signature)fail('Doğrulanmış kaynak özeti yok');
  if(old){if(old.value.signature!==signature)fail('OP_CONFLICT: kaynak daha önce farklı içerikle kaydedilmiş');const store=old.value.store,record=(data[store]||[]).find(x=>x.id===old.value.id&&isActive(x));if(!record)fail('Önceki işlem silinmiş veya eksik; yeniden oluşturulmaz');if(store==='fuel_records'){const link=(data.meta||[]).find(x=>x.key===paidFuelKey(r.offset_source_key));if(!link)fail('Yakıtın mahsup bağlantısı eksik');assertPaidFuelPair(data,link.value);}
 if(store==='documents'&&!(data.attachments||[]).some(a=>a.record_type==='document'&&a.record_id===record.id&&a.src_sha256===r.sha256&&a.blob?.size))fail('Önceki belgenin dosyası eksik');repeated++;continue;}
  let record,store;
  if((p.fuel_links||[]).includes(r)){
   const result=paidFuelPlanRow(r,{...data,cari_movements:[...(data.cari_movements||[]),...writes.cari_movements],fuel_records:[...(data.fuel_records||[]),...(writes.fuel_records||[])],meta:[...(data.meta||[]),...writes.meta]},files.offsetSignatures?.get(r.source_key));
   store='fuel_records';if(result.existing){writes.meta.push({key:actionSourceKey(r.source_key),value:{signature,store,id:result.existing.id}});repeated++;continue;}
   record=result.fuel;writes.meta.push(result.meta);
  }else if(p.offsets.includes(r)){
   const customer=unique(data,'customers',r.customer),vehicle=unique(data,'vehicles',r.vehicle),person=unique(data,'personnel',r.personnel);
   store='cari_movements';record=newRecord({date:r.date,customer_id:customer.id,type:'Duzeltme',amount:-fromKurus(toKurus(r.amount)),reason:r.reason+' · '+r.liters+' L × '+r.unit_price+' TL · '+vehicle.name+' · '+person.name+' · '+(r.price_basis==='reference'?'Tarihli pompa referansı; fiş bedeli değildir':'Fiş bedeli')+' · '+r.price_source});
  }else{
   const owners=(data.work_records||[]).filter(w=>isActive(w)&&w.history_source?.row_id===r.owner_source_key);if(owners.length!==1)fail('İrsaliyenin bağlanacağı kayıtlı iş tek olarak bulunamadı: '+r.owner_source_key);const owner=owners[0];
   const key=s=>normKey(s).replace(/[^a-z0-9çğıöşü]/g,'');const dup=[...(data.documents||[]),...writes.documents].filter(x=>isActive(x)&&x.category===r.category&&key(x.doc_no)===key(r.doc_no));if(dup.length)fail('İrsaliye numarası zaten kayıtlı; mevcut belgeyi inceleyin: '+r.doc_no);
   if([...(data.attachments||[]),...writes.attachments].some(a=>a.src_sha256===r.sha256))fail('Bu dosya zaten kayıtlı; mevcut belgeyi inceleyin');
   if(!(files.get(r.source_key) instanceof Blob))fail('Doğrulanmış dosya yok');
   store='documents';record=newRecord({category:'İrsaliye',date:r.date,doc_no:r.doc_no,owner_type:'work',owner_id:owner.id,vehicle_id:null,personnel_id:null,customer_id:null,site_id:null});
   writes.attachments.push({id:crypto.randomUUID(),record_type:'document',record_id:record.id,name:safeAttachmentName(r.name,r.mime),type:r.mime,size:files.get(r.source_key).size,blob:files.get(r.source_key),src_sha256:r.sha256,derived_of:null,kind:'scan_original',created_at:new Date().toISOString()});
  }
  writes[store].push(record);writes.meta.push({key:actionSourceKey(r.source_key),value:{signature,store,id:record.id}});
 }
 return {writes,repeated};
}
