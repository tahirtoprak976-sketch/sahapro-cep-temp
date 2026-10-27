"""Record-local notes and read-only legacy cleanup. Mock AI; real DOM/IDB/backup."""
import sys,json
from playwright.sync_api import sync_playwright
U=(sys.argv[1] if len(sys.argv)>1 else 'http://localhost:8842/').rstrip('/')+'/'
MSG='''[23/10 17:54] TEST Tırcı A: TEST Ocak A 4 sefer ocak taşı TEST Dolgu
[23/10 19:03] TEST Cihan: TEST Üniversite TEST Metalciye U(55)mini kato (1)yevmiye Şantiyeden (43) lt yakıt aldım
[23/10 19:10] TEST Tırcı B: TEST Ocak B TEST Dolguya 4 sefer taş TEST Sahadan bir sefer TEST Dolguya beton parçaları ve 150 litre mazot alındı
[23/10 19:23] TEST Olcay: U36 mini kato TEST Usta 1 saat çevre düzenlemesi
[23/10 20:05] TEST Soner: 22 Ekim Perşembe TEST Alfa inşaat 3.5 saat parke verildi
[23/10 21:26] TEST Soner: 23 Ekim Cuma TEST Beta yapı TEST Ömer beye çalışıldı. TEST Şantiyeye 1 saat fayans indirildi'''
MSG+='\n[23/10 22:00] TEST Güvenlik: '+('Ayrı sohbet verisi. '*90)+'<img src=x onerror="window.__sourceInjected=1">'
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);errors=[]
 def profile():
  c=b.new_context(viewport={'width':390,'height':850});c.add_init_script("localStorage.setItem('sp_role','boss')");pg=c.new_page();pg.on('pageerror',lambda e:errors.append(str(e)));pg.goto(U+'index.html#/daha');pg.wait_for_selector('#screen[data-view-ready="1"]');return c,pg
 def seed(pg):return pg.evaluate("""async()=>{const d=await import('./js/db.js');const a=await d.saveNew('customers',{name:'TEST Alfa İnşaat'},'TEST'),z=await d.saveNew('customers',{name:'TEST Beta Yapı'},'TEST'),v=await d.saveNew('vehicles',{name:'U55',type:'İş Makinesi'},'TEST'),v2=await d.saveNew('vehicles',{name:'U36',type:'İş Makinesi'},'TEST'),man=await d.saveNew('vehicles',{name:'TEST Manitou',type:'İş Makinesi'},'TEST'),s=await d.saveNew('personnel',{name:'TEST Soner'},'TEST');await d.saveNew('fuel_tank_movements',{date:'2026-10-01',move_type:'GİRİŞ',liters:2000,total:100000},'TEST');return {a:a.id,z:z.id,v:v.id,v2:v2.id,man:man.id,s:s.id}}""")
 def state(pg):return pg.evaluate("async()=>{const d=await import('./js/db.js');return JSON.stringify({d:await d.dumpAll(),audit:await d.getAll('audit_log')})}")
 c,pg=profile();ids=seed(pg)
 legacy=pg.evaluate("""async x=>{const d=await import('./js/db.js');const f=await d.saveNew('fuel_records',{date:'2026-10-23',vehicle_id:x.ids.v,liters:43,fuel_source:'Depo Tankı',description:'Asistan: '+x.message},'TEST');const w=await d.saveNew('work_records',{date:'2026-10-22',customer_id:x.ids.a,vehicle_id:x.ids.man,personnel_id:x.ids.s,work_type:'Makine Çalışması',quantity:3.5,unit:'Saat',description:'parke verildi',internal_note:'Bildiren: TEST Soner · Asistan: '+x.message},'TEST');return {f:f.id,w:w.id}}""",{'ids':ids,'message':MSG})
 before=state(pg)
 # Seed writes schedule the app's 80 ms record-refresh debounce. Drain it on the
 # non-refreshable fixture route, as operation_history.py does, before clicking
 # disclosures in the view under test. No source/content assertion is changed.
 pg.wait_for_timeout(200)
 pg.goto(U+'index.html#/yakit');pg.wait_for_selector('[data-operation-record]')
 note=pg.locator('[data-operation-record="'+legacy['f']+'"] [data-record-note]').inner_text();assert '43' in note and 'U(55)' in note and 'TEST Beta' not in note and '150 litre' not in note,note
 assert not pg.locator('[data-record-source]').evaluate('(el)=>el.open')
 pg.evaluate("window.__recordSourceRootBeforeClick=document.querySelector('#screen')")
 try:
  pg.locator('[data-record-source] summary').click();assert 'TEST Beta' in pg.locator('[data-record-source]').inner_text()
 except AssertionError:
  diagnostic=pg.evaluate("""()=>{const el=document.querySelector('[data-record-source]'),root=document.querySelector('#screen');return {hash:location.hash,open:el?.open,outerHTML:el?.outerHTML,visibleText:el?.innerText,viewReady:root?.dataset.viewReady,rootReplaced:root!==window.__recordSourceRootBeforeClick}}""")
  print('RECORD SOURCE FAILURE DIAGNOSTIC '+json.dumps(diagnostic,ensure_ascii=False),flush=True)
  raise
 pg.evaluate('delete window.__recordSourceRootBeforeClick')
 assert pg.locator('[data-record-source] img').count()==0 and pg.evaluate('window.__sourceInjected||0')==0
 assert state(pg)==before,'merely viewing legacy notes must not write business/audit data'
 pg.goto(U+'index.html#/yakit?q=TEST Beta');pg.wait_for_selector('[data-operation-list]');assert pg.locator('[data-operation-record]').count()==0
 pg.goto(U+'index.html#/isler/'+legacy['w']);pg.wait_for_selector('[data-record-note]');assert all('TEST Beta' not in x for x in pg.locator('[data-record-note]').all_inner_texts()) and 'TEST Alfa' in ' '.join(pg.locator('[data-record-note]').all_inner_texts())
 assert state(pg)==before
 # The editor shows only this job, and saving preserves the original evidence.
 pg.goto(U+'index.html#/isler/'+legacy['w']+'/edit');pg.wait_for_selector('[name=internal_note]')
 assert 'TEST Alfa' in pg.input_value('[name=internal_note]') and 'TEST Beta' not in pg.input_value('[name=internal_note]')
 pg.fill('[name=internal_note]','TEST yalnız bu işe ait elle not');pg.click('[data-save]');pg.wait_for_function('()=>!document.querySelector("[name=internal_note]")')
 edited=pg.evaluate("async id=>(await import('./js/db.js')).get('work_records',id)",legacy['w']);assert edited['internal_note']=='TEST yalnız bu işe ait elle not' and edited['quantity']==3.5 and MSG in edited['assistant_origin']['message']
 print('PASS exact U55/43L legacy reproduction; collapsed full source; no unrelated customer search hit; read-only views write nothing; work editor stays local and explicit Save retains original evidence',flush=True)
 c2,p2=profile();ids2=seed(p2);calls=[]
 reply={'works':[{'date':'2026-10-22','date_source':'mesaj','customer_id':ids2['a'],'vehicle_id':ids2['man'],'personnel_id':ids2['s'],'work_type':'Makine Çalışması','quantity':3.5,'unit':'Saat','description':'parke verildi','quote':'22 Ekim Perşembe TEST Alfa inşaat 3.5 saat parke verildi'},{'date':'2026-10-23','date_source':'mesaj','customer_id':ids2['z'],'vehicle_id':ids2['man'],'personnel_id':ids2['s'],'work_type':'Makine Çalışması','quantity':1,'unit':'Saat','description':'fayans indirildi','quote':'23 Ekim Cuma TEST Beta yapı TEST Ömer beye çalışıldı. TEST Şantiyeye 1 saat fayans indirildi'}],'fuel':[{'date':'2026-10-23','vehicle_id':ids2['v'],'liters':43,'source':'Depo Tankı','quote':'(43) lt yakıt aldım'},{'date':'2026-10-23','vehicle_id':ids2['v2'],'liters':150,'source':'Depo Tankı','quote':'150 litre mazot alındı'}]}
 def mock(route):
  calls.append(1);body=json.loads(route.request.post_data)
  parts=[{'functionCall':{'name':'prepare_plan','args':{'goal':'TEST iş ve yakıt notları','plan_json':json.dumps(reply)}}}] if body.get('tools') else [{'text':json.dumps(reply)}]
  route.fulfill(status=200,content_type='application/json',body=json.dumps({'candidates':[{'content':{'role':'model','parts':parts},'finishReason':'STOP'}]}))
 c2.route('https://generativelanguage.googleapis.com/**',mock)
 p2.evaluate("async()=>{const d=await import('./js/db.js');for(const[k,v]of Object.entries({gemini_key:'TEST',gemini_model:'gemini-2.5-flash',gemini_consent:true,gemini_daily_limit:100}))await d.metaSet(k,v)}")
 p2.goto(U+'index.html#/akilli-asistan');p2.wait_for_selector('[data-ask]');p2.fill('[data-msg]',MSG);p2.click('[data-ask]');p2.wait_for_selector('[data-kind=fuel][data-i="1"]')
 for card in p2.locator('[data-kind=work],[data-kind=fuel]').all():card.locator('[data-pick]').check()
 p2.click('[data-save]');p2.wait_for_function("()=>document.querySelector('[data-new-chat]')&&!document.querySelector('[data-new-chat]').disabled")
 saved=p2.evaluate("""async()=>{const d=await import('./js/db.js'),B=await import('./js/backup.js'),P=await import('./js/pro.js'),C=await import('./js/core.js');const all=await d.dumpAll(),names=Object.fromEntries(['vehicles','customers','personnel'].map(k=>[k,Object.fromEntries(all[k].map(r=>[r.id,r.name]))]));return {works:all.work_records,fuel:all.fuel_records,remaining:C.calcTankBalance(all.fuel_tank_movements).remaining,public:all.work_records.map(r=>JSON.stringify(P.recordSpec('work_records',r,names,'customer'))),backup:await B.fullBackup(d,{attachments:'base64'})}}""")
 assert len(saved['works'])==2 and len(saved['fuel'])==2 and saved['remaining']==1807,saved
 assert all(x['assistant_origin']['message']==MSG for x in saved['works']+saved['fuel'])
 wa=next(x for x in saved['works'] if x['customer_id']==ids2['a']);wb=next(x for x in saved['works'] if x['customer_id']==ids2['z'])
 assert 'TEST Alfa' in wa['internal_note'] and 'TEST Beta' not in wa['internal_note'] and 'TEST Alfa' not in wb['internal_note']
 assert next(x for x in saved['fuel'] if x['liters']==43)['description']=='(43) lt yakıt aldım'
 assert next(x for x in saved['fuel'] if x['liters']==150)['description']=='150 litre mazot alındı'
 assert all('assistant_origin' not in x and 'TEST Tırcı A' not in x and '150 litre mazot' not in x for x in saved['public'])
 p2.goto(U+'index.html#/yakit');p2.wait_for_selector('[data-operation-record]');assert all('TEST Beta' not in x for x in p2.locator('[data-record-note]').all_inner_texts())
 for width in [320,390,768]:p2.set_viewport_size({'width':width,'height':850});assert p2.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),width
 clean,p3=profile();restored=p3.evaluate("""async backup=>{const d=await import('./js/db.js'),B=await import('./js/backup.js');await B.restoreBackup(d,backup);const all=await d.dumpAll();return [...all.work_records,...all.fuel_records].map(r=>r.assistant_origin.message)}""",saved['backup']);assert restored==[MSG]*4
 delivery=p3.evaluate("""async()=>{const d=await import('./js/db.js'),N=await import('./js/record-notes.js'),C=await import('./js/core.js');const all=await d.dumpAll(),customer=all.customers.find(c=>c.name==='TEST Alfa İnşaat');const quote='TEST Alfa İnşaat forkliftine 20 litre mazot verildi, litresi 50 TL';const source='[24/10 12:00] TEST: '+quote+'\\n[24/10 12:01] TEST Başka: Başka bir müşterinin işi';const f=N.withRecordSource({date:C.todayStr(),customer_id:customer.id,machine:'Forklift',liters:20,unit_price:50,note:''},source,{customer_id:customer.id,liters:20,source_quote:quote},'fuelout',all,['note']);const r=await d.saveCustomerFuelDelivery(f,'TEST');const next=await d.dumpAll();return {source:r.assistant_origin.message===source,note:r.note===quote,amount:next.cari_movements.find(c=>c.ref_id===r.id).amount,remaining:C.calcTankBalance(next.fuel_tank_movements).remaining}}""")
 assert delivery=={'source':True,'note':True,'amount':1000,'remaining':1787},delivery
 assert not errors,errors;b.close()
print('record_notes browser PASS: independent saved notes, exact full-source backup/restore, public PDF isolation, unchanged dates/quantities/stock and mobile layout',flush=True)
