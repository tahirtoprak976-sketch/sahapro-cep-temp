"""Prepared schema8 on isolated TEST databases only; no app bootstrap or business data."""
import sys,json,uuid
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright
base=(sys.argv[1] if len(sys.argv)>1 else 'http://localhost:8857/').rstrip('/')+'/'
assert urlparse(base).hostname in ('localhost','127.0.0.1')
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 c=b.new_context();page=c.new_page();page.goto(base+'robots.txt')
 result=page.evaluate('''async token=>{
 const {upgradePersonnelLegal}=await import('/js/personnel-legal/migration.js');
 const request=r=>new Promise((yes,no)=>{r.onsuccess=()=>yes(r.result);r.onerror=()=>no(r.error)});
 const row={id:'TEST_P',name:'TEST Çalışan',start_date:'2020-01-01',birth_date:'1990-01-01',legacy_custom:{keep:true}};
 const run=async abort=>{
  const name='TEST_LEGAL_'+token+(abort?'_rollback':'_upgrade');if(!name.startsWith('TEST_'))throw Error('TEST only');
  const initial=indexedDB.open(name,7);initial.onupgradeneeded=()=>{for(const s of ['personnel','personnel_events','work_records','attachments'])initial.result.createObjectStore(s,{keyPath:'id'})};
  const old=await request(initial),tx=old.transaction(['personnel','personnel_events','work_records','attachments'],'readwrite');
  tx.objectStore('personnel').put(row);tx.objectStore('personnel_events').put({id:'TEST_E',personnel_id:row.id,event_type:'İzin',date:'2026-01-01'});
  tx.objectStore('work_records').put({id:'TEST_W',personnel_id:row.id,quantity:2});tx.objectStore('attachments').put({id:'TEST_A',blob:new Blob(['TEST original bytes'],{type:'application/pdf'})});
  await new Promise((yes,no)=>{tx.oncomplete=yes;tx.onabort=()=>no(tx.error)});old.close();
  const upgrading=indexedDB.open(name,8);upgrading.onupgradeneeded=()=>{upgradePersonnelLegal(upgrading.result,upgrading.transaction,7);if(abort)upgrading.transaction.abort()};
  let conn;if(abort){try{await request(upgrading);throw Error('abort expected')}catch(e){if(e.name!=='AbortError')throw e}conn=await request(indexedDB.open(name))}else conn=await request(upgrading);
  const read=async store=>request(conn.transaction(store).objectStore(store).getAll());
  if(JSON.stringify((await read('personnel'))[0])!==JSON.stringify(row))throw Error('personnel mutated');
  if((await read('personnel_events'))[0].event_type!=='İzin'||(await read('work_records'))[0].quantity!==2)throw Error('history mutated');
  if(await (await read('attachments'))[0].blob.text()!=='TEST original bytes')throw Error('attachment changed');
  if(conn.version!==(abort?7:8)||conn.objectStoreNames.contains('izin_kayitlari')===abort)throw Error('atomic version/store mismatch');
  if(!abort){for(const s of ['izin_kayitlari','puantaj_kayitlari']){if((await read(s)).length)throw Error('automatic backfill');if(!conn.transaction(s).objectStore(s).indexNames.contains('personelId'))throw Error('index missing')}}
  conn.close();await request(indexedDB.deleteDatabase(name));return true;
 };
 return {upgrade:await run(false),rollback:await run(true),legacyRowsPreserved:true,originalAttachmentBytesPreserved:true,noBackfill:true};
}''',uuid.uuid4().hex[:10]);print(json.dumps(result));b.close()
