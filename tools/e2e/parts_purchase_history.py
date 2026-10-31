"""Purchased parts visibility and warranty completion. Isolated TEST IDB, real Chromium."""
import argparse,json,uuid
from pathlib import Path
from datetime import datetime,timezone
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright
ap=argparse.ArgumentParser();ap.add_argument('url',nargs='?',default='http://localhost:8841/');ap.add_argument('--baseline-proof',action='store_true');ap.add_argument('--artifacts',default='/tmp/solo-parts91');a=ap.parse_args()
BASE=a.url.rstrip('/')+'/';assert urlparse(BASE).hostname in ('localhost','127.0.0.1')
OUT=Path(a.artifacts);OUT.mkdir(parents=True,exist_ok=True)
SNAP="""async()=>{const db=await import('./js/db.js'),s=await db.readSnapshot({attachments:true,meta:true,drafts:true});delete s.captured_at;s.attachments=await Promise.all(s.attachments.map(async x=>({...x,bytes:Array.from(new Uint8Array(await x.blob.arrayBuffer()))})));return JSON.stringify(s)}"""
SEED="""async()=>{const db=await import('./js/db.js'),e=await import('./js/enterprise-db.js'),f=await import('./tests/support/attachment-fixtures.mjs');
 const v=await db.saveNew('vehicles',{name:'TEST Parça Kamyon91',type:'Kamyon'},'TEST'),v2=await db.saveNew('vehicles',{name:'TEST Diğer91',type:'Kamyon'},'TEST'),s=await e.saveSupplier({name:'TEST Akü Satıcısı91'},'TEST-supplier-'+v.id);
 const expense=await db.saveNew('expense_records',{date:'2026-10-12',vehicle_id:v.id,category:'Yedek Parça',amount:6000,description:'TEST Akü alışı'},'TEST');
 const bill=await e.savePayable({date:'2026-10-12',due_date:'2026-10-12',document_no:'TEST-BATTERY91',party_type:'supplier',party_id:s.id,cost_category:'Yedek Parça',vehicle_id:v.id,source_store:'expense_records',source_id:expense.id,items:[{description:'TEST Akü',quantity:2,unit:'Adet',unit_price:3000,kdv_rate:0}]},'TEST-bill-'+v.id);
 for(const [type,id,name] of [['payable',bill.id,'TEST-warranty.png'],['payables',bill.id,'TEST-invoice.png'],['expense',expense.id,'TEST-receipt.png']])await db.addAttachment(type,id,new File([f.PNG],name,{type:'image/png'}));
 return {v:v.id,v2:v2.id,b:bill.id,e:expense.id,s:s.id};}"""
with sync_playwright() as w:
 browser=w.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);ctx=browser.new_context(viewport={'width':390,'height':850},timezone_id='Europe/Istanbul');ctx.add_init_script("localStorage.setItem('sp_role','boss')")
 errors=[];external=[]
 def route(r):
  if urlparse(r.request.url).hostname in ('localhost','127.0.0.1'):r.continue_()
  else:external.append(r.request.url);r.abort()
 ctx.route('**/*',route);p=ctx.new_page();p.on('pageerror',lambda e:errors.append(str(e)));p.clock.install(time=datetime(2026,10,31,9,0,tzinfo=timezone.utc))
 app=BASE+'index.html?db=parts91_'+uuid.uuid4().hex[:16]
 def view(h):p.clock.run_for(120);p.goto(app+h);p.wait_for_selector('#screen[data-view-ready="1"]')
 view('#/daha');ids=p.evaluate(SEED);before=p.evaluate(SNAP);view('#/yedek-parca')
 invalid=p.evaluate("async()=>{const c=await import('./js/parts-core.js');return c.warrantyState({warranty_until:'wrong'},'2026-10-31')}")
 if a.baseline_proof:
  assert p.locator('[data-parts-list] .card').count()==0 and invalid['kind']=='ok'
  assert before==p.evaluate(SNAP)
  report={'baseline_proven':True,'purchased_batteries_missing':True,'invalid_warranty_falsely_active':True,'no_view_writes':True};(OUT/'result.json').write_text(json.dumps(report));p.screenshot(path=str(OUT/'missing-purchase-baseline.png'),full_page=True);print(json.dumps(report));browser.close();raise SystemExit(0)
 assert invalid['kind']=='warn'
 card=p.locator('[data-part-purchase="payables:'+ids['b']+'"]');assert card.count()==1 and p.locator('[data-part-purchase]').count()==1
 assert '6.000' in card.inner_text() and 'Garanti bilgileri eksik' in card.inner_text() and 'TEST Akü Satıcısı91' in card.inner_text();assert p.evaluate(SNAP)==before
 p.screenshot(path=str(OUT/'purchased-parts-visible.png'),full_page=True)
 card.get_by_role('button',name='Garanti Bilgilerini Tamamla',exact=True).click();p.wait_for_selector('[data-part-form]')
 assert p.input_value('[name=quantity]')=='2' and p.input_value('[name=description]')=='TEST Akü' and p.input_value('[name=unit_price]')=='' and p.input_value('[name=cost_mode]')=='existing'
 p.fill('[name=serial_numbers]','TEST-A1\nTEST-A2');p.fill('[name=warranty_start]','2026-10-12');p.fill('[name=warranty_until]','2028-10-12');p.locator('[data-part-form] [type=submit]').click();p.wait_for_selector('[data-add-files]');p.wait_for_function("()=>document.querySelectorAll('[data-attachments] [data-safe-attachment]').length===3")
 pid=p.url.split('#/yedek-parca/')[1];assert 'Garanti devam ediyor' in p.inner_text('#screen')
 p.screenshot(path=str(OUT/'linked-warranty-originals.png'),full_page=True)
 result=p.evaluate("""async()=>{const db=await import('./js/db.js'),c=await import('./js/costs-core.js'),e=await import('./js/enterprise-core.js'),s=await import('./js/solo-core.js'),b=await import('./js/backup.js');const d=await db.dumpAll();s.validateSoloData(d);const backup=await b.fullBackup(db,{attachments:'base64'});return {parts:d.maintenance_parts.length,expenses:d.expense_records.length,bills:d.payables.length,cost:c.costTotals(c.costRows(d)).total,ledger:e.costLedger(d).reduce((n,r)=>n+r.gross,0),files:backup.attachments.length,backup}}""")
 assert {k:v for k,v in result.items() if k!='backup'}=={'parts':1,'expenses':1,'bills':1,'cost':6000,'ledger':6000,'files':3},result
 view('#/yedek-parca');assert p.locator('[data-part-purchase]').count()==0 and p.locator('[data-part-id="'+pid+'"]').count()==1
 # The stale original purchase URL cannot open a second card.
 view('#/yedek-parca/new?source_store=payables&source_id='+ids['b']);assert 'zaten var' in p.inner_text('#screen') and p.locator('[data-part-form]').count()==0
 guards=p.evaluate("""async ids=>{const db=await import('./js/db.js'),P=await import('./js/parts-db.js'),H=await import('./js/parts-history-core.js'),S=await import('./js/solo-db.js'),E=await import('./js/enterprise-db.js');
 const snap=async()=>{const x=await db.readSnapshot({attachments:true});delete x.captured_at;return JSON.stringify(x)},reject=async fn=>{try{await fn();return false}catch(e){return e.message}};
 const expense=await db.saveNew('expense_records',{date:'2026-10-12',vehicle_id:ids.v,category:'Yedek Parça',amount:100,description:'TEST Filtre'},'TEST');
 const draft=H.purchaseDraft(await db.dumpAll(),'expense_records',expense.id).fields,f={...draft,quantity:1,cost_source_store:'expense_records',cost_source_id:expense.id};
 let before=await snap();const wrong=await reject(()=>P.saveSparePart({...f,cost_mode:'new_expense',unit_price:100},[],'TEST-wrong91'));const wrongClean=before===await snap();
 await db.saveExisting('expense_records',expense,{amount:120},'TEST');before=await snap();const stale=await reject(()=>P.saveSparePart(f,[],'TEST-stale91')),staleClean=before===await snap();
 const fresh={...H.purchaseDraft(await db.dumpAll(),'expense_records',expense.id).fields,quantity:1,cost_source_store:'expense_records',cost_source_id:expense.id};
 const race=await Promise.allSettled(['A','B'].map(k=>P.saveSparePart(fresh,[],'TEST-race91-'+k)));const raceSaved=race.filter(x=>x.status==='fulfilled').length;
 const created=race.find(x=>x.status==='fulfilled').value;before=await snap();const noRevision=await reject(()=>P.updatePartWarranty(created.id,{brand:'TEST overwrite'})),noRevisionClean=before===await snap();
 // A maintenance part can gain warranty details without a new cost or losing its parent.
 const m=await db.saveNew('maintenance_records',{date:'2026-10-10',vehicle_id:ids.v,description:'TEST Fren',cost:500,status:'Tamamlandı'},'TEST');const mp=await S.savePart({maintenance_id:m.id,kind:'Parça',description:'TEST Balata',quantity:2,unit_price:250},'TEST-maintenance-part91');
 const tracked=await P.updatePartWarranty(mp.id,{brand:'TEST balata',warranty_until:'2027-10-10'},mp.updated_at);
 const d=await db.dumpAll();return {wrong,wrongClean,stale,staleClean,raceSaved,noRevision,noRevisionClean,maintenanceWarranty:tracked.tracking&&tracked.maintenance_id===m.id&&tracked.total===500,expenses:d.expense_records.length,bills:d.payables.length};
 }""",ids)
 assert all(guards[k] for k in ['wrong','wrongClean','stale','staleClean','noRevision','noRevisionClean','maintenanceWarranty']) and guards['raceSaved']==1 and guards['expenses']==2 and guards['bills']==1,guards
 # Mixed invoice is visible as a source document, never auto-priced as one part.
 mixed=p.evaluate("""async ids=>{const E=await import('./js/enterprise-db.js');return(await E.savePayable({date:'2026-10-12',due_date:'2026-10-12',document_no:'TEST-MIXED91',party_type:'supplier',party_id:ids.s,cost_category:'Tamir',vehicle_id:ids.v2,items:[{description:'TEST Lastik',quantity:2,unit:'Adet',unit_price:100,kdv_rate:0},{description:'TEST İşçilik',quantity:1,unit:'Saat',unit_price:50,kdv_rate:0}]},'TEST-mixed91')).id;}""",ids)
 view('#/yedek-parca');mixed_card=p.locator('[data-part-purchase="payables:'+mixed+'"]');assert 'Belge birden fazla kalem içeriyor' in mixed_card.inner_text()
 mixed_card.get_by_role('button',name='Garanti Bilgilerini Tamamla',exact=True).click();p.wait_for_selector('[data-part-form]');assert p.input_value('[name=quantity]')=='' and p.input_value('[name=description]')=='' and p.input_value('[name=unit_price]')==''
 # A failed snapshot is shown as an error, not a reassuring empty list.
 failure=p.evaluate("""async()=>{const {screen}=await import('./js/parts-ui.js');const root=document.createElement('div');await screen({root,db:{openDB:async()=>{throw Error('TEST read failure')}},parts:['yedek-parca'],query:{}});return root.textContent;}""");assert 'Parça kaynakları okunamadı' in failure and 'Bu filtrede parça yok' not in failure
 # Cross-tab commits repaint only results, preserving search and vehicle filters.
 view('#/yedek-parca');p.fill('[data-search]','TEST Yeni');p.select_option('[name=vehicle_filter]',ids['v']);peer=ctx.new_page();peer.goto(app+'#/daha');peer.wait_for_selector('#screen[data-view-ready="1"]')
 extra=peer.evaluate("async ids=>{const d=await import('./js/db.js');return (await d.saveNew('expense_records',{date:'2026-10-12',vehicle_id:ids.v,category:'Yedek Parça',amount:50,description:'TEST Yeni Lastik'},'TEST')).id}",ids)
 p.wait_for_selector('[data-part-purchase="expense_records:'+extra+'"]');assert p.input_value('[data-search]')=='TEST Yeni' and p.input_value('[name=vehicle_filter]')==ids['v']
 peer.evaluate("async id=>{const db=await import('./js/db.js');await db.softDelete('expense_records',id,'TEST cancel purchase')}",extra);p.wait_for_function('()=>document.querySelectorAll("[data-part-purchase]").length===0');peer.close()
 p.fill('[data-search]','');p.select_option('[name=vehicle_filter]','');p.select_option('[name=warranty_filter]','unknown');assert p.locator('[data-part-id]').count()==1
 p.select_option('[name=warranty_filter]','')
 for width in [320,390,768]:p.set_viewport_size({'width':width,'height':850});assert p.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),width
 # IndexedDB-backed source documents and new JS modules work after SW install, offline.
 p.evaluate('async()=>await navigator.serviceWorker.ready');p.wait_for_function('()=>!!navigator.serviceWorker.controller');before=p.evaluate(SNAP);ctx.set_offline(True);p.reload(wait_until='domcontentloaded');p.wait_for_selector('[data-parts-list]');assert p.locator('[data-part-id]').count()==3 and p.evaluate(SNAP)==before;ctx.set_offline(False)
 # Isolated full restore retains costs, source aliases, bytes and warranty association.
 clean=browser.new_context();clean.add_init_script("localStorage.setItem('sp_role','boss')");pc=clean.new_page();pc.goto(BASE+'index.html?db=parts91_restore_'+uuid.uuid4().hex[:16]+'#/daha');pc.wait_for_selector('#screen[data-view-ready="1"]')
 restored=pc.evaluate("""async backup=>{const db=await import('./js/db.js'),B=await import('./js/backup.js'),H=await import('./js/parts-history-core.js'),C=await import('./js/costs-core.js');await B.restoreBackup(db,backup);const d=await db.dumpAll();return {files:(await H.partAttachments(db,d.maintenance_parts[0],d)).length,cost:C.costTotals(C.costRows(d)).total,parts:d.maintenance_parts.length};}""",result['backup']);assert restored=={'files':3,'cost':6000,'parts':1},restored
 assert not errors and not external,(errors,external)
 report={'isolated_test_data_only':True,'purchases_visible':True,'source_alias_originals':3,'same_cost_once':6000,'completion_without_second_expense':True,'unknown_quantity_price_not_invented':True,'mixed_invoice_explicit':True,'read_failure_explicit':True,'duplicate_and_stale_guards':guards,'maintenance_part_warranty':True,'cross_tab_filters_preserved':True,'offline_read_only':True,'backup_restore':restored,'widths':[320,390,768],'page_errors':errors,'external_requests':external};(OUT/'result.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(report,ensure_ascii=False));browser.close()
print('parts_purchase_history browser PASS',flush=True)
