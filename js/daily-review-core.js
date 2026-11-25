// Read-only daily triage over existing operational checks. No new status or business record is stored.
import {operationModel} from './operation-core.js';
import {isActive} from './core.js';
import {workReviewContext,missingCustomerWorkPrice} from './collect-core.js';
import {realDate} from './work-explorer.js';
const rank={alert:0,warn:1,info:2};
export function groupDailyFindings(items=[]){
 const groups=new Map();
 for(const item of items){
  if(!/^#\/[a-z0-9-]+(?:[/?]|$)/i.test(item.href||''))continue;
  const [path,query='']=item.href.split('?'),params=new URLSearchParams(query);params.sort();
  const key=path+(params.size?'?'+params:'');
  const kind=Object.hasOwn(rank,item.kind)?item.kind:'warn';
  let group=groups.get(key);if(!group){group={href:key,kind,findings:[]};groups.set(key,group);}
  if(rank[kind]<rank[group.kind])group.kind=kind;
  if(!group.findings.some(x=>x.title===item.title&&x.why===item.why))group.findings.push({title:item.title,why:item.why||'',action:item.action||'Kaydı incele'});
 }
 return [...groups.values()].sort((a,b)=>rank[a.kind]-rank[b.kind]||a.href.localeCompare(b.href,'tr'));
}
export function dailyReview(d,{date,vehicle_id='',personnel_id=''}={}){
 if(!realDate(date))throw Error('Geçerli bir gün seçin.');
 const model=operationModel(d,{date,vehicle_id,personnel_id,meta:d.meta||[]});
 const stores={isler:'work_records',yakit:'fuel_records',gider:'expense_records',bakim:'maintenance_records',kasa:'cash_records'};
 const pending=model.pending.filter(item=>{
  const match=/^#\/([^/]+)\/([^?]+)/.exec(item.href);if(!match||!stores[match[1]])return true;
  let id;try{id=decodeURIComponent(match[2]);}catch{return false;}
  const record=(d[stores[match[1]]]||[]).find(r=>r.id===id);
  return !record||!realDate(record.date)||record.date<=date;
 });
 const direct=new Set(pending.filter(x=>x.key?.startsWith('check:')&&/^#\/isler\/[^?]+$/.test(x.href)).map(x=>x.href));
 const {internal,billed}=workReviewContext(d),works=(d.work_records||[]).filter(isActive);
 const queues={fiyatsiz:works.filter(w=>w.customer_id&&!internal.has(w.customer_id)&&missingCustomerWorkPrice(w,billed.has(w.id))),musterisiz:works.filter(w=>!w.customer_id)};
 const covered=item=>{const match=/^#\/isler\?f=(fiyatsiz|musterisiz)$/.exec(item.href);if(!match)return false;const rows=queues[match[1]];return rows.length>0&&rows.every(w=>w.date===date&&direct.has('#/isler/'+w.id));};
 const groups=groupDailyFindings(pending.filter(item=>!covered(item))),actions=groups.filter(g=>g.kind!=='info'),notes=groups.filter(g=>g.kind==='info');
 const workVehicles=new Set(model.stream.rows.filter(x=>x.kind==='work').map(x=>x.record.vehicle_id));
 const noWork=(d.vehicles||[]).filter(v=>isActive(v)&&v.active!==false&&(!vehicle_id||v.id===vehicle_id)&&(!personnel_id||v.assignee_id===personnel_id||(d.personnel||[]).some(p=>p.id===personnel_id&&p.vehicle_id===v.id))&&!workVehicles.has(v.id));
 const scope=new URLSearchParams({op_date:date,op_tab:'close'});if(vehicle_id)scope.set('op_vehicle',vehicle_id);if(personnel_id)scope.set('op_personnel',personnel_id);
 return {date,actions,notes,noWork,findings:actions.reduce((n,g)=>n+g.findings.length,0),
  compare:'#/isler/kontrol?date='+encodeURIComponent(date),close:'#/?'+scope,filtered:!!(vehicle_id||personnel_id)};
}
