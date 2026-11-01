"""Full five-task center must not block sixth/seventh price requests. Real IDB, mock model."""
import argparse,json,uuid
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright
ap=argparse.ArgumentParser();ap.add_argument('url',nargs='?',default='http://localhost:8841/');ap.add_argument('--baseline-proof',action='store_true');ap.add_argument('--artifacts',default='/tmp/solo-assistant94');a=ap.parse_args()
BASE=a.url.rstrip('/')+'/';assert urlparse(BASE).hostname in ('localhost','127.0.0.1')
OUT=Path(a.artifacts);OUT.mkdir(parents=True,exist_ok=True)
with sync_playwright() as w:
 b=w.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);c=b.new_context(viewport={'width':390,'height':850});c.add_init_script("localStorage.setItem('sp_role','boss');localStorage.setItem('sp_assistant_details_v1','expanded')")
 p=c.new_page();errors=[];p.on('pageerror',lambda e:errors.append(str(e)));calls=[];ids={};mode='price'
 def mock(r):
  calls.append(json.loads(r.request.post_data))
  plan={'answer':'TEST istek incelendi.'} if mode=='answer' else {'price_rules':[{'customer_id':ids['customer'],'site_id':ids['site'],'work_type':'Moloz Nakliye','unit':'Sefer','price':7000}]}
  result={'functionCall':{'name':'prepare_plan','args':{'goal':'TEST Tarabya kamyonet sefer fiyatı','plan_json':json.dumps(plan)},'id':'TEST-PREPARE'},'thoughtSignature':'TEST-native'}
  r.fulfill(status=200,content_type='application/json',body=json.dumps({'candidates':[{'content':{'role':'model','parts':[result]},'finishReason':'STOP'}]}))
 def route(r):
  if r.request.url.startswith('https://generativelanguage.googleapis.com/'):mock(r)
  elif urlparse(r.request.url).hostname in ('localhost','127.0.0.1'):r.continue_()
  else:r.abort()
 c.route('**/*',route);app=BASE+'index.html?db=capacity94_'+uuid.uuid4().hex[:16]
 def view():p.goto(app+'#/akilli-asistan');p.reload();p.wait_for_function("()=>document.querySelector('[data-ask]')&&!document.querySelector('[data-ask]').disabled")
 def state():return p.evaluate("async()=>JSON.stringify(await(await import('./js/db.js')).dumpAll())")
 def center():return p.evaluate("async()=>await(await import('./js/db.js')).metaGet('assistant_tasks_v1')")
 def send(text):p.fill('[data-msg]',text);p.click('[data-ask]');p.wait_for_function("()=>!document.querySelector('[data-ask]').disabled")
 view();ids=p.evaluate("""async()=>{const d=await import('./js/db.js'),T=await import('./js/assistant-task.js'),F=await import('./js/assistant-task-files.js');const customer=await d.saveNew('customers',{name:'Ahmet Bey'},'TEST'),site=await d.saveNew('sites',{name:'Tarabya',customer_id:customer.id},'TEST'),vehicle=await d.saveNew('vehicles',{name:'34EC1353',type:'Kamyonet'},'TEST');let previous=null;const tasks=[];const chat=await d.metaGet('assistant_conversation_v1');for(let i=0;i<5;i++){previous=await T.saveTaskProposal(d,{epoch:chat.id,previous,result:{goal:'TEST Bekleyen '+i,plan:{works:[{quantity:i+1}],questions:i%2?['Araç?']:[]}},source:'TEST eski kaynak '+i});tasks.push(previous);}
 await F.saveTaskFiles(d,tasks[0].id,[new File(['TEST original warranty'],'TEST-evidence.txt',{type:'text/plain'})]);
 for(const[k,v]of Object.entries({gemini_key:'TEST',gemini_model:'gemini-2.5-flash',gemini_consent:true,gemini_daily_limit:100}))await d.metaSet(k,v);
 return {customer:customer.id,site:site.id,vehicle:vehicle.id,tasks};}""")
 view();before=state();old=center();phrase='Ahmet Bey Tarabyadan kamyonetle alınan moloz seferlerine 7000 TL yap'
 send(phrase)
 if a.baseline_proof:
  compatibility=p.evaluate("""async()=>{const d=await import('./js/db.js'),C=await import('./js/assistant-task-center.js'),raw=structuredClone(await d.metaGet(C.CENTER_KEY)),extra=structuredClone(raw.items[0]);extra.id='TEST-legacy-extra94';extra.paused=true;raw.items[0].paused=true;raw.items.push(extra);const task={...raw.items[1],status:'complete'},out=C.upsertTaskCenter(raw,task,raw.items[1].chat);return {before:raw.items.map(t=>t.id).sort(),after:out.items.map(t=>t.id).sort()};}""")
  assert compatibility['before']==compatibility['after'],compatibility
  assert 'En fazla 5 açık görev' in p.locator('[data-out]').inner_text() and not p.locator('[data-kind=price]').count()
  send(phrase);assert p.locator('[data-out] .notice').count()==2 and center()==old and state()==before
  p.screenshot(path=str(OUT/'baseline-full-and-duplicate.png'),full_page=True);print('BASELINE PROOF v3.9.93: full task list blocks sixth price preview and repeated failure stacks two notices; business/tasks unchanged',flush=True);c.close();b.close();raise SystemExit(0)
 p.wait_for_selector('[data-kind=price]');assert 'En fazla 5 açık görev' not in p.locator('[data-out]').inner_text() and p.locator('[data-kind=price] [name=price_site]').input_value()==ids['site']
 saved=center();assert len(saved['items'])==6 and len([x for x in saved['items'] if x.get('paused')])==1 and state()==before
 for oldtask in ids['tasks']:
  current=next(t for t in saved['items'] if t['id']==oldtask['id']);assert current['source']==oldtask['source'] and current['plan']==oldtask['plan']
 assert p.locator('[data-task-close]').count()==6
 p.screenshot(path=str(OUT/'sixth-request-price-preview.png'),full_page=True)
 # A read-only answer consumes no further task slot, even with five active requests.
 mode='answer';send('Ahmet Bey işlerini nasıl kontrol edebiliriz?');assert len(center()['items'])==6 and state()==before
 mode='price';send(phrase);assert len(center()['items'])==7 and p.locator('[data-kind=price]').count()==1 and state()==before
 print('PASS sixth/seventh native price proposal succeeds with five active tasks; old sources/plans remain, oldest paused; read-only answer consumes no task',flush=True)
 # Two genuine persistence failures restore the same controls and produce only one current warning.
 p.locator('[data-kind=price] [name=price]').fill('7100');p.locator('[data-kind=price] [name=price]').dispatch_event('change');stable=center()
 p.evaluate("""()=>{const proto=IDBObjectStore.prototype,old=proto.put;window.__capacityPut=old;proto.put=function(v,...args){if(this.name==='meta'&&v.key==='assistant_tasks_v1')throw Error('TEST task quota');return old.call(this,v,...args)}}""")
 for _ in range(2):
  send(phrase);assert p.locator('[data-assistant-request-error]').count()==1 and p.locator('[data-kind=price] [name=price]').input_value()=='7100' and center()==stable and state()==before
 p.evaluate('()=>{IDBObjectStore.prototype.put=window.__capacityPut}')
 print('PASS repeated failed task persistence keeps one warning, edited original form, tasks and all business records; no silent eviction',flush=True)
 # Resume paused evidence without an AI request or a business write.
 paused=next(t for t in center()['items'] if t['id']==ids['tasks'][0]['id']);assert paused.get('paused');n=len(calls)
 p.locator('[data-task-activate="'+paused['id']+'"]').click();p.wait_for_selector('[data-thumbs] .assistant-file-tile');p.wait_for_function("async()=>{const d=await import('./js/db.js');return(await d.metaGet('assistant_task_v1')).id==='"+paused['id']+"'}")
 restored=p.evaluate("""async id=>{const d=await import('./js/db.js'),F=await import('./js/assistant-task-files.js');return {task:await d.metaGet('assistant_task_v1'),files:await Promise.all((await F.loadTaskFiles(d,id)).map(async f=>({name:f.name,text:await f.text()})))};}""",paused['id'])
 assert restored['task']['status']==ids['tasks'][0]['status'] and restored['files']==[{'name':'TEST-evidence.txt','text':'TEST original warranty'}] and len(calls)==n and state()==before
 p.fill('[data-msg]','TEST yazdığım mesaj korunacak');p.locator('[data-msg]').dispatch_event('input')
 # Close another paused task from the list. The active task, selected file and typed message survive reload.
 other=next(t for t in center()['items'] if t.get('paused'));active=restored['task']['id'];old_screen=p.locator('#screen').element_handle();p.locator('[data-task-close="'+other['id']+'"]').click();p.locator('.sheet [data-x="1"]').click();p.wait_for_function("async()=>{const d=await import('./js/db.js');return(await d.metaGet('assistant_tasks_v1')).items.find(t=>t.id==='"+other['id']+"').status==='cancelled'}")
 p.wait_for_function('e=>!e.isConnected',arg=old_screen);p.wait_for_function("()=>document.querySelector('[data-ask]')&&!document.querySelector('[data-ask]').disabled");p.wait_for_selector('[data-thumbs] .assistant-file-tile');assert p.input_value('[data-msg]')=='TEST yazdığım mesaj korunacak' and state()==before
 assert p.evaluate("async()=>(await(await import('./js/db.js')).metaGet('assistant_task_v1')).id")==active
 print('PASS paused task resumes exact status/source/original file; direct close of another task preserves current file/message; no provider/business write',flush=True)
 # Close the active request explicitly; files remain attached to that closed task, not the next request.
 old_screen=p.locator('#screen').element_handle();p.locator('[data-task-close="'+active+'"]').click();p.locator('.sheet [data-x="1"]').click();p.wait_for_function("async()=>{const d=await import('./js/db.js');return(await d.metaGet('assistant_task_v1')).status==='cancelled'}");p.wait_for_function('e=>!e.isConnected',arg=old_screen);p.wait_for_function("()=>document.querySelector('[data-ask]')&&!document.querySelector('[data-ask]').disabled")
 assert p.locator('[data-thumbs] .assistant-file-tile').count()==0 and p.input_value('[data-msg]')=='TEST yazdığım mesaj korunacak'
 assert p.evaluate("async id=>(await(await import('./js/assistant-task-files.js')).loadTaskFiles(await import('./js/db.js'),id))[0].text()",active)=='TEST original warranty'
 assert state()==before and len(calls)==n and not errors,errors
 for width in [320,390,768]:p.set_viewport_size({'width':width,'height':850});assert p.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
 (OUT/'result.json').write_text(json.dumps({'only_synthetic':True,'full_center_unblocked':True,'old_tasks_and_files_preserved':True,'single_error_notice':True,'close_active_and_other':True,'business_unchanged':True,'provider_calls':len(calls),'errors':errors},indent=2))
 print('PASS active close retains owned file, clears next-request attachments, preserves typed text; narrow layout; assistant_capacity browser PASS',flush=True)
 c.close();b.close()
