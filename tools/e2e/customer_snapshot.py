"""One customer-section snapshot; fresh sharing after a record changes. No real data."""
import sys
from playwright.sync_api import sync_playwright
U=sys.argv[1] if len(sys.argv)>1 else 'http://localhost:8841/'
MOCK="""(()=>{window.__snapshots=[];window.__shares=[];
 const tx=IDBDatabase.prototype.transaction;
 IDBDatabase.prototype.transaction=function(stores,mode,...rest){
  const names=typeof stores==='string'?[stores]:Array.from(stores);
  if(mode==='readonly'&&names.includes('customers')&&names.includes('work_records')&&names.includes('cari_movements'))window.__snapshots.push(names);
  return tx.call(this,stores,mode,...rest);
 };
 navigator.share=d=>{window.__shares.push(d.text);return Promise.resolve()};
 try{localStorage.setItem('sp_role','boss')}catch(e){}
})()"""
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 ctx=b.new_context(viewport={'width':360,'height':800});ctx.add_init_script(MOCK)
 pg=ctx.new_page();errors=[];pg.on('pageerror',lambda e:errors.append(str(e)))
 pg.goto(U+'index.html#/daha');pg.wait_for_selector('#screen[data-view-ready="1"]')
 ids=pg.evaluate("""async()=>{
 const db=await import('./js/db.js');
 const p=await db.saveNew('customers',{name:'TEST Ana Firma'},'TEST'),c=await db.saveNew('customers',{name:'TEST Müşteri',parent_customer_id:p.id,fuel_rules:[{id:'r',per:75,unit:'Sefer',only_pay:true}]},'TEST');
 const v=await db.saveNew('vehicles',{name:'TEST Araç'},'TEST');
 await db.saveNew('work_records',{customer_id:c.id,vehicle_id:v.id,date:'2026-10-20',work_type:'Moloz Nakliye',quantity:5,unit:'Sefer',customer_fuel_allowance_l:375,price_snapshot:{amount:0,unit_price:0,price_source:'Mazot karşılığı'}},'TEST');
 await db.saveNew('cari_movements',{customer_id:c.id,date:'2026-10-20',type:'Düzeltme',amount:100.25},'TEST');
 await db.saveNew('fuel_records',{customer_id:c.id,vehicle_id:v.id,date:'2026-10-20',liters:300,fuel_source:'Müşteri Verdi'},'TEST');
 return {c:c.id,v:v.id};
 }""")
 def snapshot():return pg.evaluate("async()=>{const db=await import('./js/db.js');return {data:await db.dumpAll(),audit:await db.getAll('audit_log')}}")
 pg.wait_for_timeout(200)  # Fixture notifications are consumed on a non-refreshable route.
 before=snapshot();pg.evaluate('window.__snapshots=[]')
 pg.goto(U+'index.html#/musteriler/'+ids['c']);pg.wait_for_selector('#screen[data-view-ready="1"] [data-fuelshare]')
 assert pg.evaluate('window.__snapshots.length')==1,pg.evaluate('window.__snapshots')
 assert '75 L' in pg.inner_text('[data-fuelpanel]')
 assert '100,25' in pg.inner_text('[data-custdash]') and '75 L' in pg.inner_text('[data-custworks]')
 assert snapshot()==before,'reading the card must not change data or audit'
 print('PASS customer dashboard, work list, fuel and parent sections use one snapshot and preserve TL/litre results without writes',flush=True)
 # Source changes while the card is open: sharing must still use a fresh read.
 pg.evaluate("""async ids=>{const db=await import('./js/db.js');await db.saveNew('fuel_records',{customer_id:ids.c,vehicle_id:ids.v,date:'2026-10-20',liters:25,fuel_source:'Müşteri Verdi'},'TEST new receipt')}""",ids)
 pg.wait_for_function("()=>document.querySelector('#screen')?.dataset.viewReady==='1'&&document.querySelector('[data-fuelpanel]')?.textContent.includes('50 L')")
 after_receipt=snapshot();pg.evaluate('window.__snapshots=[]');pg.click('[data-fuelshare]')
 pg.wait_for_function('() => window.__shares.length===1')
 text=pg.evaluate('window.__shares[0]')
 assert 'Alınan: 325 L' in text and 'Kalan: 50 L' in text,text
 assert pg.evaluate('window.__snapshots.length')==1
 assert snapshot()==after_receipt,'sharing itself must not write records'
 pg.reload();pg.wait_for_selector('[data-fuelshare]');assert '50 L' in pg.inner_text('[data-fuelpanel]')
 pg.goto(U+'index.html#/musteriler?q=TEST+Müşteri');pg.wait_for_selector('[data-customer-directory]')
 assert '50 L' in pg.inner_text('[data-customer-card="'+ids['c']+'"]')
 # Change customer + payment after the cash read, without a notification (legacy writer).
 pg.goto(U+'index.html#/daha');pg.wait_for_selector('#screen[data-view-ready="1"]')
 race=pg.evaluate("""async ids=>{const db=await import('./js/db.js'),C=await import('./js/core.js'),customer=await db.get('customers',ids.c),parent=await db.saveNew('customers',{name:'TEST Yeni Ana Firma'},'TEST');const cash=C.newRecord({date:C.todayStr(),customer_id:ids.c,cash_type:'Müşteriden Para Alındı',amount:25,payment_method:'Nakit'}),move=C.newRecord({date:cash.date,customer_id:ids.c,type:'Tahsilat',amount:-25,ref_id:cash.id});return {customer:{...customer,name:'TEST Güncel Müşteri',parent_customer_id:parent.id,updated_at:new Date().toISOString()},cash,move}}""",ids)
 pg.wait_for_timeout(200)
 pg.evaluate("""rows=>{const old=IDBObjectStore.prototype.getAll;window.__raceHit=false;window.__raceWrite=null;IDBObjectStore.prototype.getAll=function(...args){const r=old.apply(this,args);if(this.name==='cash_records'&&this.transaction.mode==='readonly'&&!window.__raceHit){window.__raceHit=true;const conn=this.transaction.db;r.addEventListener('success',()=>{window.__raceWrite=new Promise((res,rej)=>{const t=conn.transaction(['customers','cash_records','cari_movements'],'readwrite');t.objectStore('customers').put(rows.customer);t.objectStore('cash_records').put(rows.cash);t.objectStore('cari_movements').put(rows.move);t.oncomplete=res;t.onabort=()=>rej(t.error)})})}return r}}""",race)
 pg.evaluate("id=>location.hash='#/musteriler/'+id",ids['c']);pg.wait_for_selector('#screen[data-view-ready="1"] [data-custdash]')
 assert pg.evaluate('async()=>{await window.__raceWrite;return window.__raceHit}')
 assert pg.locator('#screen h1').inner_text()=='TEST Müşteri'
 assert 'TEST Müşteri' in pg.locator('[data-card-content]').text_content()
 assert 'TEST Yeni Ana Firma' not in pg.locator('#screen').inner_text()
 fresh=snapshot()
 assert len([r for r in fresh['data']['cash_records'] if r['id']==race['cash']['id']])==1
 pg.reload();pg.wait_for_selector('#screen[data-view-ready="1"] [data-custdash]')
 assert pg.locator('#screen h1').inner_text()=='TEST Güncel Müşteri'
 assert 'TEST Yeni Ana Firma' in pg.locator('#screen').inner_text()
 pg.click('[data-tab=cash_records]');pg.wait_for_selector('[data-card-content] [data-related]',state='attached')
 assert 'Tahsilat / Kasa (1)' in pg.locator('[data-card-content]').text_content()
 assert snapshot()==fresh, 'Refresh and relation tabs do not change data or audit'
 print('PASS render-time customer/payment change never mixes old header with new parent/dashboard; reload and relation tab show fresh values; read-only DB/audit',flush=True)
 assert not errors,errors
 print('PASS sharing reads a newer receipt; reload and directory show fresh balances; no stale index cache or browser errors',flush=True)
 b.close()
