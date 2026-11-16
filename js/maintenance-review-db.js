import {transaction} from './enterprise-db.js';
import {maintenanceReview} from './maintenance-review-core.js';
import {newRecord,stableStringify,isActive} from './core.js';
import {preparePartFiles} from './parts-db.js';
const conflict=()=>Object.assign(Error('Bu bakım işlemi farklı bilgilerle kullanılmış; kayıt yazılmadı'),{code:'OP_CONFLICT'});
export async function saveMaintenanceReview(f,files=[],op){
 if(!op?.id||!op.hash)throw Error('Bakım işlem kimliği gerekli');
 const attachments=await preparePartFiles(files),signature=stableStringify({f,files:attachments.map(a=>a.src_sha256)});
 return transaction(['maintenance_records','meter_readings','vehicles','expense_records','payables','fuel_records','attachments','meta','personnel'],(d,t)=>{
  const oldOp=d.meta.find(r=>r.key==='op:'+op.id)?.value;
  if(oldOp){
   if(oldOp.hash!==op.hash||oldOp.store!=='maintenance_records')throw conflict();
   const old=d.maintenance_records.find(r=>r.id===oldOp.record_id&&isActive(r));
   if(!old)throw Object.assign(Error('Bakım geri alınmış; yeni işlemle kontrol edin'),{code:'OP_REVERSED'});
   if(old.request_signature!==signature)throw conflict();return {...old,_existing:true};
  }
  if(f.driver_entry_id&&d.maintenance_records.some(r=>r.driver_entry_id===f.driver_entry_id&&isActive(r)))throw Object.assign(Error('Şoför kaydı zaten alınmış'),{code:'DUP_DRIVER'});
  const review=maintenanceReview(d,f);let meter=null;
  if(review.meter){meter=newRecord(review.meter);t.add('meter_readings',meter);}
  const record=newRecord({...review.fields,meter_reading_id:meter?.id||review.fields.meter_reading_id,request_id:op.id,request_signature:signature,
   ...(f.assistant_origin?{assistant_origin:f.assistant_origin}:{}),...(f.driver_entry_id?{driver_entry_id:f.driver_entry_id,source:'şoför'}:{}),...(f.paid_by_personnel_id&&review.fields.cost>0?{paid_by_personnel_id:f.paid_by_personnel_id,reimbursement_status:'Bekliyor'}:{})});
  t.add('maintenance_records',record);t.put('meta',{key:'op:'+op.id,value:{hash:op.hash,store:'maintenance_records',record_id:record.id}});
  for(const a of attachments)t.add('attachments',{...a,record_type:'maintenance',record_id:record.id});
  return record;
 });
}
