"""Read-only vehicle dossier, reactive region without losing the selected tab; TEST data only."""
import sys,uuid
from playwright.sync_api import sync_playwright
U=sys.argv[1] if len(sys.argv)>1 else 'http://localhost:8849/'
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);c=b.new_context(viewport={'width':360,'height':800});c.add_init_script("localStorage.setItem('sp_role','boss')")
 p=c.new_page();errors=[];p.on('pageerror',lambda e:errors.append(str(e)));app=U+'index.html?db=TEST_fleet129_'+uuid.uuid4().hex
 p.goto(app+'#/daha');p.wait_for_selector('#screen[data-view-ready="1"]')
 ids=p.evaluate("""async()=>{const db=await import('./js/db.js'),{todayStr,addDays}=await import('./js/core.js');const date=todayStr();
 const v=await db.saveNew('vehicles',{name:'TEST Vehicle129',type:'Kamyon'},'TEST'),other=await db.saveNew('vehicles',{name:'TEST Other'},'TEST');
 const doc=await db.saveNew('documents',{owner_type:'vehicle',owner_id:v.id,vehicle_id:v.id,doc_no:'TEST-OLD129',category:'Muayene Belgesi',date:addDays(date,-365),expiry_date:addDays(date,-1)},'TEST');
 await db.saveNew('maintenance_records',{vehicle_id:v.id,date,maint_type:'Arıza',description:'TEST repair',status:'Serviste',cost:250},'TEST');
 await db.saveNew('maintenance_records',{vehicle_id:other.id,date,maint_type:'Arıza',description:'TEST other',status:'Açık',cost:99000},'TEST');
 await (await import('./js/solo-db.js')).saveMeter({vehicle_id:v.id,date,kind:'km',value:12345},'TEST-meter129');return {v:v.id,doc:doc.id,date};}""")
 p.wait_for_timeout(200);snapshot="async()=>{const db=await import('./js/db.js');return {data:await db.dumpAll(),audit:await db.getAll('audit_log')}}";before=p.evaluate(snapshot)
 p.goto(app+'#/filo/'+ids['v']);p.wait_for_selector('#screen[data-view-ready="1"]');assert p.locator('[data-fleet-desk]').count()==1,'FLEET_DESK_MISSING'
 h=p.locator('[data-fleet-desk]');assert h.locator('.stat b').all_text_contents()==['1','1','0','1'];assert '250' in h.locator('[data-fleet-known-cost]').inner_text();assert '99.000' not in h.inner_text();assert '12.345' in h.locator('[data-fleet-meters]').inner_text()
 assert h.locator('[data-fleet-next]').get_attribute('href')=='#/filo-belgeleri?vehicle_id='+ids['v']
 assert h.locator('[data-fleet-maintenance-pdf]').get_attribute('href')=='#/detayli-rapor?k=bakim&id='+ids['v']+'&p=all'
 assert p.evaluate(snapshot)==before,'opening dossier must not write data/audit'
 p.click('[data-tab="maintenance_records"]');p.wait_for_selector('[data-maintenance-related]');p.click('[data-fleet-desk-refresh]');p.wait_for_function("()=>document.querySelector('[data-fleet-desk] .stat b')?.textContent==='1'");assert p.locator('[data-tab="maintenance_records"]').evaluate("e=>e.classList.contains('on')")
 assert p.evaluate(snapshot)==before,'refresh must be read-only'
 p.evaluate("""async ids=>{const db=await import('./js/db.js'),{addDays}=await import('./js/core.js');await db.saveNew('documents',{owner_type:'vehicle',owner_id:ids.v,vehicle_id:ids.v,doc_no:'TEST-NEW129',category:'Muayene Belgesi',date:ids.date,expiry_date:addDays(ids.date,365)},'TEST renewed');}""",ids)
 p.wait_for_function("()=>document.querySelector('[data-fleet-desk] .stat b')?.textContent==='0'");assert p.locator('[data-tab="maintenance_records"]').evaluate("e=>e.classList.contains('on')")
 assert 'Açık bakım' in h.locator('[data-fleet-next]').inner_text();after=p.evaluate(snapshot);p.click('[data-fleet-desk-refresh]');p.wait_for_timeout(200);assert p.evaluate(snapshot)==after
 assert p.evaluate('document.documentElement.scrollWidth<=innerWidth'),'phone overflow'
 p.goto(app+'#/filo/'+ids['v']+'/edit');p.wait_for_selector('[name=km]');p.fill('[name=km]','54321');p.evaluate("window.dispatchEvent(new Event('focus'))");p.wait_for_timeout(200);assert p.input_value('[name=km]')=='54321','closed dossier listener must not replace edit fields'
 assert not errors,errors;print('fleet_desk129 PASS: exact vehicle, live renewal, maintenance not payment, meter, cost, PDF link, readonly, tab/edit preserved, 360px',flush=True);b.close()
