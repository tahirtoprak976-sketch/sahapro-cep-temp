"""Pseudonymized owner corpus; fake provider only; no writes before Save."""
import json,uuid,subprocess,sys
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[2];base=(sys.argv[1] if len(sys.argv)>1 else 'http://localhost:8841/').rstrip('/')+'/'
assert urlparse(base).hostname in ('localhost','127.0.0.1')
fixture=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import {fixture} from './tests/assistant-gold/real-messages/fixture.mjs';console.log(JSON.stringify(fixture()))"],cwd=root))
source=json.loads((root/'tests/assistant-gold/real-messages/source.json').read_text());recorded=json.loads((root/'tests/assistant-gold/real-messages/recorded-v3.10.00.json').read_text())['responses']
with sync_playwright() as w:
 browser=w.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 for case_id in ['r10','r19','r00_tumu']:
  case=next(c for c in source['cases'] if c['id']==case_id);text=(case.get('header','')+': ' if case.get('header') else '')+case['message']
  context=browser.new_context(viewport={'width':390,'height':850});context.add_init_script("localStorage.setItem('sp_role','boss')");page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  def route(r):
   if r.request.url.startswith('https://generativelanguage.googleapis.com/'):
    r.fulfill(status=200,content_type='application/json',body=json.dumps({'candidates':[{'content':{'parts':[{'functionCall':{'name':'prepare_plan','args':{'goal':'TEST real corpus','plan_json':json.dumps(recorded[case_id])}}}]},'finishReason':'STOP'}]}))
   elif urlparse(r.request.url).hostname in ('localhost','127.0.0.1'):r.continue_()
   else:r.abort()
  context.route('**/*',route);app=base+'index.html?db=TEST_real101_'+uuid.uuid4().hex[:12];page.goto(app+'#/daha');page.wait_for_selector('#screen[data-view-ready="1"]')
  page.evaluate("""async d=>{const db=await import('./js/db.js');for(const [k,rows]of Object.entries(d))for(const r of rows)await db.put(k,r);for(const[k,v]of Object.entries({gemini_key:'TEST',gemini_model:'TEST_MODEL',gemini_consent:true,gemini_daily_limit:10}))await db.metaSet(k,v);}""",fixture)
  page.goto(app+'#/akilli-asistan');page.wait_for_selector('#screen[data-view-ready="1"]');before=page.evaluate("async()=>await(await import('./js/db.js')).dumpAll()")
  page.fill('[data-msg]',text);page.click('[data-ask]');page.wait_for_function("()=>!document.querySelector('[data-ask]').disabled",timeout=90000);page.wait_for_selector('[data-review-overview]')
  box=page.locator('[data-review-questions]');assert box.count()==1 and box.locator('[data-question]').count()<=3
  assert box.evaluate("e=>{const cards=[...document.querySelectorAll('.assistant-record')];return cards.every(c=>!!(c.compareDocumentPosition(e)&Node.DOCUMENT_POSITION_FOLLOWING));}")
  if case_id=='r10':
   assert page.locator('[data-kind=work]').count()==2
   first=page.locator('[data-kind=work][data-i="0"]');second=page.locator('[data-kind=work][data-i="1"]');first.locator('[data-record-details]').evaluate('e=>e.open=true');first.locator('[name=description]').fill('TEST preserve manual edit');before_first=first.locator('[name=customer]').input_value()
   q=box.locator('[data-question]').filter(has_text='Miktar');assert q.count()==1;q.locator('input').fill('2');q.locator('[data-answer]').click()
   assert second.locator('[name=quantity]').input_value()=='2' and not second.locator('[data-pick]').is_checked()
   assert first.locator('[name=description]').input_value()=='TEST preserve manual edit' and first.locator('[name=customer]').input_value()==before_first
  if case_id=='r19':
   assert page.locator('[data-kind=fuel] [name=liters]').input_value()=='3'
   assert page.locator('[data-kind=fuel] [name=vehicle]').input_value()=='' and not page.locator('[data-kind=fuel] [data-pick]').is_checked()
   assert box.inner_text().count('1tonluk makine — Hangi araç?')==1
  if case_id=='r00_tumu':assert page.locator('.assistant-record').count()==38
  assert page.evaluate("async()=>await(await import('./js/db.js')).dumpAll()") == before
  assert not errors,errors
  context.close();print('PASS',case_id,flush=True)
 browser.close()
