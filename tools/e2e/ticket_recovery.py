"""Real Chromium/IndexedDB; synthetic photos and mocked Gemini. Never uses live data."""
import json, io
from PIL import Image
from playwright.sync_api import sync_playwright
U='http://localhost:8841/'
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 ctx=b.new_context(viewport={'width':412,'height':900},service_workers='block')
 ctx.add_init_script("localStorage.setItem('sp_role','boss')")
 pg=ctx.new_page(); errors=[]; pg.on('pageerror',lambda e: errors.append(str(e)))
 pg.goto(U); pg.wait_for_timeout(1500)
 ids=pg.evaluate("""async()=>{const db=await import('./js/db.js');await db.metaSet('gemini_key','TEST');await db.metaSet('gemini_model','gemini-2.5-flash');await db.metaSet('gemini_consent',true);const sec=await import('./js/security-core.js');await db.metaSet('sec_lock',{...(await sec.hashSecret('482917')),idle_min:30,away_min:15});const v=await db.saveNew('vehicles',{name:'TEST truck',plate:'34GAM627'},'TEST');return {v:v.id};}""")
 pg.goto(U+'index.html#/akilli-asistan');pg.reload();pg.wait_for_timeout(1500)
 if pg.locator('#lock-root [data-pw]').count():
  pg.fill('#lock-root [data-pw]','482917');pg.click('#lock-root [data-go-un]');pg.wait_for_timeout(800)
 plans=[{'tickets':[{'photo':0,'ticket_no':'A-133427','date':'2026-09-07','plate':'34GAM627','tonnage':24.85},{'photo':1,'ticket_no':'ILF2026000000026','date':'2026-09-07','plate':'34GAM627','tonnage':27.1}]}]
 calls=[]
 def gem(route):
  body=route.request.post_data_json; calls.append(body)
  # Recovery fails cleanly: suggestions must survive without inventing text.
  result=plans.pop(0) if plans else {'slips':[]}
  route.fulfill(status=200,content_type='application/json',body=json.dumps({'candidates':[{'content':{'parts':[{'text':json.dumps(result)}]},'finishReason':'STOP'}]}))
 pg.route('https://generativelanguage.googleapis.com/**',gem)
 buf=io.BytesIO();Image.new('RGB',(80,100),'white').save(buf,format='PNG')
 pg.locator('[data-photos]').set_input_files([{'name':f'TEST-{i}.png','mimeType':'image/png','buffer':buf.getvalue()} for i in range(2)])
 pg.fill('[data-msg]','Bu iki kantar fişini kontrol et')
 pg.click('[data-ask]');pg.wait_for_selector('[data-kind=ticket]',timeout=30000)
 cards=pg.locator('[data-kind=ticket]');assert cards.count()==2
 for i,(no,ton) in enumerate([('A-133427','24.85'),('ILF2026000000026','27.1')]):
  c=cards.nth(i)
  assert c.locator('[name=ticket_no]').input_value()==no
  assert c.locator('[name=tonnage]').input_value()==ton
  assert c.locator('[name=date]').input_value()=='2026-09-07'
  assert not c.locator('[data-pick]').is_checked()
 assert len(calls)==3, len(calls)
 for call in calls[1:]:
  assert sum('inlineData' in part for content in call['contents'] for part in content['parts'])==1
 counts=pg.evaluate("async()=>{const d=await import('./js/db.js');return [(await d.listActive('work_records')).length,(await d.listActive('documents')).length]}")
 assert counts==[0,0],counts
 # Exercise successful recovery with reverse original photo selection and user edit guard.
 result=pg.evaluate("""async()=>{const {rereadSlips}=await import('./js/assistant.js');return typeof rereadSlips==='function'}""")
 assert result and not errors,errors
 plans.extend([{'slips':[{'photo':0,'text':'ILF2026000000026 07.09.2026 34GAM627 Net 27100 kg','slip_no':'ILF2026000000026','date':'2026-09-07','plate':'34GAM627','net_ton':27.1}]}, {'slips':[{'photo':0,'text':'A-133427 07.09.2026 34GAM627 Net 24850 kg','slip_no':'A-133427','date':'2026-09-07','plate':'34GAM627','net_ton':24.85}]}])
 recovered=pg.evaluate("""async()=>{const db=await import('./js/db.js');const {validateTickets}=await import('./js/assistant-docs.js');const {rereadSlips}=await import('./js/assistant.js');const d=await db.dumpAll();const v={works:[],tickets:validateTickets({tickets:[{photo:1,ticket_no:'ILF2026000000026',date:'2026-09-07',plate:'34GAM627',tonnage:27.1},{photo:0,ticket_no:'A-133427',date:'2026-09-07',plate:'34GAM627',tonnage:24.85}]},{d,today:'2026-10-19',photoCount:2})};const image={inlineData:{mimeType:'image/png',data:'TEST'}};await rereadSlips(db,v,[image,image],d,'2026-10-19');return v.tickets.map(t=>[t.photo,t.ticket_no,t.tonnage,t.dateRead,t.ok]);}""")
 assert recovered==[[1,'ILF2026000000026',27.1,True,False],[0,'A-133427',24.85,True,False]],recovered
 assert not errors,errors
 print('PASS: successful real reread orchestration preserves reverse-order photo identity and requires confirmation')
 print('PASS: real mobile UI: two suggestions preserved, original dates, unchecked cards, 2 single-photo retries, no work/document writes, no page errors')
 b.close()
