"""Real IndexedDB request-key conflicts and money conservation. Synthetic local profile only."""
import argparse,json,uuid
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright
ap=argparse.ArgumentParser();ap.add_argument('url',nargs='?',default='http://localhost:8841/');a=ap.parse_args();base=a.url.rstrip('/')+'/';assert urlparse(base).hostname in ('localhost','127.0.0.1')
with sync_playwright() as w:
 b=w.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);c=b.new_context(service_workers='block');c.add_init_script("localStorage.setItem('sp_role','boss')");p=c.new_page();errors=[];p.on('pageerror',lambda e:errors.append(str(e)));p.goto(base+'index.html?db=TEST_retry108_'+uuid.uuid4().hex+'#/daha');p.wait_for_selector('#screen[data-view-ready="1"]')
 result=p.evaluate("""async()=>{
 const D=await import('./js/db.js'),E=await import('./js/enterprise-db.js'),C=await import('./js/core.js'),B=await import('./js/enterprise-core.js'),today=C.todayStr(),tomorrow=C.addDays(today,1),yesterday=C.addDays(today,-1);
 const customer=await D.saveNew('customers',{name:'TEST Customer'},'TEST'),staff=await D.saveNew('personnel',{name:'TEST Staff'},'TEST'),vehicle=await D.saveNew('vehicles',{name:'TEST Machine',type:'JCB'},'TEST');
 const bankA=await E.saveBank({name:'TEST Bank A',opening_date:yesterday,opening_balance:1000},'TEST_BANK_A'),bankB=await E.saveBank({name:'TEST Bank B',opening_date:yesterday,opening_balance:0},'TEST_BANK_B');
 const supplier=await E.saveSupplier({name:'TEST Supplier'},'TEST_SUPPLIER');
 const receipt=await E.customerBankReceipt({date:today,customer_id:customer.id,amount:100,bank_account_id:bankA.id},'TEST_RECEIPT');
 const work=await D.saveNew('work_records',{date:today,customer_id:customer.id,vehicle_id:vehicle.id,work_type:'Makine Çalışması',quantity:1,unit:'Saat',price_snapshot:{unit_price:1000,amount:1000,kdv_rate:0,kdv_included:false}},'TEST');
 const item={work_record_id:work.id,date:today,customer_id:customer.id,vehicle_id:vehicle.id,work_type:work.work_type,quantity:1,unit:'Saat',unit_price:1000,kdv_rate:0,kdv_included:false},t=C.calcHakedisTotals([item]);const claim=await D.createHakedis({hakedis_no:1,customer_id:customer.id,status:'Taslak',date_from:today,date_to:today,created_date:today,items:t.lines,subtotal:t.subtotal,kdv_total:t.kdv,grand_total:t.grand});await D.finalizeHakedis(claim.id);
 const planInput={hakedis_id:claim.id,date:today,first_due:tomorrow,count:2,days:7},plan=await E.saveReceivablePlan(planInput,'TEST_PLAN');
 const operations=[
 ['supplier','saveSupplier',{name:'TEST Other Supplier'},[{name:'TEST Different Supplier'}]],
 ['bank','saveBank',{name:'TEST Other Bank',opening_date:yesterday,opening_balance:5},[{opening_balance:6},{name:'TEST Changed Bank'},{opening_date:today}]],
 ['transfer','transferBanks',{from_id:bankA.id,to_id:bankB.id,date:today,amount:25,note:'TEST Transfer'},[{amount:26},{from_id:bankB.id,to_id:bankA.id},{date:yesterday},{note:'TEST Different Transfer'}]],
 ['payable','savePayable',{party_type:'supplier',party_id:supplier.id,date:today,due_date:tomorrow,document_no:'TEST_BILL',items:[{description:'TEST Material',quantity:1,unit:'Adet',unit_price:20,kdv_rate:0}]},[{items:[{description:'TEST Material',quantity:1,unit:'Adet',unit_price:21,kdv_rate:0}]},{due_date:C.addDays(today,2)},{document_no:'TEST_OTHER_BILL'}]],
 ['purchase','savePurchase',{party_type:'supplier',party_id:supplier.id,date:today,expected_date:tomorrow,order_no:'TEST_ORDER',items:[{description:'TEST Material',quantity:1,unit:'Adet',unit_price:20,kdv_rate:0}]},[{items:[{description:'TEST Material',quantity:2,unit:'Adet',unit_price:20,kdv_rate:0}]},{expected_date:C.addDays(today,2)}]],
 ['payroll','savePayroll',{date:today,period:today.slice(0,7),personnel_id:staff.id,kind:'Avans',amount:10,method:'Banka',bank_account_id:bankA.id},[{amount:11},{bank_account_id:bankB.id},{kind:'Ücret Ödemesi'},{method:'Nakit'}]],
 ['instrument','saveInstrument',{date:today,due_date:tomorrow,kind:'Çek',direction:'Alınan',document_no:'TEST_CHEQUE',party_type:'customer',party_id:customer.id,amount:30},[{amount:31},{direction:'Verilen'},{due_date:C.addDays(today,2)}]],
 ['plan','saveReceivablePlan',planInput,[{count:3},{days:8},{first_due:C.addDays(today,2)}]],
 ['allocation','allocateReceipt',{plan_id:plan.id,installment_id:plan.installments[0].id,receipt_id:receipt.id,amount:10},[{amount:11},{installment_id:plan.installments[1].id}]],
 ['service','saveServicePlan',{vehicle_id:vehicle.id,title:'TEST Service',next_date:tomorrow},[{next_date:C.addDays(today,2)},{title:'TEST Other Service'}]],
 ['closing','closeDay',{date:today,note:'TEST Closed'},[{note:'TEST Other'},{date:yesterday}]],
 ['activity','saveActivity',{owner_type:'customer',owner_id:customer.id,title:'TEST Followup',due_date:tomorrow},[{title:'TEST Other Followup'},{due_date:C.addDays(today,2)}]]
 ];
 const report=[],unsafe=[];
 const call=(method,input,key)=>method==='closeDay'?E.closeDay(input.date,input.note,key):E[method](input,key);
 for(const [label,method,input,changes]of operations){
  const key=label==='plan'?'TEST_PLAN':'TEST_RETRY_'+label,first=await call(method,structuredClone(input),key),before=await D.dumpAll();
  const repeat=await call(method,structuredClone(input),key);
  if(repeat.id!==first.id)unsafe.push(label+': repeated result changed record identity');
  for(const change of changes){let code=null;try{await call(method,{...structuredClone(input),...change},key);}catch(e){code=e.code||e.message;}if(code!=='OP_CONFLICT')unsafe.push(label+': changed request not rejected '+JSON.stringify(change));}
  if(JSON.stringify(await D.dumpAll())!==JSON.stringify(before))unsafe.push(label+': retry wrote data');
  report.push({label,changes:changes.length});
 }
 const invalidOpening=[];
 for(const value of ['',null,'bad',Infinity,1e20,false,true,[],{}]){const before=await D.dumpAll();let rejected=false;try{await E.saveBank({name:'TEST Invalid '+String(value),opening_date:today,opening_balance:value},'TEST_INVALID_'+String(value));}catch{rejected=true;}if(!rejected||JSON.stringify(await D.dumpAll())!==JSON.stringify(before))unsafe.push('Invalid opening balance accepted: '+String(value));invalidOpening.push(rejected);}
 const beforeDate=await D.dumpAll();let invalidClose=false;try{await E.closeDay('2026-02-31','TEST invalid day','TEST_INVALID_CLOSE');}catch{invalidClose=true;}if(!invalidClose||JSON.stringify(await D.dumpAll())!==JSON.stringify(beforeDate))unsafe.push('Invalid day closure was accepted');
 const beforeRace=await D.dumpAll(),race=await Promise.allSettled([25,35].map(amount=>E.transferBanks({from_id:bankA.id,to_id:bankB.id,date:today,amount},'TEST_RACE_TRANSFER'))),after=await D.dumpAll();
 if(race.filter(x=>x.status==='fulfilled').length!==1||race.filter(x=>x.status==='rejected'&&x.reason.code==='OP_CONFLICT').length!==1)unsafe.push('Competing transfer requests must produce one commit and one OP_CONFLICT');
 const raceLegs=after.bank_movements.filter(r=>r.transfer_key==='TEST_RACE_TRANSFER');if(raceLegs.length!==2||raceLegs[0].source_id!==raceLegs[1].source_id)unsafe.push('Transfer did not preserve its exact two-leg pair');
 const balance=after.bank_accounts.reduce((n,a)=>n+C.toKurus(B.bankBalance(a,after.bank_movements)),0);if(balance!==109500)unsafe.push('Independent bank conservation failed: expected openings1005 + receipt100 - payroll10');
 const reversed=after.payroll_entries.find(r=>r.request_id==='TEST_RETRY_payroll');await D.put('payroll_entries',{...reversed,deleted_at:new Date().toISOString()});const beforeReverse=await D.dumpAll();let reversedCode;try{await E.savePayroll(operations.find(x=>x[0]==='payroll')[2],'TEST_RETRY_payroll');}catch(e){reversedCode=e.code;}if(reversedCode!=='OP_REVERSED')unsafe.push('Reversed payroll must not appear as successful retry');if(JSON.stringify(await D.dumpAll())!==JSON.stringify(beforeReverse))unsafe.push('Reversed request mutated records');
 return {invalidOpening,operations:report,changedRequestChecks:report.reduce((n,r)=>n+r.changes,0),bankTotal:balance/100,race:race.map(x=>x.status==='fulfilled'?'committed':x.reason.code||'error'),unsafe};
 }""")
 print(json.dumps(result,ensure_ascii=False),flush=True);assert not result['unsafe'],'Repeated financial request must reject different business fields without writes';assert not errors,errors;b.close()
