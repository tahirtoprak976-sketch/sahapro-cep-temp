// Only reusable selections are copied. Each new job needs its own quantity/evidence/price.
import {isActive,WORK_TYPES,WORK_UNITS,todayStr} from './core.js';
export function latestWork(rows){
 const time=r=>{const n=Date.parse(r.created_at||'');return Number.isFinite(n)?n:(Date.parse((r.date||'')+'T12:00:00Z')||0);};
 return rows.filter(isActive).sort((a,b)=>time(b)-time(a)||String(b.id).localeCompare(String(a.id)))[0]||null;
}
export function repeatWork(record,data,today=todayStr()){
 const values={date:today,quantity:'',unit:WORK_UNITS.includes(record.unit)?record.unit:'Sefer',work_type:WORK_TYPES.includes(record.work_type)?record.work_type:''};
 const missing=[];
 for(const [key,store,label] of [['customer_id','customers','Müşteri'],['vehicle_id','vehicles','Araç'],['personnel_id','personnel','Personel'],['dump_site_id','dumpSites','Döküm sahası'],['quarry_id','quarries','Ocak']]){
  const id=record[key];values[key]=id&&(data[store]||[]).some(x=>x.id===id&&isActive(x))?id:'';if(id&&!values[key])missing.push(label);
 }
 const site=(data.sites||[]).find(x=>x.id===record.site_id&&isActive(x)&&x.customer_id===values.customer_id&&values.customer_id);
 values.site_id=site?.id||'';if(record.site_id&&!site)missing.push('Şantiye');
 for(const key of ['material','dump_area','quarry'])if(typeof record[key]==='string')values[key]=record[key];
 return {values,missing};
}
