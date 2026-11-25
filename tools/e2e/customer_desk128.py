"""Customer workflow on a phone; synthetic records, read-only, scoped links and period changes."""
import sys,uuid
from playwright.sync_api import sync_playwright
U=sys.argv[1] if len(sys.argv)>1 else 'http://localhost:8841/'
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 c=b.new_context(viewport={'width':360,'height':800});c.add_init_script("localStorage.setItem('sp_role','boss')")
 p=c.new_page();errors=[];p.on('pageerror',lambda e:errors.append(str(e)))
 app=U+'index.html?db=TEST_customer_desk_'+uuid.uuid4().hex
 p.goto(app+'#/daha');p.wait_for_selector('#screen[data-view-ready="1"]')
 ids=p.evaluate("""async()=>{const db=await import('./js/db.js'),{todayStr}=await import('./js/core.js');
 const cust=await db.saveNew('customers',{name:'TEST Workflow'},'TEST'),sub=await db.saveNew('customers',{name:'TEST Child',parent_customer_id:cust.id},'TEST'),v=await db.saveNew('vehicles',{name:'TEST Machine'},'TEST');
 const date=todayStr(),price={unit_price:100,amount:200,kdv_rate:20,kdv_included:false};
 await db.saveNew('work_records',{customer_id:cust.id,vehicle_id:v.id,date,work_type:'Makine Çalışması',quantity:2,unit:'Saat',price_snapshot:price},'TEST');
 await db.saveNew('work_records',{customer_id:sub.id,vehicle_id:v.id,date,work_type:'Makine Çalışması',quantity:3,unit:'Saat',price_snapshot:{...price,amount:300}},'TEST');
 return {id:cust.id,date};}""")
 p.wait_for_timeout(200)
 snap="async()=>{const db=await import('./js/db.js');return {data:await db.dumpAll(),audit:await db.getAll('audit_log')}}"
 before=p.evaluate(snap)
 p.goto(app+'#/musteriler/'+ids['id']);p.wait_for_selector('#screen[data-view-ready="1"]')
 assert p.locator('[data-customer-desk]').count()==1,'CUSTOMER_DESK_MISSING'
 desk=p.locator('[data-customer-desk]');assert 'Hakedişe hazır' in desk.inner_text();assert desk.locator('.stat b').all_text_contents()==['0','0','1','0']
 href=desk.locator('[data-customer-reconciliation]').get_attribute('href');assert 'customer_id='+ids['id'] in href and 'date_from='+ids['date'][:4]+'-01-01' in href
 p.click('[data-dper="last"]');assert desk.locator('.stat b').all_text_contents()==['0','0','0','0'];assert p.evaluate(snap)==before
 p.click('[data-dper="year"]');p.click('[data-dsubs]');assert desk.locator('.stat b').all_text_contents()==['0','0','1','0'],'child toggle must not mix workflow debtors'
 assert p.evaluate('document.documentElement.scrollWidth<=innerWidth'),'phone overflow'
 p.click('[data-customer-reconciliation]');p.wait_for_selector('#screen[data-view-ready="1"] [data-unpriced]');assert p.input_value('[name=customer_id]')==ids['id'];assert p.input_value('[name=date_from]')==ids['date'][:4]+'-01-01'
 assert p.evaluate(snap)==before,'opening reconciliation must not post or approve'
 assert not errors,errors
 print('customer_desk128 PASS: phone workflow/period/exact customer/reconciliation route; no business or audit writes',flush=True);b.close()
