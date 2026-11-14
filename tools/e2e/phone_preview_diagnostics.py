"""Synthetic provider failures in the actual packaged phone runner; no real API/key."""
import sys,json,subprocess,tempfile,zipfile,threading,functools,pathlib,uuid
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from playwright.sync_api import sync_playwright
sys.argv=[sys.argv[0],sys.argv[1].rstrip('/')+'/qa-v311-phone/','--package']
U=sys.argv[1]
with sync_playwright()as w:
 b=w.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);count=0
 for status,body,code in [(400,{'error':{'status':'INVALID_ARGUMENT','message':'responseJsonSchema invalid TEST_SECRET_PRIVATE_PROVIDER_DETAIL'}},'REQUEST_SCHEMA'),(429,{'error':{'status':'RESOURCE_EXHAUSTED','message':'quota limit: 0 TEST_SECRET_PRIVATE_PROVIDER_DETAIL'}},'NO_FREE'),(200,{'candidates':[{'finishReason':'MAX_TOKENS','content':{'parts':[{'text':'{"works":['}]}}]},'OUTPUT_LIMIT')]:
  c=b.new_context(viewport={'width':360,'height':850},is_mobile=True,has_touch=True);p=c.new_page();calls=[];errors=[];p.on('pageerror',lambda e:errors.append(str(e)))
  def provider(r):
   calls.append(r.request.url)
   if ':generateContent'in r.request.url:r.fulfill(status=status,content_type='application/json',body=json.dumps(body))
   else:r.fulfill(status=200,content_type='application/json',body=json.dumps({'models':[{'name':'models/gemini-test-free','displayName':'TEST model','supportedGenerationMethods':['generateContent']}]}))
  c.route('https://generativelanguage.googleapis.com/**',provider);p.goto(U+'tests/assistant-gold/phone.html?db=TEST_V311_'+uuid.uuid4().hex[:10]);p.wait_for_function("()=>!document.querySelector('#models').disabled");p.fill('#key','TEST_SECRET_PRIVATE_PROVIDER_DETAIL');p.check('#consent');p.click('#models');p.wait_for_function("()=>document.querySelector('#model').options.length===2&&!document.querySelector('#models').disabled");p.select_option('#model','gemini-test-free');p.select_option('#repeats','1');p.click('#run');p.wait_for_function("()=>document.querySelector('#progress').textContent.includes('Koşu durdu')");assert code in p.locator('#result').inner_text();assert 'HTTP '+str(status)in p.locator('#result').inner_text();assert 'PRIVATE_PROVIDER_DETAIL'not in p.locator('#result').inner_text();assert len(calls)==2
  with p.expect_download()as dl:p.click('#download')
  text=pathlib.Path(dl.value.path()).read_text();report=json.loads(text);assert report['runs'][0]['failures'][0]['code']==code and not report['runs'][0]['responses'];assert 'PRIVATE_PROVIDER_DETAIL'not in text;assert not errors;count+=len(calls);c.close()
 print(json.dumps({'realGemini':False,'androidEmulationOnly':True,'mockHTTP':count,'originalFailureVisible':True,'exactlyOneGeneratePerAttempt':True,'secretsNotDisplayedOrExported':True}),flush=True);b.close()
