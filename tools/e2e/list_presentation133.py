"""TEST-only session navigation, pagination, filters and mobile list presentation."""
import sys,uuid,json,pathlib
from playwright.sync_api import sync_playwright
U=sys.argv[1] if len(sys.argv)>1 else 'http://localhost:8843/'
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
 tag='baseline' if p.evaluate("async()=>(await import('./js/core.js')).APP_VERSION").endswith('v3.10.32') else 'candidate';metrics={}
 def ready():p.wait_for_selector('#screen[data-view-ready="1"]')
 def nav(hash):
  old=p.locator('#screen').element_handle();p.goto(app+hash);p.wait_for_function('(old)=>!old.isConnected',arg=old);ready()
 for route,query in [('yakit','?period=all'),('isler','?period=all'),('gider','?p=all&k=gider')]:
  nav('#/'+route+query);p.evaluate('scrollTo(0,0)')
  if p.locator('#update-bar [data-x]').count():p.click('#update-bar [data-x]')
  rows=p.locator('[data-list] .li');assert rows.count()>=3
  metrics[route]=p.evaluate("""()=>{const rows=[...document.querySelectorAll('[data-list] .li')];return {firstRowY:rows[0].getBoundingClientRect().top+scrollY,threeRowSpan:rows[2].getBoundingClientRect().bottom-rows[0].getBoundingClientRect().top,firstRowHeight:rows[0].getBoundingClientRect().height}}""")
  p.screenshot(path='/tmp/list133-'+tag+'-'+route+'-top.png')
  pathlib.Path('/tmp/list133-'+tag+'-metrics.json').write_text(json.dumps(metrics,indent=2))
  # Capture the baseline evidence before the identical feature assertion fails.
  assert p.locator('[data-record-toolbar]').count()==1,'RECORD_TOOLBAR_MISSING'
  if route=='yakit':assert metrics[route]['firstRowY']<620,'fuel list starts too far below the fold'
  if route=='isler':assert metrics[route]['firstRowY']<760,'work list starts too far below the fold'
  assert p.locator('[data-record-density="compact"]').get_attribute('aria-pressed')=='true'
  assert p.locator('[data-record-scope]').inner_text().startswith('75 kayıt')
  assert p.locator('#brand-shell').evaluate('(e)=>getComputedStyle(e).display')=='none'
  text=rows.all_text_contents();p.click('[data-record-density="detail"]')
  assert p.locator('[data-record-density="detail"]').get_attribute('aria-pressed')=='true'
  assert rows.all_text_contents()==text,'density must not discard notes, quantities or warnings'
  detail=rows.nth(0).bounding_box()['height'];p.click('[data-record-density="compact"]')
  assert rows.nth(0).bounding_box()['height']<detail,'compact view must actually shorten rows'
  if route!='gider':
   p.click('.record-filter-button');assert p.locator('[data-work-filters],[data-operation-filters]').evaluate('(e)=>e.open')
   p.locator('[data-work-filters],[data-operation-filters]').evaluate('(e)=>e.open=false')
  p.evaluate('scrollTo(0,0)')
  # Density choice persists only within this tab and does not change filters.
  p.click('[data-record-density="detail"]');nav('#/daha');nav('#/'+route+query)
  assert p.locator('[data-record-density="detail"]').get_attribute('aria-pressed')=='true'
  p.click('[data-record-density="compact"]')
  for width in [320,360,390,768]:
   p.set_viewport_size({'width':width,'height':800});assert p.evaluate('document.documentElement.scrollWidth<=innerWidth'),'horizontal overflow'
  p.set_viewport_size({'width':360,'height':800});p.evaluate('scrollTo(0,0)')
  p.screenshot(path='/tmp/list133-'+tag+'-'+route+'-top.png')
 nav('#/yakit?from=2026-02-31&to=2026-03-01')
 assert p.locator('[data-operation-summary] .notice').is_visible(),'invalid date warning hidden'
 p.click('[data-record-density="detail"]');assert p.locator('[data-operation-summary] .notice').is_visible()
 nav('#/daha');assert p.locator('#brand-shell').evaluate('(e)=>getComputedStyle(e).display')!='none','branding leaked outside lists'
 assert p.evaluate(snapshot)==before,'presentation changed records/meta/drafts/attachments' 
 assert not errors and not calls,(errors,calls)
 print('list presentation133 PASS: three real lists, density/notes/amounts preserved, filter handoff, tab preference, fresh non-list branding, readonly and four widths',metrics)
 b.close()
