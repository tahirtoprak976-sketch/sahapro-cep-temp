"""Cross-screen edit protection, field labels, dialogs, malformed routes and unknown money."""
import argparse,json,uuid
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright
ap=argparse.ArgumentParser();ap.add_argument('url',nargs='?',default='http://localhost:8841/');ap.add_argument('--case',choices=['dirty','labels','modal','uri','money','menu','source','profit']);a=ap.parse_args();base=a.url.rstrip('/')+'/';assert urlparse(base).hostname in ('localhost','127.0.0.1')
out=Path('/tmp/solo-system108');out.mkdir(exist_ok=True)
with sync_playwright() as w:
 b=w.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);c=b.new_context(viewport={'width':360,'height':850},locale='tr-TR',service_workers='block');c.add_init_script("localStorage.setItem('sp_role','boss')");p=c.new_page();errors=[];external=[];p.on('pageerror',lambda e:errors.append(str(e)))
 def route(r):
  if urlparse(r.request.url).hostname in ('localhost','127.0.0.1'):r.continue_()
  else:external.append(r.request.url);r.abort()
 c.route('**/*',route);url=base+'index.html?db=TEST_system108_'+uuid.uuid4().hex
 def go(h):p.goto(url+h);p.wait_for_selector('#screen[data-view-ready="1"]')
 def risk():return p.evaluate("async()=>(await import('./js/update-safety.js')).updateRisk(document.querySelector('#screen'))")
 def snap():return p.evaluate("async()=>{const s=await(await import('./js/db.js')).readSnapshot({attachments:true,meta:true,drafts:true});delete s.captured_at;return s;}")
 go('#/finans');before=snap();done=[]
 if a.case in (None,'dirty'):
  # Real in-document route replacement, after event tracking was initially installed.
  p.evaluate("location.hash='#/ayarlar'");p.wait_for_selector('[data-coform] input');p.wait_for_selector('#screen[data-view-ready="1"]');p.locator('[data-coform] input').first.fill('TEST unsaved company')
  assert risk()['unsaved'],'Edited settings after navigation must block an unconfirmed update'
  decision=p.evaluate("async()=>{let asked=0;const result=await(await import('./js/update-safety.js')).allowUpdate(document.querySelector('#screen'),async()=>{asked++;return false});return {...result,asked};}")
  assert decision['asked']==1 and not decision['allowed'];assert p.locator('[data-coform] input').first.input_value()=='TEST unsaved company';assert snap()==before;done.append('dirty')
 if a.case in (None,'labels'):
  go('#/ayarlar');label=p.locator('[data-coform] .field label').first
  assert label.evaluate('e=>!!e.control'),'Visible form label must be associated with its real input'
  label.click();assert label.evaluate('e=>e.control===document.activeElement')
  p.evaluate("document.querySelector('#screen').insertAdjacentHTML('beforeend','<div class=field data-dynamic-label><label>TEST dynamic</label><input name=test_dynamic></div>')")
  p.wait_for_function("()=>!!document.querySelector('[data-dynamic-label] label').control")
  go('#/isler/new');labels=p.locator('form .field label').evaluate_all('es=>es.map(e=>({text:e.textContent,associated:!!e.control}))');assert labels and all(x['associated']for x in labels),labels
  assert snap()==before;done.append('labels')
 if a.case in (None,'modal'):
  go('#/nakit');p.evaluate("()=>{window.TEST_dialog=(async()=>await(await import('./js/ui.js')).promptDialog('TEST Input','TEST Amount',''))();}");p.wait_for_selector('.sheet [data-p]')
  assert risk()['busy'],'An open input dialog must block update and automatic refresh'
  assert p.locator('.sheet').get_attribute('role')=='dialog';assert p.locator('.sheet').get_attribute('aria-modal')=='true'
  p.locator('.sheet [data-x="1"]').focus();p.keyboard.press('Tab');assert p.locator('.sheet').evaluate('el=>el.contains(document.activeElement)'),'Tab must stay inside the open dialog'
  p.locator('.sheet [data-x="0"]').click();assert p.evaluate('window.TEST_dialog') is None;p.wait_for_selector('.sheet',state='detached');assert not risk()['busy'];assert snap()==before;done.append('modal')
 if a.case in (None,'uri'):
  go('#/finans');p.evaluate("location.hash='#/%E0%A4%A'");p.wait_for_timeout(300)
  assert p.locator('[data-invalid-route]').count()==1,'Malformed encoded routes must show a recoverable error, not an unhandled rejection'
  p.locator('[data-invalid-route] [data-go="#/"]').click();p.wait_for_selector('[data-executive-home]');p.wait_for_selector('#screen[data-view-ready="1"]');assert snap()==before;done.append('uri')
 if a.case in (None,'menu'):
  go('#/daha');version=p.evaluate("async()=>(await import('./js/core.js')).APP_VERSION")
  assert version in p.locator('#screen').inner_text(),'More must show the actual running version'
  assert 'hiçbir veri gönderilmez' not in p.locator('#screen').inner_text()
  before=snap();search=p.locator('[data-menu-search]');search.fill('banka');assert search.evaluate('el=>el===document.activeElement')
  targets=p.locator('#screen button[data-go],#screen a[href^="#/"]');visible=targets.evaluate_all('es=>es.filter(e=>e.checkVisibility()).map(e=>e.textContent.toLocaleLowerCase("tr-TR"))');assert visible and all('banka'in text for text in visible),visible
  search.fill('olmayanmodul');assert 'Modül bulunamadı' in p.locator('[data-menu-status]').inner_text();p.click('[data-menu-clear]');assert targets.evaluate_all('es=>es.filter(e=>e.checkVisibility()).length')>40
  assert snap()==before;done.append('menu')
 if a.case in (None,'source'):
  go('#/daha');work=p.evaluate("""async()=>{const D=await import('./js/db.js'),date=(await import('./js/core.js')).todayStr(),customer=await D.saveNew('customers',{name:'TEST Source Customer'},'TEST'),vehicle=await D.saveNew('vehicles',{name:'TEST Source Machine',type:'JCB'},'TEST');return await D.saveNew('work_records',{date,customer_id:customer.id,vehicle_id:vehicle.id,work_type:'Makine Çalışması',quantity:1,unit:'Saat',description:'TEST note 👈',assistant_origin:{version:1,kind:'work',message:'TEST original 🧾 ↔️ <img src=x onerror=window.TEST_injected=1>',fragment:'TEST note 👈',status:'matched',fields:{description:'TEST note 👈'}}},'TEST');}""")
  before=snap();go('#/isler/'+work['id']);p.locator('[data-record-source] summary').click()
  assert p.locator('[data-record-source] > div').inner_text()=='TEST original 🧾 ↔️ <img src=x onerror=window.TEST_injected=1>','Original source must remain verbatim, including symbols'
  assert p.locator('[data-record-source] img').count()==0 and not p.evaluate('window.TEST_injected===1');assert snap()==before;done.append('source')
 if a.case in (None,'profit'):
  go('#/daha');p.evaluate("""async()=>{const D=await import('./js/db.js'),C=await import('./js/core.js'),date=C.todayStr(),customer=await D.saveNew('customers',{name:'TEST Claim Review'},'TEST'),vehicle=await D.saveNew('vehicles',{name:'TEST Claim Machine',type:'JCB'},'TEST');const work=await D.saveNew('work_records',{date,customer_id:customer.id,vehicle_id:vehicle.id,work_type:'Makine Çalışması',quantity:1,unit:'Saat',price_snapshot:{unit_price:1000,amount:1000,kdv_rate:0,kdv_included:false}},'TEST');await D.put('work_records',{...work,price_snapshot:{...work.price_snapshot,locked:true}});}""")
  before=snap()
  for h,selector in [('#/','[data-home-profit]'),('#/yonetici','[data-manager-profit]'),('#/finans','[data-month-profit]')]:
   go(h);assert 'hakediş kaynağı kontrol bekliyor' in p.locator(selector).inner_text().lower(),'Unverified claim source must suppress numeric profit on every summary screen'
  assert snap()==before;done.append('profit')
 if a.case in (None,'money'):
  go('#/daha');p.evaluate("""async()=>{const d=await import('./js/db.js'),date=(await import('./js/core.js')).todayStr(),customer=await d.saveNew('customers',{name:'TEST Legacy Customer'},'TEST');await d.put('cash_records',{id:'TEST_UNKNOWN_CASH',date,customer_id:customer.id,cash_type:'Müşteriden Para Alındı',cash_status:'PERSONELDE',amount:null});}""")
  before=snap();go('#/');tile=p.locator('.executive-metric').nth(3)
  assert 'Doğrulayın' in tile.inner_text(),'Unknown staff cash must not be displayed as zero money'
  assert 'Tutarı doğrulayın' in p.get_by_text('Personelde / teslim onayı bekleyen',exact=True).locator('..').inner_text();assert snap()==before;done.append('money')
  p.screenshot(path=str(out/'unknown-money-360.png'),full_page=True)
 assert not errors and not external,(errors,external)
 print(json.dumps({'passed':done,'recordsMetaDraftsAttachmentsUnchanged':True,'pageErrors':errors},ensure_ascii=False),flush=True);b.close()
