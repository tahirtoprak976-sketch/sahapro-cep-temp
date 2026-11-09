"""Mobile finance workspace, real synthetic IDB, read-only navigation and triage."""
import argparse,json,uuid
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright
ap=argparse.ArgumentParser();ap.add_argument('url',nargs='?',default='http://localhost:8841/');a=ap.parse_args();base=a.url.rstrip('/')+'/';assert urlparse(base).hostname in ('localhost','127.0.0.1')
out=Path('/tmp/solo-finance106');out.mkdir(exist_ok=True)
with sync_playwright() as w:
 b=w.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);c=b.new_context(viewport={'width':360,'height':850},locale='tr-TR');c.add_init_script("localStorage.setItem('sp_role','boss')");p=c.new_page();errors=[];external=[];p.on('pageerror',lambda e:errors.append(str(e)))
 def route(r):
  if urlparse(r.request.url).hostname in ('localhost','127.0.0.1'):r.continue_()
  else:external.append(r.request.url);r.abort()
 c.route('**/*',route);app=base+'index.html?db=TEST_fin106_'+uuid.uuid4().hex;p.goto(app+'#/daha');p.wait_for_selector('#screen[data-view-ready="1"]')
 ids=p.evaluate("""async()=>{const db=await import('./js/db.js'),C=await import('./js/core.js'),E=await import('./js/enterprise-db.js'),date=C.todayStr(),customer=await db.saveNew('customers',{name:'TEST Kuzey Kurumsal'},'TEST'),person=await db.saveNew('personnel',{name:'TEST Operator'},'TEST'),vehicle=await db.saveNew('vehicles',{name:'TEST JCB',type:'JCB'},'TEST');const w=await db.saveNew('work_records',{date,customer_id:customer.id,vehicle_id:vehicle.id,work_type:'Makine Çalışması',quantity:1,unit:'Saat',price_snapshot:{unit_price:1000,amount:1000,kdv_rate:20,kdv_included:false}},'TEST');await db.saveNew('work_records',{date,customer_id:customer.id,vehicle_id:vehicle.id,work_type:'Makine Çalışması',quantity:2,unit:'Saat',price_snapshot:null},'TEST');await db.saveCashEvent({date,customer_id:customer.id,personnel_id:person.id,cash_type:'Müşteriden Para Alındı',cash_status:'PERSONELDE',payment_method:'Nakit',amount:100.5});await db.put('cash_records',{id:'TEST_HANDOVER',date,customer_id:customer.id,personnel_id:person.id,cash_type:'Müşteriden Para Alındı',cash_status:'TESLIM_BILDIRILDI',amount:50,payment_method:'Nakit'});await db.put('cari_movements',{id:'TEST_HANDOVER_CARI',date,customer_id:customer.id,type:'Tahsilat',ref_id:'TEST_HANDOVER',amount:-50});const bank=await E.saveBank({name:'TEST Banka',opening_balance:0,opening_date:date});await E.customerBankReceipt({date,customer_id:customer.id,amount:25.35,bank_account_id:bank.id},'TEST_BANK106');const supplier=await E.saveSupplier({name:'TEST Tedarikçi'});await E.savePayable({date:C.addDays(date,-2),due_date:C.addDays(date,-1),party_type:'supplier',party_id:supplier.id,document_no:'TEST_DUE106',items:[{description:'TEST Malzeme',quantity:1,unit:'Adet',unit_price:300,kdv_rate:0}]});const item={work_record_id:w.id,date,customer_id:customer.id,vehicle_id:vehicle.id,work_type:w.work_type,quantity:1,unit:'Saat',unit_price:1000,kdv_rate:0,kdv_included:false},t=C.calcHakedisTotals([item]);await db.createHakedis({hakedis_no:1,customer_id:customer.id,status:'Taslak',date_from:date,date_to:date,created_date:date,items:t.lines,subtotal:t.subtotal,kdv_total:t.kdv,grand_total:t.grand});return {customer:customer.id,date};}""")
 def snap():return p.evaluate("async()=>{const db=await import('./js/db.js'),s=await db.readSnapshot({attachments:true,meta:true,drafts:true});delete s.captured_at;return s;}")
 # A new document avoids carrying the fixture-write refresh timer into capture.
 before=snap();p.goto(app+'&view=finance106#/finans');p.wait_for_selector('[data-finance-custody]');p.wait_for_selector('#screen[data-view-ready="1"]')
 version=p.evaluate("async()=>(await import('./js/core.js')).APP_VERSION")
 metrics=p.evaluate("()=>{const root=document.querySelector('#screen');return {height:Math.round(root.getBoundingClientRect().height),visibleControls:[...root.querySelectorAll('a,button,input,select,summary')].filter(el=>el.checkVisibility()&&!el.disabled).length,primaryActions:root.querySelectorAll('.finance-actions a').length};}")
 print(json.dumps({'version':version,'metrics':metrics}),flush=True);p.screenshot(path=str(out/(('before' if '05' in version else 'after')+'-360.png')),full_page=True)
 assert snap()==before,'Opening finance must not write any record, metadata, draft or original'
 assert metrics['primaryActions']==4,'Four primary finance actions must be reachable without opening the tool directory'
 assert metrics['visibleControls']<=26,metrics
 assert metrics['height']<=2500,metrics
 assert p.locator('[data-finance-tasks] > .finance-task').count()==3
 assert 'fiyatı eksik' in p.locator('[data-finance-tasks] > .finance-task').nth(0).inner_text()
 assert 'onay bekliyor' in p.locator('[data-finance-tasks] > .finance-task').nth(1).inner_text()
 assert 'kayıtlı vadesi geçmiş' in p.locator('[data-finance-tasks] > .finance-task').nth(2).inner_text()
 assert not p.locator('[data-finance-tools]').evaluate('el=>el.open')
 assert p.locator('[data-finance-tool]').count()==29
 for href in ['#/finans/kasa/new','#/gider/new','#/hakedis/hazirlik','#/cari']:
  p.locator('.finance-actions a[href="'+href+'"]').click();p.wait_for_selector('#screen[data-view-ready="1"]');assert p.evaluate('location.hash')==href;p.goto(app+'#/finans');p.wait_for_selector('[data-finance-custody]');p.wait_for_selector('#screen[data-view-ready="1"]')
 p.locator('[data-finance-more-tasks] summary').click();assert 'taslak hakediş' in p.locator('[data-finance-more-tasks]').inner_text()
 search=p.locator('[data-finance-search]');p.click('[data-finance-open-tools]');assert search.evaluate('el=>el===document.activeElement');p.evaluate('window.TEST_search=document.querySelector("[data-finance-search]")');search.fill('BANKA');assert p.locator('[data-finance-tool]:visible').count()==1 and p.locator('[data-finance-tool]:visible').get_attribute('href')=='#/bankalar'
 assert p.evaluate('window.TEST_search===document.activeElement'),'Search must retain input identity and focus'
 search.fill('olmayan araç');assert 'Araç bulunamadı' in p.locator('[data-finance-search-status]').inner_text();p.click('[data-finance-search-clear]');assert search.input_value()=='' and not p.locator('[data-finance-tools]').evaluate('el=>el.open')
 p.locator('[data-finance-tools] > summary').click();targets=p.locator('[data-finance-tool]').evaluate_all('es=>es.map(e=>e.getAttribute("href"))');assert len(set(targets))==29 and '#/esnaf' in targets
 for width in (320,360,390,768):
  p.set_viewport_size({'width':width,'height':850});assert p.evaluate('document.documentElement.scrollWidth<=innerWidth'),width
  assert p.locator('.finance-stat[href="#/gider"] .v').evaluate('el=>{const r=document.createRange();r.selectNodeContents(el);return r.getClientRects().length===1}'),width
 search.fill('banka');p.locator('[data-finance-tool]:visible').click();p.wait_for_selector('#screen[data-view-ready="1"]');assert p.evaluate('location.hash')=='#/bankalar'
 assert snap()==before,'Searching, opening groups and navigating existing forms must not write financial data'
 assert not errors and not external,(errors,external)
 (out/'result.json').write_text(json.dumps({'version':version,'metrics':metrics,'toolCount':29,'recordsUnchanged':True,'widths':[320,360,390,768],'errors':errors},ensure_ascii=False,indent=2));print('PASS finance106 mobile primary actions, scoped priorities, search/focus, all tools, exact data and narrow layout',flush=True);b.close()
