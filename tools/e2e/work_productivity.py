"""Repeat-work productivity: real local IDB, synthetic jobs; no AI or real messages."""
from playwright.sync_api import sync_playwright
U='http://localhost:8841/'
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);c=b.new_context(viewport={'width':360,'height':800});c.add_init_script("localStorage.setItem('sp_role','boss')")
 pg=c.new_page();errors=[];pg.on('pageerror',lambda e:errors.append(str(e)));pg.goto(U);pg.evaluate('async()=>await navigator.serviceWorker.ready');pg.wait_for_timeout(900)
 ids=pg.evaluate('''async()=>{const d=await import('./js/db.js'),C=await import('./js/core.js');const date=C.todayStr(),customer=await d.saveNew('customers',{name:'Productivity TEST'},'TEST'),site=await d.saveNew('sites',{name:'TEST Şantiye',customer_id:customer.id},'TEST'),vehicle=(await d.listActive('vehicles'))[0],person=(await d.listActive('personnel'))[0];await d.saveNew('price_book',{customer_id:customer.id,unit:'Sefer',price:250,kdv_rate:20,kdv_included:false,active:true},'TEST');const D=await import('./js/driver-core.js'),S=await import('./js/security.js'),link=await S.newDriverLink({pid:person.id,name:person.name}),cfg={...D.driverConfig(await d.dumpAll(),{personnel_id:person.id,vehicle_id:vehicle.id}),...link.forDriver};await S.checkPayloads(await D.extractPayloads(await D.driverMessage([{id:'old-driver',date,vid:vehicle.id,cid:customer.id,wt:'Hafriyat Nakliye',q:5,u:'Sefer'}],cfg)),await d.dumpAll());const source=await d.saveNew('work_records',{id:'aaa-latest-created',created_at:date+'T01:00:00Z',date:C.addDays(date,-30),customer_id:customer.id,site_id:site.id,vehicle_id:vehicle.id,personnel_id:person.id,work_type:'Hafriyat Nakliye',quantity:5,unit:'Sefer',material:'moloz',slip_no:'OLD-SLIP',digital_slip_no:'OLD-SIGNED',driver_entry_id:'old-driver',internal_note:'old internal',description:'old description',price_snapshot:{unit_price:9999,amount:49995,kdv_rate:20,price_source:'Manuel',locked:true}},'TEST');const oldFile=new File(['<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>'],'OLD.svg',{type:'image/svg+xml'});await d.put('attachments',{id:'TEST-old-svg',record_type:'work',record_id:source.id,name:oldFile.name,type:oldFile.type,size:oldFile.size,blob:oldFile,kind:'photo',created_at:date+'T00:00:00Z'});await d.saveNew('work_records',{id:'zzz-older-created',created_at:C.addDays(date,-2)+'T01:00:00Z',date,customer_id:customer.id,vehicle_id:vehicle.id,work_type:'Moloz Nakliye',quantity:1,unit:'Sefer'},'TEST');return {source:source.id,date,customer:customer.id,site:site.id,vehicle:vehicle.id}}''')
 source_before=pg.evaluate("async id=>await(await import('./js/db.js')).get('work_records',id)",ids['source'])
 pg.goto(U+'#/isler/'+ids['source']);pg.wait_for_selector('[data-repeat-work]');pg.click('[data-repeat-work]');pg.wait_for_selector('[data-repeat-info]')
 assert pg.input_value('[name=date]')==ids['date'];assert pg.input_value('[name=quantity]')==''
 for field in ['manual_price','slip_no','description','internal_note','time_start','tonnage']:
  assert pg.input_value('[name='+field+']')=='',field
 assert pg.input_value('[name=customer_id]')==ids['customer'];assert pg.input_value('[name=site_id]')==ids['site'];assert pg.input_value('[name=material]')=='moloz'
 assert pg.evaluate('document.documentElement.scrollWidth<=innerWidth')
 pg.fill('[name=quantity]','7');pg.fill('[name=manual_price]','375');pg.fill('[name=manual_kdv]','10');pg.wait_for_timeout(950);pg.reload();pg.wait_for_selector('[data-repeat-info]')
 assert pg.input_value('[name=quantity]')=='7' and pg.input_value('[name=manual_price]')=='375' and pg.input_value('[name=manual_kdv]')=='10'
 print('PASS repeat copies selections only, today/empty quantity, no source price/slip/notes; own draft and manual price survive reload',flush=True)
 pg.fill('[name=quantity]','3');pg.fill('[name=manual_price]','');pg.check('[data-save-next]');pg.click('[data-save]');pg.wait_for_function("() => document.querySelector('[data-repeat-info]') && document.querySelector('[name=quantity]').value===''")
 rows=pg.evaluate("async()=>await(await import('./js/db.js')).listActive('work_records')");assert len(rows)==3
 fresh=next(x for x in rows if x['id'] not in ['aaa-latest-created','zzz-older-created']);assert fresh['price_snapshot']['unit_price']==250;assert not fresh.get('driver_entry_id') and not fresh.get('digital_slip_no') and not fresh.get('slip_no')
 assert pg.evaluate("async id=>await(await import('./js/db.js')).get('work_records',id)",ids['source'])==source_before
 assert pg.evaluate("async id=>(await(await import('./js/db.js')).attachmentsFor('work',id)).length",fresh['id'])==0
 assert pg.evaluate("async id=>(await(await import('./js/db.js')).attachmentsFor('work',id)).length",ids['source'])==1
 assert pg.input_value('[name=quantity]')=='';pg.click('[data-save]');pg.wait_for_timeout(250);assert len(pg.evaluate("async()=>await(await import('./js/db.js')).listActive('work_records')"))==3
 print('PASS save-and-next creates one new ID, uses current price, leaves original intact, requires new quantity',flush=True)
 # The transport batch path must also return a clean one-row form.
 pg.fill('[name=quantity]','2');pg.fill('[name=dump_area]','TEST A');pg.click('[data-add-transport]');pg.fill('[name=x_quantity]','4');pg.fill('[name=x_dump_area]','TEST B');pg.check('[data-save-next]');pg.click('[data-save]');pg.wait_for_function("() => document.querySelector('[data-repeat-info]') && document.querySelector('[name=quantity]').value===''")
 assert len(pg.evaluate("async()=>await(await import('./js/db.js')).listActive('work_records')"))==5;assert pg.locator('[data-transport-row]').count()==0;assert pg.input_value('[name=quantity]')==''
 print('PASS batch save-and-next stores both transport rows and opens a clean single-row form',flush=True)
 # A different draft must not be silently replaced by an explicit repeat.
 pg.evaluate("async()=>await(await import('./js/db.js')).draftSave('work',{date:'2026-01-02',quantity:9,description:'VALUABLE DRAFT'})")
 pg.goto(U+'#/isler/new?repeat='+ids['source']);pg.wait_for_selector('.sheet');pg.click('.sheet [data-x="0"]');pg.wait_for_selector('[name=quantity]');assert pg.input_value('[name=quantity]')=='9';assert pg.input_value('[name=description]')=='VALUABLE DRAFT'
 pg.goto(U+'#/isler/new?repeat='+ids['source']);pg.wait_for_selector('.sheet');pg.click('.sheet [data-x="1"]');pg.wait_for_selector('[data-repeat-info]');assert pg.input_value('[name=quantity]')==''
 print('PASS existing draft replacement requires explicit choice; cancel resumes the preserved draft',flush=True)
 pg.fill('[name=quantity]','8');pg.evaluate("()=>{const b=document.querySelector('[data-copylast]');b.click();b.click()}");pg.wait_for_selector('.sheet');assert pg.locator('.sheet').count()==1;pg.click('.sheet [data-x="0"]');assert pg.input_value('[name=quantity]')=='8'
 print('PASS replacing an edited form asks once on double tap; cancel preserves the typed quantity',flush=True)
 pg.evaluate("async()=>{const d=await import('./js/db.js');await d.draftClear('work');const rows=await d.listActive('work_records');for(const r of rows)if(!['aaa-latest-created','zzz-older-created'].includes(r.id))await d.softDelete('work_records',r.id)}")
 pg.goto(U+'#/isler/new?copylast=1');pg.wait_for_selector('[data-repeat-info]');assert pg.input_value('[name=work_type]')=='Hafriyat Nakliye','latest means created time, not lexical record ID'
 c.set_offline(True);pg.reload();pg.wait_for_selector('[data-repeat-info]');assert pg.input_value('[name=customer_id]')==ids['customer'];c.set_offline(False)
 pg.goto(U+'#/isler/new?repeat=missing');pg.wait_for_function("() => document.querySelector('#screen').textContent.includes('Kaynak iş bulunamadı')");assert pg.locator('[data-save]').count()==0
 assert not errors,errors
 print('PASS latest-created ordering, offline repeat, missing source guard and no uncaught errors',flush=True)
 b.close()
