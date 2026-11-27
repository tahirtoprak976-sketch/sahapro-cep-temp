"""Isolated TEST source calendar: plans/promises/payables, no posting, CSV and return."""
import sys,uuid,json,csv,io
from pathlib import Path
from playwright.sync_api import sync_playwright
U=sys.argv[1] if len(sys.argv)>1 else 'http://localhost:8841/'
with sync_playwright() as w:
 b=w.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);c=b.new_context(viewport={'width':360,'height':800},accept_downloads=True);c.add_init_script("localStorage.setItem('sp_role','boss')");p=c.new_page();p.set_default_timeout(45000);errors=[];p.on('pageerror',lambda e:errors.append(str(e)));app=U+'index.html?db=TEST_weekly140_'+uuid.uuid4().hex
 p.goto(app+'#/daha');p.wait_for_selector('#screen[data-view-ready="1"]')
 ids=p.evaluate("""async()=>{const d=await import('./js/db.js'),C=await import('./js/core.js'),date=C.todayStr(),put=(s,x)=>d.put(s,C.newRecord(x)),c=await d.saveNew('customers',{name:'TEST Planned140'},'TEST'),pr=await d.saveNew('customers',{name:'TEST Promise140'},'TEST'),nd=await d.saveNew('customers',{name:'TEST Undated140'},'TEST'),s=await (await import('./js/enterprise-db.js')).saveSupplier({name:'TEST Supplier140'});
 await put('hakedis',{id:'TEST_H140',customer_id:c.id,date,status:'Kesinleşti',grand_total:1000,items:[]});await put('cari_movements',{customer_id:c.id,date,type:'Hakedis',ref_id:'TEST_H140',amount:1000});await put('cari_movements',{customer_id:c.id,date,type:'Tahsilat',amount:-200});await put('cash_records',{id:'TEST_R140',customer_id:c.id,date,cash_type:'Müşteriden Para Alındı',cash_status:'PERSONELDE',amount:200});await put('receivable_plans',{id:'TEST_PL140',customer_id:c.id,hakedis_id:'TEST_H140',installments:[{id:'TEST_I140',sequence:1,due_date:C.addDays(date,6),amount:1000}]});await put('settlement_allocations',{plan_id:'TEST_PL140',installment_id:'TEST_I140',receipt_id:'TEST_R140',date,amount:200});
 await put('cari_movements',{customer_id:pr.id,date,amount:500});await put('cari_movements',{customer_id:nd.id,date,amount:150});await d.metaSet('collect_notes',{[c.id]:{promise_date:date,promise_amount:1000},[pr.id]:{promise_date:C.addDays(date,1),promise_amount:500}});
 await put('payables',{id:'TEST_B140',party_type:'supplier',party_id:s.id,date,due_date:date,status:'Onaylandı',gross_total:700,document_no:'TEST BILL140',items:[]});await put('supplier_payments',{payable_id:'TEST_B140',party_type:'supplier',party_id:s.id,date,amount:100});return {date,customer:c.id,promise:pr.id};}""")
 p.wait_for_timeout(200);snapshot="async()=>{const s=await(await import('./js/db.js')).readSnapshot({meta:true,drafts:true,attachments:true});delete s.captured_at;return JSON.stringify(s)}";before=p.evaluate(snapshot)
 def nav(h):
  old=p.locator('#screen').element_handle();p.goto(app+h);p.wait_for_function('(e)=>!e.isConnected',arg=old);p.wait_for_selector('#screen[data-view-ready="1"]')
 nav('#/finans');p.locator('[data-finance-more-tasks] > summary').click();assert p.locator('[data-weekly-entry]').count()==1,'WEEKLY_FINANCE_MISSING';p.click('[data-weekly-entry]');p.wait_for_selector('#screen[data-view-ready="1"] [data-weekly-row]')
 assert p.locator('[data-weekly-row]').count()==4
 assert '1.300,00' in p.locator('[data-weekly-in]').inner_text() and '600,00' in p.locator('[data-weekly-out]').inner_text()
 assert p.locator('[data-weekly-row="plan:TEST_PL140:TEST_I140"]').count()==1
 assert p.locator('[data-weekly-row="promise:'+ids['customer']+'"]').count()==0
 p.select_option('[data-weekly-bucket]','review');assert p.locator('[data-weekly-row]').count()==1 and 'TEST Undated140' in p.locator('[data-weekly-list]').inner_text()
 p.select_option('[data-weekly-bucket]','week');p.select_option('[data-weekly-direction]','out');p.fill('[data-weekly-search]','Supplier140');assert p.locator('[data-weekly-row]').count()==1
 with p.expect_download() as download:p.click('[data-weekly-csv]')
 text=Path(download.value.path()).read_text(encoding='utf-8-sig');export=list(csv.reader(io.StringIO(text),delimiter=';'));assert len(export)==2 and export[1][1]=='TEST Supplier140' and float(export[1][4])==600 and 'TEST Promise140' not in text
 p.locator('[data-weekly-row] a').click();p.wait_for_selector('#screen[data-view-ready="1"]');assert '#/alislar/TEST_B140' in p.url;p.go_back();p.wait_for_selector('[data-weekly-row]');assert p.input_value('[data-weekly-search]')=='Supplier140' and p.input_value('[data-weekly-direction]')=='out'
 p.fill('[data-weekly-search]','');p.select_option('[data-weekly-direction]','all');p.select_option('[data-weekly-bucket]','all');search=p.locator('[data-weekly-search]').element_handle();p.click('[data-weekly-refresh]');p.wait_for_timeout(200);assert search.evaluate('(e)=>e.isConnected')
 assert p.evaluate(snapshot)==before,'calendar/source navigation/CSV must not post, allocate or change records/meta/drafts/attachments'
 for width in [320,360,390,768]:
  p.set_viewport_size({'width':width,'height':800});assert p.evaluate('document.documentElement.scrollWidth<=innerWidth'),p.evaluate('()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,wide:[...document.querySelectorAll("#screen *")].filter(e=>e.getBoundingClientRect().right>innerWidth).map(e=>({tag:e.tagName,cls:e.className,text:e.textContent.slice(0,45),right:e.getBoundingClientRect().right})).slice(0,10)})')
 assert not errors,errors
 print(json.dumps({'sevenDayExpected':1300,'sevenDayDue':600,'planPromiseDoubleCount':False,'noDateInReview':True,'csvFiltered':True,'returnFilters':True,'readonly':True,'errors':errors}));b.close()
