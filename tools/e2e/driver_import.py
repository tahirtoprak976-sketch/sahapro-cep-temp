"""Real assistant import: mixed signed driver packet with multiple photos per record. Synthetic data only."""
import io, sys
from PIL import Image
from playwright.sync_api import sync_playwright
U='http://localhost:8841/'
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 c=b.new_context(viewport={'width':390,'height':844});c.add_init_script("localStorage.setItem('sp_role','boss')")
 c.grant_permissions(['clipboard-read','clipboard-write'],origin=U.rstrip('/'))
 pg=c.new_page();errs=[];calls=[];pg.on('pageerror',lambda e:errs.append(str(e)))
 pg.route('https://generativelanguage.googleapis.com/**',lambda r:(calls.append(r.request.url),r.abort()))
 pg.goto(U);pg.wait_for_timeout(1000)
 packet=pg.evaluate("""async()=>{const db=await import('./js/db.js'),D=await import('./js/driver-core.js'),C=await import('./js/core.js');await db.metaSet('gemini_key','TEST');await db.metaSet('gemini_model','gemini-2.5-flash');await db.metaSet('gemini_consent',true);const d=await db.dumpAll();const v=d.vehicles[0].id,p=d.personnel[0].id;const customer=await db.saveNew('customers',{name:'Driver Import TEST'},'TEST');const link=await (await import('./js/security.js')).newDriverLink({pid:p,name:d.personnel[0].name});const cfg={...D.driverConfig(await db.dumpAll(),{personnel_id:p,vehicle_id:v,company:'TEST'}),...link.forDriver};const date=C.todayStr();return {text:await D.driverMessage([{id:'fuel-many',k:'f',date,vid:v,L:20,src:'Akaryakıt İstasyonu',tl:900,ph:2},{id:'expense-many',k:'g',date,vid:v,cat:'Yemek',tl:200,pay:'sirket',ph:2},{id:'maintenance-many',k:'m',date,vid:v,mt:'Lastik',desc:'Test lastik',st:'Açık',ph:2},{id:'work-many',date,vid:v,cid:customer.id,wt:'Hafriyat Nakliye',q:2,u:'Sefer',ph:2}],cfg),pid:p}}""")
 files=[]
 for i in range(8):
  f=io.BytesIO();Image.new('RGB',(300,400),(20*i,100,150)).save(f,'JPEG');files.append({'name':f'photo-{i}.jpg','mimeType':'image/jpeg','buffer':f.getvalue()})
 pg.goto(U+'index.html#/akilli-asistan');pg.wait_for_selector('[data-msg]');pg.fill('[data-msg]',packet['text']);pg.set_input_files('[data-photos]',files)
 pg.click('[data-ask]');pg.wait_for_timeout(2000)
 assert pg.locator('[data-kind]').count()>=4,pg.inner_text('[data-out]')
 pg.click('[data-save]');pg.wait_for_timeout(2500)
 for _ in range(5):
  if not pg.locator('.sheet').count():break
  pg.locator('.sheet button').first.click();pg.wait_for_timeout(400)
 results=pg.evaluate("""async()=>{const db=await import('./js/db.js');const result={};for(const [store,kind,id] of [['fuel_records','fuel','fuel-many'],['expense_records','expense','expense-many'],['maintenance_records','maintenance','maintenance-many'],['work_records','work','work-many']]){const row=(await db.listActive(store)).find(r=>r.driver_entry_id===id);result[kind]=row?(await db.attachmentsFor(kind,row.id)).length:-1;}return result}""")
 print('Attachment counts',results,flush=True)
 assert results=={'fuel':2,'expense':2,'maintenance':2,'work':2},results
 assert not calls,'Signed packets must not call Gemini'
 print('PASS mixed packet imports all 8 photos into their 4 correct records without Gemini',flush=True)
 # Setup cache must respect selected duration, never automatically revoke a still-used link.
 pg.evaluate("""async()=>{const db=await import('./js/db.js'),S=await import('./js/security-core.js');await db.metaSet('sec_lock',{...(await S.hashSecret('482917')),idle_min:30,away_min:15})}""")
 pg.goto(U+'index.html#/sofor-kur?pid='+packet['pid']);pg.wait_for_timeout(500)
 def copy():
  pg.click('[data-copy]');pg.wait_for_selector('#lock-root [data-pw]');pg.fill('#lock-root [data-pw]','482917');pg.click('#lock-root [data-go-un]');pg.wait_for_function("() => !document.querySelector('[data-copy]').disabled")
  return pg.evaluate('navigator.clipboard.readText()')
 u1=copy();pg.select_option('[data-days]','30');u2=copy()
 assert u1!=u2,'duration change must create a new code'
 links=pg.evaluate("async()=>await(await import('./js/security.js')).driverLinks()")
 assert len(links)==3 and not any(l['revoked_at'] for l in links),links
 print('PASS duration change creates new link; prior valid links stay valid',flush=True)
 assert not errs,errs
 b.close()
