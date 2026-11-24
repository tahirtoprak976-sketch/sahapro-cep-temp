"""Inspection PDF/photo through real assistant UI; recorded model only, no owner data or real API."""
import sys,json,uuid,base64,io
from pathlib import Path
from urllib.parse import urlparse
from PIL import Image
from playwright.sync_api import sync_playwright
base=(sys.argv[1] if len(sys.argv)>1 else 'http://localhost:8841/').rstrip('/')+'/'
out=Path('/tmp/solo-inspection121');out.mkdir(exist_ok=True)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);c=b.new_context(viewport={'width':360,'height':800},service_workers='block');c.add_init_script("localStorage.setItem('sp_role','boss')")
 page=c.new_page();errors=[];calls=[];state={'owner':None,'no':'TESTMUAYENE121'};page.on('pageerror',lambda e:errors.append(str(e)))
 def route(r):
  if r.request.url.startswith('https://generativelanguage.googleapis.com/'):
   calls.append(r.request.post_data_json);text='Muayene Belgesi 34 TST 123 '+state['no']+' Düzenleme 24.11.2026 Geçerlilik 24.11.2027'
   plan={'photo_texts':[text],'documents':[{'photo':0,'category':'Muayene Belgesi','owner_id':state['owner'],'plate':'34TST123','doc_no':state['no'],'date':'2026-11-24','expiry_date':'2027-11-24'}]}
   r.fulfill(status=200,content_type='application/json',body=json.dumps({'candidates':[{'content':{'parts':[{'text':json.dumps(plan)}]},'finishReason':'STOP'}]}))
  elif urlparse(r.request.url).hostname in ('localhost','127.0.0.1'):r.continue_()
  else:r.abort()
 c.route('**/*',route);app=base+'index.html?db=TEST_inspection121_'+uuid.uuid4().hex[:10]
 page.goto(app+'#/daha');page.wait_for_selector('#screen[data-view-ready="1"]')
 state['owner']=page.evaluate("""async()=>{const d=await import('./js/db.js');for(const[k,v]of Object.entries({gemini_key:'TEST',gemini_model:'TEST_MODEL',gemini_consent:true,gemini_daily_limit:20}))await d.metaSet(k,v);return (await d.saveNew('vehicles',{name:'TEST Muayene Aracı',plate:'34TST123'},'TEST')).id}""")
 raw=bytes(page.evaluate("""async()=>Array.from(new Uint8Array(await(await(await import('./js/document-engine.js')).buildDocument({title:'TEST Muayene Belgesi',sections:[{text:'34 TST 123 TESTMUAYENE121 Düzenleme 24.11.2026 Geçerlilik 24.11.2027'}]})).arrayBuffer()))"""))
 snapshot=lambda:page.evaluate("async()=>JSON.stringify(await(await import('./js/db.js')).dumpAll())")
 before=snapshot();page.goto(app+'#/akilli-asistan');page.wait_for_function("()=>!document.querySelector('[data-ask]')?.disabled")
 def add(name,mime,data):
  page.set_input_files('[data-photos]',{'name':name,'mimeType':mime,'buffer':data});page.wait_for_function("()=>!document.querySelector('[data-attach]').disabled&&document.querySelector('[data-thumbs]').textContent.includes('Kaldır')")
 def send(text):
  page.fill('[data-msg]',text);page.click('[data-ask]');page.wait_for_function("()=>!document.querySelector('[data-ask]').disabled",timeout=30000)
 add('TEST-muayene.pdf','application/pdf',raw);send('Bu muayene belgesini araç kartına ekle')
 assert len(calls)==1,'Inspection PDF never reached document reader'
 page.wait_for_selector('[data-kind=doc]');card=page.locator('[data-kind=doc]');assert card.locator('[name=owner]').input_value()=='vehicle:'+state['owner'];assert card.locator('[name=expiry_date]').input_value()=='2027-11-24';assert snapshot()==before,'Reading cannot write a document or vehicle'
 parts=calls[0]['contents'][0]['parts'];inline=[x['inlineData'] for x in parts if 'inlineData' in x];assert len(inline)==1 and inline[0]['mimeType']=='application/pdf';assert base64.b64decode(inline[0]['data'])==raw,'PDF original bytes must reach model unchanged'
 assert card.locator('[data-document-pdf]').count()==1 and card.locator('img').count()==0,'PDF must not become a broken image'
 card.locator('[data-pick]').check();page.click('[data-save]');page.wait_for_function("()=>document.querySelector('[data-out]')?.textContent.includes('Kaydedildi:')")
 saved=page.evaluate("""async()=>{const d=await import('./js/db.js'),r=(await d.listActive('documents'))[0],a=(await d.attachmentsFor('document',r.id))[0];return {doc:r,bytes:Array.from(new Uint8Array(await a.blob.arrayBuffer())),type:a.blob.type}}""");assert saved['doc']['owner_id']==state['owner'] and saved['doc']['expiry_date']=='2027-11-24';assert bytes(saved['bytes'])==raw and saved['type']=='application/pdf'
 after=snapshot();page.reload();page.wait_for_function("()=>!document.querySelector('[data-ask]')?.disabled");page.click('[data-clearfiles]');state['no']='TESTPHOTO121';image=io.BytesIO();Image.new('RGB',(80,80),'white').save(image,format='PNG');add('TEST-muayene.png','image/png',image.getvalue());send('Fotoğraftaki muayene belgesini kontrol et');page.wait_for_selector('[data-kind=doc]');assert snapshot()==after and len(calls)==2;assert page.locator('[data-kind=doc] img').count()==1
 page.click('[data-clearfiles]');add('TEST.sahapro.pdf','application/pdf',raw);prior=len(calls);send('Muayene belgesi');assert len(calls)==prior,'Unsigned driver PDF must never fall back to normal PDF reader';assert snapshot()==after
 for width in [320,360,768]:page.set_viewport_size({'width':width,'height':800});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),width
 assert not errors,errors
 (out/'result.json').write_text(json.dumps({'pdfRead':True,'photoRead':True,'noWritesBeforeSave':True,'originalPdfArchivedExactly':True,'expiryAndOwner':True,'driverGateRetained':True,'realGemini':False,'errors':errors}));print((out/'result.json').read_text());b.close()
