"""Warranty photo/PDF path: synthetic source, mocked extraction, real DOM/IDB/files/transactions."""
import sys,json,io,hashlib,base64
from PIL import Image,ImageDraw,ImageFont
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from playwright.sync_api import sync_playwright
U=(sys.argv[1] if len(sys.argv)>1 else 'http://localhost:8842/').rstrip('/')+'/'
TEXT='Akü Garanti Belgesi\nMarka TEST Model X200\nSatıcı TEST Petrol\nBelge no G-100\nSeri no TEST-A1 TEST-A2\nMiktar 2 adet akü\nBirim fiyat KDV dahil 3000 TL\nToplam 6000 TL\nFatura tarihi 07.09.2026\nGaranti başlangıç 07.09.2026\nGaranti bitiş 07.09.2028\nPlaka 34 ZZ 466'
RAW={'kind':'warranty','text':TEXT,'part_name':'Akü','brand':'TEST','model':'X200','seller':'TEST Petrol','invoice_no':'G-100','serial_numbers':['TEST-A1','TEST-A2'],'quantity':2,'unit_price':3000,'total':6000,'price_basis':'gross','purchase_date':'2026-09-07','warranty_start':'2026-09-07','warranty_until':'2028-09-07','plate':'34ZZ466','evidence':{'part_name':'Akü Garanti Belgesi','brand':'Marka TEST','model':'Model X200','seller':'Satıcı TEST Petrol','invoice_no':'Belge no G-100','serial_numbers':'Seri no TEST-A1 TEST-A2','quantity':'Miktar 2 adet akü','unit_price':'Birim fiyat KDV dahil 3000 TL','purchase_date':'Fatura tarihi 07.09.2026','warranty_start':'Garanti başlangıç 07.09.2026','warranty_until':'Garanti bitiş 07.09.2028','plate':'Plaka 34 ZZ 466'}}
img=Image.new('RGB',(1900,1400),'white');draw=ImageDraw.Draw(img);font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',40)
draw.multiline_text((50,50),TEXT,font=font,fill='black',spacing=15);buf=io.BytesIO();img.save(buf,format='PNG');PNG=buf.getvalue()
pdfmetrics.registerFont(TTFont('DocTest','/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'))
pdfio=io.BytesIO();cv=canvas.Canvas(pdfio);cv.setFont('DocTest',11)
for i,line in enumerate(TEXT.replace('07.09.2028','07.09.2029').splitlines()):cv.drawString(40,800-i*22,line)
cv.save();PDF=pdfio.getvalue()
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);c=b.new_context(viewport={'width':390,'height':850});c.add_init_script("localStorage.setItem('sp_role','boss')")
 pg=c.new_page();errors=[];calls=[];mode='normal';held=[]
 pg.on('pageerror',lambda e:errors.append(str(e)))
 def mock(r):
  body=json.loads(r.request.post_data);calls.append(body)
  if mode=='hold':held.append(r);return
  props=body.get('generationConfig',{}).get('responseJsonSchema',{}).get('properties',{})
  if 'part_documents' in props or body.get('tools'):
   result={'part_documents':[{**RAW,'photo':0}],'expenses':[{'photo':0,'date':'2026-09-07','amount':6000,'category':'Yedek Parça'}],'documents':[{'photo':0,'category':'Ruhsat','date':'2026-09-07'}]}
   if mode=='legacy':result={'photo_texts':[TEXT],'expenses':result['expenses'],'documents':result['documents']}
  else:
   is_pdf=any(x.get('inlineData',{}).get('mimeType')=='application/pdf' for x in body['contents'][0]['parts'])
   result=json.loads(json.dumps(RAW))
   if is_pdf:result['warranty_until']='2029-09-07';result['text']=TEXT.replace('07.09.2028','07.09.2029');result['evidence']['warranty_until']='Garanti bitiş 07.09.2029'
   if mode=='no_text':result['text']='';result['evidence']={}
  r.fulfill(status=200,content_type='application/json',body=json.dumps({'candidates':[{'content':{'parts':[{'text':json.dumps(result)}]},'finishReason':'STOP'}]}))
 c.route('https://generativelanguage.googleapis.com/**',mock)
 pg.goto(U+'index.html#/daha');pg.wait_for_selector('#screen[data-view-ready="1"]');pg.evaluate('async()=>await navigator.serviceWorker.ready');pg.wait_for_function('!!navigator.serviceWorker.controller')
 vid=pg.evaluate("""async()=>{const d=await import('./js/db.js');const v=await d.saveNew('vehicles',{name:'TEST Kamyon',plate:'34ZZ466'},'TEST');for(const[k,v]of Object.entries({gemini_key:'TEST',gemini_model:'gemini-2.5-flash',gemini_consent:true,gemini_daily_limit:100}))await d.metaSet(k,v);return v.id}""")
 def state():return pg.evaluate("async()=>{const d=await import('./js/db.js');return {d:await d.dumpAll(),a:await d.getAll('audit_log')}}")
 def ready():pg.wait_for_function("()=>document.querySelector('[data-new-chat]')&&!document.querySelector('[data-new-chat]').disabled")
 def reader_ready():pg.wait_for_selector('[data-part-reader]');pg.wait_for_function("()=>!document.querySelector('[data-part-read]').disabled&&!document.querySelector('[data-part-form]').inert")
 pg.goto(U+'index.html#/akilli-asistan');ready();before=state()
 pg.set_input_files('[data-photos]',{'name':'TEST-aku-garanti.png','mimeType':'image/png','buffer':PNG});pg.click('[data-ask]');pg.wait_for_selector('[data-part-document-card]')
 assert not pg.locator('[data-kind=expense]').count() and not pg.locator('[data-kind=doc]').count() and not pg.locator('[data-save]').count()
 assert state()==before
 pg.click('[data-part-document-open]');reader_ready();assert len(calls)==1
 assert pg.input_value('[name=date]')=='' and pg.input_value('[name=quantity]')==''
 pg.fill('[name=brand]','Elle marka')
 assert not pg.locator('[data-part-field=brand]').is_checked()
 pg.click('[data-part-apply]');assert pg.input_value('[name=brand]')=='Elle marka'
 assert pg.input_value('[name=serial_numbers]')=='TEST-A1\nTEST-A2' and pg.input_value('[name=date]')=='2026-09-07'
 assert pg.input_value('[name=quantity]')=='2' and pg.input_value('[name=vehicle_id]')==vid
 assert pg.input_value('[name=cost_mode]')=='tracking' and state()==before
 # Re-read uses original >1600px image, preserves both the original file and user's field edits.
 pg.click('[data-part-read]');pg.wait_for_function('()=>!document.querySelector("[data-part-read]").disabled')
 assert len(calls)==2
 inline=next(x['inlineData'] for x in calls[-1]['contents'][0]['parts'] if 'inlineData' in x)
 assert Image.open(io.BytesIO(base64.b64decode(inline['data']))).size==(1900,1400)
 assert pg.input_value('[name=brand]')=='Elle marka'
 assert state()==before
 pg.reload();reader_ready();assert len(calls)==2 and pg.input_value('[name=brand]')=='Elle marka'
 assert 'TEST-aku-garanti.png' in pg.inner_text('[data-file-preview]')
 pg.select_option('[name=cost_mode]','new_expense');pg.locator('[data-part-form] [type=submit]').click();pg.wait_for_selector('[data-add-files]')
 first=state();part=first['d']['maintenance_parts'][0];pid=part['id']
 assert part['quantity']==2 and part['total']==6000 and part['brand']=='Elle marka'
 assert len(first['d']['expense_records'])==1 and first['d']['expense_records'][0]['amount']==6000
 assert not first['d']['cash_records'] and not first['d']['bank_movements']
 attachment=pg.evaluate("async()=>{const d=await import('./js/db.js'),a=(await d.getAll('attachments'))[0];return {hash:a.src_sha256,type:a.type,size:a.size,digest:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await a.blob.arrayBuffer()))).map(n=>n.toString(16).padStart(2,'0')).join('')}}")
 assert attachment=={'hash':hashlib.sha256(PNG).hexdigest(),'type':'image/png','size':len(PNG),'digest':hashlib.sha256(PNG).hexdigest()}
 print('PASS assistant photo-only recognizes part warranty, suppresses duplicate expense/vehicle-doc, preserves edits, re-reads at document resolution; reload caches original/results without AI calls; explicit Save creates two batteries, one 6000TL expense and original-byte attachment',flush=True)

 # Read already saved photo + append native PDF; preserve current fields unless explicitly checked.
 pg.click('[data-read-saved-part]');reader_ready();assert pg.input_value('[name=brand]')=='Elle marka'
 assert not pg.locator('[data-part-field=brand]').is_checked()
 pg.set_input_files('[name=documents]',{'name':'TEST-extension.pdf','mimeType':'application/octet-stream','buffer':PDF})
 pg.wait_for_function("()=>document.querySelector('[data-part-form]').dataset.partFilesReady==='1'")
 pg.click('[data-part-read]');pg.wait_for_function('()=>!document.querySelector("[data-part-read]").disabled')
 pdf_card=pg.locator('[data-part-read-result]').filter(has_text='TEST-extension.pdf')
 assert not pdf_card.locator('[data-part-field=warranty_until]').is_checked()
 pdf_card.locator('[data-part-field=warranty_until]').check();pdf_card.locator('[data-part-apply]').click()
 assert pg.input_value('[name=warranty_until]')=='2029-09-07' and pg.input_value('[name=brand]')=='Elle marka'
 pg.locator('[data-part-form] [type=submit]').click();pg.wait_for_selector('[data-add-files]')
 updated=state();assert len(updated['d']['maintenance_parts'])==1 and len(updated['d']['expense_records'])==1 and updated['d']['maintenance_parts'][0]['warranty_until']=='2029-09-07'
 atts=pg.evaluate("async()=> (await (await import('./js/db.js')).getAll('attachments')).map(a=>({hash:a.src_sha256,type:a.type,size:a.size}))")
 assert len(atts)==2 and any(a['type']=='application/pdf' and a['hash']==hashlib.sha256(PDF).hexdigest() and a['size']==len(PDF) for a in atts)
 assert any(any(x.get('inlineData',{}).get('mimeType')=='application/pdf' for x in call['contents'][0]['parts']) for call in calls)
 backup=pg.evaluate("async()=>await (await import('./js/backup.js')).fullBackup(await import('./js/db.js'),{attachments:'base64'})")
 clean=b.new_context();clean.add_init_script("localStorage.setItem('sp_role','boss')");copy=clean.new_page();copy.goto(U+'index.html#/daha');copy.wait_for_selector('#screen[data-view-ready="1"]')
 restored=copy.evaluate("""async backup=>{const d=await import('./js/db.js'),B=await import('./js/backup.js');await B.restoreBackup(d,backup,true);return {parts:(await d.listActive('maintenance_parts')).length,files:(await d.getAll('attachments')).map(a=>({hash:a.src_sha256,type:a.type})),expenses:(await d.listActive('expense_records')).length}}""",backup)
 assert restored['parts']==1 and restored['expenses']==1 and {x['hash'] for x in restored['files']}=={hashlib.sha256(PNG).hexdigest(),hashlib.sha256(PDF).hexdigest()},restored
 clean.close()
 print('PASS saved-part re-read + octet-stream PDF: native PDF bytes, explicit warranty conflict selection, same part/expense, no duplicate original image',flush=True)

 # A legacy model may only return photo_texts and a wrong vehicle document.
 pg.goto(U+'index.html#/akilli-asistan');ready();mode='legacy';n=len(calls)
 pg.set_input_files('[data-photos]',{'name':'legacy.png','mimeType':'image/png','buffer':PNG});pg.click('[data-ask]');pg.wait_for_selector('[data-part-document-card]')
 assert not pg.locator('[data-kind=expense]').count() and not pg.locator('[data-kind=doc]').count()
 pg.click('[data-part-document-open]');reader_ready();assert len(calls)==n+2 and state()==updated
 assert 'TEST-A1' in pg.inner_text('[data-part-reader]')
 print('PASS older model format is rescued from its own photo text, re-read in the dedicated reader and never misfiled as a vehicle document or expense',flush=True)

 # Duplicate upload can't silently create a second part; missing text remains visible and unchecked.
 pg.goto(U+'index.html#/akilli-asistan');ready();pg.set_input_files('[data-photos]',{'name':'again.png','mimeType':'image/png','buffer':PNG});pg.fill('[data-msg]','Akü garanti belgesini oku');mode='no_text';pg.click('[data-ask]');reader_ready()
 assert 'Ham belge metni' in pg.inner_text('[data-part-reader]')
 assert 'TEST-A1' in pg.inner_text('[data-part-reader]') and not pg.locator('[data-part-field=serial_numbers]').is_checked()
 assert pg.input_value('[name=date]')=='' and pg.input_value('[name=quantity]')==''
 assert pg.locator('[data-shared-parts]').get_by_text('Bu belge mevcut',exact=False).count()
 mode='normal';pg.click('[data-part-read]');pg.wait_for_function('()=>!document.querySelector("[data-part-read]").disabled');pg.click('[data-part-apply]')
 pg.locator('[data-part-form] [type=submit]').click();pg.wait_for_function('()=>document.querySelector("[data-part-error]").textContent.includes("zaten var")')
 assert state()==updated
 # Invalid appended file leaves the two good source files/draft intact.
 pg.set_input_files('[name=documents]',{'name':'bad.pdf','mimeType':'application/pdf','buffer':b'<html>not a PDF</html>'})
 pg.wait_for_function('()=>document.querySelector("[data-part-error]").textContent.includes("JPEG")')
 assert 'again.png' in pg.inner_text('[data-file-preview]') and 'bad.pdf' not in pg.inner_text('[data-file-preview]')
 assert state()==updated
 print('PASS explicit photo intent routes directly to parts; missing raw OCR retains unchecked values; dates/quantity not guessed; duplicate source blocked; malformed append preserves valid files and business records',flush=True)
 # Consent loss and cancellation are bounded and never write business records.
 pg.evaluate("async()=>await (await import('./js/db.js')).metaSet('gemini_consent',false)");n=len(calls);pg.click('[data-part-read]');pg.wait_for_function('()=>!document.querySelector("[data-part-read]").disabled');assert len(calls)==n
 assert state()==updated and 'Gemini' in pg.inner_text('[data-part-reader]')
 pg.evaluate("async()=>await (await import('./js/db.js')).metaSet('gemini_consent',true)");mode='hold';pg.click('[data-part-read]');pg.wait_for_function('()=>!document.querySelector("[data-part-cancel]").hidden');pg.click('[data-part-cancel]');pg.wait_for_function('()=>!document.querySelector("[data-part-read]").disabled')
 for route in held:
  try:route.abort()
  except Exception:pass
 c.unroute_all(behavior='wait')
 assert state()==updated
 for width in [320,390,768]:pg.set_viewport_size({'width':width,'height':850});assert pg.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),width
 pg.screenshot(path='/tmp/solo-v3966-document-review.png')
 assert not errors,errors
 b.close()
print('part_documents browser PASS',flush=True)
