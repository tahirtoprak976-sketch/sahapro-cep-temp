"""Storage-open failure is recoverable without promises of intact data or automatic reset."""
import sys,uuid,json
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright
base=(sys.argv[1]if len(sys.argv)>1 else 'http://localhost:8841/').rstrip('/')+'/';assert urlparse(base).hostname in ('localhost','127.0.0.1')
with sync_playwright() as w:
 b=w.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);c=b.new_context(viewport={'width':360,'height':850},service_workers='block');c.add_init_script("localStorage.setItem('sp_role','boss');const nativeOpen=IDBFactory.prototype.open;IDBFactory.prototype.open=function(...args){if(sessionStorage.getItem('TEST_storage_block')==='1')throw Error('TEST temporary storage failure');return nativeOpen.apply(this,args);};")
 p=c.new_page();errors=[];p.on('pageerror',lambda e:errors.append(str(e)));app=base+'index.html?db=TEST_startup109_'+uuid.uuid4().hex+'#/daha';p.goto(app);p.wait_for_selector('#screen[data-view-ready="1"]')
 p.evaluate("async()=>await(await import('./js/db.js')).saveNew('customers',{name:'TEST Keep Existing Customer'},'TEST')")
 before=p.evaluate("async()=>await(await import('./js/db.js')).dumpAll()")
 p.evaluate("sessionStorage.setItem('TEST_storage_block','1')");p.reload();p.wait_for_function("()=>document.querySelector('#screen')?.textContent.includes('TEST temporary storage failure')")
 assert p.locator('[data-boot-error]').count()==1,'Storage failure must provide a recovery screen without claiming data is safe'
 assert 'güvendedir' not in p.locator('#screen').inner_text() and 'Verileri silmeyin' in p.locator('[data-boot-error]').inner_text()
 assert p.evaluate('document.documentElement.scrollWidth<=innerWidth')
 p.evaluate("sessionStorage.setItem('TEST_storage_block','0')")
 with p.expect_navigation():p.click('[data-boot-retry]')
 p.wait_for_selector('#screen[data-view-ready="1"]');assert p.evaluate("async()=>await(await import('./js/db.js')).dumpAll()")==before
 assert not errors,errors;print(json.dumps({'storageFailureRecovered':True,'existingDataPreserved':True,'automaticReset':False,'unverifiedSafetyClaim':False,'pageErrors':errors}),flush=True);b.close()
