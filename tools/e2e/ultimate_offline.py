"""Actual service-worker installation and offline reload, no network/Gemini after installation."""
from playwright.sync_api import sync_playwright
U='http://localhost:8841/'
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 c=b.new_context(viewport={'width':390,'height':844},service_workers='allow')
 c.add_init_script("localStorage.setItem('sp_role','boss')")
 pg=c.new_page();errors=[];pg.on('pageerror',lambda e:errors.append(str(e)))
 pg.goto(U);pg.evaluate("async()=>await navigator.serviceWorker.ready");pg.wait_for_timeout(1800)
 if not pg.evaluate('!!navigator.serviceWorker.controller'):
  pg.reload();pg.wait_for_timeout(1200)
 assert pg.evaluate('!!navigator.serviceWorker.controller')
 pg.evaluate("""async()=>{const db=await import('./js/db.js'),C=await import('./js/core.js');const c=await db.saveNew('customers',{name:'OFFLINE TEST'},'TEST');const v=(await db.listActive('vehicles'))[0];await db.saveNew('work_records',{date:C.todayStr(),customer_id:c.id,vehicle_id:v.id,work_type:'Kazı',unit:'Saat',quantity:2,price_snapshot:{unit_price:100,kdv_rate:20,kdv_included:false}},'TEST')}""")
 c.set_offline(True);pg.goto(U+'index.html#/isletme-panosu?period=today');pg.locator('[data-overview-source=works] strong').wait_for()
 assert pg.locator('[data-overview-source=works] strong').inner_text()=='1'
 assert pg.locator('[data-overview-source=value] strong').inner_text()=='200,00 ₺'
 pg.goto(U+'index.html#/akilli-asistan');pg.locator('[data-assistant-guide]').wait_for()
 pg.fill('[data-msg]','Bugünkü durum');pg.click('[data-ask]');pg.locator('[data-answer]').wait_for()
 assert '200 TL' in pg.locator('[data-answer]').inner_text()
 assert not errors,errors
 print('PASS real SW install + fully offline document reload: overview, new modules, guide and local answer; no page errors')
 b.close()
