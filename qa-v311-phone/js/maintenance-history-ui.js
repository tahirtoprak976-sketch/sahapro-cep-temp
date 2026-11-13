import {esc,badge,notice} from './ui.js';
import {readMaintenanceData,MAINTENANCE_READ_STORES} from './maintenance-history-core.js';
import {watchRecords} from './record-refresh.js';
export function maintenanceSourcesHTML(row){
  if(!row?.history_sources)return '';
  return `<div class="maintenance-source-links" data-maintenance-sources>${badge(row.history_origin,'info')}${row.history_sources.filter(s=>s.href!==row.history_href||row.history_source_store==='maintenance_records'&&s.store==='payables').map(s=>`<a class="btn sm" href="${esc(s.href)}">${esc(s.label)} →</a>`).join('')}${row.history_warnings.map(message=>notice('warn',message)).join('')}</div>`;
}
// Repaint only the selected history region; never reset a vehicle edit form/tab.
export async function watchMaintenanceHistory(db,holder,paint){
  const database=(await db.openDB()).name;let closed=false,serial=0;
  if(!holder.isConnected)return ()=>{};
  const update=async()=>{const own=++serial;try{const data=await readMaintenanceData(db);if(!closed&&holder.isConnected&&own===serial)paint(data);}catch(e){if(!closed&&holder.isConnected&&own===serial)paint(null,e);}};
  const unwatch=watchRecords(e=>{if(e.database===database&&e.stores.some(s=>MAINTENANCE_READ_STORES.includes(s)))update();});
  const visible=()=>{if(document.visibilityState!=='hidden')update();};
  const observer=new MutationObserver(()=>{if(!holder.isConnected)stop();});
  const stop=()=>{if(closed)return;closed=true;unwatch();observer.disconnect();window.removeEventListener('focus',visible);document.removeEventListener('visibilitychange',visible);};
  observer.observe(document.body,{childList:true,subtree:true});window.addEventListener('focus',visible);document.addEventListener('visibilitychange',visible);await update();return stop;
}
