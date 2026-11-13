// A separate historical review collection, never part of actual stock or costs.
import {isActive,todayStr} from './core.js';
import {tankTimeline} from './tank-timeline.js';
export const isPendingFuel=f=>f?.reconciliation_status==='pending';
// Operator may be omitted by another entry path; it must not hide the same withdrawal.
export const historicalFuelIdentity=r=>JSON.stringify([r.date,r.vehicle_id,Number(r.liters),r.fuel_source]);
const date=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s+'T12:00:00Z'))&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s;
export function assertHistoricalScope(scope,day,today=todayStr()){
 if(!scope||scope.enabled!==true||!date(scope.from)||!date(scope.to)||scope.from>scope.to||scope.to>=today||!date(day)||day<scope.from||day>scope.to)
  throw Error('Mutabakat bekleyen yakıt için açıkça seçilmiş, bugünden önce biten tarih aralığı ve bu aralıktaki gerçek tarih gerekli.');
}
export function pendingFuelFields(fields,scope,approvedAt){
 assertHistoricalScope(scope,fields.date);
 const r={...fields,reconciliation_status:'pending',total:null,unit_price:null,cost_source:null,
  reconciliation:{version:1,from:scope.from,to:scope.to,consent:'historical-fuel-review',approved_at:approvedAt,
   source_amounts:{total:fields.total??null,unit_price:fields.unit_price??null},source_fields:structuredClone(fields)}};
 delete r.tank_movement_id;delete r.event_id;assertPendingFuel(r);return r;
}
export function assertPendingFuel(r){
 const q=r?.reconciliation;
 if(!r||!['pending','reconciled','cancelled'].includes(r.reconciliation_status)||q?.version!==1||q.consent!=='historical-fuel-review'||!q.approved_at)
  throw Error('Geçmiş yakıt mutabakat kaydı veya kullanıcı onayı geçersiz.');
 assertHistoricalScope({enabled:true,from:q.from,to:q.to},r.date);
 if(r.fuel_source!=='Depo Tankı'||!r.vehicle_id||typeof r.liters!=='number'||!Number.isFinite(r.liters)||r.liters<=0||r.liters>1e12||r.total!=null||r.unit_price!=null||r.cost_source||r.tank_movement_id||r.event_id)
  throw Error('Bekleyen geçmiş yakıt gerçek stok / kesinleşmiş maliyet olamaz.');
 if(!q.source_fields||q.source_fields.date!==r.date||Number(q.source_fields.liters)!==r.liters||q.source_fields.vehicle_id!==r.vehicle_id||(q.source_fields.personnel_id||null)!==(r.personnel_id||null))
  throw Error('Geçmiş yakıt kaynak bilgileri değiştirilemez.');
 if(r.reconciliation_status==='reconciled'&&(!q.fuel_record_id||!q.reconciled_at||!q.reconcile_token))throw Error('Yakıt mutabakat bağlantısı eksik.');
 return r;
}
export function pendingFuelSummary(data,{from='',to='',vehicle_id=null,personnel_id=null}={}){
 const rows=(data?.pending_fuel_records||[]).filter(r=>isActive(r)&&isPendingFuel(r)&&(!from||r.date>=from)&&(!to||r.date<=to)&&(!vehicle_id||r.vehicle_id===vehicle_id)&&(!personnel_id||r.personnel_id===personnel_id));
 const liters=rows.reduce((n,r)=>n+(Number(r.liters)||0),0),count=rows.length;
 return {count,liters,rows,warning:count?`${count} geçmiş yakıt kaydı (${liters.toLocaleString('tr-TR',{maximumFractionDigits:3})} L) depo mutabakatı bekliyor. Stok ve maliyete dahil değil; maliyet / kâr sonucu eksik.`:''};
}
export function historicalFuelProjection(data,extraRows=[]){
 const pending=[...pendingFuelSummary(data).rows,...extraRows],pendingLiters=pending.reduce((n,r)=>n+Number(r.liters),0);
 const timeline=tankTimeline([...(data?.fuel_tank_movements||[]),...pending.map(r=>({date:r.date,liters:r.liters,move_type:'ÇIKIŞ',id:'pending:'+r.id}))]);
 return {timeline,firstDeficit:timeline.firstDeficit,remaining:timeline.remaining,pendingLiters};
}
export function validatePendingFuelData(data){
 for(const r of data.pending_fuel_records||[]){
  assertPendingFuel(r);
  const actual=(data.fuel_records||[]).find(f=>f.id===r.id);
  const moves=(data.fuel_tank_movements||[]).filter(m=>m.fuel_record_id===r.id);
  if(r.reconciliation_status==='reconciled'){
   const m=moves[0];
   if(!actual||actual.historical_pending_id!==r.id||r.reconciliation.fuel_record_id!==actual.id||moves.length!==1||!m||m.id!==actual.tank_movement_id||m.event_id!==actual.event_id||m.move_type!=='ÇIKIŞ'||historicalFuelIdentity(actual)!==historicalFuelIdentity(r)||m.date!==r.date||Number(m.liters)!==r.liters||m.vehicle_id!==r.vehicle_id||(actual.personnel_id||null)!==(r.personnel_id||null)||(m.personnel_id||null)!==(r.personnel_id||null)||!!actual.deleted_at!==!!m.deleted_at||actual.total!==r.reconciliation.confirmed_total||actual.unit_price!==r.reconciliation.confirmed_unit_price)
    throw Error('Mutabakatı tamamlanan yakıtın gerçek kayıt / depo bağlantısı eksik veya tutarsız.');
  }else if(actual||moves.length)throw Error('Bekleyen / iptal edilen geçmiş yakıt gerçek yakıt veya depo hareketiyle çakışıyor.');
 }
 for(const f of data.fuel_records||[])if(f.historical_pending_id&&!data.pending_fuel_records?.some(r=>r.id===f.historical_pending_id&&r.reconciliation_status==='reconciled'))throw Error('Mutabakat yakıtının kaynak kaydı eksik.');
}
