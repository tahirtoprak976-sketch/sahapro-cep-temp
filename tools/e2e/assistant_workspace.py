"""Compact assistant: real keyboard, forms, files, receipts, navigation and IDB. TEST only."""
import argparse,json,uuid
from pathlib import Path
from datetime import datetime,timezone
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright
ap=argparse.ArgumentParser();ap.add_argument('url',nargs='?',default='http://localhost:8841/');ap.add_argument('--artifacts',default='/tmp/solo-assistant92');a=ap.parse_args()
BASE=a.url.rstrip('/')+'/';assert urlparse(BASE).hostname in ('localhost','127.0.0.1')
OUT=Path(a.artifacts);OUT.mkdir(parents=True,exist_ok=True)
SNAP="""async()=>{const d=await import('./js/db.js');return JSON.stringify({data:await d.dumpAll(),audit:await d.getAll('audit_log'),files:(await d.getAll('attachments')).map(a=>({id:a.id,size:a.size}))});}"""
with sync_playwright() as w:
 b=w.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);c=b.new_context(viewport={'width':390,'height':850},timezone_id='Europe/Istanbul');c.add_init_script("localStorage.setItem('sp_role','boss')")
 errors=[];requests=[]
 def route(r):
  if urlparse(r.request.url).hostname in ('localhost','127.0.0.1'):r.continue_()
  else:requests.append(r.request.url);r.abort()
 c.route('**/*',route);p=c.new_page();p.on('pageerror',lambda e:errors.append(str(e)));p.clock.install(time=datetime(2026,10,31,9,0,tzinfo=timezone.utc))
 app=BASE+'index.html?db=workspace92_'+uuid.uuid4().hex[:14]
 def view(h):p.goto(app+h);p.wait_for_selector('#screen[data-view-ready="1"]')
 def ready():p.wait_for_function("()=>document.querySelector('[data-new-chat]')&&!document.querySelector('[data-new-chat]').disabled")
 def send(t):p.fill('[data-msg]',t);p.click('[data-ask]');p.wait_for_function("()=>!document.querySelector('[data-ask]').disabled")
 view('#/daha');ids=p.evaluate("""async()=>{const d=await import('./js/db.js'),c=await import('./js/core.js');const customer=await d.saveNew('customers',{name:'TEST Kendo92'},'TEST'),v=await d.saveNew('vehicles',{name:'TEST Manitou92',plate:'34TEST92'},'TEST');return {customer:customer.id,vehicle:v.id,date:c.todayStr()};}""");before=p.evaluate(SNAP)
 view('#/akilli-asistan?foto=1');ready();assert p.locator('[data-attach]').evaluate('e=>e===document.activeElement')
 view('#/akilli-asistan');ready();assert p.locator('[data-msg]').count()==1 and not p.locator('[data-assistant-tools]').evaluate('e=>e.open') and not p.locator('[data-history-panel]').evaluate('e=>e.open')
 p.screenshot(path=str(OUT/'welcome-390.png'),full_page=True)
 for width in [320,390,768,1280]:
  p.set_viewport_size({'width':width,'height':850});p.wait_for_function("()=>{const r=document.querySelector('[data-composer]').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight&&r.top>0;}");assert p.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),width
 p.set_viewport_size({'width':390,'height':450});p.wait_for_function("()=>{const r=document.querySelector('[data-composer]').getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;}");p.set_viewport_size({'width':390,'height':850})
 p.click('[data-start-work]');assert p.input_value('[data-msg]')=='Yeni iş kaydı oluştur' and p.locator('[data-kind]').count()==0 and p.evaluate(SNAP)==before
 # Enter remains a newline; Ctrl+Enter explicitly sends a local draft request.
 p.fill('[data-msg]','TEST satır');p.locator('[data-msg]').press('End');p.locator('[data-msg]').press('Enter');assert '\n' in p.input_value('[data-msg]') and p.locator('[data-kind]').count()==0
 p.fill('[data-msg]','Yeni iş kaydı oluştur');p.locator('[data-msg]').press('Control+Enter');p.wait_for_selector('[data-review-overview]');p.wait_for_function("()=>!document.querySelector('[data-ask]').disabled")
 card=p.locator('[data-kind=work]');assert not p.locator('.assistant-review-more').evaluate('e=>e.open') and not card.locator('[data-record-details]').evaluate('e=>e.open') and not card.locator('[data-pick]').is_checked() and p.evaluate(SNAP)==before
 send('Sohbeti buradan sürdürelim');assert p.locator('[data-draft-reply]').is_visible() and 'taslağınız korunuyor' in p.locator('[data-draft-reply]').inner_text()
 for t in ['Bugün','TEST Kendo92','34TEST92','Makine Çalışması','2 saat']:send(t)
 p.click('[data-batch-prices]');assert 'Fiyat bekliyor' in card.locator('[data-record-summary]').inner_text() and p.evaluate(SNAP)==before
 p.click('[data-review-expand]');assert card.locator('[data-record-details]').evaluate('e=>e.open')
 card.locator('[name=description]').fill('TEST yalnız bu kaydın açıklaması');send('3 saat');assert card.locator('[name=description]').input_value()=='TEST yalnız bu kaydın açıklaması' and '3 Saat' in card.locator('[data-record-summary]').inner_text()
 # Actual collapse preference is persisted; no saved operation is replayed by history.
 p.click('[data-review-expand]');assert not card.locator('[data-record-details]').evaluate('e=>e.open') and p.evaluate("localStorage.getItem('sp_assistant_details_v1')")=='compact'
 p.click('[data-history-open]');assert p.locator('[data-history-panel]').evaluate('e=>e.open') and p.locator('[data-earlier-turns]').evaluate('e=>e.open');assert p.evaluate(SNAP)==before
 p.click('[data-history-open]');card.locator('[data-pick]').check();assert '1 kaydı kaydet' in p.locator('[data-save]').inner_text()
 p.screenshot(path=str(OUT/'compact-work-preview.png'),full_page=True)
 p.locator('[data-save]').evaluate("b=>{b.click();b.dispatchEvent(new MouseEvent('click',{bubbles:true}));}")
 p.wait_for_selector('[data-saved-record]');saved=p.evaluate("async()=>{const d=await import('./js/db.js');return(await d.listActive('work_records')).filter(w=>w.description==='TEST yalnız bu kaydın açıklaması')}");assert len(saved)==1 and saved[0]['quantity']==3 and saved[0]['price_snapshot'] is None and saved[0]['customer_id']==ids['customer'],saved
 p.locator('[data-saved-record="work_records:'+saved[0]['id']+'"]').click();p.wait_for_url('**#/isler/'+saved[0]['id']);after=p.evaluate(SNAP)
 view('#/akilli-asistan');ready();assert p.locator('[data-save]').count()==0 and p.evaluate(SNAP)==after
 # The visible Add picker appends. Same filename with different bytes is retained.
 fixtures=p.evaluate("async()=>{const f=await import('./tests/support/attachment-fixtures.mjs');return {red:Array.from(f.PNG),blue:Array.from(f.PNG_BLUE),pdf:Array.from(f.pdfBytes())};}")
 def add(name,mime,data):
  p.set_input_files('[data-addphotos]',{'name':name,'mimeType':mime,'buffer':bytes(data)});p.wait_for_function("()=>!document.querySelector('[data-addphotos]').disabled")
 add('TEST-same-name.png','image/png',fixtures['red']);p.wait_for_function("()=>document.querySelectorAll('[data-thumbs] img').length===1")
 add('TEST-same-name.png','image/png',fixtures['blue']);p.wait_for_function("()=>document.querySelectorAll('[data-thumbs] img').length===2")
 add('TEST-same-name.png','image/png',fixtures['red']);assert p.locator('[data-thumbs] img').count()==2
 add('TEST-warranty.pdf','application/pdf',fixtures['pdf']);assert p.locator('[data-thumbs] img').count()==2 and 'PDF belgesi' in p.locator('[data-thumbs]').inner_text()
 p.locator('[data-rm]').last.click();assert 'TEST-warranty.pdf' not in p.locator('[data-thumbs]').inner_text();p.locator('[data-rm]').first.click();assert p.locator('[data-thumbs] img').count()==1
 # Quick navigation flushes a just-selected document before the debounce expires.
 p.click('[data-start-compare]');p.wait_for_url('**#/isler/kontrol');view('#/akilli-asistan');ready();p.wait_for_function("()=>document.querySelectorAll('[data-thumbs] img').length===1")
 assert p.evaluate(SNAP)==after
 p.click('[data-clearfiles]');p.wait_for_function("()=>document.querySelectorAll('[data-thumbs] img').length===0")
 p.click('[data-start-claim]');p.wait_for_url('**#/hakedis/hazirlik');view('#/akilli-asistan');ready()
 # Stale transcript and previews aren't approval. Cancellation and offline starter preserve data.
 c.set_offline(True);send('Yeni gider ekle');p.wait_for_selector('[data-kind=expense]');assert not p.locator('[data-kind=expense] [data-record-details]').evaluate('e=>e.open');send('Vazgeç');assert not p.locator('[data-save]').count() and p.evaluate(SNAP)==after;c.set_offline(False)
 # A mock model prepares two cards; the actual local engine must expose its target question.
 p.evaluate("""async()=>{const db=await import('./js/db.js');for(const[k,v]of Object.entries({gemini_key:'TEST',gemini_model:'gemini-2.5-flash',gemini_consent:true,gemini_daily_limit:100}))await db.metaSet(k,v);}""");p.reload();ready();model_calls=[];held=[];mode={'hold':False}
 def model(r):
  model_calls.append(r.request.post_data)
  if mode['hold']:held.append(r);return
  works=[{'date':ids['date'],'customer_id':ids['customer'],'vehicle_id':ids['vehicle'],'work_type':'Makine Çalışması','quantity':n,'unit':'Saat'} for n in [1,2]]
  r.fulfill(status=200,content_type='application/json',body=json.dumps({'candidates':[{'content':{'parts':[{'text':json.dumps({'works':works})}]},'finishReason':'STOP'}]}))
 c.route('https://generativelanguage.googleapis.com/**',model)
 send('TEST Kendo92 TEST Manitou92 bugün 1 saat çalıştı. İkinci iş TEST Kendo92 TEST Manitou92 bugün 2 saat çalıştı.');p.wait_for_selector('[data-kind=work][data-i="1"]');assert p.locator('.assistant-review-more').evaluate('e=>e.open');baseline=p.evaluate(SNAP)
 send('3 sefer');assert p.locator('[data-draft-choice]').count()==2 and p.locator('[data-draft-choice]').first.is_visible();p.locator('[data-draft-choice]').first.click();assert p.evaluate(SNAP)==baseline
 # Reading status and Abort remain visible in the fixed composer, even after a long request.
 mode['hold']=True;p.fill('[data-msg]','TEST müşterisinin gelecek ayki işlerini değerlendir');p.click('[data-ask]');p.wait_for_function("()=>!document.querySelector('[data-read-status]').hidden");p.wait_for_timeout(100);assert p.locator('[data-stop-reading]').is_visible() and p.locator('[data-msg]').is_disabled() and len(held)>=1;p.click('[data-stop-reading]');p.wait_for_function("()=>!document.querySelector('[data-ask]').disabled");assert p.evaluate(SNAP)==baseline
 for pending in held:
  try:pending.abort('aborted')
  except Exception:pass
 p.wait_for_timeout(50);c.unroute('https://generativelanguage.googleapis.com/**',model)
 # Actual router replacement must release microphone tracks, not only innerHTML edits.
 p.evaluate("""async()=>{const db=await import('./js/db.js');await db.metaSet('voice_notice_ok',true);window.__micStopped92=0;navigator.mediaDevices.getUserMedia=async()=>({getTracks:()=>[{stop:()=>window.__micStopped92++}]});window.MediaRecorder=class {static isTypeSupported(){return true}constructor(){this.mimeType='audio/webm';this.state='inactive'}start(){this.state='recording'}stop(){this.state='inactive';this.onstop?.()}};}""")
 p.click('[data-rec]');p.wait_for_function("()=>document.querySelector('[data-rec]').textContent.includes('bitir')");view('#/daha');p.wait_for_function('()=>window.__micStopped92===1');assert p.evaluate(SNAP)==baseline
 view('#/akilli-asistan');ready()
 # Existing readable history is escaped and bounded by the established conversation store.
 p.evaluate("""async()=>{const db=await import('./js/db.js'),C=await import('./js/assistant-conversation.js');const x=await db.metaGet(C.CHAT_KEY);x.turns.push({id:'TEST-escape92',user:'<img src=x onerror=alert(1)>',reply:'TEST',status:'answer',at:new Date().toISOString()});await db.metaSet(C.CHAT_KEY,x);}""");p.reload();ready();assert p.locator('[data-chat-log] img').count()==0 and '<img src=x' in p.locator('[data-chat-log]').inner_text()
 p.screenshot(path=str(OUT/'history-and-composer.png'),full_page=True)
 assert not errors and not requests,(errors,requests)
 report={'isolated_test_data_only':True,'compact_default':True,'single_fixed_composer':True,'keyboard_enter_newline_ctrl_enter_send':True,'conversation_edit_preserves_manual_fields':True,'price_hold_preserved':True,'explicit_save_exactly_one_work':True,'receipt_links_real_record':True,'read_only_history':True,'append_remove_and_exact_dedup':True,'same_name_different_bytes_preserved':True,'pdf_tile':True,'quick_navigation_flushes_files':True,'offline_no_key_drafts':True,'cancel_without_business_write':True,'escaped_history':True,'visible_target_question':True,'visible_abort_without_write':True,'microphone_released_on_router_replacement':True,'widths':[320,390,768,1280],'page_errors':errors,'external_requests':requests};(OUT/'result.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(report));b.close()
print('assistant_workspace browser PASS',flush=True)
