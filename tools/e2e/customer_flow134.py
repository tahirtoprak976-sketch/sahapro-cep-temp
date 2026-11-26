"""Exact customer actions and in-place entity creation; TEST only, no AI."""
import sys,uuid
from playwright.sync_api import sync_playwright
U=sys.argv[1] if len(sys.argv)>1 else 'http://localhost:8841/'
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);c=b.new_context(viewport={'width':360,'height':800});c.add_init_script("localStorage.setItem('sp_role','boss')");p=c.new_page();p.set_default_timeout(45000);errors=[];p.on('pageerror',lambda e:errors.append(str(e)))
 app=U+'index.html?db=TEST_customer134_'+uuid.uuid4().hex
 p.goto(app+'#/daha');p.wait_for_selector('#screen[data-view-ready="1"]')
 ids=p.evaluate("""async()=>{const db=await import('./js/db.js'),C=await import('./js/core.js');const a=await db.saveNew('customers',{name:'TEST Customer134'},'TEST'),sub=await db.saveNew('customers',{name:'TEST Sub134',parent_customer_id:a.id},'TEST'),off=await db.saveNew('customers',{name:'TEST Off134',active:false},'TEST'),v=await db.saveNew('vehicles',{name:'TEST Vehicle134'},'TEST');
 for(const [customer_id,amount]of [[a.id,100],[sub.id,900]])await db.saveNew('work_records',{customer_id,vehicle_id:v.id,date:C.todayStr(),work_type:'Makine Çalışması',quantity:1,unit:'Saat',price_snapshot:{unit_price:amount,amount,kdv_rate:20,kdv_included:false}},'TEST');return {id:a.id,sub:sub.id,off:off.id,v:v.id};}""")
 p.wait_for_timeout(200)
 snap="async()=>{const r=await(await import('./js/db.js')).readSnapshot({attachments:true,drafts:true,meta:true});delete r.captured_at;return JSON.stringify(r)}"
 before=p.evaluate(snap)
 def nav(hash):
  old=p.locator('#screen').element_handle();p.goto(app+hash);p.wait_for_function('(e)=>!e.isConnected',arg=old);p.wait_for_selector('#screen[data-view-ready="1"]')
 def action(fn):
  old=p.locator('#screen').element_handle();fn();p.wait_for_function('(e)=>!e.isConnected',arg=old);p.wait_for_selector('#screen[data-view-ready="1"]')
 nav('#/musteriler/'+ids['id']);assert p.locator('[data-customer-workspace]').count()==1,'CUSTOMER_WORKSPACE_MISSING'
 assert '100,00' in p.locator('[data-customer-balance]').inner_text() and '1.000' not in p.locator('[data-customer-balance]').inner_text()
 p.click('[data-dsubs]');p.click('.customer-workspace-recent summary');assert not any('900,00' in t for t in p.locator('[data-customer-recent]').all_text_contents());assert any('100,00' in t for t in p.locator('[data-customer-recent]').all_text_contents());assert '100,00' in p.locator('[data-customer-balance]').inner_text(),'child included in exact action balance'
 action(p.locator('[data-customer-action="cash"]').click);assert p.input_value('[name=customer_id]')==ids['id'];assert p.input_value('[name=amount]')=='';assert p.evaluate(snap)==before,'opening cash posted money'
 nav('#/musteriler/'+ids['id']);action(p.locator('[data-customer-action="site"]').click);assert p.input_value('[name=customer_id]')==ids['id'];assert p.input_value('[name=name]')=='';assert p.evaluate(snap)==before
 nav('#/santiyeler/new?customer_id=missing');assert 'bulunamadı' in p.locator('#screen').inner_text() and p.locator('[data-save]').count()==0
 nav('#/musteriler/'+ids['off']);assert p.locator('[data-customer-action]').count()==0
 nav('#/musteriler/'+ids['id']);action(p.locator('[data-customer-action="work"]').click);assert p.input_value('[name=customer_id]')==ids['id']
 p.fill('[name=quantity]','7');p.fill('[name=manual_price]','1234.50');p.fill('[name=description]','TEST handwritten note');p.select_option('[name=vehicle_id]',ids['v'])
 p.click('[data-work-create-site]');p.wait_for_selector('.sheet [data-p]');p.fill('.sheet [data-p]','TEST New Site134');p.click('.sheet [data-x="1"]');p.wait_for_function("()=>document.querySelector('[name=site_id]')?.selectedOptions[0]?.textContent==='TEST New Site134'")
 site=p.input_value('[name=site_id]');assert p.input_value('[name=quantity]')=='7' and p.input_value('[name=description]')=='TEST handwritten note'
 assert p.evaluate("async id=>(await(await import('./js/db.js')).get('sites',id)).customer_id",site)==ids['id']
 p.click('[data-work-create-customer]');p.wait_for_selector('.sheet [data-p]');p.fill('.sheet [data-p]','TEST New Customer134');p.click('.sheet [data-x="0"]');p.wait_for_selector('.sheet',state='detached');assert p.input_value('[name=customer_id]')==ids['id'] and p.input_value('[name=site_id]')==site
 p.click('[data-work-create-customer]');p.wait_for_selector('.sheet [data-p]');p.fill('.sheet [data-p]','TEST New Customer134');p.click('.sheet [data-x="1"]');p.wait_for_function("()=>document.querySelector('[name=customer_id]')?.selectedOptions[0]?.textContent.includes('TEST New Customer134')")
 assert p.input_value('[name=manual_price]')=='1234.50' and p.input_value('[name=quantity]')=='7' and p.input_value('[name=description]')=='TEST handwritten note' and p.input_value('[name=vehicle_id]')==ids['v'];assert p.input_value('[name=site_id]')=='','old site crossed customer'
 counts=p.evaluate("async()=>{const d=await(await import('./js/db.js')).dumpAll();return {works:d.work_records.length,cash:d.cash_records.length,sites:d.sites.length,customers:d.customers.length}}")
 assert counts=={'works':2,'cash':0,'sites':1,'customers':4},counts
 # Another customer's quick link must never silently replace this edited draft.
 p.wait_for_timeout(750);nav('#/musteriler/'+ids['sub']);p.locator('[data-customer-action="work"]').click();p.wait_for_selector('[data-work-entry-conflict]');assert p.locator('[data-work-entry-conflict]').count()==1
 p.click('[data-work-entry-choice="keep"]');p.wait_for_selector('#screen[data-view-ready="1"] [data-work-create-customer]');assert p.input_value('[name=quantity]')=='7' and p.input_value('[name=description]')=='TEST handwritten note'
 for width in [320,360,390,768]:
  p.set_viewport_size({'width':width,'height':800});assert p.evaluate('document.documentElement.scrollWidth<=innerWidth')
 nav('#/musteriler/'+ids['id']);p.set_viewport_size({'width':360,'height':800});p.evaluate('scrollTo(0,0)');p.screenshot(path='/tmp/customer134-phone.png');assert not errors,errors
 print('customer flow134 PASS: exact debtor balance/actions, blank receipt amount, site prefill, inactive/missing guards, inline creation/cancel preserves form, correct site owner, no financial writes and whole-draft conflict')
 b.close()
