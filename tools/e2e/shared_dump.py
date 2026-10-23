"""Shared prepaid dump account: real DB/UI/SW, synthetic fixtures, no real operator/model requests."""
import sys,json,base64,pathlib
from playwright.sync_api import sync_playwright
U=sys.argv[1]if len(sys.argv)>1 else 'http://localhost:8841/'
with sync_playwright()as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);c=b.new_context(viewport={'width':360,'height':850});c.add_init_script("localStorage.setItem('sp_role','boss')");pg=c.new_page();errors=[];pg.on('pageerror',lambda e:errors.append(str(e)))
 pg.goto(U+'index.html#/dokum-hesap');pg.wait_for_function("()=>document.querySelector('#screen')?.textContent.includes('Ortak Döküm Hesapları')");pg.evaluate('async()=>await navigator.serviceWorker.ready')
 ids=pg.evaluate("""async()=>{const db=await import('./js/db.js'),C=await import('./js/core.js');const date=C.todayStr(),site=await db.saveNew('dump_sites',{name:'TEST Ortak Saha',fee:200,fee_unit:'Ton'},'TEST'),customer=await db.saveNew('customers',{name:'TEST Süleyman Kaya'},'TEST'),vehicles=[];for(const name of ['TEST A','TEST B'])vehicles.push(await db.saveNew('vehicles',{name,type:'Kamyon',active:true},'TEST'));const works=[];for(let i=0;i<2;i++)works.push(await db.saveNew('work_records',{date,vehicle_id:vehicles[i].id,customer_id:customer.id,dump_site_id:site.id,work_type:'Hafriyat Nakliye',quantity:1,unit:'Sefer',tonnage:i?20:15,price_snapshot:{amount:10000,unit_price:10000,kdv_rate:0,kdv_included:false}},'TEST'));return {date,site:site.id,customer:customer.id,vehicles:vehicles.map(v=>v.id),works:works.map(w=>w.id)}}""")
 pg.goto(U+'index.html#/dokum-hesap/'+ids['site']);pg.wait_for_selector('[data-dump-balance]')
 def save_sheet():
  pg.check('.sheet [data-confirm]');pg.click('.sheet button[type=submit]');pg.wait_for_selector('.sheet',state='detached')
 png=base64.b64decode(pg.evaluate("()=>{const c=document.createElement('canvas');c.width=100;c.height=40;const x=c.getContext('2d');x.fillStyle='white';x.fillRect(0,0,100,40);x.fillStyle='black';x.fillText('TEST FIS',1,20);return c.toDataURL().split(',')[1]}"))
 pg.click('[data-new=TOPUP]');assert pg.evaluate("async()=> (await import('./js/update-safety.js')).updateRisk(document.querySelector('#screen')).busy");pg.fill('.sheet [name=amount]','20000');pg.fill('.sheet [name=reference]','TEST-DEKONT');pg.set_input_files('.sheet [name=proof]',{'name':'TEST-dekont.png','mimeType':'image/png','buffer':png});save_sheet()
 for i,amount in enumerate([3000,4000]):
  pg.click('[data-work-receipt="'+ids['works'][i]+'"]');pg.fill('.sheet [name=amount]',str(amount));pg.fill('.sheet [name=receipt_no]','TEST-FIS-'+str(i));pg.fill('.sheet [name=tonnage]',str([15,20][i]));save_sheet()
 pg.wait_for_function("()=>document.querySelector('[data-dump-balance]')?.textContent.includes('13.000')")
 pg.select_option('[name=vehicle_filter]',ids['vehicles'][0]);assert '13.000' in pg.locator('[data-dump-balance]').inner_text();assert 'TEST A' in pg.locator('[data-entries]').inner_text() and 'TEST B' not in pg.locator('[data-entries]').inner_text()
 pg.select_option('[name=vehicle_filter]','');pg.screenshot(path='/tmp/solo-v3959-shared-dump.png',full_page=True)
 load_id=pg.evaluate("async()=> (await(await import('./js/db.js')).listActive('dump_entries')).find(e=>e.kind==='TOPUP').id")
 pg.goto(U+'index.html#/dokum-hareket/'+load_id);pg.wait_for_selector('[data-proof] img');assert pg.locator('[data-cancel-entry]').count()==1
 pg.click('[data-cancel-entry]');pg.wait_for_selector('.sheet [name=reason]');pg.click('.sheet [data-close]');pg.wait_for_selector('.sheet',state='detached')
 assert not pg.evaluate("async()=> (await import('./js/update-safety.js')).updateRisk(null).busy")
 pg.goto(U+'index.html#/dokum-hesap/'+ids['site']);pg.wait_for_selector('[data-dump-balance]')
 for width in [320,360,768]:pg.set_viewport_size({'width':width,'height':850});assert pg.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),width
 print('PASS actual UI: 20,000 TL topup + two vehicles 3,000/4,000 = shared 13,000; vehicle filter never changes balance; original proof detail; cancel form releases update lock; mobile layouts',flush=True)
 report=pg.evaluate("""async ids=>{
 const db=await import('./js/db.js'),L=await import('./js/dump-ledger-db.js'),C=await import('./js/core.js'),F=await import('./js/dump-fees.js'),A=await import('./js/dump-account.js'),K=await import('./js/costs-core.js'),EC=await import('./js/enterprise-core.js'),E=await import('./js/enterprise-db.js'),B=await import('./js/backup.js');const date=ids.date,checks={};
 const reject=async fn=>{try{await fn();return false}catch(e){return e.message}},balance=async()=>A.dumpAccounts(await db.dumpAll(),{today:date,siteId:ids.site})[0].balance;
 checks.shared=(await balance())===13000;checks.cost=K.costTotals(K.costRows(await db.dumpAll())).total===7000;checks.noCustomerDebt=(await db.listActive('cari_movements')).length===0;
 const f={kind:'TOPUP',date,dump_site_id:ids.site,amount:100,note:'TEST retry'};const same=await Promise.all([L.saveDumpEntry(f,[],'TEST-RETRY'),L.saveDumpEntry(f,[],'TEST-RETRY')]);checks.retry=same[0].id===same[1].id;checks.conflict=await reject(()=>L.saveDumpEntry({...f,amount:200},[],'TEST-RETRY'));checks.retryBalance=(await balance())===13100;
 const receipt={kind:'RECEIPT',date,dump_site_id:ids.site,vehicle_id:ids.vehicles[0],amount:50,receipt_no:'TEST-RACE',trips:1,payer:'company_account'};
 const race=await Promise.allSettled([L.saveDumpEntry(receipt,[],'TEST-RACE-A'),L.saveDumpEntry({...receipt,vehicle_id:ids.vehicles[1]},[],'TEST-RACE-B')]);checks.duplicateRace=race.filter(x=>x.status==='fulfilled').length===1&&race.filter(x=>x.status==='rejected').length===1;checks.exactRaceBalance=(await balance())===13050;
 const before=await db.dumpAll(),beforeAtts=(await db.getAll('attachments')).length;
 checks.badFile=await reject(()=>L.saveDumpEntry({...f,amount:999},[new File(['fake'],'bad.png',{type:'image/png'})],'TEST-BAD-FILE'));
 const add=IDBObjectStore.prototype.add;IDBObjectStore.prototype.add=function(r){if(this.name==='dump_entries')throw Error('TEST injected dump write failure');return add.call(this,r)};
 try{checks.rollbackError=await reject(()=>L.saveDumpEntry({...f,amount:999},[],'TEST-ABORT'))}finally{IDBObjectStore.prototype.add=add}
 const after=await db.dumpAll();checks.rollback=before.expense_records.length===after.expense_records.length&&before.dump_entries.length===after.dump_entries.length&&before.audit_log.length===after.audit_log.length&&(await db.getAll('attachments')).length===beforeAtts;
 checks.directWrite=await reject(()=>db.saveNew('dump_entries',receipt,'TEST'));
 checks.workEdit=await reject(async()=>db.saveExisting('work_records',await db.get('work_records',ids.works[0]),{quantity:2},'TEST'));
 checks.conditionalEdit=await reject(()=>db.updateIf('work_records',ids.works[0],()=>true,{customer_id:null},'TEST'));
 checks.workDelete=await reject(()=>db.softDelete('work_records',ids.works[0],'TEST'));
 checks.siteDelete=await reject(()=>db.softDelete('dump_sites',ids.site,'TEST'));
 checks.expenseDelete=await reject(()=>db.softDelete('expense_records',same[0].expense_id,'TEST'));
 checks.phantomPayment=await reject(()=>db.saveNew('expense_records',{date,amount:999,dump_deposit:true,invoice_paid:true,dump_site_id:ids.site},'TEST'));
 // Old unsnapped work, then real tariff change. Neither old estimates nor actual receipts drift.
 const legacy=C.newRecord({date:C.addDays(date,-3),vehicle_id:ids.vehicles[0],customer_id:ids.customer,dump_site_id:ids.site,work_type:'Hafriyat Nakliye',unit:'Sefer',quantity:1,tonnage:10});await db.put('work_records',legacy);
 const oldCost=F.dumpFee(await db.dumpAll(),legacy).amount;
 const s=await db.get('dump_sites',ids.site);await db.saveExisting('dump_sites',s,{fee:250,fee_unit:'Ton'},'TEST tariff');
 const newData=await db.dumpAll();checks.oldTariff=F.dumpFee(newData,newData.work_records.find(w=>w.id===legacy.id)).amount===oldCost;checks.realTariff=(await balance())===13050&&F.dumpFee(newData,newData.work_records.find(w=>w.id===ids.works[0])).amount===3000;
 const newWork=await db.saveNew('work_records',{date,vehicle_id:ids.vehicles[0],customer_id:ids.customer,dump_site_id:ids.site,work_type:'Hafriyat Nakliye',unit:'Sefer',quantity:1,tonnage:10},'TEST');checks.newTariff=newWork.dump_tariff_snapshot.fee===250;
 checks.forgeTariff=await reject(()=>db.saveExisting('work_records',newWork,{dump_tariff_snapshot:{fee:1}},'TEST'));
 // Invoices have no money effect; only an explicit period allows comparison.
 const doc=await db.saveNew('documents',{category:'Döküm Faturası',owner_type:'dump_site',owner_id:ids.site,date,doc_no:'TEST-INVOICE',amount:7000},'TEST');checks.invoiceNoMoney=(await balance())===13050;let acc=A.dumpAccounts(await db.dumpAll(),{today:date,siteId:ids.site})[0];checks.periodUnknown=acc.invoices[0].ourAmount===null;await L.setDumpInvoicePeriod(doc.id,date,date);acc=A.dumpAccounts(await db.dumpAll(),{today:date,siteId:ids.site})[0];checks.periodConfirmed=acc.invoices[0].ourAmount===7050;
 const orphan=(await db.listActive('dump_entries')).find(e=>e.receipt_no==='TEST-RACE');const target=orphan.vehicle_id===ids.vehicles[0]?newWork:await db.saveNew('work_records',{date,vehicle_id:ids.vehicles[1],customer_id:ids.customer,dump_site_id:ids.site,work_type:'Hafriyat Nakliye',unit:'Sefer',quantity:1,tonnage:10},'TEST');await L.linkDumpReceipt(orphan.id,target.id,orphan.updated_at);checks.linkNoMoney=(await balance())===13050;
 // A customer-paid receipt costs the company nothing and cannot debit the shared account.
 const cw=await db.saveNew('work_records',{date,vehicle_id:ids.vehicles[0],customer_id:ids.customer,dump_site_id:ids.site,work_type:'Hafriyat Nakliye',unit:'Sefer',quantity:1,tonnage:10},'TEST');const customerPaid=await L.saveDumpEntry({...receipt,work_record_id:cw.id,receipt_no:'TEST-CUSTOMER-PAID',payer:'customer',amount:700},[],'TEST-CUSTOMER-PAID');checks.customerPays=(await balance())===13050&&F.dumpFee(await db.dumpAll(),cw)===null;
 // Already-written ordinary expense is attached, never counted twice.
 const ew=await db.saveNew('work_records',{date,vehicle_id:ids.vehicles[0],customer_id:ids.customer,dump_site_id:ids.site,work_type:'Hafriyat Nakliye',unit:'Sefer',quantity:1},'TEST'),expense=await db.saveNew('expense_records',{date,vehicle_id:ids.vehicles[0],category:'Döküm',amount:600},'TEST');const linked=await L.saveDumpEntry({...receipt,receipt_no:'TEST-LINKED-EXPENSE',amount:600,expense_id:expense.id,work_record_id:ew.id},[],'TEST-LINKED-EXPENSE');let data=await db.dumpAll();checks.expenseOnce=K.costRows(data).filter(r=>r.id===expense.id).length===0&&EC.costLedger(data).filter(r=>r.source_store==='expense_records'&&r.source_id===expense.id).length===0;checks.cancelGuard=await reject(()=>L.cancelDumpEntry(linked.id,'TEST',{expectedVersion:linked.updated_at}));await L.cancelDumpEntry(linked.id,'TEST',{expectedVersion:linked.updated_at,cancelExpense:true});checks.cancelBoth=!!(await db.get('expense_records',expense.id)).deleted_at&&!!(await db.get('dump_entries',linked.id)).deleted_at&&(await balance())===13050;
 // Employee-funded loading stays a reimbursement; refund and direct payment never become duplicate costs.
 const employee=await db.saveNew('personnel',{name:'TEST employee',active:true},'TEST');
 const employeeLoad=await L.saveDumpEntry({...f,amount:80,payment_method:'Personel Ödedi',personnel_id:employee.id},[],'TEST-EMPLOYEE');
 const employeeExpense=await db.get('expense_records',employeeLoad.expense_id);checks.employeeReimbursement=employeeExpense.personnel_id===employee.id&&employeeExpense.reimbursement_status==='Bekliyor'&&(await balance())===13130;
 await L.cancelDumpEntry(employeeLoad.id,'TEST employee load cancel',{expectedVersion:employeeLoad.updated_at});
 const refund=await L.saveDumpEntry({kind:'REFUND',date,dump_site_id:ids.site,amount:80,note:'TEST operator refund'},[],'TEST-REFUND');checks.refund=(await balance())===12970;await L.cancelDumpEntry(refund.id,'TEST cancel refund',{expectedVersion:refund.updated_at});
 const direct=await L.saveDumpEntry({...receipt,payer:'company_direct',receipt_no:'TEST-DIRECT',amount:80},[],'TEST-DIRECT');checks.directPayment=(await balance())===13050;await L.cancelDumpEntry(direct.id,'TEST cancel direct',{expectedVersion:direct.updated_at});
 checks.duplicateTopup=await reject(()=>L.saveDumpEntry({...f,amount:20000,reference:'TEST-DEKONT'},[],'TEST-DUPE-LOAD'));
 checks.invalidOperation=await reject(()=>L.saveDumpEntry(f,[],{}));
 // Same-day open balance is a day-start baseline and is not a cost/cash receipt.
 const open=await L.saveDumpEntry({kind:'OPENING',date,dump_site_id:ids.site,amount:5000,note:'TEST day-start statement'},[],'TEST-OPEN');checks.opening=(await balance())===18050;checks.duplicateOpening=await reject(()=>L.saveDumpEntry({kind:'OPENING',date,dump_site_id:ids.site,amount:1,note:'TEST'},[],'TEST-OPEN-2'));
 await L.saveDumpReport(ids.site,0,C.addDays(date,-1),'TEST historical day');acc=A.dumpAccounts(await db.dumpAll(),{today:date,siteId:ids.site})[0];checks.historicalReport=acc.reported_difference===0;
 await L.cancelDumpEntry(same[0].id,'TEST cancel load',{expectedVersion:same[0].updated_at});checks.cancelLoad=(await balance())===17950;checks.cancelledRetry=await reject(()=>L.saveDumpEntry(f,[],'TEST-RETRY'));
 data=await db.dumpAll();checks.reportEquality=Math.abs(K.costTotals(K.costRows(data)).total-EC.costLedger(data).reduce((n,r)=>n+r.gross,0))<0.01;
 const backup=await B.fullBackup(db,{attachments:'base64'});checks.backupHasProof=backup.attachments.some(a=>a.record_type==='dump_entries'&&a.base64);return {checks,backup};
 }""",ids)
 assert all(report['checks'].values()),report['checks']
 print('PASS '+json.dumps(report['checks'],ensure_ascii=False),flush=True)
 c2=b.new_context();c2.add_init_script("localStorage.setItem('sp_role','boss')");p2=c2.new_page();p2.on('pageerror',lambda e:errors.append(str(e)));p2.goto(U+'index.html#/dokum-hesap');p2.wait_for_function("()=>document.querySelector('#screen')?.textContent.includes('Ortak Döküm Hesapları')")
 restored=p2.evaluate("""async x=>{const db=await import('./js/db.js'),B=await import('./js/backup.js'),L=await import('./js/dump-ledger-core.js');await B.restoreBackup(db,x.backup);const d=await db.dumpAll();return {balance:L.sharedDumpBalance(d,x.id).balance,atts:(await db.getAll('attachments')).filter(a=>a.record_type==='dump_entries').length,entries:d.dump_entries.length}}""",{'id':ids['site'],'backup':report['backup']})
 assert restored['balance']==17950 and restored['atts']==1 and restored['entries']==len(report['backup']['data']['dump_entries']),restored
 c.set_offline(True);pg.goto(U+'index.html#/dokum-hesap/'+ids['site']);pg.reload();pg.wait_for_selector('[data-dump-balance]');assert '17.950' in pg.locator('[data-dump-balance]').inner_text();assert not errors,errors
 print('PASS full backup restores shared entries/balance/original proof into separate clean profile; offline account works; zero browser errors',flush=True)
 b.close()
