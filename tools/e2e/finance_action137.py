"""TEST ten-customer finance task bench; exact source, scope, no posts."""
import sys,uuid,json
from playwright.sync_api import sync_playwright
U=sys.argv[1] if len(sys.argv)>1 else 'http://localhost:8841/'
with sync_playwright() as w:
 b=w.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);c=b.new_context(viewport={'width':360,'height':800});c.add_init_script("localStorage.setItem('sp_role','boss')");p=c.new_page();p.set_default_timeout(45000);errors=[];p.on('pageerror',lambda e:errors.append(str(e)));app=U+'index.html?db=TEST_finance137_'+uuid.uuid4().hex
 p.goto(app+'#/daha');p.wait_for_selector('#screen[data-view-ready="1"]')
 ids=p.evaluate("""async()=>{const d=await import('./js/db.js'),C=await import('./js/core.js'),date=C.todayStr(),v=await d.saveNew('vehicles',{name:'TEST Machine137',ownership:'Özmal',vehicle_type:'İş Makinesi'},'TEST');let ids=[];for(let n=0;n<10;n++){const c=await d.saveNew('customers',{name:'TEST Queue137 '+n},'TEST'),s=await d.saveNew('sites',{name:'TEST Site137 '+n,customer_id:c.id},'TEST'),work=await d.saveNew('work_records',{date,customer_id:c.id,site_id:s.id,vehicle_id:v.id,work_type:'Makine Çalışması',unit:'Saat',quantity:1,price_snapshot:n%2?{unit_price:1000,amount:1000,kdv_rate:20,kdv_included:false}:null},'TEST');ids.push({customer:c.id,site:s.id,work:work.id});}return {ids,date};}""")
 p.wait_for_timeout(200);snap="async()=>{const s=await(await import('./js/db.js')).readSnapshot({attachments:true,meta:true,drafts:true});delete s.captured_at;return JSON.stringify(s)}";before=p.evaluate(snap)
 def nav(h):
  old=p.locator('#screen').element_handle();p.goto(app+h);p.wait_for_function('(e)=>!e.isConnected',arg=old);p.wait_for_selector('#screen[data-view-ready="1"]')
 nav('#/finans?period=month');assert p.locator('[data-finance-action-queue]').count()==1,'FINANCE_ACTION_QUEUE_MISSING';p.locator('[data-finance-more-tasks] > summary').click();p.wait_for_selector('[data-finance-work]');assert p.locator('[data-finance-work]').count()==3
 assert p.locator('[data-finance-action-queue]').evaluate('(e)=>e.compareDocumentPosition(document.querySelector("[data-finance-general]"))&Node.DOCUMENT_POSITION_FOLLOWING')
 assert '10 iş' in p.locator('[data-finance-queue-result]').inner_text()
 seen=set(p.locator('[data-finance-work]').evaluate_all('(els)=>els.map(e=>e.dataset.financeWork)'))
 for _ in range(3):
  p.click('[data-finance-queue-page="1"]');seen.update(p.locator('[data-finance-work]').evaluate_all('(els)=>els.map(e=>e.dataset.financeWork)'))
 assert len(seen)==10
 p.click('[data-finance-queue-kind=missing]');assert p.locator('[data-finance-work]').count()==3
 p.fill('[data-finance-queue-search]','Site137 0');assert p.locator('[data-finance-work]').count()==1
 row=p.locator('[data-finance-work]');assert row.get_attribute('data-finance-work')==ids['ids'][0]['work'];assert 'İş fiyatı kayıtlı değil' in row.inner_text();assert row.locator('[data-finance-work-next]').get_attribute('href')=='#/isler/'+ids['ids'][0]['work']+'/edit'
 # Actual source editing form; only read, do not save. Return by native history.
 p.click('[data-finance-work-next]');p.wait_for_selector('#screen[data-view-ready="1"] [data-form]');assert p.input_value('[name=customer_id]')==ids['ids'][0]['customer'];assert p.input_value('[name=site_id]')==ids['ids'][0]['site'];p.go_back();p.wait_for_selector('[data-finance-work]');assert p.locator('[data-finance-more-tasks]').evaluate('(e)=>e.open');assert p.input_value('[data-finance-queue-search]')=='Site137 0';assert p.locator('[data-finance-queue-kind=missing]').get_attribute('aria-pressed')=='true'
 p.fill('[data-finance-queue-search]','');p.click('[data-finance-queue-kind=ready]');assert p.locator('[data-finance-work]').count()==3
 href=p.locator('[data-finance-work-next]').first.get_attribute('href');assert 'date_from='+ids['date'][:8]+'01' in href and 'customer_id=' in href
 assert p.evaluate(snap)==before,'queue, filters, source form wrote records/meta/drafts/attachments'
 for width in [320,360,390,768]:
  p.set_viewport_size({'width':width,'height':800});assert p.evaluate('document.documentElement.scrollWidth<=innerWidth')
 nav('#/ticari-masa?from='+ids['date']+'&to='+ids['date']);p.wait_for_selector('[data-finance-work]');assert p.locator('[data-finance-work]').count()==3
 search=p.locator('[data-finance-queue-search]');search.fill('Queue137 0');handle=search.element_handle();p.click('[data-commercial-refresh]');p.wait_for_timeout(300);assert handle.evaluate('(e)=>e.isConnected');assert search.input_value()=='Queue137 0';assert p.locator('[data-finance-work]').count()==1
 assert p.evaluate(snap)==before
 assert not errors,errors
 print(json.dumps({'tenCustomerBench':{'workRows':10,'missing':5,'ready':5,'financeToExactMissingWorkClicks':2},'scopeAndFilterReturn':True,'readonly':True,'errors':errors}));b.close()
