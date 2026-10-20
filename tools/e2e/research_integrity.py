"""Research findings reproduced on real IDB and app update UI. Synthetic data only."""
import io,base64,zipfile,json
from PIL import Image
from playwright.sync_api import sync_playwright
U='http://localhost:8841/'
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 c=b.new_context(viewport={'width':390,'height':844},service_workers='allow');c.add_init_script("localStorage.setItem('sp_role','boss')")
 pg=c.new_page();errors=[];calls=[];pg.on('pageerror',lambda e:errors.append(str(e)))
 pg.route('https://generativelanguage.googleapis.com/**',lambda r:(calls.append(r.request.url),r.abort()))
 pg.goto(U);pg.evaluate('async()=>await navigator.serviceWorker.ready');pg.wait_for_timeout(900)
 ids=pg.evaluate("""async()=>{const db=await import('./js/db.js'),D=await import('./js/driver-core.js'),S=await import('./js/security.js'),C=await import('./js/core.js');const v=(await db.listActive('vehicles'))[0],person=(await db.listActive('personnel'))[0];const customer=await db.saveNew('customers',{name:'RESEARCH-0'},'TEST');const w=await db.saveNew('work_records',{customer_id:customer.id,vehicle_id:v.id,personnel_id:person.id,date:C.todayStr(),work_type:'Hafriyat Nakliye',quantity:1,unit:'Sefer',description:'RESEARCH-0'},'TEST');await db.addAttachment('work',w.id,new File(['phase-0'],'RESEARCH-0.txt',{type:'text/plain'}));await db.metaSet('research_phase','RESEARCH-0');await db.metaSet('last_backup_at','2020-01-01T00:00:00Z');await db.metaSet('last_backup_result',{at:'2020-01-01T00:00:00Z',method:'shared',files:1});await db.storePdfHistoryFile('a'.repeat(64),new File(['%PDF-1.4 test'],'pending.pdf',{type:'application/pdf'}));const link=await S.newDriverLink({pid:person.id,name:person.name});const cfg={...D.driverConfig(await db.dumpAll(),{personnel_id:person.id,vehicle_id:v.id}),...link.forDriver};return {c:customer.id,w:w.id,packet:await D.driverMessage([{id:'research-driver',date:C.todayStr(),vid:v.id,cid:customer.id,wt:'Hafriyat Nakliye',q:2,u:'Sefer',ph:1}],cfg)}}""")
 pg.evaluate("""ids=>{window.__ids=ids;window.__writePhase=async n=>{const m=await import('./js/db.js'),db=await m.openDB();return new Promise((resolve,reject)=>{const t=db.transaction(['customers','work_records','attachments','meta'],'readwrite');const label='RESEARCH-'+n;const c=t.objectStore('customers').get(ids.c);c.onsuccess=()=>t.objectStore('customers').put({...c.result,name:label});const w=t.objectStore('work_records').get(ids.w);w.onsuccess=()=>t.objectStore('work_records').put({...w.result,description:label});const a=t.objectStore('attachments').getAll();a.onsuccess=()=>{const found=a.result.find(x=>x.record_id===ids.w);t.objectStore('attachments').put({...found,name:label,blob:new Blob([label]),size:label.length})};t.objectStore('meta').put({key:'research_phase',value:label});t.oncomplete=()=>resolve();t.onerror=t.onabort=()=>reject(t.error)})}}""",ids)
 result=pg.evaluate("""async()=>{const db=await import('./js/db.js');const before=(await db.getAll('customers')).find(x=>x.id===__ids.c).name;await __writePhase(1);const after=(await db.getAll('work_records')).find(x=>x.id===__ids.w).description;return {before,after,mixed:before!==after}}""")
 assert result['mixed'];print('REPRODUCED old separate-read mixture:',result,flush=True)
 result=pg.evaluate("""async()=>{const db=await import('./js/db.js');for(let n=2;n<32;n++){const [s]=await Promise.all([db.readSnapshot({drafts:true}),__writePhase(n)]);const labels=[s.data.customers.find(x=>x.id===__ids.c).name,s.data.work_records.find(x=>x.id===__ids.w).description,s.attachments.find(x=>x.record_id===__ids.w).name,s.meta.find(x=>x.key==='research_phase').value];if(new Set(labels).size!==1)throw Error(JSON.stringify(labels));}return true}""")
 assert result;print('PASS 30 concurrent snapshot/write interleavings: records, photos and settings agree',flush=True)
 backup=pg.evaluate("""async()=>{const db=await import('./js/db.js'),B=await import('./js/backup.js'),E=await import('./js/backup-crypt.js');let reads=0;const adapter={...db,readSnapshot:async opts=>{reads++;const s=await db.readSnapshot(opts);await __writePhase(100+reads);return s}};const full=await B.fullBackup(adapter);const labels=[full.data.customers.find(x=>x.id===__ids.c).name,full.data.work_records.find(x=>x.id===__ids.w).description,full.attachments.find(x=>x.record_id===__ids.w).name,full.meta.find(x=>x.key==='research_phase').value];if(new Set(labels).size!==1)throw Error('mixed full backup');const parts=await B.backupParts(adapter,{budget:50000}),out=[];await __writePhase(200);for await(const part of parts){if(!part.coverage.consistent_snapshot)throw Error('missing consistency flag');out.push(part)};const head=out[0],att=out.flatMap(x=>x.attachments).find(x=>x.record_id===__ids.w);if(head.data.work_records.find(x=>x.id===__ids.w).description!==att.name)throw Error('mixed parts');if(reads!==2)throw Error('multiple snapshots');const bytes=await E.encodeBackup(full,'TEST-Research-1');let str='';for(let i=0;i<bytes.length;i+=8192)str+=String.fromCharCode(...bytes.subarray(i,i+8192));return {b64:btoa(str),coverage:full.coverage,labels}}""")
 assert backup['coverage']['pdf_draft_files_not_included']==1 and not backup['coverage']['draft_files_included']
 print('PASS full/partitioned backup remains fixed during later writes; excluded PDF is disclosed',flush=True)
 target=b.new_context(service_workers='block');target.add_init_script("localStorage.setItem('sp_role','boss')");tp=target.new_page();tp.goto(U);tp.wait_for_timeout(700)
 restored=tp.evaluate("""async b64=>{const db=await import('./js/db.js'),B=await import('./js/backup.js'),E=await import('./js/backup-crypt.js');const obj=await E.decodeBackup(Uint8Array.from(atob(b64),c=>c.charCodeAt(0)),async()=>'TEST-Research-1');const U=await import('./js/update-safety.js');const job=B.restoreBackup(db,obj,true),busy=U.updateRisk(null).busy;await job;const s=await db.readSnapshot();return {c:s.data.customers.find(x=>x.name.startsWith('RESEARCH-')).name,w:s.data.work_records.find(x=>x.description.startsWith('RESEARCH-')).description,photo:s.attachments.find(x=>x.record_type==='work').name,handoff:await db.metaGet('last_backup_result'),busy}}""",backup['b64'])
 assert len(set(restored[k] for k in ['c','w','photo']))==1 and restored['handoff'] is None and restored['busy'];target.close();print('PASS encrypted snapshot restores consistent records and original file to separate browser',flush=True)
 # Edit forms also survive activation and cancellation without writing the record.
 pg.goto(U+'index.html#/isler/'+ids['w']+'/edit');pg.wait_for_selector('[name=quantity]');pg.fill('[name=quantity]','7')
 pg.evaluate("window.__editMarker='keep';navigator.serviceWorker.dispatchEvent(new Event('controllerchange'))");pg.wait_for_timeout(700)
 assert pg.input_value('[name=quantity]')=='7' and pg.evaluate("window.__editMarker==='keep'")
 pg.click('#update-bar [data-upd]');pg.wait_for_selector('.sheet');pg.click('.sheet button[data-x="0"]')
 assert pg.input_value('[name=quantity]')=='7' and pg.evaluate("async id=>(await(await import('./js/db.js')).get('work_records',id)).quantity",ids['w'])==1
 print('PASS changed edit form survives worker activation/update cancel; original record unchanged',flush=True)
 # Actual assistant preview, photo and cancellation must survive controller changes.
 pg.goto(U+'index.html#/akilli-asistan');pg.wait_for_selector('[data-msg]');pg.fill('[data-msg]',ids['packet'])
 f=io.BytesIO();Image.new('RGB',(400,500),'white').save(f,'JPEG');pg.set_input_files('[data-photos]',{'name':'proof.jpg','mimeType':'image/jpeg','buffer':f.getvalue()});pg.click('[data-ask]');pg.wait_for_selector('[data-out] .card[data-kind="work"]')
 pg.evaluate("window.__marker='keep';navigator.serviceWorker.dispatchEvent(new Event('controllerchange'))");pg.wait_for_timeout(1000)
 assert pg.evaluate("window.__marker==='keep'") and pg.locator('[data-out] .card[data-kind=work]').count()==1 and pg.eval_on_selector('[data-photos]','el=>el.files.length')==1
 pg.click('#update-bar [data-upd]');pg.wait_for_selector('.sheet');pg.click('.sheet button[data-x="0"]')
 assert pg.evaluate("window.__marker==='keep'") and pg.locator('[data-out] .card[data-kind=work]').count()==1
 print('PASS actual assistant preview and photo survive worker activation and canceled update',flush=True)
 pg.evaluate("async()=>{window.__release=(await import('./js/update-safety.js')).startActivity('test backup')}")
 pg.click('#update-bar [data-upd]');pg.wait_for_timeout(200);assert pg.locator('.sheet').count()==0 and pg.evaluate("window.__marker==='keep'")
 pg.evaluate('window.__release()');print('PASS active backup blocks reload without discarding preview',flush=True)
 pg.click('#update-bar [data-upd]');pg.wait_for_selector('.sheet')
 with pg.expect_navigation():pg.click('.sheet button[data-x="1"]')
 assert pg.evaluate('window.__marker===undefined');print('PASS explicit discard confirmation permits deliberate reload',flush=True)
 pg.goto(U+'index.html#/ayarlar');pg.wait_for_selector('[data-device-storage]');pg.wait_for_function("() => document.querySelector('[data-device-storage]').textContent.includes('Yedeğe girmeyen')")
 text=pg.inner_text('[data-device-storage]');assert '1.' in text and 'Telefonun toplam boş alanı değildir' in text
 assert 'paylaşılmamış kayıtlar dahil değildir' in pg.inner_text('#screen')
 for width in [320,390,768]:
  pg.set_viewport_size({'width':width,'height':850});assert pg.evaluate('document.documentElement.scrollWidth<=document.documentElement.clientWidth+1')
 pg.fill('[data-coform] [name=title]','Unsaved company TEST') if pg.locator('[data-coform] [name=title]').count() else pg.locator('[data-coform] input').first.fill('Unsaved company TEST')
 # Native handoff is mocked, not delivered. Cancellation never advances backup timestamp.
 pg.evaluate("""()=>{window.__shareCalls=0;navigator.canShare=()=>true;navigator.share=async()=>{window.__shareCalls++;await new Promise((resolve,reject)=>{window.__shareOK=resolve;window.__shareCancel=()=>reject(new DOMException('cancel','AbortError'))})};window.__backupJob=(async()=>{const db=await import('./js/db.js');await(await import('./js/m-crm.js')).doBackup({db,root:document.querySelector('#screen')})})()}""")
 pg.wait_for_function('() => window.__shareCalls===1')
 pg.evaluate("async()=>{const db=await import('./js/db.js');await(await import('./js/m-crm.js')).doBackup({db,root:document.querySelector('#screen')})}")
 assert pg.evaluate('window.__shareCalls')==1 and pg.evaluate("async()=>(await import('./js/update-safety.js')).updateRisk(document.querySelector('#screen')).busy")
 pg.evaluate('window.__shareCancel();');pg.evaluate('window.__backupJob')
 assert pg.evaluate("async()=>(await(await import('./js/db.js')).metaGet('last_backup_at'))")=='2020-01-01T00:00:00Z'
 assert not pg.evaluate("async()=>(await import('./js/update-safety.js')).updateRisk(document.querySelector('#screen')).busy")
 print('PASS duplicate backup blocked; canceled share retains old timestamp and releases busy lock',flush=True)
 pg.evaluate("()=>{window.__backupJob=(async()=>{const db=await import('./js/db.js');await(await import('./js/m-crm.js')).doBackup({db,root:document.querySelector('#screen')})})()}")
 pg.wait_for_function('() => window.__shareCalls===2');pg.evaluate('window.__shareOK()');pg.evaluate('window.__backupJob')
 handoff=pg.evaluate("async()=>{const db=await import('./js/db.js');return {result:await db.metaGet('last_backup_result'),at:await db.metaGet('last_backup_at')}}")
 assert handoff['result']['method']=='shared' and handoff['result']['at']==handoff['at'] and handoff['result']['snapshot_at']
 pg.click('[data-device-refresh]');pg.wait_for_function("() => document.querySelector('[data-device-storage]').textContent.includes('paylaşım paneline verildi')")
 print('PASS completed share records handoff, never claims external delivery; status refresh reflects actual method',flush=True)
 assert '2020' not in pg.inner_text('[data-backup-last]') and pg.locator('[data-coform] input').first.input_value()=='Unsaved company TEST'
 pg.evaluate("async id=>{const db=await import('./js/db.js');await db.addAttachment('work',id,new File(['distinct-1'],'same.txt',{type:'text/plain'}));await db.addAttachment('work',id,new File(['distinct-2'],'same.txt',{type:'text/plain'}))}",ids['w'])
 beforeZIP=pg.evaluate("async()=>(await(await import('./js/db.js')).metaGet('last_backup_at'))")
 c.set_offline(True)
 with pg.expect_download() as download:pg.click('[data-zip]')
 with zipfile.ZipFile(download.value.path()) as z:
  manifest=json.loads(z.read('arsiv_dizini.json'))
  assert manifest['encrypted'] is False and len(manifest['attachments'])==3
  paths=[a['path'] for a in manifest['attachments']];assert len(paths)==len(set(paths))
  for a in manifest['attachments']:assert len(z.read(a['path']))==a['size']
 assert pg.evaluate("async()=>(await(await import('./js/db.js')).metaGet('last_backup_at'))")==beforeZIP
 c.set_offline(False)
 print('PASS real offline archive ZIP contains every file with unique paths and manifest; archive does not advance restore-backup timestamp',flush=True)
 pg.screenshot(path='/tmp/research-storage-v3930.png',full_page=True)
 assert not errors and not calls,(errors,calls)
 print('PASS storage coverage/status panel on mobile widths; no AI requests/page errors',flush=True)
 b.close()
