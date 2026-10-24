"""Financial/stock redteam: isolated profiles, actual IDB failures and two tabs; mocked model response, no external AI calls."""
import sys,json
from playwright.sync_api import sync_playwright
U=(sys.argv[1] if len(sys.argv)>1 else 'http://localhost:8841/').rstrip('/')+'/'
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);errors=[]
 def profile():
  c=b.new_context(viewport={'width':390,'height':850});c.add_init_script("localStorage.setItem('sp_role','boss')");pg=c.new_page();pg.on('pageerror',lambda e:errors.append(str(e)));pg.goto(U+'index.html#/daha');pg.wait_for_selector('#screen[data-view-ready="1"]');return c,pg
 c,pg=profile()
 r=pg.evaluate("""async()=>{
 const d=await import('./js/db.js'),E=await import('./js/enterprise-db.js'),C=await import('./js/core.js'),R=await import('./js/record-refresh.js');
 const v=await d.saveNew('vehicles',{name:'TEST Timeline'}),customer=await d.saveNew('customers',{name:'TEST Ledger'}),supplier=await E.saveSupplier({name:'TEST Numeric'}),date=C.todayStr();
 const snapshot=async()=>JSON.stringify({d:await d.dumpAll(),audit:await d.getAll('audit_log')});
 const rejected=async run=>{const before=await snapshot();try{await run();return false}catch(e){if(before!==await snapshot())throw Error('Rejected write left business/audit data: '+e.message);return e.code||e.message;}};
 const base={date,due_date:date,document_no:'TEST NUMERIC',party_type:'supplier',party_id:supplier.id,items:[{description:'TEST',quantity:2,unit_price:100,kdv_rate:0}]};
 const invalid=[];
 for(const bad of [true,false,[],[25],{},' ',1e308])invalid.push(await rejected(()=>E.savePayable({...base,items:[{description:'TEST',quantity:bad,unit_price:100,kdv_rate:0}]})));
 invalid.push(await rejected(()=>E.savePayable({...base,items:[{description:'TEST',quantity:1,unit_price:true,kdv_rate:0}]})));
 const bill=await E.savePayable(base,'TEST VALID');
 for(const bad of [true,[25],{},' ',0.001])invalid.push(await rejected(()=>E.paySupplier({date,payable_id:bill.id,amount:bad,method:'Nakit'})));
 for(const run of [()=>d.saveNew('expense_records',{date,category:'TEST',amount:0.001}),()=>d.saveNew('cash_records',{date,customer_id:customer.id,cash_type:'Müşteriden Para Alındı',amount:0.001}),()=>d.saveCashEvent({date,customer_id:customer.id,cash_type:'Müşteriden Para Alındı',amount:0.001})])invalid.push(await rejected(run));
 // Real DataCloneError in the second request, after the business put was queued.
 const put=IDBObjectStore.prototype.put;let hit=false,atomic;
 IDBObjectStore.prototype.put=function(row,...args){if(this.name==='audit_log'&&!hit){hit=true;return put.call(this,{...row,TEST_UNCLONEABLE:()=>0},...args)}return put.call(this,row,...args)};
 try{atomic=await rejected(()=>d.saveNew('work_records',{date,customer_id:customer.id,vehicle_id:v.id,work_type:'Makine Çalışması',unit:'Saat',quantity:1},'TEST atomic audit'))}finally{IDBObjectStore.prototype.put=put}
 const late=await d.saveNew('fuel_tank_movements',{date:'2026-10-23',move_type:'GİRİŞ',liters:100,total:5000});
 const f={date:'2026-09-07',vehicle_id:v.id,liters:10,fuel_source:'Depo Tankı'};
 const past=await rejected(()=>d.saveNew('fuel_records',f));
 const pastDirect=await rejected(()=>d.saveFuelEvent(f));
 const pastDelivery=await rejected(()=>d.saveCustomerFuelDelivery({date:f.date,customer_id:customer.id,machine:'TEST Forklift',liters:10,unit_price:50}));
 const opening=await d.saveNew('fuel_tank_movements',{date:'2026-09-01',move_type:'GİRİŞ',liters:100});
 const fuel=await d.saveNew('fuel_records',{...f,liters:20});
 if(fuel.total!=null)throw Error('Future intake price was applied to an unpriced historical fuel');
 const delivery=await d.saveCustomerFuelDelivery({date:'2026-09-20',customer_id:customer.id,machine:'TEST Forklift',liters:80,unit_price:50});
 const futureConsumed=await rejected(()=>d.saveNew('fuel_records',{...f,date:'2026-09-08',liters:1}));
 const reduceInput=await rejected(()=>d.saveExisting('fuel_tank_movements',opening,{liters:90},'TEST insufficient opening'));
 const moveInput=await rejected(()=>d.saveExisting('fuel_tank_movements',opening,{date:'2026-10-01'},'TEST late opening'));
 const pairFuel=await rejected(()=>d.saveExisting('fuel_records',fuel,{liters:21},'TEST one side'));
 const move=await d.get('fuel_tank_movements',fuel.tank_movement_id);
 const pairMove=await rejected(()=>d.saveExisting('fuel_tank_movements',move,{liters:21},'TEST one side'));
 const corrected=await d.saveExisting('fuel_records',fuel,{description:'TEST only note',date:fuel.date,liters:String(fuel.liters)},'TEST note edit');
 const events=[],unwatch=R.watchRecords(x=>events.push(x));
 const cash=await d.saveNew('cash_records',{date,customer_id:customer.id,cash_type:'Müşteriden Para Alındı',amount:200,payment_method:'Nakit',request_id:'TEST CASH REFRESH'});
 const notices=events.length;await d.saveNew('cash_records',{date,customer_id:customer.id,cash_type:'Müşteriden Para Alındı',amount:200,payment_method:'Nakit',request_id:'TEST CASH REFRESH'});
 const retryQuiet=events.length===notices;await d.cancelCustomerFuelDelivery(delivery.id,'TEST cancelled');unwatch();
 await d.fuelFix(fuel.id,'delete','TEST trash');const restored=await d.restore('fuel_records',fuel.id),restoredMove=await d.get('fuel_tank_movements',fuel.tank_movement_id);
 const restoredPair=!restored.deleted_at&&!restoredMove.deleted_at&&restored.tank_movement_id===restoredMove.id;
 const financeRestore=await rejected(()=>d.restore('cari_movements',delivery.cari_movement_id));
 const state=await d.dumpAll();return {invalid:invalid.every(Boolean),bill:bill.gross_total,hit,atomic,past,pastDirect,pastDelivery,futureConsumed,reduceInput,moveInput,pairFuel,pairMove,note:corrected.description,events,retryQuiet,restoredPair,financeRestore,remaining:C.calcTankBalance(state.fuel_tank_movements).remaining,customer:customer.id,vehicle:v.id};
 }""")
 assert r['invalid'] and r['bill']==200 and r['hit'] and r['atomic'],r
 for key in ['past','pastDirect','pastDelivery','futureConsumed','reduceInput','moveInput']:assert r[key]=='TANK_HISTORY',(key,r)
 assert r['pairFuel'] and r['pairMove'] and r['note']=='TEST only note' and r['retryQuiet'] and r['remaining']==180 and r['restoredPair'] and r['financeRestore'],r
 assert any('cash_records' in x['stores'] for x in r['events']) and any('cari_movements' in x['stores'] for x in r['events'])
 print('PASS bad financial types/overflow/zero-cent payments rejected with zero writes; second-request DataCloneError rolls back work and audit; historical stock/later consumption/input edits/pair guards; notifications only after commit and quiet retry',flush=True)
 # An actual open customer card refreshes after a collection made in another tab.
 pg.goto(U+'index.html#/musteriler/'+r['customer']);pg.wait_for_selector('#screen[data-view-ready="1"]')
 second=c.new_page();second.goto(U+'index.html#/daha');second.wait_for_selector('#screen[data-view-ready="1"]');pg.bring_to_front()
 before=pg.evaluate('document.querySelector("#screen").textContent')
 second.evaluate("""async id=>{const d=await import('./js/db.js'),C=await import('./js/core.js');await d.saveNew('cash_records',{date:C.todayStr(),customer_id:id,cash_type:'Müşteriden Para Alındı',amount:37,payment_method:'Nakit',request_id:'TEST CROSS TAB'})}""",r['customer'])
 pg.wait_for_function("()=>{const el=document.querySelector('#screen');return el?.dataset.viewReady==='1'&&el.textContent.includes('237');}")
 print('PASS existing customer view refreshes after another tab posts a collection without a manual reload',flush=True)
 # A previously imported gap is visible, while a valid later exit may proceed.
 gapc,gap=profile()
 gapids=gap.evaluate("""async()=>{const d=await import('./js/db.js'),C=await import('./js/core.js');const v=await d.saveNew('vehicles',{name:'TEST Gap Vehicle'});await d.put('fuel_tank_movements',C.newRecord({date:'2026-09-07',move_type:'ÇIKIŞ',liters:10}));await d.saveNew('fuel_tank_movements',{date:'2026-10-23',move_type:'GİRİŞ',liters:100});await d.saveNew('fuel_records',{date:C.todayStr(),vehicle_id:v.id,liters:20,fuel_source:'Depo Tankı'});return {remaining:C.calcTankBalance(await d.getAll('fuel_tank_movements')).remaining}}""")
 assert gapids['remaining']==70
 gap.goto(U+'index.html#/depo');gap.wait_for_selector('[data-tank-chronology]');assert '07.09.2026' in gap.locator('[data-tank-chronology]').inner_text()
 for width in [320,390,768]:gap.set_viewport_size({'width':width,'height':850});assert gap.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),width
 print('PASS existing gap remains visible in tank timeline while later safe work continues; 320/390/768px layout fits',flush=True)
 # Input reduction and consumption from two real tabs cannot jointly spend the same stock.
 rc,a=profile();race=a.evaluate("""async()=>{const d=await import('./js/db.js'),C=await import('./js/core.js');const v=await d.saveNew('vehicles',{name:'TEST Race Vehicle'});const m=await d.saveNew('fuel_tank_movements',{date:C.todayStr(),move_type:'GİRİŞ',liters:100});return {v:v.id,m,start:Date.now()+1200}}""")
 z=rc.new_page();z.goto(U+'index.html#/daha');z.wait_for_selector('#screen[data-view-ready="1"]');race['start']=a.evaluate('Date.now()+400')
 a.evaluate("""x=>{window.__race=(async()=>{await new Promise(r=>setTimeout(r,Math.max(0,x.start-Date.now())));try{await(await import('./js/db.js')).saveExisting('fuel_tank_movements',x.m,{liters:50},'TEST race');return true}catch{return false}})()}""",race)
 z.evaluate("""x=>{window.__race=(async()=>{await new Promise(r=>setTimeout(r,Math.max(0,x.start-Date.now())));try{await(await import('./js/db.js')).saveNew('fuel_records',{date:x.m.date,vehicle_id:x.v,liters:80,fuel_source:'Depo Tankı'});return true}catch{return false}})()}""",race)
 winners=[a.evaluate('async()=>await window.__race'),z.evaluate('async()=>await window.__race')];assert sum(winners)==1,winners
 assert a.evaluate("async()=>(await import('./js/core.js')).calcTankBalance(await(await import('./js/db.js')).getAll('fuel_tank_movements')).remaining")>=0
 # Restoring deleted fuel also checks the old date, not just today's available stock.
 cc,tg=profile();restoration=tg.evaluate("""async()=>{const d=await import('./js/db.js');const v=await d.saveNew('vehicles',{name:'TEST Restore'});await d.saveNew('fuel_tank_movements',{date:'2026-09-01',move_type:'GİRİŞ',liters:100});const f=await d.saveNew('fuel_records',{date:'2026-09-07',vehicle_id:v.id,liters:20,fuel_source:'Depo Tankı'});await d.fuelFix(f.id,'delete','TEST');await d.saveNew('fuel_records',{date:'2026-09-20',vehicle_id:v.id,liters:100,fuel_source:'Depo Tankı'});await d.saveNew('fuel_tank_movements',{date:'2026-10-23',move_type:'GİRİŞ',liters:100});const before=JSON.stringify({data:await d.dumpAll(),audit:await d.getAll('audit_log')});let code;try{await d.restore('fuel_records',f.id)}catch(e){code=e.code}return {code,unchanged:before===JSON.stringify({data:await d.dumpAll(),audit:await d.getAll('audit_log')})}}""")
 assert restoration=={'code':'TANK_HISTORY','unchanged':True},restoration
 # A changed tank average must not rewrite a bill-linked or allocated cost.
 costc,cp=profile();protected=cp.evaluate("""async()=>{const d=await import('./js/db.js'),E=await import('./js/enterprise-db.js'),S=await import('./js/solo-db.js'),C=await import('./js/core.js');const date=C.todayStr(),v=await d.saveNew('vehicles',{name:'TEST Protected Cost'}),c=await d.saveNew('customers',{name:'TEST Cost Owner'}),s=await E.saveSupplier({name:'TEST Cost Supplier'});const input=await d.saveNew('fuel_tank_movements',{date,move_type:'GİRİŞ',liters:100,total:4000,unit_price:40});const a=await d.saveNew('fuel_records',{date,vehicle_id:v.id,liters:10,fuel_source:'Depo Tankı'}),b=await d.saveNew('fuel_records',{date,vehicle_id:v.id,liters:20,fuel_source:'Depo Tankı'});await S.saveAllocation({date,source_store:'fuel_records',source_id:a.id,targets:[{customer_id:c.id,vehicle_id:v.id,weight:1}]});await E.savePayable({date,due_date:date,document_no:'TEST Protected Bill',party_type:'supplier',party_id:s.id,vehicle_id:v.id,source_store:'fuel_records',source_id:b.id,cost_category:'Yakıt',items:[{description:'TEST fuel',quantity:1,unit_price:800,kdv_rate:0}]});let blocked=0;for(const f of [a,b])try{await d.fuelFix(f.id,'delete','TEST protected delete')}catch{blocked++}await d.saveExisting('fuel_tank_movements',input,{total:5000,unit_price:50},'TEST changed average');await d.repairTankPrices();return {blocked,allocated:(await d.get('fuel_records',a.id)).total,billed:(await d.get('fuel_records',b.id)).total}}""")
 assert protected=={'blocked':2,'allocated':400,'billed':800},protected
 # Shared assistant preflight rejects the whole selection before an earlier work can be written.
 mc,mp=profile();mid=mp.evaluate("""async()=>{const d=await import('./js/db.js');const c=await d.saveNew('customers',{name:'TEST Past Customer'}),v=await d.saveNew('vehicles',{name:'TEST Past Vehicle'});await d.saveNew('fuel_tank_movements',{date:'2026-10-23',move_type:'GİRİŞ',liters:100});for(const[k,v]of Object.entries({gemini_key:'TEST',gemini_model:'gemini-2.5-flash',gemini_consent:true,gemini_daily_limit:50}))await d.metaSet(k,v);return {c:c.id,v:v.id}}""")
 plan={'works':[{'date':'2026-09-07','date_source':'mesaj','customer_id':mid['c'],'vehicle_id':mid['v'],'work_type':'Makine Çalışması','unit':'Saat','quantity':1,'quote':'TEST Past Customer TEST Past Vehicle 1 saat çalıştı'}],'fuel':[{'date':'2026-09-07','vehicle_id':mid['v'],'liters':10,'source':'Depo Tankı','quote':'TEST Past Vehicle depodan 10 litre mazot aldı'}]}
 def mock(route):
  body=json.loads(route.request.post_data);parts=[{'functionCall':{'name':'prepare_plan','args':{'goal':'TEST historical preflight','plan_json':json.dumps(plan)}}}] if body.get('tools') else [{'text':json.dumps(plan)}]
  route.fulfill(status=200,content_type='application/json',body=json.dumps({'candidates':[{'content':{'role':'model','parts':parts},'finishReason':'STOP'}]}))
 mc.route('https://generativelanguage.googleapis.com/**',mock);mp.goto(U+'index.html#/akilli-asistan');mp.wait_for_selector('[data-ask]');mp.fill('[data-msg]','[07/09 18:00] TEST: TEST Past Customer TEST Past Vehicle 1 saat çalıştı\n[07/09 18:01] TEST: TEST Past Vehicle depodan 10 litre mazot aldı');mp.click('[data-ask]');mp.wait_for_selector('[data-kind=fuel]')
 snapshot=lambda:mp.evaluate("async()=>{const d=await import('./js/db.js');return JSON.stringify({data:await d.dumpAll(),audit:await d.getAll('audit_log')})}")
 before=snapshot()
 for card in mp.locator('[data-kind=work],[data-kind=fuel]').all():card.locator('[data-pick]').check()
 mp.click('[data-save]');mp.get_by_text('sonraki giriş geçmiş çıkışı karşılamaz',exact=False).last.wait_for();assert snapshot()==before
 print('PASS shared assistant preflight rejects historical stock before any selected work/fuel/audit write',flush=True)
 assert not errors,errors;b.close()
print('integrity_audit browser PASS: real financial validation, rollback, chronology, live balances and concurrent stock mutation',flush=True)
