"""Integrity release: isolated TEST data, real Chromium/IDB and two pages.
Default asserts protection; --baseline-proof explicitly asserts the unchanged
v3.9.83 defects. No actual phone, model, business data or external writes.
"""
from pathlib import Path
from urllib.parse import urlparse
import json,traceback,uuid,argparse
from playwright.sync_api import sync_playwright
parser=argparse.ArgumentParser();parser.add_argument('url',nargs='?',default='http://localhost:8841/');parser.add_argument('--baseline-proof',action='store_true');parser.add_argument('--artifacts',default='/tmp/solo-integrity84');args=parser.parse_args();BASE=args.url.rstrip('/')+'/';assert urlparse(BASE).hostname in ['localhost','127.0.0.1'];OUT=Path(args.artifacts);OUT.mkdir(exist_ok=True,parents=True);reports=[];baseline=args.baseline_proof
SETUP="""async()=>{const db=await import('./js/db.js');const c=await db.saveNew('customers',{name:'TEST Redteam Customer'},'TEST'),v=await db.saveNew('vehicles',{name:'TEST Redteam Vehicle'},'TEST');window.fixture={c:c.id,v:v.id};window.newWork=async(extra={})=>db.saveNew('work_records',{date:'2026-09-07',customer_id:c.id,vehicle_id:v.id,work_type:'Makine Çalışması',quantity:1,unit:'Saat',price_snapshot:{unit_price:1000,amount:1000,kdv_rate:20,kdv_included:false},...extra},'TEST');window.makeClaim=async(id)=>{const C=await import('./js/core.js'),w=await db.get('work_records',id),t=C.calcHakedisTotals([{work_record_id:w.id,quantity:w.quantity,unit:w.unit,unit_price:1000,kdv_rate:20,kdv_included:false}]);return db.createHakedis({hakedis_no:1,customer_id:w.customer_id,created_date:'2026-09-30',date_from:'2026-09-01',date_to:'2026-09-30',status:'Taslak',items:t.lines,subtotal:t.subtotal,kdv_total:t.kdv,grand_total:t.grand});};return window.fixture;}"""
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 def run(name,fn):
  c=b.new_context(viewport={'width':390,'height':850});c.add_init_script("localStorage.setItem('sp_role','boss')");external=[];errors=[]
  def route(r):
   if urlparse(r.request.url).hostname in ['localhost','127.0.0.1']:r.continue_()
   else:external.append(r.request.url);r.abort()
  c.route('**/*',route);p=c.new_page();p.on('pageerror',lambda e:errors.append(str(e)));url=BASE+'index.html?db=rt83_'+uuid.uuid4().hex[:12]
  try:
   p.goto(url+'#/daha');p.wait_for_selector('#screen[data-view-ready="1"]');p.evaluate(SETUP)
   result=fn(c,p,url);report={'name':name,'completed':True,'result':result,'page_errors':errors,'external_requests':external}
  except Exception as e:report={'name':name,'completed':False,'error':str(e),'trace':traceback.format_exc(),'page_errors':errors,'external_requests':external}
  reports.append(report);(OUT/'adversarial-results.json').write_text(json.dumps(reports,ensure_ascii=False,indent=2)+'\n');print(json.dumps(report,ensure_ascii=False),flush=True);c.close()
 def contamination(c,p,url):
  r=p.evaluate("""async()=>{const db=await import('./js/db.js'),U=await import('./js/undo.js');const before=U.beginUndo?U.beginUndo(db):await U.snapshot(db);const work=await newWork();if(U.beginUndo)before.track(work);const unrelated=await db.saveNew('expense_records',{date:'2026-09-07',category:'Diğer',amount:250,description:'TEST independently saved in another workflow'},'TEST independent');const plan=await U.saveUndo(db,before,'TEST one work');await U.applyUndo(db);return {unrelated_in_undo:!!plan.stores.expense_records?.added.some(x=>x.id===unrelated.id),unrelated_expense_deleted:!(await db.get('expense_records',unrelated.id)),work_deleted:!(await db.get('work_records',work.id))};}""")
  assert r=={'unrelated_in_undo':baseline,'unrelated_expense_deleted':baseline,'work_deleted':True},r;return {'protection_verified':not baseline,**r}
 run('UNDO-UNRELATED-WRITE',contamination)
 def undo_race(c,p,url):
  wid=p.evaluate("""async()=>{const db=await import('./js/db.js'),U=await import('./js/undo.js'),before=U.beginUndo?U.beginUndo(db):await U.snapshot(db),w=await newWork();if(U.beginUndo)before.track(w);await U.saveUndo(db,before,'TEST one work');return w.id;}""")
  q=c.new_page();q.goto(url+'#/daha');q.wait_for_selector('#screen[data-view-ready="1"]');q.evaluate(SETUP)
  p.evaluate("""()=>{window.__undoTask=(async()=>{const db=await import('./js/db.js'),U=await import('./js/undo.js');const delayed={...db,openDB:async()=>{window.__paused=true;await new Promise(r=>window.__release=r);return db.openDB();}};try{await U.applyUndo(delayed);return {applied:true};}catch(e){return {applied:false,error:e.message};}})();}""")
  p.wait_for_function('()=>window.__paused===true');claim=q.evaluate("""async id=>{const db=await import('./js/db.js'),h=await makeClaim(id);await db.finalizeHakedis(h.id);return h.id;}""",wid)
  p.evaluate('()=>window.__release()');result=p.evaluate('async()=>await window.__undoTask')
  state=p.evaluate("""async({wid,claim})=>{const db=await import('./js/db.js');return {source_deleted:!(await db.get('work_records',wid)),claim_status:(await db.get('hakedis',claim))?.status,ledger_remains:(await db.listActive('cari_movements')).some(x=>x.ref_id===claim)};}""",{'wid':wid,'claim':claim})
  assert result['applied']==baseline and state=={'source_deleted':baseline,'claim_status':'Kesinleşti','ledger_remains':True},(result,state)
  return {'protection_verified':not baseline,'instrumentation':'Delay adapter only at final openDB after genuine snapshot checks; actual two pages and IDB transactions',**result,**state}
 run('UNDO-AFTER-CLAIM-RACE',undo_race)
 def merge_race(c,p,url):
  ids=p.evaluate("""async()=>{const db=await import('./js/db.js'),M=await import('./js/merge-core.js'),target=await db.saveNew('customers',{name:'TEST Keep Customer'},'TEST'),first=await newWork();window.__mergePlan={store:'customers',...M.planMerge(await db.dumpAll(),[fixture.c],target.id)};return {source:fixture.c,target:target.id,first:first.id,vehicle:fixture.v};}""")
  q=c.new_page();q.goto(url+'#/daha');q.wait_for_selector('#screen[data-view-ready="1"]')
  later=q.evaluate("""async x=>(await(await import('./js/db.js')).saveNew('work_records',{date:'2026-09-08',customer_id:x.source,vehicle_id:x.vehicle,work_type:'Makine Çalışması',quantity:2,unit:'Saat',price_snapshot:{unit_price:1000,amount:2000,kdv_rate:20,kdv_included:false}},'TEST later other-page work')).id""",ids)
  r=p.evaluate("""async x=>{const db=await import('./js/db.js');let blocked=false;try{await(await import('./js/merge.js')).applyMerge(window.__mergePlan)}catch(e){blocked=true;}return {blocked,original_moved:(await db.get('work_records',x.first)).customer_id===x.target,later_still_old:(await db.get('work_records',x.later)).customer_id===x.source,source_deleted:!!(await db.get('customers',x.source)).deleted_at};}""",{**ids,'later':later})
  assert r=={'blocked':not baseline,'original_moved':baseline,'later_still_old':True,'source_deleted':baseline},r
  if not baseline:
   ok=p.evaluate("""async x=>{const db=await import('./js/db.js'),M=await import('./js/merge-core.js');await(await import('./js/merge.js')).applyMerge({store:'customers',...M.planMerge(await db.dumpAll(),[x.source],x.target)});return (await db.get('work_records',x.later)).customer_id===x.target;}""",{**ids,'later':later});assert ok
  return {'protection_verified':not baseline,**r}
 run('MERGE-LATE-WORK',merge_race)
 def trash_claim(c,p,url):
  r=p.evaluate("""async()=>{const db=await import('./js/db.js'),w=await newWork(),a=await makeClaim(w.id);await db.softDelete('hakedis',a.id,'TEST draft removed');const b=await makeClaim(w.id);let blocked=false;try{await db.restore('hakedis',a.id)}catch(e){blocked=true;}const claims=(await db.listActive('hakedis')).filter(h=>h.items.some(i=>i.work_record_id===w.id));let finalError;try{await db.finalizeHakedis(b.id)}catch(e){finalError=e.code}return {blocked,active_claims:claims.length,finalization_error:finalError||null};}""")
  assert r==({'blocked':False,'active_claims':2,'finalization_error':'HAKEDIS_SOURCE'} if baseline else {'blocked':True,'active_claims':1,'finalization_error':None}),r;return {'protection_verified':not baseline,**r}
 run('TRASH-DUPLICATE-CLAIM',trash_claim)
 def tank_delete(c,p,url):
  r=p.evaluate("""async()=>{const db=await import('./js/db.js'),C=await import('./js/core.js'),T=await import('./js/tank-timeline.js');const a=await db.saveNew('fuel_tank_movements',{date:'2026-09-07',move_type:'GİRİŞ',liters:100},'TEST');await db.saveFuelEvent({date:'2026-09-07',liters:80,vehicle_id:fixture.v,fuel_source:'Depo Tankı'},'TEST');const before=T.tankTimeline(await db.listActive('fuel_tank_movements'));let blocked=false;try{await db.deleteTankIn(a.id,'TEST duplicate intake')}catch(e){blocked=true;}const after=T.tankTimeline(await db.listActive('fuel_tank_movements'));return {blocked,before:before.remaining,after:after.remaining,deficits:after.deficits.length};}""")
  assert r==({'blocked':False,'before':20,'after':-80,'deficits':1} if baseline else {'blocked':True,'before':20,'after':20,'deficits':0}),r;return {'protection_verified':not baseline,**r}
 run('TANK-DELETE-HISTORY',tank_delete)
 def backup_id_xss(c,p,url):
  r=p.evaluate("""async()=>{const db=await import('./js/db.js'),B=await import('./js/backup.js'),C=await import('./js/core.js'),obj=await B.fullBackup(db,{encrypted:false,attachments:'none'});const id='bad\"><img src=x onerror=window.__redteamOnly=1><span x=\"';obj.data.work_records.push(C.newRecord({id,date:'2026-09-07',customer_id:fixture.c,vehicle_id:fixture.v,work_type:'TEST inert record',quantity:1,unit:'Saat',deleted_at:'2026-09-08T00:00:00Z'}));await B.restoreBackup(db,obj,false);return {accepted:!!(await db.get('work_records',id))};}""")
  p.goto(url+'#/cop');p.wait_for_selector('#screen[data-view-ready="1"]');p.wait_for_selector('[data-res]');p.wait_for_timeout(200);p.screenshot(path=str(OUT/'trash-id-html-injection-proof.png'),full_page=True)
  target=p.locator('[data-res]').first.get_attribute('data-res');flag=p.evaluate('window.__redteamOnly||0');assert r['accepted'] and flag==0;assert p.locator('[data-res] img[onerror]').count()==(1 if baseline else 0)
  if not baseline:
   p.click('[data-res]');p.wait_for_function("()=>!document.querySelector('[data-res]')")
  return {'html_injection_confirmed':baseline,'protection_verified':not baseline,'untrusted_record_id_restored':True,'script_execution_blocked_by_CSP':True,'XSS_not_proven':True,'restore_target':target,'payload_effect':'No data read/exfiltration; inline handler blocked by the real app CSP'}
 run('RESTORED-ID-HTML-INJECTION',backup_id_xss)
 if not baseline:
  def metadata_race(c,p,url):
   p.evaluate("""async()=>{const db=await import('./js/db.js'),U=await import('./js/undo.js'),scope=U.beginUndo(db);await scope.db.metaSet('fuel_ref_price',40);await U.saveUndo(db,scope,'TEST setting');window.__undoTask=U.applyUndo({...db,openDB:async()=>{window.__paused=true;await new Promise(r=>window.__release=r);return db.openDB();}}).then(()=>({applied:true}),e=>({applied:false,error:e.message}));}""")
   p.wait_for_function('()=>window.__paused===true');q=c.new_page();q.goto(url+'#/daha');q.wait_for_selector('#screen[data-view-ready="1"]');q.evaluate("async()=>await(await import('./js/db.js')).metaSet('fuel_ref_price',41)");p.evaluate('()=>window.__release()');result=p.evaluate('async()=>await window.__undoTask');assert not result['applied'];assert p.evaluate("async()=>await(await import('./js/db.js')).metaGet('fuel_ref_price')")==41
   return {'protection_verified':True,'other_page_setting_preserved':True}
  run('UNDO-METADATA-RACE',metadata_race)
  def enterprise_scope(c,p,url):
   result=p.evaluate("""async()=>{const db=await import('./js/db.js'),U=await import('./js/undo.js'),E=await import('./js/enterprise-db.js'),scope=U.beginUndo(db);const supplier=scope.track(await E.saveSupplier({name:'TEST Scope Supplier'}));const bill=scope.track(await E.savePayable({date:'2026-09-07',due_date:'2026-09-30',document_no:'TEST-SCOPE',party_type:'supplier',party_id:supplier.id,items:[{description:'TEST',quantity:1,unit:'Adet',unit_price:100,kdv_rate:0}]}));const other=await db.saveNew('expense_records',{date:'2026-09-07',category:'Diğer',amount:25,description:'TEST unrelated'},'TEST');const plan=await U.saveUndo(db,scope,'TEST supplier and bill');await U.applyUndo(db);return {own_supplier_removed:!(await db.get('suppliers',supplier.id)),own_bill_removed:!(await db.get('payables',bill.id)),unrelated_preserved:!!await db.get('expense_records',other.id),owned_count:plan.count};}""")
   assert result=={'own_supplier_removed':True,'own_bill_removed':True,'unrelated_preserved':True,'owned_count':2},result;return {'protection_verified':True,**result}
  run('ENTERPRISE-OWNERSHIP',enterprise_scope)
  def restore_control(c,p,url):
   result=p.evaluate("""async()=>{const db=await import('./js/db.js'),w=await newWork(),h=await makeClaim(w.id);await db.softDelete('hakedis',h.id,'TEST');await db.restore('hakedis',h.id);await db.finalizeHakedis(h.id);return (await db.get('hakedis',h.id)).status;}""");assert result=='Kesinleşti';return {'protection_verified':True,'valid_restored_draft_finalizes':True}
  run('VALID-CLAIM-RESTORE',restore_control)
 b.close()
assert all(r['completed'] for r in reports),reports
