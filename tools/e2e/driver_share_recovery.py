"""Permission-denied recovery: mocked share refusal, real download/import, synthetic data only."""
import io
from pathlib import Path
from PIL import Image
from playwright.sync_api import sync_playwright
U='http://localhost:8841/'
f=io.BytesIO();Image.new('RGB',(200,250),'green').save(f,'JPEG');photo={'name':'TEST-photo.jpg','mimeType':'image/jpeg','buffer':f.getvalue()}
MOCK="""window.__mode='deny';window.__calls=0;navigator.canShare=()=>true;navigator.share=d=>{if(window.event?.type!=='click')throw Error('lost click');window.__calls++;if(window.__mode==='deny')return Promise.reject(new DOMException('Permission denied','NotAllowedError'));if(window.__mode==='sync')throw Error('Permission denied');if(window.__mode==='cancel')return Promise.reject(new DOMException('cancel','AbortError'));if(window.__mode==='pending')return new Promise((r,j)=>window.__reject=j);return Promise.resolve();};"""
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);boss=b.new_context(viewport={'width':360,'height':800});boss.add_init_script("try{localStorage.setItem('sp_role','boss')}catch(e){}")
 pg=boss.new_page();errors=[];pg.on('pageerror',lambda e:errors.append(str(e)));pg.goto(U);pg.evaluate('async()=>await navigator.serviceWorker.ready');pg.wait_for_timeout(900)
 fixture=pg.evaluate('''async()=>{const d=await import('./js/db.js'),D=await import('./js/driver-core.js'),S=await import('./js/security.js');const c=await d.saveNew('customers',{name:'TEST Müşteri'},'test'),v=await d.saveNew('vehicles',{name:'TEST Araç'},'test'),p=await d.saveNew('personnel',{name:'TEST Soner',active:true},'test'),link=await S.newDriverLink({pid:p.id,name:p.name});return {url:'sofor.html?k='+await D.pack({...D.driverConfig(await d.dumpAll(),{personnel_id:p.id,vehicle_id:v.id}),...link.forDriver})}}''')
 driver=b.new_context(viewport={'width':360,'height':800},accept_downloads=True);driver.add_init_script(MOCK);dp=driver.new_page();downloads=[];dp.on('download',lambda d:downloads.append(d));dp.on('pageerror',lambda e:errors.append(str(e)));dp.goto(U+fixture['url']);dp.wait_for_selector('[data-cid]');dp.select_option('[data-cid]',index=1);dp.fill('[data-k=q]','1');dp.set_input_files('[data-photo]',photo);dp.wait_for_function("() => !document.querySelector('[data-add]').disabled");dp.click('[data-add]');dp.wait_for_selector('[data-save-result]');original=dp.evaluate("JSON.parse(localStorage.getItem('sp_driver_entries'))")
 def prepare():dp.click('[data-send]');dp.wait_for_selector('[data-driver-share-download]')
 def pending():return dp.evaluate("!JSON.parse(localStorage.getItem('sp_driver_entries'))[0].sent")
 prepare();dp.click('[data-driver-share-clean]');dp.wait_for_function("() => document.querySelector('[data-driver-share-status]').textContent.includes('izni reddedildi')");assert pending();assert not downloads;assert not dp.locator('[data-driver-share-download]').is_disabled();assert dp.locator('[data-driver-share-manual]').is_visible();assert dp.locator('.driver-share-panel').evaluate('(e)=>e.scrollWidth<=e.clientWidth')
 with dp.expect_download() as ev:dp.click('[data-driver-share-download]')
 dl=ev.value;data=Path(dl.path()).read_bytes();assert dl.suggested_filename.endswith('.sahapro.zip');assert b'SP1:' in data and b'photos/' in data;assert dp.evaluate("JSON.parse(localStorage.getItem('sp_driver_entries'))")==original;assert 'beklemede' in dp.inner_text('[data-driver-share-manual]');assert dp.evaluate('window.__calls')==1
 dp.click('[data-driver-share-cancel]');dp.wait_for_function("() => !document.querySelector('[data-driver-share]')");assert pending()
 print('PASS Promise NotAllowedError reveals instructions/download; real downloaded archive leaves entries and pending status unchanged',flush=True)
 pg.goto(U+'index.html#/akilli-asistan');pg.reload();pg.wait_for_selector('[data-photos]');pg.set_input_files('[data-photos]',{'name':dl.suggested_filename,'mimeType':'application/zip','buffer':data});pg.click('[data-ask]');pg.wait_for_selector('[data-kind=work]');pg.locator('[data-kind=work] [data-pick]').check();pg.click('[data-save]');pg.wait_for_function("() => !document.querySelector('[data-kind=work]')");result=pg.evaluate("async()=>{const d=await import('./js/db.js');return {w:await d.listActive('work_records'),a:await d.getAll('attachments')}}");assert len(result['w'])==len(result['a'])==1;assert result['w'][0]['driver_entry_id']==original[0]['id'];assert result['a'][0]['name']==photo['name']
 print('PASS downloaded exact signed bundle imports original work and photo on patron device without native sharing',flush=True)
 # Synchronous permission failures and cancel both retain the same pending record.
 dp.evaluate("window.__mode='sync'");prepare();dp.click('[data-driver-share-clean]');dp.wait_for_function("() => document.querySelector('[data-driver-share-status]').textContent.includes('izni reddedildi')");assert pending();assert len(downloads)==1;dp.click('[data-driver-share-cancel]')
 dp.evaluate("window.__mode='cancel'");prepare();dp.click('[data-driver-share-clean]');dp.wait_for_function("() => document.querySelector('[data-driver-share-status]').textContent.includes('iptal')");assert pending();assert len(downloads)==1;dp.click('[data-driver-share-cancel]')
 print('PASS synchronous Permission denied and AbortError never start an automatic download or mark sent',flush=True)
 # Downloads also work if Web Share is unavailable entirely.
 dp.evaluate("navigator.share=undefined;navigator.canShare=()=>false");prepare();assert dp.locator('[data-driver-share-clean]').is_disabled();assert not dp.locator('[data-driver-share-download]').is_disabled()
 with dp.expect_download() as ev:dp.click('[data-driver-share-download]')
 assert Path(ev.value.path()).read_bytes()==data;assert pending();dp.click('[data-driver-share-cancel]')
 print('PASS no Web Share support still allows identical file download with record pending',flush=True)
 # A stale prepared packet must not be downloaded, including changed connection identity.
 prepare();dp.evaluate("()=>{const e=JSON.parse(localStorage.getItem('sp_driver_entries'));e[0].q=9;localStorage.setItem('sp_driver_entries',JSON.stringify(e))}");dp.click('[data-driver-share-download]');dp.wait_for_function("() => document.querySelector('[data-driver-share-status]').textContent.includes('başka sekmede')");assert len(downloads)==2;dp.click('[data-driver-share-cancel]');dp.reload();dp.wait_for_selector('[data-send]');prepare();dp.evaluate("()=>{const c=JSON.parse(localStorage.getItem('sp_driver_cfg'));c.ts=Date.now();localStorage.setItem('sp_driver_cfg',JSON.stringify(c))}");dp.click('[data-driver-share-download]');dp.wait_for_function("() => document.querySelector('[data-driver-share-status]').textContent.includes('bağlantısı başka sekmede')");assert len(downloads)==2;assert pending();dp.click('[data-driver-share-cancel]')
 assert not errors,errors
 print('PASS changed row or connection blocks stale download; no browser errors',flush=True)
 b.close()
