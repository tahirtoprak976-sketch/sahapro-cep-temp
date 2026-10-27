"""Historical-fuel reconciliation: normal Chromium + real IndexedDB, synthetic TEST data only.

Run only in the approved CI browser runtime. No production data, source images,
provider calls, external network requests, or screenshots are used by this suite.
"""
import argparse
import json
import os
import uuid
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('url', nargs='?', default='http://localhost:8841/')
args = parser.parse_args()
URL = args.url.rstrip('/') + '/'
origin = urlparse(URL)
assert origin.scheme == 'http' and origin.hostname in ('localhost', '127.0.0.1', '::1'), 'Local synthetic server only'
assert not origin.username and not origin.password and not origin.query and not origin.fragment

INSTALL = r"""async ids => {
 const db=await import('./js/db.js'),C=await import('./js/core.js'),B=await import('./js/bulk-entry-core.js'),BD=await import('./js/bulk-entry-db.js'),H=await import('./js/historical-fuel-db.js'),BK=await import('./js/backup.js');
 const check=(ok,why)=>{if(!ok)throw Error(why);};
 const same=(a,b,why)=>check(JSON.stringify(a)===JSON.stringify(b),why+'; actual='+JSON.stringify(a)+' expected='+JSON.stringify(b));
 const snapshot=async()=>{const d=await db.readSnapshot({attachments:true,meta:false,drafts:true});delete d.captured_at;return JSON.stringify(d);};
 const rejected=async(fn,why)=>{const before=await snapshot();let error;try{await fn();}catch(e){error={code:e.code||null,message:e.message};}check(error,why+' must reject');same(await snapshot(),before,why+' must not change records/audit/drafts');return error;};
 const makeDraft=async({tag='MAIN',liters=90,scope=false,work=true,normal=false}={})=>{
  const chat='TEST-chat-'+tag;await db.metaSet('assistant_conversation_v1',{id:chat,turns:[],rev:1});
  const rows=[];
  if(work)rows.push({key:'work:0',kind:'work',source_key:'TEST-source-work-'+tag,quote:'TEST '+tag+' machine work',raw_message:'TEST '+tag+' machine work',labels:{customer_id:'TEST Fuel Customer',vehicle_id:'TEST Fuel Vehicle',personnel_id:'TEST Fuel Operator'},review:[],fields:{date:ids.day,customer_id:ids.customer,vehicle_id:ids.vehicle,personnel_id:ids.person,work_type:'Makine Çalışması',unit:'Saat',quantity:tag==='UNDO'?3:2,description:'TEST '+tag+' job description retained'}});
  rows.push({key:'fuel:0',kind:'fuel',source_key:'TEST-source-fuel-'+tag,quote:'TEST '+tag+' '+liters+' litre historical fuel',raw_message:'TEST '+tag+' '+liters+' litre historical fuel',labels:{vehicle_id:'TEST Fuel Vehicle',personnel_id:'TEST Fuel Operator'},review:[],fields:{date:ids.day,vehicle_id:ids.vehicle,personnel_id:ids.person,liters,fuel_source:'Depo Tankı',total:liters*70,unit_price:70,description:'TEST '+tag+' historical fuel evidence'}});
  if(normal)rows.push({key:'fuel:1',kind:'fuel',source_key:'TEST-source-normal-'+tag,quote:'TEST '+tag+' five litre normal fuel',raw_message:'TEST '+tag+' five litre normal fuel',labels:{vehicle_id:'TEST Fuel Vehicle',personnel_id:'TEST Fuel Operator'},review:[],fields:{date:ids.day,vehicle_id:ids.vehicle,personnel_id:ids.person,liters:5,fuel_source:'Depo Tankı',total:250,unit_price:50,description:'TEST normal five litres'}});
  const draft={version:1,id:'TEST-batch-'+tag,chat_id:chat,rev:0,status:'open',created_at:C.nowISO(),rows,answers:{},excluded:[],deselected:[],tank_confirmed:true,...(scope?{historical_fuel:{enabled:true,from:ids.day,to:ids.day,keys:['fuel:0'],approved_at:C.nowISO()}}:{})};
  return BD.saveBulkDraft(draft,{create:true});
 };
 const plan=async draft=>B.finalizeBulk(draft,await BD.loadBulkData(draft));
 const commit=async draft=>BD.commitBulk(draft,B.bulkSelectionToken(await plan(draft)));
 const addPast=(liters=100)=>db.saveNew('fuel_tank_movements',{date:ids.older,move_type:'GİRİŞ',liters,total:liters*50,unit_price:50},'TEST true past intake');
 window.HF={db,C,B,BD,H,BK,ids,check,same,snapshot,rejected,makeDraft,plan,commit,addPast};return true;
}"""
BOOTSTRAP = r"""async()=>{
 const db=await import('./js/db.js'),C=await import('./js/core.js');
 const today=C.todayStr(),day=C.addDays(today,-30),older=C.addDays(today,-31);
 const customer=await db.saveNew('customers',{name:'TEST Fuel Customer'},'TEST'),vehicle=await db.saveNew('vehicles',{name:'TEST Fuel Vehicle',type:'İş Makinesi'},'TEST'),person=await db.saveNew('personnel',{name:'TEST Fuel Operator'},'TEST');
 const oldWork=await db.saveNew('work_records',{date:older,customer_id:customer.id,vehicle_id:vehicle.id,personnel_id:person.id,work_type:'Makine Çalışması',unit:'Saat',quantity:1,description:'TEST previous customer job description',price_snapshot:{unit_price:1200,amount:1200,kdv_rate:20,kdv_included:true}},'TEST preserved old work');
 await db.saveNew('fuel_tank_movements',{date:older,move_type:'GİRİŞ',liters:20,total:1000,unit_price:50},'TEST small old intake');
 await db.saveNew('fuel_tank_movements',{date:today,move_type:'GİRİŞ',liters:500,total:25000,unit_price:50},'TEST later intake cannot fund past');
 return {today,day,older,customer:customer.id,vehicle:vehicle.id,person:person.id,oldWork:oldWork.id,oldWorkSnapshot:oldWork};
}"""

with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),args=['--no-sandbox'])
 errors=[];external=[]
 def profile():
  context=browser.new_context(viewport={'width':390,'height':850},service_workers='block')
  context.add_init_script("localStorage.setItem('sp_role','boss')")
  def route(request):
   p=urlparse(request.request.url)
   if (p.scheme,p.hostname,p.port)==(origin.scheme,origin.hostname,origin.port):request.continue_()
   else:external.append(request.request.url);request.abort()
  context.route('**/*',route)
  page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
  name='hf_'+uuid.uuid4().hex[:24]
  page.goto(URL+'index.html?db='+name+'#/daha');page.wait_for_selector('#screen[data-view-ready="1"]')
  return context,page,name
 def visit(page,name,route,ids=None):
  page.goto(URL+'README.md?db='+name)
  page.goto(URL+'index.html?db='+name+route);page.wait_for_selector('#screen[data-view-ready="1"]')
  assert 'Ekran yüklenirken hata' not in page.locator('#screen').inner_text(),page.locator('#screen').inner_text()
  if ids:page.evaluate(INSTALL,ids)
 def snapshot(page):return page.evaluate('()=>HF.snapshot()')
 def report(label,value=None):print('PASS '+label+(' '+json.dumps(value,ensure_ascii=False) if value is not None else ''),flush=True)
 context,page,name=profile()
 try:
  # Keep writes away from auto-refreshable routes; the only data are this fixture.
  page.goto(URL+'README.md?db='+name)
  ids=page.evaluate(BOOTSTRAP);page.evaluate(INSTALL,ids)
  guards=page.evaluate(r"""async()=>{
   const {db,ids,rejected,makeDraft,plan,check}=HF;
   const current=await rejected(()=>db.saveNew('fuel_records',{date:ids.today,vehicle_id:ids.vehicle,liters:99999,fuel_source:'Depo Tankı'},'TEST excessive current fuel'),'normal current stock guard');
   const historical=await rejected(()=>db.saveNew('fuel_records',{date:ids.day,vehicle_id:ids.vehicle,liters:30,fuel_source:'Depo Tankı'},'TEST later cannot fund past'),'normal historical timeline guard');
   const future=await rejected(()=>db.saveNew('fuel_records',{date:HF.C.addDays(ids.today,1),vehicle_id:ids.vehicle,liters:1,fuel_source:'Depo Tankı'},'TEST future fuel'),'future actual date guard');
   HF.draft=await makeDraft({normal:true});const p=await plan(HF.draft);check(p.rows.find(r=>r.key==='fuel:0').status==='waiting','old fuel never auto pending');check(!p.rows.some(r=>r.pending_fuel),'normal plan has no pending flags');
   const currentDraft={...HF.draft,historical_fuel:{enabled:true,from:ids.today,to:ids.today,keys:['fuel:0'],approved_at:HF.C.nowISO()},rows:HF.draft.rows.map(r=>r.kind==='fuel'?{...r,fields:{...r.fields,date:ids.today}}:r)};
   const currentPlan=await plan(currentDraft);check(!currentPlan.writes.length&&currentPlan.atomicBlocked,'current-day historical opt-in must block the whole selected batch');
   HF.legacyBackup=await HF.BK.fullBackup(db,{encrypted:false,attachments:'none'});HF.legacyBackup.schema_version=6;HF.legacyBackup.app_version='SAHAPRO SOLO v3.9.73';delete HF.legacyBackup.data.pending_fuel_records;for(const rows of Object.values(HF.legacyBackup.data))for(const row of rows)if('schema_version' in row)row.schema_version=6;
   return {current:current.message,historical:historical.message,future:future.message};
  }""")
  report('unchanged normal stock, past-vs-later, future and current-day opt-in guards, no automatic opt-in',guards)
  legacy_backup=page.evaluate('HF.legacyBackup')
  # Render the actual bulk review UI and select bounded history + one exact fuel row.
  visit(page,name,'#/daha',ids)
  page.evaluate(r"""async()=>{const {db,BD}=HF;HF.draft=await BD.readBulkDraft();const {openBulkReview}=await import('./js/bulk-entry-ui.js');const root=document.querySelector('#screen'),out=document.createElement('div');root.append(out);await openBulkReview({root,db},out,HF.draft);} """)
  page.locator('[data-historical-options]').evaluate('(el)=>el.open=true')
  page.fill('[data-history-from]',ids['day']);page.fill('[data-history-to]',ids['day']);page.click('[data-history-enable]')
  page.wait_for_selector('[data-history-pending="1"]')
  assert page.locator('[data-bulk-save]').is_disabled(),'mixed batch must not silently save work while selected old fuel is unresolved'
  page.check('[data-history-pending="1"]');page.wait_for_function("()=>!document.querySelector('[data-bulk-save]').disabled")
  before=snapshot(page)
  page.click('[data-bulk-save]');page.wait_for_selector('#sheet-root [data-x="0"]');page.click('#sheet-root [data-x="0"]')
  page.wait_for_function("()=>!document.querySelector('[data-bulk-save]').disabled")
  assert snapshot(page)==before,'cancel bulk confirmation changed records or audit'
  report('explicit date-bounded single-row opt-in and cancelled mixed-batch confirmation write nothing')
  page.click('[data-bulk-save]');page.wait_for_selector('#sheet-root [data-x="1"]')
  page.evaluate("location.hash='#/isler'");page.wait_for_function("()=>!document.querySelector('[data-bulk-review]')&&document.querySelector('#screen')?.dataset.viewReady==='1'")
  if page.locator('#sheet-root [data-x="1"]').count():page.locator('#sheet-root [data-x="1"]').click()
  assert snapshot(page)==before,'stale batch approval after navigation must not write'
  visit(page,name,'#/daha',ids)
  page.evaluate(r"""async()=>{const {db,BD}=HF;HF.draft=await BD.readBulkDraft();const {openBulkReview}=await import('./js/bulk-entry-ui.js');const root=document.querySelector('#screen'),out=document.createElement('div');root.append(out);await openBulkReview({root,db},out,HF.draft);} """)
  report('navigation while batch confirmation is open cannot approve detached stale selection')
  # Synchronous IDB add fault after a work add has been queued must abort everything.
  page.evaluate(r"""async()=>{const {BD,commit,rejected}=HF;HF.draft=await BD.readBulkDraft();const original=IDBObjectStore.prototype.add;try{IDBObjectStore.prototype.add=function(value,...rest){if(this.name==='pending_fuel_records')throw new DOMException('TEST injected pending add failure','AbortError');return original.call(this,value,...rest);};await rejected(()=>commit(HF.draft),'atomic work+pending+actual batch rollback');}finally{IDBObjectStore.prototype.add=original;}}""")
  report('injected pending-store add failure rolls back earlier work and normal fuel writes atomically')
  page.click('[data-bulk-save]');page.wait_for_selector('#sheet-root [data-x="1"]');page.click('#sheet-root [data-x="1"]')
  page.wait_for_selector('[data-bulk-receipt]')
  saved=page.evaluate(r"""async()=>{
   const {db,C,check,same,ids,BK}=HF,d=await db.dumpAll(),pending=d.pending_fuel_records.filter(x=>x.reconciliation_status==='pending'),actual=d.fuel_records.filter(C.isActive),work=d.work_records.find(w=>w.bulk_source?.key==='TEST-source-work-MAIN');
   check(pending.length===1&&actual.length===1,'one pending plus one selected normal actual fuel');check(work,'mixed batch preserves work');check(pending[0].liters===90&&pending[0].personnel_id===ids.person&&pending[0].vehicle_id===ids.vehicle&&pending[0].date===ids.day,'pending amounts and owners preserved');
   check(pending[0].total===null&&pending[0].unit_price===null&&!pending[0].event_id&&!pending[0].tank_movement_id,'pending cannot carry real stock/cost');
   same(pending[0].reconciliation.source_amounts,{total:6300,unit_price:70},'source money preserved, not booked');
   check(d.fuel_tank_movements.filter(m=>m.move_type==='ÇIKIŞ').length===1,'only normal selected fuel has stock exit');check(d.cash_records.length===0&&d.payables.length===0&&d.cari_movements.length===0,'pending adds no cash/debt');
   same(await db.get('work_records',ids.oldWork),ids.oldWorkSnapshot,'existing work exact preservation');
   const {costRows,costTotals}=await import('./js/costs-core.js');check(costTotals(costRows(d)).total===0,'pending source money never becomes cost; normal bulk fuel retains baseline unknown cost');
   const {customerReportData}=await import('./js/customer-report.js'),R=customerReportData(d,ids.customer,{to:ids.today});check(R.works.some(w=>w.id===ids.oldWork&&w.note==='TEST previous customer job description'),'customer report retains old description');check(R.works.some(w=>w.id===work.id&&w.note==='TEST MAIN job description retained'),'new work description reaches customer report');
   const {buildReport,reportSpec}=await import('./js/report-core.js');check(JSON.stringify(reportSpec(buildReport(d,{k:'yakit',id:ids.vehicle,to:ids.today}))).includes('mutabakat'),'fuel report flags incompleteness');
   HF.pendingId=pending[0].id;HF.backup=await BK.fullBackup(db,{encrypted:false,attachments:'none'});check(HF.backup.data.pending_fuel_records.length===1,'backup includes pending collection');
   return {pending:pending[0].id,work:work.id,pendingLiters:90,actualLiters:actual[0].liters,knownCost:0};
  }""")
  report('one atomic mixed commit preserves works/source data, pending adds no stock, money or cost, reports disclose incompleteness',saved)
  backup=page.evaluate('HF.backup')
  replay=page.evaluate(r"""async()=>{
   const {db,BD,B,plan,commit,rejected,check,ids}=HF,done=await db.metaGet(BD.BULK_KEY),p=await plan(done);check(!p.writes.length,'same source plan cannot replay');
   await rejected(()=>commit(done),'replayed completed batch');
   const pending=await db.get('pending_fuel_records',HF.pendingId);
   await rejected(()=>db.saveNew('fuel_records',{date:ids.day,vehicle_id:ids.vehicle,personnel_id:ids.person,liters:90,fuel_source:'Depo Tankı'},'TEST bypass'),'ordinary direct fuel cannot duplicate pending source');
   await rejected(()=>db.saveNew('pending_fuel_records',pending,'TEST generic pending creation'),'pending generic creation gate');
   await rejected(()=>db.saveExisting('pending_fuel_records',pending,{liters:1},'TEST generic pending edit'),'pending generic edit gate');
   await rejected(()=>db.put('pending_fuel_records',{...pending,liters:1}),'pending direct put gate');
   await rejected(()=>db.updateIf('pending_fuel_records',pending.id,()=>true,{liters:1},'TEST conditional pending edit'),'pending conditional update gate');
   const {planMergeCards}=await import('./js/merge-core.js'),{applyMerge}=await import('./js/merge.js');
   for(const [store,key]of [['vehicles','vehicle'],['personnel','person']]){
    const target=await db.saveNew(store,{name:'TEST merge target '+store},'TEST');
    const current=await db.dumpAll(),stalePlan=planMergeCards({...current,pending_fuel_records:[]},store,[ids[key]],target.id);
    await rejected(()=>applyMerge(stalePlan),'fresh-transaction pending owner merge guard '+store);
    await rejected(()=>db.softDelete(store,ids[key],'TEST protected owner'),'pending owner soft delete guard '+store);
   }
   const review=await HF.H.reviewPendingFuel(pending.id);check(!review.canReconcile,'later intake cannot fund past');return {writes:p.writes.length,blocked:review.error};
  }""")
  report('replay, ordinary source duplication and generic pending edits are blocked; later-only stock does not reconcile',replay)
  # Durable across ordinary refresh, then restore the actual export in a fresh DB.
  visit(page,name,'#/yakit',ids)
  assert page.locator('[data-operation-record]').count()==1,'pending is not an actual fuel row'
  assert page.locator('[data-pending-fuel-banner]').count()==1
  assert '90 L' in page.locator('[data-pending-fuel-banner]').inner_text()
  page.reload();page.wait_for_selector('#screen[data-view-ready="1"]');page.evaluate(INSTALL,ids)
  assert page.evaluate('(id)=>HF.db.get("pending_fuel_records",id)',saved['pending'])==backup['data']['pending_fuel_records'][0]
  restore_context,restore_page,restore_name=profile()
  try:
   restore_page.goto(URL+'README.md?db='+restore_name)
   restored=restore_page.evaluate(r"""async backup=>{const db=await import('./js/db.js'),B=await import('./js/backup.js');await B.restoreBackup(db,backup,false);const d=await db.dumpAll();return {pending:d.pending_fuel_records,work:d.work_records.find(w=>w.bulk_source?.key==='TEST-source-work-MAIN'),fuel:d.fuel_records.length};}""",backup)
   assert restored['pending']==backup['data']['pending_fuel_records']
   assert restored['work']['id']==saved['work'] and restored['fuel']==1
  finally:restore_context.close()
  legacy_context,legacy_page,legacy_name=profile()
  try:
   legacy_page.goto(URL+'README.md?db='+legacy_name)
   legacy=legacy_page.evaluate(r"""async backup=>{const db=await import('./js/db.js'),B=await import('./js/backup.js');await B.restoreBackup(db,backup,false);const d=await db.dumpAll();return {pending:d.pending_fuel_records,work:d.work_records};}""",legacy_backup)
   assert legacy['pending']==[],'schema 6 backup restores an empty pending collection'
   assert any(w==next(r for r in legacy_backup['data']['work_records'] if r['id']==ids['oldWork']) for w in legacy['work']),'legacy restore preserves old work bytes'
  finally:legacy_context.close()
  report('pending survives refresh and supported backup restore; legacy schema 6 backup starts with an empty pending collection')
  visit(page,name,'#/depo',ids)
  assert 'fiziksel deponun eksi olduğu anlamına gelmez' in page.locator('[data-pending-fuel-projection]').first.inner_text()
  for width in [320,390,768]:
   page.set_viewport_size({'width':width,'height':850})
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),'pending tank panel must fit '+str(width)
  page.set_viewport_size({'width':390,'height':850})
  before=snapshot(page);page.click('[data-review-pending-fuel="'+saved['pending']+'"]')
  page.wait_for_selector('[data-pending-fuel-review]')
  assert page.locator('[data-pending-fuel-confirm]').count()==0,'history deficit cannot expose promotion'
  assert 'yalnız kaynak bilgisi' in page.locator('[data-pending-fuel-review]').inner_text()
  page.click('[data-pending-fuel-close]');assert snapshot(page)==before
  page.evaluate(r"""async()=>{const {db,H,addPast,ids,check}=HF;await addPast(100);const unknown=await db.saveNew('fuel_tank_movements',{date:ids.older,move_type:'GİRİŞ',liters:1},'TEST unknown historical cost');const pending=(await db.getAll('pending_fuel_records')).find(x=>x.reconciliation_status==='pending');const review=await H.reviewPendingFuel(pending.id);check(!review.canReconcile&&/maliyet/.test(review.error),'adequate stock but unknown historical intake cost blocks promotion');await db.saveExisting('fuel_tank_movements',unknown,{total:50,unit_price:50},'TEST verified original intake cost');}""")
  report('adequate historical quantity with an unpriced intake still blocks promotion until cost is verified')
  visit(page,name,'#/depo',ids)
  before=snapshot(page);page.click('[data-review-pending-fuel="'+saved['pending']+'"]');page.wait_for_selector('[data-pending-fuel-confirm]')
  page.click('[data-pending-fuel-confirm]');page.wait_for_selector('[data-pending-approval="no"]');page.click('[data-pending-approval="no"]');page.wait_for_selector('[data-pending-fuel-review]')
  assert snapshot(page)==before,'cancel promotion changed records or audit'
  page.click('[data-pending-fuel-close]')
  report('real pending UI labels source money and projection, fits narrow widths, blocks insufficient history, cancels promotion without writes')
  page.click('[data-review-pending-fuel="'+saved['pending']+'"]');page.wait_for_selector('[data-pending-fuel-confirm]');page.click('[data-pending-fuel-confirm]');page.wait_for_selector('[data-pending-approval="yes"]')
  page.evaluate("location.hash='#/yakit'");page.wait_for_function("()=>!document.querySelector('[data-pending-approval]')&&document.querySelector('[data-operation-summary]')")
  assert snapshot(page)==before,'navigation out of promotion confirmation must not write'
  visit(page,name,'#/depo',ids)
  report('promotion approval closes on navigation and leaves every record unchanged')
  race=page.evaluate(r"""async id=>{
   const {db,H,addPast,rejected,check,same,ids}=HF;
   const stale=await H.reviewPendingFuel(id);check(stale.canReconcile,'past real input enables review');await addPast(1);
   await rejected(()=>H.reconcilePendingFuel(id,stale.token),'stale token after another intake');
   let review=await H.reviewPendingFuel(id);const original=IDBObjectStore.prototype.add;
   try{IDBObjectStore.prototype.add=function(value,...rest){if(this.name==='fuel_tank_movements')throw new DOMException('TEST injected exit failure','AbortError');return original.call(this,value,...rest);};await rejected(()=>H.reconcilePendingFuel(id,review.token),'promotion add failure rollback');}finally{IDBObjectStore.prototype.add=original;}
   review=await H.reviewPendingFuel(id);const results=await Promise.all([H.reconcilePendingFuel(id,review.token),H.reconcilePendingFuel(id,review.token)]);same(results.map(x=>x.id),[id,id],'concurrent replay returns same identity');
   const d=await db.dumpAll(),actual=d.fuel_records.filter(x=>x.id===id),moves=d.fuel_tank_movements.filter(x=>x.fuel_record_id===id),pending=d.pending_fuel_records.find(x=>x.id===id);
   check(actual.length===1&&moves.length===1&&pending.reconciliation_status==='reconciled','exactly one atomic promotion');check(actual[0].total===4500&&actual[0].unit_price===50,'real historical cost, not source quotation 6300');check(actual[0].personnel_id===ids.person,'operator preserved');
   same(await db.get('work_records',ids.oldWork),ids.oldWorkSnapshot,'promotion does not rewrite old work');check(d.cash_records.length===0&&d.payables.length===0&&d.cari_movements.length===0,'promotion is not cash or customer debt');
   const before=await HF.snapshot();await H.reconcilePendingFuel(id,review.token);same(await HF.snapshot(),before,'later idempotent replay adds no audit or stock');
   check(pending.reconciliation.reconcile_token.length<=128,'stored replay token is a bounded hash');
   const ordinary=d.fuel_records.find(f=>f.id!==id),ordinaryMove=d.fuel_tank_movements.find(m=>m.fuel_record_id===ordinary.id),unlinked=d.fuel_tank_movements.find(m=>!m.fuel_record_id);
   await rejected(()=>db.saveNew('fuel_records',{date:ids.day,vehicle_id:ids.vehicle,liters:1,fuel_source:'Depo Tankı',historical_pending_id:id},'TEST forged promotion marker'),'normal constructor cannot forge historical identity');
   await rejected(()=>db.saveNew('fuel_tank_movements',{date:ids.older,move_type:'GİRİŞ',liters:1,fuel_record_id:id},'TEST forged linked intake'),'normal movement constructor cannot forge reciprocal link');
   await rejected(()=>db.saveExisting('fuel_records',ordinary,{historical_pending_id:id},'TEST forged existing fuel marker'),'ordinary existing fuel cannot gain historical identity');
   await rejected(()=>db.updateIf('fuel_records',ordinary.id,()=>true,{historical_pending_id:id},'TEST forged conditional marker'),'ordinary conditional fuel cannot gain historical identity');
   for(const target of [ordinaryMove,unlinked]){
    await rejected(()=>db.put('fuel_tank_movements',{...target,fuel_record_id:id}),'raw movement old and new target protected');
    await rejected(()=>db.saveExisting('fuel_tank_movements',target,{fuel_record_id:id},'TEST forged existing move link'),'existing movement cannot gain historical link');
    await rejected(()=>db.updateIf('fuel_tank_movements',target.id,()=>true,{fuel_record_id:id},'TEST forged conditional move link'),'conditional movement cannot gain historical link');
   }
   await rejected(()=>db.put('fuel_records',{...actual[0],total:1}),'historical actual direct put guard');
   await rejected(()=>db.updateIf('fuel_records',id,()=>true,{total:1},'TEST conditional actual edit'),'historical actual conditional update guard');
   await rejected(()=>db.saveExisting('fuel_records',actual[0],{total:1},'TEST changed historic price'),'historical actual price guard');
   await rejected(()=>db.saveExisting('fuel_records',actual[0],{personnel_id:null},'TEST changed historical operator'),'historical actual operator identity guard');
   await rejected(()=>db.put('fuel_tank_movements',{...moves[0],liters:1}),'historical actual movement direct put guard');
   await rejected(()=>db.updateIf('fuel_tank_movements',moves[0].id,()=>true,{personnel_id:null},'TEST changed move operator'),'historical actual movement conditional guard');
   await rejected(()=>db.saveExisting('fuel_tank_movements',moves[0],{liters:1},'TEST changed linked exit'),'historical actual movement save guard');
   await rejected(()=>import('./js/undo.js').then(m=>m.applyUndo(db)),'undo cannot erase promoted pending batch');
   await db.saveNew('fuel_tank_movements',{date:ids.older,move_type:'GİRİŞ',liters:100,total:10000,unit_price:100},'TEST subsequent verified input');
   await db.fillTankFuelCosts();await db.repairTankPrices();same(await db.get('fuel_records',id),actual[0],'cost fill/repair does not reprice frozen historical reconciliation');
   await db.saveExisting('fuel_records',actual[0],{description:'TEST harmless note edited after reconciliation'},'TEST note only');const noted=await db.get('fuel_records',id);check(noted.description==='TEST harmless note edited after reconciliation'&&noted.total===4500&&noted.personnel_id===ids.person,'editorial note allowed without changing historical identity or cost');
   return {actual:actual.length,moves:moves.length,cost:actual[0].total,status:pending.reconciliation_status};
  }""",saved['pending'])
  report('stale token, injected rollback, simultaneous promotion, immutable costs/identity and protected movements',race)
  page.evaluate(r"""async backup=>{await HF.rejected(()=>HF.BK.restoreBackup(HF.db,backup,true),'stale pending backup cannot overwrite reconciled current state');}""",backup)
  report('stale pending backup replace cannot erase completed reconciliation')
  # Undo preserves a cancelled source tombstone, rather than reviving input eligibility.
  page.goto(URL+'README.md?db='+name);page.evaluate(INSTALL,ids)
  page.evaluate(r"""async()=>{const {db,makeDraft,commit,plan,check,same,ids}=HF;const draft=await makeDraft({tag:'UNDO',liters:7,scope:true});const result=await commit(draft),id=result.saved.find(r=>r.store==='pending_fuel_records').id;await (await import('./js/undo.js')).applyUndo(db);const row=await db.get('pending_fuel_records',id);check(row?.reconciliation_status==='cancelled','undo retains a cancelled pending source tombstone');check(!(await plan(draft)).writes.length,'undo cannot revive source eligibility');same(await db.get('work_records',ids.oldWork),ids.oldWorkSnapshot,'undo does not affect existing work');}""")
  report('undo cancels pending source durably and replay remains blocked')
  # A different explicitly reviewed source verifies the affirmative UI action too.
  page.goto(URL+'README.md?db='+name);page.evaluate(INSTALL,ids)
  second=page.evaluate(r"""async()=>{const {makeDraft,commit,db}=HF;const d=await makeDraft({tag:'UI',liters:15,scope:true,work:false});const result=await commit(d);return result.saved.find(r=>r.store==='pending_fuel_records').id;}""")
  visit(page,name,'#/depo',ids)
  page.click('[data-review-pending-fuel="'+second+'"]');page.wait_for_selector('[data-pending-fuel-confirm]');page.click('[data-pending-fuel-confirm]');page.wait_for_selector('[data-pending-approval="yes"]');page.click('[data-pending-approval="yes"]')
  page.wait_for_url('**#/yakit/'+second);page.wait_for_selector('#screen[data-view-ready="1"]');page.evaluate(INSTALL,ids)
  final=page.evaluate(r"""async id=>{const d=await HF.db.dumpAll();HF.check(d.fuel_records.filter(r=>r.id===id).length===1&&d.fuel_tank_movements.filter(r=>r.fuel_record_id===id).length===1,'affirmative UI once');HF.same(await HF.db.get('work_records',HF.ids.oldWork),HF.ids.oldWorkSnapshot,'final old work preserved');return {actual:d.fuel_records.length,pending:d.pending_fuel_records.filter(r=>r.reconciliation_status==='pending').length,cash:d.cash_records.length};}""",second)
  assert final=={'actual':3,'pending':0,'cash':0},final
  report('affirmative UI promotes same identity exactly once; old jobs intact and no cash side effects',final)
  assert not external,'unexpected external requests: '+str(external)
  assert not errors,'uncaught browser errors: '+str(errors)
  print('HISTORICAL FUEL BROWSER PASS: all synthetic invariants and approval flows passed',flush=True)
 finally:
  context.close();browser.close()
