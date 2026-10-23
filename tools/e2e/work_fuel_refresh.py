"""Manual fuel payment + live read views, real IndexedDB, synthetic Güneş fixture."""
import sys, json, base64
from playwright.sync_api import sync_playwright
U=sys.argv[1] if len(sys.argv)>1 else 'http://localhost:8841/'
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 c=b.new_context(viewport={'width':390,'height':844});c.add_init_script("localStorage.setItem('sp_role','boss')")
 e=c.new_page();errors=[];e.on('pageerror',lambda x:errors.append(str(x)))
 e.goto(U+'index.html#/musteriler/new');e.wait_for_selector('[name=name]')
 date=e.evaluate("async()=>(await import('./js/core.js')).todayStr()")
 e.fill('[name=name]','TEST Güneş Hafriyat');e.locator('details').first.evaluate('(el)=>el.open=true');e.click('[data-frule-add]');e.fill('[data-f=per]','75');e.fill('[data-f=match]','gravak maslak');e.fill('[data-f=from]',date);e.click('[data-save]');e.wait_for_selector('[data-customer-fuel-account]')
 ids=e.evaluate("""async()=>{const db=await import('./js/db.js');const customer=(await db.listActive('customers')).find(c=>c.name==='TEST Güneş Hafriyat');const vehicle=await db.saveNew('vehicles',{name:'TEST Güneş Truck',type:'Kamyon'},'TEST'),q=await db.saveNew('quarries',{name:'TEST Maslak'},'TEST'),other=await db.saveNew('customers',{name:'TEST Other Customer'},'TEST');for(const price of [1000,2000])await db.saveNew('price_book',{customer_id:customer.id,work_type:'Gravak Nakliye',unit:'Sefer',price,kdv_rate:20,kdv_included:false,active:true},'TEST');return {customer:customer.id,vehicle:vehicle.id,quarry:q.id,other:other.id}}""")
 v=c.new_page();v.on('pageerror',lambda x:errors.append(str(x)));v.goto(U+'index.html#/mazot-hesaplari');v.wait_for_selector('#screen[data-view-ready="1"] [data-ref]');v.evaluate("window.__fuelView='kept'")
 e.goto(U+'index.html#/isler/new?customer_id='+ids['customer']);e.wait_for_selector('[name=quantity]');e.fill('[name=date]',date);e.select_option('[name=vehicle_id]',ids['vehicle']);e.select_option('[name=work_type]','Gravak Nakliye');e.fill('[name=quantity]','2')
 assert 'maslak' in e.locator('[data-work-fuel-preview]').inner_text().lower()
 e.select_option('[name=quarry_id]',ids['quarry']);e.wait_for_selector('[data-fuel-status=matched]');assert '150 L' in e.locator('[data-work-fuel-preview]').inner_text()
 e.select_option('[name=unit]','Ton');assert 'birim' in e.locator('[data-work-fuel-preview]').inner_text();e.select_option('[name=unit]','Sefer')
 for width in [320,390,768]:
  e.set_viewport_size({'width':width,'height':844});assert e.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
 assert e.evaluate("async()=>(await(await import('./js/db.js')).listActive('work_records')).length")==0
 image=base64.b64decode(e.evaluate("()=>{const x=document.createElement('canvas');x.width=40;x.height=40;return x.toDataURL().split(',')[1]}"))
 e.set_input_files('[data-wfiles]',{'name':'TEST-fiș.png','mimeType':'image/png','buffer':image})
 o=c.new_page();o.on('pageerror',lambda x:errors.append(str(x)));o.goto(U+'index.html#/daha');o.wait_for_selector('#screen[data-view-ready="1"]')
 def rate(n):
  o.evaluate("""async x=>{const db=await import('./js/db.js'),c=await db.get('customers',x.id);await db.saveExisting('customers',c,{fuel_rules:[{...c.fuel_rules[0],per:x.per}]},'TEST rule change')}""",{'id':ids['customer'],'per':n})
 rate(90);e.wait_for_function("()=>document.querySelector('[data-work-fuel-preview]')?.textContent.includes('180 L')")
 assert e.input_value('[name=quantity]')=='2' and e.eval_on_selector('[data-wfiles]','el=>el.files.length')==1
 # A legacy client that does not broadcast changes: the save must still detect the new rule.
 o.evaluate("""async id=>{const db=await import('./js/db.js'),c=await db.get('customers',id),connection=await db.openDB();await new Promise((res,rej)=>{const t=connection.transaction('customers','readwrite');t.objectStore('customers').put({...c,fuel_rules:[{...c.fuel_rules[0],per:100}],updated_at:new Date(Date.now()+1).toISOString()});t.oncomplete=res;t.onabort=()=>rej(t.error)})}""",ids['customer'])
 e.evaluate("document.querySelector('[data-save]').click()")
 e.wait_for_function("()=>document.querySelector('[data-work-fuel-preview]')?.textContent.includes('200 L')")
 e.wait_for_function("()=>!document.querySelector('[data-save]')?.disabled")
 assert e.evaluate("async()=>(await(await import('./js/db.js')).listActive('work_records')).length")==0
 e.click('[data-save]');e.wait_for_function("()=>{const h=location.hash.split('?')[0];return /^#\\/isler\\/[^/]+$/.test(h)&&!h.endsWith('/new')}")
 wid=e.url.split('/')[-1]
 v.bring_to_front();v.wait_for_function("()=>document.querySelector('#screen')?.textContent.includes('200 L hak edildi')")
 assert v.evaluate("window.__fuelView==='kept'")
 state=e.evaluate("""async id=>{const db=await import('./js/db.js'),w=await db.get('work_records',id);return {liters:w.customer_fuel_allowance_l,amount:w.price_snapshot.amount,works:(await db.listActive('work_records')).length,fuel:(await db.listActive('fuel_records')).length,cash:(await db.listActive('cash_records')).length,photos:(await db.attachmentsFor('work',id)).length}}""",wid)
 assert state=={'liters':200,'amount':0,'works':1,'fuel':0,'cash':0,'photos':1},state
 assert e.locator('.sheet').count()==0
 print('PASS manual customer/rule -> live match and mismatch; rule change updates preview without losing form/photo; stale rule blocks save; ambiguous TL prices never prompt for fuel-only; one 200 L job, zero TL/fuel/cash; open account updates without reload',flush=True)
 v.goto(U+'index.html#/musteriler/'+ids['customer']);v.wait_for_selector('[data-customer-fuel-account]');v.click('[data-dper=all]')
 rate(150)
 e.goto(U+'index.html#/isler/'+wid+'/edit');e.wait_for_selector('[data-fuel-status=preserved]');assert '100 L' in e.locator('[data-work-fuel-preview]').inner_text();e.fill('[name=quantity]','3');assert '300 L' in e.locator('[data-work-fuel-preview]').inner_text();e.click('[data-save]');e.wait_for_function("()=>!location.hash.endsWith('/edit')")
 v.bring_to_front();v.wait_for_function("()=>document.querySelector('[data-customer-fuel-account]')?.textContent.includes('300 L')")
 assert e.evaluate("async id=>(await(await import('./js/db.js')).get('work_records',id)).customer_fuel_allowance_l",wid)==300
 assert 'on' in v.locator('[data-dper=all]').get_attribute('class')
 e.goto(U+'index.html#/isler/'+wid+'/edit');e.wait_for_selector('[data-fuel-status=preserved]');e.select_option('[name=customer_id]',ids['other']);assert e.locator('[data-work-fuel-preview]').is_hidden();e.click('[data-save]');e.wait_for_function("()=>!location.hash.endsWith('/edit')")
 cleared=e.evaluate("async id=>{const w=await(await import('./js/db.js')).get('work_records',id);return [w.customer_fuel_allowance_l,w.fuel_rule_id,w.price_snapshot]}",wid)
 assert cleared==[None,None,None],cleared
 print('PASS old 100 L/unit agreement survives new 150 L rule; changed quantity uses old rate; explicitly moving to another customer clears stale fuel-only snapshot instead of inventing a price',flush=True)
 # Generic write must wait for transaction completion. Success followed by abort is failure, no notification.
 aborted=e.evaluate("""async()=>{const db=await import('./js/db.js'),C=await import('./js/core.js'),N=await import('./js/record-refresh.js');let notices=0;const stop=N.watchRecords(()=>notices++),put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(row){const r=put.call(this,row);if(this.name==='work_records'&&row.id==='TEST-ABORT')r.addEventListener('success',()=>this.transaction.abort());return r};let rejected=false;try{await db.put('work_records',C.newRecord({id:'TEST-ABORT',date:C.todayStr()}))}catch{rejected=true}finally{IDBObjectStore.prototype.put=put;stop()}return {rejected,notices,absent:!(await db.get('work_records','TEST-ABORT'))}}""")
 assert aborted=={'rejected':True,'notices':0,'absent':True},aborted
 v.goto(U+'index.html#/mazot-hesaplari');v.wait_for_selector('#screen[data-view-ready="1"] [data-ref]');v.fill('[data-ref]','55');v.evaluate("document.querySelector('#screen').__draft='kept'")
 rate(160);v.wait_for_timeout(200);assert v.input_value('[data-ref]')=='55' and v.evaluate("document.querySelector('#screen').__draft==='kept'")
 assert not errors,errors
 print('PASS aborted transaction never reports success or broadcasts; unsaved reference value preserved during external update; no browser errors',flush=True)
 b.close()
