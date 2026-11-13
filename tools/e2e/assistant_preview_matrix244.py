"""Synthetic work/fuel batches, expanded fields and failed-refinement manual protection."""
import json,sys,time,uuid
from playwright.sync_api import sync_playwright
U=sys.argv[1]if len(sys.argv)>1 else'http://localhost:8895/'
def run(w,expanded=False,with_price=False):
 b=w.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);c=b.new_context(viewport={'width':360,'height':850},service_workers='block');c.add_init_script("localStorage.setItem('sp_role','boss');localStorage.setItem('sp_assistant_details_v1','"+('expanded'if expanded else'compact')+"')")
 p=c.new_page();errors=[];pending=[];p.on('pageerror',lambda e:errors.append(str(e)));c.route('https://generativelanguage.googleapis.com/**',lambda r:pending.append(r));p.goto(U+'index.html?db=TEST_matrix_'+uuid.uuid4().hex[:12]+'#/akilli-asistan');p.wait_for_function("()=>document.querySelector('[data-ask]')&&!document.querySelector('[data-ask]').disabled")
 today=p.evaluate("""async()=>{const db=await import('./js/db.js'),C=await import('./js/core.js');for(const[k,rows]of Object.entries({customers:[{id:'TEST_C1',name:'Akasya Yapı'},{id:'TEST_C2',name:'Koru Yapı'}],personnel:[{id:'TEST_P',name:'Salih',vehicle_id:'TEST_V'}],vehicles:[{id:'TEST_V',name:'Kazıcı 8',type:'JCB',assignee_id:'TEST_P'}]}))for(const row of rows)await db.put(k,row);for(const[k,v]of Object.entries({gemini_key:'TEST_FAKE',gemini_model:'gemini-test-flash',gemini_consent:true,gemini_daily_limit:8}))await db.metaSet(k,v);return C.todayStr();}""")
 if with_price:p.evaluate("async()=>{const db=await import('./js/db.js');await db.put('price_book',{id:'TEST_RATE',customer_id:null,vehicle_id:'TEST_V',work_type:'JCB Çalışması',unit:'Saat',price:1500,vat_rate:20,vat_included:false});}")
 p.reload();p.wait_for_function("()=>document.querySelector('[data-ask]')&&!document.querySelector('[data-ask]').disabled");before=p.evaluate("async()=>await(await import('./js/db.js')).dumpAll()")
 header='['+today[8:10]+'/'+today[5:7]+'/'+today[:4]
 text='\n'.join([header+' 19:00] Salih: Akasya Yapı Kazıcı 8 2 saat çalıştı',header+' 19:10] Salih: Koru Yapı Kazıcı 8 3 saat çalıştı',header+' 19:20] Salih: Kazıcı 8 depodan 20 litre mazot aldı'])
 reply=p.evaluate("""async({text,today})=>{const d=await(await import('./js/db.js')).dumpAll(),v=(await import('./js/offline-whatsapp.js')).offlinePlan(text,{d,today});const take=(row,keys)=>Object.fromEntries(keys.map(k=>[k,row[k]??null]));return {works:v.works.map(r=>({...take(r,['date','customer_id','vehicle_id','work_type','quantity','unit','personnel_id']),quote:r.source_quote||r.quote})),fuel:v.fuel.map(r=>({...take(r,['date','vehicle_id','liters','source','customer_id','personnel_id']),quote:r.source_quote||r.quote}))};}""",{'text':text,'today':today})
 assert len(reply['works'])==2 and len(reply['fuel'])==1,reply
 p.fill('[data-msg]',text);p.click('[data-ask]');p.wait_for_function("()=>document.querySelectorAll('[data-stage-kind=work]').length===2&&document.querySelectorAll('[data-stage-kind=fuel]').length===1")
 p.evaluate("async()=>{document.querySelector('[data-out]').scrollIntoView({block:'start'});await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));document.querySelector('[data-stage-kind=work] [name=quantity]').scrollIntoView({block:'center'});await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));window.__fields=[...document.querySelectorAll('[data-stage-kind]')].flatMap(c=>[...c.querySelectorAll('input[name],select[name],textarea[name]')].map(field=>({kind:c.dataset.stageKind,index:c.dataset.i,name:field.name,field})));window.__fields.forEach(r=>{r.before=r.field.getBoundingClientRect().toJSON();r.cardBefore=r.field.closest('.card').getBoundingClientRect().toJSON();});window.__shifts=[];window.__obs=new PerformanceObserver(l=>window.__shifts.push(...l.getEntries().map(e=>({value:e.value,sources:e.sources.map(s=>({tag:s.node?.tagName,classes:s.node?.className,attrs:s.node?[...s.node.attributes].filter(a=>a.name.startsWith('data-')).map(a=>a.name):[],before:s.previousRect.toJSON(),after:s.currentRect.toJSON()}))}))));window.__obs.observe({type:'layout-shift',buffered:false});}")
 assert p.locator('[data-out] [data-save]').count()==0
 assert p.locator('[data-stage-kind] input:enabled,[data-stage-kind] select:enabled,[data-stage-kind] textarea:enabled').count()==0
 deadline=time.monotonic()+10
 while not pending and time.monotonic()<deadline:p.wait_for_timeout(20)
 assert len(pending)==1
 p.wait_for_timeout(550);pending[0].fulfill(status=200,content_type='application/json',body=json.dumps({'candidates':[{'content':{'parts':[{'text':json.dumps(reply)}]},'finishReason':'STOP'}]}));p.wait_for_function("()=>!document.querySelector('[data-ask]').disabled&&document.querySelectorAll('[data-kind=work]').length===2&&document.querySelector('[data-kind=fuel]')")
 p.evaluate("async()=>{await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));}")
 result=p.evaluate("()=>{window.__obs.disconnect();return {cls:window.__shifts.reduce((a,b)=>a+b.value,0),shifts:window.__shifts,fields:window.__fields.map(r=>{const field=document.querySelector('[data-kind=\"'+r.kind+'\"][data-i=\"'+r.index+'\"] '+'[name=\"'+r.name+'\"]');return {kind:r.kind,name:r.name,same:field===r.field,value:field.value,cardBefore:r.cardBefore,cardAfter:field.closest('.card').getBoundingClientRect().toJSON(),before:r.before,after:field.getBoundingClientRect().toJSON()};})};}")
 assert all(f['same']for f in result['fields']),result
 assert result['cls']==0,result
 if expanded:
  assert all(abs(f['before']['y']-f['after']['y'])<0.01 for f in result['fields']),result
 first=p.locator('[data-kind=work][data-i="0"]');first.locator('[data-record-details]').evaluate('(e)=>e.open=true');first.locator('[name=quantity]').fill('4');first.locator('[name=unit_price]').fill('1700');p.evaluate("()=>window.__edited=document.querySelector('[data-kind=work][data-i=\"0\"] [name=quantity]')")
 p.fill('[data-msg]','Akasya Yapı için yeni bir notu incele');p.click('[data-ask]');deadline=time.monotonic()+10
 while len(pending)<2 and time.monotonic()<deadline:p.wait_for_timeout(20)
 assert len(pending)==2
 pending[1].fulfill(status=400,content_type='application/json',body=json.dumps({'error':{'message':'TEST controlled failure'}}));p.wait_for_function("()=>!document.querySelector('[data-ask]').disabled")
 assert first.locator('[name=quantity]').input_value()=='4'and first.locator('[name=unit_price]').input_value()=='1700'
 assert p.evaluate("()=>window.__edited===document.querySelector('[data-kind=work][data-i=\"0\"] [name=quantity]')")
 assert p.evaluate("async()=>await(await import('./js/db.js')).dumpAll()")==before
 # A newly discovered money card keeps its ordinary visible approval frame.
 p.reload();p.wait_for_function("()=>document.querySelector('[data-ask]')&&!document.querySelector('[data-ask]').disabled")
 cash_text=header+' 19:30] Salih: Akasya Yapı 20 TL nakit aldık';p.fill('[data-msg]',text+'\n'+cash_text);p.click('[data-ask]');p.wait_for_function("()=>document.querySelectorAll('[data-stage-kind=work]').length===2&&document.querySelector('[data-stage-kind=fuel]')")
 deadline=time.monotonic()+10
 while len(pending)<3 and time.monotonic()<deadline:p.wait_for_timeout(20)
 assert len(pending)==3
 combined={**reply,'collections':[{'date':today,'customer_id':'TEST_C1','amount':20,'method':'Nakit','quote':cash_text}]}
 pending[2].fulfill(status=200,content_type='application/json',body=json.dumps({'candidates':[{'content':{'parts':[{'text':json.dumps(combined)}]},'finishReason':'STOP'}]}));p.wait_for_function("()=>!document.querySelector('[data-ask]').disabled&&document.querySelector('[data-kind=collection]')")
 cash=p.locator('[data-kind=collection]');assert not cash.locator('[data-pick]').is_checked()
 assert cash.locator('[data-sensitive-approval]').count()==1 and cash.locator('[data-preview-notes] [data-sensitive-approval]').count()==0
 assert p.locator('[data-out]').get_attribute('data-preview-expanded')is None
 assert p.evaluate("async()=>await(await import('./js/db.js')).dumpAll()")==before
 assert not errors,errors
 print(json.dumps({'expanded':expanded,'registeredPrice':with_price,'twoWorksOneFuel':True,'sameFieldNodes':True,'cls':result['cls'],'manualValuesSurviveFailedRefinement':True,'sensitiveFallbackKeepsApprovalFrame':True,'businessWrites':0,'modelCalls':len(pending),'pageErrors':errors}),flush=True);b.close()
with sync_playwright()as w:
 for expanded in (False,True):
  for with_price in (False,True):run(w,expanded,with_price)
