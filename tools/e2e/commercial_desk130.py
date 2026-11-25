"""Cross-customer readonly financial follow-up; TEST data only, real Chromium + IDB."""
import sys,uuid
from playwright.sync_api import sync_playwright
U=sys.argv[1] if len(sys.argv)>1 else 'http://localhost:8850/'
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);c=b.new_context(viewport={'width':360,'height':800});c.add_init_script("localStorage.setItem('sp_role','boss')")
 p=c.new_page();errors=[];p.on('pageerror',lambda e:errors.append(str(e)));app=U+'index.html?db=TEST_commercial130_'+uuid.uuid4().hex
 p.goto(app+'#/daha');p.wait_for_selector('#screen[data-view-ready="1"]')
 ids=p.evaluate("""async()=>{const db=await import('./js/db.js'),C=await import('./js/core.js'),date=C.todayStr();
 const parent=await db.saveNew('customers',{name:'TEST Parent130'},'TEST'),child=await db.saveNew('customers',{name:'TEST Child130',parent_customer_id:parent.id},'TEST'),missing=await db.saveNew('customers',{name:'TEST Missing130'},'TEST'),draft=await db.saveNew('customers',{name:'TEST Draft130'},'TEST'),v=await db.saveNew('vehicles',{name:'TEST Machine130'},'TEST');
 const w=(customer,extra={})=>db.saveNew('work_records',{customer_id:customer.id,date,vehicle_id:v.id,work_type:'Makine Çalışması',quantity:1,unit:'Saat',price_snapshot:{unit_price:1000,amount:1000,kdv_rate:20,kdv_included:false},...extra},'TEST');
 await w(child);await w(parent,{quantity:2,price_snapshot:{unit_price:250,amount:500,kdv_rate:20,kdv_included:false}});await w(missing,{price_snapshot:null});const dw=await w(draft);
 // Isolated synthetic pre-existing draft. This screen must not reserve or finalize anything itself.
 await db.put('hakedis',C.newRecord({id:'TEST_DRAFT130',customer_id:draft.id,date,status:'Taslak',items:[{work_record_id:dw.id}]}));
 await db.metaSet('collect_notes',{[child.id]:{promise_date:C.addDays(date,2),promise_amount:500}});
 return {parent:parent.id,child:child.id,missing:missing.id,draft:draft.id,date};}""")
 p.wait_for_timeout(200)
 snapshot="async()=>{const s=await(await import('./js/db.js')).readSnapshot({attachments:true,meta:true,drafts:true});delete s.captured_at;return JSON.stringify(s)}";before=p.evaluate(snapshot)
 p.goto(app+'#/finans');p.wait_for_selector('#screen[data-view-ready="1"]');assert p.locator('[data-commercial-entry]').count()==1,'COMMERCIAL_DESK_MISSING';p.click('[data-commercial-entry]');p.wait_for_selector('#screen[data-view-ready="1"] [data-commercial-desk]')
 assert p.locator('[data-commercial-customer]').count()==4
 child=p.locator('[data-commercial-customer="'+ids['child']+'"]');parent=p.locator('[data-commercial-customer="'+ids['parent']+'"]');draft=p.locator('[data-commercial-customer="'+ids['draft']+'"]')
 assert '1.000,00 TL' in child.inner_text() and '500,00 TL' in parent.inner_text();assert 'Ödeme sözü yaklaşıyor' in child.inner_text();assert '500,00 TL' in child.locator('[data-commercial-promise]').inner_text();assert draft.locator('[data-commercial-next]').get_attribute('href')=='#/hakedis/TEST_DRAFT130'
 href=child.locator('a[href^="#/hakedis/hazirlik?"]').get_attribute('href');assert 'customer_id='+ids['child'] in href and 'date_from='+ids['date'][:7]+'-01' in href
 for row in p.locator('[data-commercial-customer]').all():
  links=row.locator('.row a').evaluate_all('(els)=>els.map(e=>e.getAttribute("href"))');assert len(links)==len(set(links)),'duplicate actions'
 assert p.evaluate(snapshot)==before,'opening desk and filtering must not post/approve/pay or modify metadata'
 p.fill('[data-commercial-search]','Child130');assert p.locator('[data-commercial-customer]').count()==1
 p.click('[data-commercial-filter="ready"]');assert p.input_value('[data-commercial-search]')=='Child130';assert p.locator('[data-commercial-customer]').count()==1
 p.fill('[name=from]',ids['date']);p.locator('[data-commercial-period] button[type=submit], [data-commercial-period] button:not([type])').click();assert p.locator('[data-commercial-error]').inner_text()==''
 p.fill('[data-commercial-search]','');p.select_option('[data-commercial-status]','review');assert p.locator('[data-commercial-customer]').count()==1
 assert p.evaluate(snapshot)==before
 # Incoming source update refreshes the region without losing filters or typed date fields.
 p.evaluate("""async id=>{const db=await import('./js/db.js'),r=await db.get('customers',id);await db.saveExisting('customers',r,{name:'TEST Missing130 Updated'},'TEST rename')}""",ids['missing'])
 p.wait_for_function("()=>document.querySelector('[data-commercial-list]')?.textContent.includes('Missing130 Updated')");assert p.input_value('[data-commercial-status]')=='review';assert p.input_value('[name=from]')==ids['date']
 # Notes stored in meta are reread on focus even when no business record event occurs.
 p.select_option('[data-commercial-status]','promises');p.evaluate("""async ids=>{const db=await import('./js/db.js');await db.metaSet('collect_notes',{[ids.child]:{promise_date:'2026-02-31',promise_amount:'invalid'}});window.dispatchEvent(new Event('focus'));}""",ids)
 p.wait_for_function("()=>document.querySelector('[data-commercial-promise]')?.textContent.includes('kontrol edin')");assert 'geçersiz' in p.locator('[data-commercial-promise]').inner_text()
 assert p.evaluate('document.documentElement.scrollWidth<=innerWidth'),'360px overflow'
 after=p.evaluate(snapshot);p.click('[data-commercial-refresh]');p.wait_for_timeout(300);assert p.evaluate(snapshot)==after
 p.goto(app+'#/hakedis');p.wait_for_selector('#screen[data-view-ready="1"] [data-commercial-entry]');assert not errors,errors
 print('commercial_desk130 PASS: finance/claim entry, exact debtor, net VAT basis, promise not cash, draft source, scoped handoff, readonly/meta, filters and refresh, 360px',flush=True);b.close()
