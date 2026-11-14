"""Synthetic provider failures in the actual packaged phone runner; no real API/key."""
import sys,json,subprocess,tempfile,zipfile,threading,functools,pathlib,uuid
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from playwright.sync_api import sync_playwright
if '--package'not in sys.argv:
 with tempfile.TemporaryDirectory(prefix='sahapro-phone-diagnostics-')as tmp:
  output=pathlib.Path(tmp)/'phone.zip';subprocess.check_call([sys.executable,'tools/preview/build_phone.py','--output',str(output)]);folder=pathlib.Path(tmp)/'site';folder.mkdir()
  with zipfile.ZipFile(output)as z:z.extractall(folder)
  class Quiet(SimpleHTTPRequestHandler):
   def log_message(self,*args):pass
  server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Quiet,directory=str(folder)));thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
  try:subprocess.check_call([sys.executable,__file__,'http://127.0.0.1:'+str(server.server_port)+'/','--package'])
  finally:server.shutdown();thread.join();server.server_close()
 sys.exit(0)
U=sys.argv[1]
with sync_playwright()as w:
 b=w.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);c=b.new_context(viewport={'width':360,'height':850},is_mobile=True,has_touch=True);p=c.new_page();calls=[];errors=[];p.on('pageerror',lambda e:errors.append(str(e)));reject=False
 def provider(r):
  calls.append(r.request.url)
  if ':generateContent'not in r.request.url:body={'models':[{'name':'models/gemini-test-free','displayName':'TEST model','outputTokenLimit':8192,'supportedGenerationMethods':['generateContent']}]};status=200
  else:
   request=json.loads(r.request.post_data);assert 'responseJsonSchema'not in request['generationConfig'];assert request['generationConfig']['maxOutputTokens']==8192;assert request['generationConfig']['responseMimeType']=='application/json'
   if reject:body={'error':{'status':'INVALID_ARGUMENT','message':'maxOutputTokens unsupported TEST_COMPAT_KEY PRIVATE_TECH_ONLY'}};status=400
   else:body={'candidates':[{'finishReason':'STOP','content':{'parts':[{'text':'{}'}]}}]};status=200
  r.fulfill(status=status,content_type='application/json',body=json.dumps(body))
 c.route('https://generativelanguage.googleapis.com/**',provider)
 def start():
  p.goto(U+'tests/assistant-gold/phone.html?db=TEST_V311_'+uuid.uuid4().hex[:10]);p.wait_for_function("()=>!document.querySelector('#models').disabled");p.fill('#key','TEST_COMPAT_KEY');p.check('#consent');p.click('#models');p.wait_for_function("()=>document.querySelector('#model').options.length===2&&!document.querySelector('#models').disabled");p.select_option('#model','gemini-test-free');p.select_option('#repeats','1');p.click('#run')
 start();p.wait_for_function("()=>document.querySelector('#progress').textContent.includes('Canlı yanıtlar alındı')",timeout=120000);assert len(calls)==34
 with p.expect_download()as dl:p.click('#download')
 report=json.loads(pathlib.Path(dl.value.path()).read_text());assert report['transport']=={'jsonMode':True,'providerSchema':False,'maxOutputTokens':8192};assert report['completed']and report['safety']['cardCountErrors']>0,'empty mock output cannot authorize release'
 reject=True;start();p.wait_for_function("()=>document.querySelector('#progress').textContent.includes('Koşu durdu')");assert len(calls)==36;assert 'maxOutputTokens unsupported'in p.locator('#technical').inner_text();assert 'TEST_COMPAT_KEY'not in p.locator('body').inner_text()
 with p.expect_download()as dl:p.click('#download')
 text=pathlib.Path(dl.value.path()).read_text();assert 'PRIVATE_TECH_ONLY'not in text and 'TEST_COMPAT_KEY'not in text;assert not errors
 print(json.dumps({'realGemini':False,'androidEmulationOnly':True,'mockHTTP':len(calls),'metadataTokenLimitRespected':True,'portableJsonFirstRequest':True,'technicalDetailPhoneOnlyAndRedacted':True,'noInventedFinancialCoverage':True}),flush=True);b.close()
