"""Operational request identities, stock and cost preservation; no model calls."""
import argparse,json,uuid
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright
ap=argparse.ArgumentParser();ap.add_argument('url',nargs='?',default='http://localhost:8841/');a=ap.parse_args();base=a.url.rstrip('/')+'/';assert urlparse(base).hostname in ('localhost','127.0.0.1')
with sync_playwright() as w:
 b=w.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);c=b.new_context(service_workers='block');c.add_init_script("localStorage.setItem('sp_role','boss')");p=c.new_page();errors=[];p.on('pageerror',lambda e:errors.append(str(e)));p.goto(base+'index.html?db=TEST_ops_retry108_'+uuid.uuid4().hex+'#/daha');p.wait_for_selector('#screen[data-view-ready="1"]')
 result=p.evaluate("""async()=>{
 const D=await import('./js/db.js'),E=await import('./js/enterprise-db.js'),S=await import('./js/solo-db.js'),C=await import('./js/core.js'),F=await import('./js/enterprise-core.js'),P=await import('./js/parts-db.js'),today=C.todayStr(),yesterday=C.addDays(today,-1);
 const customer=await D.saveNew('customers',{name:'TEST Customer'},'TEST'),site=await D.saveNew('sites',{name:'TEST Site',customer_id:customer.id},'TEST'),person=await D.saveNew('personnel',{name:'TEST Operator'},'TEST'),vehicle=await D.saveNew('vehicles',{name:'TEST Machine',type:'JCB'},'TEST');
 const maintenance=await D.saveNew('maintenance_records',{date:yesterday,vehicle_id:vehicle.id,maint_type:'Bakım',status:'Tamamlandı',description:'TEST Maintenance',cost:10},'TEST'),expense=await D.saveNew('expense_records',{date:today,category:'Yemek',amount:100,payment_method:'Nakit',description:'TEST Shared Cost'},'TEST');
 const plan=await E.saveServicePlan({vehicle_id:vehicle.id,title:'TEST Service',next_date:yesterday},'TEST_PLAN');await E.completeServicePlan(plan.id,maintenance.id);
 const ops=[
 ['meter','saveMeter',{date:yesterday,vehicle_id:vehicle.id,kind:'hours',value:100},[{value:101},{kind:'km'}]],
 ['shift','saveShift',{date:today,personnel_id:person.id,vehicle_id:vehicle.id,customer_id:customer.id,site_id:site.id,start:'08:00',end:'10:00',break_minutes:0,task:'TEST Task'},[{end:'11:00'},{task:'TEST Different Task'}]],
 ['custody','saveCustody',{date:today,personnel_id:person.id,owner_type:'equipment',asset_name:'TEST Equipment'},[{asset_name:'TEST Other Equipment'},{date:yesterday}]],
 ['downtime','saveDowntime',{vehicle_id:vehicle.id,started_at:yesterday+'T08:00:00Z',reason:'TEST Repair'},[{reason:'TEST Other Repair'},{started_at:yesterday+'T09:00:00Z'}]],
 ['part','savePart',{maintenance_id:maintenance.id,description:'TEST Part',kind:'Parça',quantity:1,unit_price:10},[{quantity:2},{unit_price:11}]],
 ['spare','saveSparePart',{date:today,vehicle_id:vehicle.id,description:'TEST Warranty Part',quantity:1,unit_price:10,cost_mode:'tracking'},[{quantity:2},{description:'TEST Different Part'}]],
 ['allocation','saveAllocation',{source_store:'expense_records',source_id:expense.id,targets:[{vehicle_id:vehicle.id,weight:1}]},[{targets:[{vehicle_id:vehicle.id,weight:2}]}]],
 ['stock','countStock',{date:today,physical_liters:0,reason:' TEST physical count '},[{physical_liters:5},{reason:'TEST Different Count'}]],
 ['renewal','renewService',{completed_date:today,interval_days:30},[{interval_days:31},{completed_date:yesterday}]]
 ];
 const unsafe=[],report=[],call=(method,input,key)=>method==='saveSparePart'?P.saveSparePart(input,[],key):method==='renewService'?S.renewService(plan.id,input,key):S[method](input,key);
 for(const [label,method,input,changes]of ops){const key='TEST_OP_'+label,first=await call(method,structuredClone(input),key),before=await D.dumpAll(),repeat=await call(method,structuredClone(input),key);if(first.id!==repeat.id)unsafe.push(label+': different retry identity');for(const change of changes){let code;try{await call(method,{...structuredClone(input),...change},key);}catch(e){code=e.code||e.message;}if(code!=='OP_CONFLICT')unsafe.push(label+': changed request accepted '+JSON.stringify(change));}if(JSON.stringify(await D.dumpAll())!==JSON.stringify(before))unsafe.push(label+': duplicate changed data');report.push({label,checks:changes.length});}
 const data=await D.dumpAll(),cost=F.costLedger(data).reduce((n,r)=>n+C.toKurus(r.gross),0);if(cost!==11000)unsafe.push('Information-only parts/allocation doubled real cost; expected shared expense100 + maintenance10');if(data.work_records.length)unsafe.push('A planned shift became realized work');if(data.fuel_tank_movements.length)unsafe.push('Zero stock difference produced a tank movement');
 const shift=data.shift_assignments.find(r=>r.request_id==='TEST_OP_shift');await S.shiftStatus(shift.id,'İptal','TEST Cancel');const beforeCancel=await D.dumpAll();let code;try{await S.saveShift(ops.find(x=>x[0]==='shift')[2],'TEST_OP_shift');}catch(e){code=e.code;}if(code!=='OP_REVERSED')unsafe.push('Canceled shift retry appeared successful');if(JSON.stringify(await D.dumpAll())!==JSON.stringify(beforeCancel))unsafe.push('Canceled shift retry wrote data');
 const spare=data.maintenance_parts.find(r=>r.request_id==='TEST_OP_spare');await D.put('maintenance_parts',{...spare,deleted_at:new Date().toISOString()});const beforePartRetry=await D.dumpAll();let partCode;try{await P.saveSparePart(ops.find(x=>x[0]==='spare')[2],[],'TEST_OP_spare');}catch(e){partCode=e.code;}if(partCode!=='OP_REVERSED')unsafe.push('Removed warranty part retry appeared successful');if(JSON.stringify(await D.dumpAll())!==JSON.stringify(beforePartRetry))unsafe.push('Removed part retry wrote data');
 return {operations:report,changedRequestChecks:report.reduce((n,r)=>n+r.checks,0),cost:cost/100,stockMovements:data.fuel_tank_movements.length,realizedWorks:data.work_records.length,unsafe};
 }""")
 print(json.dumps(result,ensure_ascii=False),flush=True);assert not result['unsafe'],'Repeated operational request must reject changed fields and preserve stock, costs and planned work';assert not errors,errors;b.close()
