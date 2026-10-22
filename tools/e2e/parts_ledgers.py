"""Real Chromium / IndexedDB / SW. Isolated synthetic data; no external model or account."""
import json,sys,base64
from playwright.sync_api import sync_playwright
U=sys.argv[1] if len(sys.argv)>1 else 'http://localhost:8841/'
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);c=b.new_context(viewport={'width':360,'height':850});c.add_init_script("localStorage.setItem('sp_role','boss')")
 pg=c.new_page();errors=[];pg.on('pageerror',lambda e:errors.append(str(e)))
 pg.goto(U+'index.html#/yedek-parca');pg.wait_for_selector('[name=vehicle_filter]');pg.evaluate('async()=>await navigator.serviceWorker.ready')
 ids=pg.evaluate("""async()=>{const db=await import('./js/db.js'),C=await import('./js/core.js');const vehicle=await db.saveNew('vehicles',{name:'TEST AKÜ KAMYON',plate:'34TEST58',active:true},'TEST');return {vehicle:vehicle.id,date:C.todayStr()}}""")
 pg.goto(U+'index.html#/yedek-parca/new?vehicle_id='+ids['vehicle']);pg.wait_for_selector('[name=description]')
 pg.fill('[name=description]','TEST Akü');pg.fill('[name=quantity]','2');pg.fill('[name=unit_price]','3000');pg.select_option('[name=cost_mode]','new_expense');pg.fill('[name=brand]','TEST Marka');pg.fill('[name=serial_numbers]','TEST-A1\nTEST-A2');pg.fill('[name=warranty_until]','2028-10-22')
 # Valid image; attached through real browser File API. Draft survives reload including binary.
 image=base64.b64decode(pg.evaluate("()=>{const c=document.createElement('canvas');c.width=40;c.height=40;const x=c.getContext('2d');x.fillStyle='white';x.fillRect(0,0,40,40);x.fillStyle='black';x.fillText('TEST',2,20);return c.toDataURL('image/png').split(',')[1]}"))
 pg.set_input_files('[name=documents]',{'name':'TEST-garanti.png','mimeType':'image/png','buffer':image})
 pg.wait_for_function("async()=>{const db=await import('./js/db.js');return (await db.getAll('drafts')).some(d=>d.form.startsWith('spare-part-new:')&&d.values.files?.length===1)}")
 pg.reload();pg.wait_for_selector('[name=description]');assert pg.input_value('[name=description]')=='TEST Akü';assert 'TEST-garanti.png' in pg.locator('[data-file-preview]').inner_text()
 pg.locator('[data-part-form] [type=submit]').click();pg.wait_for_function("()=>document.querySelector('[data-add-files]')||document.querySelector('[data-part-error]')?.textContent");assert pg.locator('[data-add-files]').count(),pg.locator('#screen').inner_text()
 assert '6.000' in pg.locator('#screen').inner_text();assert pg.locator('[data-attachments] img').count()==1;pg.screenshot(path='/tmp/solo-v3958-parts.png',full_page=True)
 result=pg.evaluate("""async()=>{const db=await import('./js/db.js'),C=await import('./js/costs-core.js'),E=await import('./js/enterprise-core.js');const d=await db.dumpAll(),parts=d.maintenance_parts.filter(r=>r.tracking);return {parts,expenses:d.expense_records,atts:await db.getAll('attachments'),cost:C.costTotals(C.costRows(d)).total,ledger:E.costLedger(d).reduce((n,r)=>n+r.gross,0)}}""")
 assert len(result['parts'])==1 and len(result['expenses'])==1 and len(result['atts'])==1 and result['cost']==6000 and result['ledger']==6000;assert result['atts'][0]['size']==len(image)
 pid=result['parts'][0]['id'];eid=result['expenses'][0]['id']
 pg.click('[data-go="#/gider/'+eid+'"]');pg.wait_for_selector('[data-go="#/yedek-parca/'+pid+'"]');pg.click('[data-go="#/yedek-parca/'+pid+'"]');pg.wait_for_selector('[data-add-files]')

 pg.evaluate("async x=>{const db=await import('./js/db.js');await db.draftSave('spare-part-new:'+x.vehicle,{key:x.key,fields:{description:'TEST response lost'},files:[]})}",{'vehicle':ids['vehicle'],'key':result['parts'][0]['request_id']})
 pg.goto(U+'index.html#/yedek-parca/new?vehicle_id='+ids['vehicle']);pg.wait_for_selector('[data-add-files]');assert pg.url.endswith('/'+pid)

 pg.set_input_files('[data-add-files] [name=documents]',{'name':'TEST-garanti.png','mimeType':'image/png','buffer':image});pg.locator('[data-add-files] [type=submit]').click();pg.wait_for_function("()=>{const b=document.querySelector('[data-add-files] button[type=submit]');return b&&!b.disabled}")
 assert pg.evaluate("async()=> (await (await import('./js/db.js')).getAll('attachments')).length")==1
 for width in [320,360,768]:pg.set_viewport_size({'width':width,'height':850});assert pg.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),width
 pg.goto(U+'index.html#/filo/'+ids['vehicle']);pg.wait_for_selector('[data-go^="#/yedek-parca"]');pg.click('[data-tab=cost]');pg.wait_for_function("()=>document.querySelector('[data-card-content]')?.textContent.includes('Kayıtlı toplam maliyet (brüt)')");assert '6.000' in pg.locator('[data-card-content]').inner_text(),pg.locator('[data-card-content]').inner_text();pg.click('[data-go^="#/yedek-parca"]');pg.wait_for_selector('[data-parts-list]');assert 'TEST Akü' in pg.locator('[data-parts-list]').inner_text()
 print('PASS 2 batteries + warranty photo; draft survives reload with file; exactly one 6000 TL expense; repeated attachment deduplicates; vehicle link and 320/360/768px fit',flush=True)
 # Atomic retry, concurrency, conflict, invalid file and source edits, all on real database.
 report=pg.evaluate("""async ids=>{
 const db=await import('./js/db.js'),P=await import('./js/parts-db.js'),C=await import('./js/core.js'),E=await import('./js/enterprise-db.js'),S=await import('./js/solo-core.js'),B=await import('./js/backup.js');
 const date=C.todayStr(),f={date,vehicle_id:ids.vehicle,description:'TEST retry',quantity:2,unit_price:50,cost_mode:'new_expense'};
 const checks={}; const reject=async(fn)=>{try{await fn();return false}catch(e){return e.message}};
 const pair=await Promise.all([P.saveSparePart(f,[],'TEST-RETRY'),P.saveSparePart(f,[],'TEST-RETRY')]);checks.retry=pair[0].id===pair[1].id;
 checks.conflict=await reject(()=>P.saveSparePart({...f,quantity:3},[],'TEST-RETRY'));
 const before=(await db.listActive('maintenance_parts')).length;
 checks.invalidFile=await reject(()=>P.saveSparePart(f,[new File(['<svg onload=alert(1)>'],'fake.png',{type:'image/png'})],'TEST-BAD'));
 checks.noInvalidWrite=(await db.listActive('maintenance_parts')).length===before;
 checks.editBlocked=await reject(async()=>db.saveExisting('expense_records',await db.get('expense_records',ids.eid),{amount:1},'TEST'));
 checks.deleteBlocked=await reject(()=>db.softDelete('expense_records',ids.eid,'TEST'));
 const part=await db.get('maintenance_parts',ids.pid);
 await P.updatePartWarranty(ids.pid,{...part,warranty_until:'2028-11-01'},part.updated_at);
 checks.staleWarranty=await reject(()=>P.updatePartWarranty(ids.pid,{...part,warranty_until:'2028-12-01'},part.updated_at));
 // Real failure halfway through transaction: expense write succeeds then attachment duplicate ID aborts.
 const T=await import('./js/enterprise-db.js');const expensesBefore=(await db.listActive('expense_records')).length,att=(await db.getAll('attachments'))[0];
 checks.abort=await reject(()=>T.transaction(['expense_records','attachments'],(d,t)=>{t.add('expense_records',C.newRecord({amount:999,date}));t.add('attachments',att)}));
 checks.rollback=(await db.listActive('expense_records')).length===expensesBefore;
 const backup=await B.fullBackup(db,{attachments:'base64'});S.validateSoloData(backup.data);checks.backupHasPhoto=backup.attachments.some(a=>a.record_type==='maintenance_parts'&&a.record_id===ids.pid&&a.base64);
 // Backup validator rejects missing / cancelled cost link.
 checks.brokenLink=await reject(async()=>{const d=await db.dumpAll();d.expense_records=d.expense_records.filter(e=>e.id!==ids.eid);S.validateSoloData(d)});
 // Missing payroll payment method must not mutate the ledger.
 const person=await db.saveNew('personnel',{name:'TEST Payroll',active:true},'TEST');const pc=(await db.getAll('payroll_entries')).length;
 checks.method=await reject(()=>E.savePayroll({date,personnel_id:person.id,period:date.slice(0,7),kind:'Avans',amount:100}));checks.noPayrollWrite=(await db.getAll('payroll_entries')).length===pc;
 // A closed given cheque holds its original bank/payment relationship.
 const supplier=await E.saveSupplier({name:'TEST Cheque'}),bank=await E.saveBank({name:'TEST Bank',opening_date:date,opening_balance:1000}),bill=await E.savePayable({date,due_date:date,document_no:'TEST-58',party_type:'supplier',party_id:supplier.id,items:[{description:'TEST',quantity:1,unit_price:100,kdv_rate:0}]}),pay=await E.paySupplier({date,payable_id:bill.id,amount:100,method:'Banka',bank_account_id:bank.id}),check=await E.saveInstrument({date,due_date:date,kind:'Çek',direction:'Verilen',document_no:'TEST-CHECK',party_type:'supplier',party_id:supplier.id,amount:100});await E.transitionInstrument(check.id,'Bankaya Verildi');await E.transitionInstrument(check.id,'Kapandı',pay.bank_movement_id);
 checks.cheque=await reject(()=>E.reverseSupplierPayments(pay.id,'TEST'));
 checks.chequeIntact=!(await db.get('supplier_payments',pay.id)).deleted_at&&!(await db.get('bank_movements',pay.bank_movement_id)).deleted_at;
 // Unlink is explicit and does not erase a real expense.
 await P.unlinkPartCost(ids.pid,'TEST correction');checks.unlinkedExpenseKept=!(await db.get('expense_records',ids.eid)).deleted_at&&(await db.get('maintenance_parts',ids.pid)).cost_mode==='tracking';
 return {checks,backup};
 }""",{**ids,'pid':pid,'eid':eid})
 assert all(report['checks'].values()),report['checks']
 print('PASS '+json.dumps(report['checks'],ensure_ascii=False),flush=True)
 # Restore on a second clean device profile, preserve photos and references.
 c2=b.new_context();c2.add_init_script("localStorage.setItem('sp_role','boss')");p2=c2.new_page();p2.goto(U+'index.html#/yedek-parca');p2.wait_for_selector('[name=vehicle_filter]')
 restored=p2.evaluate("""async backup=>{const db=await import('./js/db.js'),B=await import('./js/backup.js');const preview=await B.previewBackup(db,backup);await B.restoreBackup(db,backup);return {parts:await db.listActive('maintenance_parts'),atts:await db.getAll('attachments')}}""",report['backup'])
 assert len(restored['parts'])==2 and len(restored['atts'])==1
 p2.goto(U+'index.html#/yedek-parca/'+pid);p2.wait_for_selector('[data-attachments] img')
 c.set_offline(True);pg.goto(U+'index.html#/yedek-parca/'+pid);pg.wait_for_selector('[data-attachments] img')
 assert not errors,errors
 print('PASS full backup restored into separate clean browser profile with warranty/photo; saved part opens offline; zero browser errors',flush=True)
 c2.close();c.close();b.close()
