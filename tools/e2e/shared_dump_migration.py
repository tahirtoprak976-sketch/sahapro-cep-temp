"""v5 -> v6 on real IndexedDB, recovery copy, old backup and corrupt backup rejection."""
import sys, json
from playwright.sync_api import sync_playwright

U = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8841/'
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    c = b.new_context()
    c.add_init_script("localStorage.setItem('sp_role','boss')")
    page = c.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    # A real same-origin asset avoids GitHub Pages' restrictive CSP on a 404.
    # The app has not run yet, so this profile can still start as a v5 device.
    page.goto(U + 'manifest.webmanifest')
    seed = page.evaluate("""async()=>{
      const C=await import('./js/core.js'), date=C.todayStr();
      const rows={
        customers:[C.newRecord({id:'OLD-C',name:'TEST Old Customer'})],
        vehicles:[C.newRecord({id:'OLD-V',name:'TEST Old Truck',type:'Kamyon'})],
        dump_sites:[C.newRecord({id:'OLD-D',name:'TEST Old Dump',fee:200,fee_unit:'Ton'})],
        work_records:[C.newRecord({id:'OLD-W',date,vehicle_id:'OLD-V',customer_id:'OLD-C',dump_site_id:'OLD-D',quantity:1,unit:'Sefer',tonnage:10,work_type:'Hafriyat Nakliye'})],
        expense_records:[C.newRecord({id:'OLD-E',date,amount:10000,dump_site_id:'OLD-D',dump_deposit:true,category:'Döküm'})],
        attachments:[{id:'OLD-A',record_type:'work',record_id:'OLD-W',name:'TEST-original.txt',size:13,blob:new Blob(['TEST ORIGINAL'])}],
        meta:[{key:'seeded_v1',value:true},{key:'migrated_v2',value:true},{key:'migrated_business_v3',value:true},{key:'dump_fees_seed_v1',value:true}],
      };
      const connection=await new Promise((res,rej)=>{const r=indexedDB.open('sahapro_cep_db',5);r.onupgradeneeded=()=>{
        for(const name of [...C.ENTITY_STORES.filter(s=>s!=='dump_entries'),'attachments','meta','drafts'])
          r.result.createObjectStore(name,{keyPath:name==='meta'?'key':name==='drafts'?'form':'id'});
      };r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});
      await new Promise((res,rej)=>{const t=connection.transaction(Object.keys(rows),'readwrite');for(const [s,list] of Object.entries(rows))for(const row of list)t.objectStore(s).put(row);t.oncomplete=res;t.onerror=()=>rej(t.error)});connection.close();return {date};
    }""")
    page.goto(U + 'index.html#/dokum-hesap/OLD-D')
    page.wait_for_selector('[data-dump-balance]')
    result = page.evaluate("""async()=>{
      const db=await import('./js/db.js'), L=await import('./js/dump-ledger-db.js'), A=await import('./js/dump-account.js'), F=await import('./js/dump-fees.js'), B=await import('./js/backup.js');
      const d=await db.dumpAll(), conn=await db.openDB(), checks={};
      checks.version=conn.version===6&&conn.objectStoreNames.contains('dump_entries');
      checks.oldRows=d.work_records.some(w=>w.id==='OLD-W')&&d.expense_records.some(e=>e.id==='OLD-E')&&d.dump_entries.length===0;
      checks.photo=await(await db.get('attachments','OLD-A')).blob.text()==='TEST ORIGINAL';
      checks.balance=A.dumpAccounts(d,{siteId:'OLD-D'})[0].balance===10000;
      checks.estimate=F.dumpFee(d,d.work_records.find(w=>w.id==='OLD-W')).amount===2000;
      const recovery=await new Promise((res,rej)=>{const r=indexedDB.open('sahapro_cep_db_recovery');r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});
      const snapshot=await new Promise((res,rej)=>{const r=recovery.transaction('snapshots').objectStore('snapshots').getAll();r.onsuccess=()=>res(r.result.find(s=>s.version===5));r.onerror=()=>rej(r.error)});recovery.close();
      checks.recovery=!!snapshot&&snapshot.stores.work_records.some(w=>w.id==='OLD-W')&&await snapshot.stores.attachments[0].blob.text()==='TEST ORIGINAL';
      const oldBackup=await B.fullBackup(db,{attachments:'base64'});oldBackup.schema_version=5;oldBackup.app_version='v3.9.58';delete oldBackup.data.dump_entries;
      const site=await db.get('dump_sites','OLD-D');await db.saveExisting('dump_sites',site,{fee:300,fee_unit:'Ton'},'TEST migration tariff');
      checks.oldCostPreserved=F.dumpFee(await db.dumpAll(),await db.get('work_records','OLD-W')).amount===2000;
      const receipt=await L.saveDumpEntry({kind:'RECEIPT',date:d.work_records[0].date,dump_site_id:'OLD-D',vehicle_id:'OLD-V',work_record_id:'OLD-W',amount:2100,trips:1,receipt_no:'TEST-MIGRATE'},[],'TEST-MIGRATE');
      const backup=await B.fullBackup(db,{attachments:'base64'});
      const reject=async(obj)=>{const before=JSON.stringify(await db.dumpAll());try{await B.restoreBackup(db,obj,true);return false}catch(e){return before===JSON.stringify(await db.dumpAll())}};
      let bad=structuredClone(backup);bad.data.dump_entries[0].trips=0;checks.rejectBadTrips=await reject(bad);
      bad=structuredClone(backup);bad.data.vehicles=bad.data.vehicles.map(v=>v.id==='OLD-V'?{...v,deleted_at:new Date().toISOString()}:v);checks.rejectDeletedVehicle=await reject(bad);
      bad=structuredClone(backup);bad.data.dump_entries[0].work_record_id='MISSING';checks.rejectMissingWork=await reject(bad);
      return {checks,oldBackup};
    }""")
    assert all(result['checks'].values()), result['checks']
    print('PASS ' + json.dumps(result['checks']), flush=True)
    c2 = b.new_context()
    c2.add_init_script("localStorage.setItem('sp_role','boss')")
    other = c2.new_page()
    other.goto(U + 'index.html#/dokum-hesap')
    other.wait_for_function("()=>document.querySelector('#screen')?.textContent.includes('Ortak Döküm Hesapları')")
    restored = other.evaluate("""async backup=>{const db=await import('./js/db.js'),B=await import('./js/backup.js'),A=await import('./js/dump-account.js');await B.restoreBackup(db,backup);return {balance:A.dumpAccounts(await db.dumpAll(),{siteId:'OLD-D'})[0].balance,photo:await(await db.get('attachments','OLD-A')).blob.text(),entries:(await db.listActive('dump_entries')).length}}""", result['oldBackup'])
    assert restored == {'balance': 10000, 'photo': 'TEST ORIGINAL', 'entries': 0}, restored
    assert not errors, errors
    print('PASS schema5 backup restores into clean v6; no invented financial migration; original binary and recovery copy preserved', flush=True)
    b.close()
