"""Finance audit: real IDB conflicts/race, decimal cash edit, unknown debts and custody."""
import argparse,json,os,uuid
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser(description=__doc__);p.add_argument('url',nargs='?',default='http://localhost:8841/');p.add_argument('--baseline-proof',action='store_true');p.add_argument('--artifacts',default='/tmp/solo-finance-audit79');a=p.parse_args()
BASE=a.url.rstrip('/')+'/';O=urlparse(BASE);assert O.scheme=='http' and O.hostname in ('localhost','127.0.0.1','::1')
assert not O.username and not O.password and not O.query and not O.fragment
out=Path(a.artifacts);out.mkdir(parents=True,exist_ok=True);errors=[];external=[]
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),args=['--no-sandbox'])
 c=b.new_context(viewport={'width':390,'height':850},service_workers='block');c.add_init_script("localStorage.setItem('sp_role','boss')")
 def local(r):
  u=urlparse(r.request.url)
  if (u.scheme,u.hostname,u.port)==(O.scheme,O.hostname,O.port):r.continue_()
  else:external.append(r.request.url);r.abort()
 c.route('**/*',local);page=c.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
 APP=BASE+'index.html?db=f79_'+uuid.uuid4().hex[:12];page.goto(APP+'#/');page.wait_for_selector('#screen[data-view-ready="1"] [data-operation-desk]')
 result=page.evaluate('''async()=>{
  const db=await import('./js/db.js'),E=await import('./js/enterprise-db.js'),C=await import('./js/core.js'),date=C.todayStr();
  const customer=await db.saveNew('customers',{name:'TEST Finance audit customer'},'TEST');
  const p1=await db.saveNew('personnel',{name:'TEST Driver A'},'TEST'),p2=await db.saveNew('personnel',{name:'TEST Driver B'},'TEST');
  const f={date,customer_id:customer.id,personnel_id:p1.id,cash_type:'Müşteriden Para Alındı',cash_status:'PERSONELDE',payment_method:'Nakit',amount:100.5,request_id:'TEST-F79-CASH'};
  const cash=await db.saveCashEvent(f),before=JSON.stringify(await db.dumpAll());
  const conflict=async fn=>{try{await fn();return false;}catch(e){if(e.code!=='OP_CONFLICT')throw e;return true;}};
  const cashTypeConflict=await conflict(()=>db.saveCashEvent({...f,cash_type:'Şirket Gideri İçin Para Verildi'}));
  const cashOwnerConflict=await conflict(()=>db.saveCashEvent({...f,personnel_id:p2.id}));
  const cashNoWrites=before===JSON.stringify(await db.dumpAll()),cashRetry=await db.saveCashEvent(f);
  const supplier=await E.saveSupplier({name:'TEST Audit Supplier'}),s2=await E.saveSupplier({name:'TEST Audit Supplier 2'});
  const bill=await E.savePayable({date,due_date:date,party_type:'supplier',party_id:supplier.id,document_no:'TEST-F79-1',items:[{description:'TEST',quantity:1,unit:'Adet',unit_price:100,kdv_rate:0}]});
  const pf={payable_id:bill.id,date,amount:20.25,method:'Nakit'};const paid=await E.paySupplier(pf,'TEST-F79-PAY');
  const payBefore=JSON.stringify(await db.dumpAll());
  const supplierConflict=await conflict(()=>E.paySupplier({...pf,amount:30.25},'TEST-F79-PAY'));
  const supplierNoWrites=payBefore===JSON.stringify(await db.dumpAll()),supplierRetry=await E.paySupplier(pf,'TEST-F79-PAY');
  await E.savePayable({date,due_date:date,party_type:'supplier',party_id:s2.id,document_no:'TEST-F79-2',items:[{description:'TEST',quantity:1,unit:'Adet',unit_price:100,kdv_rate:0}]});
  const batch={supplier_id:s2.id,date,amount:30.15,method:'Nakit'};await E.paySupplierAccount(batch,'TEST-F79-BATCH');
  const batchConflict=await conflict(()=>E.paySupplierAccount({...batch,amount:40.15},'TEST-F79-BATCH'));
  await E.reverseSupplierPayments('TEST-F79-BATCH','TEST reversal');
  let reversedRetryBlocked=false;try{await E.paySupplierAccount(batch,'TEST-F79-BATCH');}catch(e){if(e.code!=='OP_REVERSED')throw e;reversedRetryBlocked=true;}
  // A second transaction deletes the card after pre-validation, before the cash write.
  const target=await db.saveNew('customers',{name:'TEST Atomic receipt target'},'TEST');
  const raceFields={date,customer_id:target.id,cash_type:'Müşteriden Para Alındı',cash_status:'KASAYA_TESLIM_EDILDI',payment_method:'Nakit',amount:12.5};
  const original=IDBDatabase.prototype.transaction,hash=await db.opHash(raceFields);let injected=false,blocked=false;
  const auditBefore=(await db.getAll('audit_log')).length;
  IDBDatabase.prototype.transaction=function(stores,mode,...args){
   const names=typeof stores==='string'?[stores]:Array.from(stores);
   if(!injected&&mode==='readwrite'&&names.includes('cash_records')&&names.includes('cari_movements')){
    injected=true;const del=original.call(this,['customers'],'readwrite'),q=del.objectStore('customers').get(target.id);
    q.onsuccess=()=>del.objectStore('customers').put({...q.result,deleted_at:C.nowISO()});
   }
   return original.call(this,stores,mode,...args);
  };
  try{await db.saveCashEvent(raceFields,{op:{id:'TEST-F79-RACE',hash}});}catch(e){if(e.code!=='FINANCE_REFERENCE')throw e;blocked=true;}finally{IDBDatabase.prototype.transaction=original;}
  await db.get('customers',target.id);
  const raceRows=(await db.getAll('cash_records')).filter(r=>r.customer_id===target.id);
  const raceAtomic=blocked&&!raceRows.length&&(await db.getAll('audit_log')).length===auditBefore&&await db.metaGet('op:TEST-F79-RACE')===null;
  return {customer:customer.id,p1:p1.id,p2:p2.id,date,cashTypeConflict,cashOwnerConflict,cashNoWrites,cashRetrySame:cashRetry.id===cash.id,supplierConflict,supplierNoWrites,supplierRetrySame:supplierRetry.id===paid.id,batchConflict,reversedRetryBlocked,raceInjected:injected,raceAtomic,raceRows:raceRows.length};
 }''')
 if a.baseline_proof:
  assert not result['cashTypeConflict'] and not result['cashOwnerConflict'] and not result['supplierConflict'] and not result['batchConflict'] and not result['reversedRetryBlocked'] and result['raceRows']==1,result
  print('BASELINE defects reproduced '+json.dumps(result,ensure_ascii=False),flush=True)
 else:
  assert all(result[k] for k in ('cashTypeConflict','cashOwnerConflict','cashNoWrites','cashRetrySame','supplierConflict','supplierNoWrites','supplierRetrySame','batchConflict','reversedRetryBlocked','raceInjected','raceAtomic')),result
  # Keep/edit the prefilled dot-decimal value and reject an empty amount.
  page.evaluate("async()=>await(await import('./js/db.js')).metaSet('cash_on_hand',{amount:1000.5,date:(await import('./js/core.js')).todayStr()})")
  page.goto(APP+'#/nakit');page.wait_for_selector('#screen[data-view-ready="1"] [data-coh]')
  page.click('[data-coh]');page.wait_for_selector('.sheet [data-p]');assert page.input_value('.sheet [data-p]')=='1000.5'
  page.click('.sheet [data-x="1"]');page.wait_for_selector('#screen[data-view-ready="1"] [data-coh]')
  assert page.evaluate("async()=>(await(await import('./js/db.js')).metaGet('cash_on_hand')).amount")==1000.5
  page.click('[data-coh]');page.fill('.sheet [data-p]','');page.click('.sheet [data-x="1"]');page.wait_for_selector('.sheet',state='detached')
  assert page.evaluate("async()=>(await(await import('./js/db.js')).metaGet('cash_on_hand')).amount")==1000.5
  page.click('[data-coh]');page.fill('.sheet [data-p]','1.23.4');page.click('.sheet [data-x="1"]');page.wait_for_selector('.toast')
  assert page.evaluate("async()=>(await(await import('./js/db.js')).metaGet('cash_on_hand')).amount")==1000.5
  # Future records cannot inflate this month's work, collection or costs.
  page.evaluate('''async i=>{
   const db=await import('./js/db.js'),E=await import('./js/enterprise-db.js'),C=await import('./js/core.js'),date=C.todayStr(),future=C.addDays(date,1);
   const v=await db.saveNew('vehicles',{name:'TEST Future truck',type:'Kamyon'},'TEST');
   await db.saveNew('work_records',{date:future,customer_id:i.customer,vehicle_id:v.id,work_type:'Hafriyat Nakliye',quantity:1,unit:'Sefer',price_snapshot:{amount:9999,unit_price:9999,kdv_rate:0,kdv_included:false}},'TEST');
   await db.saveCashEvent({date:future,customer_id:i.customer,cash_type:'Müşteriden Para Alındı',cash_status:'KASAYA_TESLIM_EDILDI',payment_method:'Nakit',amount:8888});
   const bank=await E.saveBank({name:'TEST Bank',opening_balance:0,opening_date:date});
   await E.customerBankReceipt({date,customer_id:i.customer,amount:25.35,bank_account_id:bank.id},'TEST-F79-BANK');
   const supplier=await E.saveSupplier({name:'TEST inconsistent debt'});
   const bill=await E.savePayable({date,due_date:date,party_type:'supplier',party_id:supplier.id,document_no:'TEST-F79-BAD',items:[{description:'TEST',quantity:1,unit:'Adet',unit_price:50,kdv_rate:0}]});
   await db.put('supplier_payments',C.newRecord({date,payable_id:bill.id,party_id:'OTHER',party_type:'supplier',amount:10}));
  }''',result)
  snapshot=lambda:page.evaluate("async()=>JSON.stringify(await(await import('./js/db.js')).dumpAll())")
  before=snapshot();page.goto(APP+'#/finans');page.wait_for_selector('[data-finance-custody]')
  custody=page.locator('[data-finance-custody]').inner_text();assert '100,50 ₺' in custody and '25,35 ₺' in custody,custody
  assert '125,85' in page.locator('.finance-stat[href="#/kasa"] .v').inner_text()
  assert page.locator('.finance-stat[href="#/cari"] .v').inner_text()=='0,00'
  page.screenshot(path=str(out/'finance-custody-390.png'),full_page=True)
  page.goto(APP+'#/nakit');page.wait_for_selector('[data-cashflow-review]')
  assert 'taraf bilgisi' in page.locator('[data-cashflow-review]').inner_text()
  assert '5 haftalık bilinen kasa artıda' not in page.locator('#screen').inner_text()
  for width in (320,390,768):
   page.set_viewport_size({'width':width,'height':850});page.wait_for_selector('[data-cashflow-review]');assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),width
  page.screenshot(path=str(out/'cashflow-review-768.png'),full_page=True)
  assert snapshot()==before,'Finance and forecast views must be read-only'
  assert not errors and not external,(errors,external)
  result.update(decimal_cash_edit_preserved=True,empty_cash_rejected=True,future_month_excluded=True,custody_bank_staff_separate=True,invalid_debt_no_safe_banner=True,views_read_only=True,page_errors=errors,external_requests=external)
  print(json.dumps(result,ensure_ascii=False),flush=True)
 (out/'result.json').write_text(json.dumps({'baseline_proof':a.baseline_proof,**result},ensure_ascii=False,indent=2)+'\n')
 c.close();b.close()
