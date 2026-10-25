"""Real Chromium/IndexedDB history. Synthetic data; no external AI/messages.
Filters, day pagination, archived names, cost meaning, exact CSV and offline use.
"""
from playwright.sync_api import sync_playwright
from urllib.parse import urlencode
U='http://localhost:8841/'
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 c=b.new_context(viewport={'width':360,'height':850},service_workers='allow')
 c.add_init_script("try{localStorage.setItem('sp_role','boss')}catch(e){}")
 pg=c.new_page();errors=[];calls=[];pg.on('pageerror',lambda e:errors.append(str(e)))
 pg.route('https://generativelanguage.googleapis.com/**',lambda r:(calls.append(r.request.url),r.abort()))
 pg.goto(U+'index.html#/daha');pg.wait_for_selector('#screen[data-view-ready="1"]')
 pg.evaluate('async()=>await navigator.serviceWorker.ready')
 if not pg.evaluate('!!navigator.serviceWorker.controller'):
  pg.reload();pg.wait_for_selector('#screen[data-view-ready="1"]')
 ids=pg.evaluate("""async()=>{
  const db=await import('./js/db.js'),C=await import('./js/core.js'),today=C.todayStr();
  const v={id:'history-v',name:'TEST 34GAM627 <img src=x onerror="window.__xss=1">'},other={id:'history-x',name:'TEST JCB'},archived={id:'history-old',name:'TEST ARŞİV',deleted_at:'yesterday'},person={id:'history-p',name:'TEST Soner'},customer={id:'history-c',name:'TEST Kılıç Hafriyat'};
  for(const r of [v,other,archived])await db.put('vehicles',C.newRecord(r));
  await db.put('personnel',C.newRecord(person));await db.put('customers',C.newRecord(customer));
  const add=async(store,r)=>db.put(store,C.newRecord({created_at:'2026-10-21T00:00:00Z',...r}));
  for(let i=0;i<40;i++)await add('fuel_records',{id:'bulk'+i,date:today,vehicle_id:v.id,personnel_id:person.id,liters:1,fuel_source:'Akaryakıt İstasyonu',description:'TEST İstasyon '+i,receipt:'Evet'});
  await add('fuel_records',{id:'customer-fuel',date:today,vehicle_id:other.id,personnel_id:person.id,liters:25.5,fuel_source:'Müşteri Verdi',customer_id:customer.id,total:9999,description:'=HYPERLINK("TEST")',receipt:'Müşteri'});
  await add('fuel_records',{id:'past',date:C.addDays(today,-1),vehicle_id:v.id,liters:10.25,fuel_source:'Depo Tankı',receipt:'Hayır',pump_no:'P-77',total:123.45});
  await add('fuel_records',{id:'archive',date:C.addDays(today,-10),vehicle_id:archived.id,liters:5,fuel_source:'Eski kaynak'});
  await add('fuel_records',{id:'invalid',date:'2026-02-30',vehicle_id:other.id,liters:2,fuel_source:'Şantiye'});
  await add('fuel_records',{id:'deleted',date:today,liters:999,deleted_at:'now'});
  await add('maintenance_records',{id:'m-priced',date:today,vehicle_id:v.id,personnel_id:person.id,maint_type:'Bakım',status:'Açık',severity:'Kritik',part:'Filtre',service_company:'TEST Yağ Servisi',description:'TEST yağ değişimi',cost:123.45});
  await add('maintenance_records',{id:'m-zero',date:today,vehicle_id:other.id,maint_type:'Arıza',status:'Serviste',cost:0});
  await add('maintenance_records',{id:'m-missing',date:C.addDays(today,-1),vehicle_id:v.id,maint_type:'Arıza',status:'Parça Bekliyor',cost:null});
  await add('maintenance_records',{id:'m-done',date:C.addDays(today,-1),vehicle_id:other.id,maint_type:'Bakım',status:'Tamamlandı',cost:50.55});
  return {v:v.id,p:person.id,old:archived.id,today,yesterday:C.addDays(today,-1)};
 }""")
 # Fixture writes schedule an 80 ms record-refresh debounce. Consume those
 # notifications on a non-refreshable route before testing user navigation.
 pg.wait_for_timeout(200)
 def snapshot():return pg.evaluate("async()=>{const db=await import('./js/db.js');return {data:await db.dumpAll(),audit:await db.getAll('audit_log'),drafts:await db.getAll('drafts')}}")
 def visit(route,**query):
  pg.evaluate("window.__operationVisitScreen=document.querySelector('#screen')")
  pg.goto(U+'index.html#/'+route+('?' + urlencode(query) if query else ''))
  pg.wait_for_function("()=>{const screen=document.querySelector('#screen');return screen&&screen!==window.__operationVisitScreen&&screen.dataset.viewReady==='1'&&!!screen.querySelector('[data-operation-summary]')}")
  pg.evaluate('delete window.__operationVisitScreen')
 def records():return pg.locator('[data-operation-record]')
 def summary():return pg.locator('[data-operation-summary]').text_content()
 def expand():pg.locator('[data-operation-filters]').evaluate('(e)=>e.open=true')
 before=snapshot();visit('yakit')
 assert '44 kayıt' in pg.locator('.appbar').text_content() and '82,75 L' in summary(),summary()
 assert records().count()==41 and pg.locator('[data-operation-date]').count()==1,'whole first day remains intact at the 30-row boundary'
 assert 'Akaryakıt İstasyonu · 40 L' in summary() and 'Müşteri Verdi · 25,5 L' in summary()
 assert '9999' not in summary() and '9.999' not in summary()
 assert 'TEST Kılıç Hafriyat' in pg.locator('[data-operation-record="customer-fuel"]').text_content()
 assert '9.999' not in pg.locator('[data-operation-record="customer-fuel"]').text_content()
 assert not pg.evaluate('!!window.__xss')
 pg.click('[data-operation-more]');assert records().count()==44
 assert 'Kayıtlı tutar: 123,45 ₺' in pg.locator('[data-operation-record="past"]').text_content()
 assert pg.locator('[data-operation-date]').last.text_content().startswith('Tarih eksik / geçersiz')
 for width in [320,360,768]:
  pg.set_viewport_size({'width':width,'height':850});expand()
  assert pg.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),width
 pg.set_viewport_size({'width':360,'height':850})
 assert snapshot()==before
 print('PASS fuel dates preserve a 41-record day, full-filter source litres, customer fuel and unknown dates; 320/360/768px, escaping and zero writes',flush=True)
 # Exact CSV includes all pages, protects spreadsheet formulas and only carries its filtered snapshot.
 pg.evaluate("()=>{navigator.canShare=()=>true;navigator.share=async p=>{window.__csv=await p.files[0].text()}}")
 pg.click('[data-operation-csv]');pg.wait_for_function('()=>!!window.__csv')
 csv=pg.evaluate('window.__csv');assert len(csv.splitlines())==45 and "'=HYPERLINK" in csv and 'deleted' not in csv
 assert 'TEST Kılıç Hafriyat' in csv
 print('PASS CSV covers all 44 filtered rows beyond the first page, with literal formula protection and customer source',flush=True)
 # Pressing a period before the search debounce fires preserves the text and cancels stale navigation.
 previous_screen=pg.query_selector('#screen')
 pg.fill('[data-search]','Soner');pg.get_by_role('button',name='Bugün',exact=True).click();pg.wait_for_function("previous=>{const screen=document.querySelector('#screen');return location.hash.includes('period=today')&&screen&&screen!==previous&&screen.dataset.viewReady==='1'&&!!screen.querySelector('[data-operation-summary]')}",arg=previous_screen)
 assert pg.input_value('[data-search]')=='Soner' and records().count()==41
 expand();pg.select_option('[data-ofilter=source]','Müşteri Verdi');pg.click('[data-operation-apply]');pg.wait_for_function("()=>document.querySelectorAll('[data-operation-record]').length===1")
 assert records().first.get_attribute('data-operation-record')=='customer-fuel' and '25,5 L' in summary()
 pg.evaluate("()=>{navigator.canShare=()=>true;navigator.share=async p=>{window.__filteredCSV=await p.files[0].text()}}")
 expand();pg.click('[data-operation-csv]');pg.wait_for_function('()=>!!window.__filteredCSV');assert len(pg.evaluate('window.__filteredCSV').splitlines())==2
 assert 'source=' in pg.url and 'q=Soner' in pg.url
 pg.locator('[data-history-link]').filter(has_text='Müşteri Verdi').click();pg.wait_for_function("()=>document.querySelectorAll('[data-operation-record]').length===41")
 # A queued search must not hijack a detail page.
 pg.fill('[data-search]','will not navigate');pg.locator('[data-operation-record="customer-fuel"]').click();pg.wait_for_url('**#/yakit/customer-fuel');pg.wait_for_timeout(550);assert pg.url.endswith('#/yakit/customer-fuel')
 print('PASS pending search survives period/source filters, exact CSV shrinks with filters, and detached debounce cannot hijack a detail screen',flush=True)
 visit('yakit',vehicle_id=ids['old']);assert records().count()==1;expand();assert '(arşiv)' in pg.locator('[data-ofilter=vehicle_id] option:checked').text_content()
 visit('yakit',vehicle_id='missing',source='retired');expand();assert pg.input_value('[data-ofilter=vehicle_id]')=='missing' and pg.input_value('[data-ofilter=source]')=='retired';assert records().count()==0
 visit('yakit',q='Kılıç');assert records().count()==1
 visit('yakit',**{'from':ids['yesterday'],'to':ids['yesterday']});assert records().count()==1 and '10,25 L' in summary()
 visit('yakit',**{'from':'2026-02-30'});pg.wait_for_selector('[role=alert]');assert records().count()==0 and pg.locator('[data-operation-csv]').count()==0
 pg.click('[data-history-clear]');pg.wait_for_function("()=>document.querySelectorAll('[data-operation-record]').length===41")
 assert snapshot()==before
 print('PASS archived/missing filter IDs remain explicit, customer search and exact date range work; invalid calendar date blocks results/export without writes',flush=True)
 visit('bakim');assert records().count()==3 and '123,45 ₺' in summary() and '2 kaydın maliyeti girilmiş' in summary() and '1 kaydın maliyeti belirtilmemiş' in summary()
 assert 'Maliyet belirtilmedi' not in pg.locator('[data-operation-record="m-zero"]').text_content() and '0,00 ₺ kayıtlı maliyet' in pg.locator('[data-operation-record="m-zero"]').text_content()
 assert 'Maliyet belirtilmedi' in pg.locator('[data-operation-record="m-missing"]').text_content()
 pg.get_by_role('button',name='Tamamlanan',exact=True).click();pg.wait_for_function("()=>document.querySelectorAll('[data-operation-record]').length===1")
 assert records().first.get_attribute('data-operation-record')=='m-done' and '50,55 ₺' in summary()
 pg.get_by_role('button',name='Tümü',exact=True).click();pg.wait_for_function("()=>document.querySelectorAll('[data-operation-record]').length===4")
 assert '174,00 ₺' in summary() and pg.locator('[data-operation-date]').count()==2
 pg.fill('[data-search]','Filtre');pg.wait_for_function("()=>document.querySelectorAll('[data-operation-record]').length===1")
 assert records().first.get_attribute('data-operation-record')=='m-priced'
 records().first.click();pg.wait_for_url('**#/bakim/m-priced');pg.wait_for_selector('[data-go="#/bakim/m-priced/edit"]')
 assert snapshot()==before
 print('PASS maintenance open/done/all filters, part search, actual detail/edit link, cents and explicit zero versus unknown cost agree; no cash/cari writes',flush=True)
 for route in ['yakit','bakim']:
  visit(route,period='week');c.set_offline(True);pg.reload();pg.wait_for_selector('[data-operation-summary]');assert records().count()>0;c.set_offline(False)
 assert snapshot()==before
 assert not errors,errors
 assert not calls,calls
 print('PASS both histories reopen with real SW offline, preserving selected period and all business/audit/draft records; no browser errors or AI calls',flush=True)
 # A read failure must remain an error instead of an invented empty/zero summary.
 failure=pg.evaluate("""async()=>{const {operationHistory}=await import('./js/operation-history-ui.js');const root=document.createElement('div');document.body.append(root);await operationHistory({root,db:{getAll:async()=>{throw Error('TEST storage unavailable')}},query:{}},'fuel');const result={text:root.textContent,summary:root.querySelector('[data-operation-summary]')!==null};root.remove();return result;}""")
 assert 'Kayıtlar okunamadı' in failure['text'] and not failure['summary']
 assert snapshot()==before
 print('PASS storage read failure is explicit, with no false empty/zero summary or writes',flush=True)
 c.close();b.close()
