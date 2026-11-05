"""Pseudonymized owner corpus; fake provider only; no writes before Save."""
import json,uuid,subprocess,sys
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[2];base=(sys.argv[1] if len(sys.argv)>1 else 'http://localhost:8841/').rstrip('/')+'/'
assert urlparse(base).hostname in ('localhost','127.0.0.1')
fixture=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import {fixture} from './tests/assistant-gold/real-messages/fixture.mjs';console.log(JSON.stringify(fixture()))"],cwd=root))
settings=json.loads(subprocess.check_output(['node','--input-type=module','-e',"import {fixtureSettings} from './tests/assistant-gold/real-messages/fixture.mjs';console.log(JSON.stringify(fixtureSettings()))"],cwd=root))
source=json.loads((root/'tests/assistant-gold/real-messages/source.json').read_text());recorded=json.loads((root/'tests/assistant-gold/real-messages/recorded-v3.10.00.json').read_text())['responses']
extra=[{'id':'invalid-date','header':'[04/11/2026 18:00] Sinan Abi','message':'31.02.2026 Lena 2 saat cam verildi'},{'id':'relative-day','header':'[04/11/2026 18:00] Sinan Abi','message':'Dün Lena 2 saat cam verildi'}]
for case in extra:
 recorded[case['id']]={'works':[{'date':'2026-11-04','customer_id':next(c['id'] for c in fixture['customers'] if c['name']=='Lena'),'vehicle_id':next(v['id'] for v in fixture['vehicles'] if v['name']=='Manitou'),'quantity':2,'unit':'Saat','work_type':'Manitou Çalışması','quote':case['message']}],'fuel':[]}
source['cases'].extend(extra)
with sync_playwright() as w:
 browser=w.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 for case_id in ['r10','r19','r00_tumu','invalid-date','relative-day']:
  case=next(c for c in source['cases'] if c['id']==case_id);text=(case.get('header','')+': ' if case.get('header') else '')+case['message']
  context=browser.new_context(viewport={'width':390,'height':850});context.add_init_script("localStorage.setItem('sp_role','boss')");page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  def route(r):
   if r.request.url.startswith('https://generativelanguage.googleapis.com/'):
    r.fulfill(status=200,content_type='application/json',body=json.dumps({'candidates':[{'content':{'parts':[{'functionCall':{'name':'prepare_plan','args':{'goal':'TEST real corpus','plan_json':json.dumps(recorded[case_id])}}}]},'finishReason':'STOP'}]}))
   elif urlparse(r.request.url).hostname in ('localhost','127.0.0.1'):r.continue_()
   else:r.abort()
  context.route('**/*',route);app=base+'index.html?db=TEST_real101_'+uuid.uuid4().hex[:12];page.goto(app+'#/daha');page.wait_for_selector('#screen[data-view-ready="1"]')
  page.evaluate("""async d=>{const db=await import('./js/db.js');for(const [k,rows]of Object.entries(d))for(const r of rows)await db.put(k,r);for(const[k,v]of Object.entries({gemini_key:'TEST',gemini_model:'TEST_MODEL',gemini_consent:true,gemini_daily_limit:10}))await db.metaSet(k,v);}""",fixture)
  page.evaluate("async settings=>{const db=await import('./js/db.js');for(const[k,v]of Object.entries(settings))await db.metaSet(k,v);}",settings)
  page.goto(app+'#/akilli-asistan');page.wait_for_selector('#screen[data-view-ready="1"]');before=page.evaluate("async()=>await(await import('./js/db.js')).dumpAll()")
  page.fill('[data-msg]',text);page.click('[data-ask]');page.wait_for_function("()=>!document.querySelector('[data-ask]').disabled",timeout=90000);page.wait_for_selector('[data-review-overview]')
  box=page.locator('[data-review-questions]');assert box.count()==1 and box.locator('[data-question]').count()<=3
  assert box.evaluate("e=>{const cards=[...document.querySelectorAll('.assistant-record')];return cards.every(c=>!!(c.compareDocumentPosition(e)&Node.DOCUMENT_POSITION_FOLLOWING));}")
  if case_id=='r10':
   assert page.locator('[data-kind=work]').count()==2
   first=page.locator('[data-kind=work][data-i="0"]');second=page.locator('[data-kind=work][data-i="1"]');first.locator('[data-record-details]').evaluate('e=>e.open=true');first.locator('[name=description]').fill('TEST preserve manual edit');before_first=first.locator('[name=customer]').input_value()
   q=box.locator('[data-question]').filter(has_text='Miktar');assert q.count()==1;q.locator('input').fill('2');q.locator('[data-answer]').click()
   observed={'quantity':second.locator('[name=quantity]').input_value(),'checked':second.locator('[data-pick]').is_checked(),'errors':errors,'questions':box.inner_text()}
   if observed['quantity']!='2' or observed['checked']:
    Path('/tmp/solo-questions101').mkdir(exist_ok=True);page.screenshot(path='/tmp/solo-questions101/failed-answer.png',full_page=True);Path('/tmp/solo-questions101/failed-answer.json').write_text(json.dumps(observed,ensure_ascii=False,indent=2));print(json.dumps(observed,ensure_ascii=False),flush=True)
   assert second.locator('[name=quantity]').input_value()=='2' and not second.locator('[data-pick]').is_checked()
   assert first.locator('[name=description]').input_value()=='TEST preserve manual edit' and first.locator('[name=customer]').input_value()==before_first
  if case_id=='r19':
   assert page.locator('[data-kind=fuel] [name=liters]').input_value()=='3'
   assert page.locator('[data-kind=fuel] [name=vehicle]').input_value()=='' and not page.locator('[data-kind=fuel] [data-pick]').is_checked()
   assert box.inner_text().count('1tonluk makine — Hangi araç?')==1
  if case_id in ['invalid-date','relative-day']:
   card=page.locator('[data-kind=work][data-i="0"]');assert not card.locator('[data-pick]').is_checked();assert box.locator('[data-question="work:0:date"]').count()==1
   if case_id=='invalid-date':
    assert card.locator('[data-field-confidence=date]').get_attribute('data-level')=='BILINMIYOR'
    q=box.locator('[data-question="work:0:date"]');q.locator('input').fill('2026-02-28');q.locator('[data-answer]').click();assert card.locator('[name=date]').input_value()=='2026-02-28' and not card.locator('[data-pick]').is_checked()
   else:assert card.locator('[name=date]').input_value()=='2026-11-03'
  if case_id=='r00_tumu':assert page.locator('.assistant-record').count()==38
  assert page.evaluate("async()=>await(await import('./js/db.js')).dumpAll()") == before
  assert not errors,errors
  context.close();print('PASS',case_id,flush=True)
 context=browser.new_context();context.add_init_script("localStorage.setItem('sp_role','boss')");page=context.new_page()
 app=base+'index.html?db=TEST_settings102_'+uuid.uuid4().hex[:12]
 page.goto(app+'#/ayarlar');page.wait_for_selector('[data-assistant-business]')
 page.evaluate("""async()=>{const db=await import('./js/db.js');await db.put('personnel',{id:'TEST_BOSS',name:'TEST Owner'});await db.metaSet('assistant_rules','TEST preserved freeform');}""")
 personnel_before=page.evaluate("async()=>await(await import('./js/db.js')).listActive('personnel')")
 page.reload();page.wait_for_selector('[data-assistant-business]');form=page.locator('[data-assistant-business]')
 form.locator('[name=yard_is_own]').check();form.locator('[name=sunday_personnel_note]').check();form.locator('[name=boss_personnel_id]').select_option('TEST_BOSS');form.locator('button').click()
 page.wait_for_function("async()=>String(await(await import('./js/db.js')).metaGet('assistant_rules')).includes('@saha-rule yard_is_own=true')")
 page.reload();page.wait_for_selector('[data-assistant-business]');form=page.locator('[data-assistant-business]')
 assert form.locator('[name=yard_is_own]').is_checked() and form.locator('[name=sunday_personnel_note]').is_checked()
 assert form.locator('[name=boss_personnel_id]').input_value()=='TEST_BOSS'
 form.locator('[name=yard_is_own]').uncheck();form.locator('[name=sunday_personnel_note]').uncheck();form.locator('[name=boss_personnel_id]').select_option('');form.locator('button').click()
 page.wait_for_function("async()=>String(await(await import('./js/db.js')).metaGet('assistant_rules')).includes('@saha-rule yard_is_own=false')")
 saved=page.evaluate("async()=>await(await import('./js/db.js')).metaGet('assistant_rules')")
 assert 'TEST preserved freeform' in saved
 assert page.evaluate("async()=>await(await import('./js/db.js')).listActive('personnel')")==personnel_before
 context.close();print('PASS editable business settings and freeform preservation',flush=True)
 browser.close()
