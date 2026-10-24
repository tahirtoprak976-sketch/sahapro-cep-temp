"""Native model tools, real IndexedDB/SW/UI; deterministic model, synthetic business data only."""
import json,sys
from playwright.sync_api import sync_playwright
U=sys.argv[1] if len(sys.argv)>1 else 'http://localhost:8841/'
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 c=b.new_context(viewport={'width':360,'height':850});c.add_init_script("localStorage.setItem('sp_role','boss')")
 pg=c.new_page();errors=[];bodies=[];mode='initial';step=0;held=[];hold=False
 pg.on('pageerror',lambda e:errors.append(str(e)))
 quote="TEST Kaya'nın forkliftine 20 litre mazot verilmişti"
 details='Litresi 50 TL, teslim tarihi 21.10.2026'
 ids={}
 def call(name,args):return {'functionCall':{'name':name,'args':args,'id':'CALL-'+name},'thoughtSignature':'TEST-signature'}
 def mock(r):
  global step
  body=json.loads(r.request.post_data);bodies.append(body)
  if hold:held.append(r);return
  parts=body['contents'][0]['parts'];ctx=next((json.loads(x['text'].split('\n',1)[1]) for x in parts if x.get('text','').startswith('açık_görev')),None)
  if mode=='initial':
   seq=[call('find_records',{'store':'customers','query':'TEST Kaya'}),call('tank_status',{}),call('ask_user',{'goal':'Kaya forkliftine verilen mazotu depodan düşüp müşteriye borç yaz','question':'Teslim tarihi ve litre fiyatı nedir?','proposed_plan_json':json.dumps({'customer_fuel':[{'customer_id':ids['customer'],'liters':20,'machine':'Forklift','source':'Depo Tankı','quote':quote}]})})]
   response=seq[step];step+=1
  elif mode=='resume':
   assert ctx and ctx['status'] in ['draft','clarify'] and ctx['plan']['customer_fuel'][0]['liters']==20,ctx
   response=call('revise_draft',{'task_id':ctx['id'],'changes_json':json.dumps([{'group':'customer_fuel','index':0,'fields':{'unit_price':50,'date':'2026-10-21','details_quote':details}}]),'questions_json':'[]'})
  elif mode=='answer':
   assert ctx and ctx['status']=='complete' and 'plan' not in ctx and 'source' not in ctx,ctx
   response=call('customer_balance',{'customer':'TEST Kaya'}) if step==0 else call('prepare_plan',{'goal':'Kaya hesabını kontrol et','plan_json':json.dumps({'answer':'Müşteri hesabını kayıtlar üzerinden kontrol ettim; teslimat borcu 1000 TL.'})});step+=1
  elif mode=='loop':response=call('find_records',{'store':'customers','query':'TEST Kaya'})
  elif mode=='private':
   assert ctx is None and not any(x.get('text','').startswith('sohbet_baglami') for x in parts)
   response=call('prepare_plan',{'goal':'Bağlamsız yanıt','plan_json':'{"answer":"Yeni isteğinizi yazın."}'})
  elif mode=='multi':
   response=call('prepare_plan',{'goal':'İki çalışma ve bir tahsilat hazırla','plan_json':json.dumps({'works':[{'date':ids['date'],'customer_id':ids['customer'],'vehicle_id':ids['vehicle'],'work_type':'Makine Çalışması','unit':'Saat','quantity':1},{'date':ids['date'],'customer_id':ids['other'],'vehicle_id':ids['vehicle'],'work_type':'Makine Çalışması','unit':'Saat','quantity':2}],'collections':[{'date':ids['date'],'customer_id':ids['other'],'amount':5000,'method':'Nakit'}]})})
  elif mode=='patch':
   assert ctx and ctx['plan']['works'][0]['quantity']==1
   response=call('revise_draft',{'task_id':ctx['id'],'changes_json':'[{"group":"works","index":1,"fields":{"quantity":4}}]'})
  else:raise AssertionError(mode)
  r.fulfill(status=200,content_type='application/json',body=json.dumps({'candidates':[{'content':{'role':'model','parts':[response]},'finishReason':'STOP'}]}))
 c.route('https://generativelanguage.googleapis.com/**',mock)
 pg.goto(U+'index.html#/musteriler');pg.wait_for_selector('[data-customer-directory]');pg.evaluate('async()=>await navigator.serviceWorker.ready')
 if not pg.evaluate('!!navigator.serviceWorker.controller'):pg.reload();pg.wait_for_selector('[data-customer-directory]')
 ids=pg.evaluate("""async()=>{const db=await import('./js/db.js'),C=await import('./js/core.js');const a=await db.saveNew('customers',{name:'TEST Kaya'},'TEST'),z=await db.saveNew('customers',{name:'TEST Demir'},'TEST'),v=await db.saveNew('vehicles',{name:'TEST Manitou',plate:'34ZZ9999'},'TEST');await db.saveNew('fuel_tank_movements',{date:'2026-10-20',move_type:'GİRİŞ',liters:100,total:3000},'TEST');for(const [k,v]of Object.entries({gemini_key:'TEST',gemini_model:'gemini-2.5-flash',gemini_consent:true,gemini_daily_limit:150}))await db.metaSet(k,v);return {customer:a.id,other:z.id,vehicle:v.id,date:C.todayStr()}}""")
 def ready(tab=pg):tab.wait_for_function("()=>document.querySelector('[data-new-chat]')&&!document.querySelector('[data-new-chat]').disabled")
 def send(text,tab=pg):
  tab.fill('[data-msg]',text);tab.click('[data-ask]');tab.wait_for_function("()=>!document.querySelector('[data-ask]').disabled")
 def state():return pg.evaluate("async()=>await (await import('./js/db.js')).dumpAll()")
 def task():return pg.evaluate("async()=>await (await import('./js/db.js')).metaGet('assistant_task_v1')")
 pg.goto(U+'index.html#/akilli-asistan');ready();before=state()
 send('Önce depoyu kontrol et; '+quote)
 assert len(bodies)==3 and task()['status']=='clarify' and state()==before
 assert pg.input_value('[data-kind=fuelout] [name=liters]')=='20' and pg.input_value('[data-kind=fuelout] [name=unit_price]')==''
 assert pg.locator('[data-agent-checks]').count()==1
 assert bodies[1]['contents'][1]['parts'][0]['thoughtSignature']=='TEST-signature'
 print('PASS native search -> actual tank calculation -> specific price/date question; 20L retained; zero business writes',flush=True)
 original=task()['id'];pg.reload();ready();assert pg.locator('[data-task-resume]').count()==1 and not pg.locator('[data-kind=fuelout]').count()
 pg.uncheck('[data-chat-context]');n=len(bodies);pg.click('[data-task-resume]');assert len(bodies)==n and state()==before
 pg.check('[data-chat-context]')
 mode='resume';send(details)
 assert task()['id']==original and task()['status']=='draft' and pg.input_value('[data-kind=fuelout] [name=unit_price]')=='50' and pg.input_value('[data-kind=fuelout] [name=date]')=='2026-10-21' and state()==before
 assert '1.000' in pg.locator('[data-fuel-charge]').inner_text()
 # A second real tab resumes the same task, changing its revision. Its old sibling cannot save.
 pg2=c.new_page();pg2.on('pageerror',lambda e:errors.append(str(e)));pg2.goto(U+'index.html#/akilli-asistan');ready(pg2);send(details,pg2)
 pg.check('[data-kind=fuelout] [data-pick]');pg.click('[data-save]');pg.get_by_text('Görev başka sekmede',exact=False).last.wait_for()
 assert state()==before and 'başka sekmede' in pg.locator('body').inner_text(),pg.locator('body').inner_text()[-2500:]
 pg2.check('[data-kind=fuelout] [data-pick]');pg2.click('[data-save]');pg2.locator('[data-out]').get_by_text('Kaydedildi:',exact=False).wait_for()
 saved=state();assert task()['status']=='complete'
 moves=[x for x in saved['fuel_tank_movements'] if x.get('delivery_kind')=='customer_fuel'];charges=[x for x in saved['cari_movements'] if x.get('type')=='MazotTeslimi']
 assert len(moves)==len(charges)==1 and moves[0]['liters']==20 and charges[0]['amount']==1000
 assert all(len(saved[k])==len(before[k]) for k in ['work_records','cash_records','fuel_records'])
 print('PASS reload + free-form price/date answer resumes same 20L request; stale sibling Save denied; current approval writes one 20L/1000TL pair only',flush=True)
 pg.reload();ready();mode='answer';step=0
 send('TEST Kaya ile hesabı konuşacağız; hesabındaki durumu güncel kayıtlarla değerlendirip açıklar mısın?')
 assert step==2 and not pg.locator('[data-out] [data-save]').count() and state()==saved and task()['status']=='complete'
 print('PASS unified read/answer path calculates actual customer balance; completed task context contains no replayable plan',flush=True)
 mode='private';pg.uncheck('[data-chat-context]');send('Bir konuyu birlikte değerlendirelim');assert state()==saved
 pg.check('[data-chat-context]');mode='loop';n=len(bodies);send('Kayıtlar üzerinde bu durumu araştırmaya devam et')
 assert len(bodies)-n==6 and 'tamamlayamadı' in pg.locator('[data-out]').inner_text() and state()==saved
 print('PASS history opt-out excludes task + conversation; unending model bounded to six rounds; zero writes',flush=True)
 mode='multi'
 send('Bugün TEST Kaya TEST Manitou ile 1 saat, TEST Demir TEST Manitou ile 2 saat çalıştı ve TEST Demir 5000 TL nakit ödedi.')
 assert pg.locator('[data-kind=work]').count()==2 and pg.input_value('[data-kind=collection] [name=amount]')=='5000'
 mode='patch';send('İkinci çalışmayı gözden geçirdim, süresi 4 saat; sadece onu düzeltmeni istiyorum.')
 assert pg.input_value('[data-kind=work][data-i="0"] [name=quantity]')=='1' and pg.input_value('[data-kind=work][data-i="1"] [name=quantity]')=='4' and pg.input_value('[data-kind=collection] [name=amount]')=='5000' and state()==saved
 print('PASS native targeted revision preserves untouched first job and separate cash amount',flush=True)
 # A failed durable write lock must stop before the first business write. Then selected subset closes to review.
 for box in pg.locator('[data-out] .card[data-kind] [data-pick]').all():box.uncheck()
 pg.check('[data-kind=work][data-i="0"] [data-pick]')
 pg.evaluate("""()=>{const p=IDBObjectStore.prototype,old=p.put;p.put=function(v,...a){if(this.name==='meta'&&v.key==='assistant_task_v1'&&v.value.status==='applying'){p.put=old;throw Error('TEST task lock failure')}return old.call(this,v,...a)}}""")
 pg.click('[data-save]');pg.get_by_text('TEST task lock failure',exact=False).last.wait_for()
 assert state()==saved and task()['status']=='draft' and 'TEST task lock failure' in pg.locator('body').inner_text()
 pg.check('[data-kind=work][data-i="0"] [data-pick]');pg.click('[data-save]');pg.locator('[data-out]').get_by_text('Kaydedildi:',exact=False).wait_for()
 partial=state();assert task()['status']=='review' and len(partial['work_records'])==len(saved['work_records'])+1 and len(partial['cash_records'])==len(saved['cash_records'])
 pg.reload();ready();assert not pg.locator('[data-task-resume]').count() and 'kontrol gerektiriyor' in pg.locator('[data-agent-task]').inner_text()
 saved=partial
 print('PASS failed task lock prevents first business write; partial selection posts only selected work and requires review, with no automatic replay',flush=True)
 # Failure to persist a proposal must not expose a Save button or change business data.
 pg.evaluate("""()=>{const p=IDBObjectStore.prototype,old=p.put;p.put=function(v,...a){if(this.name==='meta'&&v.key==='assistant_task_v1'){p.put=old;throw Error('TEST task storage failure')}return old.call(this,v,...a)}}""")
 mode='multi';send('Bugün TEST Kaya TEST Manitou ile 1 saat, TEST Demir TEST Manitou ile 2 saat çalıştı ve TEST Demir 5000 TL nakit ödedi.')
 assert not pg.locator('[data-out] [data-save]').count() and 'TEST task storage failure' in pg.locator('[data-out]').inner_text() and state()==saved
 print('PASS proposal-storage failure exposes no actionable cards and leaves all business records intact',flush=True)
 # New Chat in the sibling invalidates a held native response and clears the durable task atomically.
 hold=True;pg.fill('[data-msg]','İki çalışma için yeni bir değerlendirme yap');pg.click('[data-ask]')
 for _ in range(100):
  if held:break
  pg.wait_for_timeout(25)
 assert held
 pg2.reload();ready(pg2);pg2.click('[data-new-chat]');pg2.click('.sheet [data-x="1"]');pg2.wait_for_function("()=>!document.querySelector('[data-chat-turn]')")
 hold=False;held.pop().fulfill(status=200,content_type='application/json',body=json.dumps({'candidates':[{'content':{'parts':[call('ask_user',{'goal':'Eski görev','question':'Tarih?'})]},'finishReason':'STOP'}]}))
 pg.wait_for_function("()=>!document.querySelector('[data-ask]').disabled")
 assert task() is None and not pg.locator('[data-out] [data-save]').count() and state()==saved
 for width in [320,360,768]:pg.set_viewport_size({'width':width,'height':850});assert pg.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
 assert not errors,errors
 print('PASS second-tab New Chat clears task and rejects held old response; responsive UI, zero uncaught browser errors',flush=True)
 c.close();b.close()
