import {PART_READ_STORES,readPartData} from './parts-history-core.js';
import {watchRecords} from './record-refresh.js';
// Refresh only the list. In-progress part/warranty forms remain untouched.
export async function watchPartHistory(db,holder,paint){
  const database=(await db.openDB()).name;let closed=false,serial=0;
  if(!holder.isConnected)return;
  const update=async()=>{const own=++serial;try{const d=await readPartData(db);if(!closed&&holder.isConnected&&own===serial)paint(d);}catch(e){if(!closed&&holder.isConnected&&own===serial)paint(null,e);}};
  const unwatch=watchRecords(e=>{if(e.database===database&&e.stores.some(s=>PART_READ_STORES.includes(s)))update();});
  const visible=()=>{if(document.visibilityState!=='hidden')update();};
  const stop=()=>{if(closed)return;closed=true;unwatch();observer.disconnect();window.removeEventListener('focus',visible);document.removeEventListener('visibilitychange',visible);};
  const observer=new MutationObserver(()=>{if(!holder.isConnected)stop();});observer.observe(document.body,{childList:true,subtree:true});window.addEventListener('focus',visible);document.addEventListener('visibilitychange',visible);await update();return stop;
}
