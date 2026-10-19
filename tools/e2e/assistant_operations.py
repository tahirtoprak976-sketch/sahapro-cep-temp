"""Real mobile UI + IndexedDB. Synthetic records, no real Gemini or user data."""
from playwright.sync_api import sync_playwright
U='http://localhost:8841/'
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 ctx=b.new_context(viewport={'width':412,'height':900},service_workers='block')
 ctx.add_init_script("localStorage.setItem('sp_role','boss')")
 pg=ctx.new_page();errors=[];network=[]
 pg.on('pageerror',lambda e:errors.append(str(e)))
 pg.route('https://generativelanguage.googleapis.com/**',lambda r:(network.append(r.request.url),r.abort()))
 pg.goto(U);pg.wait_for_timeout(1500)
 ids=pg.evaluate("""async()=>{const db=await import('./js/db.js');const sec=await import('./js/security-core.js');const core=await import('./js/core.js');await db.metaSet('sec_lock',{...(await sec.hashSecret('482917')),idle_min:30,away_min:15});const c=await db.saveNew('customers',{name:'İşlem Örnek'},'TEST');const per=await db.saveNew('personnel',{name:'Deneme Operatör'},'TEST');const v=(await db.listActive('vehicles'))[0];const works=[];for(let i=0;i<2;i++)works.push((await db.saveNew('work_records',{date:core.addDays(core.todayStr(),-1),customer_id:c.id,personnel_id:per.id,vehicle_id:v.id,work_type:'Kazı',unit:'Saat',quantity:2,price_snapshot:{unit_price:1500,kdv_rate:20,kdv_included:false,amount:3000,price_source:'Manuel'}},'TEST')).id);return {works};}""")
 pg.goto(U+'index.html#/akilli-asistan');pg.wait_for_timeout(1800)
 if pg.locator('#lock-root [data-pw]').count():
  pg.fill('#lock-root [data-pw]','482917');pg.click('#lock-root [data-go-un]');pg.wait_for_timeout(600)
 def ask(qty):
  pg.evaluate("location.hash='#/akilli-asistan'");pg.wait_for_selector('textarea[data-msg]')
  pg.fill('textarea[data-msg]',f'Deneme dünkü işini {qty} saat yap');pg.click('[data-ask]')
  pg.wait_for_selector('[data-action-choices]')
 def snapshot():
  return pg.evaluate('(id)=>import("./js/db.js").then(async db=>({w:await db.get("work_records",id),n:(await db.getAll("audit_log")).filter(a=>a.entity_id===id&&a.action==="update").length}))',ids['works'][0])
 before=snapshot();ask(3)
 assert pg.locator('[data-work-choice]').count()==2
 assert snapshot()==before
 pg.locator('[data-work-id="'+ids['works'][0]+'"]').click();pg.wait_for_selector('[data-work-preview]')
 assert '5.400' in pg.locator('[data-work-preview]').inner_text()
 assert snapshot()==before
 pg.click('[data-work-cancel]');assert snapshot()==before
 print('PASS selection, price/VAT preview and cancel write nothing')
 pg.locator('[data-work-id="'+ids['works'][0]+'"]').click();pg.wait_for_selector('[data-work-confirm]');pg.click('[data-work-confirm]')
 pg.locator('[data-out]').get_by_text('İş miktarı güncellendi ve kayıt doğrulandı.',exact=False).wait_for()
 after=snapshot();assert after['w']['quantity']==3 and after['w']['price_snapshot']['amount']==4500 and after['n']==before['n']+1
 print('PASS explicit confirmation writes quantity + recalculated amount + exactly one audit')
 ask(3);pg.locator('[data-work-id="'+ids['works'][0]+'"]').click();pg.locator('[data-work-preview]').get_by_text('Miktar zaten bu değerde',exact=False).wait_for()
 assert pg.locator('[data-work-confirm]').count()==0
 print('PASS same quantity is a no-op')
 ask(4);pg.locator('[data-work-id="'+ids['works'][0]+'"]').click();pg.wait_for_selector('[data-work-confirm]')
 other=ctx.new_page();other.goto(U);other.wait_for_timeout(800)
 other.evaluate('(id)=>import("./js/db.js").then(async db=>db.saveExisting("work_records",await db.get("work_records",id),{quantity:5},"TEST other tab"))',ids['works'][0])
 pg.click('[data-work-confirm]');pg.locator('[data-action-preview]').get_by_text('Kayıt önizlemeden sonra değişti',exact=False).wait_for()
 assert snapshot()['w']['quantity']==5
 print('PASS stale preview cannot overwrite another tab')
 # Two real connections race with the same previously approved preview.
 plan=pg.evaluate('(id)=>Promise.all([import("./js/db.js"),import("./js/assistant-operations.js")]).then(async([db,op])=>op.previewWorkQuantity(await db.get("work_records",id),{type:"work.quantity",quantity:6,unit:"Saat"},await db.dumpAll()))',ids['works'][0])
 # Schedule the same preview on two real Pages/connections at one shared start time.
 import time
 start=int(time.time()*1000)+1000
 schedule="""({plan,start})=>{window.__actionPromise=(async()=>{const db=await import('./js/db.js');const op=await import('./js/assistant-operations.js');await new Promise(r=>setTimeout(r,Math.max(0,start-Date.now())));try{return (await op.executeWorkQuantity(db,plan,true)).status}catch(e){return e.code}})();return true}"""
 for page in [pg,other]:page.evaluate(schedule,{'plan':plan,'start':start})
 race=[page.evaluate('async()=>await window.__actionPromise') for page in [pg,other]]
 assert sorted(race)==['STALE','updated'],race
 assert snapshot()['w']['quantity']==6
 print('PASS simultaneous confirmed executions produce one update and one STALE')
 assert not errors,errors
 assert not network,network
 print('PASS no Gemini requests or page errors')
 b.close()
