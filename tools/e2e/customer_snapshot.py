"""One customer-section snapshot; fresh sharing after a record changes. No real data."""
from playwright.sync_api import sync_playwright
U='http://localhost:8841/'
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
 pg.goto(U+'index.html#/musteriler');pg.wait_for_selector('[data-customer-directory]')
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
 before=snapshot();pg.evaluate('window.__snapshots=[]')
 pg.goto(U+'index.html#/musteriler/'+ids['c']);pg.wait_for_selector('[data-fuelshare]')
 assert pg.evaluate('window.__snapshots.length')==1,pg.evaluate('window.__snapshots')
 assert '75 L' in pg.inner_text('[data-fuelpanel]')
 assert '100,25' in pg.inner_text('[data-custdash]') and '75 L' in pg.inner_text('[data-custworks]')
 assert snapshot()==before,'reading the card must not change data or audit'
 print('PASS customer dashboard, work list, fuel and parent sections use one snapshot and preserve TL/litre results without writes',flush=True)
 # Source changes while the card is open: sharing must still use a fresh read.
 pg.evaluate("""async ids=>{const db=await import('./js/db.js');await db.saveNew('fuel_records',{customer_id:ids.c,vehicle_id:ids.v,date:'2026-10-20',liters:25,fuel_source:'Müşteri Verdi'},'TEST new receipt')}""",ids)
 after_receipt=snapshot();pg.evaluate('window.__snapshots=[]');pg.click('[data-fuelshare]')
 pg.wait_for_function('() => window.__shares.length===1')
 text=pg.evaluate('window.__shares[0]')
 assert 'Alınan: 325 L' in text and 'Kalan: 50 L' in text,text
 assert pg.evaluate('window.__snapshots.length')==1
 assert snapshot()==after_receipt,'sharing itself must not write records'
 pg.reload();pg.wait_for_selector('[data-fuelshare]');assert '50 L' in pg.inner_text('[data-fuelpanel]')
 pg.goto(U+'index.html#/musteriler?q=TEST+Müşteri');pg.wait_for_selector('[data-customer-directory]')
 assert '50 L' in pg.inner_text('[data-customer-card="'+ids['c']+'"]')
 assert not errors,errors
 print('PASS sharing reads a newer receipt; reload and directory show fresh balances; no stale index cache or browser errors',flush=True)
 b.close()
