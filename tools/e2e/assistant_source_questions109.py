"""A shared date reply changes only its work cards; mandatory money card remains unchecked."""
import json,sys,uuid
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright
base=(sys.argv[1]if len(sys.argv)>1 else 'http://localhost:8841/').rstrip('/')+'/';assert urlparse(base).hostname in ('localhost','127.0.0.1')
texts=['TEST Company TEST Machine 2 saat çalışma','TEST Company TEST Machine 3 saat çalışma','TEST Company TEST Machine 4 saat çalışma'];payment='TEST Company 50 TL tahsil ettim, para bende';message='[07/11/2026 18:00] TEST Operator: '+texts[0]+'\n'+texts[1]+'\n[08/11/2026 18:00] TEST Operator: '+texts[2]+'\n[07/11/2026 19:00] TEST Operator: '+payment
plan={'works':[{'date':'2026-11-11','customer_id':'TEST_C','vehicle_id':'TEST_V','quantity':i+2,'unit':'Saat','work_type':'JCB Çalışması','quote':quote}for i,quote in enumerate(texts)],'fuel':[],'collections':[{'date':'2026-11-07','customer_id':'TEST_C','personnel_id':'TEST_P','amount':50,'method':'Nakit','quote':payment}]}
with sync_playwright() as w:
 b=w.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);c=b.new_context(viewport={'width':360,'height':850},service_workers='block');c.add_init_script("localStorage.setItem('sp_role','boss')");p=c.new_page();errors=[];calls=[];p.on('pageerror',lambda e:errors.append(str(e)))
 def route(r):
  if r.request.url.startswith('https://generativelanguage.googleapis.com/'):
   calls.append(1);r.fulfill(status=200,content_type='application/json',body=json.dumps({'candidates':[{'content':{'parts':[{'functionCall':{'name':'prepare_plan','args':{'goal':'TEST grouped date','plan_json':json.dumps(plan)}}}]},'finishReason':'STOP'}]}))
  elif urlparse(r.request.url).hostname in ('localhost','127.0.0.1'):r.continue_()
  else:r.abort()
 c.route('**/*',route);app=base+'index.html?db=TEST_questions109_'+uuid.uuid4().hex;p.goto(app+'#/daha');p.wait_for_selector('#screen[data-view-ready="1"]')
 p.evaluate("""async()=>{const d=await import('./js/db.js');for(const [store,rows]of Object.entries({customers:[{id:'TEST_C',name:'TEST Company'}],vehicles:[{id:'TEST_V',name:'TEST Machine',type:'JCB'}],personnel:[{id:'TEST_P',name:'TEST Operator',vehicle_id:'TEST_V'}]}))for(const row of rows)await d.put(store,row);for(const[k,v]of Object.entries({gemini_key:'TEST',gemini_model:'TEST_MODEL',gemini_consent:true,gemini_daily_limit:10}))await d.metaSet(k,v);}""")
 p.goto(app+'#/akilli-asistan');p.wait_for_selector('#screen[data-view-ready="1"]');before=p.evaluate("async()=>await(await import('./js/db.js')).dumpAll()")
 p.fill('[data-msg]',message);p.click('[data-ask]');p.wait_for_function("()=>!document.querySelector('[data-ask]').disabled",timeout=90000);p.wait_for_selector('[data-review-overview]')
 assert p.locator('[data-kind=work]').count()==3;money=p.locator('[data-kind=collection][data-i="0"]');assert money.count()==1 and not money.locator('[data-pick]').is_checked()
 q=p.locator('[data-question="date:phone:2026-11-07"]');assert q.count()==1,'Same phone-proven date must have one shared question'
 cards=[p.locator('[data-kind=work][data-i="'+str(i)+'"]')for i in range(3)];assert all(not card.locator('[data-pick]').is_checked()for card in cards)
 for card in cards:card.locator('[data-record-details]').evaluate('e=>e.open=true')
 cards[0].locator('[name=description]').fill('TEST preserve my edit');cards[0].locator('[name=description]').blur();third=cards[2].locator('[name=date]').input_value()
 q.locator('input').fill('2026-11-07');q.locator('[data-answer]').click();p.wait_for_selector('[data-question="date:phone:2026-11-07"]',state='detached')
 assert [card.locator('[name=date]').input_value()for card in cards]==['2026-11-07','2026-11-07',third];assert third=='2026-11-08';assert cards[0].locator('[name=description]').input_value()=='TEST preserve my edit'
 assert not cards[2].locator('[data-pick]').is_checked();assert not money.locator('[data-pick]').is_checked();assert money.locator('[name=date]').input_value()=='2026-11-07'
 assert p.evaluate("async()=>await(await import('./js/db.js')).dumpAll()") == before;assert not errors,errors;assert calls
 assert p.evaluate('document.documentElement.scrollWidth<=innerWidth');print(json.dumps({'sharedDateTargets':2,'otherDatePreserved':True,'manualEditPreserved':True,'collectionUnchecked':True,'businessWrites':0,'fakeProviderCalls':len(calls),'pageErrors':errors}),flush=True);b.close()
