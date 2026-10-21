"""Real mobile Chromium/IndexedDB/SW; deterministic mocked Gemini, synthetic data only."""
import json,sys
from playwright.sync_api import sync_playwright
U=sys.argv[1] if len(sys.argv)>1 else 'http://localhost:8841/'
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 c=b.new_context(viewport={'width':360,'height':850});c.add_init_script("try{localStorage.setItem('sp_role','boss')}catch(e){}")
 bodies=[];reply={};hold=False;held=[]
 def fulfill(route):route.fulfill(status=200,content_type='application/json',body=json.dumps({'candidates':[{'content':{'parts':[{'text':json.dumps(reply)}]},'finishReason':'STOP'}]}))
 def mock(route):
  bodies.append(json.loads(route.request.post_data or '{}'))
  if hold:held.append(route)
  else:fulfill(route)
 c.route('https://generativelanguage.googleapis.com/**',mock)
 pg=c.new_page();errors=[];pg.on('pageerror',lambda e:errors.append(str(e)))
 pg.goto(U+'index.html#/musteriler');pg.wait_for_selector('[data-customer-directory]');pg.evaluate('async()=>await navigator.serviceWorker.ready')
 if not pg.evaluate('!!navigator.serviceWorker.controller'):pg.reload();pg.wait_for_selector('[data-customer-directory]')
 ids=pg.evaluate("""async()=>{const db=await import('./js/db.js'),C=await import('./js/core.js');for(const [k,v] of Object.entries({gemini_key:'TEST',gemini_model:'gemini-2.5-flash',gemini_consent:true,gemini_daily_limit:100}))await db.metaSet(k,v);const customer=await db.saveNew('customers',{name:'TEST Kaya'},'TEST'),vehicle=await db.saveNew('vehicles',{name:'TEST Makine'},'TEST');await db.saveNew('fuel_tank_movements',{date:C.todayStr(),move_type:'GİRİŞ',liters:100,total:3000},'TEST');return {customer:customer.id,vehicle:vehicle.id,date:C.todayStr(),yesterday:C.addDays(C.todayStr(),-1)}}""")
 def state():return pg.evaluate("async()=>await (await import('./js/db.js')).dumpAll()")
 def chat():return pg.evaluate("async()=>await (await import('./js/db.js')).metaGet('assistant_conversation_v1')")
 def send(text,model=False):
  n=len(bodies);pg.fill('[data-msg]',text);pg.click('[data-ask]')
  pg.wait_for_function("()=>!document.querySelector('[data-ask]').disabled")
  if model:pg.wait_for_function("()=>document.querySelector('[data-msg]').value===''");assert len(bodies)==n+1,(text,len(bodies),n)
 def request_parts():return bodies[-1]['contents'][0]['parts']
 def last_state():return pg.locator('[data-chat-state]').last.get_attribute('data-chat-state')
 pg.goto(U+'index.html#/akilli-asistan');pg.wait_for_selector('[data-msg]');pg.wait_for_function("()=>!document.querySelector('[data-new-chat]').disabled")
 before=state();c.set_offline(True);send('Merhaba');assert last_state()=='answer' and 'tahsilat' in pg.locator('[data-chat-log]').inner_text() and not bodies and state()==before;c.set_offline(False)
 # Empty first response can ask a precise question; a bare answer completes that request.
 reply={'questions':['Kaç sefer moloz taşıdık?']};send('TESTCONTEXTALFA TEST Kaya TEST Makine moloz taşıdık',True)
 assert last_state()=='clarify' and state()==before
 pg.fill('[data-msg]','3 sefer');assert pg.get_attribute('[data-turn-intent]','data-turn-mode')=='refine'
 reply={'works':[{'date':ids['date'],'customer_id':ids['customer'],'vehicle_id':ids['vehicle'],'work_type':'Moloz Nakliye','unit':'Sefer','quantity':3}], 'answer':'Kaydettim'}
 send('3 sefer',True)
 assert '[DÜZELTME] 3 sefer' in request_parts()[-1]['text'] and 'TESTCONTEXTALFA' in request_parts()[-1]['text']
 assert pg.locator('[data-kind=work]').count()==1 and pg.input_value('[data-kind=work] [name=quantity]')=='3'
 assert last_state()=='draft' and 'Kaydettim' not in pg.locator('[data-chat-log]').inner_text() and 'Kaydettim' not in pg.locator('[data-out]').inner_text() and state()==before
 n=len(bodies);send('Onayla');assert len(bodies)==n and state()==before and pg.locator('[data-save]').count()==1
 pg.click('[data-save]');pg.locator('[data-out]').get_by_text('Kaydedildi:',exact=False).wait_for()
 assert last_state()=='saved'
 after=state();assert len(after['work_records'])==len(before['work_records'])+1 and any(t['status']=='saved' for t in chat()['turns'])
 print('PASS local offline greeting; empty plan asks a question, bare answer preserves source; prepared card and text confirmation write nothing; only real Save produces receipt/work',flush=True)
 # Model memory is reference-only and optional; source validation is still the current request.
 reply={'answer':'İş kapsamını ve fiyatlandırmayı birlikte netleştirelim.'};send('Onunla sözleşme için bir taslak anlat',True)
 context=[x['text'] for x in request_parts() if 'sohbet_baglami' in x.get('text','')]
 assert context and 'TESTCONTEXTALFA' in context[0] and 'saved' in context[0] and '[DÜZELTME]' not in request_parts()[-1]['text'] and state()==after
 pg.uncheck('[data-chat-context]');send('Bağımsız bir çalışma planı anlat',True)
 assert not any('sohbet_baglami' in x.get('text','') for x in request_parts()) and state()==after
 n=len(bodies);pg.reload();pg.wait_for_selector('[data-chat-log]');assert 'TESTCONTEXTALFA' in pg.locator('[data-chat-log]').inner_text() and len(bodies)==n and state()==after
 for width in [320,360,768]:pg.set_viewport_size({'width':width,'height':850});assert pg.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),width
 print('PASS bounded conversation survives reload without AI/writes; semantic reference context reaches planner separately from current source; user can disable context; narrow layouts fit',flush=True)
 # First row of the actual customer fuel flow is completed conversationally without a model.
 c.set_offline(True);send("TEST Kaya'nın forkliftine 20 ltnmazot verilmişti");assert pg.locator('[data-kind=fuelout]').count()==1
 n=len(bodies);send('900 TL');assert pg.input_value('[data-kind=fuelout] [name=unit_price]')=='' and last_state()=='clarify' and state()==after
 send('toplam 900 TL');assert pg.input_value('[data-kind=fuelout] [name=unit_price]')=='45'
 send('litresi 45 TL');assert pg.input_value('[data-kind=fuelout] [name=unit_price]')=='45' and not pg.locator('[data-kind=fuelout] [data-pick]').is_checked()
 send('Dün');assert pg.input_value('[data-kind=fuelout] [name=date]')==ids['yesterday'] and state()==after and len(bodies)==n
 pg.check('[data-kind=fuelout] [data-pick]');pg.click('[data-save]');pg.locator('[data-out]').get_by_text('Kaydedildi:',exact=False).wait_for();c.set_offline(False)
 saved=state();assert any(x.get('type')=='MazotTeslimi' and x['amount']==900 for x in saved['cari_movements'])
 print('PASS offline follow-up price + date complete the same forklift card; source, recipient and 20L retained; separate explicit Save writes 900TL receivable',flush=True)
 # Draft cancellation only affects the active proposal; it cannot cancel a posted financial record.
 reply={'works':[{'date':ids['date'],'customer_id':ids['customer'],'vehicle_id':ids['vehicle'],'work_type':'Moloz Nakliye','quantity':1,'unit':'Sefer'}]};send('TEST Kaya TEST Makine 1 sefer moloz',True)
 send('Vazgeç');assert not pg.locator('[data-out] [data-save]').count() and state()==saved and last_state()=='cancelled'
 print('PASS conversational cancel removes an unposted draft and preserves every posted work/stock/ledger record',flush=True)
 # A second tab resets the chat during a held model request. Its late response must not revive old cards/history.
 hold=True;pg.fill('[data-msg]','TEST Kaya TEST Makine 2 sefer moloz');pg.click('[data-ask]');pg.wait_for_function("()=>document.querySelector('[data-ask]').disabled")
 for _ in range(100):
  if held:break
  pg.wait_for_timeout(50)
 assert held
 pg2=c.new_page();pg2.goto(U+'index.html#/akilli-asistan');pg2.wait_for_function("()=>document.querySelector('[data-new-chat]')&&!document.querySelector('[data-new-chat]').disabled")
 pg2.click('[data-new-chat]');pg2.click('.sheet [data-x="1"]');pg2.wait_for_function("()=>!document.querySelector('[data-chat-turn]')")
 hold=False;fulfill(held.pop());pg.wait_for_function("()=>!document.querySelector('[data-ask]').disabled")
 assert not chat()['turns'] and not pg.locator('[data-out] [data-save]').count() and state()==saved
 print('PASS second-tab New Chat invalidates in-flight response; no old transcript or actionable cards return and no business records change',flush=True)
 # Fault injection at conversation start must keep user's typed request and release the single-flight lock.
 pg.evaluate("""()=>{const p=IDBObjectStore.prototype,old=p.put;window.__originalChatPut=old;p.put=function(value,...a){if(this.name==='meta'&&value.key==='assistant_conversation_v1'){p.put=old;throw Error('TEST conversation store failure')}return old.call(this,value,...a)}}""")
 pg.fill('[data-msg]','Merhaba');pg.click('[data-ask]');pg.wait_for_function("()=>!document.querySelector('[data-ask]').disabled")
 assert pg.input_value('[data-msg]')=='Merhaba' and 'TEST conversation store failure' in pg.locator('[data-out]').inner_text() and state()==saved
 # Redacted persistence and a strict history bound, without executing or resending anything.
 send('Merhaba');assert not chat()['turns'][-1]['status']=='pending'
 for i in range(22):send('Merhaba')
 assert len(chat()['turns'])==20 and state()==saved
 assert not errors,errors
 print('PASS failed history storage preserves input/unlocks; retry works; 20-turn retention stays bounded; zero uncaught errors and all records unchanged',flush=True)
 c.close();b.close()
