"""Fleet document day counters: actual UI/IDB/files, isolated TEST profiles only."""
import argparse,base64,json,uuid
from datetime import datetime,timezone
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

ap=argparse.ArgumentParser();ap.add_argument('url',nargs='?',default='http://localhost:8841/');ap.add_argument('--artifacts',default='/tmp/solo-fleet-documents89');args=ap.parse_args()
BASE=args.url.rstrip('/')+'/';assert urlparse(BASE).hostname in ('localhost','127.0.0.1')
OUT=Path(args.artifacts);OUT.mkdir(parents=True,exist_ok=True)
PNG=base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAMAAAADCAIAAADZSiLoAAAAEElEQVR4nGP8zwAFTAyYLAAdWwEFNX6VDAAAAABJRU5ErkJggg==')
SNAP="""async()=>{const s=await(await import('./js/db.js')).readSnapshot({attachments:true,meta:true,drafts:true});delete s.captured_at;return JSON.stringify(s)}"""
SETUP=r"""async()=>{
 const db=await import('./js/db.js'),C=await import('./js/core.js'),P=await import('./tests/support/attachment-fixtures.mjs');
 const v=await db.saveNew('vehicles',{name:'TEST 34 ABC 089',type:'Kamyon',km:100},'TEST'),j=await db.saveNew('vehicles',{name:'TEST JCB89',type:'İş Makinesi'},'TEST'),p=await db.saveNew('vehicles',{name:'TEST Passive89',active:false},'TEST');
 await db.saveNew('maintenance_records',{date:'2026-10-30',vehicle_id:v.id,status:'Açık',type:'Bakım'},'TEST');
 const add=(id,category,date,end,vehicle=v.id)=>db.saveNew('documents',{category,doc_no:'TEST-'+id,date,valid_from:date,expiry_date:end,vehicle_id:vehicle},'TEST');
 const old=await add('OLD','Muayene Belgesi','2025-10-20','2026-10-20'),current=await add('CURRENT','TÜVTÜRK / Periyodik Muayene','2026-10-21','2026-11-17');
 await db.addAttachment('document',current.id,new File([P.PNG],'TEST-original.png',{type:'image/png'}));
 const today=await add('TODAY','Kasko','2025-10-30','2026-10-30'),overdue=await add('OVERDUE','Zorunlu Trafik Sigortası','2025-10-29','2026-10-29'),future=await add('FUTURE','Sigorta / Poliçe','2026-10-31','2027-10-31');
 await add('WEEK','Periyodik Kontrol','2026-01-01','2026-11-06',j.id);await add('PASSIVE','Kasko','2026-01-01','2026-10-28',p.id);await add('RUHSAT','Ruhsat','2026-01-01',null);
 // Explicit legacy fixtures: ordinary writes correctly require a date and owner.
 const legacy=C.newRecord({category:'Periyodik Kontrol',doc_no:'TEST-UNKNOWN',date:'2026-01-01',expiry_date:null,owner_type:'vehicle',owner_id:v.id,vehicle_id:v.id});await db.put('documents',legacy);
 await db.put('documents',C.newRecord({category:'Makine Tescil Belgesi',doc_no:'TEST-OWNER-ONLY',date:'2026-01-01',owner_type:'vehicle',owner_id:v.id}));
 await db.put('documents',C.newRecord({category:'Kasko',doc_no:'TEST-MISMATCH',date:'2026-01-01',expiry_date:'2026-11-10',owner_type:'vehicle',owner_id:v.id,vehicle_id:j.id}));
 return {v:v.id,j:j.id,p:p.id,old:old.id,current:current.id,today:today.id,overdue:overdue.id,future:future.id,legacy:legacy.id};
}"""
with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);ctx=browser.new_context(viewport={'width':390,'height':850},timezone_id='Europe/Istanbul');ctx.add_init_script("localStorage.setItem('sp_role','boss')")
 external=[];errors=[]
 def route(r):
  if urlparse(r.request.url).hostname in ('localhost','127.0.0.1'):r.continue_()
  else:external.append(r.request.url);r.abort()
 ctx.route('**/*',route);p=ctx.new_page();p.on('pageerror',lambda e:errors.append(str(e)));p.clock.install(time=datetime(2026,10,30,9,0,tzinfo=timezone.utc))
 app=BASE+'index.html?db=fdoc89_'+uuid.uuid4().hex[:16]
 def view(h):
  p.goto(app+h);p.wait_for_selector('#screen[data-view-ready="1"]')
 view('#/daha');ids=p.evaluate(SETUP);view('#/filo-belgeleri');p.wait_for_selector('[data-fleet-doc-row]')
 p.click('[data-fleet-filter-summary]');before=p.evaluate(SNAP);body=p.locator('[data-fleet-doc-list]').inner_text()
 assert '18 gün kaldı' in body and '7 gün kaldı' in body and 'Bugün bitiyor' in body and '1 gün geçti' in body and '1 gün sonra başlar' in body,body
 assert p.locator('[data-fleet-doc-row="'+ids['old']+'"]').count()==0 and p.locator('[data-fleet-doc-row="'+ids['current']+'"] details').count()==1
 assert p.locator('[data-doc-state=owner]').count()==1 and p.locator('[data-doc-state=unknown]').count()==1
 assert p.locator('[data-fleet-doc-row]').count()==9
 p.locator('[data-fleet-doc-filter=week]').click();assert p.locator('[data-fleet-doc-row]').count()==1
 p.locator('[data-fleet-doc-filter=overdue]').first.click();assert p.locator('[data-fleet-doc-row]').count()==1
 p.check('[data-fleet-doc-passive]');assert p.locator('[data-fleet-doc-row]').count()==2
 p.uncheck('[data-fleet-doc-passive]');p.locator('[data-fleet-doc-filter=all]').click();p.select_option('[data-fleet-doc-vehicle]',ids['v']);p.fill('[data-fleet-doc-search]','Muayene');assert p.locator('[data-fleet-doc-row]').count()==1
 for width in [320,390,768]:p.set_viewport_size({'width':width,'height':850});assert p.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),width
 p.set_viewport_size({'width':390,'height':850});p.click('[data-fleet-filter-summary]');p.screenshot(path=str(OUT/'fleet-document-counters.png'),full_page=True)
 assert p.evaluate(SNAP)==before,'views and filters write no business/meta/file records'
 # Filo and actual vehicle card reuse the same counters.
 view('#/filo');p.wait_for_selector('[data-fleet-document-home]');assert 'Belge' in p.locator('[data-fleet-document-home]').inner_text() or 'belge' in p.locator('[data-fleet-document-home]').inner_text()
 p.set_viewport_size({'width':320,'height':850});assert p.locator('[data-fleet-list] .li>.grow').evaluate_all('es=>es.length>0&&es.every(e=>e.getBoundingClientRect().width>=100)');assert p.evaluate('document.documentElement.scrollWidth<=innerWidth+1');assert 'EKSİK' in p.locator('[data-fleet-list]').inner_text() and '1 açık' in p.locator('[data-fleet-list]').inner_text();p.screenshot(path=str(OUT/'fleet-list-320.png'),full_page=True);p.set_viewport_size({'width':390,'height':850})
 view('#/filo/'+ids['v']);p.wait_for_selector('[data-vehicle-documents] [data-fleet-doc-row]');assert '18 gün kaldı' in p.locator('[data-vehicle-documents]').inner_text()
 p.click('[data-tab=fuel_records]');p.wait_for_selector('[data-related]',state='attached');peer=ctx.new_page();peer.goto(app+'#/daha');peer.wait_for_selector('#screen[data-view-ready="1"]')
 peer.evaluate("""async id=>{const db=await import('./js/db.js'),d=await db.get('documents',id);await db.saveExisting('documents',d,{expiry_date:'2026-11-18'},'TEST another page expiry correction');}""",ids['current'])
 p.wait_for_function("()=>document.querySelector('[data-vehicle-documents]')?.textContent.includes('19 gün kaldı')")
 assert p.locator('[data-tab=fuel_records]').get_attribute('class').find('on')>=0
 view('#/filo/'+ids['v']+'/edit');p.wait_for_selector('[name=km]');p.fill('[name=km]','1234')
 peer.evaluate("async id=>{const d=await import('./js/db.js');await d.saveExisting('documents',await d.get('documents',id),{expiry_date:'2026-11-19'},'TEST document change while vehicle form is edited');}",ids['current'])
 p.evaluate("async()=>await(await import('./js/db.js')).getAll('documents')")
 assert p.input_value('[name=km]')=='1234' and p.evaluate("async id=>(await(await import('./js/db.js')).get('vehicles',id)).km",ids['v'])==100
 # Correction edits the document only, preserving original file bytes and owner.
 view('#/belge-suresi/'+ids['current']);p.wait_for_selector('[data-fleet-expiry-save]');before=p.evaluate(SNAP)
 p.fill('[name=expiry_date]','2025-01-01');p.click('[data-fleet-expiry-save]');p.wait_for_function("()=>document.querySelector('[data-fleet-expiry-error]')?.textContent.length>0");assert p.evaluate(SNAP)==before
 file_before=p.evaluate("async id=>{const d=await import('./js/db.js');return Promise.all((await d.attachmentsFor('document',id)).map(async a=>({id:a.id,bytes:Array.from(new Uint8Array(await a.blob.arrayBuffer()))})));}",ids['current'])
 p.fill('[name=expiry_date]','2026-11-20');p.fill('[name=reminder_date]','2026-11-17');p.click('[data-fleet-expiry-save]');p.wait_for_selector('[data-document-countdown]');assert '21 gün kaldı' in p.locator('[data-document-countdown]').inner_text()
 file_after=p.evaluate("async id=>{const d=await import('./js/db.js');return Promise.all((await d.attachmentsFor('document',id)).map(async a=>({id:a.id,bytes:Array.from(new Uint8Array(await a.blob.arrayBuffer()))})));}",ids['current']);assert file_before==file_after
 # Stale form cannot overwrite another page's correction.
 view('#/belge-suresi/'+ids['current']);peer.evaluate("async id=>{const d=await import('./js/db.js');await d.saveExisting('documents',await d.get('documents',id),{expiry_date:'2026-11-22'},'TEST newer date');}",ids['current'])
 before=p.evaluate(SNAP);p.fill('[name=expiry_date]','2026-11-23');p.click('[data-fleet-expiry-save]');p.wait_for_function("()=>document.querySelector('[data-fleet-expiry-error]')?.textContent.includes('değişti')");assert p.evaluate(SNAP)==before;peer.close()
 # Existing file upload starts with the correct vehicle; new renewal is separate.
 view('#/filo-belgeleri?vehicle_id='+ids['v']);p.wait_for_selector('[data-fleet-doc-add]');p.click('[data-fleet-doc-add]');p.wait_for_selector('[name=attachment]');assert p.input_value('[name=vehicle_id]')==ids['v']
 p.select_option('[name=category]','Kasko');p.wait_for_selector('[name=vehicle_id]');p.fill('[name=doc_no]','TEST-RENEWAL-89');p.fill('[name=date]','2026-10-30');p.fill('[name=valid_from]','2026-10-31');p.fill('[name=expiry_date]','2027-10-31');p.set_input_files('[name=attachment]',{'name':'TEST-renewal.png','mimeType':'image/png','buffer':PNG});p.click('[data-save]');p.wait_for_selector('[data-document-countdown]');assert '1 gün sonra başlar' in p.locator('[data-document-countdown]').inner_text()
 saved=p.evaluate("""async()=>{const d=await import('./js/db.js'),r=(await d.listActive('documents')).find(x=>x.doc_no==='TEST-RENEWAL-89');return {vehicle:r.vehicle_id,files:(await d.attachmentsFor('document',r.id)).length,money:(await d.listActive('cash_records')).length+(await d.listActive('cari_movements')).length};}""");assert saved=={'vehicle':ids['v'],'files':1,'money':0},saved
 view('#/');p.wait_for_selector('[data-fleet-document-home]');assert 'Filo belge süreleri' in p.locator('[data-fleet-document-home]').inner_text()
 view('#/filo-belgeleri?vehicle_id='+ids['v']+'&q=Muayene');p.wait_for_selector('[data-fleet-doc-row]');p.evaluate('async()=>await navigator.serviceWorker.ready');p.wait_for_function('()=>!!navigator.serviceWorker.controller');before=p.evaluate(SNAP);ctx.set_offline(True);p.reload(wait_until='domcontentloaded');p.wait_for_selector('[data-fleet-doc-row]');assert p.input_value('[data-fleet-doc-search]')=='Muayene' and p.input_value('[data-fleet-doc-vehicle]')==ids['v'] and p.evaluate(SNAP)==before
 ctx.close()
 # Midnight and return-to-app update day counters, never the stored expiry.
 mid=browser.new_context(viewport={'width':390,'height':850},timezone_id='Europe/Istanbul');mid.add_init_script("localStorage.setItem('sp_role','boss')");mid.route('**/*',route);mp=mid.new_page();mp.on('pageerror',lambda e:errors.append(str(e)));mp.clock.install(time=datetime(2026,10,30,19,59,58,tzinfo=timezone.utc));mp.clock.pause_at(datetime(2026,10,30,20,59,58,tzinfo=timezone.utc))
 mp.goto(BASE+'index.html?db=fdocmid89_'+uuid.uuid4().hex[:12]+'#/filo-belgeleri');mp.wait_for_selector('#screen[data-view-ready="1"]')
 mp.evaluate("""async()=>{const d=await import('./js/db.js'),v=await d.saveNew('vehicles',{name:'TEST Midnight89'},'TEST');await d.saveNew('documents',{date:'2026-01-01',category:'Kasko',doc_no:'TEST-MIDNIGHT',vehicle_id:v.id,expiry_date:'2026-10-30'},'TEST');}""")
 mp.evaluate("async()=>await(await import('./js/db.js')).getAll('documents')");assert mp.locator('[data-doc-state=today]').count()==1
 before=mp.evaluate(SNAP);mp.clock.run_for(4000);mp.evaluate("async()=>await(await import('./js/db.js')).getAll('documents')");assert mp.locator('[data-doc-state=overdue]').count()==1 and '1 gün geçti' in mp.locator('[data-fleet-doc-list]').inner_text();assert mp.evaluate(SNAP)==before
 mp.clock.set_fixed_time(datetime(2026,11,2,9,0,tzinfo=timezone.utc));mp.evaluate("window.dispatchEvent(new Event('focus'))");mp.evaluate("async()=>await(await import('./js/db.js')).getAll('documents')");assert '3 gün geçti' in mp.locator('[data-fleet-doc-list]').inner_text() and mp.evaluate(SNAP)==before
 assert not errors and not external,(errors,external);mid.close();browser.close()
 report={'local_test_profiles_only':True,'exact_day_and_future_renewal':True,'alias_history_and_unknown_owner':True,'filters_read_only':True,'widths':[320,390,768],'cross_page_refresh_keeps_vehicle_edit':True,'date_edit_preserves_file_bytes':True,'stale_form_rejected':True,'new_upload_correct_vehicle':saved,'homepage_and_fleet_links':True,'offline_filters_and_data_preserved':True,'midnight_and_focus_refresh_without_writes':True,'page_errors':errors,'external_requests':external}
 (OUT/'result.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps(report,ensure_ascii=False))
