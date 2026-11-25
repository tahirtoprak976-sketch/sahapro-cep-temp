// Read-only vehicle follow-up. Existing document, maintenance and cost authorities are reused.
import {isActive,todayStr,toKurus,fromKurus} from './core.js';
import {validDate} from './driver-delivery.js';
import {fleetDocumentModel} from './fleet-document-core.js';
import {maintenanceHistory} from './maintenance-history-core.js';
import {meterPoints,ruleStatus} from './maint-core.js';
import {operatingResult} from './enterprise-core.js';
export function fleetDesk(d,id,{today=todayStr()}={}){
 if(!validDate(today))throw Error('Geçerli takip günü gerekli.');
 const vehicle=(d.vehicles||[]).find(v=>v.id===id&&isActive(v));
 if(!vehicle)throw Error('Araç bulunamadı.');
 const documents=fleetDocumentModel(d,{vehicle_id:id,includeInactive:true,today}).selected;
 const urgent=documents.filter(r=>['overdue','today','soon','invalid','unknown','owner'].includes(r.state));
 const history=maintenanceHistory(d).filter(r=>r.vehicle_id===id&&validDate(r.date)&&r.date<=today);
 const open=history.filter(r=>!r.history_unknown_status&&['Açık','Serviste','Parça Bekliyor'].includes(r.status));
 const meters={};
 for(const kind of ['km','hours']){
  const all=meterPoints(d,vehicle,kind),points=all.filter(p=>validDate(p.date)&&p.date<=today);
  const last=points.at(-1)||null;
  let high=-Infinity,conflict=false;for(const p of points){if(p.value<high)conflict=true;high=Math.max(high,p.value);}
  meters[kind]={last,conflict,excluded:all.length-points.length};
 }
 // Future/undated readings cannot make a maintenance rule look due or complete today.
 const asOf={...d};for(const s of ['meter_readings','fuel_records','maintenance_records','work_records'])asOf[s]=(d[s]||[]).filter(r=>validDate(r.date)&&r.date<=today&&r.status!=='İptal');
 const v={...vehicle};for(const [kind,key] of [['km','km'],['hours','machine_hours']])if(!validDate(String(v.meter_date||v.updated_at||v.created_at||'').slice(0,10))||String(v.meter_date||v.updated_at||v.created_at).slice(0,10)>today)v[key]=null;
 const rules=(vehicle.service_rules||[]).map(rule=>{
  const state=ruleStatus(asOf,v,rule,{today});
  if(rule.every_km&&meters.km.conflict||rule.every_hours&&meters.hours.conflict)return {...state,state:'?',text:'Sayaç kayıtları azalmış; bakım aralığını kontrol edin.'};
  if(rule.last?.date&&(!validDate(rule.last.date)||rule.last.date>today))return {...state,state:'?',text:'Son bakım başlangıç tarihini kontrol edin.'};
  return state;
 });
 const result=operatingResult(d,{vehicle_id:id,to:today});
 const knownCosts=result.costs.filter(r=>!r.unverified&&r.remaining_estimated_amount!==null&&Number.isFinite(Number(r.gross)));
 const cost=fromKurus(knownCosts.reduce((n,r)=>n+toKurus(r.gross),0));
 const unknownHistory=history.filter(r=>r.cost==null&&!['tracking','existing'].includes(r.cost_mode)).length;
 const costReason=[result.costIncompleteReason,unknownHistory?unknownHistory+' bakım / alış kaydında tutar bilinmiyor':''].filter(Boolean).join('; ');
 const enc=encodeURIComponent;
 const links={documents:'#/filo-belgeleri?vehicle_id='+enc(id),calendar:'#/bakim-takvimi/'+enc(id),history:'#/bakim?f=all&vehicle_id='+enc(id),meter:'#/sayac/new?vehicle_id='+enc(id),cost:'#/maliyet?vehicle_id='+enc(id),report:'#/detayli-rapor?k=bakim&id='+enc(id)+'&p=all'};
 const next=urgent.length?{label:'Belge sürelerini kontrol et',href:links.documents}:open.length?{label:'Açık bakım / arızayı incele',href:open[0].history_href}:rules.some(r=>['late','soon','?'].includes(r.state))||!rules.length?{label:'Bakım takvimini kontrol et',href:links.calendar}:{label:'Bakım geçmişini aç',href:links.history};
 return {vehicle,today,documents,urgent,history,open,rules,meters,cost,costIncomplete:result.costIncomplete||unknownHistory>0,costReason,links,next};
}
