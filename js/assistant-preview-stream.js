// Device-only streaming of existing validation results. No prices invented or records written.
import {offlineBlocks,offlinePlan} from './offline-whatsapp.js';
import {readBatchPolicy} from './assistant-batch.js';
import {sourceProof,carrySourceProof} from './assistant-source-context.js';
import {foldTr} from './parser.js';
export function* previewPackets(text,{d,today,rules='',cancelled=()=>false}={}){
 if(typeof text!=='string'||!text.trim())return;if(text.length>500000)throw Error('Mesaj çok uzun; önizleme için bölün.');
 const blocks=offlineBlocks(text,today),policy=readBatchPolicy(text,today),directive=[policy.date?'Tüm işler '+policy.date+' olsun.':'',policy.deferPrices?'Fiyatlar beklesin.':''].filter(Boolean).join('\n');let count=0;
 for(let index=0;index<blocks.length;index++){
  if(cancelled())return;const value=offlinePlan([directive,blocks[index].raw].filter(Boolean).join('\n'),{d,today,rules});if(!value)continue;
  count+=value.works.length+value.fuel.length;if(count>100)throw Error('Bir önizlemede en fazla 100 iş/yakıt kartı hazırlanır.');
  yield {index,total:blocks.length,value};
 }
}
export function encodePreview(value){return {value,proofs:Object.fromEntries(['works','fuel'].map(group=>[group,(value[group]||[]).map(sourceProof)]))};}
export function decodePreview(packet){for(const group of ['works','fuel'])for(const[i,row]of(packet.value[group]||[]).entries())carrySourceProof(row,packet.proofs?.[group]?.[i]);return packet.value;}
const quote=r=>foldTr(String(r.source_quote||r.quote||'').replace(/^\[[^\]]+\]\s*[^:\n]+:\s*/, '')).replace(/\s+/g,' ').trim();
export function samePreviewShape(before,after){
 const extra=['expenses','collections','maintenance','personnel','edits','cards','memory','tickets','docs','tankIn','fuelOut','prices','actions','settings','partDocuments'];if(extra.some(group=>after[group]?.length)||['answer','asked','open','heard','driverPhotoWarn','driverPhotoBlocked','partDocumentUnmatched'].some(k=>after[k])||after.driverReject?.length)return false;
 for(const group of ['works','fuel']){
  const a=before[group]||[],b=after[group]||[];if(a.length!==b.length)return false;
  const matches=(x,y)=>x.length>=8&&y.length>=8&&(x===y||x.includes(y)||y.includes(x));
  const aq=a.map(quote),bq=b.map(quote);
  for(let i=0;i<a.length;i++)if(!matches(aq[i],bq[i])||bq.filter(q=>matches(aq[i],q)).length!==1||aq.filter(q=>matches(q,bq[i])).length!==1)return false;
 }
 return (before.works?.length||0)+(before.fuel?.length||0)>0;
}

// First-pass, non-financial drafts. Every control remains locked until the normal validator/model finishes.
// It intentionally declines ambiguous, payment, fuel and future-work wording.
export function quickPreview(text,{d,today,rules=''}={}){
 if(typeof text!=='string'||text.length>500000||/SP1:/.test(text))return null;
 const block=offlineBlocks(text,today)[0];if(!block||block.body.length>2000)return null;
 const norm=s=>foldTr(String(s||'')).replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/\s+/g,' '),body=norm(block.body);
 if(/\b(?:tl|lira|avans|maas|mesai|ucret|odeme|tahsilat|teklif|calisacak|yapilacak|yapacak|talep|plan|izin|rapor|mazot|motorin|benzin|akaryakit)\b/.test(body)||/₺/.test(block.body))return null;
 if(/[?？]/.test(block.body)||/\b(?:calismadi|calismadik|calismadim|yapmadi|yapilmadi|iptal|yaklasik|tahminen|veya|ila)\b/.test(body))return null;
 const quantities=[...block.body.matchAll(/(?<![\p{L}\d])(\d+(?:[.,]\d+)?)\s*(saat|sa|sefer|yevmiye|ton|m3|m³|adet)(?![\p{L}\d])/giu)];if(quantities.length!==1)return null;
 const token=quantities[0];if(/[.,+\-–]$/.test(block.body.slice(0,token.index))||/^\d{1,3}[.,]\d{3}$/.test(token[1]))return null;
 const quantity=Number(token[1].replace(',','.'));if(!(quantity>0)||!Number.isFinite(quantity))return null;
 const active=(store)=>(d?.[store]||[]).filter(r=>!r.deleted_at&&r.active!==false),aliases=active('aliases');
 const exact=(record,type,value)=>[record.name,...aliases.filter(a=>a.target_type===type&&a.target_id===record.id).map(a=>a.alias)].some(name=>norm(name)&&norm(name)===norm(value));
 const named=(store,type)=>{const compact=body.replace(/ /g,'');return active(store).filter(record=>[record.name,...aliases.filter(a=>a.target_type===type&&a.target_id===record.id).map(a=>a.alias)].some(name=>{const n=norm(name).replace(/ /g,'');return n.length>=3&&compact.includes(n);}));};
 const senders=block.sender?active('personnel').filter(p=>exact(p,'personnel',block.sender)):[],sender=senders.length===1?senders[0]:null;
 const plates=[...block.body.matchAll(/\b\d{2}\s*[a-z]{1,3}\s*\d{2,5}\b/gi)].map(m=>m[0].toUpperCase().replace(/\s/g,''));
 let vehicles=plates.length?active('vehicles').filter(v=>plates.includes(String(v.plate||'').toUpperCase().replace(/\s/g,''))):named('vehicles','vehicle'),assigned=false;
 if(!vehicles.length&&!plates.length&&sender&&!/\p{L}+\s*\d{2,5}\p{L}*/u.test(block.body)){
  vehicles=active('vehicles').filter(v=>v.id===sender.vehicle_id||v.assignee_id===sender.id);assigned=vehicles.length===1;
 }
 if(vehicles.length!==1)return null;const vehicle=vehicles[0];
 const customers=named('customers','customer'),sites=named('sites','site'),site=sites.length===1?sites[0]:null;
 let customer=customers.length===1?customers[0]:null,fromSite=false;
 if(!customer&&!customers.length&&site?.customer_id){customer=active('customers').find(c=>c.id===site.customer_id)||null;fromSite=!!customer;}
 const units={saat:'Saat',sa:'Saat',sefer:'Sefer',yevmiye:'Yevmiye',ton:'Ton',m3:'m³','m³':'m³',adet:'Adet'},unit=units[foldTr(quantities[0][2])];
 let date=block.date||'';if(!date||!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(+new Date(date+'T12:00:00Z'))||new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date||date>today||/\d{1,4}[./-]\d{1,2}/.test(block.body)||/\b(?:bugun|dun|evvelsi|pazartesi|sali|carsamba|persembe|cuma|cumartesi|pazar|ocak|subat|mart|nisan|mayis|haziran|temmuz|agustos|eylul|ekim|kasim|aralik)\b/.test(body))date='';
 const evidence=(value,level,reason)=>({value:value??null,level:value==null||value===''?'BILINMIYOR':level,reason,source:'quick_phone_preview'});
 const row={date,customer_id:customer?.id||null,site_id:site?.id||null,vehicle_id:vehicle.id,personnel_id:sender?.id||null,work_type:null,quantity,unit,description:block.body,quote:block.raw,source_quote:block.raw,issues:['Yerel ön okuma; doğrulama sürüyor.'],ok:false,okData:false,dateUnsure:true,unit_price:null,fieldConfidence:{date:evidence(date,block.inferredYear?'CIKARIM':'KESIN','Başlıktaki tarih; ayrıntılı doğrulama sürüyor'),customer_id:evidence(customer?.id,'CIKARIM',fromSite?'Tek kayıtlı şantiyenin müşterisi':'Mesajdaki kayıtlı ad; doğrulama sürüyor'),site_id:evidence(site?.id,'CIKARIM','Mesajdaki tek kayıtlı şantiye'),vehicle_id:evidence(vehicle.id,'CIKARIM',assigned?'Kayıtlı gönderenin tek aracı':'Mesajdaki tek kayıtlı araç'),personnel_id:evidence(sender?.id,'CIKARIM','Başlıktaki tek kayıtlı gönderen'),work_type:evidence(null,'BILINMIYOR','İş türü doğrulanıyor'),quantity:evidence(quantity,'KESIN','Mesajdaki birimiyle yazılan miktar'),unit:evidence(unit,'KESIN','Mesajdaki birim'),unit_price:evidence(null,'BILINMIYOR','Para alanları hızlı ön okumada doldurulmaz')}};
 const value=Object.fromEntries(['works','fuel','expenses','fuelOut','collections','maintenance','personnel','edits','cards','memory','tickets','docs','tankIn','prices','actions','settings','questions','newCustomers','photoTexts','dumpSites','_offlineNotices'].map(k=>[k,[]]));value.works=[row];value.tankStock=0;value._localOnly=true;value._stagePending=true;value._businessRulesSnapshot=rules;return value;
}
