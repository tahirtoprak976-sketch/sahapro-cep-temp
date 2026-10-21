"""Real mobile Chromium, IndexedDB and service worker; synthetic data; no model/network needed for creation."""
import json,sys
from playwright.sync_api import sync_playwright
U=sys.argv[1] if len(sys.argv)>1 else 'http://localhost:8841/'
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 c=b.new_context(viewport={'width':360,'height':850});c.add_init_script("localStorage.setItem('sp_role','boss')")
 pg=c.new_page();errors=[];requests=[];pg.on('pageerror',lambda e:errors.append(str(e)))
 c.route('https://generativelanguage.googleapis.com/**',lambda r:(requests.append(r.request.url),r.abort()))
 pg.goto(U+'index.html#/musteriler');pg.wait_for_selector('[data-customer-directory]');pg.evaluate('async()=>await navigator.serviceWorker.ready')
 if not pg.evaluate('!!navigator.serviceWorker.controller'):pg.reload();pg.wait_for_selector('[data-customer-directory]')
 def state():return pg.evaluate("async()=>await (await import('./js/db.js')).dumpAll()")
 def chat():return pg.evaluate("async()=>await (await import('./js/db.js')).metaGet('assistant_conversation_v1')")
 def send(text):
  pg.fill('[data-msg]',text);pg.click('[data-ask]');pg.wait_for_function("()=>!document.querySelector('[data-ask]').disabled")
 def create():
  pg.click('[data-create-customer]');pg.wait_for_selector('[data-out] .notice.ok');pg.wait_for_function("()=>!document.querySelector('[data-ask]').disabled")
 def start():
  pg.goto(U+'index.html#/akilli-asistan');pg.wait_for_function("()=>document.querySelector('[data-new-chat]')&&!document.querySelector('[data-new-chat]').disabled")
 before=state();start();c.set_offline(True)
 send('Yeni müşteri oluştur');assert chat()['turns'][-1]['intent']=='customer.create' and chat()['turns'][-1]['status']=='clarify';assert state()==before
 pg.reload();pg.wait_for_selector('[data-msg]');send('gürçelik sürücü kursu')
 assert pg.input_value('[data-customer-name]')=='gürçelik sürücü kursu' and state()==before
 send('onayla');assert state()==before and pg.locator('[data-create-customer]').count()==1
 pg.fill('[data-customer-phone]','0532 111 22 33');create()
 saved=state();cust=[x for x in saved['customers'] if x['name']=='gürçelik sürücü kursu'];assert len(cust)==1 and cust[0]['phone']=='0532 111 22 33'
 assert chat()['turns'][-1]['status']=='saved' and 'gürçelik sürücü kursu' in pg.locator('[data-out]').inner_text()
 assert pg.get_attribute('[data-out] [data-go]','data-go')=='#/musteriler/'+cust[0]['id']
 for s in before:
  if s not in ['customers','audit_log']:assert saved[s]==before[s],s
 print('PASS offline/no-key new customer question survives reload; exact user name and phone; preview/text confirmation write nothing; explicit button writes only customer + audit and real receipt',flush=True)
 send('Kemer country no 53');assert len(state()['customers'])==len(saved['customers'])
 send('Bunu yeni oluştur');assert pg.input_value('[data-customer-name]')=='Kemer country no 53';create()
 n53=state();assert sum(x['name']=='Kemer country no 53' for x in n53['customers'])==1
 send('Kemer country no 53 müşteri olarak oluştur');assert pg.locator('[data-create-customer]').is_disabled() and 'zaten kayıtlı' in pg.locator('[data-customer-matches]').inner_text() and state()==n53
 send('Kemer country no 54 adında müşteri oluştur');assert pg.input_value('[data-customer-name]')=='Kemer country no 54' and pg.locator('[data-create-customer]').is_disabled()
 pg.check('[data-customer-separate]');pg.fill('[data-customer-name]','Kemer country no 55');assert not pg.locator('[data-customer-separate]').is_checked() and pg.locator('[data-create-customer]').is_disabled()
 pg.fill('[data-customer-name]','Kemer country no 54');pg.check('[data-customer-separate]');create()
 assert sum(x['name']=='Kemer country no 54' for x in state()['customers'])==1
 print('PASS name then “bunu yeni oluştur” retains No 53; exact replay opens existing; similar name never substitutes and requires separate-card choice, reset on edit',flush=True)
 send('TEST Geçici A adında müşteri oluştur');cancel_before=state();send('Vazgeç');assert not pg.locator('[data-customer-create]').count() and state()==cancel_before
 send('TEST Geçici B adında müşteri oluştur');pg.click('[data-cancel-customer]');pg.wait_for_function("()=>!document.querySelector('[data-customer-create]')");assert state()==cancel_before
 send('Yeni müşteri oluştur');send('TEST Kaya 3 sefer yaptı');assert pg.input_value('[data-msg]')=='TEST Kaya 3 sefer yaptı' and state()==cancel_before
 print('PASS both cancellation controls write nothing; a transaction following the name question is never mistaken for a customer name',flush=True)
 # The database helper serializes approvals from independent tabs; reuse cannot overwrite an existing phone.
 c.set_offline(False);pg2=c.new_page();pg2.goto(U+'index.html#/akilli-asistan');pg2.wait_for_selector('[data-msg]')
 for tab in [pg,pg2]:
  tab.fill('[data-msg]','TEST Eşzamanlı adında müşteri oluştur');tab.click('[data-ask]');tab.wait_for_selector('[data-create-customer]')
 pg.fill('[data-customer-phone]','05321111111');pg2.fill('[data-customer-phone]','05322222222')
 pg.click('[data-create-customer]');pg2.click('[data-create-customer]')
 for tab in [pg,pg2]:tab.wait_for_selector('[data-out] .notice.ok')
 concurrent=state();same=[x for x in concurrent['customers'] if x['name']=='TEST Eşzamanlı'];assert len(same)==1 and same[0]['phone']=='05321111111'
 assert 'ikinci kayıt açılmadı' in pg2.locator('[data-out]').inner_text()
 assert len([x for x in concurrent['audit_log'] if x.get('entity_id')==same[0]['id']])==1
 print('PASS two-tab approvals produce one customer and one audit; replay keeps original phone and reports existing card',flush=True)
 # Reset in another tab makes a stale approval fail before any customer/audit write.
 send('Eski Sohbet Testi adında müşteri oluştur');stale=state();pg2.click('[data-new-chat]');pg2.click('.sheet [data-x="1"]');pg2.wait_for_function("()=>!document.querySelector('[data-chat-turn]')")
 pg.click('[data-create-customer]');pg.wait_for_selector('[data-customer-error]:not(:empty)');assert 'Sohbet yenilendi' in pg.locator('[data-customer-error]').inner_text() and state()==stale
 print('PASS new-chat epoch checked in the same write transaction; old-tab proposal cannot create a customer',flush=True)
 # Audit failure rolls back the customer too; retry is safe.
 send('Atomik Deneme adında müşteri oluştur');atomic=state()
 pg.evaluate("""()=>{const old=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(value,...args){if(this.name==='audit_log'){IDBObjectStore.prototype.put=old;this.transaction.abort();return old.call(this,value,...args)}return old.call(this,value,...args)}}""")
 pg.click('[data-create-customer]');pg.wait_for_selector('[data-customer-error]:not(:empty)');assert state()==atomic
 create();assert sum(x['name']=='Atomik Deneme' for x in state()['customers'])==1
 # Parent identity, deleted parent, duplicates, field allowlist and no overwrite are checked in the actual helper.
 result=pg.evaluate("""async()=>{const db=await import('./js/db.js');const p=await db.ensureCustomerCard('TEST Ana Firma');const a=await db.ensureCustomerCard('TEST Alt Firma',p.id,{fields:{phone:'05320000000',note:'not',id:'INJECT',internal:true}});const root=await db.ensureCustomerCard('TEST Alt Firma');const reused=await db.ensureCustomerCard('TEST Alt Firma',p.id,{fields:{phone:'05329999999'}});await db.softDelete('customers',p.id,'TEST');let rejected=false;try{await db.ensureCustomerCard('TEST Geçersiz Alt',p.id)}catch{rejected=true}return {a,root,reused,rejected}}""")
 assert result['a']['id']!='INJECT' and not result['a'].get('internal') and result['a']['note']=='not' and result['reused']['phone']=='05320000000' and result['root']['id']!=result['a']['id'] and result['rejected']
 for width in [320,360,768]:
  pg.set_viewport_size({'width':width,'height':850});send('Yeni müşteri oluştur');assert pg.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),width
 pg.set_viewport_size({'width':360,'height':850});send('Kemer Country No 53 adında müşteri oluştur');pg.screenshot(path='/tmp/solo-v3955-customer-mobile.png',full_page=True)
 assert not requests and not errors,(requests,errors)
 print('PASS injected audit failure rolls back customer and retry succeeds; parent-scoped identity, deleted parent and field allowlist; 320/360/768px fit; zero model requests/uncaught errors',flush=True)
 c.close();b.close()
