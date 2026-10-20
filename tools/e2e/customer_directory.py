"""Read-only customer directory: real IndexedDB, phone layout, synthetic data."""
from playwright.sync_api import sync_playwright
U='http://localhost:8841/'
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 c=b.new_context(viewport={'width':360,'height':800});c.add_init_script("try{localStorage.setItem('sp_role','boss')}catch(e){}")
 pg=c.new_page();errors=[];pg.on('pageerror',lambda e:errors.append(str(e)));pg.goto(U+'index.html#/musteriler');pg.wait_for_selector('[data-customer-directory]')
 fixture=pg.evaluate("""async()=>{
 const db=await import('./js/db.js');
 const vehicle=await db.saveNew('vehicles',{name:'TEST v44 Manitou'},'TEST v44');
 const customer=(name,extra={})=>db.saveNew('customers',{name,...extra},'TEST v44');
 const parent=await customer('TEST v44 Ulaş Rondela'),other=await customer('TEST v44 Diğer Firma');
 const child=await customer('TEST v44 Çatıcı',{parent_customer_id:parent.id,contact:'TEST Yetkili',phone:'05550000044'});
 const child2=await customer('TEST v44 Çatıcı',{parent_customer_id:other.id});
 const fuel=await customer('TEST v44 Mazot',{fuel_rules:[{id:'r',per:75,unit:'Sefer',only_pay:true}]});
 const credit=await customer('TEST v44 Alacaklı'),inactive=await customer('TEST v44 Pasif',{active:false});
 const removed=await customer('TEST v44 Silinen');await db.softDelete('customers',removed.id,'TEST silinen');
 await customer('TEST v44 İç iş',{internal:true});
 const work=(cid,date,extra={})=>db.saveNew('work_records',{customer_id:cid,vehicle_id:vehicle.id,date,quantity:1,unit:'Saat',work_type:'Makine Çalışması',...extra},'TEST v44');
 await work(parent.id,'2026-10-01',{price_snapshot:{unit_price:100.25,amount:100.25}});
 await work(child.id,'2026-10-19',{price_snapshot:{unit_price:2500.50,amount:2500.50}});
 await work(child.id,'2026-10-20');
 await work(child.id,'2026-10-20',{price_snapshot:{unit_price:0,amount:0}});
 await work(child2.id,'2026-09-01',{price_snapshot:{unit_price:700,amount:700}});
 await work(fuel.id,'2026-10-20',{quantity:5,unit:'Sefer',customer_fuel_allowance_l:375,price_snapshot:{amount:0,price_source:'Mazot karşılığı'}});
 await db.saveNew('cari_movements',{customer_id:child.id,date:'2026-10-20',type:'Tahsilat',amount:-500.25},'TEST v44');
 await db.saveNew('cari_movements',{customer_id:credit.id,date:'2026-10-20',type:'Tahsilat',amount:-300},'TEST v44');
 await db.saveNew('fuel_records',{customer_id:fuel.id,vehicle_id:vehicle.id,date:'2026-10-20',liters:300,fuel_source:'Müşteri Verdi'},'TEST v44');
 await db.saveNew('fuel_records',{customer_id:credit.id,vehicle_id:vehicle.id,date:'2026-10-20',liters:50,fuel_source:'Müşteri Verdi'},'TEST v44');
 return {parent:parent.id,child:child.id,child2:child2.id,fuel:fuel.id,credit:credit.id,inactive:inactive.id};
 }""")
 def snapshot():return pg.evaluate("async()=>{const db=await import('./js/db.js'),d=await db.dumpAll();return {data:['customers','work_records','cari_movements','cash_records','fuel_records','hakedis'].map(s=>d[s]),audit:await db.getAll('audit_log')}}")
 before=snapshot()
 pg.goto(U+'index.html#/musteriler?q=TEST+v44');pg.wait_for_selector('[data-customer-directory]')
 def card(key):return pg.locator('[data-customer-card="'+fixture[key]+'"]')
 assert pg.locator('[data-customer-card]').count()==7
 assert '100,25 ₺' in card('parent').inner_text() and '2.000,25 ₺' in card('child').inner_text(),(card('parent').inner_text(),card('child').inner_text())
 assert 'Ulaş Rondela' in card('child').inner_text() and 'Diğer Firma' in card('child2').inner_text()
 assert '1 işin fiyatı eksik' in card('child').inner_text()
 assert '75 L' in card('fuel').inner_text() and 'TL bakiyesi' in card('fuel').inner_text()
 assert 'Müşterinin TL alacağı' in card('credit').inner_text() and '300,00 ₺' in card('credit').inner_text()
 assert 'Fazla alınan mazot' in card('credit').inner_text() and '50 L' in card('credit').inner_text()
 pg.click('.customer-overview summary');totals=pg.inner_text('[data-customer-totals]');assert '2.800,50 ₺' in totals and '300,00 ₺' in totals and '75 L' in totals and '50 L' in totals
 assert 'Son iş: 20.10.2026' in card('child').inner_text()
 print('PASS customer-owned balances, cents, parent context, explicit zero versus missing price, separate positive/negative TL and litres',flush=True)
 for view,expected in [('receivable',3),('fuel',1),('unpriced',1),('subcontractor',2),('inactive',1)]:
  pg.click('[data-customer-view="'+view+'"]');assert pg.locator('[data-customer-card]').count()==expected
  assert pg.get_attribute('[data-customer-view="'+view+'"]','aria-pressed')=='true'
 pg.click('[data-customer-view="all"]');pg.fill('[data-search]','Ulaş Rondela')
 assert pg.locator('[data-customer-card]').count()==2 and card('child').count()==1
 assert pg.locator('[data-search]').evaluate('(e)=>e===document.activeElement')
 pg.fill('[data-search]','05550000044');assert pg.locator('[data-customer-card]').count()==1
 pg.fill('[data-search]','TEST v44');pg.select_option('[data-customer-sort]','balance')
 assert pg.locator('[data-customer-card]').first.get_attribute('data-customer-card')==fixture['child']
 pg.click('[data-customer-view="subcontractor"]');pg.reload();pg.wait_for_selector('[data-customer-directory]')
 assert pg.locator('[data-customer-card]').count()==2 and pg.input_value('[data-customer-sort]')=='balance'
 assert pg.input_value('[data-search]')=='TEST v44'
 pg.select_option('[data-customer-sort]','recent');pg.click('[data-customer-view="all"]')
 pg.fill('[data-search]','BULUNMAYAN TEST v44');assert pg.locator('[data-customer-card]').count()==0
 assert 'Bu arama ve filtreye uyan müşteri yok' in pg.inner_text('[data-list]')
 pg.locator('.customer-overview').evaluate('(e)=>e.open=true');assert '0,00 ₺' in pg.inner_text('[data-customer-totals]')
 print('PASS all account filters, parent/phone search without focus loss, sorting, reload persistence and empty result',flush=True)
 pg.fill('[data-search]','TEST v44');pg.locator('.customer-overview').evaluate('(e)=>e.open=false')
 for width in [320,360,768]:
  pg.set_viewport_size({'width':width,'height':800})
  assert pg.evaluate('document.documentElement.scrollWidth<=document.documentElement.clientWidth'),width
 assert not pg.evaluate("async()=>(await import('./js/update-safety.js')).updateRisk(document.querySelector('#screen')).unsaved")
 pg.set_viewport_size({'width':360,'height':800});pg.screenshot(path='/tmp/solo44-customers.png',full_page=True)
 card('child').click();pg.wait_for_selector('[data-custdash]')
 dash=pg.inner_text('[data-custdash]');assert 'GÜNCEL TL BAKİYE' in dash and '2.000,25' in dash,dash
 after=snapshot();assert after==before,{'changed_stores':[i for i in range(len(after['data'])) if after['data'][i]!=before['data'][i]],'new_audit':[a for a in after['audit'] if a not in before['audit']]}
 assert not errors,errors
 print('PASS 320/360/768px layout, correct customer card navigation, no business/audit writes or browser errors',flush=True)
 b.close()
