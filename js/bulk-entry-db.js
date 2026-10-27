import {withRecordSource} from './record-notes.js';
import * as db from './db.js';
import {uuid,newRecord,nowISO} from './core.js';
import {backupBeforeSoloOperation} from './backup.js';
import {recordsCommitted} from './record-refresh.js';
import {BULK_STORES,finalizeBulk,bulkSelectionToken,bulkSourceKey,bulkInputSignature} from './bulk-entry-core.js';

export const BULK_KEY='assistant_bulk_v1';
const CHAT='assistant_conversation_v1';
const stale=()=>Object.assign(Error('Toplu taslak, kartlar veya stok başka ekranda değişti. Önizlemeyi yenileyip tekrar kontrol edin.'),{code:'BULK_STALE'});
async function sources(draft){return Object.fromEntries(await Promise.all(draft.rows.map(r=>bulkSourceKey(r,draft.answers)).filter(Boolean).map(async key=>[key,'bulk:'+await db.opHash(key)])));}
export async function readBulkDraft(){
 const [draft,chat]=await Promise.all([db.metaGet(BULK_KEY),db.metaGet(CHAT)]);
 return draft?.version===1&&draft.chat_id===chat?.id&&draft.status==='open'?draft:null;
}
export async function saveBulkDraft(draft,{create=false}={}){
 if(!draft||draft.version!==1||JSON.stringify(draft).length>250000)throw Error('Toplu taslak geçersiz veya çok büyük. Mesajı bölün.');
 return db.metaTxn([BULK_KEY,CHAT],values=>{
  const old=values[BULK_KEY];
  if(values[CHAT]?.id!==draft.chat_id)throw stale();
  if(create?old?.status==='open'&&old.chat_id===draft.chat_id:old?.id!==draft.id||old.rev!==draft.rev)throw stale();
  const next={...draft,rev:create?1:draft.rev+1,updated_at:nowISO()};return {set:{[BULK_KEY]:next},result:next};
 });
}
export async function closeBulkDraft(draft){return saveBulkDraft({...draft,status:'closed'});}
export async function loadBulkData(draft){
 const ids=await sources(draft),connection=await db.openDB();
 // One coherent snapshot of only the tables needed for this review, not the
 // entire ERP (documents, attachments, maintenance, payroll, etc.).
 return new Promise((resolve,reject)=>{
  const t=connection.transaction([...BULK_STORES,'meta'],'readonly'),data={bulk_receipts:{}};
  for(const store of BULK_STORES){const q=t.objectStore(store).getAll();q.onsuccess=()=>{data[store]=q.result;};}
  for(const [key,id]of Object.entries(ids)){const q=t.objectStore('meta').get(db.OP+id);q.onsuccess=()=>{data.bulk_receipts[key]=q.result?.value;};}
  t.oncomplete=()=>resolve(data);t.onerror=t.onabort=e=>reject(t.error||e?.target?.error||Error('Toplu önizleme okunamadı.'));
 });
}
export async function commitBulk(draft,previewToken){
 draft=structuredClone(draft);
 const before=await loadBulkData(draft),preview=finalizeBulk(draft,before);
 if(bulkSelectionToken(preview)!==previewToken)throw stale();
 if(!preview.writes.length)throw Error('Kaydedilecek hazır satır yok.');
 const sourceIds=await sources({...draft,rows:preview.rows}),ids=Object.fromEntries(preview.newCards.map(c=>[c.id,uuid()]));
 const hashes=Object.fromEntries(await Promise.all(preview.writes.map(async r=>[r.key,await db.opHash(r.fields)])));
 await backupBeforeSoloOperation(db,'before-bulk-entry');
 const connection=await db.openDB();
 const result=await new Promise((resolve,reject)=>{
  const t=connection.transaction([...BULK_STORES,'meta','audit_log'],'readwrite');
  const data={},meta=t.objectStore('meta'),stored={},ops={};let pending=BULK_STORES.length+3+Object.keys(sourceIds).length,error,result;
  const stop=e=>{error=e;try{t.abort();}catch{}};
  function done(){if(--pending)return;try{
   if(stored[CHAT]?.id!==draft.chat_id||stored[BULK_KEY]?.id!==draft.id||stored[BULK_KEY]?.rev!==draft.rev||stored[BULK_KEY]?.status!=='open')throw stale();
   if(draft.task_id&&stored.assistant_task_v1?.id===draft.task_id&&['cancelled','complete'].includes(stored.assistant_task_v1.status))throw stale();
   data.bulk_receipts=ops;
   const plan=finalizeBulk(draft,data);
   if(bulkSelectionToken(plan)!==previewToken)throw stale();
   const added={},saved=[],audit=t.objectStore('audit_log'),at=nowISO();
   const add=(store,fields)=>{
    const r=newRecord(fields);t.objectStore(store).add(r);(added[store]||={added:[],changed:[]}).added.push(r);
    audit.add(newRecord({entity:store,entity_id:r.id,action:'create',old:null,new:r,reason:'Asistan toplu geçmiş giriş',at,bulk_batch_id:draft.id}));return r;
   };
   const mapFields=fields=>Object.fromEntries(Object.entries(fields).map(([k,v])=>[k,typeof v==='string'&&Object.hasOwn(ids,v)?ids[v]:v]));
   for(const card of plan.newCards){
    const {store,id,...f}=card;
    const r={...newRecord(mapFields(f)),id:ids[id]};t.objectStore(store).add(r);(added[store]||={added:[],changed:[]}).added.push(r);
    audit.add(newRecord({entity:store,entity_id:r.id,action:'create',old:null,new:r,reason:'Toplu onay: yeni kart',at,bulk_batch_id:draft.id}));
   }
   for(const r of plan.writes){
    const op=sourceIds[r.source_key];if(!op||ops[r.source_key])throw stale();
    const f=withRecordSource(mapFields(r.fields),r.raw_message,{...r.fields,source_quote:r.quote},r.kind,data,r.kind==='work'?['internal_note']:['description']),bulk_source={key:r.source_key,op_id:op,batch_id:draft.id,raw_message:r.raw_message};
    let record,store;
    if(r.kind==='work'){store='work_records';record=add(store,{...f,bulk_source});}
    else if(r.pending_fuel){store='pending_fuel_records';record=add(store,{...f,bulk_source});}
    else{
     store='fuel_records';const event=uuid(),moveId=uuid();
     record=add(store,{...f,event_id:event,tank_movement_id:moveId,bulk_source});
     // IDs are fixed together before issuing requests; the event and stock move cannot diverge.
     add('fuel_tank_movements',{id:moveId,date:f.date,move_type:'ÇIKIŞ',liters:f.liters,vehicle_id:f.vehicle_id,personnel_id:f.personnel_id||null,event_id:event,fuel_record_id:record.id});
    }
    const receipt={hash:hashes[r.key],input_signature:bulkInputSignature(draft.rows.find(x=>x.key===r.key)),store,record_id:record.id,at,state:'committed',source_key:r.source_key,batch_id:draft.id};
    meta.put({key:db.OP+op,value:receipt});saved.push({key:r.key,id:record.id,store,op_id:op});
   }
   const pendingRows=plan.rows.filter(r=>!saved.some(s=>s.key===r.key)&&['waiting','ready','conflict'].includes(r.status));
   const next={...draft,rev:draft.rev+1,status:pendingRows.length?'open':'complete',updated_at:at};meta.put({key:BULK_KEY,value:next});
   const task=stored.assistant_task_v1;
   if(task&&task.id===draft.task_id&&task.chat_id===draft.chat_id)meta.put({key:'assistant_task_v1',value:{...task,rev:task.rev+1,status:pendingRows.length?'review':'complete',receipt:'Toplu onay: '+saved.length+' kayıt yazıldı; kalanlar toplu taslakta.',updated_at:at}});
   meta.put({key:'assistant_undo',value:{stores:added,attAdded:[],meta:{},count:Object.values(added).reduce((n,x)=>n+x.added.length,0),at,label:'Toplu geçmiş: '+saved.length+' kayıt',bulk_sources:saved.map(s=>s.op_id),bulk_batch_id:draft.id}});
   result={draft:next,saved,pending:pendingRows.length,skipped:plan.skipped};
  }catch(e){stop(e);}}
  for(const s of BULK_STORES){const q=t.objectStore(s).getAll();q.onsuccess=()=>{data[s]=q.result;done();};}
  for(const key of [BULK_KEY,CHAT,'assistant_task_v1']){const q=meta.get(key);q.onsuccess=()=>{stored[key]=q.result?.value;done();};}
  for(const [source,id]of Object.entries(sourceIds)){const q=meta.get(db.OP+id);q.onsuccess=()=>{ops[source]=q.result?.value;done();};}
  t.oncomplete=()=>resolve(result);t.onerror=t.onabort=e=>reject(error||t.error||e?.target?.error||Error('Toplu kayıt iptal edildi; hiçbir satır yazılmadı.'));
 });
 recordsCommitted(connection.name,[...BULK_STORES]);return result;
}
