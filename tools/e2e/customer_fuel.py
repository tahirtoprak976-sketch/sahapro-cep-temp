"""Real Chromium + IndexedDB, synthetic customers/stock. No Gemini or external messages."""
import sys,json
from playwright.sync_api import sync_playwright
U=sys.argv[1] if len(sys.argv)>1 else 'http://localhost:8841/'
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 c=b.new_context(viewport={'width':360,'height':850});c.add_init_script("try{localStorage.setItem('sp_role','boss')}catch(e){}")
 calls=[]
 c.route('https://generativelanguage.googleapis.com/**',lambda r:(calls.append(r.request.url),r.abort()))
 pg=c.new_page();errors=[];pg.on('pageerror',lambda e:errors.append(str(e)))
 pg.goto(U+'index.html#/musteriler');pg.wait_for_selector('[data-customer-directory]');pg.evaluate('async()=>await navigator.serviceWorker.ready')
 if not pg.evaluate('!!navigator.serviceWorker.controller'):pg.reload();pg.wait_for_selector('[data-customer-directory]')
 ids=pg.evaluate("""async()=>{const db=await import('./js/db.js'),C=await import('./js/core.js');const customer=await db.saveNew('customers',{name:'TEST Kaya',fuel_rules:[{id:'RULE',per:75,unit:'Sefer'}]},'TEST');await db.saveNew('fuel_tank_movements',{date:C.todayStr(),move_type:'GİRİŞ',liters:100,total:3000,unit_price:30},'TEST');return {customer:customer.id,date:C.todayStr()};}""")
 def state():return pg.evaluate("""async()=>{const db=await import('./js/db.js'),C=await import('./js/core.js'),L=await import('./js/collect-core.js'),R=await import('./js/assistant-rules.js');const d=await db.dumpAll(),m=d.fuel_tank_movements.filter(C.isActive).filter(x=>x.delivery_kind==='customer_fuel');return {stock:C.calcTankBalance(d.fuel_tank_movements).remaining,balance:L.customerBalances(d).bal,received:R.customerFuelLedger(d,d.customers.find(x=>x.name==='TEST Kaya').id).received,moves:m,charges:d.cari_movements.filter(C.isActive),fuel:d.fuel_records.length,work:d.work_records.length,cash:d.cash_records.length,vehicles:d.vehicles.length,audit:d.audit_log.length};}""")
 def ask(text):
  pg.fill('[data-msg]',text);pg.click('[data-ask]')
  try:pg.wait_for_selector('[data-kind=fuelout]',timeout=10000)
  except Exception:
   print(pg.locator('body').inner_text(),errors,flush=True);raise
  pg.wait_for_function("()=>!document.querySelector('[data-ask]').disabled")
 def save():
  pg.evaluate("()=>{const b=document.querySelector('[data-save]');b.dispatchEvent(new MouseEvent('click',{bubbles:true}));b.dispatchEvent(new MouseEvent('click',{bubbles:true}))}")
  pg.locator('[data-out]').get_by_text('Kaydedildi:',exact=False).wait_for()
 before=state();pg.goto(U+'index.html#/akilli-asistan');pg.wait_for_function("()=>document.querySelector('[data-new-chat]')&&!document.querySelector('[data-new-chat]').disabled")
 # Purely local and offline, no key, with the user's typo and unspecified past date.
 c.set_offline(True);ask("TEST Kaya'nın forkliftine 20 ltnmazot verilmişti")
 assert pg.input_value('[data-kind=fuelout] [name=customer]')==ids['customer']
 assert pg.input_value('[data-kind=fuelout] [name=liters]')=='20'
 assert pg.input_value('[data-kind=fuelout] [name=unit_price]')=='' and pg.input_value('[data-kind=fuelout] [name=date]')==''
 assert not pg.locator('[data-kind=fuelout] [data-pick]').is_checked() and state()==before
 pg.fill('[data-kind=fuelout] [name=date]',ids['date']);pg.fill('[data-kind=fuelout] [name=unit_price]','45')
 assert '900' in pg.locator('[data-fuel-charge]').inner_text() and state()==before
 for width in [320,360,768]:pg.set_viewport_size({'width':width,'height':850});assert pg.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),width
 pg.check('[data-kind=fuelout] [data-pick]');save();c.set_offline(False)
 s=state();assert s['stock']==80 and s['balance'][ids['customer']]==900 and len(s['moves'])==len(s['charges'])==1,s
 assert s['received']==0 and [s[k] for k in ['fuel','work','cash','vehicles']]==[before[k] for k in ['fuel','work','cash','vehicles']] and not calls
 print('PASS offline/no-key typo -> recipient/20L; missing past date and price stay empty; confirmation + double-submit creates one 20L output and 900TL debt, no incoming fuel/cash/work/owned machine',flush=True)
 # Existing assistant undo must reverse the linked event together.
 pg.locator('[data-out] [data-undo]').click();pg.click('.sheet [data-x="1"]');pg.wait_for_function("()=>!document.querySelector('[data-out] [data-undo]')")
 s=state();assert s['stock']==100 and s['balance'].get(ids['customer'],0)==0 and not s['moves'] and not s['charges'],s
 print('PASS assistant undo restores both stock and customer balance',flush=True)
 # Two actual pages in the same browser profile share the IndexedDB transaction lock.
 pg2=c.new_page();pg2.goto(U+'index.html#/akilli-asistan');pg2.wait_for_selector('[data-msg]')
 f={'date':ids['date'],'customer_id':ids['customer'],'machine':'Forklift','liters':20,'unit_price':45}
 js="""async f=>{const db=await import('./js/db.js');try{return await db.saveCustomerFuelDelivery(f,'TEST',{op:{id:'TEST-DUP',hash:'same'}})}catch(e){return {error:e.message}}}"""
 # Start both evaluations without waiting for the first promise.
 pg.evaluate("""f=>{window.__delivery=(async()=>{const db=await import('./js/db.js');return db.saveCustomerFuelDelivery(f,'TEST',{op:{id:'TEST-DUP',hash:'same'}})})();}""",f)
 second=pg2.evaluate(js,f);first=pg.evaluate('async()=>await window.__delivery')
 assert first['id']==second['id'] and bool(first.get('_existing'))!=bool(second.get('_existing'))
 s=state();assert s['stock']==80 and len(s['moves'])==len(s['charges'])==1
 snap=state()
 # Conflicting operation and a transaction-interior failure must leave no half-event.
 res=pg.evaluate("""async f=>{const db=await import('./js/db.js');try{await db.saveCustomerFuelDelivery({...f,unit_price:46},'TEST',{op:{id:'TEST-DUP',hash:'different'}})}catch(e){return e.code}}""",f);assert res=='OP_CONFLICT' and state()==snap
 res=pg.evaluate("""async f=>{const db=await import('./js/db.js'),p=IDBObjectStore.prototype,old=p.put;p.put=function(v,...a){if(this.name==='cari_movements'&&v.type==='MazotTeslimi')throw Error('TEST interior failure');return old.call(this,v,...a)};try{await db.saveCustomerFuelDelivery({...f,liters:5},'TEST',{op:{id:'TEST-ROLLBACK',hash:'rollback'}})}catch(e){return e.message}finally{p.put=old}}""",f)
 assert res=='TEST interior failure' and state()==snap
 print('PASS two-page retry writes one pair; conflicting content and injected second-write failure leave stock, balance, audit and operations unchanged',flush=True)
 # Racing separate deliveries cannot oversell the last 80L.
 race=pg.evaluate("""async f=>{const db=await import('./js/db.js');return (await Promise.allSettled(['A','B'].map(id=>db.saveCustomerFuelDelivery({...f,liters:50},'TEST',{op:{id,hash:id}})))).map(x=>({status:x.status,id:x.value?.id,error:x.reason?.message}))}""",f)
 assert sum(x['status']=='fulfilled' for x in race)==1 and state()['stock']==30,race
 for m in state()['moves']:pg.evaluate("async id=>await (await import('./js/db.js')).cancelCustomerFuelDelivery(id,'TEST reset')",m['id'])
 assert state()['stock']==100 and state()['balance'].get(ids['customer'],0)==0
 print('PASS concurrent deliveries cannot oversell; paired cancellation restores all litres and debts',flush=True)
 pg.reload();pg.wait_for_function("()=>document.querySelector('[data-new-chat]')&&!document.querySelector('[data-new-chat]').disabled");ask("TEST Kaya'nın forkliftine 20 litre mazot verildi, litresi 45 TL")
 assert pg.locator('[data-kind=fuelout] [data-pick]').is_checked();save()
 s=state();mid=s['moves'][0]['id'];assert s['stock']==80 and s['balance'][ids['customer']]==900
 # Source-labelled statement + full backup/restore linkage checks.
 backup=pg.evaluate("async()=>await (await import('./js/backup.js')).fullBackup(await import('./js/db.js'),{encrypted:false,attachments:'none'})")
 report=pg.evaluate("""async id=>{const db=await import('./js/db.js'),L=await import('./js/collect-core.js'),S=await import('./js/statement.js');const d=await db.dumpAll();return S.customerStatement(L.customerLedgerMovements(d,id),id)}""",ids['customer'])
 assert report['closing']==900 and report['rows'][0]['type']=='Mazot teslimi' and '20 L' in report['rows'][0]['text']
 fresh=b.new_context();fp=fresh.new_page();fp.goto(U+'index.html');fp.wait_for_function("()=>document.querySelector('#screen')?.children.length>0")
 restore=fp.evaluate("""async obj=>{const db=await import('./js/db.js'),B=await import('./js/backup.js'),C=await import('./js/core.js');await B.restoreBackup(db,obj);const d=await db.dumpAll();return {stock:C.calcTankBalance(d.fuel_tank_movements).remaining,rows:d.cari_movements.filter(C.isActive).filter(x=>x.type==='MazotTeslimi')}}""",backup)
 assert restore['stock']==80 and len(restore['rows'])==1 and restore['rows'][0]['amount']==900
 broken=json.loads(json.dumps(backup));broken['data']['cari_movements']=[x for x in broken['data']['cari_movements'] if x['type']!='MazotTeslimi']
 broken_context=b.new_context();bp=broken_context.new_page();bp.goto(U+'index.html');bp.wait_for_function("()=>document.querySelector('#screen')?.children.length>0")
 failure=bp.evaluate("""async obj=>{const db=await import('./js/db.js'),B=await import('./js/backup.js');try{await B.restoreBackup(db,obj);return 'bad'}catch(e){return e.message}}""",broken)
 assert 'bağlantısı' in failure,failure
 print('PASS labelled customer statement; actual backup -> separate fresh DB restores 80L/900TL, broken pair is rejected',flush=True)
 # General write paths cannot separate either half or delete its customer.
 guarded=pg.evaluate("""async id=>{const db=await import('./js/db.js'),m=await db.get('fuel_tank_movements',id),a=await db.get('cari_movements',m.cari_movement_id);return Promise.all([()=>db.saveExisting('fuel_tank_movements',m,{liters:21},'TEST'),()=>db.saveExisting('cari_movements',a,{amount:1},'TEST'),()=>db.softDelete('customers',m.recipient_customer_id,'TEST')].map(async fn=>{try{await fn();return false}catch(e){return true}}))}""",mid)
 assert all(guarded)
 pg.goto(U+'index.html#/depo');pg.wait_for_selector('[data-customer-fuel]');assert 'TEST Kaya' in pg.locator('[data-customer-fuel]').inner_text() and '900' in pg.locator('[data-customer-fuel]').inner_text()
 pg.locator('[data-customer-fuel]').click();pg.click('[data-cancel-fuel]');pg.fill('.sheet [data-p]','TEST mistaken delivery');pg.click('.sheet [data-x="1"]')
 pg.wait_for_function("()=>!document.querySelector('[data-customer-fuel]')");assert state()['stock']==100 and state()['balance'].get(ids['customer'],0)==0
 assert not calls and not errors,errors
 print('PASS individual financial edits/customer deletion blocked; actual depot UI shows recipient/machine/debt and cancels both sides; zero real AI requests and no browser errors',flush=True)
 fresh.close();broken_context.close();c.close();b.close()
