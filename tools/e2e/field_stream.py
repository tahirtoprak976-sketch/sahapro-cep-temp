"""Daily stream on real mobile Chromium/IDB; synthetic records, offline shell."""
from playwright.sync_api import sync_playwright
U='http://localhost:8841/'
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 c=b.new_context(viewport={'width':360,'height':800},service_workers='allow');c.add_init_script("localStorage.setItem('sp_role','boss')")
 pg=c.new_page();errors=[];pg.on('pageerror',lambda e:errors.append(str(e)))
 pg.goto(U);pg.evaluate('async()=>await navigator.serviceWorker.ready');pg.wait_for_timeout(1200)
 result=pg.evaluate('''async()=>{const d=await import('./js/db.js'),C=await import('./js/core.js'),date=C.todayStr();const v=(await d.listActive('vehicles'))[0];const customer=await d.saveNew('customers',{name:'TEST müşteri'},'TEST');let id;for(let i=0;i<34;i++){const r=await d.saveNew('work_records',{date,customer_id:customer.id,vehicle_id:v.id,work_type:'TEST <img src=x onerror="window.__xss=1">',quantity:2,unit:'Sefer'},'TEST');id=r.id;}await d.saveNew('fuel_records',{date,liters:50,vehicle_id:v.id,fuel_source:'Müşteri Verdi'},'TEST');await d.saveNew('expense_records',{date,amount:100,category:'TEST parça',description:'filtre kelimesi'},'TEST');await d.saveNew('maintenance_records',{date,vehicle_id:v.id,maint_type:'TEST yağ',status:'Açık'},'TEST');return {date,id,v:v.id}}''')
 before=pg.evaluate("async()=>JSON.stringify(await(await import('./js/db.js')).dumpAll())")
 pg.goto(U+'#/saha-akisi');pg.wait_for_selector('[data-stream-summary]')
 assert '37 kayıt' in pg.locator('[data-stream-summary]').inner_text()
 assert pg.locator('[data-stream-record]').count()==30
 assert pg.evaluate('document.documentElement.scrollWidth<=innerWidth')
 assert pg.evaluate('window.__xss===undefined')
 pg.click('[data-stream-more]');assert pg.locator('[data-stream-record]').count()==37
 pg.click('details summary');pg.select_option('[data-stream-kind]','fuel');pg.wait_for_timeout(250);assert pg.locator('[data-stream-record]').count()==1
 assert '50 L' in pg.locator('[data-stream-summary]').inner_text()
 pg.reload();pg.wait_for_selector('[data-stream-summary]');assert pg.locator('[data-stream-record]').count()==1
 pg.click('[data-stream-record]');pg.wait_for_timeout(300);assert '#/yakit/' in pg.url
 pg.goto(U+'#/saha-akisi');pg.wait_for_selector('[data-stream-summary]')
 pg.click('details summary');pg.fill('[data-stream-search] input','filtre kelimesi');pg.click('[data-stream-search] button');pg.wait_for_timeout(250);assert pg.locator('[data-stream-record]').count()==1
 pg.goto(U+'#/saha-akisi?date=2026-02-30');pg.wait_for_selector('[role=alert]');assert 'Geçerli' in pg.locator('[role=alert]').inner_text()
 pg.goto(U+'#/saha-akisi?date=2000-01-01');pg.wait_for_selector('[data-stream-summary]');assert '0 kayıt' in pg.locator('[data-stream-summary]').inner_text()
 c.set_offline(True);pg.goto(U+'#/saha-akisi');pg.wait_for_selector('[data-stream-summary]');assert '37 kayıt' in pg.locator('[data-stream-summary]').inner_text()
 assert before==pg.evaluate("async()=>JSON.stringify(await(await import('./js/db.js')).dumpAll())")
 assert not errors,errors
 print('PASS mobile stream: mixed records, pagination, units, filters, reload, detail route, invalid/empty date, XSS, offline, zero writes',flush=True)
 b.close()
