"""Vehicle taxonomy red-team, explicit repair, real browser/IDB, synthetic data only."""
import argparse,json,uuid
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright
ap=argparse.ArgumentParser();ap.add_argument('url',nargs='?',default='http://localhost:8841/');ap.add_argument('--baseline-proof',action='store_true');ap.add_argument('--artifacts',default='/tmp/solo-vehicle97');a=ap.parse_args()
BASE=a.url.rstrip('/')+'/';assert urlparse(BASE).hostname in ('localhost','127.0.0.1');OUT=Path(a.artifacts);OUT.mkdir(parents=True,exist_ok=True)
with sync_playwright() as w:
 b=w.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);c=b.new_context(viewport={'width':390,'height':850});c.add_init_script("localStorage.setItem('sp_role','boss')");p=c.new_page();errors=[];p.on('pageerror',lambda e:errors.append(str(e)))
 c.route('**/*',lambda r:r.continue_() if urlparse(r.request.url).hostname in ('localhost','127.0.0.1') else r.abort());app=BASE+'index.html?db=taxonomy97_'+uuid.uuid4().hex[:12]
 def view(h):p.goto(app+h);p.wait_for_selector('#screen[data-view-ready="1"]')
 def snap():return p.evaluate("async()=>await(await import('./js/db.js')).dumpAll()")
 view('#/daha')
 if a.baseline_proof:
  evidence=p.evaluate("""async()=>{const core=await import('./js/core.js'),docs=await import('./js/assistant-docs.js'),business=await import('./js/business.js');const v={name:'Kamyonet',type:'Araç/Makine'},rule={id:'R',vehicle_type:'Kamyonet',unit:'Sefer',price:7000};return {suffix:core.transportVehicleType('Kamyonet (N1)'),prefix:docs.vehicleInfo({vehicle_kind:'Kamyon'},'Cinsi: KAMYONET').type,legacyType:core.resolvePrice([rule],core.priceVehicleContext({unit:'Sefer'},v)),machineDocuments:business.vehicleDocumentStatus({id:'V',name:'34ZZZ097',plate:'34ZZZ097',type:'Forklift'},[]).required};}""")
  assert evidence=={'suffix':None,'prefix':'Kamyon','legacyType':None,'machineDocuments':['Ruhsat','Muayene Belgesi','Zorunlu Trafik Sigortası']},evidence
  (OUT/'baseline.json').write_text(json.dumps(evidence,indent=2));print('BASELINE PROOF v3.9.96: registration suffix unrecognized, Kamyon matched inside Kamyonet, legacy TYPE price fails, plated Forklift receives wrong road document requirements',flush=True);c.close();b.close();raise SystemExit(0)
 ids=p.evaluate("""async()=>{const d=await import('./js/db.js');const v={};for(const[k,name,type]of [['generic','Kamyonet','Araç/Makine'],['alias','TEST registration97','Kamyonet (N1)'],['conflict','Kamyonet test97','Kamyon'],['unknown','34 ZZZ 097','Diğer'],['machine','34 ZZZ 098','Forklift'],['inactive','TEST inactive97','Kamyonet'],['twin','TEST twin97','Diğer']]){const row=await d.saveNew('vehicles',{name,type,active:k!=='inactive'},'TEST');await d.put('vehicles',{...row,type,name:k==='twin'?'Kamyonet':name,plate:k==='generic'?'34 ZZZ 096':k==='twin'?'34 ZZZ 099':null});v[k]=row.id;}
 const customer=await d.saveNew('customers',{name:'TEST Ahmet97'},'TEST'),site=await d.saveNew('sites',{name:'Tarabya',customer_id:customer.id},'TEST');const work=await d.saveNew('work_records',{date:'2026-10-30',customer_id:customer.id,site_id:site.id,vehicle_id:v.generic,vehicle_type:'Kamyon',work_type:'Moloz Nakliye',unit:'Sefer',quantity:2,description:'TEST original97',price_snapshot:{unit_price:3000,amount:6000,kdv_rate:20,kdv_included:false}},'TEST');return {v,customer:customer.id,site:site.id,work:work.id};}""")
 before=snap();view('#/filo');p.locator('a[href="#/arac-turleri"]').click();p.wait_for_selector('[data-type-row]');assert snap()==before
 def row(k):return p.locator('[data-type-row="'+ids['v'][k]+'"]')
 p.fill('[data-type-search]','34 ZZZ 097');assert p.locator('[data-type-row]:visible').count()==1 and row('unknown').is_visible();p.fill('[data-type-search]','');assert snap()==before
 assert 'Aynı adlı veya plakalı başka kart var' in row('generic').inner_text();assert '34 ZZZ 096' in row('generic').inner_text();assert '34 ZZZ 099' in row('twin').inner_text()
 assert row('inactive').count()==1 and '(Pasif)' in row('inactive').inner_text() and row('generic').locator('[name=vehicle_kind]').input_value()=='Kamyonet'
 assert 'Araç/Makine' in row('generic').inner_text() and 'Öneri' in row('generic').inner_text();assert row('alias').locator('[name=vehicle_kind]').input_value()=='Kamyonet'
 assert 'çelişiyor' in row('conflict').inner_text() and row('unknown').locator('[name=vehicle_kind]').input_value()==''
 for width in [320,390,768]:
  p.set_viewport_size({'width':width,'height':850});assert p.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
 p.set_viewport_size({'width':390,'height':850});p.screenshot(path=str(OUT/'audit-before.png'),full_page=True)
 row('generic').locator('[data-type-confirm]').click();p.wait_for_function("()=>document.querySelector('[data-type-result]')?.textContent.includes('doğrulandı')");p.wait_for_function("id=>document.querySelector('[data-type-row=\"'+id+'\"]')?.textContent.includes('türü doğrulandı')",arg=ids['v']['generic'])
 after=snap();by=lambda data,store,id:next(r for r in data[store] if r['id']==id)
 assert by(after,'vehicles',ids['v']['twin'])==by(before,'vehicles',ids['v']['twin'])
 v=by(after,'vehicles',ids['v']['generic']);assert v['type']=='Kamyonet' and v['type_review']['type']=='Kamyonet'
 for store in before:
  if store not in ('vehicles','audit_log'):assert before[store]==after[store],store
 assert by(after,'work_records',ids['work'])['price_snapshot']['unit_price']==3000
 # Undo restores the exact old classification and its absence of a confirmation.
 p.evaluate("async()=>{const d=await import('./js/db.js');await(await import('./js/undo.js')).applyUndo(d)}");p.wait_for_function("id=>document.querySelector('[data-type-row=\"'+id+'\"]')?.textContent.includes('Öneri')",arg=ids['v']['generic']);undone=snap();assert by(undone,'vehicles',ids['v']['generic'])['type']=='Araç/Makine' and not by(undone,'vehicles',ids['v']['generic']).get('type_review')
 # Cancel a conflicting choice: no write, no audit, no price changes.
 stable=snap();row('conflict').locator('[name=vehicle_kind]').select_option('Kamyon');row('conflict').locator('[data-type-confirm]').click();p.wait_for_selector('.sheet');p.click('.sheet [data-x="0"]');assert snap()==stable
 # Navigation while the dialog is open must not allow its late callback to write.
 row('conflict').locator('[data-type-confirm]').click();p.wait_for_selector('.sheet');late=p.query_selector('.sheet [data-x="1"]');old_screen=p.query_selector('#screen');p.evaluate("location.hash='#/daha'");p.wait_for_function('el=>!el.isConnected',arg=old_screen);late.evaluate('el=>el.click()');assert snap()==stable
 view('#/arac-turleri');row('conflict').locator('[name=vehicle_kind]').select_option('Kamyon')
 row('conflict').locator('[data-type-confirm]').click();p.wait_for_selector('.sheet');p.click('.sheet [data-x="1"]');p.wait_for_function("id=>document.querySelector('[data-type-row=\"'+id+'\"]')?.textContent.includes('türü doğrulandı')",arg=ids['v']['conflict']);confirmed=by(snap(),'vehicles',ids['v']['conflict']);assert confirmed['type_review']['type']=='Kamyon'
 assert p.evaluate("async v=>(await import('./js/vehicle-type-core.js')).vehicleTypeInfo(v).group",confirmed)=='TRUCK'
 # Renaming/changing a card invalidates its review; stale and failed writes are atomic.
 p.evaluate("""async id=>{const d=await import('./js/db.js'),T=await import('./js/vehicle-type-db.js');const old=await d.get('vehicles',id),stamp=T.vehicleTypeStamp(old);await d.saveExisting('vehicles',old,{name:old.name+' changed'},'TEST');const current=await d.get('vehicles',id);if(current.type_review)throw Error('review survived identity change');let before=JSON.stringify(await d.dumpAll()),rejected=false;try{await T.confirmVehicleType(id,'Kamyon',stamp)}catch{rejected=true}if(!rejected||JSON.stringify(await d.dumpAll())!==before)throw Error('stale review wrote');const put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(value,...args){if(this.name==='vehicles')throw Error('TEST quota97');return put.call(this,value,...args)};let failure='';try{await T.confirmVehicleType(id,'Kamyon',T.vehicleTypeStamp(current))}catch(e){failure=e.message}finally{IDBObjectStore.prototype.put=put}if(failure!=='TEST quota97'||JSON.stringify(await d.dumpAll())!==before)throw Error('failed transaction wrote');}""",arg=ids['v']['conflict'])
 # The reported name/kind mismatch is actually repaired by choosing Kamyonet.
 view('#/arac-turleri?vehicle_id='+ids['v']['conflict']);row('conflict').locator('[name=vehicle_kind]').select_option('Kamyonet');row('conflict').locator('[data-type-confirm]').click();p.wait_for_function("id=>document.querySelector('[data-type-row=\"'+id+'\"]')?.textContent.includes('türü doğrulandı')",arg=ids['v']['conflict']);repaired=by(snap(),'vehicles',ids['v']['conflict']);assert repaired['type']=='Kamyonet' and p.evaluate("async v=>(await import('./js/vehicle-type-core.js')).vehicleTypeInfo(v).group",repaired)=='VAN';assert by(snap(),'work_records',ids['work'])['price_snapshot']['unit_price']==3000
 # All consumers use the same class, including a legacy TYPE price and stale work snapshot.
 result=p.evaluate("""async ids=>{const d=await import('./js/db.js'),core=await import('./js/core.js'),business=await import('./js/business.js'),T=await import('./js/vehicle-type-core.js'),D=await import('./js/assistant-docs.js');const v=await d.get('vehicles',ids.v.generic),w=await d.get('work_records',ids.work),rule={id:'TEST',vehicle_type:'Kamyonet',customer_id:ids.customer,site_id:ids.site,work_type:'Moloz Nakliye',unit:'Sefer',price:7000,kdv_rate:20,kdv_included:false};return {price:core.resolvePrice([rule],core.priceVehicleContext(w,v))?.price,suffix:core.transportVehicleType('Kamyonet (N1)'),badPrefix:D.vehicleInfo({vehicle_kind:'Kamyon'},'Cinsi KAMYONET').type,documents:business.vehicleDocumentStatus(await d.get('vehicles',ids.v.machine),[]).required};}""",ids)
 assert result=={'price':7000,'suffix':'VAN','badPrefix':'','documents':['Makine Tescil Belgesi','Periyodik Kontrol']},result
 # Real master-card UI uses the shared taxonomy; edit normalization removes stale review.
 view('#/filo/'+ids['v']['alias']+'/edit');p.wait_for_selector('[name=type]');assert 'Kazıcı Yükleyici' in p.locator('[name=type]').inner_text();p.select_option('[name=type]','Kamyonet');p.click('[data-save]');p.wait_for_selector('[data-card-content]');assert by(snap(),'vehicles',ids['v']['alias'])['type']=='Kamyonet'
 view('#/arac-turleri?vehicle_id='+ids['v']['generic']);assert p.locator('[data-type-row]').count()==1;assert 'Filonun tümünü göster' in p.locator('#screen').inner_text();p.screenshot(path=str(OUT/'audit-single.png'),full_page=True)
 assert not errors,errors
 (OUT/'results.json').write_text(json.dumps({'model_requests':0,'conflicting_card_repaired':'Kamyonet','unchanged_original_price':3000,'type_price':result['price'],'prefix_rejected':True,'mobile_widths':[320,390,768],'errors':errors},indent=2));print('PASS vehicle type audit97: read-only fleet audit; explicit/cancelled/conflicting review; exact Undo; identity invalidation; stale/quota atomic rejection; legacy type price, registration aliases, document evidence/family; real card edit; mobile layouts; actual work price unchanged',flush=True);c.close();b.close()
