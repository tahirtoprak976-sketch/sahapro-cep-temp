"""503 recovery in actual PDF assistant, recorded responses only; fresh TEST databases."""
import sys,json,uuid,base64
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright
base=(sys.argv[1] if len(sys.argv)>1 else 'http://localhost:8841/').rstrip('/')+'/'
with sync_playwright() as w:
 b=w.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 for mode in ['retry-success','stale-cache','cancel','budget','all-busy']:
  c=b.new_context(service_workers='block',viewport={'width':360,'height':800});c.add_init_script("localStorage.setItem('sp_role','boss')");p=c.new_page();errors=[];calls=[];state={'generation':0,'owner':None};p.on('pageerror',lambda e:errors.append(str(e)))
  def route(r):
   if r.request.url.startswith('https://generativelanguage.googleapis.com/'):
    calls.append({'url':r.request.url,'body':r.request.post_data_json})
    if '/models?' in r.request.url:
     return r.fulfill(status=200,content_type='application/json',body=json.dumps({'models':[{'name':'models/gemini-test-'+n,'supportedGenerationMethods':['generateContent']} for n in ['hydrogen','argon','carbon']]}))
    state['generation']+=1
    success=mode=='retry-success' and state['generation']==2 or mode=='stale-cache' and 'hydrogen' in r.request.url
    if not success:return r.fulfill(status=503,content_type='application/json',body=json.dumps({'error':{'message':'TEST temporarily overloaded'}}))
    plan={'photo_texts':['Muayene Belgesi 34 TST 122 TESTMUAYENE122 24.11.2026 24.11.2027'],'documents':[{'photo':0,'category':'Muayene Belgesi','owner_id':state['owner'],'plate':'34TST122','doc_no':'TESTMUAYENE122','date':'2026-11-24','expiry_date':'2027-11-24'}]}
    r.fulfill(status=200,content_type='application/json',body=json.dumps({'candidates':[{'content':{'parts':[{'text':json.dumps(plan)}]},'finishReason':'STOP'}]}))
   elif urlparse(r.request.url).hostname in ('localhost','127.0.0.1'):r.continue_()
   else:r.abort()
  c.route('**/*',route);app=base+'index.html?db=TEST_busy122_'+uuid.uuid4().hex[:10];p.goto(app+'#/daha');p.wait_for_selector('#screen[data-view-ready="1"]')
  state['owner']=p.evaluate("""async limit=>{const d=await import('./js/db.js');for(const[k,v]of Object.entries({gemini_key:'TEST',gemini_model:'gemini-test-neon',gemini_model_list:['gemini-test-neon'],gemini_consent:true,gemini_daily_limit:limit}))await d.metaSet(k,v);return(await d.saveNew('vehicles',{name:'TEST Muayene Aracı',plate:'34TST122'},'TEST')).id}""",1 if mode=='budget' else 20)
  raw=bytes(p.evaluate("""async()=>Array.from(new Uint8Array(await(await(await import('./js/document-engine.js')).buildDocument({title:'TEST Muayene',sections:[{text:'34 TST 122 TESTMUAYENE122 24.11.2026 24.11.2027'}]})).arrayBuffer()))"""));snap=lambda:p.evaluate("async()=>JSON.stringify(await(await import('./js/db.js')).dumpAll())");before=snap()
  p.goto(app+'#/akilli-asistan');p.wait_for_function("()=>!!document.querySelector('[data-ask]')&&!document.querySelector('[data-ask]').disabled&&!document.querySelector('[data-msg]').readOnly");p.set_input_files('[data-photos]',{'name':'TEST-muayene.pdf','mimeType':'application/pdf','buffer':raw});p.wait_for_function("()=>!document.querySelector('[data-attach]').disabled&&document.querySelector('[data-thumbs]').textContent.includes('Kaldır')");p.click('[data-ask]');p.wait_for_function("()=>document.querySelector('[data-read-status]')?.textContent.includes('beklenip yeniden')",timeout=15000)
  if mode=='cancel':p.click('[data-stop-reading]')
  p.wait_for_function("()=>!document.querySelector('[data-ask]').disabled",timeout=45000);assert snap()==before;assert 'TEST-muayene.pdf' in p.locator('[data-thumbs]').inner_text()
  if mode in ['retry-success','stale-cache']:
   p.wait_for_selector('[data-kind=doc]');assert p.locator('[data-kind=doc] [name=owner]').input_value()=='vehicle:'+state['owner'];assert p.locator('[data-kind=doc] [name=expiry_date]').input_value()=='2027-11-24'
   generations=[x for x in calls if ':generateContent' in x['url']];assert len(generations)==(2 if mode=='retry-success' else 3);assert generations[0]['body']['contents']==generations[-1]['body']['contents'];inline=[x['inlineData'] for x in generations[-1]['body']['contents'][0]['parts'] if 'inlineData' in x];assert inline[0]['mimeType']=='application/pdf' and base64.b64decode(inline[0]['data'])==raw
  elif mode=='cancel':
   p.wait_for_timeout(1500);assert len(calls)==1 and 'durduruldu' in p.locator('[data-out]').inner_text()
  elif mode=='budget':assert len(calls)==1 and 'günlük Gemini sınırı' in p.locator('[data-out]').inner_text()
  else:assert state['generation']==5 and len(calls)==6 and '5 okuma denemesi' in p.locator('[data-out]').inner_text()
  if mode=='stale-cache':assert p.evaluate("async()=>(await import('./js/db.js')).metaGet('gemini_model')")=='gemini-test-hydrogen'
  assert not errors,errors;print(json.dumps({'mode':mode,'httpRequests':len(calls),'generationRequests':state['generation'],'businessWrites':0,'pdfPreserved':True,'realGemini':False,'errors':errors}),flush=True);c.close()
 b.close()
