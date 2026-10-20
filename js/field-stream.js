// Read-only daily operational stream. Business dates, never invented event times.
import {isActive,matchSearch,todayStr} from './core.js';
import {realDate} from './work-explorer.js';
export const SOURCES={work:['work_records','İş','isler'],fuel:['fuel_records','Yakıt','yakit'],expense:['expense_records','Gider','gider'],maintenance:['maintenance_records','Bakım','bakim']};
export function streamURL(state={},patch={}){const p=new URLSearchParams();for(const k of ['date','kind','vehicle_id','q']){const v=Object.hasOwn(patch,k)?patch[k]:state[k];if(v)p.set(k,v);}return '#/saha-akisi'+(p.size?'?'+p:'');}
export function fieldStream(data,state={},today=todayStr()){
 const date=state.date||today,error=realDate(date)?'':'Geçerli bir gün seçin.';
 const kind=Object.hasOwn(SOURCES,state.kind)?state.kind:'';
 const name=(store,id)=>data[store]?.find(x=>x.id===id)?.name||data[store]?.find(x=>x.id===id)?.plate||'';
 const all=[];let invalid=0;
 for(const [key,[store,label,route]] of Object.entries(SOURCES))for(const r of data[store]||[]){if(!isActive(r))continue;if(!realDate(r.date)){invalid++;continue;}const title=key==='work'?[name('customers',r.customer_id),r.work_type].filter(Boolean).join(' · '):key==='fuel'?r.fuel_source:key==='expense'?r.category:r.maint_type;
 all.push({kind:key,label,date:r.date,id:r.id,hash:'#/'+route+'/'+encodeURIComponent(r.id),title:title||label,vehicle:name('vehicles',r.vehicle_id),personnel:name('personnel',r.personnel_id),description:r.description||'',record:r});}
 const rows=error?[]:all.filter(x=>x.date===date&&(!kind||kind===x.kind)&&(!state.vehicle_id||x.record.vehicle_id===state.vehicle_id)&&matchSearch([x.title,x.vehicle,x.personnel,x.description,x.record.slip_no,x.record.digital_slip_no].join(' '),state.q||'')).sort((a,b)=>a.kind.localeCompare(b.kind)||String(a.id).localeCompare(String(b.id)));
 const units=Object.create(null);let liters=0;const counts={work:0,fuel:0,expense:0,maintenance:0};
 for(const x of rows){counts[x.kind]++;if(x.kind==='work'){const u=x.record.unit||'Birim yok',n=Number(x.record.quantity);if(Number.isFinite(n))units[u]=(units[u]||0)+n;}if(x.kind==='fuel'){const n=Number(x.record.liters);if(Number.isFinite(n))liters+=n;}}
 return {date,kind,error,rows,units,liters,counts,invalid,days:all.reduce((m,x)=>(m[x.date]=(m[x.date]||0)+1,m),Object.create(null))};
}
