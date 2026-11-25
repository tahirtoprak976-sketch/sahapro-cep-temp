"""Daily triage uses existing records and explicit forms; synthetic TEST profile, no model."""
import sys,json,uuid
from pathlib import Path
from playwright.sync_api import sync_playwright
base=(sys.argv[1] if len(sys.argv)>1 else 'http://localhost:8903/').rstrip('/')+'/'
with sync_playwright() as w:
 b=w.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);c=b.new_context(viewport={'width':360,'height':800},service_workers='block');c.add_init_script("localStorage.setItem('sp_role','boss')");p=c.new_page();errors=[];calls=[];p.on('pageerror',lambda e:errors.append(str(e)));c.route('https://generativelanguage.googleapis.com/**',lambda r:(calls.append(r.request.url),r.abort()))
 app=base+'index.html?db=TEST_daily126_'+uuid.uuid4().hex[:10]
 p.goto(app+'#/daha');p.wait_for_selector('#screen[data-view-ready="1"]')
 ids=p.evaluate("""async()=>{const D=await import('./js/db.js'),{todayStr}=await import('./js/core.js'),date=todayStr();const customer=await D.saveNew('customers',{name:'TEST Günlük Müşteri'},'TEST'),vehicle=await D.saveNew('vehicles',{name:'TEST Günlük Kamyon'},'TEST'),idle=await D.saveNew('vehicles',{name:'TEST <img src=x onerror="window.__dailyXss=1">'},'TEST'),person=await D.saveNew('personnel',{name:'TEST Günlük Personel'},'TEST');const work=await D.saveNew('work_records',{date,customer_id:customer.id,vehicle_id:vehicle.id,work_type:'Makine Çalışması',quantity:3,unit:'Saat'},'TEST'),cash=await D.saveNew('cash_records',{date,customer_id:customer.id,personnel_id:person.id,cash_type:'Müşteriden Para Alındı',cash_status:'PERSONELDE',amount:1000},'TEST');return {date,customer:customer.id,vehicle:vehicle.id,idle:idle.id,person:person.id,work:work.id,cash:cash.id}}""")
 snap=lambda:p.evaluate("async()=>JSON.stringify({data:await(await import('./js/db.js')).dumpAll(),audit:await(await import('./js/db.js')).getAll('audit_log')})")
 before=snap();url=app+'#/saha-akisi?date='+ids['date'];p.goto(url);p.wait_for_selector('[data-stream-summary]')
 assert p.locator('[data-daily-review]').count()==1,'DAILY_REVIEW_MISSING'
 panel=p.locator('[data-daily-review]');cash=panel.locator('[data-daily-control][href="#/kasa/'+ids['cash']+'"]');assert cash.count()==1 and '2 kontrol' in cash.inner_text()
 assert panel.locator('[data-daily-compare]').get_attribute('href').endswith(ids['date']);assert 'op_date='+ids['date'] in panel.locator('[data-daily-close]').get_attribute('href')
 panel.locator('[data-daily-no-work]').evaluate('(e)=>e.open=true');assert 'çalışılmadığı anlamına gelmez' in panel.inner_text();assert panel.locator('img').count()==0 and not p.evaluate('window.__dailyXss||false');assert snap()==before
 panel.locator('[data-daily-no-work] a').click();p.wait_for_selector('[data-entry-context]');assert p.input_value('[name=date]')==ids['date'] and p.input_value('[name=vehicle_id]')==ids['idle'];assert snap()==before
 p.goto(url);p.wait_for_selector('[data-daily-review]');p.locator('[data-daily-compare]').click();p.wait_for_selector('#screen[data-view-ready="1"]');assert 'date='+ids['date'] in p.url;assert snap()==before
 p.goto(url);p.wait_for_selector('[data-daily-review]');p.locator('details:has([data-stream-kind]) > summary').click();p.fill('[name=q]','TEST henüz aranmayan metin');p.evaluate("async id=>{const D=await import('./js/db.js'),r=await D.get('cash_records',id);await D.saveExisting('cash_records',r,{cash_status:'KASADA'},'TEST')}",ids['cash']);changed=snap()
 p.click('[data-daily-refresh]');p.wait_for_function("id=>!document.querySelector('[data-daily-review] a[href=\"#/kasa/'+id+'\"]')",arg=ids['cash']);assert p.input_value('[name=q]')=='TEST henüz aranmayan metin';assert p.locator('details:has([data-stream-kind])').evaluate('(e)=>e.open');assert snap()==changed
 p.locator('[data-daily-close]').click();p.wait_for_selector('[data-op-pane=close]');after_close=snap()
 if after_close!=changed:
  previous,current=json.loads(changed),json.loads(after_close);diff={}
  for key in set(previous['data'])|set(current['data']):
   if previous['data'].get(key)!=current['data'].get(key):diff[key]={'before':previous['data'].get(key),'after':current['data'].get(key)}
  if previous['audit']!=current['audit']:diff['audit']={'before':previous['audit'],'after':current['audit']}
  Path('/tmp/daily126-close-diff.json').write_text(json.dumps({'changed':diff,'equalParsedObjects':previous==current,'before':previous,'after':current},ensure_ascii=False,indent=2))
  print('DAILY_CLOSE_DIFF',json.dumps({'changed':diff,'equalParsedObjects':previous==current},ensure_ascii=False),flush=True)
 close_count=p.locator('[data-company-close]').count()
 if close_count!=1 or after_close!=changed:
  print('DAILY_CLOSE_STATE',p.evaluate("()=>({count:document.querySelectorAll('[data-company-close]').length,panes:document.querySelectorAll('[data-op-pane=close]').length,ready:document.querySelector('#screen')?.dataset.viewReady,url:location.hash,text:document.querySelector('#screen')?.innerText.slice(0,500)})"),'observed_count',close_count,flush=True)
 assert close_count==1 and after_close==changed
 for width in [320,360,390,768]:
  p.set_viewport_size({'width':width,'height':800});p.goto(url);p.wait_for_selector('[data-daily-review]');assert p.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),width
 assert not calls and not errors,(calls,errors);assert snap()==changed
 p.screenshot(path='/tmp/daily-review126.png',full_page=True);print(json.dumps({'dailyReview':True,'groupedCash':True,'datePreserved':True,'noImplicitWork':True,'refreshPreservesSearch':True,'existingClosing':True,'noUiWrites':True,'modelCalls':0,'errors':errors}));b.close()
