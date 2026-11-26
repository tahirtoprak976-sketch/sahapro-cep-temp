"""TEST-only fleet dossier links, blank numerical fields and scoped save return."""
import sys,uuid
from playwright.sync_api import sync_playwright
U=sys.argv[1] if len(sys.argv)>1 else 'http://localhost:8841/'
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);c=b.new_context(viewport={'width':360,'height':800});c.add_init_script("localStorage.setItem('sp_role','boss')");p=c.new_page();p.set_default_timeout(45000);errors=[];p.on('pageerror',lambda e:errors.append(str(e)));app=U+'index.html?db=TEST_fleet135_'+uuid.uuid4().hex
 p.goto(app+'#/daha');p.wait_for_selector('#screen[data-view-ready="1"]')
 ids=p.evaluate("""async()=>{const d=await import('./js/db.js'),C=await import('./js/core.js'),date=C.todayStr(),v=await d.saveNew('vehicles',{name:'TEST Fleet135'},'TEST'),other=await d.saveNew('vehicles',{name:'TEST Other135'},'TEST'),off=await d.saveNew('vehicles',{name:'TEST Off135',active:false},'TEST');
 for(const [vehicle_id,liters] of [[v.id,10],[other.id,999]])await d.put('fuel_records',C.newRecord({vehicle_id,date:C.addDays(date,-1),liters,fuel_source:'Akaryakıt İstasyonu',receipt:'Hayır'}));
 await d.saveNew('documents',{owner_type:'vehicle',owner_id:v.id,vehicle_id:v.id,category:'Muayene Belgesi',doc_no:'TEST135',date:C.addDays(date,-365),expiry_date:C.addDays(date,-1)},'TEST');return {v:v.id,other:other.id,off:off.id,date};}""")
 p.wait_for_timeout(200);snap="async()=>{const r=await(await import('./js/db.js')).readSnapshot({attachments:true,drafts:true,meta:true});delete r.captured_at;return JSON.stringify(r)}";before=p.evaluate(snap)
 def nav(hash):
  old=p.locator('#screen').element_handle();p.goto(app+hash);p.wait_for_function('(e)=>!e.isConnected',arg=old);p.wait_for_selector('#screen[data-view-ready="1"]')
 def action(fn):
  old=p.locator('#screen').element_handle();fn();p.wait_for_function('(e)=>!e.isConnected',arg=old);p.wait_for_selector('#screen[data-view-ready="1"]')
 nav('#/filo/'+ids['v']);assert p.locator('[data-fleet-entry-actions]').count()==1,'FLEET_ENTRY_ACTIONS_MISSING'
 assert p.locator('[data-fleet-entry]').count()==4
 assert '10 L' in p.locator('[data-fleet-last-fuel]').inner_text() and '999' not in p.locator('[data-fleet-last-fuel]').inner_text()
 assert p.locator('[data-fleet-desk]').evaluate('(e)=>e.previousElementSibling.classList.contains("appbar")'),'dossier remains below unrelated tools'
 action(p.locator('[data-fleet-entry="fuel"]').click);assert p.input_value('[name=vehicle_id]')==ids['v'];assert p.input_value('[name=date]')==ids['date']
 for key in ['liters','unit_price','total','km','machine_hours']:assert p.input_value('[name='+key+']')=='',key
 assert p.input_value('[name=personnel_id]')==''
 nav('#/yakit/new?source=fleet&vehicle_id='+ids['v']+'&litre=999&amount=9999');assert p.input_value('[name=liters]')=='' and p.input_value('[name=total]')==''
 nav('#/filo/'+ids['v']);action(p.locator('[data-fleet-entry="maintenance"]').click);assert p.input_value('[name=vehicle_id]')==ids['v'];assert p.input_value('[name=cost]')==''
 nav('#/filo/'+ids['v']);action(p.locator('[data-fleet-entry="document"]').click);assert p.input_value('[name=vehicle_id]')==ids['v'];assert p.input_value('[name=expiry_date]')==''
 nav('#/filo/'+ids['v']);action(p.locator('[data-fleet-entry="meter"]').click);assert p.input_value('[name=vehicle_id]')==ids['v'];assert p.input_value('[name=value]')==''
 assert p.evaluate(snap)==before,'opening forms modified business/meta/drafts/attachments'
 nav('#/yakit/new?source=fleet&vehicle_id=missing');assert p.locator('[data-entry-context][role=alert]').count()==1 and p.locator('[data-save]').count()==0
 nav('#/filo/'+ids['off']);assert p.locator('[data-fleet-entry]').count()==0
 nav('#/filo/'+ids['v']);action(p.locator('[data-fleet-entry="fuel"]').click)
 p.select_option('[name=vehicle_id]',ids['other']);p.fill('[name=liters]','20');p.select_option('[name=fuel_source]','Akaryakıt İstasyonu');p.select_option('[name=receipt]','Hayır');action(p.locator('[data-save]').click)
 assert p.evaluate('location.hash')=='#/filo/'+ids['other'],'save returned to stale initial vehicle'
 assert '20 L' in p.locator('[data-fleet-last-fuel]').inner_text()
 counts=p.evaluate("async()=>{const d=await(await import('./js/db.js')).dumpAll();return {fuel:d.fuel_records.length,cash:d.cash_records.length,work:d.work_records.length,maintenance:d.maintenance_records.length}}")
 assert counts=={'fuel':3,'cash':0,'work':0,'maintenance':0},counts
 nav('#/filo/'+ids['v']);assert '10 L' in p.locator('[data-fleet-last-fuel]').inner_text()
 for width in [320,360,390,768]:
  p.set_viewport_size({'width':width,'height':800});assert p.evaluate('document.documentElement.scrollWidth<=innerWidth')
 assert not errors,errors
 print('fleet flow135 PASS: upper dossier, exact vehicle four form links, blank quantities/cost/expiry/meter/person, invalid/inactive guards, readonly opens, saved edited vehicle return and no cash/work/maintenance side writes')
 b.close()
