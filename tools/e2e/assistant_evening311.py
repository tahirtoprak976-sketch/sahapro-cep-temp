"""Evening assistant: synthetic phone data, real controls, no provider or saved business rows."""
import json,sys,uuid
from playwright.sync_api import sync_playwright
U=sys.argv[1] if len(sys.argv)>1 else 'http://localhost:8892/'
with sync_playwright() as w:
 b=w.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);c=b.new_context(viewport={'width':360,'height':850},service_workers='block');c.add_init_script("localStorage.setItem('sp_role','boss')");p=c.new_page();errors=[];calls=[];p.on('pageerror',lambda e:errors.append(str(e)));c.route('https://generativelanguage.googleapis.com/**',lambda r:(calls.append(r.request.url),r.abort()))
 p.goto(U+'index.html?db=TEST_evening311_'+uuid.uuid4().hex+'#/akilli-asistan');p.wait_for_function("()=>document.querySelector('[data-msg]')&&!document.querySelector('[data-msg]').readOnly&&!document.querySelector('[data-ask]').disabled")
 assert p.locator('body').evaluate("e=>e.classList.contains('assistant-evening')")
 p.evaluate("""async()=>{const d=await import('./js/db.js');for(const [store,rows]of Object.entries({customers:[{id:'TEST_C1',name:'TEST Koru'},{id:'TEST_C2',name:'TEST Vadi'}],vehicles:[{id:'TEST_V',name:'TEST Kamyon',type:'Kamyon'}]}))for(const r of rows)await d.put(store,r);}""");before=p.evaluate("async()=>await(await import('./js/db.js')).dumpAll()")
 p.click('[data-hub-catalog-open]');p.fill('[data-hub-search]','iş kaydı');p.click('[data-hub-dialog] [data-hub-task=work]');p.wait_for_selector('[data-kind=work]');p.wait_for_function("()=>!document.querySelector('[data-ask]').disabled")
 card=p.locator('[data-kind=work]');card.locator('[data-record-details]').evaluate('(e)=>e.open=true');assert p.locator('[data-daily-coverage]').is_visible();assert 'kayıt görünmüyor' in p.locator('[data-daily-coverage]').inner_text();assert 'hassas kart kaydedilmedi' in p.locator('[data-daily-coverage]').inner_text()
 # Clipboard belongs to the message entry, so it cannot cover attachment removal.
 fixtures=p.evaluate("async()=>{const f=await import('./tests/support/attachment-fixtures.mjs');return {image:Array.from(f.PNG),pdf:Array.from(f.pdfBytes())};}")
 for name,mime,data in [('TEST_photo.png','image/png',fixtures['image']),('TEST_doc.pdf','application/pdf',fixtures['pdf'])]:
  p.locator('[data-addphotos]').set_input_files({'name':name,'mimeType':mime,'buffer':bytes(data)});p.wait_for_function("()=>!document.querySelector('[data-addphotos]').disabled")
 p.wait_for_selector('[data-thumbs] [data-rm]')
 for width in [320,360,390]:
  p.set_viewport_size({'width':width,'height':850});p.locator('[data-rm]').last.scroll_into_view_if_needed();p.wait_for_function("()=>{const b=document.querySelector('[data-clipboard-paste]'),r=b.getBoundingClientRect(),m=document.querySelector('.assistant-message-entry').getBoundingClientRect();return r.top>=m.top&&r.bottom<=m.bottom+1}");assert p.locator('[data-rm]').last.evaluate("e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}")
 p.locator('[data-rm]').last.click();assert 'TEST_doc.pdf' not in p.locator('[data-thumbs]').inner_text();p.locator('[data-rm]').last.click();assert p.locator('[data-thumbs] img').count()==0
 # The targeted question applies one field; undo restores its original blank, without selecting/saving.
 question=p.locator('[data-question]').filter(has_text='Müşteri kim?');assert question.count()==1
 question.locator('[data-answer]').first.click();assert card.locator('[name=customer]').input_value()=='TEST_C1';assert p.locator('[data-draft-undo]').is_visible();assert card.get_attribute('data-question-updated')=='1';p.click('[data-undo-answer]');assert card.locator('[name=customer]').input_value()=='';assert not card.locator('[data-pick]').is_checked()
 # A subsequent manual correction invalidates the older answer's undo token.
 p.locator('[data-question]').filter(has_text='Müşteri kim?').locator('[data-answer]').first.click();card.locator('[name=customer]').select_option('TEST_C2');p.click('[data-undo-answer]');assert card.locator('[name=customer]').input_value()=='TEST_C2';assert 'Elle düzenlendi' in card.inner_text()
 # Unknown selector opens an inline picker, selects only that card's vehicle.
 badge=card.locator('[data-field-confidence=vehicle_id][data-level=BILINMIYOR]');badge.click();assert p.locator('[data-inline-picker]').evaluate('(e)=>e.open');p.fill('[data-picker-search]','Kamyon');p.click('[data-picker-value=TEST_V]');assert card.locator('[name=vehicle]').input_value()=='TEST_V';assert card.locator('[name=customer]').input_value()=='TEST_C2';assert not card.locator('[data-pick]').is_checked()
 p.wait_for_function("()=>!document.querySelector('[data-kind=work]').hasAttribute('data-question-updated')");assert p.evaluate("async()=>await(await import('./js/db.js')).dumpAll()")==before
 p.screenshot(path='/tmp/assistant-evening311.png',full_page=True);p.evaluate("location.hash='#/finans'");p.wait_for_function("()=>!document.body.classList.contains('assistant-evening')")
 assert not errors and not calls,(errors,calls);print(json.dumps({'eveningTheme':True,'clipboardDoesNotCoverAttachmentRemoval':True,'readOnlyDailyCoverage':True,'targetedUndo':True,'manualCorrectionSurvivesUndo':True,'inlinePickerOnlyOneField':True,'highlightExpires':True,'themeRemovedOnExit':True,'businessWrites':0,'providerCalls':0,'pageErrors':errors}),flush=True);b.close()
