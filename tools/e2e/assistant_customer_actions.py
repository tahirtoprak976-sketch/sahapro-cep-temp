"""Model action path still uses actual validated UI and atomic customer storage; model is deterministic mock."""
import json,sys
from playwright.sync_api import sync_playwright
U=sys.argv[1] if len(sys.argv)>1 else 'http://localhost:8841/'
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 c=b.new_context(viewport={'width':360,'height':850});c.add_init_script("localStorage.setItem('sp_role','boss')")
 errors=[];calls=[]
 def mock(r):
  calls.append(r.request.post_data)
  plan={'actions':[{'op':'create','store':'customers','fields':{'name':'MODEL Gürçelik Sürücü Kursu','phone':'05321112233','note':'Onaylı müşteri'},'reason':'Yeni müşteri istendi'}]}
  r.fulfill(status=200,content_type='application/json',body=json.dumps({'candidates':[{'content':{'parts':[{'text':json.dumps(plan)}]},'finishReason':'STOP'}]}))
 c.route('https://generativelanguage.googleapis.com/**',mock)
 pg=c.new_page();pg.on('pageerror',lambda e:errors.append(str(e)))
 pg.goto(U+'index.html#/musteriler');pg.wait_for_selector('[data-customer-directory]')
 pg.evaluate("""async()=>{const db=await import('./js/db.js');for(const [k,v] of Object.entries({gemini_key:'TEST',gemini_model:'gemini-2.5-flash',gemini_consent:true,gemini_daily_limit:100}))await db.metaSet(k,v)}""")
 def state():return pg.evaluate("async()=>await (await import('./js/db.js')).dumpAll()")
 before=state();tabs=[pg,c.new_page()]
 for tab in tabs:
  tab.goto(U+'index.html#/akilli-asistan');tab.wait_for_function("()=>document.querySelector('[data-new-chat]')&&!document.querySelector('[data-new-chat]').disabled")
  tab.fill('[data-msg]','MODEL Gürçelik Sürücü Kursu müşteri kartını aç, telefonu 05321112233 olsun');tab.click('[data-ask]');tab.wait_for_selector('[data-kind=action]');tab.wait_for_function("()=>!document.querySelector('[data-ask]').disabled")
  assert tab.locator('[data-kind=action] [data-pick]').is_checked()
 assert state()==before and len(calls)==2
 for tab in tabs:
  tab.click('[data-save]');tab.locator('[data-out]').get_by_text('Kaydedildi:',exact=False).wait_for()
 after=state();rows=[x for x in after['customers'] if x['name']=='MODEL Gürçelik Sürücü Kursu'];assert len(rows)==1 and rows[0]['phone']=='05321112233' and rows[0]['note']=='Onaylı müşteri'
 assert len([x for x in after['audit_log'] if x.get('entity_id')==rows[0]['id']])==1
 assert 'zaten yazılmıştı' in tabs[1].locator('[data-out]').inner_text()
 for s in before:
  if s not in ['customers','audit_log']:assert after[s]==before[s],s
 assert not errors,errors
 print('PASS mocked model action validates source name/phone; previews write nothing; two stale UI approvals use one atomic customer+audit, preserve note and report reuse; no financial writes',flush=True)
 c.close();b.close()
