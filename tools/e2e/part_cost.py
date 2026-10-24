"""Part cost choice and repair of saved tracking cards; real DOM/IDB, no AI."""
import sys,json
from playwright.sync_api import sync_playwright
U=(sys.argv[1] if len(sys.argv)>1 else 'http://localhost:8842/').rstrip('/')+'/'
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);c=b.new_context(viewport={'width':390,'height':850});c.add_init_script("localStorage.setItem('sp_role','boss')")
 pg=c.new_page();errors=[];pg.on('pageerror',lambda e:errors.append(str(e)))
 pg.goto(U+'index.html#/yedek-parca');pg.wait_for_selector('[data-parts-list]')
 ids=pg.evaluate("""async()=>{const d=await import('./js/db.js');const v=await d.saveNew('vehicles',{name:'TEST Cost Truck',plate:'34TEST67'},'TEST');await d.draftSave('spare-part-new:'+v.id,{key:'TEST old unconfirmed draft',fields:{vehicle_id:v.id,cost_mode:'tracking'},files:[]});return {v:v.id}}""")
 def state():return pg.evaluate("""async()=>{const d=await import('./js/db.js');return JSON.stringify({d:await d.dumpAll(),a:await d.getAll('audit_log')})}""")
 pg.goto(U+'index.html#/yedek-parca/new?vehicle_id='+ids['v']);pg.wait_for_selector('[data-part-reader]');pg.wait_for_function("()=>!document.querySelector('[data-part-form]').inert")
 pg.fill('[name=description]','TEST Two Batteries');pg.fill('[name=quantity]','2')
 assert pg.input_value('[name=cost_mode]')==''
 before=state();pg.locator('[data-part-form] [type=submit]').click();assert state()==before
 assert not pg.locator('[name=cost_mode]').evaluate('(el)=>el.checkValidity()')
 pg.select_option('[name=cost_mode]','tracking');assert 'Giderlere bedel yazılmayacak' in pg.locator('[data-cost-preview]').inner_text()
 pg.locator('[data-part-form] [type=submit]').click();pg.wait_for_selector('[data-add-files]');assert 'Gider kaydı yok' in pg.inner_text('#screen')
 pid=pg.url.split('#/yedek-parca/')[1];pg.click('[data-go="#/yedek-parca/'+pid+'/maliyet"]');pg.wait_for_selector('[data-part-cost-form]')
 before=state();pg.select_option('[name=cost_mode]','new_expense');pg.locator('[data-part-cost-form] [type=submit]').click();assert state()==before
 pg.fill('[name=unit_price]','3000');assert '6.000' in pg.locator('[data-cost-preview]').inner_text()
 pg.reload();pg.wait_for_selector('[data-part-cost-form]');assert pg.input_value('[name=cost_mode]')==''
 pg.select_option('[name=cost_mode]','new_expense');pg.fill('[name=unit_price]','3000');pg.locator('[data-part-cost-form] [type=submit]').click();pg.wait_for_selector('[data-add-files]');assert 'Gider kaydına bağlı' in pg.inner_text('#screen')
 check=pg.evaluate("""async pid=>{const d=await import('./js/db.js'),C=await import('./js/costs-core.js');const all=await d.dumpAll(),r=await d.get('maintenance_parts',pid);return {parts:all.maintenance_parts.filter(x=>x.tracking).length,expenses:all.expense_records.length,amount:all.expense_records[0].amount,cost:C.costTotals(C.costRows(all)).total,quantity:r.quantity,total:r.total,cash:all.cash_records.length,bank:all.bank_movements.length}}""",pid)
 assert check=={'parts':1,'expenses':1,'amount':6000,'cost':6000,'quantity':2,'total':6000,'cash':0,'bank':0},check
 pg.goto(U+'index.html#/yedek-parca/'+pid+'/maliyet');pg.wait_for_selector('#screen[data-view-ready="1"]');assert pg.locator('[data-part-cost-form]').count()==0
 pg.goto(U+'index.html#/yedek-parca');pg.wait_for_selector('[data-parts-list]');assert 'Gider kaydına bağlı' in pg.locator('[data-parts-list]').inner_text()
 print('PASS required explicit cost choice; tracking receipt states no expense; saved two-battery card acquires one 6000 TL expense without recreating part, cash or bank; linked detail/list and repeat route are clear',flush=True)
 report=pg.evaluate("""async ids=>{
 const d=await import('./js/db.js'),P=await import('./js/parts-db.js'),C=await import('./js/core.js'),CC=await import('./js/costs-core.js'),S=await import('./js/solo-core.js'),B=await import('./js/backup.js');
 const state=async()=>JSON.stringify({d:await d.dumpAll(),a:await d.getAll('audit_log')});
 const reject=async run=>{try{await run();return null}catch(e){return e.message}};
 const f={vehicle_id:ids.v,date:C.todayStr(),description:'TEST Cost Guard',quantity:2,unit_price:100,cost_mode:'tracking'};
 const file=new File(['%PDF-1.4\\nTEST Warranty\\n%%EOF'],'TEST.pdf',{type:'application/pdf'});
 const r=await P.saveSparePart(f,[file],'TEST tracking');
 const atts=JSON.stringify(await d.getAll('attachments')),before=await state();
 const empty=await reject(()=>P.attachPartCost(r.id,{cost_mode:'new_expense',unit_price:''},r.updated_at,'TEST missing price'));
 const emptyClean=before===await state();
 const vehicle=await d.saveNew('vehicles',{name:'TEST Other'},'TEST'),wrong=await d.saveNew('expense_records',{vehicle_id:vehicle.id,date:f.date,amount:200},'TEST');
 const badBefore=await state(),badSource=await reject(()=>P.attachPartCost(r.id,{cost_mode:'existing',cost_source_store:'expense_records',cost_source_id:wrong.id},r.updated_at,'TEST wrong vehicle'));
 const badClean=badBefore===await state();
 // A real expense insert error aborts the entire transaction, including part and audit.
 const add=IDBObjectStore.prototype.add,abortBefore=await state();let hit=false,abort;
 IDBObjectStore.prototype.add=function(row,...args){const req=add.call(this,row,...args);if(this.name==='expense_records'&&!hit){hit=true;add.call(this,row,...args)}return req};
 try{await P.attachPartCost(r.id,{cost_mode:'new_expense',unit_price:100},r.updated_at,'TEST abort')}catch(e){abort=e.message}finally{IDBObjectStore.prototype.add=add}
 const abortClean=abortBefore===await state();
 const intent={cost_mode:'new_expense',unit_price:100},a=await P.attachPartCost(r.id,intent,r.updated_at,'TEST attach'),retry=await P.attachPartCost(r.id,intent,r.updated_at,'TEST attach');
 const conflictBefore=await state(),conflict=await reject(()=>P.attachPartCost(r.id,{...intent,unit_price:101},r.updated_at,'TEST attach')),duplicate=await reject(()=>P.attachPartCost(r.id,intent,a.updated_at,'TEST second'));
 const conflictClean=conflictBefore===await state(),originals=atts===JSON.stringify(await d.getAll('attachments'));
 const unlinked=await P.unlinkPartCost(a.id,'TEST fix');const priorBefore=await state(),prior=await reject(()=>P.attachPartCost(a.id,intent,unlinked.updated_at,'TEST duplicate after unlink')),priorClean=priorBefore===await state();
 const existingIntent={cost_mode:'existing',cost_source_store:a.cost_source_store,cost_source_id:a.cost_source_id};
 const linked=await P.attachPartCost(a.id,existingIntent,unlinked.updated_at,'TEST relink');
 const linkedRetry=await P.attachPartCost(a.id,existingIntent,unlinked.updated_at,'TEST relink');
 const racePart=await P.saveSparePart({...f,description:'TEST Race'},[],'TEST race source');
 const race=await Promise.allSettled(['A','B'].map(k=>P.attachPartCost(racePart.id,intent,racePart.updated_at,'TEST race '+k)));
 const stalePart=await P.saveSparePart({...f,description:'TEST Stale'},[],'TEST stale source');await P.updatePartWarranty(stalePart.id,{...stalePart,brand:'TEST new'},stalePart.updated_at);
 const staleBefore=await state(),stale=await reject(()=>P.attachPartCost(stalePart.id,intent,stalePart.updated_at,'TEST stale')),staleClean=staleBefore===await state();
 const all=await d.dumpAll();S.validateSoloData(all);const backup=await B.fullBackup(d,{attachments:'base64'});
 return {empty,emptyClean,badSource,badClean,hit,abort,abortClean,retry:a.id===retry.id,conflict,duplicate,conflictClean,originals,prior,priorClean,relink:linked.cost_source_id===a.cost_source_id&&linkedRetry.id===a.id,race:race.filter(x=>x.status==='fulfilled').length,stale,staleClean,parts:all.maintenance_parts.filter(x=>x.tracking).length,expenses:all.expense_records.length,cost:CC.costTotals(CC.costRows(all)).total,backup};
 }""",ids)
 backup=report.pop('backup')
 for key in ['empty','emptyClean','badSource','hit','abort','abortClean','retry','conflict','duplicate','conflictClean','originals','prior','priorClean','relink','stale','staleClean','badClean']:assert report[key],(key,report)
 assert report['race']==1 and report['parts']==4 and report['expenses']==4 and report['cost']==6600,report
 print('PASS missing amount and wrong-vehicle source rejected; real failed expense insert rolls back part/audit; retry, conflicting content, duplicate link, unlink/relink, concurrent saves, stale edit and original-file retention',flush=True)
 pg.goto(U+'index.html#/yedek-parca/'+pid);pg.wait_for_selector('[data-add-files]')
 for width in [320,390,768]:pg.set_viewport_size({'width':width,'height':850});assert pg.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),width
 clean=b.new_context();clean.add_init_script("localStorage.setItem('sp_role','boss')");p2=clean.new_page();p2.goto(U+'index.html#/daha');p2.wait_for_selector('#screen[data-view-ready="1"]')
 result=p2.evaluate("""async backup=>{const d=await import('./js/db.js'),B=await import('./js/backup.js'),CC=await import('./js/costs-core.js');await B.restoreBackup(d,backup);const all=await d.dumpAll();return {parts:all.maintenance_parts.filter(x=>x.tracking).length,expenses:all.expense_records.length,cost:CC.costTotals(CC.costRows(all)).total,files:(await d.getAll('attachments')).length}}""",backup)
 assert result=={'parts':4,'expenses':4,'cost':6600,'files':1},result
 # Existing-cost selection from the real form must not create a second expense.
 existing=p2.evaluate("""async()=>{const d=await import('./js/db.js'),P=await import('./js/parts-db.js'),C=await import('./js/core.js');const e=(await d.listActive('expense_records'))[0];const r=await P.saveSparePart({vehicle_id:e.vehicle_id,date:C.todayStr(),description:'TEST Existing Cost',quantity:1,unit_price:null,cost_mode:'tracking'},[],'TEST existing UI');return {pid:r.id,eid:e.id}}""")
 p2.goto(U+'index.html#/yedek-parca/'+existing['pid']+'/maliyet');p2.wait_for_selector('[data-part-cost-form]');p2.select_option('[name=cost_mode]','existing')
 assert p2.locator('[name=source]').evaluate('(el)=>el.required')
 p2.select_option('[name=source]','expense_records:'+existing['eid']);p2.locator('[data-part-cost-form] [type=submit]').click();p2.wait_for_selector('[data-add-files]')
 assert 'Gider kaydına bağlı' in p2.inner_text('#screen')
 assert p2.evaluate("async()=> (await (await import('./js/db.js')).listActive('expense_records')).length")==4
 print('PASS existing-cost form links the selected expense without a second cost; full backup restores all cost links and original document; mobile 320/390/768 fits',flush=True)
 assert not errors,errors;b.close()
print('part_cost browser PASS',flush=True)
