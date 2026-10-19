"""Adversarial local data tests. Synthetic records only; no external requests."""
from playwright.sync_api import sync_playwright
U='http://localhost:8841/'
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 c=b.new_context(service_workers='block',viewport={'width':412,'height':900})
 c.add_init_script("localStorage.setItem('sp_role','boss')")
 pg=c.new_page();errors=[];pg.on('pageerror',lambda e:errors.append(str(e)))
 pg.goto(U);pg.wait_for_timeout(1200)
 result=pg.evaluate("""async()=>{
 const db=await import('./js/db.js');
 const cust=await db.saveNew('customers',{name:'Redteam TEST'},'TEST');const v=(await db.listActive('vehicles'))[0];
 const base={date:'2026-05-11',customer_id:cust.id,vehicle_id:v.id,work_type:'Kazı',unit:'Saat',quantity:2};
 const tests=[];for(const value of [Infinity,-Infinity,NaN,true,[],{},'Infinity',' ',1e13]){
  tests.push(['work_records',{...base,quantity:value}]);
  tests.push(['expense_records',{date:base.date,vehicle_id:v.id,amount:value,category:'Lastik'}]);
  tests.push(['cash_records',{date:base.date,customer_id:cust.id,cash_type:'Müşteriden Para Alındı',amount:value}]);
  tests.push(['fuel_records',{date:base.date,vehicle_id:v.id,liters:value,fuel_source:'Şantiye'}]);
 }
 tests.push(['work_records',{...base,quantity:1e10,price_snapshot:{unit_price:1e10,kdv_rate:20,kdv_included:false}}]);
 tests.push(['work_records',{...base,price_snapshot:{unit_price:100,kdv_rate:20,kdv_included:'false'}}]);
 const before=await db.dumpAll(),audit=(await db.getAll('audit_log')).length;let rejected=0;
 for(const [s,f] of tests){try{await db.saveNew(s,f,'redteam bad input')}catch(e){rejected++}}
 const after=await db.dumpAll();if(rejected!==tests.length)throw Error(`${rejected}/${tests.length} rejected`);
 if(JSON.stringify(before)!==JSON.stringify(after)||(await db.getAll('audit_log')).length!==audit)throw Error('Rejected payload wrote records/audit');
 const valid=await db.saveNew('work_records',{...base,price_snapshot:{unit_price:0,kdv_rate:0,kdv_included:false}},'TEST zero VAT');
 if(valid.price_snapshot.amount!==0||valid.price_snapshot.kdv_rate!==0)throw Error('Zero VAT/price lost');
 const editBefore=await db.get('work_records',valid.id);let blocked=false;try{await db.saveExisting('work_records',editBefore,{quantity:Infinity},'bad edit')}catch(e){blocked=true}
 if(!blocked||JSON.stringify(editBefore)!==JSON.stringify(await db.get('work_records',valid.id)))throw Error('Invalid edit wrote data');
 return {rejected,total:tests.length,zeroVAT:true,unchanged:true};}""")
 print('PASS invalid numeric payloads rejected atomically:',result)
 proof=pg.evaluate("""async()=>{
 const db=await import('./js/db.js'),S=await import('./js/security.js'),C=await import('./js/security-core.js');
 const person=(await db.listActive('personnel'))[0],vehicle=(await db.listActive('vehicles'))[0],customer=(await db.listActive('customers'))[0];
 const make=()=>S.newDriverLink({pid:person.id,name:'Redteam Driver',days:30});
 const verify=async(link,ids)=>{const code='TEST signed payload';return S.checkPayloads([{lid:link.lid,p:person.id,n:person.name,e:ids.map(id=>({id})),_code:code,_sig:await C.hmac(link.secret,code)}],await db.dumpAll());};
 const base={date:'2026-05-11',vehicle_id:vehicle.id};
 const work={...base,customer_id:customer.id,work_type:'Kazı',quantity:2,unit:'Saat'};
 const a=(await make()).link;await verify(a,['rev-work','rev-fuel','rev-exp','rev-maint']);await S.revokeLink(a.lid,'TEST');
 const before=JSON.stringify(await db.dumpAll()),audit=(await db.getAll('audit_log')).length;let blocked=0;
 for(const [store,fields] of [['work_records',{...work,driver_entry_id:'rev-work'}],['fuel_records',{...base,liters:10,fuel_source:'Şantiye',driver_entry_id:'rev-fuel'}],['expense_records',{...base,amount:20,category:'Lastik',driver_entry_id:'rev-exp'}],['maintenance_records',{...base,description:'TEST bakım',driver_entry_id:'rev-maint'}]]){try{await db.saveNew(store,fields,'TEST revoked')}catch(e){if(e.code==='UNVERIFIED_DRIVER')blocked++;else throw e;}}
 if(blocked!==4||before!==JSON.stringify(await db.dumpAll())||audit!==(await db.getAll('audit_log')).length)throw Error('Revoked verified cards wrote data');
 const b=(await make()).link;await verify(b,['inactive']);await db.saveExisting('personnel',await db.get('personnel',person.id),{active:false},'TEST inactive');
 let inactive=false;try{await db.saveNew('work_records',{...work,driver_entry_id:'inactive'},'TEST')}catch(e){inactive=e.code==='UNVERIFIED_DRIVER'}
 await db.saveExisting('personnel',await db.get('personnel',person.id),{active:true},'TEST active');
 await verify(b,['expired']);await db.updateDriverLinks(L=>L.map(x=>x.lid===b.lid?{...x,exp:'2020-01-01'}:x));
 let expired=false;try{await db.saveNew('work_records',{...work,driver_entry_id:'expired'},'TEST')}catch(e){expired=e.code==='UNVERIFIED_DRIVER'}
 if(!inactive||!expired)throw Error('Inactive/expired cached proof accepted');
 const active=(await make()).link;await verify(active,['good']);const record=await db.saveNew('work_records',{...work,driver_entry_id:'good'},'TEST active proof');
 let duplicate=false;try{await db.saveNew('work_records',{...work,driver_entry_id:'good'},'TEST')}catch(e){duplicate=e.code==='DUP_DRIVER'}
 if(!record.id||!duplicate)throw Error('Live proof/duplicate guard broken');
 return {revoked:blocked,inactive,expired,active:true,duplicate};}""")
 print('PASS verified cards rechecked at commit:',proof)
 # Race verification against revocation across actual browser pages.
 other=c.new_page();other.goto(U);other.wait_for_timeout(600)
 race=pg.evaluate("""async()=>{const db=await import('./js/db.js'),S=await import('./js/security.js'),C=await import('./js/security-core.js');const p=(await db.listActive('personnel'))[0];const {link}=await S.newDriverLink({pid:p.id,name:'Race TEST',days:30});const code='RACE';return {link,payload:{lid:link.lid,p:p.id,e:[{id:'race-proof'}],_code:code,_sig:await C.hmac(link.secret,code)},start:Date.now()+1000}}""")
 pg.evaluate("""({payload,start})=>{window.__verify=(async()=>{await new Promise(r=>setTimeout(r,Math.max(0,start-Date.now())));const db=await import('./js/db.js'),s=await import('./js/security.js');await s.checkPayloads([payload],await db.dumpAll());})();}""",race)
 other.evaluate("""({link,start})=>{window.__revoke=(async()=>{await new Promise(r=>setTimeout(r,Math.max(0,start-Date.now())));await(await import('./js/security.js')).revokeLink(link.lid,'TEST concurrent revoke');})();}""",race)
 pg.evaluate('async()=>await window.__verify');other.evaluate('async()=>await window.__revoke')
 assert pg.evaluate('(lid)=>import("./js/security.js").then(async s=>(await s.driverLinks()).find(x=>x.lid===lid).revoked_at)',race['link']['lid'])
 other.close();print('PASS verification/revocation race preserves revoked state across two pages')
 concurrent=pg.evaluate("""async()=>{const db=await import('./js/db.js'),S=await import('./js/security.js');const p=(await db.listActive('personnel'))[0];const created=await Promise.all([S.newDriverLink({pid:p.id,name:'Concurrent A'}),S.newDriverLink({pid:p.id,name:'Concurrent B'})]);let links=await S.driverLinks();if(!created.every(x=>links.some(y=>y.lid===x.link.lid)))return false;await Promise.all(created.map(x=>S.revokeLink(x.link.lid,'TEST pair revoke')));links=await S.driverLinks();return created.every(x=>links.find(y=>y.lid===x.link.lid)?.revoked_at);}""")
 assert concurrent
 print('PASS concurrent link creation and distinct revocations preserve both changes')

 hostile=pg.evaluate("""async()=>{
 const db=await import('./js/db.js'),B=await import('./js/backup.js'),D=await import('./js/driver-core.js');
 const before=JSON.stringify(await db.dumpAll());const obj=await B.fullBackup(db,{attachments:'none'});
 obj.part={set:'hostile-test',no:1,of:1,part_attachments:0,index:[['missing','work','never-imported',1]],totals:{attachments:1}};
 let manifest=false;try{await B.restoreBackup(db,obj)}catch(e){manifest=/dizinle/.test(e.message)}
 const bomb=await D.pack({v:1,e:[],note:'x'.repeat(D.DRIVER_JSON_LIMIT+1)});let compressed=false;
 try{await D.extractPayloads('SP1:'+bomb)}catch(e){compressed=e.code==='DRIVER_LIMIT'}
 return {manifest,compressed,unchanged:before===JSON.stringify(await db.dumpAll())};}""")
 assert hostile=={'manifest':True,'compressed':True,'unchanged':True},hostile
 print('PASS actual browser rejects concealed missing backup attachment and compressed driver bomb; no record writes')
 # Offline local data and escaping of a hostile source/customer label.
 c.set_offline(True)
 offline=pg.evaluate("""async()=>{const db=await import('./js/db.js');const v=(await db.listActive('vehicles'))[0];const name='<img src=x onerror="window.__xss=1">';const c=await db.saveNew('customers',{name},'TEST');const w=await db.saveNew('work_records',{date:'2026-05-11',customer_id:c.id,vehicle_id:v.id,work_type:'Kazı',unit:'Saat',quantity:1},'TEST');return w.id}""")
 pg.evaluate('(id)=>location.hash="#/isler/"+id',offline);pg.wait_for_timeout(700)
 assert pg.evaluate('window.__xss||0')==0
 assert pg.locator('#screen').inner_text().find('<img')>=0
 assert not errors,errors
 print('PASS offline save/read and escaped hostile customer label; no page errors')
 # A waiting update must not cover a real form's Save button on a narrow phone.
 update=b.new_context(viewport={'width':390,'height':844},service_workers='block')
 update.add_init_script("""(()=>{localStorage.setItem('sp_role','boss');const sw=new EventTarget();sw.controller={};sw.register=async()=>({waiting:{postMessage:()=>{}},addEventListener:()=>{},update:async()=>{}});Object.defineProperty(navigator,'serviceWorker',{value:sw});})();""")
 up=update.new_page();up.goto(U+'index.html#/isler/new');up.wait_for_selector('#update-bar');up.wait_for_selector('#screen [data-save]')
 up.locator('#screen [data-save]').click(trial=True)
 assert up.locator('#update-bar').evaluate('(e)=>getComputedStyle(e).position')=='relative'
 up.locator('#update-bar [data-x]').click();assert up.locator('#update-bar').count()==0
 print('PASS update-available notice leaves real mobile Save button clickable and can be dismissed')
 update.close()
 b.close()
