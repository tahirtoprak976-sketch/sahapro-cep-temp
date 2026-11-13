"""Hybrid model boundary: synthetic data/canned response, no actual provider or business writes."""
import json,sys,uuid
from playwright.sync_api import sync_playwright
U=sys.argv[1]if len(sys.argv)>1 else'http://localhost:8891/'
with sync_playwright()as w:
 b=w.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);c=b.new_context(viewport={'width':360,'height':850},service_workers='block');c.add_init_script("localStorage.setItem('sp_role','boss')");p=c.new_page();errors=[];calls=[];pending=[];p.on('pageerror',lambda e:errors.append(str(e)))
 def model(r):
  calls.append(r.request.post_data);pending.append(r)
 c.route('https://generativelanguage.googleapis.com/**',model);p.goto(U+'index.html?db=TEST_hybrid311_'+uuid.uuid4().hex+'#/akilli-asistan');p.wait_for_function("()=>document.querySelector('[data-msg]')&&!document.querySelector('[data-msg]').readOnly")
 today=p.evaluate("""async()=>{const d=await import('./js/db.js'),C=await import('./js/core.js');for(const[store,rows]of Object.entries({customers:[{id:'TEST_C',name:'Akasya Yapı'},{id:'TEST_PRIVATE',name:'PRIVATE_SENTINEL_CUSTOMER'}],personnel:[{id:'TEST_P',name:'Salih',vehicle_id:'TEST_V'}],vehicles:[{id:'TEST_V',name:'Kazıcı 8',type:'JCB',assignee_id:'TEST_P'},{id:'TEST_PRIVATE_V',name:'PRIVATE_SENTINEL_VEHICLE'}],work_records:[{id:'TEST_OLD',customer_id:'TEST_PRIVATE',description:'PRIVATE_SENTINEL_HISTORY',date:C.todayStr(),quantity:1,unit:'Saat'}]}))for(const row of rows)await d.put(store,row);for(const[k,v]of Object.entries({gemini_key:'TEST_FAKE',gemini_model:'gemini-test-flash',gemini_model_list:['gemini-test-pro'],gemini_consent:true,gemini_daily_limit:10}))await d.metaSet(k,v);return C.todayStr();}""")
 p.reload();p.wait_for_function("()=>document.querySelector('[data-msg]')&&!document.querySelector('[data-msg]').readOnly&&!document.querySelector('[data-ask]').disabled");before=p.evaluate("async()=>await(await import('./js/db.js')).dumpAll()");text='['+today[8:10]+'/'+today[5:7]+'/'+today[:4]+' 19:00] Salih: Akasya Yapı Kazıcı 8 2 saat çalıştı'
 p.fill('[data-msg]',text);p.evaluate("()=>{window.__previewTiming={};document.querySelector('[data-ask]').addEventListener('click',()=>window.__previewTiming.sent=performance.now(),{once:true,capture:true});const obs=new MutationObserver(()=>{if(document.querySelector('[data-stage-pending]')){window.__previewTiming.first=performance.now();obs.disconnect();}});obs.observe(document.querySelector('[data-out]'),{childList:true,subtree:true});}");p.click('[data-ask]');p.wait_for_function("()=>document.querySelector('[data-stage-kind=work]')");p.wait_for_function("()=>window.__previewPacketsDone||document.querySelector('[data-stage-kind=work] select[name=work_type]').value")
 p.evaluate("async()=>{document.querySelector('[data-out]').scrollIntoView({block:'start'});await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));}")
 timing=p.evaluate("()=>({firstPreviewMs:window.__previewTiming.first-window.__previewTiming.sent,top:document.querySelector('[data-out]').getBoundingClientRect().top,height:document.querySelector('[data-out]').getBoundingClientRect().height})")
 assert p.locator('[data-stage-pending]').count()==1
 assert p.locator('[data-out] [data-save]').count()==0
 assert p.locator('[data-stage-kind=work] [name=quantity]').input_value()=='2'
 assert p.locator('[data-stage-kind=work] input[name=unit_price]').input_value()==''
 assert p.locator('[data-stage-kind=work] input[name=quantity]').is_disabled()
 p.evaluate("()=>{window.__stageQuantity=document.querySelector('[data-stage-kind=work] [name=quantity]');}")
 assert p.evaluate("async()=>await(await import('./js/db.js')).dumpAll()")==before
 p.wait_for_function('()=>true');assert len(pending)==1
 reply={'works':[{'date':today,'customer_id':'TEST_C','vehicle_id':'TEST_V','work_type':'JCB Çalışması','quantity':2,'unit':'Saat','quote':text}],'fuel':[]}
 pending[0].fulfill(status=200,content_type='application/json',body=json.dumps({'candidates':[{'content':{'parts':[{'text':json.dumps(reply)}]},'finishReason':'STOP'}]}))
 p.wait_for_function("()=>document.querySelector('[data-ask]')&&!document.querySelector('[data-ask]').disabled&&document.querySelector('[data-kind=work]')")
 assert p.evaluate("()=>window.__stageQuantity===document.querySelector('[data-kind=work] [name=quantity]')"),'existing field must survive final validated render'
 p.evaluate("async()=>{await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));}")
 timing['finalGeometry']=p.evaluate("()=>({top:document.querySelector('[data-out]').getBoundingClientRect().top,height:document.querySelector('[data-out]').getBoundingClientRect().height})")
 p.locator('[data-kind=work] [data-record-summary]').click()
 p.locator('[data-kind=work] [name=quantity]').fill('4')
 assert p.locator('[data-kind=work] [name=quantity]').input_value()=='4'
 assert p.evaluate("async()=>await(await import('./js/db.js')).dumpAll()")==before
 # New financial rows must take the complete normal validation/render path.
 p.reload();p.wait_for_function("()=>document.querySelector('[data-ask]')&&!document.querySelector('[data-ask]').disabled")
 text2=text+', 20 bin aldık';p.fill('[data-msg]',text2);p.click('[data-ask]');p.wait_for_function("()=>document.querySelector('[data-stage-kind=work]')")
 p.wait_for_function("()=>document.querySelector('[data-stage-kind=work] select[name=work_type]').value")
 p.wait_for_function('()=>true');assert len(pending)==2
 reply2={**reply,'collections':[{'date':today,'customer_id':'TEST_C','amount':20000,'method':'Nakit','quote':'20 bin aldık'}]}
 pending[1].fulfill(status=200,content_type='application/json',body=json.dumps({'candidates':[{'content':{'parts':[{'text':json.dumps(reply2)}]},'finishReason':'STOP'}]}))
 p.wait_for_function("()=>document.querySelector('[data-ask]')&&!document.querySelector('[data-ask]').disabled&&document.querySelector('[data-kind=collection]')")
 assert not p.locator('[data-kind=collection] [data-pick]').is_checked()
 assert p.locator('[data-stage-pending]').count()==0
 assert p.evaluate("async()=>await(await import('./js/db.js')).dumpAll()")==before
 # Cancellation removes the preview; delayed worker work cannot resurrect it.
 p.reload();p.wait_for_function("()=>document.querySelector('[data-ask]')&&!document.querySelector('[data-ask]').disabled")
 p.fill('[data-msg]',text);p.click('[data-ask]');p.wait_for_function("()=>document.querySelector('[data-stage-kind=work]')")
 p.locator('[data-stop-reading]').click();p.wait_for_function("()=>document.querySelector('[data-ask]')&&!document.querySelector('[data-ask]').disabled")
 assert p.locator('[data-stage-pending]').count()==0
 pending[-1].abort('aborted')
 assert p.evaluate("async()=>await(await import('./js/db.js')).dumpAll()")==before
 assert not errors,errors
 print(json.dumps({'lockedPreviewBeforeModel':True,'sameFieldNodeAfterValidation':True,'finalFieldEditable':True,'sensitiveFallbackUnchecked':True,'cancellationClearsPreview':True,'moneyNotGuessed':True,'businessWrites':0,'desktopTimingOnly':timing,'cannedModelCalls':len(calls),'pageErrors':errors}),flush=True);b.close()
