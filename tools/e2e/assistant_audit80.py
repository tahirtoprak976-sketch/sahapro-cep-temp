"""Assistant audit: isolated real UI/IDB, deterministic model, no real accounts or external writes."""
import argparse,json,uuid
from io import BytesIO
from pathlib import Path
from urllib.parse import urlparse
from PIL import Image
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser();p.add_argument('url',nargs='?',default='http://localhost:8841/');p.add_argument('--baseline-proof',action='store_true');p.add_argument('--artifacts',default='/tmp/solo-assistant-audit80');a=p.parse_args()
U=a.url.rstrip('/')+'/';origin=urlparse(U);assert origin.hostname in ('localhost','127.0.0.1') and origin.scheme=='http'
out=Path(a.artifacts);out.mkdir(parents=True,exist_ok=True);results={};errors=[];calls=[];reply={};fail=False;hold=False;held=[];native=False;patch=False
def image(color):
 buf=BytesIO();Image.new('RGB',(48,48),color).save(buf,format='PNG');return buf.getvalue()
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);c=b.new_context(viewport={'width':390,'height':850},service_workers='block');c.add_init_script("localStorage.setItem('sp_role','boss')")
 def mock(r):
  calls.append(json.loads(r.request.post_data))
  if hold:held.append(r);return
  if fail:r.fulfill(status=400,content_type='application/json',body=json.dumps({'error':{'message':'TEST controlled provider failure'}}));return
  parts=[{'text':json.dumps(reply)}]
  if native:
   if patch:
    task=next(json.loads(x['text'].split('\n',1)[1]) for x in calls[-1]['contents'][0]['parts'] if x.get('text','').startswith('açık_görev'))
    first=task['plan']['works'][0]
    results['manualEditsInActiveTask']=first.get('unit_price')==1750 and first.get('description')=='TEST kart düzeltmesi'
    fc={'name':'revise_draft','args':{'task_id':task['id'],'changes_json':'[{"group":"works","index":1,"fields":{"quantity":4}}]'}}
   else:fc={'name':'prepare_plan','args':{'goal':'TEST iki iş hazırla','plan_json':json.dumps(reply)}}
   parts=[{'functionCall':fc}]
  r.fulfill(status=200,content_type='application/json',body=json.dumps({'candidates':[{'content':{'parts':parts},'finishReason':'STOP'}]}))
 def network(r):
  x=urlparse(r.request.url)
  if x.hostname=='generativelanguage.googleapis.com':mock(r)
  elif (x.scheme,x.hostname,x.port)==(origin.scheme,origin.hostname,origin.port):r.continue_()
  else:r.abort()
 c.route('**/*',network);pg=c.new_page();pg.on('pageerror',lambda e:errors.append(str(e)))
 app=U+'index.html?db=a80_'+uuid.uuid4().hex[:12];pg.goto(app+'#/');pg.wait_for_selector('[data-operation-desk]')
 ids=pg.evaluate("""async()=>{const db=await import('./js/db.js'),C=await import('./js/core.js');const v=await db.saveNew('vehicles',{name:'TEST Audit JCB'},'TEST'),customer=await db.saveNew('customers',{name:'TEST Audit Kaya'},'TEST');for(const [k,v]of Object.entries({gemini_key:'TEST',gemini_model:'gemini-2.5-flash',gemini_consent:true,gemini_daily_limit:100}))await db.metaSet(k,v);return {v:v.id,c:customer.id,date:C.todayStr()}}""")
 def ready():pg.wait_for_function("()=>document.querySelector('[data-new-chat]')&&!document.querySelector('[data-new-chat]').disabled")
 def state():return pg.evaluate("async()=>await(await import('./js/db.js')).dumpAll()")
 def send(text):
  pg.fill('[data-msg]',text);pg.click('[data-ask]');pg.wait_for_function("()=>!document.querySelector('[data-ask]').disabled")
 def open_assistant():pg.goto(app+'#/akilli-asistan');ready()
 def work():return {'works':[{'date':ids['date'],'customer_id':ids['c'],'vehicle_id':ids['v'],'work_type':'Makine Çalışması','unit':'Saat','quantity':2}]}
 open_assistant();before=state();reply=work();send('TEST Audit Kaya TEST Audit JCB 2 saat çalıştı')
 pg.fill('[data-kind=work] [name=description]','TEST kullanıcı açıklaması korunmalı')
 fail=True;send('Lütfen bu işi ve açıklamayı ayrıntılı değerlendir');fail=False
 results['failedReadKeepsDraft']=pg.locator('[data-kind=work]').count()==1 and pg.input_value('[data-kind=work] [name=description]')=='TEST kullanıcı açıklaması korunmalı'
 results['failedReadNoWrites']=state()==before
 assert results['failedReadKeepsDraft'] is (not a.baseline_proof),results
 assert results['failedReadNoWrites']
 # No-context switch must apply to local completions as well as provider context.
 send('Yeni iş kaydı oluştur');pg.uncheck('[data-chat-context]');reply={'answer':'Yeni isteğinizi açıkça belirtin.'};n=len(calls);send('tarih 07.09.2026')
 results['contextOffDoesNotPatchOldDraft']=len(calls)==n+1 and not pg.locator('[data-kind=work]').count()
 assert results['contextOffDoesNotPatchOldDraft'] is (not a.baseline_proof),results
 pg.check('[data-chat-context]');send('Yeni müşteri oluştur');pg.uncheck('[data-chat-context]');n=len(calls);send('TEST Yeni Bağımsız İsim')
 results['contextOffDoesNotConsumePreviousName']=len(calls)==n+1 and not pg.locator('[data-customer-create]').count()
 assert results['contextOffDoesNotConsumePreviousName'] is (not a.baseline_proof),results
 pg.check('[data-chat-context]');reply=work();send('TEST Audit Kaya TEST Audit JCB 2 saat çalıştı')
 results['cancelAvailable']=pg.locator('[data-stop-reading]').count()==1
 assert results['cancelAvailable'] is (not a.baseline_proof)
 if not a.baseline_proof:
  hold=True;n=len(calls);text='TEST uzun istek ayrıntılarını tekrar incele';pg.fill('[data-msg]',text);pg.click('[data-ask]');pg.wait_for_function("()=>!document.querySelector('[data-read-status]').hidden&&!document.querySelector('[data-stop-reading]').disabled")
  pg.wait_for_timeout(100);pg.click('[data-stop-reading]');pg.wait_for_function("()=>!document.querySelector('[data-ask]').disabled")
  results['cancelRestoresDraftAndMessage']=pg.locator('[data-kind=work]').count()==1 and pg.input_value('[data-msg]')==text and state()==before
  assert results['cancelRestoresDraftAndMessage'];hold=False
  for route in held:
   try:route.abort()
   except Exception:pass
  held.clear()
 # Typed field edits must be in the durable native task before a later model patch.
 native=True;reply=work();second=dict(reply['works'][0]);reply['works'][0]['quantity']=1;second['quantity']=2;reply['works'].append(second)
 send('TEST Audit Kaya TEST Audit JCB önce 1 saat sonra 2 saat çalıştı')
 pg.fill('[data-kind=work][data-i="0"] [name=unit_price]','1750');pg.fill('[data-kind=work][data-i="0"] [name=description]','TEST kart düzeltmesi')
 patch=True;send('Lütfen diğer işin bilgilerini tekrar değerlendir');patch=False;native=False
 results['manualEditsSurviveModelPatch']=pg.input_value('[data-kind=work][data-i="0"] [name=unit_price]')=='1750' and pg.input_value('[data-kind=work][data-i="0"] [name=description]')=='TEST kart düzeltmesi' and pg.input_value('[data-kind=work][data-i="1"] [name=quantity]')=='4'
 assert results['manualEditsInActiveTask'] is (not a.baseline_proof),results
 assert results['manualEditsSurviveModelPatch'] is (not a.baseline_proof),results
 assert state()==before
 # An approved old action must not overwrite a newer edit made through another screen.
 reply={'actions':[{'op':'update','store':'customers','id':ids['c'],'fields':{'phone':'05329999999'}}]}
 send('TEST Audit Kaya telefonu 05329999999 olarak güncelle');results['cardMutationReachesPlanner']=pg.locator('[data-kind=action]').count()==1
 assert results['cardMutationReachesPlanner'] is (not a.baseline_proof),results
 if a.baseline_proof:send('TEST Audit Kaya telefonu 05329999999 olsun')
 pg.check('[data-kind=action] [data-pick]')
 pg.evaluate("async id=>{const db=await import('./js/db.js'),row=await db.get('customers',id);await db.saveExisting('customers',row,{phone:'05328888888'},'TEST other screen')}",ids['c'])
 edited=state();pg.click('[data-save]')
 if a.baseline_proof:pg.locator('[data-out]').get_by_text('Kaydedildi:',exact=False).wait_for()
 else:pg.locator('.toast').get_by_text('önizlemeden sonra değişti',exact=False).wait_for()
 pg.wait_for_function("()=>!document.querySelector('[data-ask]').disabled")
 results['staleActionCannotOverwrite']=state()==edited
 assert results['staleActionCannotOverwrite'] is (not a.baseline_proof),results
 # Read two different photos; attach only photo1 to maintenance, photo0 to expense.
 open_assistant();red=image('red');blue=image('blue')
 pg.set_input_files('[data-photos]',[{'name':'TEST-expense.png','mimeType':'image/png','buffer':red},{'name':'TEST-maintenance.png','mimeType':'image/png','buffer':blue}]);pg.wait_for_function("()=>document.querySelectorAll('[data-thumbs] img').length===2")
 reply={'photo_texts':['LASTİK TOPLAM 500 TL','TEST JCB TAMİR TOPLAM 900 TL'],'expenses':[{'date':ids['date'],'amount':500,'category':'Lastik','photo':0}],'maintenance':[{'date':ids['date'],'vehicle_id':ids['v'],'description':'TEST JCB tamir','cost':900,'photo':1}]}
 send('TEST Audit JCB lastik ve tamir belgelerini kontrol et');pg.check('[data-kind=expense] [data-pick]');pg.check('[data-kind=maintenance] [data-pick]');pg.click('[data-save]');pg.locator('[data-out]').get_by_text('Kaydedildi:',exact=False).wait_for()
 attachments=pg.evaluate("""async()=>{const db=await import('./js/db.js'),d=await db.dumpAll();const m=d.maintenance_records.find(x=>x.description==='TEST JCB tamir'),e=d.expense_records.find(x=>x.amount===500);const read=async(type,id)=>Promise.all((await db.attachmentsFor(type,id)).map(async x=>({bytes:Array.from(new Uint8Array(await x.blob.arrayBuffer()))})));return {maintenance:await read('maintenance',m.id),expense:await read('expense',e.id)}}""")
 results['maintenanceOwnPhotoOnly']=len(attachments['maintenance'])==1 and attachments['maintenance'][0]['bytes']==list(blue)
 results['expenseOwnPhotoOnly']=len(attachments['expense'])==1 and attachments['expense'][0]['bytes']==list(red)
 assert results['maintenanceOwnPhotoOnly'] is (not a.baseline_proof),results
 assert results['expenseOwnPhotoOnly']
 if not a.baseline_proof:
  for width in [320,390,768]:
   pg.set_viewport_size({'width':width,'height':850});assert pg.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),width
  pg.set_viewport_size({'width':390,'height':850});open_assistant();pg.screenshot(path=str(out/'assistant-390.png'),full_page=True)
 assert not errors,errors
 (out/'result.json').write_text(json.dumps({'baseline':a.baseline_proof,'results':results,'pageErrors':errors,'model':'deterministic TEST only'},ensure_ascii=False,indent=2))
 print(('BASELINE BUGS CONFIRMED' if a.baseline_proof else 'PASS assistant audit80')+' '+json.dumps(results),flush=True)
 c.close();b.close()
