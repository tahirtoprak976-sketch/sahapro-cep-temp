"""Actual assistant UI with deterministic mocked Gemini replies. No real AI/messages.
Checks the input sent, correction context, cards, photos and double-submit lock.
"""
import json,sys
from io import BytesIO
from PIL import Image
from playwright.sync_api import sync_playwright
U=sys.argv[1] if len(sys.argv)>1 else 'http://localhost:8841/'
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 c=b.new_context(viewport={'width':360,'height':850},service_workers='allow');c.add_init_script("try{localStorage.setItem('sp_role','boss')}catch(e){}")
 bodies=[];reply={};http_error=False
 def mock(route):
  bodies.append(json.loads(route.request.post_data or '{}'))
  if http_error:route.fulfill(status=400,content_type='application/json',body=json.dumps({'error':{'message':'TEST request failure','status':'INVALID_ARGUMENT'}}));return
  route.fulfill(status=200,content_type='application/json',body=json.dumps({'candidates':[{'content':{'parts':[{'text':json.dumps(reply)}]},'finishReason':'STOP'}]}))
 c.route('https://generativelanguage.googleapis.com/**',mock)
 pg=c.new_page();errors=[];pg.on('pageerror',lambda e:errors.append(str(e)))
 pg.goto(U+'index.html#/musteriler');pg.wait_for_selector('[data-customer-directory]');pg.evaluate('async()=>await navigator.serviceWorker.ready')
 if not pg.evaluate('!!navigator.serviceWorker.controller'):
  pg.reload();pg.wait_for_selector('[data-customer-directory]')
 ids=pg.evaluate("""async()=>{const db=await import('./js/db.js'),C=await import('./js/core.js');for(const [k,v] of Object.entries({gemini_key:'TEST',gemini_model:'gemini-2.5-flash',gemini_consent:true,gemini_daily_limit:50}))await db.metaSet(k,v);const c=await db.saveNew('customers',{name:'TEST Kaya'},'TEST'),d=await db.saveNew('customers',{name:'TEST Leda'},'TEST'),v=await db.saveNew('vehicles',{name:'TEST Makine'},'TEST');return {c:c.id,d:d.id,v:v.id,date:C.todayStr()};}""")
 def snapshot():return pg.evaluate("async()=>{const db=await import('./js/db.js');return {data:await db.dumpAll(),drafts:await db.getAll('drafts')}}")
 def work(customer,quantity):return {'works':[{'date':ids['date'],'customer_id':customer,'vehicle_id':ids['v'],'work_type':'Moloz Nakliye','quantity':quantity,'unit':'Sefer'}]}
 def message_part():return bodies[-1]['contents'][0]['parts'][-1]['text']
 def double():pg.evaluate("()=>{const b=document.querySelector('[data-ask]');b.dispatchEvent(new MouseEvent('click',{bubbles:true}));b.dispatchEvent(new MouseEvent('click',{bubbles:true}))}")
 def send(text,twice=False):
  pg.fill('[data-msg]',text);n=len(bodies)
  if twice:double()
  else:pg.click('[data-ask]')
  assert pg.locator('[data-ask]').is_disabled() and pg.locator('[data-msg]').is_disabled()
  pg.wait_for_function("()=>!document.querySelector('[data-ask]').disabled&&document.querySelector('[data-msg]').value===''")
  assert len(bodies)==n+1,(n,len(bodies))
 before=snapshot();pg.goto(U+'index.html#/akilli-asistan');pg.wait_for_selector('[data-msg]')
 reply=work(ids['c'],2);send('TEST Kaya TEST Makine 2 sefer moloz',twice=True)
 assert pg.locator('[data-out] [data-kind=work]').count()==1 and '[DÜZELTME]' not in message_part()
 assert not pg.locator('[data-refine]').is_checked()
 print('PASS first text yields actual work card; repeated submit events make one mocked request and lock fields until completion',flush=True)
 # A pending result must not absorb a new independent record.
 reply=work(ids['d'],3);pg.fill('[data-msg]','müşteri TEST Leda TEST Makine 3 sefer moloz')
 assert pg.get_attribute('[data-turn-intent]','data-turn-mode')=='new'
 send('müşteri TEST Leda TEST Makine 3 sefer moloz')
 assert '[DÜZELTME]' not in message_part() and 'TEST Kaya TEST Makine 2 sefer' not in message_part()
 assert pg.input_value('[data-kind=work] [name=customer]')==ids['d']
 print('PASS short independent work is sent alone and selects its returned customer instead of inheriting the prior work context',flush=True)
 # Clear corrections preserve the old source and plan, with an explicit visible mode.
 reply=work(ids['d'],2);pg.fill('[data-msg]','2 sefer');assert pg.get_attribute('[data-turn-intent]','data-turn-mode')=='refine' and pg.locator('[data-refine]').is_checked()
 send('2 sefer');assert '[DÜZELTME] 2 sefer' in message_part() and 'TEST Leda TEST Makine 3 sefer' in message_part()
 assert any('ÖNCEKİ TASLAK' in x.get('text','') for x in bodies[-1]['contents'][0]['parts'])
 reply=work(ids['c'],2);send('müşteri TEST Kaya olacak');assert '[DÜZELTME] müşteri TEST Kaya olacak' in message_part()
 assert pg.input_value('[data-kind=work] [name=customer]')==ids['c']
 for width in [320,360,768]:
  pg.set_viewport_size({'width':width,'height':850});assert pg.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),width
 pg.set_viewport_size({'width':360,'height':850})
 print('PASS bare quantity and customer corrections preserve the previous source/plan, update the actual card, and fit narrow screens',flush=True)
 # An explicit user choice wins for otherwise ambiguous free text.
 pg.fill('[data-msg]','2 sefer');pg.uncheck('[data-refine]');assert pg.get_attribute('[data-turn-intent]','data-turn-mode')=='new'
 send('2 sefer');assert '[DÜZELTME]' not in message_part()
 pg.fill('[data-msg]','sonuncusu böyle olsun');pg.check('[data-refine]');send('sonuncusu böyle olsun');assert '[DÜZELTME] sonuncusu böyle olsun' in message_part()
 # Reset the manual override for a fresh independent request; result restores automatic mode.
 pg.fill('[data-msg]','TEST Kaya TEST Makine 2 sefer moloz');pg.uncheck('[data-refine]');send('TEST Kaya TEST Makine 2 sefer moloz')
 n=len(bodies);pg.fill('[data-msg]','Ödemelerim');pg.click('[data-ask]');pg.wait_for_selector('[data-answer]');pg.wait_for_function("()=>!document.querySelector('[data-ask]').disabled")
 assert len(bodies)==n and 'Kayıtlı vadesi geçmiş' in pg.locator('[data-answer]').text_content()
 assert not pg.locator('[data-refine-wrap]').is_visible(),'a new local answer clears the older hidden draft correction target'
 print('PASS manual new/correction choices work; a local payment command after pending work avoids Gemini and clears the stale draft target',flush=True)
 reply=work(ids['c'],2);send('TEST Kaya TEST Makine 2 sefer moloz')
 # A fresh photo without text must work even while a previous result is pending.
 buf=BytesIO();Image.new('RGB',(12,12),'orange').save(buf,format='PNG')
 pg.locator('[data-photos]').set_input_files({'name':'TEST-new-photo.png','mimeType':'image/png','buffer':buf.getvalue()});reply={};send('')
 assert '[DÜZELTME]' not in message_part()
 assert sum(1 for x in bodies[-1]['contents'][0]['parts'] if 'inlineData' in x)==1
 pg.click('[data-clearfiles]')
 n=len(bodies);pg.fill('[data-msg]','Ödemelerim');pg.click('[data-ask]');pg.wait_for_selector('[data-answer]');pg.wait_for_function("()=>!document.querySelector('[data-ask]').disabled")
 assert len(bodies)==n and snapshot()==before
 print('PASS fresh photo-only input is processed after a pending result; an empty model result does not capture the next command; zero business/audit writes',flush=True)
 # Request failure preserves text, releases the lock and permits a corrected retry.
 http_error=True;pg.fill('[data-msg]','TEST Leda TEST Makine 1 sefer moloz');pg.click('[data-ask]');pg.get_by_text('TEST request failure',exact=False).wait_for();pg.wait_for_function("()=>!document.querySelector('[data-ask]').disabled")
 assert pg.input_value('[data-msg]')=='TEST Leda TEST Makine 1 sefer moloz' and pg.locator('[data-msg]').is_enabled()
 http_error=False;reply=work(ids['d'],1);send('TEST Leda TEST Makine 1 sefer moloz');assert snapshot()==before
 c.set_offline(True);pg.reload();pg.wait_for_selector('[data-msg]');pg.fill('[data-msg]','Ödemelerim');pg.click('[data-ask]');pg.wait_for_selector('[data-answer]');c.set_offline(False)
 assert snapshot()==before and not errors,errors
 print('PASS failed request preserves input/unlocks retry; real SW offline local command works and no uncaught browser errors occur',flush=True)
 c.close();b.close()
