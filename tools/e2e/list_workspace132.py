"""TEST-only session navigation, pagination, filters and mobile list presentation."""
import sys,uuid
from playwright.sync_api import sync_playwright
U=sys.argv[1] if len(sys.argv)>1 else 'http://localhost:8841/'
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 c=b.new_context(viewport={'width':360,'height':800});c.add_init_script("localStorage.setItem('sp_role','boss')")
 p=c.new_page();errors=[];p.on('pageerror',lambda e:errors.append(str(e)));p.set_default_timeout(45000)
 calls=[];p.route('https://generativelanguage.googleapis.com/**',lambda r:(calls.append(r.request.url),r.abort()))
 app=U+'index.html?db=TEST_list132_'+uuid.uuid4().hex
 p.goto(app+'#/daha');p.wait_for_selector('#screen[data-view-ready="1"]')
 ids=p.evaluate("""async()=>{const db=await import('./js/db.js'),C=await import('./js/core.js'),today=C.todayStr();
 const v=await db.saveNew('vehicles',{name:'TEST Liste Aracı'},'TEST'),person=await db.saveNew('personnel',{name:'TEST Liste Personeli'},'TEST'),customer=await db.saveNew('customers',{name:'TEST Liste Müşterisi'},'TEST');
 for(let i=0;i<75;i++){
 const date=C.addDays(today,-i),base={date,vehicle_id:v.id,personnel_id:person.id,description:'TEST Liste '+i};
 await db.put('work_records',C.newRecord({...base,id:'TEST_W132_'+i,customer_id:customer.id,work_type:'Makine Çalışması',quantity:3,unit:'Saat',price_snapshot:{unit_price:100,amount:300,kdv_rate:20,kdv_included:false}}));
 await db.put('fuel_records',C.newRecord({...base,id:'TEST_F132_'+i,liters:10,fuel_source:'Akaryakıt İstasyonu',total:400,receipt:'Evet'}));
 await db.put('expense_records',C.newRecord({...base,id:'TEST_E132_'+i,category:'Diğer',amount:100,payment_method:'Nakit',receipt:'Evet'}));
 }return {vehicle:v.id};}""")
 p.wait_for_timeout(250)
 snapshot="async()=>{const s=await(await import('./js/db.js')).readSnapshot({attachments:true,meta:true,drafts:true});delete s.captured_at;return JSON.stringify(s)}"
 before=p.evaluate(snapshot)
 def ready():p.wait_for_selector('#screen[data-view-ready="1"]')
 def action(fn):
  old=p.locator('#screen').element_handle();fn();p.wait_for_function('(old)=>!old.isConnected',arg=old);ready()
 def nav(hash):action(lambda:p.goto(app+hash))
 for route,query,more in [('isler','?period=all&q=Liste','[data-more]'),('yakit','?period=all&q=Liste','[data-operation-more]')]:
  nav('#/'+route+query)
  p.locator(more).click();assert p.locator('[data-list] .li').count()>30
  details=p.locator('[data-work-filters],[data-operation-filters]');details.evaluate('(e)=>e.open=true')
  target=p.locator('[data-list] a.li').nth(45);target.scroll_into_view_if_needed();p.wait_for_timeout(100)
  count=p.locator('[data-list] .li').count();scroll=p.evaluate('window.scrollY');saved=p.evaluate('location.hash')
  action(target.click);assert p.locator('[data-record-workspace]').count()==0
  # Both explicit in-app bare list links and browser Back must restore scope.
  action(lambda:p.evaluate('(route)=>location.hash="#/"+route',route))
  assert p.evaluate('location.hash')==saved,'LIST_FILTERS_LOST'
  assert p.locator('[data-record-workspace="'+route+'"]').count()==1,'LIST_WORKSPACE_MISSING'
  assert p.input_value('[data-search]')=='Liste'
  assert p.locator('[data-list] .li').count()==count,'loaded pages lost'
  assert details.evaluate('(e)=>e.open'),'filter disclosure lost'
  assert abs(p.evaluate('window.scrollY')-scroll)<8,'list position lost'
  action(lambda:p.evaluate("async()=>await(await import('./js/app.js')).renderCurrent()"));assert p.locator('[data-list] .li').count()==count and abs(p.evaluate('window.scrollY')-scroll)<8,'refresh reset the list'
  action(p.locator('[data-list] a.li').nth(45).click);action(p.go_back)
  assert p.input_value('[data-search]')=='Liste' and p.locator('[data-list] .li').count()==count
  p.locator('[data-search]').scroll_into_view_if_needed();p.click('.record-search-clear');p.wait_for_function("()=>!new URLSearchParams(location.hash.split('?')[1]||'').get('q')");ready();assert p.input_value('[data-search]')==''
  # Home navigation is a fresh entry; no hidden filter is resurrected.
  nav('#/daha');nav('#/'+route);assert p.evaluate('location.hash')=='#/'+route
 nav('#/gider?p=all&k=gider&q=Liste')
 assert p.locator('[data-record-workspace="gider"]').count()==1
 assert p.locator('[data-list] .li').count()==30
 p.locator('[data-more]').click();assert p.locator('[data-list] .li').count()==60
 p.locator('[data-list] .li').nth(40).click()
 assert p.input_value('[data-search]')=='Liste'
 # Close the existing expense sheet without saving.
 p.wait_for_selector('#sheet-root .sheet [data-close]');p.click('#sheet-root .sheet [data-close]');p.wait_for_selector('#sheet-root .sheet',state='detached');assert p.locator('[data-list] .li').count()==60
 for width in [320,360,390,768]:
  p.set_viewport_size({'width':width,'height':800})
  
  if p.evaluate('location.hash')!='#/yakit?period=all':nav('#/yakit?period=all')
  assert p.evaluate('document.documentElement.scrollWidth<=innerWidth'),'horizontal overflow'
 assert p.evaluate(snapshot)==before,'list navigation modified business data'
 assert not calls and not errors,(calls,errors)
 p.set_viewport_size({'width':360,'height':800});p.evaluate('scrollTo(0,0)');p.screenshot(path='/tmp/list132-phone.png')
 print('list workspace132 PASS: filtered in-app/browser back, scroll, loaded pages, disclosure, clear search, fresh entry, read-only, no AI and 320/360/390/768px')
 b.close()
