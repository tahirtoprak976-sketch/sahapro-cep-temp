"""21+ work plans, native persistence, photos and no silent tail loss; TEST only."""
import argparse,json,uuid,io
from datetime import date,timedelta
from pathlib import Path
from urllib.parse import urlparse
from PIL import Image
from playwright.sync_api import sync_playwright
ap=argparse.ArgumentParser();ap.add_argument('url',nargs='?',default='http://localhost:8841/');ap.add_argument('--baseline-proof',action='store_true');ap.add_argument('--artifacts',default='/tmp/solo-large98');a=ap.parse_args()
BASE=a.url.rstrip('/')+'/';assert urlparse(BASE).hostname in ('localhost','127.0.0.1');OUT=Path(a.artifacts);OUT.mkdir(parents=True,exist_ok=True)
with sync_playwright() as w:
 b=w.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);c=b.new_context(viewport={'width':390,'height':850});c.add_init_script("localStorage.setItem('sp_role','boss')");p=c.new_page();errors=[];p.on('pageerror',lambda e:errors.append(str(e)));reply={};finish='STOP';requests=[];native=True
 def route(r):
  if r.request.url.startswith('https://generativelanguage.googleapis.com/'):
   requests.append(r.request.post_data_json);parts=[{'functionCall':{'name':'prepare_plan','args':{'goal':'TEST toplu işler','plan_json':json.dumps(reply)}}}] if native else [{'text':json.dumps(reply)}];r.fulfill(status=200,content_type='application/json',body=json.dumps({'candidates':[{'content':{'parts':parts},'finishReason':finish}]}))
  elif urlparse(r.request.url).hostname in ('localhost','127.0.0.1'):r.continue_()
  else:r.abort()
 c.route('**/*',route)
 def new_app():return BASE+'index.html?db=large98_'+uuid.uuid4().hex[:15]
 app=new_app()
 def view(h):p.goto(app+h);p.wait_for_selector('#screen[data-view-ready="1"]')
 def snap():return p.evaluate("async()=>await(await import('./js/db.js')).dumpAll()")
 def seed():
  view('#/daha')
  return p.evaluate("""async()=>{const d=await import('./js/db.js'),c=await d.saveNew('customers',{name:'TEST Alfa'},'TEST'),v=await d.saveNew('vehicles',{name:'TEST JCB',type:'JCB'},'TEST');await d.saveNew('price_book',{customer_id:c.id,vehicle_id:v.id,work_type:'Makine Çalışması',unit:'Saat',price:9000,kdv_rate:20,kdv_included:false,active:true},'TEST');await d.saveNew('fuel_tank_movements',{date:'2026-07-01',move_type:'GİRİŞ',liters:100,total:5000},'TEST');for(const[k,v]of Object.entries({gemini_key:'TEST',gemini_model:'gemini-2.5-flash',gemini_consent:true,gemini_daily_limit:1000}))await d.metaSet(k,v);return {c:c.id,v:v.id};}""")
 def proposal(n,ids,long=False):
  start=date(2026,11,1)-timedelta(days=n-1);works=[];lines=['Fiyatlar beklesin.']
  for i in range(n):
   day=start+timedelta(days=i);q=f'[{day:%d/%m/%Y} 18:00] TEST Şoför: TEST Alfa TEST JCB 1 saat çalıştı; iş sıra {i+1}.';lines.append(q)
   works.append({'date':day.isoformat(),'date_source':'whatsapp','customer_id':ids['c'],'vehicle_id':ids['v'],'work_type':'Makine Çalışması','unit':'Saat','quantity':1,'quote':q,'description':q+(' TEST açıklama'*90 if long else '')+f' TAIL{i+1}'})
  return {'works':works},'\n'.join(lines)
 def send(text):p.fill('[data-msg]',text);p.click('[data-ask]');p.wait_for_function("()=>!document.querySelector('[data-ask]').disabled",timeout=60000)
 if not a.baseline_proof:
  ids=seed();reply,message=proposal(100,ids);view('#/akilli-asistan');before=snap();send(message);p.wait_for_selector('[data-kind=work]');assert p.locator('[data-kind=work]').count()==100
  assert '100 iş satırının tamamı' in p.locator('[data-large-review-count]').inner_text();assert snap()==before
  task=p.evaluate("async()=>await(await import('./js/assistant-task.js')).readTask(await import('./js/db.js'))");assert len(task['plan']['works'])==100 and task['plan']['works'][99]['description'].endswith('TAIL100')
  # A reload retains the full native proposal. The model is not needed to inspect it.
  p.reload();p.wait_for_selector('#screen[data-view-ready="1"]');task2=p.evaluate("async()=>await(await import('./js/assistant-task.js')).readTask(await import('./js/db.js'))");assert task2['id']==task['id'] and len(task2['plan']['works'])==100
  send(message);p.wait_for_selector('[data-kind=work]');p.locator('[data-bulk-start]').click();p.wait_for_selector('[data-bulk-row]');assert p.locator('[data-bulk-row]').count()==100;assert '100 hazır' in p.locator('[data-bulk-counts]').inner_text()
  assert snap()==before;p.screenshot(path=str(OUT/'hundred-ready.png'),full_page=True);p.click('[data-bulk-save]');p.wait_for_selector('[data-bulk-receipt]');assert '100 kayıt kaydedildi' in p.locator('[data-bulk-receipt]').inner_text()
  saved=snap();works=[r for r in saved['work_records'] if r.get('customer_id')==ids['c'] and not r.get('deleted_at')];assert len(works)==100 and all(r.get('price_snapshot') is None for r in works)
  assert any('TAIL100' in r.get('description','') for r in works);assert sum(r['quantity'] for r in works)==100
  assert saved['fuel_records']==before['fuel_records'] and saved['expense_records']==before['expense_records']
  p.click('[data-bulk-undo]');p.wait_for_function("()=>document.querySelector('[data-bulk-review]')?.textContent.includes('Son toplu kayıt geri alındı.')");assert len([r for r in snap()['work_records'] if r.get('customer_id')==ids['c'] and not r.get('deleted_at')])==0
  print('PASS large batch98 native100: full task reload,100 ready,atomic100 save including final row,price hold,exact Undo',flush=True)
 # Mixed free text and two photos reproduces the reported 20-work stop.
 native=False;app=new_app();ids=seed();reply,message=proposal(25,ids,long=True);message+='\n[01/11/2026 19:45] TEST Şoför: TEST JCB depodan 38 litre mazot aldı.\nİşletme için 250 TL gider ve 300 TL gider yapıldı.'
 reply.update({'fuel':[{'date':'2026-11-01','vehicle_id':ids['v'],'liters':38,'source':'Depo Tankı','photo':1}], 'expenses':[{'date':'2026-11-01','category':'Diğer','amount':250,'photo':0,'note':'TEST gider a'},{'date':'2026-11-01','category':'Diğer','amount':300,'photo':1,'note':'TEST gider b'}], 'photo_texts':['İşletme gideri 250 TL 01.11.2026','İşletme gideri 300 TL 01.11.2026 TEST JCB Depo Tankı 38 litre']})
 good=json.loads(json.dumps(reply));view('#/akilli-asistan');files=[]
 for name,color in [('TEST-large-a.png',(20,130,30)),('TEST-large-b.png',(25,55,200))]:
  buff=io.BytesIO();Image.new('RGB',(120,100),color).save(buff,format='PNG');files.append({'name':name,'mimeType':'image/png','buffer':buff.getvalue()})
 p.set_input_files('[data-photos]',files);p.wait_for_selector('[data-thumbs] img');p.wait_for_function("()=>document.querySelectorAll('[data-thumbs] img').length===2");before=snap();send(message)
 if a.baseline_proof:
  assert 'en fazla 20 iş satırı' in p.locator('[data-assistant-request-error]').inner_text();assert p.input_value('[data-msg]')==message;assert p.locator('[data-thumbs] img').count()==2 and snap()==before
  p.screenshot(path=str(OUT/'baseline-20-stop.png'),full_page=True);print('BASELINE PROOF v3.9.97: 25 works + fuel + two photos rejected at20; no records written, original message/photos retained',flush=True);c.close();b.close();raise SystemExit(0)
 assert p.locator('[data-kind=work]').count()==25 and p.locator('[data-kind=fuel]').count()==1 and p.locator('[data-kind=expense]').count()==2;assert snap()==before
 # Force a model re-read, and prove the previous plan isn't cut at20000 chars.
 assert len(json.dumps(good,ensure_ascii=False))>20000
 p.locator('[data-refine]').locator('xpath=ancestor::details[1]').locator('summary').first.click();p.locator('[data-refine]').check();send('Bütün listeyi aynen tekrar kontrol et; son satırı koru.')
 contexts=[part['text'] for req in requests for content in req.get('contents',[]) for part in content.get('parts',[]) if 'ÖNCEKİ TASLAK' in part.get('text','')];assert contexts and 'TAIL25' in contexts[-1]
 previous=json.loads(contexts[-1].split('\n',1)[1]);assert len(previous['works'])==25 and previous['works'][24]['description'].endswith('TAIL25')
 assert p.locator('[data-kind=work]').count()==25 and p.locator('[data-thumbs] img').count()==2 and snap()==before
 # Over limit and token truncation both fail closed, keeping old cards and files.
 p.locator('[data-refine]').uncheck();reply={'works':[{} for _ in range(101)]};send('TEST yeni aşırı liste');assert '100 iş' in p.locator('[data-assistant-request-error]').inner_text();assert p.locator('[data-kind=work]').count()==25 and p.locator('[data-thumbs] img').count()==2 and snap()==before
 reply=good;finish='MAX_TOKENS';send(message);assert p.locator('[data-assistant-request-error]').count()==1 and snap()==before and p.locator('[data-thumbs] img').count()==2
 finish='STOP';send(message);assert p.locator('[data-kind=work]').count()==25
 # Explicitly review valid proposal rows; no model call authorizes a write.
 p.click('[data-batch-ready]');p.locator('[data-kind=fuel] [data-pick]').check();p.locator('[data-kind=expense] [data-pick]').nth(0).check();p.locator('[data-kind=expense] [data-pick]').nth(1).check()
 p.screenshot(path=str(OUT/'mixed-25-preview.png'),full_page=True);assert snap()==before;p.click('[data-save]');p.wait_for_selector('.assistant-receipt');after=snap()
 works=[r for r in after['work_records'] if r.get('customer_id')==ids['c'] and not r.get('deleted_at')];assert len(works)==25,{'count':len(works),'dates':[r['date'] for r in works]};assert any(r['date']=='2026-11-01' for r in works),'final business row missing';assert all(r.get('price_snapshot') is None for r in works),[r.get('price_snapshot') for r in works]
 assert len(after['fuel_records'])==1 and after['fuel_records'][0]['liters']==38;assert sum((1 if r['move_type']=='GİRİŞ' else -1)*r['liters'] for r in after['fuel_tank_movements'] if not r.get('deleted_at'))==62;assert sorted(r['amount'] for r in after['expense_records'])==[250,300]
 associations=p.evaluate("""async()=>{const d=await import('./js/db.js'),expenses=await d.getAll('expense_records'),fuel=(await d.getAll('fuel_records'))[0],rows=[];for(const e of expenses)rows.push({amount:e.amount,names:(await d.attachmentsFor('expense',e.id)).map(x=>x.name)});return {expenses:rows,fuel:(await d.attachmentsFor('fuel',fuel.id)).map(x=>x.name)};}""")
 assert len(associations['fuel'])==1 and '-b' in associations['fuel'][0],associations
 for e in associations['expenses']:assert len(e['names'])==1 and ('-a' if e['amount']==250 else '-b') in e['names'][0],associations
 assert p.locator('[data-saved-record]').count()==28 and p.locator('[data-receipt-more]').count()==1
 p.locator('[data-receipt-more] summary').click();assert p.locator('[data-receipt-more] [data-saved-record]').count()==8
 assert not errors,errors
 (OUT/'results.json').write_text(json.dumps({'native_work_count':100,'mixed_works':25,'mixed_fuel_liters':38,'expenses':[250,300],'receipt_links':28,'photo_mapping':associations,'errors':errors},indent=2));print('PASS large batch98 mixed25: fuel+two photos; complete correction JSON;101/MAX_TOKENS reject with cards/text/files preserved;all25 jobs saved incl final,prices held,photo associations correct,all28 receipt links visible',flush=True);c.close();b.close()
