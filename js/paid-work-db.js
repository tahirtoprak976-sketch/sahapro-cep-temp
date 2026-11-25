import * as db from './db.js';
import {transaction} from './enterprise-db.js';
import {backupBeforeHistoryImport} from './backup.js';
import {readPaidWorkPacket,paidReviewKey,paidDigest,paidWorkPlan,PAID_REVIEW} from './paid-work-core.js';
const authority=(data,channel)=>{const a=data.meta.find(m=>m.key==='remote_approved_authority')?.value;if(!a?.enabled||a.channel!==channel)throw Error('Aktarım bağlantısı kapalı');};
const receiptKey=(channel,id)=>'remote-approved:'+channel+':'+id;
export async function stagePaidWork(value,channel,{canWrite=()=>false}={}){
 const p=readPaidWorkPacket(value),digest=await paidDigest(p),key=paidReviewKey(channel,p.id);
 return transaction(['meta'],(data,t)=>{
  if(!canWrite())throw Error('Oturum uygun değil');authority(data,channel);
  const prior=data.meta.find(m=>m.key===key)?.value;
  if(prior){if(prior.digest!==digest)throw Object.assign(Error('OP_CONFLICT: kontrol paketi değişmiş'),{code:'OP_CONFLICT'});return prior.result?{...prior.result,replayed:true}:{status:'review',id:p.id,replayed:true};}
  t.add('meta',{key,value:{packet:p,digest,channel,reviewed:false}});
  return {status:'review',id:p.id};
 });
}
export async function pendingPaidWork(){
 const consent=await db.metaGet('remote_approved_authority');if(!consent?.enabled)return [];
 return (await db.getAll('meta')).filter(m=>m.key.startsWith(PAID_REVIEW+consent.channel+':')&&!m.value.reviewed).map(m=>m.value);
}
export async function savePaidWorkReview(packetId,choice,{localApproval=false,canWrite=()=>false}={}){
 if(localApproval!==true||!canWrite())throw Error('Tahsilat kartını telefonda işaretleyip Kaydet seçin');
 const consent=await db.metaGet('remote_approved_authority');if(!consent?.enabled)throw Error('Aktarım bağlantısı kapalı');
 const key=paidReviewKey(consent.channel,packetId),entry=await db.metaGet(key);if(!entry)throw Error('Kontrol paketi bulunamadı');
 const packet=readPaidWorkPacket(entry.packet),digest=await paidDigest(packet);if(digest!==entry.digest)throw Error('Kontrol kaynağı değişmiş');
 await backupBeforeHistoryImport(db);
 return transaction(['customers','vehicles','personnel','dump_sites','work_records','cash_records','cari_movements','meta'],(data,t)=>{
  if(!canWrite())throw Error('Oturum kapandı');authority(data,consent.channel);
  const current=data.meta.find(m=>m.key===key)?.value;if(!current||current.digest!==digest)throw Error('Kontrol paketi değişmiş');
  const {writes,link,existing}=paidWorkPlan(packet,data,choice,digest);
  if(existing){if(!current.result)throw Error('Önceki işlem makbuzu eksik; inceleyin');return {...current.result,replayed:true};}
  for(const [store,rows]of Object.entries(writes))for(const row of rows)t.add(store,row);
  const result={id:packet.id,channel:consent.channel,digest,at:new Date().toISOString(),status:'saved',batch_id:crypto.randomUUID(),works:1,fuels:0,cards:writes.customers.length,collections:1,record_ids:[link.work_id,link.cash_id,link.cari_id]};
  t.put('meta',{key,value:{...current,reviewed:true,choice,result}});t.add('meta',{key:receiptKey(consent.channel,packet.id),value:result});
  return result;
 });
}
