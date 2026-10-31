"""Supplier/expense maintenance history: real UI, IDB and originals; TEST profiles only."""
import argparse,json,uuid
from pathlib import Path
from datetime import datetime,timezone
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

ap=argparse.ArgumentParser();ap.add_argument('url',nargs='?',default='http://localhost:8841/');ap.add_argument('--baseline-proof',action='store_true');ap.add_argument('--artifacts',default='/tmp/solo-maintenance90');a=ap.parse_args()
BASE=a.url.rstrip('/')+'/';assert urlparse(BASE).hostname in ('localhost','127.0.0.1')
OUT=Path(a.artifacts);OUT.mkdir(parents=True,exist_ok=True)
SNAP="""async()=>{const d=await import('./js/db.js'),s=await d.readSnapshot({attachments:true,meta:true,drafts:true});delete s.captured_at;s.attachments=await Promise.all(s.attachments.map(async x=>({...x,bytes:Array.from(new Uint8Array(await x.blob.arrayBuffer()))})));return JSON.stringify(s)}"""
SEED="""async()=>{
 const db=await import('./js/db.js'),edb=await import('./js/enterprise-db.js'),P=await import('./tests/support/attachment-fixtures.mjs');
 const v=await db.saveNew('vehicles',{name:'TEST Kamyon90',type:'Kamyon',km:100},'TEST'),s=await edb.saveSupplier({name:'TEST Usta90',type:'Servis'},'TEST-supplier-'+v.id);
 const b=await edb.savePayable({date:'2026-10-12',due_date:'2026-10-12',document_no:'TEST-REPAIR-90',party_type:'supplier',party_id:s.id,bill_kind:'Alış',cost_category:'Bakım / Onarım',vehicle_id:v.id,description:'TEST fren bakımı ve yağlama belgesi',kdv_unknown:true,items:[{description:'TEST fren bakımı ve yağlama belgesi',quantity:1,unit:'Adet',unit_price:10000,kdv_rate:0}]},'TEST-original-bill-'+v.id);
 await db.addAttachment('payable',b.id,new File([P.PNG],'TEST-service-original.png',{type:'image/png'}));
 return {v:v.id,s:s.id,b:b.id};
}"""
with sync_playwright() as w:
 browser=w.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);ctx=browser.new_context(viewport={'width':390,'height':850},timezone_id='Europe/Istanbul');ctx.add_init_script("localStorage.setItem('sp_role','boss')")
 errors=[];external=[]
 def route(r):
  if urlparse(r.request.url).hostname in ('localhost','127.0.0.1'):r.continue_()
  else:external.append(r.request.url);r.abort()
 ctx.route('**/*',route);p=ctx.new_page();p.on('pageerror',lambda e:errors.append(str(e)));p.clock.install(time=datetime(2026,10,31,9,0,tzinfo=timezone.utc))
 app=BASE+'index.html?db=maint90_'+uuid.uuid4().hex[:16]
 def view(h):p.goto(app+h);p.wait_for_selector('#screen[data-view-ready="1"]')
 def history():view('#/bakim?vehicle_id='+ids['v']);p.wait_for_selector('[data-operation-summary]')
 view('#/daha');ids=p.evaluate(SEED);before=p.evaluate(SNAP)
 ledger=p.evaluate("async()=>{const db=await import('./js/db.js'),c=await import('./js/enterprise-core.js');return c.costLedger(await db.dumpAll()).reduce((n,r)=>n+r.gross,0)}");assert ledger==10000
 history()
 schedule=p.evaluate("""async()=>{const c=await import('./js/maint-core.js');return c.lastDone({maintenance_records:[{id:'done',vehicle_id:'V',date:'2026-09-01',status:'Tamamlandı',description:'fren'},{id:'servicing',vehicle_id:'V',date:'2026-10-12',status:'Serviste',description:'fren'}]},{id:'V'},{id:'R',title:'Fren',keywords:'fren'},{today:'2026-10-31'})?.id}""")
 if a.baseline_proof:
  assert p.locator('[data-operation-record]').count()==0 and schedule=='servicing'
  view('#/bakim?f=all&vehicle_id='+ids['v']);p.wait_for_selector('[data-operation-summary]');assert p.locator('[data-operation-record]').count()==0
  view('#/alislar/'+ids['b']);assert p.locator('[data-original]').count()==0,'legacy singular payable attachment is missed by the plural-only detail reader'
  assert p.evaluate(SNAP)==before
  report={'baseline_proven':True,'maintenance_rows':0,'financial_cost':ledger,'servicing_incorrectly_counts_as_done':True,'payable_attachment_missing_in_source_view':True,'no_view_writes':True};(OUT/'result.json').write_text(json.dumps(report,indent=2));p.screenshot(path=str(OUT/'baseline-missing-source-photo.png'),full_page=True);print(json.dumps(report));browser.close();raise SystemExit(0)
 assert schedule=='done'
 p.evaluate("async id=>{const d=await import('./js/db.js'),P=await import('./tests/support/attachment-fixtures.mjs');await d.addAttachment('payables',id,new File([P.PNG],'TEST-legacy-plural.png',{type:'image/png'}));}",ids['b']);before=p.evaluate(SNAP);history()
 card=p.locator('[data-operation-record="payables:'+ids['b']+'"]');assert card.count()==1 and '10.000,00' in p.locator('[data-operation-summary]').inner_text() and 'TEST Usta90' in card.inner_text() and 'İş durumu belirtilmemiş' in card.inner_text()
 assert card.get_attribute('href')=='#/alislar/'+ids['b']
 for width in [320,390,768]:p.set_viewport_size({'width':width,'height':850});assert p.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),width;assert p.locator('[data-maintenance-summary] .work-explorer-metrics>div:last-child strong').evaluate('e=>e.getBoundingClientRect().height<45'),('money wraps',width)
 p.set_viewport_size({'width':390,'height':850});p.screenshot(path=str(OUT/'supplier-maintenance-history.png'),full_page=True)
 card.click();p.wait_for_url('**#/alislar/'+ids['b']);p.wait_for_selector('[data-safe-attachment]');assert p.locator('[data-safe-attachment] img').count()==2
 assert p.evaluate(SNAP)==before,'source document view preserves financial records and original bytes'
 view('#/esnaf/'+ids['s']);p.locator('[data-rid="'+ids['b']+'"]').click();p.wait_for_selector('#sheet-root [data-safe-attachment]');assert p.locator('#sheet-root [data-safe-attachment] img').count()==2;p.click('#sheet-root [data-close]');assert p.evaluate(SNAP)==before
 view('#/bakim?f=open&vehicle_id='+ids['v']);p.wait_for_selector('[data-maintenance-hidden]');assert p.locator('[data-operation-record]').count()==0;p.click('[data-maintenance-hidden]');p.wait_for_selector('[data-operation-record]');assert p.locator('[data-operation-record]').count()==1
 # CSV and a real PDF consume the same projected source row, not a duplicate expense.
 p.locator('[data-operation-filters]').evaluate('(e)=>e.open=true');p.evaluate("()=>{navigator.canShare=()=>true;navigator.share=async x=>window.__csv=await x.files[0].text()}");p.click('[data-operation-csv]');p.wait_for_function('()=>!!window.__csv');csv=p.evaluate('window.__csv');assert 'TEST fren' in csv and 'Esnaf / alış belgesi' in csv and 'İş durumu belirtilmemiş' in csv
 pdf=p.evaluate("""async id=>{const db=await import('./js/db.js'),r=await import('./js/report-core.js'),e=await import('./js/document-engine.js');const report=r.buildReport(await db.dumpAll(),{k:'bakim',id,from:'2026-10-01',to:'2026-10-31',today:'2026-10-31'});const blob=await e.buildDocument(r.reportSpec(report));return {head:await blob.slice(0,5).text(),size:blob.size,rows:report.tables[0].rows.length,href:report.tables[0].link[0]};}""",ids['v']);assert pdf['head']=='%PDF-' and pdf['size']>1000 and pdf['rows']==1 and pdf['href']=='#/alislar/'+ids['b']
 assert p.evaluate(SNAP)==before
 # A native maintenance source and its bill are one operation and one cost.
 p.evaluate("""async ids=>{const d=await import('./js/db.js'),e=await import('./js/enterprise-db.js');const m=await d.saveNew('maintenance_records',{date:'2026-10-20',vehicle_id:ids.v,status:'Tamamlandı',maint_type:'Bakım',description:'TEST filtre bakımı',cost:500},'TEST');await e.savePayable({date:'2026-10-20',due_date:'2026-10-20',document_no:'TEST-LINKED-90',party_type:'supplier',party_id:ids.s,bill_kind:'Alış',cost_category:'Bakım / Onarım',vehicle_id:ids.v,source_store:'maintenance_records',source_id:m.id,items:[{description:'TEST filtre bakımı',quantity:1,unit:'Adet',unit_price:500,kdv_rate:0}]},'TEST-linked-'+ids.v);}""",ids)
 before=p.evaluate(SNAP);history();linked_state={'rows':p.locator('[data-operation-record]').count(),'summary':p.locator('[data-operation-summary]').inner_text(),'records':p.locator('[data-operation-list]').inner_text()};assert linked_state['rows']==2 and '10.500,00' in linked_state['summary'],linked_state;assert p.locator('[data-maintenance-sources] a').count()==1
 assert p.evaluate(SNAP)==before
 # The actual Gider -> supplier flow writes a bill plus original, no second expense.
 counts=lambda:p.evaluate("async()=>{const d=await import('./js/db.js');return Object.fromEntries(await Promise.all(['payables','expense_records','maintenance_records','cash_records','bank_movements','cari_movements','attachments'].map(async s=>[s,(await d.getAll(s)).length])))}")
 previous=counts();view('#/gider/new');p.wait_for_selector('[name=supplier_id]');p.select_option('[name=category]','Bakım / Onarım');p.fill('[name=date]','2026-10-31');p.fill('[name=amount]','1234');p.select_option('[name=vehicle_id]',ids['v']);p.select_option('[name=supplier_id]',ids['s']);p.fill('[name=description]','TEST UI şanzıman bakımı')
 png=p.evaluate("async()=>Array.from((await import('./tests/support/attachment-fixtures.mjs')).PNG)");p.set_input_files('[name=photo]',{'name':'TEST-ui-repair.png','mimeType':'image/png','buffer':bytes(png)});p.click('[data-save]');p.wait_for_url('**#/esnaf/'+ids['s']);p.wait_for_selector('#screen[data-view-ready="1"]');after=counts()
 assert after['payables']==previous['payables']+1 and after['attachments']==previous['attachments']+1
 for store in ['expense_records','maintenance_records','cash_records','bank_movements','cari_movements']:assert after[store]==previous[store],store
 history();p.wait_for_function("()=>document.querySelector('[data-operation-list]')?.textContent.includes('TEST UI şanzıman bakımı')");assert p.locator('[data-operation-record]').count()==3
 # Vehicle relationship tab uses the same history and refreshes without resetting tabs/forms.
 view('#/filo/'+ids['v']);p.click('[data-tab=maintenance_records]');p.wait_for_function("()=>document.querySelector('[data-related]')?.textContent.includes('TEST UI şanzıman bakımı')")
 p.set_viewport_size({'width':320,'height':850});assert p.locator('[data-maintenance-related] .grow').evaluate_all('es=>es.length>0&&es.every(e=>e.getBoundingClientRect().width>=100)');assert p.evaluate('document.documentElement.scrollWidth<=innerWidth+1');p.screenshot(path=str(OUT/'vehicle-maintenance-320.png'),full_page=True);p.set_viewport_size({'width':390,'height':850})
 peer=ctx.new_page();peer.goto(app+'#/daha');peer.wait_for_selector('#screen[data-view-ready="1"]')
 new_id=peer.evaluate("""async ids=>{const e=await import('./js/enterprise-db.js');const b=await e.savePayable({date:'2026-10-31',due_date:'2026-10-31',document_no:'TEST-PEER-90',party_type:'supplier',party_id:ids.s,bill_kind:'Alış',cost_category:'Bakım / Onarım',vehicle_id:ids.v,description:'TEST peer servis',items:[{description:'TEST peer servis',quantity:1,unit:'Adet',unit_price:11,kdv_rate:0}]},'TEST-peer-'+ids.v);return b.id;}""",ids)
 p.wait_for_function("()=>document.querySelector('[data-related]')?.textContent.includes('TEST peer servis')");assert 'on' in p.locator('[data-tab=maintenance_records]').get_attribute('class')
 view('#/filo/'+ids['v']+'/edit');p.wait_for_selector('[name=km]');p.fill('[name=km]','1234');peer.evaluate("async id=>{const e=await import('./js/enterprise-db.js');await e.cancelPayable(id,'TEST cancel peer repair');}",new_id);assert p.input_value('[name=km]')=='1234';assert p.evaluate("async id=>(await(await import('./js/db.js')).get('vehicles',id)).km",ids['v'])==100;peer.close()
 # Cancellation refreshes the open history. It cannot leave a phantom repair cost.
 history();assert p.locator('[data-operation-record]').count()==3;peer=ctx.new_page();peer.goto(app+'#/daha');peer.wait_for_selector('#screen[data-view-ready="1"]')
 ui_bill=p.evaluate("async()=>{const d=await import('./js/db.js');return(await d.listActive('payables')).find(b=>b.description?.includes('TEST UI şanzıman')).id}")
 peer.evaluate("async id=>{const e=await import('./js/enterprise-db.js');await e.cancelPayable(id,'TEST cancel UI repair');}",ui_bill)
 p.wait_for_function("()=>document.querySelectorAll('[data-operation-record]').length===2");assert '10.500,00' in p.locator('[data-operation-summary]').inner_text();peer.close()
 before=p.evaluate(SNAP);p.evaluate('async()=>await navigator.serviceWorker.ready');p.wait_for_function('()=>!!navigator.serviceWorker.controller');ctx.set_offline(True);p.reload(wait_until='domcontentloaded');p.wait_for_selector('[data-operation-record]');assert p.locator('[data-operation-record]').count()==2 and p.evaluate(SNAP)==before;ctx.set_offline(False)
 # Missing/failed source reads stay explicit instead of inventing a zero total.
 failure=p.evaluate("""async()=>{const {operationHistory}=await import('./js/operation-history-ui.js');const root=document.createElement('div');document.body.append(root);await operationHistory({root,db:{openDB:async()=>{throw Error('TEST missing source')}},query:{}},'maintenance');const x={text:root.textContent,summary:!!root.querySelector('[data-operation-summary]')};root.remove();return x;}""");assert 'Kayıtlar okunamadı' in failure['text'] and not failure['summary']
 assert not errors and not external,(errors,external)
 report={'isolated_test_data_only':True,'supplier_only_repair_visible':True,'source_photo_preserved':True,'hidden_filter_explained':True,'native_bill_dedup':True,'expense_supplier_ui_no_duplicate_finance':True,'csv_pdf_source_parity':pdf,'vehicle_tab_live_refresh':True,'vehicle_form_preserved':True,'cancel_refresh':True,'servicing_not_completed':True,'offline_no_writes':True,'read_failure_explicit':True,'widths':[320,390,768],'page_errors':errors,'external_requests':external}
 (OUT/'result.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(report,ensure_ascii=False));browser.close()
