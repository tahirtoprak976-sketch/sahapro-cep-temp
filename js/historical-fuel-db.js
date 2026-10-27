// Explicit promotion is the only bridge from review evidence to actual stock/cost.
import * as db from './db.js';
import {isActive,newRecord,uuid,nowISO,tankUnitCost} from './core.js';
import {assertPendingFuel,historicalFuelProjection,historicalFuelIdentity} from './historical-fuel.js';
import {assertTankChange} from './tank-timeline.js';
import {recordsCommitted} from './record-refresh.js';
const STORES=['pending_fuel_records','fuel_records','fuel_tank_movements','vehicles','personnel'];
const stale=()=>Object.assign(Error('Yakıt, depo geçmişi veya bağlı kart değişti. Mutabakat önizlemesini yeniden açın.'),{code:'RECONCILIATION_STALE'});
export async function listPendingFuel(){return (await db.getAll('pending_fuel_records')).filter(r=>isActive(r)&&r.reconciliation_status==='pending');}
function read(t,done){const data={};let remaining=STORES.length;for(const s of STORES){const q=t.objectStore(s).getAll();q.onsuccess=()=>{data[s]=q.result;if(!--remaining)done(data);};}}
function decide(data,id){
 const record=data.pending_fuel_records.find(r=>r.id===id),projection=historicalFuelProjection(data);
 const token=JSON.stringify({record,moves:data.fuel_tank_movements,fuels:data.fuel_records,vehicles:data.vehicles,personnel:data.personnel});
 let error=null,unitCost=null,total=null;
 try{
  if(!record||!isActive(record)||record.reconciliation_status!=='pending')throw Error('Bu geçmiş yakıt artık mutabakat beklemiyor.');
  assertPendingFuel(record);
  if(!data.vehicles.some(v=>v.id===record.vehicle_id&&isActive(v))||record.personnel_id&&!data.personnel.some(p=>p.id===record.personnel_id&&isActive(p)))throw Error('Yakıtın araç / personel kartını kontrol edin.');
  if(data.fuel_records.some(f=>f.id===record.id||isActive(f)&&(f.bulk_source?.key===record.bulk_source?.key&&record.bulk_source?.key||historicalFuelIdentity(f)===historicalFuelIdentity(record))))throw Error('Bu kaynak veya aynı tarih / araç / litreyle gerçek yakıt zaten var. Çift stok çıkışını önlemek için mevcut kaydı inceleyin.');
  assertTankChange(data.fuel_tank_movements,[...data.fuel_tank_movements,{date:record.date,move_type:'ÇIKIŞ',liters:record.liters}]);
  const inputs=data.fuel_tank_movements.filter(m=>isActive(m)&&m.move_type==='GİRİŞ'&&m.date<=record.date);
  if(!inputs.length||inputs.some(m=>!(Number(m.total)>0||Number(m.unit_price)>0)))throw Error('O tarihe kadarki gerçek depo girişlerinin maliyeti eksik. Kesinleştirmeden önce giriş / açılış maliyetini doğrulayın.');
  unitCost=tankUnitCost(data.fuel_tank_movements,record.date);total=Math.round(unitCost*record.liters*100)/100;
  if(!(unitCost>0)||!Number.isFinite(total)||total>1e12)throw Error('Doğrulanmış geçmiş yakıt maliyeti hesaplanamadı.');
 }catch(e){error=e.message;}
 return {record,projection,token,canReconcile:!error,error,unitCost,total};
}
export async function reviewPendingFuel(id){
 const connection=await db.openDB();return new Promise((resolve,reject)=>{const t=connection.transaction(STORES,'readonly');let result;read(t,data=>{result=decide(data,id);});t.oncomplete=()=>resolve(result);t.onerror=t.onabort=e=>reject(t.error||e.target.error||Error('Mutabakat okunamadı'));});
}
export async function reconcilePendingFuel(id,token){
 if(typeof token!=='string'||!token)throw stale();
 const tokenHash=await db.opHash(token);
 const connection=await db.openDB();return new Promise((resolve,reject)=>{
  const t=connection.transaction([...STORES,'meta','audit_log'],'readwrite');let result,error,changed=false;
  read(t,data=>{try{
   const pending=data.pending_fuel_records.find(r=>r.id===id);
   if(pending?.reconciliation_status==='reconciled'&&pending.reconciliation.reconcile_token===tokenHash){
    const actual=data.fuel_records.find(f=>f.id===id&&f.historical_pending_id===id);
    if(!actual)throw stale();result={...actual,_existing:true};return;
   }
   const review=decide(data,id);if(review.token!==token)throw stale();if(!review.canReconcile)throw Error(review.error);
   const r=review.record,event=uuid(),at=nowISO(),move=newRecord({date:r.date,move_type:'ÇIKIŞ',liters:r.liters,vehicle_id:r.vehicle_id,personnel_id:r.personnel_id||null,event_id:event,fuel_record_id:id});
   const {reconciliation_status,reconciliation,...source}=r;
   result={...source,id,event_id:event,tank_movement_id:move.id,total:review.total,unit_price:review.unitCost,cost_source:'Depo ortalaması',historical_pending_id:id,updated_at:at};
   const next={...r,reconciliation_status:'reconciled',updated_at:at,reconciliation:{...reconciliation,reconciled_at:at,fuel_record_id:id,reconcile_token:tokenHash,confirmed_total:review.total,confirmed_unit_price:review.unitCost}};
   // .add, not .put: no concurrent or restored actual identity may be overwritten.
   t.objectStore('fuel_records').add(result);t.objectStore('fuel_tank_movements').add(move);t.objectStore('pending_fuel_records').put(next);
   for(const [entity,old,value]of [['pending_fuel_records',r,next],['fuel_records',null,result],['fuel_tank_movements',null,move]])t.objectStore('audit_log').add(newRecord({entity,entity_id:value.id,action:old?'reconcile':'create',old,new:value,reason:'Kullanıcı onayıyla geçmiş yakıt mutabakatı',at}));
   // Bulk receipt remains anchored to the pending tombstone: replay can never revive it.
   changed=true;
  }catch(e){error=e;try{t.abort();}catch{}}});
  t.oncomplete=()=>{if(changed)recordsCommitted(connection.name,STORES);resolve(result);};t.onerror=t.onabort=e=>reject(error||t.error||e.target.error||Error('Mutabakat iptal edildi; hiçbir kayıt değişmedi.'));
 });
}
