"""CEO decisions with real synthetic IndexedDB; source records never changed by review."""
import argparse,json,uuid,re
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright
ap=argparse.ArgumentParser();ap.add_argument('url',nargs='?',default='http://localhost:8841/');ap.add_argument('--baseline-proof',action='store_true');a=ap.parse_args();base=a.url.rstrip('/')+'/';assert urlparse(base).hostname in ('localhost','127.0.0.1')
out=Path('/tmp/solo-executive107');out.mkdir(exist_ok=True)
with sync_playwright() as w:
 b=w.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);c=b.new_context(viewport={'width':360,'height':850},locale='tr-TR');c.add_init_script("localStorage.setItem('sp_role','boss')");p=c.new_page();errors=[];p.on('pageerror',lambda e:errors.append(str(e)));url=base+'index.html?db=TEST_ceo107_'+uuid.uuid4().hex
 p.goto(url+'#/daha');p.wait_for_selector('#screen[data-view-ready="1"]')
 p.evaluate("""async()=>{const db=await import('./js/db.js'),e=await import('./js/enterprise-db.js'),C=await import('./js/core.js'),date=C.todayStr();const customer=await db.saveNew('customers',{name:'TEST Company'},'TEST'),bank=await e.saveBank({name:'TEST Bank',opening_balance:0,opening_date:date});await e.customerBankReceipt({date,customer_id:customer.id,amount:20000,bank_account_id:bank.id},'TEST_CEO_BANK');}""")
 p.goto(url+'&view=bank-proof#/');p.wait_for_selector('#screen[data-view-ready="1"]');p.locator('[data-operation-desk]').wait_for()
 if a.baseline_proof:
  row=p.get_by_text('Kasada/Personelde Bekleyen',exact=True).locator('..');assert '20.000,00' in row.inner_text();print('BASELINE reproduced: bank-only 20000 wrongly appears as pending cash');b.close();raise SystemExit
 def snap():
  return p.evaluate("async()=>{const s=await(await import('./js/db.js')).readSnapshot({attachments:true,meta:true,drafts:true});delete s.captured_at;return s;}")
 before=snap();pending_row=p.get_by_text(re.compile(r'^(Kasada/Personelde Bekleyen|Personelde / teslim onayı bekleyen)$')).locator('..');assert '20.000,00' not in pending_row.inner_text(),'Bank receipts must not appear in pending staff cash'
 assert '0,00' in p.locator('.executive-metric').nth(3).inner_text()
 assert 'Doğrulanmadı' in p.locator('.executive-metric').nth(0).inner_text();assert p.locator('[data-executive-home]').evaluate('el=>el.previousElementSibling?.classList.contains("appbar")'),'Decisions must be the first section after the page heading'
 assert p.locator('[data-assist-hero]').bounding_box()['y']<740,'Existing assistant remains reachable in first screen'
 assert snap()==before
 p.evaluate("""async()=>{const db=await import('./js/db.js'),e=await import('./js/enterprise-db.js'),C=await import('./js/core.js'),date=C.todayStr(),customer=(await db.getAll('customers'))[0],supplier=await e.saveSupplier({name:'TEST Supplier'}),vehicle=await db.saveNew('vehicles',{name:'TEST Machine',type:'JCB'},'TEST');await db.metaSet('cash_on_hand',{amount:100,date:C.addDays(date,-1)});await db.saveNew('work_records',{date:C.addDays(date,-45),customer_id:customer.id,vehicle_id:vehicle.id,work_type:'Makine Çalışması',quantity:1,unit:'Saat',price_snapshot:{unit_price:30000,amount:30000,kdv_rate:20,kdv_included:false}},'TEST');await db.metaSet('collect_notes',{[customer.id]:{promise_date:date,promise_amount:10000}});await e.savePayable({date,due_date:C.addDays(date,1),party_type:'supplier',party_id:supplier.id,document_no:'TEST_DUE',items:[{description:'TEST Cost',quantity:1,unit:'Adet',unit_price:300,kdv_rate:0}]});}""")
 before=snap();p.goto(url+'&view=decisions#/');p.wait_for_selector('#screen[data-view-ready="1"]');p.locator('[data-executive-home]').wait_for()
 assert 'güncel değil' in p.locator('.executive-metric').nth(0).inner_text();assert '300,00' in p.locator('.executive-metric').nth(1).inner_text();assert '10.000,00' in p.locator('.executive-metric').nth(2).inner_text()
 assert p.locator('[data-executive-tasks] a').count()==3
 p.screenshot(path=str(out/'home-360.png'),full_page=True)
 for width in (320,360,390,768):
  p.set_viewport_size({'width':width,'height':850});assert p.evaluate('document.documentElement.scrollWidth<=innerWidth'),width
 p.set_viewport_size({'width':360,'height':850});p.locator('.executive-metric').nth(0).click();p.wait_for_selector('[data-cashflow-stress-summary]');assert '−200,00' in p.locator('[data-cashflow-stress-summary]').inner_text();assert 'Eski tarihli' in p.locator('[data-cashflow-stress-summary]').inner_text()
 assert p.locator('[data-cashflow-stress]').count()==5
 p.screenshot(path=str(out/'stress-360.png'),full_page=True)
 assert snap()==before,'Review must preserve all entities, metadata, drafts and original attachments';assert not errors,errors
 print(json.dumps({'bankPending':0,'bankActual':20000,'due':300,'aged':10000,'stress':-200,'widths':[320,360,390,768],'recordsUnchanged':True,'errors':errors}));b.close()
