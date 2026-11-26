import {PERSONAL_EXPENSE_FORMAT} from './personal-expense-core.js';
import {stagePersonalExpense} from './personal-expense-db.js';
import {isActionsFormat,decodeActionFiles,actionsPlan} from './remote-actions-core.js';
import {PAID_WORK_FORMAT} from './paid-work-core.js';
import {stagePaidWork} from './paid-work-db.js';
import * as db from './db.js';
import {transaction} from './enterprise-db.js';
import {backupBeforeHistoryImport} from './backup.js';
import {HISTORY_STORES} from './history-core.js';
import {approvedPlan,readApprovedPacket,REMOTE_ID} from './remote-approved-core.js';
import {stableStringify,newRecord,nowISO} from './core.js';
import {createRemoteAuthority} from './remote-approved-crypto.js';
import {putRemoteAuthority,deleteRemoteAuthority,getRemoteAuthority} from './secure-transfer-db.js';
export const REMOTE_AUTHORITY='remote_approved_authority';
export async function enableRemoteAuthority(){
 const created=await createRemoteAuthority();
 // Revocation precedes key replacement; in-flight business transactions serialize on meta.
 await db.metaSet(REMOTE_AUTHORITY,null);await putRemoteAuthority(created.authority);
 await db.metaSet(REMOTE_AUTHORITY,{channel:created.authority.channel,enabled:true,at:nowISO()});
 return created;
}
export async function disableRemoteAuthority(){await db.metaSet(REMOTE_AUTHORITY,null);await deleteRemoteAuthority();}
export async function remoteAuthority(){const [a,consent]=await Promise.all([getRemoteAuthority(),db.metaGet(REMOTE_AUTHORITY)]);return a&&consent?.enabled===true&&consent.channel===a.channel?a:null;}
export const remoteReceiptKey=(channel,id)=>'remote-approved:'+channel+':'+id;
export async function commitApprovedPacket(value,channel,{canWrite=()=>true}={}){
 if(!REMOTE_ID.test(channel)||!canWrite())throw Error('Bağlantı veya oturum uygun değil');
 const p=readApprovedPacket(value);if(p.format===PERSONAL_EXPENSE_FORMAT)return stagePersonalExpense(p,channel,{canWrite});if(p.format===PAID_WORK_FORMAT)return stagePaidWork(p,channel,{canWrite});if(isActionsFormat(p.format))return commitRemoteActions(p,channel,{canWrite});
 const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(stableStringify(p))))].map(x=>x.toString(16).padStart(2,'0')).join('');
 const receiptKey=remoteReceiptKey(channel,p.id),previous=await db.metaGet(receiptKey);
 if(previous){if(previous.digest!==digest)throw Object.assign(Error('Paket numarası farklı içerikle tekrar kullanılmış'),{code:'OP_CONFLICT'});return {...previous,replayed:true};}
 // No full backup for invalid/missing-card packets; no business writes before validation.
 const data=Object.fromEntries(await Promise.all(HISTORY_STORES.map(async s=>[s,await db.getAll(s)])));
 const preview=approvedPlan(p,data);if(!preview.plan.ready)throw Error(preview.plan.errors.join('\n')||'Paket hazır değil');
 await backupBeforeHistoryImport(db);
 return transaction([...HISTORY_STORES,'meta'],(data,t)=>{
  if(!canWrite())throw Error('Oturum kapandı veya işlem bekletiliyor');
  const consent=data.meta.find(m=>m.key===REMOTE_AUTHORITY)?.value;
  if(!consent?.enabled||consent.channel!==channel)throw Error('Uzaktan kayıt bağlantısı kapatılmış');
  const old=data.meta.find(m=>m.key===receiptKey)?.value;
  if(old){if(old.digest!==digest)throw Object.assign(Error('Paket numarası farklı içerikle tekrar kullanılmış'),{code:'OP_CONFLICT'});return {...old,replayed:true};}
  const {plan}=approvedPlan(p,data);if(!plan.ready)throw Error(plan.errors.join('\n')||'Paket hazır değil');
  const batch=newRecord().id;
  for(const [store,rows]of Object.entries(plan.writes))for(const r of rows){if(r.history_source)r.history_source.batch_id=batch;t.add(store,r);}
  const result={id:p.id,channel,digest,at:nowISO(),status:'saved',batch_id:batch,works:plan.writes.work_records.length,fuels:plan.writes.fuel_records.length,cards:plan.newCards.length,record_ids:[...plan.writes.work_records,...plan.writes.fuel_records].map(r=>r.id),...(p.approved.negative_tank_rows?{negative_tank_acknowledged:true,negative_tank_rows:[...p.approved.negative_tank_rows],stock_warning:plan.findings.some(f=>f.warnings.length>0)}:{})};
  t.put('meta',{key:receiptKey,value:result});return result;
 });
}
export async function remoteResults(){return (await db.getAll('meta')).filter(r=>r.key.startsWith('remote-approved:')&&r.value?.status==='saved').map(r=>r.value).sort((a,b)=>b.at.localeCompare(a.at)).slice(0,20);}

// Additional scope is explicit and revocable without changing the pairing secret.
export async function setRemoteActionsEnabled(enabled){
 if(typeof enabled!=='boolean')throw Error('İzin geçersiz');
 const authority=await remoteAuthority();if(!authority)throw Error('Önce bağlantıyı etkinleştirin');
 await transaction(['meta'],(data,t)=>{const consent=data.meta.find(m=>m.key===REMOTE_AUTHORITY)?.value;if(!consent?.enabled||consent.channel!==authority.channel)throw Error('Bağlantı kapatılmış');t.put('meta',{key:REMOTE_AUTHORITY,value:{...consent,actions_enabled:enabled,actions_at:nowISO()}});});
}
async function commitRemoteActions(p,channel,{canWrite}){
 const consent=await db.metaGet(REMOTE_AUTHORITY);
 if(!consent?.enabled||consent.channel!==channel||consent.actions_enabled!==true)throw Error('Belge ve mahsup aktarımı izni kapalı; aktarım ekranından açın');
 const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(stableStringify(p))))].map(x=>x.toString(16).padStart(2,'0')).join('');
 const receiptKey=remoteReceiptKey(channel,p.id),previous=await db.metaGet(receiptKey);
 if(previous){if(previous.digest!==digest)throw Object.assign(Error('Paket numarası farklı içerikle tekrar kullanılmış'),{code:'OP_CONFLICT'});return {...previous,replayed:true};}
 const files=await decodeActionFiles(p),stores=['customers','vehicles','personnel','work_records','cari_movements','documents','attachments','fuel_records','pending_fuel_records','meta'];
 const snapshot=Object.fromEntries(await Promise.all(stores.map(async s=>[s,await db.getAll(s)])));actionsPlan(p,snapshot,files);
 await backupBeforeHistoryImport(db);
 return transaction(stores,(data,t)=>{
  if(!canWrite())throw Error('Oturum kapandı veya işlem bekletiliyor');
  const consent=data.meta.find(m=>m.key===REMOTE_AUTHORITY)?.value;if(!consent?.enabled||consent.channel!==channel||consent.actions_enabled!==true)throw Error('Belge ve mahsup izni kapatılmış');
  const old=data.meta.find(m=>m.key===receiptKey)?.value;if(old){if(old.digest!==digest)throw Object.assign(Error('Paket numarası farklı içerikle tekrar kullanılmış'),{code:'OP_CONFLICT'});return {...old,replayed:true};}
  const {writes,repeated}=actionsPlan(p,data,files);for(const [store,rows]of Object.entries(writes))for(const row of rows)t.add(store,row);
  const result={id:p.id,channel,digest,at:nowISO(),status:'saved',batch_id:newRecord().id,works:0,fuels:writes.fuel_records?.length||0,cards:0,offsets:writes.cari_movements.length,documents:writes.documents.length,attachments:writes.attachments.length,repeated_actions:repeated,record_ids:[...writes.cari_movements,...writes.documents,...(writes.fuel_records||[])].map(x=>x.id)};
  t.put('meta',{key:receiptKey,value:result});return result;
 });
}
