// Reviewed maintenance intent. No writes or model authority.
import {isActive,stableStringify,toKurus,fromKurus,MAINT_TYPES,MAINT_STATUS} from './core.js';
import {validPast,meterFields} from './solo-core.js';
export const maintenanceStamp=r=>r?stableStringify(r):'';
export const maintenanceDraftKey=(row,index)=>stableStringify([row?.source_quote||'',row?.description||'',row?.vehicle_id||'',row?.date||'',String(index)]);
export function maintenanceReview(d,f){
 const vehicle=(d.vehicles||[]).find(r=>r.id===f.vehicle_id&&isActive(r));
 if(!vehicle)throw Error('Araç seçin');validPast(f.date);
 if(f.personnel_id&&!(d.personnel||[]).some(r=>r.id===f.personnel_id&&isActive(r)))throw Error('Personel bulunamadı');
 if(f.paid_by_personnel_id&&!(d.personnel||[]).some(r=>r.id===f.paid_by_personnel_id&&isActive(r)))throw Error('Ödeyen personel bulunamadı');
 if(f.vehicle_stamp&&maintenanceStamp(vehicle)!==f.vehicle_stamp)throw Error('Araç / bakım kuralı değişti; kartı yeniden açın');
 if(!String(f.description||'').trim())throw Error('Bakım açıklaması gerekli');
 if(f.maint_type&&!MAINT_TYPES.includes(f.maint_type))throw Error('Bakım türü geçersiz');
 if(f.status&&!MAINT_STATUS.includes(f.status))throw Error('Bakım durumu geçersiz');
 const mode=f.cost_mode;if(!['new_expense','existing','tracking'].includes(mode))throw Error('Maliyet kaynağını seçin');
 const amount=f.cost===''||f.cost==null?null:Number(f.cost);
 if(amount!=null&&(!['string','number'].includes(typeof f.cost)||!Number.isFinite(amount)||amount<0||!Number.isSafeInteger(toKurus(amount))))throw Error('Tutar geçersiz');
 const rate=f.kdv_rate===''||f.kdv_rate==null?null:Number(f.kdv_rate);
 if(rate!=null&&(!['string','number'].includes(typeof f.kdv_rate)||!Number.isFinite(rate)||rate<0||rate>100))throw Error('KDV oranı geçersiz');
 let cost=amount,source=null;
 if(mode==='new_expense'){
  if(!['unknown','included','excluded'].includes(f.tax_basis||'unknown'))throw Error('KDV temeli geçersiz');
  if(f.tax_basis==='excluded'&&amount!=null){if(rate==null)throw Error('KDV hariç tutarın oranını belirtin');cost=fromKurus(Math.round(toKurus(amount)*(1+rate/100)));}
  if(cost!=null&&!Number.isSafeInteger(toKurus(cost)))throw Error('Toplam tutar çok büyük');
 }else{
  if(amount!=null)throw Error('Mevcut alış / yalnız takip için yeni tutar yazmayın');cost=null;
  if(mode==='existing'){
   if(!['expense_records','payables'].includes(f.cost_source_store))throw Error('Mevcut gider / alış seçin');
   source=(d[f.cost_source_store]||[]).find(r=>r.id===f.cost_source_id&&isActive(r)&&r.status!=='İptal');
   if(!source||source.date>f.date||source.dump_deposit||source.source_store==='fuel_tank_movements')throw Error('Maliyet kaynağı bulunamadı veya bu bakım için uygun değil');
   if(source.vehicle_id&&source.vehicle_id!==vehicle.id)throw Error('Kaynak başka araca ait');
   if(source.bill_kind==='Açılış / Devir')throw Error('Devir belgesi bakım malzemesi değildir');
   if(!f.source_stamp||maintenanceStamp(source)!==f.source_stamp)throw Error('Alış / gider değişti; güncel kaynağı yeniden seçin');
  }
 }
 let meter=null,reading=null;
 if(f.meter_reading_id){
  reading=(d.meter_readings||[]).find(r=>r.id===f.meter_reading_id&&isActive(r));
  if(!reading||reading.vehicle_id!==vehicle.id||reading.date!==f.date)throw Error('Sayaç okuması aynı araç ve bakım gününe ait olmalı');
  if(!f.meter_stamp||maintenanceStamp(reading)!==f.meter_stamp)throw Error('Sayaç okuması değişti; yeniden kontrol edin');
  if(!['km','hours'].includes(reading.kind)||!Number.isFinite(Number(reading.value))||Number(reading.value)<0)throw Error('Sayaç okuması geçersiz');
  if(!f.meter_confirmed)throw Error('Sayaç bağlantısını ayrıca onaylayın');
  if(f.meter_value!==''&&f.meter_value!=null)throw Error('Mevcut okuma veya yeni okuma seçin; ikisi birlikte olmaz');
 }else if(f.meter_value!==''&&f.meter_value!=null){
  if(!f.meter_confirmed)throw Error('Yeni sayaç okumasını ayrıca onaylayın');
  meter=meterFields(d,{vehicle_id:vehicle.id,date:f.date,kind:f.meter_kind,value:f.meter_value,note:'Bakım kartında kullanıcı tarafından doğrulandı'});
  const key=meter.kind==='km'?'km':'machine_hours';
  const prior=[...(d.fuel_records||[]),...(d.maintenance_records||[]),{...vehicle,date:String(vehicle.meter_date||'').slice(0,10)}].filter(r=>isActive(r)&&(r.vehicle_id===vehicle.id||r.id===vehicle.id)&&Number.isFinite(Number(r[key]))&&r[key]!=null&&r[key]!=='');
  if(prior.some(r=>r.date&&((r.date<=f.date&&Number(r[key])>meter.value)||(r.date>f.date&&Number(r[key])<meter.value))))throw Error('Sayaç mevcut tarihli okumalarla çelişiyor; değişim / sıfırlama ayrıca incelenmeli');
  reading=meter;
 }
 if(f.service_rule_id){
  const rule=(vehicle.service_rules||[]).find(r=>r.id===f.service_rule_id);
  if(rule?.every_km&&rule?.every_hours)throw Error('Km ve saati birlikte gerektiren kural ayrı incelenmeli; bu kartta tek sayaç türü bağlanabilir');
  if(!rule||f.status!=='Tamamlandı')throw Error('Bakım kuralı yalnız tamamlanan bakımda seçilebilir');
  if((rule.every_km&&reading?.kind!=='km')||(rule.every_hours&&reading?.kind!=='hours'))throw Error('Bakım periyodu için uygun onaylı sayaç gerekli');
 }
 return {meter,source,fields:{date:f.date,vehicle_id:vehicle.id,personnel_id:f.personnel_id||null,maint_type:f.maint_type||'Bakım',status:f.status||'Açık',description:String(f.description).trim().slice(0,2000),service_company:String(f.service_company||'').slice(0,150),severity:['Düşük','Normal','Yüksek','Kritik'].includes(f.severity)?f.severity:'Normal',part:String(f.part||'').slice(0,200),cost,kdv_rate:mode==='new_expense'&&f.tax_basis!=='unknown'?rate:null,cost_mode:mode,cost_source_store:source?f.cost_source_store:null,cost_source_id:source?.id||null,meter_reading_id:reading?.id||null,service_rule_id:f.service_rule_id||null,km:reading?.kind==='km'?Number(reading.value):null,machine_hours:reading?.kind==='hours'?Number(reading.value):null,km_hours:reading?reading.value+(reading.kind==='km'?' km':' saat'):''}};
}
// Existing generic edit forms cannot detach the financial or meter evidence.
export function guardReviewedMaintenanceEdit(old,patch){
 if(!old?.cost_mode)return;
 if(old.meter_reading_id&&'km_hours' in patch&&patch.km_hours!==old.km_hours)throw Error('Onaylı sayaç gösterimi genel düzenlemeden değiştirilemez');
 for(const k of ['cost_mode','cost_source_store','cost_source_id','meter_reading_id','service_rule_id','km','machine_hours'])if(k in patch&&patch[k]!==old[k])throw Error('Bağlı bakımın maliyet / sayaç kanıtı genel düzenleme ekranından değiştirilemez');
 if((old.cost_mode==='existing'||old.meter_reading_id||old.service_rule_id)&&(['vehicle_id','date'].some(k=>k in patch&&patch[k]!==old[k])))throw Error('Bağlı bakımın araç / tarihini değiştirmeden önce kaynak bağlantısı incelenmeli');
 if(old.cost_mode!=='new_expense'&&patch.cost!=null&&patch.cost!=='')throw Error('Mevcut alış / takip bakımına ikinci maliyet yazılamaz');
}
