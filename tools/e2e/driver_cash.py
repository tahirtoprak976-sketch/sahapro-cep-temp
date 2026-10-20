"""Subcontractor + driver cash journey. Synthetic data and mocked native share only."""
from playwright.sync_api import sync_playwright
U='http://localhost:8841/'
MOCK="window.__shares=[];navigator.canShare=()=>true;navigator.share=async x=>window.__shares.push({text:x.text,files:x.files?.length||0});"
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);boss=b.new_context(viewport={'width':390,'height':844});boss.add_init_script("localStorage.setItem('sp_role','boss')")
 pg=boss.new_page();errors=[];calls=[];pg.on('pageerror',lambda e:errors.append(str(e)));pg.route('https://generativelanguage.googleapis.com/**',lambda r:(calls.append(r.request.url),r.abort()))
 pg.goto(U);pg.evaluate('async()=>await navigator.serviceWorker.ready');pg.wait_for_timeout(800)
 fixture=pg.evaluate('''async()=>{const d=await import('./js/db.js'),D=await import('./js/driver-core.js'),S=await import('./js/security.js');const ulas=await d.saveNew('customers',{name:'Ulaş Rondela'},'TEST'),demir=await d.saveNew('customers',{name:'Demir İnşaat'},'TEST'),person=await d.saveNew('personnel',{name:'Soner',active:true},'TEST'),vehicle=await d.saveNew('vehicles',{name:'Manitou MTX 1840 TEST',plate:'34TEST001'},'TEST');await d.saveNew('price_book',{unit:'Saat',vehicle_id:vehicle.id,price:1000,kdv_rate:20,active:true},'TEST');const link=await S.newDriverLink({pid:person.id,name:person.name}),cfg={...D.driverConfig(await d.dumpAll(),{personnel_id:person.id,vehicle_id:vehicle.id}),...link.forDriver};return {url:'sofor.html?k='+await D.pack(cfg),person:person.id,vehicle:vehicle.id,ulas:ulas.id,demir:demir.id,lid:link.link.lid}}''')
 driver=b.new_context(viewport={'width':360,'height':800});driver.add_init_script(MOCK);dp=driver.new_page();dp.on('pageerror',lambda e:errors.append(str(e)));dp.goto(U+fixture['url']);dp.wait_for_selector('[data-cid]')
 def add(name,note,cash=None):
  dp.select_option('[data-cid]','__new');dp.fill('[data-k=cn]',name);dp.click('[data-wt="Makine Çalışması"]');dp.fill('[data-k=q]','1');dp.fill('[data-k=note]',note)
  if cash is not None:dp.fill('[data-k=cash]',str(cash))
  dp.click('[data-add]');dp.wait_for_selector('[data-save-result]');dp.wait_for_function("() => !document.querySelector('[data-add]').disabled")
 add('Mermerci (Demir İnşaat)','Mermer indirildi')
 dp.select_option('[data-cid]','__new');dp.fill('[data-k=cn]','Çatıcı (Ulaş rondela)');dp.fill('[data-k=date]','2026-09-07');dp.fill('[data-k=cash_date]','2026-10-19');dp.fill('[data-k=cash]','2500');dp.fill('[data-k=note]','Çatı işi');dp.wait_for_timeout(400);dp.reload();dp.wait_for_selector('[data-k=cash]');assert dp.input_value('[data-k=cash]')=='2500';assert dp.input_value('[data-k=cash_date]')=='2026-10-19';dp.click('[data-add]');dp.wait_for_function("() => JSON.parse(localStorage.getItem('sp_driver_entries')).length===2")
 dp.wait_for_function("() => !document.querySelector('[data-add]').disabled");assert dp.input_value('[data-k=cash]')==''
 dp.click('[data-send]');dp.wait_for_selector('[data-driver-share-go]');assert '2500 TL nakit alındı' in dp.locator('[data-driver-share]').text_content();dp.click('[data-driver-share-go]');dp.wait_for_function("() => window.__shares.length===1")
 packet=dp.evaluate('window.__shares[0].text')
 def preview(text):
  pg.goto(U+'index.html#/akilli-asistan');pg.reload();pg.wait_for_selector('[data-msg]');pg.fill('[data-msg]',text);pg.click('[data-ask]');pg.wait_for_selector('[data-kind=work]')
 preview(packet);works=pg.locator('[data-kind=work]');assert works.count()==2
 assert works.nth(0).locator('[name=customer]').input_value()=='new:Mermerci';assert works.nth(1).locator('[name=customer]').input_value()=='new:Çatıcı'
 cash=pg.locator('[data-kind=collection]');assert cash.count()==1;assert not cash.locator('[data-pick]').is_checked();assert cash.locator('[name=amount]').input_value()=='2500';assert cash.locator('[name=date]').input_value()=='2026-10-19';assert works.nth(1).locator('[name=date]').input_value()=='2026-09-07';assert cash.locator('[name=personnel]').input_value()==fixture['person'];assert cash.locator('[name=personnel]').is_disabled()
 for i in range(2):works.nth(i).locator('[data-pick]').check()
 pg.click('[data-save]');pg.wait_for_selector('[data-pending-driver-cash]')
 result=pg.evaluate("async()=>{const d=await import('./js/db.js');return {customers:await d.listActive('customers'),works:await d.listActive('work_records'),cash:await d.listActive('cash_records')}}")
 assert len(result['works'])==2 and len(result['cash'])==0
 child=next(c for c in result['customers'] if c['name']=='Çatıcı');mermer=next(c for c in result['customers'] if c['name']=='Mermerci');assert child['parent_customer_id']==fixture['ulas'];assert mermer['parent_customer_id']==fixture['demir']
 assert {w['customer_id'] for w in result['works']}=={child['id'],mermer['id']};assert all(w['price_snapshot']['unit_price']==1000 for w in result['works'])
 print('PASS free-text subcontractors create correct parent-linked cards; works stay on children; cash is unchecked and not used as job price',flush=True)
 pg.click('[data-pending-driver-cash]');pg.wait_for_selector('[data-kind=collection]');cash=pg.locator('[data-kind=collection]');assert cash.locator('[name=customer]').input_value()==child['id'];cash.locator('[data-pick]').check();pg.click('[data-save]');pg.wait_for_function("() => !document.querySelector('[data-kind=collection]')")
 money=pg.evaluate("async()=>{const d=await import('./js/db.js');return {cash:await d.listActive('cash_records'),cari:await d.listActive('cari_movements')}}")
 assert money['cash'][0]['date']=='2026-10-19';assert len(money['cash'])==1 and money['cash'][0]['amount']==2500;assert money['cash'][0]['customer_id']==child['id'];assert money['cash'][0]['personnel_id']==fixture['person'];assert money['cash'][0]['cash_status']=='PERSONELDE';assert len([m for m in money['cari'] if m.get('ref_id')==money['cash'][0]['id']])==1
 print('PASS explicit cash approval creates one collection and one ledger movement on the child, money held by Soner',flush=True)
 preview(packet);pg.locator('[data-kind=collection] [data-pick]').check();pg.click('[data-save]');pg.wait_for_timeout(700)
 assert pg.evaluate("async()=>(await(await import('./js/db.js')).listActive('cash_records')).length")==1
 assert pg.evaluate("async()=>(await(await import('./js/db.js')).listActive('work_records')).length")==2
 print('PASS replay of same signed report produces no duplicate work, customer or collection',flush=True)
 # An already-shared job can be enriched with cash, keeping its original entry ID.
 dp.click('[data-shared]>summary');entry_id=dp.evaluate("JSON.parse(localStorage.getItem('sp_driver_entries'))[1].id");dp.click('[data-cash-edit="'+entry_id+'"]');dp.wait_for_selector('.sheet [data-p]');dp.fill('.sheet [data-p]','3500');dp.click('.sheet [data-x="1"]');dp.wait_for_selector('.sheet input[type=date]');dp.fill('.sheet [data-p]','2026-10-20');dp.click('.sheet [data-x="1"]');dp.wait_for_selector('[data-send]');assert dp.evaluate("JSON.parse(localStorage.getItem('sp_driver_entries'))[1].id")==entry_id
 dp.click('[data-send]');dp.wait_for_selector('[data-driver-share-go]');dp.click('[data-driver-share-go]');dp.wait_for_function("() => window.__shares.length===2");changed=dp.evaluate('window.__shares[1].text');preview(changed);pg.locator('[data-kind=collection] [data-pick]').check();pg.click('[data-save]');pg.wait_for_timeout(700)
 assert pg.evaluate("async()=>(await(await import('./js/db.js')).listActive('cash_records'))[0].amount")==2500
 print('PASS changed cash report keeps same ID and cannot overwrite or duplicate an approved collection',flush=True)
 # A date-only correction still marks the same job pending; cancelling second dialog does not mutate.
 dp.click('[data-shared]>summary');dp.locator('[data-shared]').evaluate('(e)=>e.open=true');dp.click('[data-cash-edit="'+entry_id+'"]');dp.fill('.sheet [data-p]','3500');dp.click('.sheet [data-x="1"]');dp.wait_for_selector('.sheet input[type=date]');dp.click('.sheet [data-x="0"]');dp.wait_for_function("() => !document.querySelector('[data-cash-edit]').disabled");assert dp.evaluate("JSON.parse(localStorage.getItem('sp_driver_entries'))[1].cash_date")=='2026-10-20'
 dp.locator('[data-shared]').evaluate('(e)=>e.open=true');dp.click('[data-cash-edit="'+entry_id+'"]');dp.fill('.sheet [data-p]','3500');dp.click('.sheet [data-x="1"]');dp.wait_for_selector('.sheet input[type=date]');dp.fill('.sheet [data-p]','2026-10-19');dp.click('.sheet [data-x="1"]');dp.wait_for_function("() => JSON.parse(localStorage.getItem('sp_driver_entries'))[1].cash_date==='2026-10-19'");assert dp.evaluate("JSON.parse(localStorage.getItem('sp_driver_entries'))[1].sent") is None;dp.wait_for_function("() => !document.querySelector('[data-cash-edit]').disabled")
 dp.locator('[data-shared]').evaluate('(e)=>e.open=true');dp.click('[data-cash-edit="'+entry_id+'"]');dp.fill('.sheet [data-p]','');dp.click('.sheet [data-x="1"]');dp.wait_for_function("() => !('cash' in JSON.parse(localStorage.getItem('sp_driver_entries'))[1])");assert dp.evaluate("'cash_date' in JSON.parse(localStorage.getItem('sp_driver_entries'))[1]") is False
 print('PASS independent receipt date persists across draft reload and approval; cancel is atomic; date-only edit and blank removal work',flush=True)
 # Same driver identity remains unique even if a caller changes the request key.
 parallel=pg.evaluate("""async()=>{const d=await import('./js/db.js'),cash=(await d.listActive('cash_records'))[0];const rows=await Promise.all(['parallel-a','parallel-b'].map(request_id=>d.saveCashEvent({...cash,id:undefined,request_id})));return {ids:rows.map(r=>r.id),existing:rows.every(r=>r._existing),count:(await d.listActive('cash_records')).length}}""")
 assert parallel['existing'] and len(set(parallel['ids']))==1 and parallel['count']==1,parallel
 cards=pg.evaluate("""async parent=>{const d=await import('./js/db.js');const rows=await Promise.all([d.ensureCustomerCard('Eşzamanlı TEST taşeron',parent),d.ensureCustomerCard('Eşzamanlı TEST taşeron',parent)]);return rows.map(r=>r.id)}""",fixture['ulas'])
 assert cards[0]==cards[1],cards
 print('PASS concurrent customer creation reuses one parent-scoped card; changed request keys cannot duplicate driver cash',flush=True)
 # Cash proof and atomic ledger behavior are checked at DB write time, including revocation.
 guard=pg.evaluate('''async()=>{const d=await import('./js/db.js'),C=await import('./js/core.js'),S=await import('./js/security.js');const cash=(await d.listActive('cash_records'))[0];const f={...cash,id:undefined,request_id:'guard-new',driver_entry_id:'unverified'};const out={};try{await d.saveCashEvent({...cash,id:undefined,date:'2026-02-30',request_id:'bad-date'})}catch(e){out.badDate=true}try{await d.saveCashEvent(f)}catch(e){out.unverified=e.code}try{await d.saveCashEvent({...cash,id:undefined,request_id:'wrong-actor',personnel_id:'other-person'})}catch(e){out.wrongActor=e.code}await S.revokeLink((await S.driverLinks())[0].lid);try{await d.saveCashEvent({...cash,id:undefined,request_id:'revoked-new'})}catch(e){out.revoked=e.code}out.cash=(await d.listActive('cash_records')).length;out.cari=(await d.listActive('cari_movements')).filter(x=>x.type==='Tahsilat').length;return out}''')
 assert guard=={'badDate':True,'unverified':'UNVERIFIED_DRIVER','wrongActor':'UNVERIFIED_DRIVER','revoked':'UNVERIFIED_DRIVER','cash':1,'cari':1},guard
 assert not calls,calls;assert not errors,errors
 print('PASS direct unverified and revoked-link cash writes rejected with zero cash/ledger residue; no Gemini or browser errors',flush=True)
 b.close()
