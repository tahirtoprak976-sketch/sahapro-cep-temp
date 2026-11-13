import * as db from './js/db.js';
const connection=await db.openDB();if(connection.name!=='sahapro_onizleme_v31105_db')throw Error('Örnek veri alanı doğrulanamadı.');
const key='preview_seed_v31105';if(!await db.metaGet(key)){
 const {fixture,fixtureSettings}=await import('./tests/assistant-gold/real-messages/fixture.mjs'),data=fixture();
 if(Object.values(data).some(rows=>rows.some(r=>!String(r.id).startsWith('TEST_'))))throw Error('Yalnız TEST kayıtları yüklenebilir.');
 await new Promise((resolve,reject)=>{let error;const stores=[...connection.objectStoreNames].filter(s=>!['meta','drafts','attachments'].includes(s)),tx=connection.transaction([...stores,'meta'],'readwrite'),meta=tx.objectStore('meta'),ready=meta.get(key);
 ready.onsuccess=()=>{if(ready.result?.value)return;let left=stores.length;for(const store of stores){const count=tx.objectStore(store).count();count.onsuccess=()=>{if(count.result){error=Error('Örnek alan boş değil; mevcut kayıtlara dokunulmadı.');tx.abort();return;}if(!--left){for(const[table,rows]of Object.entries(data))for(const row of rows)tx.objectStore(table).put(row);meta.put({key:'assistant_rules',value:fixtureSettings().assistant_rules});meta.put({key:'schema_version_current',value:7});meta.put({key,value:true});}};}};
 tx.oncomplete=resolve;tx.onerror=tx.onabort=()=>reject(error||tx.error||Error('Örnek veri yüklenemedi.'));});
}
if(!localStorage.getItem('spx_v31105_role'))localStorage.setItem('spx_v31105_role','boss');
await import('./js/app.js');
