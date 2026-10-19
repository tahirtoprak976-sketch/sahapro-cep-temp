"""SOLO ultimate: real mobile UI/IndexedDB; synthetic data, no real Gemini."""
import base64
from playwright.sync_api import sync_playwright
U='http://localhost:8841/'
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 c=b.new_context(viewport={'width':360,'height':800},service_workers='block',timezone_id='Europe/Istanbul',locale='tr-TR')
 c.add_init_script("localStorage.setItem('sp_role','boss')")
 pg=c.new_page();errors=[];calls=[]
 pg.on('pageerror',lambda e:errors.append(str(e)))
 pg.route('https://generativelanguage.googleapis.com/**',lambda r:(calls.append(r.request.url),r.abort()))
 pg.goto(U);pg.wait_for_timeout(1200)
 ids=pg.evaluate("""async()=>{const db=await import('./js/db.js'),C=await import('./js/core.js'),S=await import('./js/security-core.js');const T=C.todayStr();await db.metaSet('sec_lock',{...(await S.hashSecret('482917')),idle_min:30,away_min:15});await db.metaSet('gemini_key','TEST');await db.metaSet('gemini_model','gemini-2.5-flash');await db.metaSet('gemini_consent',true);
 const customer=await db.saveNew('customers',{name:'<img src=x onerror="window.__xss=1"> Uzun Örnek İnşaat Taahhüt Limited Şirketi'},'TEST');
 const fc=await db.saveNew('customers',{name:'Mazot TEST',fuel_rules:[{id:'R',per:75,unit:'Sefer',match:'',only_pay:true}]},'TEST');
 const v=(await db.listActive('vehicles'))[0],person=(await db.listActive('personnel'))[0];
 const work={date:T,customer_id:customer.id,vehicle_id:v.id,work_type:'Kazı',unit:'Saat',quantity:2};
 const w=await db.saveNew('work_records',{...work,price_snapshot:{unit_price:100,kdv_rate:20,kdv_included:false}},'TEST');
 await db.saveNew('work_records',{...work,quantity:1,price_snapshot:{unit_price:0,kdv_rate:0,kdv_included:false}},'TEST');
 await db.saveNew('work_records',{...work,customer_id:fc.id,unit:'Sefer',quantity:5,customer_fuel_allowance_l:375,price_snapshot:{unit_price:0,kdv_rate:0,kdv_included:false,price_source:'Mazot karşılığı'}},'TEST');
 const missing=await db.saveNew('work_records',{...work,date:C.addDays(T,-1),unit:'Ton',quantity:3},'TEST');
 await db.saveNew('work_records',{...work,date:C.addDays(T,-10),unit:'Yevmiye',quantity:1},'TEST');
 await db.saveNew('work_records',{...work,date:C.addDays(T,1),quantity:99},'TEST');
 const cash=await db.saveNew('cash_records',{date:T,customer_id:customer.id,cash_type:'Müşteriden Para Alındı',amount:120,payment_method:'Nakit'},'TEST');
 await db.saveNew('expense_records',{date:T,vehicle_id:v.id,amount:50,category:'Lastik'},'TEST');
 await db.saveNew('fuel_records',{date:T,vehicle_id:v.id,customer_id:fc.id,liters:300,fuel_source:'Müşteri Verdi'},'TEST');
 await db.saveNew('fuel_records',{date:T,vehicle_id:v.id,liters:10,fuel_source:'Akaryakıt İstasyonu',total:450},'TEST');
 await db.saveNew('maintenance_records',{date:T,vehicle_id:v.id,cost:100,status:'Tamamlandı',description:'TEST'},'TEST');
 await db.put('payroll_entries',C.newRecord({date:T,personnel_id:person.id,period:T.slice(0,7),kind:'Ücret Tahakkuku',amount:1000}));
 await db.metaSet('pdf_history_draft:TEST',{version:1,_file_name:'TEST.pdf',rows:[{id:'0',kind:'work'}]});
 return {T,customer:customer.id,w:w.id,missing:missing.id,cash:cash.id};}""")
 def unlock():
  if pg.locator('#lock-root [data-pw]').count():pg.fill('#lock-root [data-pw]','482917');pg.click('#lock-root [data-go-un]')
 def go(hash):
  pg.goto(U+'index.html#/'+hash);pg.wait_for_timeout(900);unlock();pg.wait_for_timeout(150)
 def snapshot():return pg.evaluate("async()=>{const d=await import('./js/db.js');return {data:await d.dumpAll(),audit:await d.getAll('audit_log')}}")
 baseline=snapshot()
 go('');pg.locator('[data-overview-home]').wait_for();pg.click('[data-overview-home]');pg.locator('[data-overview-period=today]').wait_for()
 pg.click('[data-overview-period=today]')
 def metric(k):return pg.locator('[data-overview-source='+k+'] strong').inner_text()
 assert metric('works')=='3',metric('works')
 assert metric('value')=='200,00 ₺'
 assert metric('cash')=='120,00 ₺'
 assert metric('cost')=='1.600,00 ₺',metric('cost')
 assert '5 Sefer' in pg.locator('.ultimate-unit-strip').inner_text()
 assert '3 Saat' in pg.locator('.ultimate-unit-strip').inner_text()
 assert pg.locator('[data-overview-inspector] .ultimate-source').count()==3
 assert pg.evaluate('window.__xss||0')==0
 assert 'Kalan 75 L' in pg.locator('#screen').inner_text()
 assert '1 PDF’de 1 satır bekliyor' in pg.locator('#screen').inner_text()
 print('PASS period metrics, separate units, payroll-inclusive cost, fuel-only accounting, PDF pending and escaped names')
 pg.click('[data-overview-metric=cash]');pg.click('[data-overview-bar="0"]')
 assert pg.locator('[data-overview-inspector] .ultimate-source').count()==1
 assert pg.locator('[data-overview-inspector] [data-go]').get_attribute('data-go')=='#/kasa/'+ids['cash']
 pg.click('[data-overview-period=week]');pg.click('[data-overview-source=missing]')
 assert pg.locator('[data-overview-inspector] .ultimate-source').count()==1
 assert pg.locator('[data-overview-inspector] [data-go]').get_attribute('data-go')=='#/isler/'+ids['missing']
 pg.click('[data-overview-period=custom]');pg.fill('[data-overview-from]',ids['T']);pg.fill('[data-overview-to]','2099-01-01');pg.click('[data-overview-apply]')
 assert pg.locator('.ultimate-metrics').count()==0
 assert 'bitiş bugün veya daha önce' in pg.locator('#screen').inner_text()
 pg.click('[data-overview-period=today]');pg.click('[data-overview-refresh]');pg.wait_for_timeout(500)
 assert metric('works')=='3'
 assert snapshot()==baseline
 print('PASS chart-to-source links, missing-price inspector, invalid range hides stale metrics, refresh writes no entity/audit')
 pg.screenshot(path='/workspace/ultimate-mobile.png',full_page=True)
 go('isler?f=fiyatsiz');assert pg.locator('[data-list] .li').count()==3
 print('PASS explicitly zero-priced and fuel-only works excluded from missing-price list')
 go('akilli-asistan');pg.locator('[data-assistant-guide]').wait_for();pg.locator('[data-assistant-guide] summary').click()
 pg.fill('[data-guide-search]','PDF');assert pg.locator('[data-guide-task=pdf]').count()==1 and pg.locator('[data-guide-task=work]').count()==0
 pg.fill('[data-guide-search]','');pg.click('[data-guide-group=Rapor]')
 assert pg.locator('[data-guide-task=today]').count()==1 and pg.locator('[data-guide-task=work]').count()==0
 pg.click('[data-guide-task=today]');assert pg.input_value('[data-msg]')=='Bugünkü durum'
 assert len(calls)==0
 pg.click('[data-ask]');pg.locator('[data-answer]').wait_for()
 assert '200 TL' in pg.locator('[data-answer]').inner_text()
 assert len(calls)==0
 pg.wait_for_timeout(650);assert pg.evaluate("async()=>await(await import('./js/db.js')).metaGet('assistant_draft')") == ''
 pg.fill('[data-msg]','Korunacak taslak');pg.locator('[data-assistant-guide] summary').click() if not pg.locator('[data-assistant-guide]').evaluate('(e)=>e.open') else None
 pg.click('[data-guide-task=month]');pg.locator('.sheet [data-x="0"]').wait_for();pg.click('.sheet [data-x="0"]')
 assert pg.input_value('[data-msg]')=='Korunacak taslak'
 pg.click('[data-guide-task=month]');pg.click('.sheet [data-x="1"]');assert pg.input_value('[data-msg]')=='Bu ayın özeti'
 print('PASS searchable task guide, unsent examples, local answer without Gemini, cancel preserves draft')
 pg.locator('[data-photos]').set_input_files({'name':'TEST.png','mimeType':'image/png','buffer':base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a0XcAAAAASUVORK5CYII=')})
 pg.locator('[data-clearfiles]').wait_for()
 pg.click('[data-guide-task=today]');assert pg.input_value('[data-msg]')=='Bu ayın özeti'
 pg.click('[data-clearfiles]');assert pg.locator('[data-photos]').input_value()==''
 pg.fill('[data-msg]','');pg.click('[data-guide-task=today]');assert pg.input_value('[data-msg]')=='Bugünkü durum'
 c.set_offline(True);pg.click('[data-ask]');pg.locator('[data-answer]').wait_for();assert len(calls)==0
 assert snapshot()==baseline
 print('PASS file attachments never silently enter local example; explicit clear; offline answer with no data writes')
 c.set_offline(False);go('isletme-panosu?period=today')
 for width in [320,360,768,1280]:
  pg.set_viewport_size({'width':width,'height':900});pg.wait_for_timeout(100)
  assert pg.evaluate('document.documentElement.scrollWidth<=document.documentElement.clientWidth+1'),width
 # Failed reads must never appear as zero activity; retry uses fresh real IndexedDB.
 pg.evaluate("""async()=>{const db=await import('./js/db.js'),UI=await import('./js/business-overview-ui.js');const old=document.querySelector('#screen'),root=old.cloneNode(false);old.replaceWith(root);let fail=true;const proxy={...db,dumpAll:async()=>{if(fail){fail=false;throw Error('TEST read failure')}return db.dumpAll()}};await UI.screen({root,db:proxy,query:{period:'today'}})}""")
 assert pg.locator('.ultimate-metrics').count()==0
 assert pg.locator('[data-overview-period=today]').is_disabled()
 pg.click('[data-overview-refresh]');pg.locator('[data-overview-source=works] strong').wait_for()
 assert metric('works')=='3'
 assert snapshot()==baseline
 print('PASS failed read shows no false zero metrics; retry recovers actual records')
 assert not errors,errors
 print('PASS 320/360/768/1280 widths without page overflow; no page errors or Gemini calls')
 b.close()
