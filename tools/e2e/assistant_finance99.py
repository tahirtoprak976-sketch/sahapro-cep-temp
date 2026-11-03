"""Real UI: price ownership, explicit manual confirmation and parent/subcontractor. TEST IDs only."""
import argparse,json,uuid
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright
ap=argparse.ArgumentParser();ap.add_argument('url',nargs='?',default='http://localhost:8841/');ap.add_argument('--artifacts',default='/tmp/solo-assistant99');a=ap.parse_args()
assert urlparse(a.url).hostname in ('localhost','127.0.0.1')
root=Path(__file__).resolve().parents[2];cards=json.loads((root/'tests/assistant-gold/cards.json').read_text());out=Path(a.artifacts);out.mkdir(parents=True,exist_ok=True)
work={'date':'2026-11-02','customer_id':'TEST_C','vehicle_id':'TEST_V','work_type':'Makine Çalışması','quantity':2,'unit':'Saat','unit_price':2500}
results=[]
with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 for scenario in ['explicit-price','other-customer-price','parent-mismatch']:
  plan={'works':[dict(work)]};message='02.11.2026 Alfa İnşaat JCB 3CX 2 saat çalıştı, saat fiyatı 2500 TL'
  if scenario=='other-customer-price':
   message='02.11.2026 Alfa İnşaat JCB 3CX 2 saat çalıştı; Beta Hafriyat saat fiyatı 2500 TL';plan['works'][0]['quote']='Alfa İnşaat JCB 3CX 2 saat çalıştı'
  if scenario=='parent-mismatch':
   message='02.11.2026 Çatıcı (Ulaş Rondela) JCB 3CX 2 saat çalıştı';plan['works'][0].update(customer_id='TEST_PARENT',unit_price=None)
  ctx=browser.new_context(viewport={'width':390,'height':850});ctx.add_init_script("localStorage.setItem('sp_role','boss')");errors=[];page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
  def route(r):
   if r.request.url.startswith('https://generativelanguage.googleapis.com/'):
    parts=[{'functionCall':{'name':'prepare_plan','args':{'goal':'TEST fiyat güvenliği','plan_json':json.dumps(plan)}}}];r.fulfill(status=200,content_type='application/json',body=json.dumps({'candidates':[{'content':{'parts':parts},'finishReason':'STOP'}]}))
   elif urlparse(r.request.url).hostname in ('localhost','127.0.0.1'):r.continue_()
   else:r.abort()
  ctx.route('**/*',route);app=a.url.rstrip('/')+'/index.html?db=finance99_'+uuid.uuid4().hex[:12]
  page.goto(app+'#/daha');page.wait_for_selector('#screen[data-view-ready="1"]')
  page.evaluate("""async cards=>{const db=await import('./js/db.js');for(const [store,rows]of Object.entries(cards))for(const row of rows)await db.put(store,row);for(const[k,v]of Object.entries({gemini_key:'TEST',gemini_model:'TEST_MODEL',gemini_consent:true,gemini_daily_limit:10,kdv_default:20}))await db.metaSet(k,v);}""",cards)
  def snap():return page.evaluate("async()=>await(await import('./js/db.js')).dumpAll()")
  before=snap();page.goto(app+'#/akilli-asistan');page.wait_for_selector('#screen[data-view-ready="1"]');page.fill('[data-msg]',message);page.click('[data-ask]');page.wait_for_function("()=>!document.querySelector('[data-ask]').disabled",timeout=60000);pick=page.locator('[data-kind=work] [data-pick]');pick.wait_for()
  assert snap()==before
  if scenario=='explicit-price':
   assert pick.is_checked();assert page.input_value('[data-kind=work] [name=unit_price]')=='2500'
  elif scenario=='other-customer-price':
   assert not pick.is_checked();assert page.input_value('[data-kind=work] [name=unit_price]')==''
   question='2.500 TL bu işin birim fiyatı mı?';assert page.locator('[data-out]').inner_text().count(question)==1
   page.click('[data-batch-ready]');assert not pick.is_checked()
   # Explicit selection alone cannot silently save the unresolved price as free/unpriced work.
   pick.check();page.click('[data-save]');page.locator('.toast').get_by_text(question,exact=False).wait_for();assert snap()==before
   # User enters the exact price and confirms only this card. No provider follow-up is needed.
   page.fill('[data-kind=work] [name=unit_price]','2500');pick.check();page.click('[data-save]');page.wait_for_selector('.assistant-receipt')
   saved=[w for w in snap()['work_records'] if w.get('customer_id')=='TEST_C'];assert len(saved)==1 and saved[0]['price_snapshot']['unit_price']==2500 and saved[0]['price_snapshot']['amount']==5000
  else:
   assert not pick.is_checked();assert page.input_value('[data-kind=work] [name=customer]')=='TEST_SUB'
   assert 'alt firma' in page.locator('[data-kind=work]').inner_text();page.click('[data-batch-ready]');assert not pick.is_checked();assert snap()==before
  assert not errors,errors;page.screenshot(path=str(out/(scenario+'.png')),full_page=True);results.append({'scenario':scenario,'passed':True});ctx.close()
 browser.close()
(out/'results.json').write_text(json.dumps(results,indent=2));print(json.dumps(results))
