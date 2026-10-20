"""Real mobile work explorer, synthetic local records; no real AI or sharing."""
from playwright.sync_api import sync_playwright
import csv,io
U='http://localhost:8841/'
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 c=b.new_context(viewport={'width':360,'height':800},service_workers='allow',timezone_id='Europe/Istanbul',locale='tr-TR')
 c.add_init_script("localStorage.setItem('sp_role','boss');navigator.canShare=()=>false")
 pg=c.new_page();errs=[];calls=[];pg.on('pageerror',lambda e:errs.append(str(e)))
 pg.route('https://generativelanguage.googleapis.com/**',lambda r:(calls.append(r.request.url),r.abort()))
 pg.goto(U);pg.evaluate('async()=>await navigator.serviceWorker.ready');pg.wait_for_timeout(1800)
 if not pg.evaluate('!!navigator.serviceWorker.controller'):pg.reload();pg.wait_for_timeout(1000)
 ids=pg.evaluate("""async()=>{const db=await import('./js/db.js'),C=await import('./js/core.js');const t=C.todayStr();const customer=await db.saveNew('customers',{name:'=Kaya <img src=x onerror="window.__xss=1"> İnşaat'},'TEST');const other=await db.saveNew('customers',{name:'Diğer TEST'},'TEST');const site=await db.saveNew('sites',{name:'Merkez TEST',customer_id:customer.id},'TEST');const s2=await db.saveNew('sites',{name:'Diğer Şantiye',customer_id:other.id},'TEST');const v=(await db.listActive('vehicles'))[0],person=(await db.listActive('personnel'))[0];let one;const base={customer_id:customer.id,site_id:site.id,vehicle_id:v.id,personnel_id:person.id,work_type:'Hafriyat Nakliye',quantity:2,unit:'Sefer'};
 for(let i=0;i<40;i++){const w=await db.saveNew('work_records',{...base,date:t,slip_no:'WORK-'+i,description:'TEST açıklama '+i,price_snapshot:{unit_price:0,amount:0}},'TEST');one=w.id;}
 await db.saveNew('work_records',{...base,date:C.addDays(t,-6),quantity:3,unit:'Saat'},'TEST');await db.saveNew('work_records',{...base,date:C.addDays(t,-7),quantity:9,unit:'Ton'},'TEST');await db.saveNew('work_records',{...base,date:C.addDays(t,1),quantity:99},'TEST');await db.saveNew('work_records',{...base,customer_id:other.id,site_id:s2.id,date:t,quantity:1},'TEST');
 return {t,from:C.addDays(t,-6),before:C.addDays(t,-7),customer:customer.id,other:other.id,site:site.id,s2:s2.id,v:v.id,p:person.id,one}}""")
 def visit(s):
  pg.goto(U+'index.html#/'+s);pg.wait_for_selector('[data-work-summary]');pg.wait_for_timeout(180)
 def count():return pg.locator('[data-list] .li').count()
 before=pg.evaluate("async()=>JSON.stringify(await(await import('./js/db.js')).dumpAll())")
 visit('isler?from='+ids['t']+'&to='+ids['t']+'&customer_id='+ids['customer'])
 assert pg.get_by_role('button',name='Rapor merkezi · ayrı filtreler').count()==1
 assert count()==40 and '80' in pg.inner_text('[data-work-summary]')
 assert pg.locator('[data-dgroup]').count()==1
 print('PASS same date stays whole; summary includes all 40 results and 80 Sefer',flush=True)
 pg.fill('[data-search]','WORK-12');pg.wait_for_timeout(850)
 assert count()==1 and 'from='+ids['t'] in pg.url and 'customer_id='+ids['customer'] in pg.url
 assert pg.locator('[data-search]').input_value()=='WORK-12'
 print('PASS search by slip number preserves customer and date scope',flush=True)
 pg.locator('.segbar button',has_text='Fişsiz').click();pg.wait_for_timeout(400)
 assert count()==1 and 'q=WORK-12' in pg.url and 'from='+ids['t'] in pg.url
 # Fill another search then immediately click a period; latest text must survive old debounce.
 pg.fill('[data-search]','WORK-2');pg.locator('.segbar button',has_text='Son 7 gün').click();pg.wait_for_timeout(800)
 assert 'q=WORK-2' in pg.url and 'customer_id='+ids['customer'] in pg.url and 'from=' not in pg.url
 print('PASS status/period choices preserve latest text and entity filters; stale debounce does not return old scope',flush=True)
 visit('isler?f=week&customer_id='+ids['customer'])
 assert '83' not in pg.inner_text('[data-work-summary]') # mixed units must never sum into 83
 assert '80' in pg.inner_text('[data-work-summary]') and 'Saat' in pg.inner_text('[data-work-summary]') and 'Ton' not in pg.inner_text('[data-work-summary]')
 assert '41 kayıt' in pg.inner_text('.appbar')
 assert pg.locator('[data-more]').count()==1
 pg.click('[data-more]');assert count()==41
 print('PASS exactly 7 calendar days, future excluded; units separate; date pagination loads all rows',flush=True)
 visit('isler?period=today&customer_id='+ids['customer'])
 with pg.expect_download() as d: pg.click('[data-work-csv]')
 raw=open(d.value.path(),'r',encoding='utf-8-sig',newline='').read();table=list(csv.reader(io.StringIO(raw),delimiter=';'))
 assert len(table)==41 and all(r[1].startswith("'=Kaya") for r in table[1:])
 print('PASS filtered CSV exports all rows, preserves columns and neutralizes formula-leading customer',flush=True)
 pg.click('[data-bulk-price]');pg.wait_for_selector('.sheet')
 assert 'filtrelerle sınırlı değildir' in pg.inner_text('.sheet')
 pg.click('.sheet button[data-x="0"]')
 print('PASS global pricing scope is explicit; cancel writes nothing',flush=True)
 pg.locator('[data-work-filters] summary').click() if pg.locator('[data-work-filters]').get_attribute('open') is None else None
 pg.select_option('[data-wfilter=site_id]',ids['site']);pg.select_option('[data-wfilter=customer_id]',ids['other'])
 assert pg.input_value('[data-wfilter=site_id]')==''
 pg.select_option('[data-wfilter=vehicle_id]',ids['v']);pg.select_option('[data-wfilter=personnel_id]',ids['p']);pg.select_option('[data-wfilter=unit]','Sefer')
 pg.click('[data-work-apply]');pg.wait_for_timeout(400)
 assert count()==1 and 'vehicle_id='+ids['v'] in pg.url
 pg.reload();pg.wait_for_selector('[data-work-summary]');assert count()==1
 print('PASS dependent site reset, combined entity/unit filters and reload persistence',flush=True)
 pg.get_by_role('button',name='Personel:',exact=False).click();pg.wait_for_timeout(400)
 assert 'personnel_id=' not in pg.url and 'vehicle_id='+ids['v'] in pg.url and count()==1
 print('PASS active filter chip removes only selected constraint',flush=True)
 visit('isler?from=2026-02-30&to='+ids['t']);assert count()==0 and 'Gerçek bir' in pg.inner_text('[data-work-summary]') and pg.locator('[data-work-csv]').count()==0
 visit('isler?from='+ids['t']+'&to='+ids['before']);assert count()==0 and 'sonra olamaz' in pg.inner_text('[data-work-summary]')
 print('PASS invalid/reversed dates show explicit errors and hide stale totals/export',flush=True)
 visit('isler?f=fiyatsiz&period=today&customer_id='+ids['customer']);assert count()==0
 visit('isler?customer_id='+ids['customer']+'&q=no-match');assert count()==0 and 'uyan kayıt yok' in pg.inner_text('[data-list]')
 print('PASS zero price is not missing, empty result provides reset path',flush=True)
 visit('isler?customer_id='+ids['customer'])
 for width in [320,360,768,1280]:
  pg.set_viewport_size({'width':width,'height':900});pg.wait_for_timeout(80)
  assert pg.evaluate('document.documentElement.scrollWidth<=document.documentElement.clientWidth+1'),width
 assert pg.evaluate('!window.__xss')
 pg.set_viewport_size({'width':390,'height':844});pg.screenshot(path='/tmp/work-ultimate-v3929.png',full_page=True)
 print('PASS mobile/tablet widths, escaped malicious label',flush=True)
 pg.evaluate('async()=>await navigator.serviceWorker.ready')
 if not pg.evaluate('!!navigator.serviceWorker.controller'):pg.reload();pg.wait_for_selector('[data-work-summary]')
 with pg.expect_download() as d:pg.click('[data-work-csv]')
 allrows=list(csv.reader(open(d.value.path(),encoding='utf-8-sig',newline=''),delimiter=';'));assert len(allrows)==44 and count()==41
 print('PASS CSV includes 43 scoped rows even when only 41 are loaded',flush=True)
 c.set_offline(True);pg.reload();pg.wait_for_selector('[data-work-summary]');assert count()==41
 after=pg.evaluate("async()=>JSON.stringify(await(await import('./js/db.js')).dumpAll())")
 assert before==after,'read-only exploration/export changed business data or audit'
 assert not errs and not calls,(errs,calls)
 print('PASS actual service-worker offline reload, unchanged data/audit, zero AI calls or browser errors',flush=True)
 b.close()
