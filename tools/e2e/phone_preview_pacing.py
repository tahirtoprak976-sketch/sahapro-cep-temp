"""Synthetic provider failures in the actual packaged phone runner; no real API/key."""
import sys,json,subprocess,tempfile,zipfile,threading,functools,pathlib,uuid
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from playwright.sync_api import sync_playwright
sys.argv=[sys.argv[0],sys.argv[1].rstrip('/')+'/qa-v311-phone/','--package']
U=sys.argv[1]
from datetime import datetime,timezone
import time
def until(p,condition):
 end=time.monotonic()+15
 while not p.evaluate(condition):
  if time.monotonic()>end:raise AssertionError('paced UI did not reach expected state')
  p.wait_for_timeout(10)
with sync_playwright()as w:
 b=w.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);total=0
 for cancelled in [False,True]:
  c=b.new_context(viewport={'width':360,'height':850},is_mobile=True,has_touch=True);p=c.new_page();p.clock.install(time=datetime(2026,11,15,12,tzinfo=timezone.utc));starts=[];calls=[];errors=[];p.on('pageerror',lambda e:errors.append(str(e)))
  def provider(r):
   calls.append(r.request.url)
   if ':generateContent'not in r.request.url:body={'models':[{'name':'models/gemini-test-free','displayName':'TEST model','outputTokenLimit':8192,'supportedGenerationMethods':['generateContent']}]};status=200
   else:
    now=p.evaluate('performance.now()');recent=sum(now-t<60000 for t in starts);starts.append(now);status=429 if recent>=15 else 200;body={'error':{'status':'RESOURCE_EXHAUSTED','message':'15 per minute'}}if status==429 else{'candidates':[{'finishReason':'STOP','content':{'parts':[{'text':'{}'}]}}]}
   r.fulfill(status=status,content_type='application/json',body=json.dumps(body))
  c.route('https://generativelanguage.googleapis.com/**',provider);p.goto(U+'tests/assistant-gold/phone.html?db=TEST_V311_'+uuid.uuid4().hex[:10]);p.wait_for_function("()=>!document.querySelector('#models').disabled");p.fill('#key','TEST_PACE');p.check('#consent');p.click('#models');p.wait_for_function("()=>document.querySelector('#model').options.length===2&&!document.querySelector('#models').disabled");p.select_option('#model','gemini-test-free');p.select_option('#repeats','1');p.clock.pause_at(datetime(2026,11,15,12,1,tzinfo=timezone.utc));p.locator('#run').dispatch_event('click');until(p,"()=>document.querySelector('#progress').textContent.includes('Kota için')");assert len(starts)==1,'clock is paused: second request must wait';assert p.evaluate("async()=>Object.values((await(await import('../../js/db.js')).metaGet('gemini_usage')).counts).reduce((a,b)=>a+b,0)")==2
  if cancelled:
   p.evaluate("()=>{const e=document.querySelector('#consent');e.checked=false;e.dispatchEvent(new Event('change'));}");until(p,"()=>!document.querySelector('#run').disabled");p.clock.fast_forward(120000);assert len(starts)==1 and len(calls)==2
  else:
   for target in range(2,34):
    p.clock.fast_forward(6000);deadline=time.monotonic()+15
    while len(starts)<target:
     if time.monotonic()>deadline:raise AssertionError('next paced request missing')
     p.wait_for_timeout(10)
   until(p,"()=>document.querySelector('#progress').textContent.includes('Canlı yanıtlar alındı')");assert len(calls)==34
   assert all(starts[i]-starts[i-1]>=6000 for i in range(1,len(starts)))
   assert all(sum(0<=t-s<60000 for s in starts)<=15 for t in starts)
  with p.expect_download()as dl:p.locator('#download').dispatch_event('click')
  report=json.loads(pathlib.Path(dl.value.path()).read_text());assert report['pacing']['minRequestIntervalMs']==6000
  if cancelled:assert not report['completed']and report['runs'][0]['failures'][0]['code']=='ASSISTANT_ABORT'and len(report['runs'][0]['responses'])==1
  else:assert report['completed']and report['safety']['cardCountErrors']>0,'empty mock cards cannot authorize release'
  assert not errors,errors;total+=len(calls);c.close()
 print(json.dumps({'realGemini':False,'androidEmulationOnly':True,'mockHTTP':total,'observed15PerMinuteLimitRespected':True,'cancelDuringWaitSendsNothing':True,'waitingDoesNotSpendBudget':True,'existingAssertionsPreserved':True}),flush=True);b.close()
