"""Phone-only corpus runner; intercepted Gemini, isolated storage and source configuration."""
import json,sys,uuid,subprocess,tempfile,zipfile,threading,pathlib,functools
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from playwright.sync_api import sync_playwright
sys.argv=[sys.argv[0],sys.argv[1].rstrip('/')+'/qa-v311-phone/','--package']
U=sys.argv[1]if len(sys.argv)>1 else'http://localhost:8897/'
def await_default_sentinel(p):
 return p.evaluate("""async()=>await new Promise((resolve,reject)=>{const q=window.__originalOpen('sahapro_cep_db',7);q.onsuccess=()=>{const d=q.result,r=d.transaction('test_sentinel').objectStore('test_sentinel').get('TEST_PRIVATE');r.onsuccess=()=>{d.close();resolve(r.result);};r.onerror=()=>reject(r.error);};})""")
with sync_playwright()as w:
 b=w.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);c=b.new_context(viewport={'width':360,'height':850},is_mobile=True,has_touch=True,service_workers='allow',accept_downloads=True)
 c.add_init_script("window.__opened=[];window.__originalOpen=indexedDB.open.bind(indexedDB);indexedDB.open=function(name,...rest){window.__opened.push(String(name));return window.__originalOpen(name,...rest)}")
 p=c.new_page();errors=[];calls=[];held=[];hold=False;p.on('pageerror',lambda e:errors.append(str(e)))
 if '--package'not in sys.argv:c.route('**/phone-source.json',lambda r:r.fulfill(status=200,content_type='application/json',body=json.dumps({'sourceSha':'0'*40,'appVersion':'SAHAPRO SOLO v3.11.05'})))
 def provider(r):
  calls.append({'url':r.request.url,'body':r.request.post_data or''})
  if hold and ':generateContent'in r.request.url:held.append(r);return
  if ':generateContent'not in r.request.url:reply={'models':[{'name':'models/gemini-test-free','displayName':'TEST model','supportedGenerationMethods':['generateContent']}]}
  else:reply={'candidates':[{'content':{'parts':[{'text':'{"works":[],"fuel":[],"questions":[]}'}]},'finishReason':'STOP'}]}
  r.fulfill(status=200,content_type='application/json',body=json.dumps(reply))
 c.route('https://generativelanguage.googleapis.com/**',provider)
 c.route('**/sentinel.html',lambda r:r.fulfill(status=200,content_type='text/html',body='<!doctype html><title>TEST existing profile</title>'))
 p.goto(U+'sentinel.html');p.evaluate("""async()=>{await new Promise((resolve,reject)=>{const q=indexedDB.open('sahapro_cep_db',7);q.onupgradeneeded=()=>q.result.createObjectStore('test_sentinel',{keyPath:'id'});q.onsuccess=()=>{const d=q.result,t=d.transaction('test_sentinel','readwrite');t.objectStore('test_sentinel').put({id:'TEST_PRIVATE',value:'PRIVATE_SENTINEL_NOT_FOR_MODEL'});t.oncomplete=()=>{d.close();resolve();};};q.onerror=()=>reject(q.error);});const c=await caches.open('sahapro-solo-TEST_EXISTING');await c.put(new URL('test-existing-cache',location.href),new Response('PRIVATE_SENTINEL_CACHE'));}""")
 p.goto(U+'tests/assistant-gold/phone.html?db=TEST_V311_'+uuid.uuid4().hex[:10]);p.wait_for_function("()=>!document.querySelector('#models').disabled")
 assert not calls,'Opening the test sends nothing to provider'
 assert p.evaluate("()=>window.__opened.every(n=>n.startsWith('sahapro_cep_db_TEST_V311_'))")
 p.click('#models');assert not calls,'No consent or key means no provider call'
 key='TEST_FAKE_SECRET_NOT_REAL';p.fill('#key',key);p.check('#consent');p.click('#models');p.wait_for_function("()=>document.querySelector('#model').options.length===2&&!document.querySelector('#models').disabled")
 assert len(calls)==1
 p.select_option('#model','gemini-test-free');p.click('#run');p.wait_for_function("()=>document.querySelector('#progress').textContent.includes('Canlı yanıtlar alındı')",timeout=120000)
 assert len(calls)==100,'1 model list + 3 × (20 single + 1 batch + 12 safety)'
 assert all('PRIVATE_SENTINEL'not in call['body']and key not in call['body']and'"expectedCards"'not in call['body']and'"recordedResponse"'not in call['body']for call in calls)
 assert p.locator('#result table tbody tr').count()==6
 assert p.locator('#result').inner_text().count('25/38')==6,'The unchanged phone validator resolves 25 cards even for empty model proposals; this is not 38/38 model success'
 with p.expect_download()as download:p.click('#download')
 path='/tmp/SAHAPRO_phone245_canned_only.json';download.value.save_as(path);text=open(path).read();report=json.loads(text)
 assert key not in text and report['completed']and len(report['runs'])==6
 assert report['safety']['measured']is True and report['savedBusinessRecords']==0
 for run in report['runs']:
  t=run['measurement']['totals'];assert t['readyCorrect']==25 and t['unnecessaryQuestions']==3 and t['missedQuestions']==0 and t['silentWrong']==0 and t['wrongFields']==(4 if run['mode']=='single'else 3),t
 assert len(report['safety']['runs'])==3 and report['safety']['cardCountErrors']>0,'Empty model cannot satisfy financial case coverage'
 assert p.evaluate("async()=>{const d=await import('./../../js/db.js');return Object.values(await d.dumpAll()).every(rows=>rows.length===0)}")
 assert p.evaluate("()=>window.__opened.every(n=>n.startsWith('sahapro_cep_db_TEST_V311_'))")
 p.reload();p.wait_for_function("()=>!document.querySelector('#models').disabled");assert p.locator('#key').input_value()=='';assert '100'in p.locator('#usage').inner_text()
 p.fill('#key',key);p.check('#consent');p.fill('#budget','100');p.click('#models');p.wait_for_function("()=>!document.querySelector('#models').disabled&&document.querySelector('#progress').textContent.includes('tamamlanamadı')")
 assert len(calls)==100,'Persisted daily counter cannot be reset by reloading or reducing limit'
 # A real pending HTTP must abort when the owner revokes consent.
 hold=True;p.goto(U+'tests/assistant-gold/phone.html?db=TEST_V311_CANCEL');p.wait_for_function("()=>!document.querySelector('#models').disabled")
 p.fill('#key',key);p.check('#consent');p.click('#models');p.wait_for_function("()=>document.querySelector('#model').options.length===2&&!document.querySelector('#models').disabled");p.select_option('#model','gemini-test-free');p.click('#run')
 deadline=__import__('time').monotonic()+10
 while not held and __import__('time').monotonic()<deadline:p.wait_for_timeout(20)
 assert len(held)==1
 p.uncheck('#consent');p.wait_for_function("()=>!document.querySelector('#run').disabled&&document.querySelector('#progress').textContent.includes('Koşu durdu')")
 held[0].abort('aborted')
 with p.expect_download()as partial:p.click('#download')
 partial.value.save_as('/tmp/SAHAPRO_phone245_cancelled_canned_only.json');cancelled=json.load(open('/tmp/SAHAPRO_phone245_cancelled_canned_only.json'));assert not cancelled['completed']and cancelled['runs'][0]['responses']=={}and cancelled['runs'][0]['failures'][0]['code']=='ASSISTANT_ABORT'
 assert len(calls)==102 and p.evaluate("()=>window.__opened.every(n=>n.startsWith('sahapro_cep_db_TEST_V311_'))")
 assert await_default_sentinel(p)=={'id':'TEST_PRIVATE','value':'PRIVATE_SENTINEL_NOT_FOR_MODEL'}
 assert p.evaluate("async()=>await(await(await caches.open('sahapro-solo-TEST_EXISTING')).match(new URL('../../test-existing-cache',location.href))).text()")=='PRIVATE_SENTINEL_CACHE'
 assert p.evaluate('async()=>!(await navigator.serviceWorker.getRegistrations()).length')
 assert not errors,errors
 print(json.dumps({'androidEmulationOnly':True,'realGemini':False,'cannedHTTP':len(calls),'noAutomaticCalls':True,'isolatedTestDBOnly':True,'businessWrites':0,'existingDefaultDBAndCacheUntouched':True,'noServiceWorkerInstalled':True,'secretAbsentFromExport':True,'sameCorpusScorer':True,'sixRunsActuallyRescored':True,'counterSurvivesReload':True,'revokingConsentAbortsPendingRequest':True,'pageErrors':errors}),flush=True);b.close()
