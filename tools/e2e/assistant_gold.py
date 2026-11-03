"""Five mandatory unchecked categories, actual assistant UI; synthetic data, no Save."""
import argparse,json,uuid
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright
ap=argparse.ArgumentParser();ap.add_argument('url',nargs='?',default='http://localhost:8841/');ap.add_argument('--artifacts',default='/tmp/assistant-gold-browser');a=ap.parse_args()
assert urlparse(a.url).hostname in ('localhost','127.0.0.1')
root=Path(__file__).resolve().parents[2];cases=json.loads((root/'tests/assistant-gold/cases.json').read_text());cards=json.loads((root/'tests/assistant-gold/cards.json').read_text())
ids=['collection-20bin','staff-cash-delivery','staff-advance','customer-fuel-out','customer-tank-in'];out=Path(a.artifacts);out.mkdir(parents=True,exist_ok=True);results=[]
with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 for id in ids:
  case=next(c for c in cases if c['id']==id);ctx=browser.new_context(viewport={'width':390,'height':850});ctx.add_init_script("localStorage.setItem('sp_role','boss')")
  def route(r):
   if r.request.url.startswith('https://generativelanguage.googleapis.com/'):
    plan=case['recordedResponse'];parts=[{'functionCall':{'name':'prepare_plan','args':{'goal':'TEST sınav','plan_json':json.dumps(plan)}}}]
    r.fulfill(status=200,content_type='application/json',body=json.dumps({'candidates':[{'content':{'parts':parts},'finishReason':'STOP'}]}))
   elif urlparse(r.request.url).hostname in ('localhost','127.0.0.1'):r.continue_()
   else:r.abort()
  ctx.route('**/*',route);page=ctx.new_page();app=a.url.rstrip('/')+'/index.html?db=gold_'+uuid.uuid4().hex[:18]
  page.goto(app+'#/daha');page.wait_for_selector('#screen[data-view-ready="1"]')
  page.evaluate("""async cards=>{const db=await import('./js/db.js');for(const [store,rows]of Object.entries(cards))for(const row of rows)await db.put(store,row);for(const[k,v]of Object.entries({gemini_key:'TEST',gemini_model:'TEST_MODEL',gemini_consent:true,gemini_daily_limit:10}))await db.metaSet(k,v);}""",cards)
  before=page.evaluate("async()=>await(await import('./js/db.js')).dumpAll()")
  page.goto(app+'#/akilli-asistan');page.wait_for_selector('#screen[data-view-ready="1"]');page.fill('[data-msg]',case['message']);page.click('[data-ask]');page.wait_for_function("()=>!document.querySelector('[data-ask]').disabled",timeout=60000)
  kind=case['expectedCards'][0]['kind'];pick=page.locator(f'[data-kind={kind}] [data-pick]');pick.wait_for();selected=pick.is_checked();after=page.evaluate("async()=>await(await import('./js/db.js')).dumpAll()")
  assert before==after,'Preview must not write business records';page.screenshot(path=str(out/(id+'.png')),full_page=True)
  results.append({'id':id,'category':case['expectedCards'][0]['mandatoryUnchecked'],'checked':selected,'businessRecordsUnchanged':True});ctx.close()
 browser.close()
(out/'results.json').write_text(json.dumps(results,indent=2));print(json.dumps(results,indent=2));assert not any(r['checked'] for r in results),'Mandatory unchecked card arrived checked'
