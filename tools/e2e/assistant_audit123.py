"""Full normal-text path, retained PDF and private connection check; synthetic data and mocked provider only."""
import sys,json,uuid
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright
base=(sys.argv[1] if len(sys.argv)>1 else 'http://localhost:8841/').rstrip('/')+'/'
with sync_playwright() as w:
 b=w.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);c=b.new_context(service_workers='block',viewport={'width':360,'height':800});c.add_init_script("localStorage.setItem('sp_role','boss')");p=c.new_page();errors=[];calls=[];held=[];mode={'value':'ok'};p.on('pageerror',lambda e:errors.append(str(e)))
 def route(r):
  if r.request.url.startswith('https://generativelanguage.googleapis.com/'):
   body=r.request.post_data_json;calls.append(body)
   if mode['value']=='hold':held.append(r);return
   if mode['value'] in ['503','403']:return r.fulfill(status=int(mode['value']),content_type='application/json',body=json.dumps({'error':{'message':'TEST provider failure'}}))
   part={'text':json.dumps({'photo_texts':['TEST bekleyen belge'],'answer':'TEST belge için kontrol bilgisi hazır.'})} if any('inlineData' in x for x in body['contents'][0]['parts']) else {'text':'OK'} if body['generationConfig']['maxOutputTokens']==64 else {'functionCall':{'name':'prepare_plan','args':{'goal':'TEST yorum','plan_json':'{"answer":"TEST yorum hazır. Henüz kayıt yapılmadı."}'}}}
   r.fulfill(status=200,content_type='application/json',body=json.dumps({'candidates':[{'content':{'parts':[part]},'finishReason':'STOP'}]}))
  elif urlparse(r.request.url).hostname in ('localhost','127.0.0.1'):r.continue_()
  else:r.abort()
 c.route('**/*',route);app=base+'index.html?db=TEST_audit123_'+uuid.uuid4().hex[:10];p.goto(app+'#/daha');p.wait_for_selector('#screen[data-view-ready="1"]');p.evaluate("""async()=>{const d=await import('./js/db.js');await d.saveNew('customers',{name:'TEST Gizli Müşteri'},'TEST');for(const[k,v]of Object.entries({gemini_key:'TEST_SECRET_KEY',gemini_model:'gemini-9-test',gemini_consent:true,gemini_daily_limit:30}))await d.metaSet(k,v)}""")
 raw=bytes(p.evaluate("""async()=>Array.from(new Uint8Array(await(await(await import('./js/document-engine.js')).buildDocument({title:'TEST bekleyen belge',sections:[{text:'TEST henüz okunmadı'}]})).arrayBuffer()))"""));snap=lambda:p.evaluate("async()=>JSON.stringify(await(await import('./js/db.js')).dumpAll())");before=snap()
 p.goto(app+'#/akilli-asistan');p.wait_for_function("()=>!!document.querySelector('[data-ask]')&&!document.querySelector('[data-ask]').disabled&&!document.querySelector('[data-msg]').readOnly")
 assert p.locator('[data-connection-open]').count()==1,'Missing assistant connection check'
 p.set_input_files('[data-photos]',{'name':'TEST-bekleyen.pdf','mimeType':'application/pdf','buffer':raw});p.wait_for_function("()=>!document.querySelector('[data-attach]').disabled&&document.querySelector('[data-thumbs]').textContent.includes('Kaldır')")
 for text in ['Merhaba','Günaydın','Nasılsın?','Teşekkür ederim']:
  p.fill('[data-msg]',text);p.click('[data-ask]');p.wait_for_function("()=>!document.querySelector('[data-ask]').disabled");assert not calls,'Ordinary greeting must not reread a pending PDF';assert 'Ekli dosya bu mesajla okunmadı' in p.locator('[data-out]').inner_text();assert 'TEST-bekleyen.pdf' in p.locator('[data-thumbs]').inner_text();assert p.locator('[data-local-chat]').count()==1
 assert snap()==before
 p.fill('[data-msg]','TEST yazdığım mesaj korunacak');p.click('[data-connection-open]');assert not calls;p.click('[data-connection-test]');p.wait_for_function("()=>document.querySelector('[data-connection-result]')?.textContent.includes('HTTP 200')");assert len(calls)==1
 assert calls[0].get('tools') is None and calls[0].get('systemInstruction') is None and calls[0]['generationConfig']['maxOutputTokens']==64;assert len(calls[0]['contents'][0]['parts'])==1;assert 'inlineData' not in json.dumps(calls[0]) and 'TEST Gizli Müşteri' not in json.dumps(calls[0]);assert 'TEST_SECRET_KEY' not in p.locator('[data-connection-report]').inner_text();assert p.input_value('[data-msg]')=='TEST yazdığım mesaj korunacak' and snap()==before
 for status,label in [('503','BUSY'),('403','PERMISSION')]:
  mode['value']=status;prior=len(calls);p.click('[data-connection-test]');p.wait_for_function("code=>document.querySelector('[data-connection-details]')?.textContent.includes(code)",arg=label);assert len(calls)==prior+1;assert p.input_value('[data-msg]')=='TEST yazdığım mesaj korunacak' and snap()==before
 mode['value']='hold';prior=len(calls);p.click('[data-connection-test]');p.wait_for_function("()=>!!document.querySelector('[data-connection-cancel]')");p.wait_for_timeout(100);p.click('[data-connection-cancel]');p.wait_for_function("()=>document.querySelector('[data-connection-details]')?.textContent.includes('ASSISTANT_ABORT')");assert len(calls)==prior+1 and not p.locator('[data-ask]').is_disabled();assert snap()==before
 for r in held:
  try:r.abort()
  except Exception:pass
 p.evaluate("async()=>(await import('./js/db.js')).metaSet('gemini_daily_limit',0)");prior=len(calls);p.click('[data-connection-test]');p.wait_for_function("()=>document.querySelector('[data-connection-details]')?.textContent.includes('LOCAL_LIMIT')");assert len(calls)==prior
 p.evaluate("async()=>(await import('./js/db.js')).metaSet('gemini_daily_limit',30)");p.click('[data-connection-hide]');p.click('[data-clearfiles]');p.wait_for_function("()=>!document.querySelector('[data-thumbs]').textContent.trim()");mode['value']='ok';p.fill('[data-msg]','TEST talebinin ayrıntılarını yorumlar mısın');p.click('[data-ask]');p.wait_for_selector('[data-answer]');p.wait_for_function("()=>!document.querySelector('[data-ask]').disabled");assert calls[-1]['generationConfig']['maxOutputTokens']==8192 and 'temperature' not in calls[-1]['generationConfig'];assert snap()==before;assert 'TEST Gizli Müşteri' not in json.dumps(calls[-1]),'Unrelated customer list must not leave the device for a plain message'
 prior=len(calls);p.set_input_files('[data-photos]',{'name':'TEST-soru.pdf','mimeType':'application/pdf','buffer':raw});p.wait_for_function("()=>!document.querySelector('[data-attach]').disabled&&document.querySelector('[data-thumbs]').textContent.includes('Kaldır')");p.fill('[data-msg]','Bu PDF hangi araç için?');p.click('[data-ask]');p.wait_for_function("()=>!document.querySelector('[data-ask]').disabled");assert len(calls)==prior+1,'A document question must not start a parallel question model';assert snap()==before
 for width in [320,360,768]:p.set_viewport_size({'width':width,'height':800});assert p.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),width
 assert not errors,errors
 print(json.dumps({'localChatWithPendingPdfHttp':0,'retainedPdf':True,'shortAgentOutputBudget':8192,'modernSamplingDefaults':True,'privateSingleRequestProbe':True,'busyVsPermissionSeparated':True,'probeCancel':True,'probeBudget':True,'businessWrites':0,'realGemini':False,'errors':errors}));b.close()
