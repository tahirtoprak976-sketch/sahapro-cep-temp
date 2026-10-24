import {recordNoteText} from './record-notes.js';
// Read-only fuel/maintenance history. Summaries and exports use the same filtered rows.
import {isActive,matchSearch,todayStr,addDays} from './core.js';
import {realDate,csvCell} from './work-explorer.js';
const keys=['f','period','from','to','q','vehicle_id','personnel_id','source'];
export const operationRoute=kind=>kind==='fuel'?'yakit':'bakim';
export function operationURL(kind,query={},patch={}){
 const params=new URLSearchParams();
 for(const key of keys){const v=Object.hasOwn(patch,key)?patch[key]:query[key];if(v!=null&&String(v)!=='')params.set(key,String(v));}
 return '#/'+operationRoute(kind)+(params.size?'?'+params:'');
}
export function operationQuery(kind,query={},today=todayStr()){
 const state=Object.fromEntries(keys.map(k=>[k,String(query[k]||'')]));
 state.f=kind==='maintenance'&&['all','done','open'].includes(state.f)?state.f:kind==='maintenance'?'open':'all';
 state.period=['today','week','month'].includes(state.period)?state.period:'all';
 state.to=state.to||state.from;
 state.error='';
 if((state.from&&!realDate(state.from))||(state.to&&!realDate(state.to)))state.error='Gerçek bir başlangıç ve bitiş tarihi seçin.';
 else if(state.from&&state.to&&state.from>state.to)state.error='Başlangıç tarihi bitişten sonra olamaz.';
 if(!state.from&&!state.to){
  if(state.period==='today')state.from=state.to=today;
  if(state.period==='week'){state.from=addDays(today,-6);state.to=today;}
  if(state.period==='month'){state.from=today.slice(0,7)+'-01';state.to=today;}
 }
 if(kind!=='fuel')state.source='';
 return state;
}
export function operationName(names,store,id){return names[store]?.[id]|| (id?'Arşivde / bulunamadı':'Belirtilmedi');}
export function exploreOperations(kind,all,names={},query={},today=todayStr()){
 const state=operationQuery(kind,query,today),active=all.filter(isActive);
 const rows=state.error?[]:active.filter(r=>{
  if((state.from||state.to)&&!realDate(r.date))return false;
  if(state.from&&r.date<state.from||state.to&&r.date>state.to)return false;
  for(const k of ['vehicle_id','personnel_id'])if(state[k]&&r[k]!==state[k])return false;
  if(kind==='maintenance'&&(state.f==='open'&&r.status==='Tamamlandı'||state.f==='done'&&r.status!=='Tamamlandı'))return false;
  if(state.source&&r.fuel_source!==state.source)return false;
  return matchSearch([operationName(names,'vehicles',r.vehicle_id),operationName(names,'personnel',r.personnel_id),names.customers?.[r.customer_id],recordNoteText(r,'description',names,kind),r.fuel_source,r.pump_no,r.receipt,r.maint_type,r.status,r.severity,r.part,r.service_company,r.km_hours].filter(Boolean).join(' '),state.q);
 }).sort((a,b)=>String(realDate(b.date)?b.date:'').localeCompare(String(realDate(a.date)?a.date:''))||String(b.created_at||'').localeCompare(String(a.created_at||''))||String(a.id).localeCompare(String(b.id)));
 const sources=new Map();let liters=0,invalidLiters=0,costCents=0,priced=0;
 for(const r of rows){
  if(kind==='fuel'){
   const n=r.liters!==''&&r.liters!=null?Number(r.liters):NaN;
   if(Number.isFinite(n)&&n>=0){liters+=n;const source=r.fuel_source||'Kaynak belirtilmedi';sources.set(source,(sources.get(source)||0)+n);}else invalidLiters++;
  }else{
   const n=r.cost!==''&&r.cost!=null?Number(r.cost):NaN;
   if(Number.isFinite(n)&&n>=0){costCents+=Math.round(n*100);priced++;}
  }
 }
 return {state,rows,liters:Math.round(liters*1e6)/1e6,invalidLiters,sources:[...sources].map(([source,n])=>({source,liters:Math.round(n*1e6)/1e6})),cost:costCents/100,priced,unpriced:rows.length-priced,
  undated:rows.filter(r=>!realDate(r.date)).length,days:new Set(rows.map(r=>r.date).filter(realDate)).size};
}
export function operationCSV(kind,rows,names={}){
 const lines=[kind==='fuel'?['Tarih','Araç','Personel','Litre','Kaynak','Mazotu veren müşteri','Fiş','Açıklama']:['Tarih','Araç','Personel','Kayıt tipi','Durum','Önem','Kayıtlı maliyet (TL)','Servis','Parça','Açıklama']];
 for(const r of rows){const common=[r.date||'',operationName(names,'vehicles',r.vehicle_id),operationName(names,'personnel',r.personnel_id)];
  lines.push([...common,...(kind==='fuel'?[r.liters??'',r.fuel_source||'',r.fuel_source==='Müşteri Verdi'?names.customers?.[r.customer_id]||'Belirtilmedi':'',r.receipt||'',recordNoteText(r,'description',names,kind)]:[r.maint_type||'',r.status||'Açık',r.severity||'',r.cost??'',r.service_company||'',r.part||'',recordNoteText(r,'description',names,kind)])]);
 }
 return '\uFEFF'+lines.map(row=>row.map(csvCell).join(';')).join('\r\n');
}
