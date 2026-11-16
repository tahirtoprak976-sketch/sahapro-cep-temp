import {legalDate,annualEntitlement,chargeableLeaveDays,validateLeave} from './core.js';
import {legalCalendar} from './calendar.js';
export const active=r=>r&&!r.deleted_at&&r.active!==false;
export const effectiveLeave=r=>active(r)&&r.planDurumu!=='taslak';
export const kindName={yillik:'Yıllık izin',mazeret:'Mazeret izni',rapor:'Rapor',ucretsiz:'Ücretsiz izin',yol:'Yol izni'};
export const addDay=(day,n=1)=>{const d=new Date(legalDate(day)+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};
export const error=(code,message)=>{throw Object.assign(Error(message),{code})};
// Explicit opening per service year avoids assigning historical usage to invented years.
// This snapshot is edited by the owner, never a model, and is not a backfill.
export function leaveLedger(data,person,on,excludeId=null){
 legalDate(on);const open=person.izinHesapAcilisi;
 if(!open||!Array.isArray(open.years)||!open.confirmedOn)error('OPENING','Hak yıllarına göre doğrulanmış izin açılışı gerekli');
 legalDate(open.asOf);if(open.asOf>on)error('OPENING','İzin tarihi açılış tarihinden önce; geçmiş kullanım ayrıca belgelenmeli');
 const hire=legalDate(person.iseGirisTarihi??person.start_date);
 const years=open.years.map(y=>{legalDate(y.yearKey);if(y.yearKey>open.asOf||y.yearKey.slice(5)!==hire.slice(5)||!annualEntitlement(person,y.yearKey).eligible||typeof y.days!=='number'||!Number.isFinite(y.days)||y.days<0||!Array.isArray(y.pieces)||y.pieces.some(n=>typeof n!=='number'||!Number.isFinite(n)||n<0))error('OPENING','Hak yılı, gün ve önceki parça bilgileri doğrulanmalı');return {...y,opening:y.days,earned:0}});
 if(new Set(years.map(y=>y.yearKey)).size!==years.length)error('OPENING','Hak yılı bir kez girilebilir');
 for(let year=Number(open.asOf.slice(0,4));year<=Number(on.slice(0,4));year++){
  const at=String(year)+hire.slice(4);if(at<=open.asOf||at>on)continue;
  const e=annualEntitlement(person,at);if(e.eligible&&!years.some(y=>y.yearKey===at))years.push({yearKey:at,days:e.days,opening:0,earned:e.days,pieces:[]});
 }
 const rows=(data.izin_kayitlari||[]).filter(r=>effectiveLeave(r)&&r.id!==excludeId&&r.personelId===person.id&&r.izinTuru==='yillik');
 const legacy=(data.personnel_events||[]).filter(r=>active(r)&&r.personnel_id===person.id&&r.event_type==='İzin'&&r.leave_kind==='Yıllık izin'&&r.date>open.asOf&&r.date<=on);
 if(legacy.length)error('LEGACY_ALLOCATION','Açılıştan sonra eski yöntemle yıllık izin kaydı var; hak yılı bakiyeleri sahibi tarafından uzlaştırılmalı');
 return years.sort((a,b)=>a.yearKey.localeCompare(b.yearKey)).map(y=>{
  const uses=rows.filter(r=>r.izinHakYili===y.yearKey);
  if(uses.some(r=>typeof r.dusulenIsGunu!=='number'||!Number.isFinite(r.dusulenIsGunu)))error('BALANCE','İzin günü doğrulanmamış kayıt var');
  const used=uses.reduce((n,r)=>n+r.dusulenIsGunu,0);
  return {...y,personelId:person.id,availableDays:y.days-used,used,pieces:[...y.pieces.map(days=>({days,yearKey:y.yearKey,personelId:person.id})),...uses.map(r=>({days:r.dusulenIsGunu,yearKey:y.yearKey,personelId:person.id}))]};
 });
}
export function personWork(data){
 return (data.work_records||[]).filter(active).flatMap(w=>{
  if(w.personnel_id)return [w];
  const ids=new Set([...(data.personnel||[]).filter(p=>active(p)&&p.vehicle_id===w.vehicle_id).map(p=>p.id),...(data.vehicles||[]).filter(v=>active(v)&&v.id===w.vehicle_id&&v.assignee_id).map(v=>v.assignee_id)]);
  return [...ids].map(personnel_id=>({...w,personnel_id}));
 });
}
export function prepareLeave(data,fields,{mode='draft',today,current=null}={}){
 const person=(data.personnel||[]).find(p=>p.id===fields.personelId&&active(p));if(!person)error('PERSONNEL','Personel seçin');
 const ledger=fields.izinTuru==='yillik'?leaveLedger(data,person,fields.baslangicTarihi,fields.id):[];
 const selected=ledger.find(y=>y.yearKey===fields.izinHakYili);
 const legacy=(data.personnel_events||[]).filter(r=>active(r)&&['İzin','Rapor'].includes(r.event_type)).map(r=>({id:r.id,personelId:r.personnel_id,baslangicTarihi:r.date,bitisTarihi:r.date}));
 const out=validateLeave(fields,{person,calendar:legalCalendar,weeklyRestDays:person.haftaTatiliGunleri??[0],halfDayPolicy:'fraction',availableDays:ledger.reduce((n,y)=>n+y.availableDays,0),yearAllocation:selected?{...selected}:undefined,otherLeaves:[...(data.izin_kayitlari||[]).filter(effectiveLeave),...legacy],workRows:[...personWork(data),...(data.puantaj_kayitlari||[]).filter(active)],personnel:data.personnel||[],mode,today,current});
 return {...out,hesapTakvimi:fields.izinTuru==='yillik'?chargeableLeaveDays(fields.baslangicTarihi,fields.bitisTarihi,{calendar:legalCalendar,weeklyRestDays:person.haftaTatiliGunleri??[0],halfDayPolicy:'fraction'}).rows:null,kayitSekli:mode==='actual'?'fiili':'plan',planDurumu:mode==='draft'?'taslak':mode==='actual'?'fiili':'onayli',balanceSnapshot:fields.izinTuru==='yillik'?{carry:ledger.reduce((n,y)=>n+y.opening,0),earned:ledger.reduce((n,y)=>n+y.earned,0),priorUsed:ledger.reduce((n,y)=>n+y.used,0),thisLeave:out.dusulenIsGunu,remaining:ledger.reduce((n,y)=>n+y.availableDays,0)-out.dusulenIsGunu}:null};
}
export function leaveDaysView(row,person){if(Array.isArray(row.hesapTakvimi))return {days:row.hesapTakvimi.reduce((n,x)=>n+x.charged,0),rows:row.hesapTakvimi};return chargeableLeaveDays(row.baslangicTarihi,row.bitisTarihi,{calendar:legalCalendar,weeklyRestDays:person.haftaTatiliGunleri??[0],halfDayPolicy:'fraction'});}
