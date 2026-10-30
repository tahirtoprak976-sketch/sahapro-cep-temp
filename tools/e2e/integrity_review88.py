"""Adversarial write-boundary tests. Local synthetic profiles only; no business data.

--baseline-proof expects the unchanged v3.9.87 defects, never a release pass.
"""
import argparse,json,traceback,uuid
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('url',nargs='?',default='http://localhost:8841/')
parser.add_argument('--baseline-proof',action='store_true')
parser.add_argument('--artifacts',default='/tmp/solo-integrity88')
args=parser.parse_args();BASE=args.url.rstrip('/')+'/';origin=urlparse(BASE)
assert origin.scheme=='http' and origin.hostname in ('localhost','127.0.0.1') and not origin.username and not origin.query and not origin.fragment
OUT=Path(args.artifacts);OUT.mkdir(parents=True,exist_ok=True);reports=[];baseline=args.baseline_proof
SETUP=r"""async()=>{
 const db=await import('./js/db.js'),C=await import('./js/core.js');
 const c=await db.saveNew('customers',{name:'TEST Integrity88 Customer'},'TEST'),v=await db.saveNew('vehicles',{name:'TEST Integrity88 Machine'},'TEST');
 window.F={c:c.id,v:v.id};window.work=async extra=>db.saveNew('work_records',{date:'2026-09-07',customer_id:c.id,vehicle_id:v.id,work_type:'Makine Çalışması',quantity:1,unit:'Saat',price_snapshot:{unit_price:1000,amount:1000,kdv_rate:20,kdv_included:false},...extra},'TEST');
 window.claim=async w=>{const t=C.calcHakedisTotals([{...w.price_snapshot,work_record_id:w.id,quantity:w.quantity,unit:w.unit}]);return db.createHakedis({customer_id:w.customer_id,created_date:'2026-09-30',date_from:'2026-09-01',date_to:'2026-09-30',status:'Taslak',items:t.lines,subtotal:t.subtotal,kdv_total:t.kdv,grand_total:t.grand});};
 window.snapshot=async()=>{const s=await db.readSnapshot({attachments:true,meta:true,drafts:true});delete s.captured_at;return JSON.stringify(s);};
 window.signedSlip=async()=>{const D=await import('./js/digital-slip-db.js'),P=await import('./tests/support/attachment-fixtures.mjs');const r=await D.createDigitalSlip({date:'2026-09-08',customer_id:c.id,vehicle_id:v.id,quantity:1,unit:'Saat',work_text:'Makine Çalışması'},{key:crypto.randomUUID(),allow_separate:true});await db.signSlip(r.slip.id,new File([P.PNG],'TEST-signature.png',{type:'image/png'}));return {s:await db.get('slips',r.slip.id),w:await db.get('work_records',r.works[0].id)};};
}"""
with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 def run(name,fn,setup=True):
  ctx=browser.new_context(viewport={'width':390,'height':850});ctx.add_init_script("localStorage.setItem('sp_role','boss')");errors=[];external=[]
  def route(r):
   if urlparse(r.request.url).hostname in ('localhost','127.0.0.1'):r.continue_()
   else:external.append(r.request.url);r.abort()
  ctx.route('**/*',route);p=ctx.new_page();p.on('pageerror',lambda e:errors.append(str(e)));url=BASE+'index.html?db=rt88_'+uuid.uuid4().hex[:24]
  try:
   p.goto(url+'#/daha');p.wait_for_selector('#screen[data-view-ready="1"]')
   if setup:p.evaluate(SETUP)
   result=fn(ctx,p,url);assert not errors and not external,(errors,external)
   report={'name':name,'passed':True,'result':result}
  except Exception as e:report={'name':name,'passed':False,'error':str(e),'trace':traceback.format_exc(),'page_errors':errors,'external_requests':external}
  reports.append(report);(OUT/'results.json').write_text(json.dumps({'baseline_proof':baseline,'scenarios':reports},ensure_ascii=False,indent=2)+'\n');print(json.dumps(report,ensure_ascii=False),flush=True);ctx.close()
 def conditional_claim(ctx,p,url):
  r=p.evaluate(r"""async()=>{const db=await import('./js/db.js'),w=await work(),h=await claim(w),before=await snapshot();let blocked=false,error;try{await db.updateIf('work_records',w.id,x=>!x.price_snapshot?.locked,{customer_fuel_allowance_l:75,price_snapshot:{unit_price:0,amount:0,kdv_rate:0,price_source:'Mazot karşılığı'}},'TEST actual fuel-fix write path')}catch(e){blocked=true;error=e.code}return {blocked,error:error||null,unchanged:before===await snapshot(),source_amount:(await db.get('work_records',w.id)).price_snapshot.amount,claim_amount:(await db.get('hakedis',h.id)).grand_total};}""")
  assert r['blocked']==(not baseline) and r['unchanged']==(not baseline) and r['source_amount']==(0 if baseline else 1000) and r['claim_amount']==1200,r
  return r
 run('CONDITIONAL-WRITE-DRAFT-CLAIM',conditional_claim)
 def slip_delete(ctx,p,url):
  r=p.evaluate(r"""async()=>{const db=await import('./js/db.js'),{s,w}=await signedSlip(),before=await snapshot();let blocked=false;try{await db.softDelete('work_records',w.id,'TEST signed source deletion')}catch(e){blocked=true}return {blocked,unchanged:before===await snapshot(),job_visible:!(await db.get('work_records',w.id)).deleted_at,slip_signed:(await db.get('slips',s.id)).status==='İmzalandı'};}""")
  assert r=={'blocked':not baseline,'unchanged':not baseline,'job_visible':not baseline,'slip_signed':True},r;return r
 run('SIGNED-SLIP-SOURCE-DELETE',slip_delete)
 def slip_change(ctx,p,url):
  r=p.evaluate(r"""async()=>{const db=await import('./js/db.js'),{s,w}=await signedSlip(),before=await snapshot();let blocked=false;try{await db.saveExisting('work_records',w,{quantity:2},'TEST signed source edit')}catch(e){blocked=true}return {blocked,unchanged:before===await snapshot(),job_quantity:(await db.get('work_records',w.id)).quantity,slip_quantity:(await db.get('slips',s.id)).quantity};}""")
  assert r=={'blocked':not baseline,'unchanged':not baseline,'job_quantity':2 if baseline else 1,'slip_quantity':1},r;return r
 run('SIGNED-SLIP-SOURCE-EDIT',slip_change)
 def backup_race(ctx,p,url):
  p.evaluate(r"""async()=>{const db=await import('./js/db.js'),B=await import('./js/backup.js');const w=await work();window.backupWork=w;const obj=await B.fullBackup(db,{encrypted:false,attachments:'none'});obj.data.work_records.find(x=>x.id===w.id).description='TEST old backup overwrite';let opens=0;window.restoreTask=B.restoreBackup({...db,openDB:async()=>{if(++opens===2){window.restorePaused=true;await new Promise(r=>window.restoreRelease=r);}return db.openDB();}},obj,true).then(()=>({applied:true}),e=>({applied:false,error:e.message}));}""")
  p.wait_for_function('()=>window.restorePaused===true');q=ctx.new_page();q.goto(url+'#/daha');q.wait_for_selector('#screen[data-view-ready="1"]')
  wid=p.evaluate('backupWork.id');q.evaluate(r"""async id=>{const db=await import('./js/db.js'),w=await db.get('work_records',id);await db.saveExisting('work_records',w,{description:'TEST newer other-page note'},'TEST concurrent edit');}""",wid)
  p.evaluate('()=>window.restoreRelease()');result=p.evaluate('async()=>await window.restoreTask');note=p.evaluate("async id=>(await(await import('./js/db.js')).get('work_records',id)).description",wid)
  assert result['applied']==baseline and note==('TEST old backup overwrite' if baseline else 'TEST newer other-page note'),(result,note)
  return {**result,'note':note,'actual_two_page_transaction_race':True}
 run('RESTORE-OTHER-PAGE-EDIT',backup_race)
 def revised_signature(ctx,p,url):
  r=p.evaluate(r"""async()=>{const db=await import('./js/db.js'),B=await import('./js/backup.js'),{s,w}=await signedSlip();await db.saveExisting('slips',s,{status:'Revize'},'TEST explicit revision');const backup=await B.fullBackup(db,{encrypted:false,attachments:'base64'});backup.data.slips.find(x=>x.id===s.id).quantity=9;const before=await snapshot();let blocked=false;try{await B.restoreBackup(db,backup,true)}catch(e){blocked=true}return {blocked,unchanged:before===await snapshot(),signed_quantity:(await db.get('slips',s.id)).quantity,source_quantity:(await db.get('work_records',w.id)).quantity};}""")
  assert r=={'blocked':not baseline,'unchanged':not baseline,'signed_quantity':9 if baseline else 1,'source_quantity':1},r;return r
 run('RESTORE-REVISED-SIGNATURE',revised_signature)
 def fresh_card_race(ctx,p,url):
  p.evaluate(r"""async()=>{const db=await import('./js/db.js'),B=await import('./js/backup.js');const old=(await db.listActive('vehicles'))[0];window.restoreVehicle=old.id;const obj=await B.fullBackup(db,{encrypted:false,attachments:'none'});obj.data=JSON.parse(JSON.stringify(obj.data).replaceAll(old.id,'TEST-RESTORED-VEHICLE-88'));let opens=0;window.restoreTask=B.restoreBackup({...db,openDB:async()=>{if(++opens===2){window.restorePaused=true;await new Promise(r=>window.restoreRelease=r);}return db.openDB();}},obj,false).then(()=>({applied:true}),e=>({applied:false,error:e.message}));}""")
  p.wait_for_function('()=>window.restorePaused===true');q=ctx.new_page();q.goto(url+'#/daha');q.wait_for_selector('#screen[data-view-ready="1"]')
  vehicle=p.evaluate('restoreVehicle');mid=q.evaluate(r"""async vehicle=>(await(await import('./js/db.js')).saveNew('maintenance_records',{date:'2026-09-07',vehicle_id:vehicle,type:'Bakım',description:'TEST other-page service history',cost:50},'TEST')).id""",vehicle)
  p.evaluate('()=>window.restoreRelease()');result=p.evaluate('async()=>await window.restoreTask');state=p.evaluate(r"""async x=>{const db=await import('./js/db.js');return {vehicle_present:!!await db.get('vehicles',x.vehicle),service_present:!!await db.get('maintenance_records',x.mid)}}""",{'vehicle':vehicle,'mid':mid})
  assert result['applied']==baseline and state=={'vehicle_present':not baseline,'service_present':True},(result,state)
  return {**result,**state,'actual_two_page_transaction_race':True}
 run('RESTORE-FRESH-DEVICE-NEW-SERVICE',fresh_card_race,False)
 def signing_race(ctx,p,url):
  slip=p.evaluate(r"""async()=>{const db=await import('./js/db.js'),D=await import('./js/digital-slip-db.js');const r=await D.createDigitalSlip({date:'2026-09-09',customer_id:F.c,vehicle_id:F.v,work_text:'Makine Çalışması',quantity:1,unit:'Saat'},{key:'TEST-SIGNING-RACE'});window.raceSlip=r.slip;return r.slip.id;}""")
  p.evaluate(r"""()=>{const original=IDBObjectStore.prototype.get;let hit=false;window.restoreGet=()=>IDBObjectStore.prototype.get=original;IDBObjectStore.prototype.get=function(key){const req=original.call(this,key);if(!hit&&this.name==='vehicles'&&key===F.v){hit=true;Object.defineProperty(req,'onsuccess',{set(handler){req.addEventListener('success',event=>{window.signPaused=true;window.signRelease=()=>handler.call(req,event)})}})}return req};window.editTask=(async()=>{try{const db=await import('./js/db.js');await db.saveExisting('slips',raceSlip,{status:'İptal'},'TEST stale cancellation');return {applied:true}}catch(e){return {applied:false,error:e.message}}finally{restoreGet()}})();}""")
  p.wait_for_function('()=>window.signPaused===true');q=ctx.new_page();q.goto(url+'#/daha');q.wait_for_selector('#screen[data-view-ready="1"]')
  signed=q.evaluate(r"""async id=>{const db=await import('./js/db.js'),P=await import('./tests/support/attachment-fixtures.mjs');return db.signSlip(id,new File([P.PNG],'TEST-signature.png',{type:'image/png'}));}""",slip)
  p.evaluate('()=>window.signRelease()');r=p.evaluate('async()=>await window.editTask');state=p.evaluate(r"""async id=>{const db=await import('./js/db.js'),s=await db.get('slips',id);return {status:s.status,signature_id:s.signature_attachment_id||null,signature_exists:!!await db.get('attachments',s.signature_attachment_id||'missing')};}""",slip)
  assert r['applied']==baseline and state['status']==('İptal' if baseline else 'İmzalandı') and state['signature_exists']==(not baseline),(r,state)
  if not baseline:assert state['signature_id']==signed['signature_attachment_id']
  return {**r,**state,'instrumentation':'One final readonly reference callback delayed; actual signing committed in another page before final write'}
 run('CANCEL-AFTER-OTHER-PAGE-SIGNATURE',signing_race)
 def restore_protected_sources(ctx,p,url):
  r=p.evaluate(r"""async()=>{const db=await import('./js/db.js'),B=await import('./js/backup.js'),w=await work(),h=await claim(w);await db.finalizeHakedis(h.id);const obj=await B.fullBackup(db,{encrypted:false,attachments:'none'});obj.data.work_records.find(x=>x.id===w.id).quantity=2;let before=await snapshot(),claim_blocked=false;try{await B.restoreBackup(db,obj,true)}catch(e){claim_blocked=true}const claim_unchanged=before===await snapshot(),pair=await signedSlip(),other=await B.fullBackup(db,{encrypted:false,attachments:'none'});other.data.work_records.find(x=>x.id===pair.w.id).quantity=2;before=await snapshot();let slip_blocked=false;try{await B.restoreBackup(db,other,true)}catch(e){slip_blocked=true}return {claim_blocked,claim_unchanged,work_quantity:(await db.get('work_records',w.id)).quantity,claim_quantity:(await db.get('hakedis',h.id)).items[0].quantity,slip_blocked,slip_unchanged:before===await snapshot(),slip_work_quantity:(await db.get('work_records',pair.w.id)).quantity,slip_quantity:(await db.get('slips',pair.s.id)).quantity};}""")
  assert r=={'claim_blocked':not baseline,'claim_unchanged':not baseline,'work_quantity':2 if baseline else 1,'claim_quantity':1,'slip_blocked':not baseline,'slip_unchanged':not baseline,'slip_work_quantity':2 if baseline else 1,'slip_quantity':1},r;return r
 run('RESTORE-PROTECTED-FINANCIAL-SOURCES',restore_protected_sources)
 if not baseline:
  def price_note_ui(ctx,p,url):
   ids=p.evaluate(r"""async()=>{const {s,w}=await signedSlip();window.signedBefore=JSON.stringify(s);return {s:s.id,w:w.id}}""")
   p.goto(url+'#/isler/'+ids['w']);p.wait_for_selector('[data-repeat-work]');assert p.locator('[data-del]').is_disabled()
   p.goto(url+'#/isler/'+ids['w']+'/edit');p.wait_for_selector('[data-work-slip-protection]');p.fill('[name=manual_price]','1000');p.fill('[name=manual_kdv]','20');p.fill('[name=internal_note]','TEST pricing completed; signature preserved');p.click('[data-save]');p.wait_for_selector('[data-repeat-work]')
   r=p.evaluate(r"""async x=>{const db=await import('./js/db.js'),s=await db.get('slips',x.s),w=await db.get('work_records',x.w);return {signature_unchanged:JSON.stringify(s)===signedBefore,quantity:w.quantity,price:w.price_snapshot.unit_price,note:w.internal_note,signature_exists:!!await db.get('attachments',s.signature_attachment_id)};}""",ids)
   assert r=={'signature_unchanged':True,'quantity':1,'price':1000,'note':'TEST pricing completed; signature preserved','signature_exists':True},r
   for width in [320,390,768]:p.set_viewport_size({'width':width,'height':850});assert p.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),width
   return r
  run('SIGNED-SOURCE-PRICE-NOTE-UI',price_note_ui)
  def normal_conditional(ctx,p,url):
   r=p.evaluate(r"""async()=>{const db=await import('./js/db.js'),w=await work(),fields={customer_fuel_allowance_l:75,fuel_fix_op:'TEST-fix',price_snapshot:{unit_price:0,amount:0,kdv_rate:0,price_source:'Mazot karşılığı'}};const once=await db.updateIf('work_records',w.id,x=>!x.fuel_fix_op,fields,'TEST explicit agreement'),before=await snapshot(),twice=await db.updateIf('work_records',w.id,x=>!x.fuel_fix_op,fields,'TEST duplicate');const second_write_unchanged=before===await snapshot();const w2=await work(),h=await claim(w2);let blocked=false;try{await db.updateIf('work_records',w2.id,()=>true,fields,'TEST protected source')}catch(e){blocked=true}await db.finalizeHakedis(h.id);return {once:once.customer_fuel_allowance_l,twice_skipped:twice.skipped,second_write_unchanged,claim_finalized:(await db.get('hakedis',h.id)).status,claim_credit:(await db.listActive('cari_movements')).find(x=>x.ref_id===h.id).amount,blocked};}""")
   assert r['once']==75 and r['twice_skipped'] and r['second_write_unchanged'] and r['blocked'] and r['claim_finalized']=='Kesinleşti' and r['claim_credit']==1200,r
   return r
  run('NORMAL-CONDITIONAL-RETRY-AND-FINALIZATION',normal_conditional)
  def restore_control(ctx,p,url):
   r=p.evaluate(r"""async()=>{const db=await import('./js/db.js'),B=await import('./js/backup.js'),w=await work(),obj=await B.fullBackup(db,{encrypted:false,attachments:'none'});obj.data.work_records.find(x=>x.id===w.id).description='TEST explicitly reviewed restore';const before=await snapshot(),original=IDBObjectStore.prototype.put;let hit=false,failed=false;IDBObjectStore.prototype.put=function(row,...args){const req=original.call(this,row,...args);if(this.name==='work_records'&&row.id===w.id&&!hit){hit=true;this.add(row)}return req};try{await B.restoreBackup(db,obj,true)}catch(e){failed=true}finally{IDBObjectStore.prototype.put=original}const rollback=before===await snapshot();await B.restoreBackup(db,obj,true);const restored=(await db.get('work_records',w.id)).description;const after=await snapshot();await B.restoreBackup(db,obj,false);return {hit,failed,rollback,restored,duplicate_merge_unchanged:after===await snapshot()};}""")
   assert r=={'hit':True,'failed':True,'rollback':True,'restored':'TEST explicitly reviewed restore','duplicate_merge_unchanged':True},r;return r
  run('RESTORE-REQUEST-ERROR-RETRY',restore_control)
  def signature_control(ctx,p,url):
   r=p.evaluate(r"""async()=>{const db=await import('./js/db.js'),P=await import('./tests/support/attachment-fixtures.mjs'),image=()=>new File([P.PNG],'TEST-signature.png',{type:'image/png'});const contract=await db.saveNew('contracts',{customer_id:F.c,contract_no:1,type:'UNIT_PRICE',items:[],status:'Taslak'},'TEST');await db.signContract(contract.id,[image(),image()]);const signed=await db.get('contracts',contract.id),before=await snapshot();let edit_blocked=false;try{await db.saveExisting('contracts',signed,{status:'İptal'},'TEST protected signed contract')}catch(e){edit_blocked=true}const contract_unchanged=before===await snapshot();const cancelled=await db.saveNew('contracts',{customer_id:F.c,contract_no:2,type:'UNIT_PRICE',items:[],status:'İptal'},'TEST');let cancelled_blocked=false;try{await db.signContract(cancelled.id,[image(),image()])}catch(e){cancelled_blocked=true}const slip=await db.saveNew('slips',{date:'2026-09-07',customer_id:F.c,vehicle_id:F.v,quantity:1,unit:'Saat',work_text:'TEST',slip_no:10,status:'Taslak'},'TEST');await db.softDelete('slips',slip.id,'TEST unsigned deleted draft');let deleted_blocked=false;try{await db.signSlip(slip.id,image())}catch(e){deleted_blocked=true}return {signed:signed.status,version_increased:signed.updated_at>contract.updated_at,two_signatures:signed.signature_ids.length===2,edit_blocked,contract_unchanged,cancelled_blocked,deleted_blocked};}""")
   assert r['signed']=='İmzalandı' and all(v for k,v in r.items() if k!='signed'),r;return r
  run('SIGNATURE-STATE-AND-CONTRACT',signature_control)
 browser.close()
assert reports and all(r['passed'] for r in reports),reports
print('integrity_review88', 'BASELINE DEFECTS CONFIRMED' if baseline else 'PASS',len(reports))
