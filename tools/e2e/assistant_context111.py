"""Bounded shared-source questions; real browser and TEST DB, canned model only."""
import json,sys,uuid
from playwright.sync_api import sync_playwright
U=sys.argv[1] if len(sys.argv)>1 else 'http://localhost:8888/'
with sync_playwright()as w:
 b=w.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);c=b.new_context(viewport={'width':360,'height':850},service_workers='block');c.add_init_script("localStorage.setItem('sp_role','boss')");p=c.new_page();errors=[];calls=[];reply={};p.on('pageerror',lambda e:errors.append(str(e)))
 def model(r):
  calls.append(r.request.post_data);r.fulfill(status=200,content_type='application/json',body=json.dumps({'candidates':[{'content':{'parts':[{'text':json.dumps(reply)}]},'finishReason':'STOP'}]}))
 c.route('https://generativelanguage.googleapis.com/**',model)
 p.goto(U+'index.html?db=TEST_context111_'+uuid.uuid4().hex+'#/akilli-asistan');p.wait_for_function("()=>document.querySelector('[data-msg]')&&!document.querySelector('[data-msg]').readOnly&&!document.querySelector('[data-ask]').disabled")
 ids=p.evaluate("""async()=>{const db=await import('./js/db.js'),C=await import('./js/core.js');await db.put('customers',{id:'TEST_C',name:'Akasya Yapı'});await db.put('vehicles',{id:'TEST_V',name:'Kazıcı 8',type:'JCB',assignee_id:'TEST_P'});await db.put('personnel',{id:'TEST_P',name:'Salih',vehicle_id:'TEST_V'});await db.put('sites',{id:'TEST_S',name:'Koru Parsel',customer_id:'TEST_C'});for(const [k,v]of Object.entries({gemini_key:'TEST_FAKE_KEY',gemini_model:'TEST_FAKE_MODEL',gemini_consent:true,gemini_daily_limit:20}))await db.metaSet(k,v);return {today:C.todayStr(),yesterday:C.addDays(C.todayStr(),-1)};}""")
 p.reload();p.wait_for_function("()=>document.querySelector('[data-msg]')&&!document.querySelector('[data-msg]').readOnly&&!document.querySelector('[data-ask]').disabled");before=p.evaluate("async()=>await(await import('./js/db.js')).dumpAll()");y=ids['yesterday'];header=y[8:10]+'/'+y[5:7]+'/'+y[:4]
 text='['+header+' 19:00] Salih: Koru Parsel 2 saat çalıştı\n3 saat çalıştı'
 reply={'works':[{'date':ids['today'],'customer_id':'TEST_C','site_id':'TEST_S','vehicle_id':'TEST_V','work_type':'JCB Çalışması','quantity':n,'unit':'Saat','quote':q}for n,q in [(2,'Koru Parsel 2 saat çalıştı'),(3,'3 saat çalıştı')]],'fuel':[]}
 def send():
  p.fill('[data-msg]',text);p.click('[data-ask]')
  try:p.wait_for_function("()=>!document.querySelector('[data-ask]').disabled&&document.querySelectorAll('[data-kind=work]').length===2")
  except Exception:
   print(json.dumps({'errors':errors,'calls':len(calls),'body':p.locator('[data-out]').inner_text()},ensure_ascii=False),flush=True);p.screenshot(path='/tmp/context111-failure.png');raise
 send();box=p.locator('[data-review-questions]');dates=box.locator('[data-question]').filter(has=p.locator('input[type=date]'));assert dates.count()==1,'One phone source date must be confirmed once for both cards'
 assert '2 kart' in dates.inner_text();cards=p.locator('[data-kind=work]');assert not cards.nth(0).locator('[data-pick]').is_checked() and not cards.nth(1).locator('[data-pick]').is_checked()
 for i in range(2):cards.nth(i).locator('[data-record-details]').evaluate('(e)=>e.open=true')
 cards.nth(1).locator('[name=date]').fill(ids['today']);cards.nth(1).locator('[name=date]').dispatch_event('change');cards.nth(1).locator('[name=description]').fill('TEST elle korunan açıklama');assert 'Elle düzenlendi' in cards.nth(1).inner_text()
 dates=box.locator('[data-question]').filter(has=p.locator('input[type=date]'));assert dates.count()==1 and '1 kart' in dates.inner_text();dates.locator('input').fill(y);dates.get_by_role('button',name='Uygula',exact=True).click()
 assert cards.nth(0).locator('[name=date]').input_value()==y and cards.nth(1).locator('[name=date]').input_value()==ids['today'];assert cards.nth(1).locator('[name=description]').input_value()=='TEST elle korunan açıklama';assert '1 kartta yalnız Tarih' in p.locator('[data-question-applied]').inner_text()
 send();box=p.locator('[data-review-questions]');dates=box.locator('[data-question]').filter(has=p.locator('input[type=date]'));dates.locator('input').fill(y);dates.get_by_role('button',name='Uygula',exact=True).click();assert '2 kartta yalnız Tarih' in p.locator('[data-question-applied]').inner_text()
 assert all(p.locator('[data-kind=work]').nth(i).locator('[name=date]').input_value()==y for i in range(2));assert all(not p.locator('[data-kind=work]').nth(i).locator('[data-pick]').is_checked() for i in range(2))
 assert p.evaluate("async()=>await(await import('./js/db.js')).dumpAll()")==before;assert len(calls)==2 and not errors,(len(calls),errors);assert all('telefon_satir_baglami' in call for call in calls)
 for width in [320,360,390,768]:p.set_viewport_size({'width':width,'height':850});assert p.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
 print(json.dumps({'sharedSourceDateQuestion':True,'manualFieldPreserved':True,'onlyExplicitTargetsUpdated':True,'dateConflictInitiallyUnchecked':True,'noBusinessWrites':True,'cannedModelCalls':len(calls),'pageErrors':errors}),flush=True);b.close()
