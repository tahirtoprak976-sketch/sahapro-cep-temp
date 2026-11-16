"""Real missing-opening UX and protected continuation; synthetic IndexedDB only."""
import sys,uuid,json
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright
base=(sys.argv[1] if len(sys.argv)>1 else 'http://localhost:8896/').rstrip('/')+'/'
assert urlparse(base).hostname in ('localhost','127.0.0.1')
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);c=b.new_context(viewport={'width':360,'height':800},service_workers='block');c.add_init_script("localStorage.setItem('sp_role','boss')")
 page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));token='TEST_onb_'+uuid.uuid4().hex[:8];page.goto(base+'robots.txt?db='+token)
 ids=page.evaluate("""async()=>{const d=await import('./js/db.js');const p=await d.saveNew('personnel',{name:'TEST Başlangıç A',start_date:'2025-01-01',birth_date:'1990-01-01'},'TEST'),q=await d.saveNew('personnel',{name:'TEST Başlangıç B',start_date:'2025-01-01',birth_date:'1990-01-01'},'TEST');return {a:p.id,b:q.id}}""")
 page.goto(base+'index.html?db='+token+'#/izin-puantaj?pid='+ids['a']);page.wait_for_selector('[data-saveleave]')
 assert page.get_by_role('button',name='Başlangıç bilgilerini tamamla',exact=True).count()==1,'Missing actionable leave setup'
 assert page.get_by_text('Bu personelin kalan izinlerini henüz doğrulamadınız.',exact=True).count()==1
 assert page.locator('[data-preview]').is_hidden() and page.locator('[data-error]').inner_text()==''
 assert page.locator('[data-year]').is_disabled()
 for width in [320,360,768]:page.set_viewport_size({'width':width,'height':800});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),width
 page.set_viewport_size({'width':360,'height':800});page.screenshot(path='/tmp/personnel-onboarding116-missing.png',full_page=True)
 protected=page.evaluate("""async pid=>{const a=await import('./js/personnel-legal/api.js'),d=await import('./js/db.js'),before=JSON.stringify(await d.dumpAll());let code;try{await a.saveLeave({personelId:pid,izinTuru:'yillik',baslangicTarihi:'2026-09-01',bitisTarihi:'2026-09-08',isbasiTarihi:'2026-09-09',izinHakYili:'2026-01-01'})}catch(e){code=e.code}return {code,unchanged:before===JSON.stringify(await d.dumpAll())}}""",ids['a'])
 assert protected=={'code':'OPENING','unchanged':True},protected
 page.select_option('[data-purpose]','actual');page.fill('[data-from]','2026-09-01');page.fill('[data-to]','2026-09-08');page.fill('[data-return]','2026-09-09');page.fill('[data-site]','TEST elle korunacak şantiye')
 page.get_by_role('button',name='Başlangıç bilgilerini tamamla',exact=True).click();page.wait_for_selector('[data-profile]')
 assert page.input_value('[data-hire]')=='2025-01-01' and page.input_value('[data-birth]')=='1990-01-01'
 assert page.input_value('[data-days]')=='','Unknown leave balance must not become zero or an estimate'
 assert page.evaluate("async()=>(await(await import('./js/db.js')).listActive('izin_kayitlari')).length")==0
 page.fill('[data-asof]','2026-08-31');page.fill('[data-yearkey]','2026-01-01');page.fill('[data-days]','14');page.check('[data-confirm]');page.click('[data-profile]');page.wait_for_selector('[data-saveleave]')
 for key,value in {'from':'2026-09-01','to':'2026-09-08','return':'2026-09-09','purpose':'actual','site':'TEST elle korunacak şantiye'}.items():assert page.input_value('[data-'+key+']')==value,(key,page.input_value('[data-'+key+']'))
 assert page.input_value('[data-person]')==ids['a'];assert page.get_by_role('button',name='Kaydet',exact=True).count()==1
 assert page.locator('[data-setup-panel]').count()==0
 assert page.evaluate("async()=>(await(await import('./js/db.js')).listActive('izin_kayitlari')).length")==0,'Completing setup must not create a leave record'
 page.select_option('[data-year]','2026-01-01');page.click('[data-saveleave]');page.locator('.sheet').get_by_role('button',name='Kaydet',exact=True).click();page.wait_for_selector('.sheet',state='detached');page.wait_for_selector('[data-legal-leave]')
 row=page.evaluate("async pid=>(await(await import('./js/db.js')).listActive('izin_kayitlari')).find(r=>r.personelId===pid)",ids['a']);assert row['santiyeAdi']=='TEST elle korunacak şantiye' and row['dusulenIsGunu']==7 and 'TEN_DAYS' in row['warnings']
 assert page.input_value('[data-site]')=='','Successful save must not leave a duplicate-entry draft'
 page.click('[data-leave-documents]');assert page.locator('[data-pdf]').is_visible()
 page.select_option('[data-person]',ids['b']);page.wait_for_function("id=>document.querySelector('[data-person]')?.value===id&&!!document.querySelector('[data-setup-panel]')",arg=ids['b'])
 assert page.input_value('[data-site]')=='' and page.input_value('[data-purpose]')=='draft','Different employees must not share input'
 page.select_option('[data-kind]','rapor');assert page.locator('[data-setup-panel]').is_hidden();assert page.locator('[data-year]').is_hidden()
 page.click('[data-saveleave]');page.wait_for_selector('[data-legal-leave]')
 report=page.evaluate("async pid=>(await(await import('./js/db.js')).listActive('izin_kayitlari')).find(r=>r.personelId===pid)",ids['b']);assert report['izinTuru']=='rapor' and report['dusulenIsGunu']==0 and report['izinHakYili'] is None
 page.select_option('[data-person]',ids['a']);page.wait_for_selector('[data-editleave]');page.click('[data-editleave]');page.fill('[data-site]','TEST yerel düzenleme');page.select_option('[data-person]',ids['b']);page.wait_for_function("id=>document.querySelector('[data-person]')?.value===id",arg=ids['b'])
 page.evaluate("""async pid=>{const d=await import('./js/db.js'),a=await import('./js/personnel-legal/api.js'),r=(await d.listActive('izin_kayitlari')).find(r=>r.personelId===pid);await a.saveLeave({...r,santiyeAdi:'TEST diğer sekme'},{mode:'actual',current:r})}""",ids['a'])
 page.select_option('[data-person]',ids['a']);page.wait_for_function("()=>document.querySelector('[data-error]')?.textContent.includes('Düzenlenen kayıt değişmiş')")
 page.click('[data-editleave]');assert page.input_value('[data-site]')=='TEST diğer sekme';assert page.locator('[data-error]').inner_text()==''
 assert page.evaluate("async()=>(await(await import('./js/db.js')).listActive('izin_kayitlari')).length")==2
 for width in [320,360,768]:page.set_viewport_size({'width':width,'height':800});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),width
 assert not errors,errors
 print(json.dumps({'singleActionableWarning':True,'backendOpeningGuardRetained':True,'existingDatesReadWithoutBalanceGuess':True,'returnsToSameEmployeeAndDraft':True,'saveStillExplicit':True,'actualTenDayWarningRetained':True,'documentShortcut':True,'crossEmployeeIsolation':True,'changedRecordRequiresExplicitReview':True,'reportWithoutAnnualSetup':True,'widths':[320,360,768],'errors':errors}),flush=True);b.close()
