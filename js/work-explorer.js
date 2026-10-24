import {recordNoteText} from './record-notes.js';
// Work-list query and export model. Read only: never changes financial records.
import { isActive, addDays, matchSearch, todayStr } from './core.js';
import { missingCustomerWorkPrice } from './collect-core.js';
const keys=['f','period','from','to','q','customer_id','vehicle_id','personnel_id','site_id','work_type','unit'];
const filters=new Set(['all','noslip','fiyatsiz','musterisiz','driver']);
export function workURL(query={},patch={}) {
 const params=new URLSearchParams();
 for(const key of keys){const v=Object.hasOwn(patch,key)?patch[key]:query[key];if(v!=null&&String(v)!=='')params.set(key,String(v));}
 return '#/isler'+(params.size?'?'+params:'');
}
export function realDate(value){return /^\d{4}-\d{2}-\d{2}$/.test(String(value||''))&&Number.isFinite(Date.parse(value+'T12:00:00Z'))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;}
export function workQuery(query={},today=todayStr()){
 const f=filters.has(query.f)?query.f:'all';
 const requested=query.period||(['today','week','month'].includes(query.f)?query.f:'all');
 const period=['all','today','week','month'].includes(requested)?requested:'all';
 let from=query.from||'',to=query.to||from;
 let error='';
 if((from&&!realDate(from))||(to&&!realDate(to)))error='Gerçek bir başlangıç ve bitiş tarihi seçin.';
 if(from&&to&&from>to)error='Başlangıç tarihi bitişten sonra olamaz.';
 if(!from&&!to){if(period==='today')from=to=today;if(period==='week'){from=addDays(today,-6);to=today;}if(period==='month'){from=today.slice(0,7)+'-01';to=today;}}
 return {...Object.fromEntries(keys.map(k=>[k,String(query[k]||'')])),f,period,from,to,error};
}
export function workFlags(w,internal=new Set(),billed=new Set()){
 return {noslip:!w.slip_id&&!w.digital_slip_no&&w.slip_status!=='Fiş Var',musterisiz:!w.customer_id,
 fiyatsiz:!!w.customer_id&&!internal.has(w.customer_id)&&missingCustomerWorkPrice(w,billed.has(w.id)),driver:!!w.driver_entry_id};
}
export function exploreWorks(all,names={},query={},options={}){
 const state=workQuery(query,options.today),internal=options.internal||new Set(),billed=options.billed||new Set();
 if(state.error)return {state,rows:[],units:{},counts:{noslip:0,fiyatsiz:0,musterisiz:0,driver:0},days:0};
 const rows=all.filter(isActive).filter(w=>{
  if((state.from||state.to)&&!realDate(w.date))return false;
  if(state.from&&w.date<state.from||state.to&&w.date>state.to)return false;
  for(const k of ['customer_id','vehicle_id','personnel_id','site_id','work_type','unit'])if(state[k]&&w[k]!==state[k])return false;
  if(state.f!=='all'&&!workFlags(w,internal,billed)[state.f])return false;
  return matchSearch([names.customers?.[w.customer_id],names.sites?.[w.site_id],names.vehicles?.[w.vehicle_id],names.personnel?.[w.personnel_id],w.work_type,recordNoteText(w,'description',names,'work'),w.material,w.slip_no,w.digital_slip_no].filter(Boolean).join(' '),state.q);
 }).sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))||String(b.created_at||'').localeCompare(String(a.created_at||''))||String(a.id).localeCompare(String(b.id)));
 const units=Object.create(null),counts={noslip:0,fiyatsiz:0,musterisiz:0,driver:0};
 for(const w of rows){const u=w.unit||'Birim yok';const q=Number(w.quantity);if(Number.isFinite(q))units[u]=Math.round(((units[u]||0)+q)*1e6)/1e6;for(const [k,v] of Object.entries(workFlags(w,internal,billed)))if(v)counts[k]++;}
 return {state,rows,units,counts,days:new Set(rows.map(w=>w.date).filter(realDate)).size};
}
// Quotes + delimiter/newline handling and formula-injection protection for spreadsheet apps.
export function csvCell(value){let s=String(value??'');if(/^[\s\uFEFF]*[=+@-]/u.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';}
export function workCSV(rows,names={}){
 const lines=[['Tarih','Müşteri','Şantiye','Araç','Personel','İş türü','Miktar','Birim','Fiş no','Kaynak','Açıklama']];
 for(const w of rows)lines.push([w.date,names.customers?.[w.customer_id]||'',names.sites?.[w.site_id]||'',names.vehicles?.[w.vehicle_id]||'',names.personnel?.[w.personnel_id]||'',w.work_type,w.quantity,w.unit,w.slip_no||w.digital_slip_no||'',w.driver_entry_id?'Şoför':'Diğer',recordNoteText(w,'description',names,'work')]);
 return '\uFEFF'+lines.map(l=>l.map(csvCell).join(';')).join('\r\n');
}
