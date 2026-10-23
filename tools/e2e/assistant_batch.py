"""Bulk assistant review and adversarial writes. Synthetic records; mocked model only."""
import json,sys,io
from PIL import Image
from playwright.sync_api import sync_playwright
U=(sys.argv[1] if len(sys.argv)>1 else 'http://localhost:8841/').rstrip('/')+'/'
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 c=b.new_context(viewport={'width':390,'height':844});c.add_init_script("localStorage.setItem('sp_role','boss')")
 pg=c.new_page();errors=[];calls=[];reply={};native=False
 pg.on('pageerror',lambda e:errors.append(str(e)))
 def mock(r):
  calls.append(r.request.post_data)
  parts=[{'functionCall':{'name':'prepare_plan','args':{'goal':'TEST toplu iş kontrolü','plan_json':json.dumps(reply)}}}] if native else [{'text':json.dumps(reply)}]
  r.fulfill(status=200,content_type='application/json',body=json.dumps({'candidates':[{'content':{'role':'model','parts':parts},'finishReason':'STOP'}]}))
 c.route('https://generativelanguage.googleapis.com/**',mock)
 pg.goto(U+'index.html#/daha');pg.wait_for_selector('#screen[data-view-ready="1"]')
 # A fresh browser must finish installing the offline assets before disconnecting.
 pg.evaluate("async()=>await Promise.race([navigator.serviceWorker.ready,new Promise((_,reject)=>setTimeout(()=>reject(new Error('Offline cache installation timed out')),60000))])")
 pg.wait_for_function('!!navigator.serviceWorker.controller',timeout=15000)
 ids=pg.evaluate("""async()=>{
 const db=await import('./js/db.js'),C=await import('./js/core.js');
 const a=await db.saveNew('customers',{name:'TEST Alfa'},'TEST'),z=await db.saveNew('customers',{name:'TEST Beta',fuel_rules:[{id:'TEST fuel rule',per:75,unit:'Saat',only_pay:true}]},'TEST');
 const v=await db.saveNew('vehicles',{name:'TEST JCB',type:'İş Makinesi'},'TEST');
 const site=await db.saveNew('sites',{name:'TEST Sözleşmeli Şantiye',customer_id:z.id,deal:{basis:'Götürü',price:50000,kdv_rate:20,kdv_included:false,status:'Açık'}},'TEST');
 await db.saveNew('price_book',{unit:'Saat',price:9000,kdv_rate:20,kdv_included:false,active:true},'TEST');
 const s=await (await import('./js/enterprise-db.js')).saveSupplier({name:'TEST Petrol'});
 const tank=await db.saveNew('fuel_tank_movements',{date:C.todayStr(),move_type:'GİRİŞ',liters:100,total:5000,supplier_id:s.id},'TEST');
 for(const [k,v]of Object.entries({gemini_key:'TEST',gemini_model:'gemini-2.5-flash',gemini_consent:true,gemini_daily_limit:100}))await db.metaSet(k,v);
 return {a:a.id,z:z.id,v:v.id,site:site.id,s:s.id,tank:tank.id,date:C.todayStr()};
 }""")
 def state():return pg.evaluate("async()=>{const db=await import('./js/db.js');return {data:await db.dumpAll(),audit:await db.getAll('audit_log')}}")
 def ready():pg.wait_for_function("()=>document.querySelector('[data-new-chat]')&&!document.querySelector('[data-new-chat]').disabled")
 def send(text):
  pg.fill('[data-msg]',text);pg.click('[data-ask]');pg.wait_for_function("()=>!document.querySelector('[data-ask]').disabled")
 def work(customer,qty=1,date='2026-09-05',**extra):return {'date':date,'date_source':'whatsapp','customer_id':customer,'vehicle_id':ids['v'],'work_type':'Makine Çalışması','unit':'Saat','quantity':qty,'quote':('TEST Alfa' if customer==ids['a'] else 'TEST Beta')+' TEST JCB '+str(qty)+' saat çalıştı',**extra}
 pg.goto(U+'index.html#/akilli-asistan');ready();before=state()
 reply={'works':[work(ids['a'],from_driver=True),work(ids['z'],date='2026-09-08',site_id=ids['site'])]}
 message='Bütün işler 7 Eylül 2026 tarihine ait. Fiyatlar bekleyecek; güncel fiyat listesini uygulama.\n[5/9 21:45] TEST Şoför: TEST Alfa TEST JCB 1 saat çalıştı\n[8/9 09:28] TEST Şoför: TEST Beta TEST JCB 1 saat çalıştı'
 send(message);pg.wait_for_selector('[data-kind=work][data-i="1"]')
 assert len(calls)==1 and state()==before
 for i in [0,1]:
  card=pg.locator('[data-kind=work][data-i="'+str(i)+'"]')
  assert card.locator('[name=date]').input_value()=='2026-09-07'
  assert card.locator('[name=price_pending]').is_checked()
  assert 'Fiyat bekliyor' in card.locator('[data-price-preview]').inner_text()
  assert card.locator('[data-pick]').is_checked(),card.inner_text()
 # Local batch correction needs neither a model call nor a new business record.
 c.set_offline(True);send('Tüm işler 8 Eylül 2026 olsun')
 assert len(calls)==1 and state()==before
 assert pg.input_value('[data-kind=work][data-i="0"] [name=date]')=='2026-09-08'
 assert pg.input_value('[data-kind=work][data-i="1"] [name=date]')=='2026-09-08'
 send('Fiyatlar beklesin')
 assert len(calls)==1 and not pg.locator('[data-kind=work] [data-pick]').nth(0).is_checked()
 pg.click('[data-batch-ready]')
 assert all(pg.locator('[data-kind=work] [data-pick]').nth(i).is_checked() for i in [0,1]),pg.inner_text('[data-out]')
 assert state()==before
 for width in [320,390,768]:
  pg.set_viewport_size({'width':width,'height':850});assert pg.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),width
 pg.click('[data-save]');pg.locator('[data-out]').get_by_text('Kaydedildi:',exact=False).wait_for()
 after=state();works=[w for w in after['data']['work_records'] if w['customer_id'] in [ids['a'],ids['z']]]
 assert len(works)==2
 assert all(w['date']=='2026-09-08' and w['price_snapshot'] is None and w.get('price_deferred_by_user') for w in works)
 assert all(not w.get('customer_fuel_allowance_l') for w in works),'Current fuel rules cannot rewrite an explicitly deferred historical agreement'
 assert not after['data']['cash_records'] and not after['data']['cari_movements']
 print('PASS explicit work date overrides chat timestamps; offline batch date/price replies and safe bulk selection write nothing; Save keeps both jobs unpriced despite price book, contract and fuel rules; mobile 320/390/768 fits',flush=True)
 c.set_offline(False)
 # Invalid/missing-year dates are never silently replaced by today.
 reply={'works':[work(ids['a'],qty=2,date='2026-02-31')]}
 send('Bunlar 7 Eylül işleri\nTEST Alfa TEST JCB 2 saat çalıştı')
 assert pg.input_value('[data-kind=work] [name=date]')==''
 pg.click('[data-batch-ready]');assert not pg.locator('[data-kind=work] [data-pick]').is_checked()
 c.set_offline(True);send('Tüm işler 7 Eylül 2025 olsun')
 assert pg.input_value('[data-kind=work] [name=date]')=='2025-09-07'
 pg.click('[data-batch-prices]');assert pg.locator('[data-kind=work] [name=price_pending]').is_checked()
 pg.fill('[data-kind=work] [name=unit_price]','1500');assert not pg.locator('[data-kind=work] [name=price_pending]').is_checked()
 pg.click('[data-batch-prices]');assert pg.locator('[data-kind=work] [name=price_pending]').is_checked()
 assert state()==after
 print('PASS incomplete year/invalid model date stays blank and unselected; explicit older historical date completes locally; one price button controls all eligible work cards without writes',flush=True)
 c.set_offline(False)
 # A linked invoice is not a second stock delivery; current stock overrides the old preview.
 reply={'works':[work(ids['a'],qty=3,date=ids['date'])],'fuel':[{'date':ids['date'],'vehicle_id':ids['v'],'source':'Depo Tankı','liters':30}]}
 send('TEST Alfa TEST JCB 3 saat çalıştı. TEST JCB depodan 30 litre mazot aldı.')
 assert pg.locator('[data-kind=fuel] [data-pick]').is_checked()
 pg.evaluate("""async vehicle=>{const db=await import('./js/db.js'),C=await import('./js/core.js');await db.saveNew('fuel_records',{date:C.todayStr(),vehicle_id:vehicle,fuel_source:'Depo Tankı',liters:95},'TEST concurrent real stock change');}""",ids['v'])
 reduced=state();pg.click('[data-save]')
 pg.locator('.toast').get_by_text('Depoda kayıtlı 5 L var',exact=False).wait_for()
 assert state()==reduced,'A newer stock shortage must block the first work write, not fail after it'
 # Work-only save must not be held hostage by the unavailable fuel.
 pg.uncheck('[data-kind=fuel] [data-pick]');pg.check('[data-kind=work] [name=price_pending]');pg.click('[data-save]')
 pg.locator('[data-out]').get_by_text('Kaydedildi:',exact=False).wait_for()
 assert len(state()['data']['work_records'])==3 and len(state()['data']['fuel_records'])==1
 print('PASS stock reduced after preview is re-read before any write; no work/audit leakage; selecting only work saves it independently without adding fuel or stock',flush=True)
 image=io.BytesIO();Image.new('RGB',(4,4),'white').save(image,format='PNG')
 pg.set_input_files('[data-photos]',{'name':'TEST.png','mimeType':'image/png','buffer':image.getvalue()})
 reply={'photo_texts':['TEST-FATURA-1 TEST Petrol Motorin 100 litre 5000 TL'],'tank_in':[{'date':ids['date'],'liters':100,'total':5000,'supplier_id':ids['s'],'company':'TEST Petrol','invoice_no':'TEST-FATURA-1'}],'fuel':[{'date':ids['date'],'vehicle_id':ids['v'],'source':'Depo Tankı','liters':30}]}
 send('TEST Petrol depoya 100 litre mazot faturası toplam 5000 TL. TEST JCB depodan 30 litre mazot aldı.')
 pg.wait_for_selector('[data-kind=tank] [name=tank_link]');assert pg.input_value('[data-kind=tank] [name=tank_link]')=='link'
 pg.check('[data-kind=tank] [data-pick]');pg.check('[data-kind=fuel] [data-pick]')
 baseline=state();pg.click('[data-save]');pg.locator('.toast').get_by_text('Depoda kayıtlı 5 L var',exact=False).wait_for()
 assert state()==baseline
 print('PASS linking an existing 100L delivery invoice cannot inflate the remaining 5L to 105L; all writes are rejected before invoice/fuel changes',flush=True)
 # Native persisted task uses the same local batch completion path.
 pg.click('[data-clearfiles]')
 native=True;reply={'works':[work(ids['a'],qty=4,date=ids['date'])]}
 send('TEST Alfa TEST JCB 4 saat çalıştı.')
 task0=pg.evaluate("async()=>await (await import('./js/db.js')).metaGet('assistant_task_v1')")
 assert task0['native'] and task0['status']=='draft'
 c.set_offline(True);calls0=len(calls);send('Tüm işler 7 Eylül 2026 olsun')
 task1=pg.evaluate("async()=>await (await import('./js/db.js')).metaGet('assistant_task_v1')")
 assert task1['id']==task0['id'] and task1['plan']['works'][0]['date']=='2026-09-07' and len(calls)==calls0
 send('Fiyatlar beklesin');task2=pg.evaluate("async()=>await (await import('./js/db.js')).metaGet('assistant_task_v1')")
 assert 'Fiyatlar beklesin' in task2['source'] and len(calls)==calls0
 assert state()==baseline
 print('PASS native task retains identity and persists explicit batch date/price reply offline; source and plan agree; no business writes or extra model calls',flush=True)
 # Trusted driver cards bypass the conversational completion panel, but never required dates.
 c.set_offline(False)
 signed=pg.evaluate("""async ids=>{
  const db=await import('./js/db.js'),dc=await import('./js/driver-core.js'),sec=await import('./js/security.js');
  const p=await db.saveNew('personnel',{name:'TEST Şoför'},'TEST');
  const {forDriver}=await sec.newDriverLink({pid:p.id,name:p.name,vid:ids.v});
  const cfg=dc.driverConfig(await db.dumpAll(),{personnel_id:p.id,vehicle_id:ids.v});
  return await dc.driverMessage([{id:'TEST-driver-date-1',k:'w',date:ids.date,vid:ids.v,cid:ids.a,wt:'Makine Çalışması',q:1,u:'Saat'}],{...cfg,lid:forDriver.lid,ls:forDriver.ls});
 }""",ids)
 send(signed);assert pg.locator('[data-kind=work] [data-pick]').is_checked()
 assert not pg.locator('[data-batch-ready]').count()
 assert pg.input_value('[data-kind=work] [name=date]')==ids['date']
 driver_before=state();pg.fill('[data-kind=work] [name=date]','');pg.click('[data-save]')
 pg.locator('.toast').get_by_text('İşaretli kartta eksik alan var',exact=False).wait_for()
 assert state()==driver_before
 print('PASS verified SP1 work remains trusted and outside bulk controls; clearing its required date cannot silently save today; no business/audit writes',flush=True)
 assert not errors,errors
 b.close()
print('assistant_batch browser PASS',flush=True)
