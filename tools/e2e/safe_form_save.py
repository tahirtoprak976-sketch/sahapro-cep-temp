"""Real Chromium/IndexedDB; faults and double clicks use only synthetic data.
No external AI, messages or real documents. Tests money/stock and photo recovery.
"""
from playwright.sync_api import sync_playwright
from PIL import Image
from io import BytesIO
U='http://localhost:8841/'
buf=BytesIO();Image.new('RGB',(12,12),'orange').save(buf,format='PNG');photo={'name':'TEST-photo.png','mimeType':'image/png','buffer':buf.getvalue()}
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 c=b.new_context(viewport={'width':360,'height':800},service_workers='allow');c.add_init_script("try{localStorage.setItem('sp_role','boss')}catch(e){}")
 pg=c.new_page();errors=[];calls=[];pg.on('pageerror',lambda e:errors.append(str(e)))
 pg.route('https://generativelanguage.googleapis.com/**',lambda r:(calls.append(r.request.url),r.abort()))
 pg.goto(U+'index.html#/musteriler');pg.wait_for_selector('[data-customer-directory]');pg.evaluate('async()=>await navigator.serviceWorker.ready')
 if not pg.evaluate('!!navigator.serviceWorker.controller'):
  pg.reload();pg.wait_for_selector('[data-customer-directory]')
 ids=pg.evaluate("""async()=>{const db=await import('./js/db.js'),edb=await import('./js/enterprise-db.js'),C=await import('./js/core.js');const v=await db.saveNew('vehicles',{name:'TEST save vehicle'},'TEST');const s=await edb.saveSupplier({name:'TEST save supplier'});await db.saveNew('fuel_tank_movements',{date:C.todayStr(),move_type:'GİRİŞ',liters:1000,unit_price:20,total:20000},'TEST');return {v:v.id,s:s.id}}""")
 def visit(route):pg.goto(U+'index.html#/'+route);pg.wait_for_selector('[data-form]')
 def double():pg.evaluate("()=>{const b=document.querySelector('[data-save]');b.dispatchEvent(new MouseEvent('click',{bubbles:true}));b.dispatchEvent(new MouseEvent('click',{bubbles:true}))}")
 def all_rows(store):return pg.evaluate("s=>import('./js/db.js').then(db=>db.getAll(s))",store)
 def stats():
  return pg.evaluate("async()=>{const db=await import('./js/db.js');return {fuel:(await db.listActive('fuel_records')).length,out:(await db.listActive('fuel_tank_movements')).filter(x=>x.move_type==='ÇIKIŞ').length,expense:(await db.listActive('expense_records')).length,maint:(await db.listActive('maintenance_records')).length,bill:(await db.listActive('payables')).length,attachments:(await db.getAll('attachments')).length,audit:(await db.getAll('audit_log')).length}}")
 def fault(store):
  pg.evaluate("""store=>{const proto=IDBDatabase.prototype;window.__tx=proto.transaction;window.__faults=1;proto.transaction=function(stores,mode,...rest){const a=typeof stores==='string'?[stores]:Array.from(stores);if(window.__faults&&mode==='readwrite'&&a.includes(store)){window.__faults--;throw Error('TEST storage write failure')}return window.__tx.call(this,stores,mode,...rest)}}""",store)
 def restore():pg.evaluate("()=>{IDBDatabase.prototype.transaction=window.__tx}")
 def partial():pg.locator('[data-save-feedback]').get_by_text('Kayıt kaydedildi; son adım tamamlanamadı.',exact=False).wait_for()
 def delay():pg.evaluate("""()=>{const proto=Object.getPrototypeOf(crypto.subtle);window.__digest=proto.digest;proto.digest=function(...args){return new Promise((resolve,reject)=>setTimeout(()=>window.__digest.apply(this,args).then(resolve,reject),180))}}""")
 def restore_digest():pg.evaluate("()=>{Object.getPrototypeOf(crypto.subtle).digest=window.__digest}")
 visit('yakit/new');pg.select_option('[name=vehicle_id]',ids['v']);pg.fill('[name=liters]','10');pg.check('[name=full_tank]');delay();double()
 assert pg.locator('[data-save]').is_disabled() and pg.locator('[name=liters]').is_disabled()
 assert pg.evaluate("async()=> (await import('./js/update-safety.js')).updateRisk(document.querySelector('#screen')).busy")
 pg.wait_for_url('**#/yakit');restore_digest();assert stats()['fuel']==1 and stats()['out']==1
 assert all_rows('fuel_records')[0]['full_tank'] is True and all_rows('fuel_records')[0]['total']==200
 print('PASS repeated click events produce one fuel and one tank movement; values/checkbox snapshot and update-in-progress guard preserved',flush=True)
 visit('yakit/new');pg.select_option('[name=vehicle_id]',ids['v']);pg.fill('[name=liters]','15');before=stats();fault('fuel_records');pg.click('[data-save]')
 pg.locator('[data-save-feedback]').get_by_text('Kayıt tamamlanamadı;',exact=False).wait_for();assert pg.input_value('[name=liters]')=='15' and pg.locator('[name=liters]').is_enabled();assert stats()==before
 restore();pg.fill('[name=liters]','12');double();pg.wait_for_url('**#/yakit');assert stats()['fuel']==2 and stats()['out']==2
 print('PASS precommit write failure preserves editable inputs; corrected retry makes one fuel/stock transaction',flush=True)
 visit('gider/new');pg.fill('[name=amount]','123.45');pg.fill('[name=description]','TEST expense photo');pg.locator('[name=photo]').set_input_files(photo);before=stats();fault('attachments');double();partial()
 after=stats();assert after['expense']==before['expense']+1 and after['attachments']==before['attachments']
 assert pg.locator('[name=amount]').is_disabled() and pg.locator('[name=photo]').is_enabled() and pg.locator('[data-save]').is_enabled()
 expense=next(x for x in all_rows('expense_records') if x['description']=='TEST expense photo')
 assert pg.get_attribute('[data-saved-record]','href')=='#/gider/'+expense['id']
 restore();c.set_offline(True);double();pg.wait_for_url('**#/gider');complete=stats();c.set_offline(False)
 assert complete['expense']==after['expense'] and complete['audit']==after['audit'] and complete['attachments']==after['attachments']+1
 assert next(x for x in all_rows('expense_records') if x['id']==expense['id'])['amount']==123.45
 print('PASS expense survives photo failure once; values lock, existing record link and offline photo-only retry preserve money/audit',flush=True)
 visit('bakim/new');pg.select_option('[name=vehicle_id]',ids['v']);pg.fill('[name=cost]','50.5');pg.fill('[name=description]','TEST maintenance photo');pg.locator('[name=photo]').set_input_files(photo);before=stats();fault('attachments');double();partial();after=stats()
 assert after['maint']==before['maint']+1
 maintenance=next(x for x in all_rows('maintenance_records') if x['description']=='TEST maintenance photo')
 restore();double();pg.wait_for_url('**#/bakim/'+maintenance['id']);complete=stats();assert complete['maint']==after['maint'] and complete['audit']==after['audit'] and complete['attachments']==after['attachments']+1
 visit('bakim/'+maintenance['id']+'/edit');pg.fill('[name=cost]','75.25');pg.locator('[name=photo]').set_input_files(photo);before=stats();fault('attachments');double();partial();after=stats();assert after['maint']==before['maint'] and after['audit']==before['audit']+1
 restore();double();pg.wait_for_url('**#/bakim/'+maintenance['id']);assert stats()['audit']==after['audit'] and stats()['maint']==after['maint']
 assert next(x for x in all_rows('maintenance_records') if x['id']==maintenance['id'])['cost']==75.25
 print('PASS new and edited maintenance retry only attachments; one record/update, same photo deduplicated, cost and audit preserved',flush=True)
 visit('gider/new');pg.fill('[name=amount]','301.23');pg.fill('[name=description]','TEST credit photo');pg.select_option('[name=supplier_id]',ids['s']);pg.locator('[name=photo]').set_input_files(photo);before=stats();fault('attachments');double();partial();after=stats()
 assert after['bill']==before['bill']+1 and after['expense']==before['expense']
 assert '/alislar/' in pg.get_attribute('[data-saved-record]','href')
 restore();double();pg.wait_for_url('**#/esnaf/'+ids['s']);complete=stats();assert complete['bill']==after['bill'] and complete['expense']==after['expense'] and complete['audit']==after['audit'] and complete['attachments']==after['attachments']+1
 print('PASS supplier-credit photo retry makes no second payable, ordinary expense or repeated duplicate dialog',flush=True)
 visit('gider/new');pg.fill('[name=amount]','301.23');pg.fill('[name=description]','TEST duplicate cancelled');pg.select_option('[name=supplier_id]',ids['s']);before=stats();double();pg.wait_for_selector('.sheet')
 assert pg.locator('.sheet').count()==1 and pg.locator('[data-save]').is_disabled()
 pg.click('.sheet [data-x="0"]');pg.wait_for_function("() => !document.querySelector('[data-save]').disabled")
 assert stats()==before and pg.locator('[name=amount]').is_enabled() and pg.input_value('[name=amount]')=='301.23'
 pg.fill('[name=amount]','401.23');pg.click('[data-save]');pg.wait_for_url('**#/esnaf/'+ids['s']);assert stats()['bill']==before['bill']+1 and stats()['expense']==before['expense']
 print('PASS cancelling one duplicate-confirmation dialog writes nothing and unlocks the form; corrected credit entry can save',flush=True)
 visit('gider/new');pg.fill('[name=amount]','222.22');pg.fill('[name=description]','TEST stale receipt');pg.locator('[name=photo]').set_input_files(photo);fault('attachments');pg.click('[data-save]');partial();restore()
 target=next(x for x in all_rows('expense_records') if x['description']=='TEST stale receipt')
 pg.evaluate("async id=>{const db=await import('./js/db.js');await db.saveExisting('expense_records',await db.get('expense_records',id),{amount:333.33},'TEST other editor')}",target['id'])
 before=stats();pg.click('[data-save]');pg.locator('[data-save-feedback]').get_by_text('Kaydedilen kayıt başka yerde değişti.',exact=False).wait_for()
 assert stats()==before and next(x for x in all_rows('expense_records') if x['id']==target['id'])['amount']==333.33
 print('PASS a changed record blocks receipt retry without overwriting amount, adding a receipt or writing another row',flush=True)
 # A real transaction committed, but the application did not receive its result.
 outcome=pg.evaluate("""async ids=>{
  const db=await import('./js/db.js'),C=await import('./js/core.js'),{createSaveAttempt}=await import('./js/safe-form-save.js');let drop=true,unread=true,writes=0;
  const wrapper={...db,opLookup:async(...args)=>{if(unread){unread=false;throw Error('TEST read failure')}return db.opLookup(...args)},saveNew:async(...args)=>{writes++;const r=await db.saveNew(...args);if(drop){drop=false;throw Error('TEST lost result')}return r}};
  const save=createSaveAttempt(wrapper),fields={date:C.todayStr(),vehicle_id:ids.v,liters:11,fuel_source:'Depo Tankı',description:'TEST lost response'};
  const before=(await db.listActive('fuel_tank_movements')).filter(x=>x.move_type==='ÇIKIŞ').length;
  try{await save.saveNew('fuel_records',fields,'TEST')}catch{}
  const unknown=save.uncertain;
  const r=await save.saveNew('fuel_records',fields,'TEST');
  return {fuel:(await db.listActive('fuel_records')).filter(x=>x.description===fields.description).length,delta:(await db.listActive('fuel_tank_movements')).filter(x=>x.move_type==='ÇIKIŞ').length-before,total:r.total,unknown,writes};
 }""",ids)
 assert outcome=={'fuel':1,'delta':1,'total':220,'unknown':True,'writes':1},outcome
 print('PASS lost write result recovers the real operation ID: one fuel, one stock movement and unchanged cost',flush=True)
 visit('yakit/new');pg.select_option('[name=vehicle_id]',ids['v']);pg.fill('[name=liters]','7');pg.select_option('[name=fuel_source]','Akaryakıt İstasyonu');pg.fill('[name=description]','TEST away');delay()
 pg.evaluate("()=>{document.querySelector('[data-save]').click();location.hash='#/musteriler'}");pg.wait_for_selector('[data-customer-directory]');pg.wait_for_timeout(400);restore_digest()
 assert pg.url.endswith('#/musteriler') and len([x for x in all_rows('fuel_records') if x['description']=='TEST away'])==1
 assert not errors,errors
 assert not calls,calls
 print('PASS leaving during a pending write does not hijack the new screen; no browser errors or AI requests',flush=True)
 b.close()
