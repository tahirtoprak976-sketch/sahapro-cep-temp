import * as db from './db.js';
import {transaction} from './enterprise-db.js';
import {backupBeforeHistoryImport} from './backup.js';
import {paidDigest} from './paid-work-core.js';
import {readPersonalExpensePacket,personalExpensePlan,PERSONAL_REVIEW} from './personal-expense-core.js';
const personalReviewKey=(channel,id)=>PERSONAL_REVIEW+channel+':'+id;
const authority=(data,channel)=>{const a=data.meta.find(m=>m.key==='remote_approved_authority')?.value;if(!a?.enabled||a.channel!==channel)throw Error('Aktarım bağlantısı kapalı');};
const receiptKey=(channel,id)=>'remote-approved:'+channel+':'+id;
export async function stagePersonalExpense(value,channel,{canWrite=()=>false}={}){
 const p=readPersonalExpensePacket(value),digest=await paidDigest(p),key=personalReviewKey(channel,p.id);
 return transaction(['meta','work_records'],(data,t)=>{
  if(!canWrite())throw Error('Oturum uygun değil');authority(data,channel);
  const prior=data.meta.find(m=>m.key===key)?.value;
  if(prior){if(prior.digest!==digest)throw Object.assign(Error('OP_CONFLICT: kontrol paketi değişmiş'),{code:'OP_CONFLICT'});return prior.result?{...prior.result,replayed:true}:{status:'review',id:p.id,replayed:true};}
  const work=data.work_records.find(w=>w.id===p.row.work_id&&!w.deleted_at&&w.history_source?.row_id===p.row.work_source_key);
  if(!work||!work.updated_at)throw Error('Kayıtlı iş kaynağı bulunamadı');
  t.add('meta',{key,value:{packet:p,digest,channel,work_revision:work.updated_at,reviewed:false}});
  return {status:'review',id:p.id};
 });
}
export async function pendingPersonalExpenses(){
 const consent=await db.metaGet('remote_approved_authority');if(!consent?.enabled)return [];
 return (await db.getAll('meta')).filter(m=>m.key.startsWith(PERSONAL_REVIEW+consent.channel+':')&&!m.value.reviewed).map(m=>m.value);
}
export async function savePersonalExpenseReview(packetId,choice,{localApproval=false,canWrite=()=>false}={}){
 if(localApproval!==true||!canWrite())throw Error('Gider kartını telefonda işaretleyip Kaydet seçin');
 const consent=await db.metaGet('remote_approved_authority');if(!consent?.enabled)throw Error('Aktarım bağlantısı kapalı');
 const key=personalReviewKey(consent.channel,packetId),entry=await db.metaGet(key);if(!entry)throw Error('Kontrol paketi bulunamadı');
 const packet=readPersonalExpensePacket(entry.packet),digest=await paidDigest(packet);if(digest!==entry.digest)throw Error('Kontrol kaynağı değişmiş');
 await backupBeforeHistoryImport(db);
 return transaction(['vehicles','personnel','quarries','work_records','expense_records','meta'],(data,t)=>{
  if(!canWrite())throw Error('Oturum kapandı');authority(data,consent.channel);
  const current=data.meta.find(m=>m.key===key)?.value;if(!current||current.digest!==digest)throw Error('Kontrol paketi değişmiş');
  const {writes,link,existing}=personalExpensePlan(packet,data,choice,digest,current.work_revision);
  if(existing){if(!current.result)throw Error('Önceki işlem makbuzu eksik; inceleyin');return {...current.result,replayed:true};}
  for(const [store,rows]of Object.entries(writes))for(const row of rows)t.add(store,row);
  const result={id:packet.id,channel:consent.channel,digest,at:new Date().toISOString(),status:'saved',batch_id:crypto.randomUUID(),works:0,fuels:0,cards:0,expenses:1,record_ids:[link.expense_id]};
  t.put('meta',{key,value:{...current,reviewed:true,choice,result}});t.add('meta',{key:receiptKey(consent.channel,packet.id),value:result});
  return result;
 });
}
