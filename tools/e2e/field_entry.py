"""Historical operational entry: real mobile forms/IndexedDB, no AI/messages.
Only explicit saves may create business records; date/vehicle context is read only.
"""
from playwright.sync_api import sync_playwright
U='http://localhost:8841/'
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 c=b.new_context(viewport={'width':360,'height':800},service_workers='allow')
 c.add_init_script("try{localStorage.setItem('sp_role','boss')}catch(e){}")
 pg=c.new_page();errors=[];calls=[];pg.on('pageerror',lambda e:errors.append(str(e)))
 pg.route('https://generativelanguage.googleapis.com/**',lambda r:(calls.append(r.request.url),r.abort()))
 pg.goto(U+'index.html#/musteriler');pg.wait_for_selector('[data-customer-directory]')
 pg.evaluate('async()=>await navigator.serviceWorker.ready')
 if not pg.evaluate('!!navigator.serviceWorker.controller'):
  pg.reload();pg.wait_for_selector('[data-customer-directory]')
 ids=pg.evaluate("""async()=>{const db=await import('./js/db.js');
 const c=await db.saveNew('customers',{name:'TEST historical customer'},'TEST');
 const v=await db.saveNew('vehicles',{name:'TEST <img src=x onerror="window.__xss=1">'},'TEST');
 const other=await db.saveNew('vehicles',{name:'TEST other'},'TEST');
 for(const [price,from,to] of [[300,'2026-05-01','2026-05-31'],[900,'2026-10-01',null]])await db.saveNew('price_book',{customer_id:c.id,work_type:'Makine Çalışması',unit:'Saat',price,kdv_rate:20,kdv_included:false,active:true,valid_from:from,valid_to:to},'TEST');
 return {c:c.id,v:v.id,other:other.id};}""")
 date='2026-05-11'
 def snapshot():return pg.evaluate("async()=>{const db=await import('./js/db.js');return {data:await db.dumpAll(),audit:await db.getAll('audit_log')}}")
 def stream(day=date,vehicle=None,kind='fuel',q='does not match new records'):
  target=pg.evaluate("s=>import('./js/field-stream.js').then(m=>m.streamURL(s))",{'date':day,'vehicle_id':vehicle or ids['v'],'kind':kind,'q':q})
  pg.goto(U+'index.html'+target);pg.wait_for_selector('[data-stream-date]');return target
 def enter(kind):
  pg.click('[data-stream-new="'+kind+'"]');pg.wait_for_selector('[data-entry-context]');pg.wait_for_selector('[data-form]')
 def assert_context(day,vehicle):
  assert pg.input_value('[name=date]')==day
  assert pg.input_value('[name=vehicle_id]')==vehicle
 def rows(store):return pg.evaluate("s=>import('./js/db.js').then(db=>db.listActive(s))",store)
 before=snapshot();links={}
 for kind,empty in [('work','quantity'),('fuel','liters'),('expense','amount'),('maintenance','cost')]:
  back=stream();links[kind]=pg.get_attribute('[data-stream-new="'+kind+'"]','href');enter(kind)
  assert_context(date,ids['v']);assert pg.input_value('[name='+empty+']')==''
  assert 'Geçmiş tarihli' in pg.inner_text('[data-entry-context]')
  assert not pg.evaluate('!!window.__xss')
  for width in [320,360,768]:
   pg.set_viewport_size({'width':width,'height':850});assert pg.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),(kind,width)
  pg.set_viewport_size({'width':360,'height':800});pg.reload();pg.wait_for_selector('[data-form]');assert_context(date,ids['v'])
  pg.click('[data-entry-context] a');pg.wait_for_selector('[data-stream-summary]');assert pg.evaluate('location.hash')==back
 assert snapshot()==before
 print('PASS four actual form links retain historical day/vehicle, blank quantities/amounts, safe names, 320/360/768px and cancel/reload; zero business writes',flush=True)
 stream();enter('work');pg.fill('[name=date]','');pg.click('[data-save]');pg.get_by_text('Tarih seçin',exact=True).wait_for();assert snapshot()==before
 pg.fill('[name=date]',date);pg.select_option('[name=customer_id]',ids['c']);pg.select_option('[name=work_type]','Makine Çalışması');pg.select_option('[name=unit]','Saat');pg.fill('[name=quantity]','2');pg.check('[data-save-next]');pg.click('[data-save]')
 pg.wait_for_selector('[data-repeat-info]');assert_context(date,ids['v']);assert pg.input_value('[name=quantity]')==''
 first=rows('work_records');assert len(first)==1 and first[0]['price_snapshot']['amount']==600
 assert first[0]['price_snapshot']['unit_price']==300 and first[0]['date']==date
 pg.fill('[name=quantity]','3');pg.click('[data-save]');pg.wait_for_selector('[data-stream-summary]')
 assert pg.input_value('[data-stream-date]')==date and pg.input_value('[data-stream-kind]')=='work'
 pg.wait_for_selector('[data-stream-summary]');assert pg.locator('[data-stream-record]').count()==2
 assert 'q=' not in pg.url and 'kind=work' in pg.url
 works=rows('work_records');assert len(works)==2 and all(w['date']==date and w['price_snapshot']['unit_price']==300 for w in works)
 assert sorted(w['price_snapshot']['amount'] for w in works)==[600,900]
 assert all(not w.get('driver_entry_id') and not w.get('digital_slip_no') for w in works)
 print('PASS historical price rule 300 rather than current 900, explicit date required, save-and-next keeps past day with fresh quantity; normal save returns visible records',flush=True)
 enter('fuel');pg.fill('[name=date]','2026-05-12');pg.select_option('[name=vehicle_id]',ids['other']);pg.fill('[name=liters]','50');pg.select_option('[name=fuel_source]','Akaryakıt İstasyonu');pg.click('[data-save]');pg.wait_for_selector('[data-stream-summary]')
 assert pg.input_value('[data-stream-date]')=='2026-05-12'
 assert pg.input_value('[data-stream-vehicle]')==ids['other'] and 'kind=fuel' in pg.url
 fuel=rows('fuel_records');assert len(fuel)==1 and fuel[0]['date']=='2026-05-12' and fuel[0]['vehicle_id']==ids['other'] and fuel[0]['liters']==50
 enter('expense');assert_context('2026-05-12',ids['other']);pg.fill('[name=amount]','123.45');pg.click('[data-save]');pg.wait_for_selector('[data-stream-summary]')
 expense=rows('expense_records');assert len(expense)==1 and expense[0]['amount']==123.45 and expense[0]['date']=='2026-05-12' and expense[0]['vehicle_id']==ids['other']
 assert 'kind=expense' in pg.url and pg.locator('[data-stream-record]').count()==1
 enter('maintenance');assert_context('2026-05-12',ids['other']);pg.fill('[name=description]','TEST historical maintenance');pg.click('[data-save]');pg.wait_for_selector('[data-stream-summary]')
 maint=rows('maintenance_records');assert len(maint)==1 and maint[0]['date']=='2026-05-12' and maint[0]['vehicle_id']==ids['other'] and maint[0]['cost'] is None
 assert 'kind=maintenance' in pg.url and pg.locator('[data-stream-record]').count()==1
 assert len(rows('cash_records'))==0 and len(rows('cari_movements'))==0 and len(rows('hakedis'))==0
 print('PASS fuel/date/vehicle changes determine return scope; expense cents and maintenance saved on chosen day; no automatic cash/cari/hakediş',flush=True)
 # Entering a new stream context must preserve the older existing work draft.
 pg.evaluate("""async ids=>{const db=await import('./js/db.js');await db.draftSave('work',{date:'2026-04-01',vehicle_id:ids.other,customer_id:ids.c,work_type:'Makine Çalışması',quantity:7,unit:'Saat',manual_price:'765.43',description:'VALUABLE DRAFT'})}""",ids)
 protected=snapshot();stream();enter('work');assert_context('2026-04-01',ids['other'])
 assert pg.input_value('[name=quantity]')=='7' and pg.input_value('[name=manual_price]')=='765.43' and pg.input_value('[name=description]')=='VALUABLE DRAFT'
 assert 'taslağınız' in pg.inner_text('[data-entry-context]')
 pg.click('[data-entry-context] a');pg.wait_for_selector('[data-stream-summary]');assert snapshot()==protected
 pg.evaluate("async()=>await(await import('./js/db.js')).draftClear('work')")
 stream(kind='work',q='');enter('work');pg.click('[data-copylast]');pg.wait_for_selector('[data-repeat-info]');assert_context(date,ids['v'])
 pg.fill('[name=quantity]','9');old_url=pg.url;pg.click('[data-copylast]');pg.wait_for_selector('.sheet');pg.click('.sheet [data-x="1"]')
 pg.wait_for_function("() => document.querySelector('[name=quantity]')?.value===''")
 assert pg.url!=old_url and pg.input_value('[name=date]')==date and len(rows('work_records'))==2
 for route in ['isler','yakit','gider','bakim']:
  pg.goto(U+'index.html#/'+route+'/new?source=saha&date=2026-02-30&return_to=javascript%3Aalert(1)');pg.wait_for_selector('[data-entry-context][role=alert]');assert pg.locator('[data-save]').count()==0
 stream('2026-02-30');pg.wait_for_selector('[role=alert]');assert pg.locator('[data-stream-new]').count()==0
 print('PASS dated draft/manual price protected; repeat-from-last can restart twice with the historical day; malformed dates block new entries',flush=True)
 pg.evaluate("async()=>await(await import('./js/db.js')).draftClear('work')")
 removed=pg.evaluate("""async()=>{const db=await import('./js/db.js');const v=await db.saveNew('vehicles',{name:'TEST removed'},'TEST');const E=await import('./js/entry-context.js');const links=Object.fromEntries(['work','fuel','expense','maintenance'].map(k=>[k,E.entryLink(k,{date:'2026-05-11',vehicle_id:v.id})]));await db.softDelete('vehicles',v.id,'TEST');return links}""")
 protected=snapshot()
 for link in removed.values():
  pg.goto(U+'index.html'+link);pg.wait_for_selector('[data-form]');assert pg.input_value('[name=vehicle_id]')=='';assert 'artık aktif değil' in pg.inner_text('[data-entry-context]')
 assert snapshot()==protected
 pg.goto(U+'index.html#/isler/'+works[0]['id']+'/edit?source=saha&date=2026-05-30&vehicle_id='+ids['other']);pg.wait_for_selector('[data-form]')
 assert_context(date,ids['v']);assert pg.locator('[data-entry-context]').count()==0
 pg.goto(U+'index.html#/bakim/'+maint[0]['id']+'/edit?source=saha&date=2026-05-30');pg.wait_for_selector('[data-form]');assert_context('2026-05-12',ids['other']);assert pg.locator('[data-entry-context]').count()==0
 assert snapshot()==protected
 print('PASS a vehicle deleted after link creation is not selected; edit routes keep recorded values and ignore new-entry context',flush=True)
 c.set_offline(True)
 for link in links.values():
  pg.goto(U+'index.html'+link);pg.wait_for_selector('[data-form]');assert_context(date,ids['v'])
 assert snapshot()==protected
 assert not calls,calls
 assert not errors,errors
 print('PASS all four forms reopen with selected context through the real service worker offline; no AI requests or browser errors',flush=True)
 b.close()
