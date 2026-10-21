"""Real mobile UI and IndexedDB; synthetic records, zero external AI/messages.
Business decisions must remain read only and distinguish debt from cash handover.
"""
from playwright.sync_api import sync_playwright
U='http://localhost:8841/'
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 c=b.new_context(viewport={'width':360,'height':800},service_workers='allow')
 c.add_init_script("try{localStorage.setItem('sp_role','boss')}catch(e){}")
 pg=c.new_page();errors=[];calls=[];pg.on('pageerror',lambda e:errors.append(str(e)))
 pg.route('https://generativelanguage.googleapis.com/**',lambda r:(calls.append(r.request.url),r.abort()))
 pg.goto(U+'index.html#/musteriler');pg.wait_for_selector('[data-customer-directory]')
 pg.evaluate('async()=>await navigator.serviceWorker.ready')
 if not pg.evaluate('!!navigator.serviceWorker.controller'):
  pg.reload();pg.wait_for_selector('[data-customer-directory]')
 ids=pg.evaluate("""async()=>{
  const db=await import('./js/db.js'),C=await import('./js/core.js'),today=C.todayStr();
  await db.metaSet('gemini_key','TEST');await db.metaSet('gemini_consent',true);await db.metaSet('gemini_model','gemini-2.5-flash');
  const parent=await db.saveNew('customers',{name:'TEST Ulaş Rondela'},'TEST');
  const customer=await db.saveNew('customers',{name:'TEST Çatıcı <img src=x onerror="window.__xss=1">',parent_customer_id:parent.id},'TEST');
  const v=await db.saveNew('vehicles',{name:'TEST Makine',service_rules:[{id:'late',title:'TEST yağ',every_days:30,last:{date:C.addDays(today,-60)}}]},'TEST');
  const person=await db.saveNew('personnel',{name:'TEST Soner'},'TEST');
  await db.saveNew('work_records',{date:C.addDays(today,-1),customer_id:customer.id,vehicle_id:v.id,quantity:2,unit:'Saat',work_type:'Kazı',price_snapshot:{unit_price:1000.25}},'TEST');
  await db.saveNew('work_records',{date:today,customer_id:customer.id,vehicle_id:v.id,quantity:1,unit:'Saat',work_type:'Kazı'},'TEST');
  const cash=await db.saveNew('cash_records',{cash_type:'Müşteriden Para Alındı',date:today,customer_id:customer.id,personnel_id:person.id,payment_method:'Nakit',cash_status:'PERSONELDE',amount:500.25},'TEST');
  await db.metaSet('collect_notes',{[customer.id]:{promise_date:C.addDays(today,-1),promise_amount:1500.25}});
  await db.metaSet('pdf_history_draft:TEST47',{version:1,_file_name:'TEST.pdf',rows:[{id:'0',kind:'work',date:today,quote:'TEST 1 saat',page:1,customer_id:customer.id,vehicle_id:v.id,work_type:'Kazı',quantity:1,unit:'Saat'}],notes:[],totals:[]});
  return {c:customer.id,v:v.id,cash:cash.id,tomorrow:C.addDays(today,1)};
 }""")
 def snapshot():return pg.evaluate("async()=>{const db=await import('./js/db.js');return {data:await db.dumpAll(),audit:await db.getAll('audit_log')}}")
 def home():
  pg.goto(U);pg.wait_for_selector('[data-badv]');pg.click('[data-badv]');pg.wait_for_selector('[data-business-priorities]')
 def expand():
  while pg.locator('[data-priority-more]').count():pg.click('[data-priority-more]')
 before=snapshot();home()
 assert pg.locator('[data-priority]').count()==3
 assert pg.locator('[data-priority]').first.get_attribute('data-priority')=='maintenance:'+ids['v']+':late'
 assert 'ödeme sözü geçmiş' in pg.inner_text('[data-priority="collect:'+ids['c']+'"]')
 assert 'TEST Ulaş Rondela' in pg.inner_text('[data-priority="collect:'+ids['c']+'"]')
 assert '1.500,25 ₺' in pg.inner_text('[data-priority="collect:'+ids['c']+'"]')
 assert '500,25 ₺' in pg.inner_text('[data-priority="cash:'+ids['cash']+'"]')
 assert 'yeniden tahsilat girmeden' in pg.inner_text('[data-priority="cash:'+ids['cash']+'"]')
 expand();assert pg.locator('[data-priority="review:pdf"]').count()==1
 assert pg.locator('[data-priority="review:fiyatsiz"]').count()==1
 assert snapshot()==before and not calls
 assert not pg.evaluate('!!window.__xss')
 pg.locator('[data-business-priorities]').screenshot(path='/tmp/solo-business-v3947.png')
 for width in [320,360,768]:
  pg.set_viewport_size({'width':width,'height':850});assert pg.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),width
 pg.set_viewport_size({'width':360,'height':800})
 pg.locator('[data-priority="cash:'+ids['cash']+'"] [data-priority-source]').click()
 pg.wait_for_url('**#/kasa/'+ids['cash']);pg.get_by_role('heading',name='Tahsilat / Kasa',exact=True).wait_for()
 assert '500,25' in pg.text_content('#screen')
 assert snapshot()==before
 print('PASS home priorities explain maintenance, customer-owned debt, cash handover and PDF; source navigation, 320/360/768px, escaping, no writes or AI',flush=True)
 pg.goto(U+'index.html#/akilli-asistan');pg.wait_for_selector('[data-msg]')
 pg.fill('[data-msg]','Bugün ne yapmalıyım?');pg.click('[data-ask]');pg.wait_for_selector('[data-answer]')
 answer=pg.inner_text('[data-answer]');assert '1.500,25 ₺' in answer and 'TEST Ulaş Rondela' in answer
 assert '500,25 ₺' in answer and 'yeniden tahsilat girmeden' in answer
 assert pg.locator('[data-out] [data-go="#/tahsilat/'+ids['c']+'"]').count()==1
 assert pg.locator('[data-out] [data-go="#/kasa/'+ids['cash']+'"]').count()==1
 assert snapshot()==before and not calls
 print('PASS assistant answers with current payment promises/PDF metadata and exact source links without Gemini despite an enabled TEST key',flush=True)
 home();other=c.new_page();other.goto(U+'index.html#/musteriler');other.wait_for_selector('[data-customer-directory]')
 other.evaluate("""async ids=>{const db=await import('./js/db.js');const cash=await db.get('cash_records',ids.cash);await db.saveExisting('cash_records',cash,{cash_status:'TESLIM_BILDIRILDI'},'TEST reported handover')}""",ids)
 reported=snapshot();pg.click('[data-priority-refresh]');pg.wait_for_selector('[data-business-priorities]');expand()
 assert 'kasaya teslim onayı bekleyen' in pg.inner_text('[data-priority="cash:'+ids['cash']+'"]')
 assert snapshot()==reported
 other.evaluate("""async ids=>{const db=await import('./js/db.js');const cash=await db.get('cash_records',ids.cash);await db.saveExisting('cash_records',cash,{cash_status:'KASAYA_TESLIM_EDILDI'},'TEST handover');await db.metaSet('collect_notes',{[ids.c]:{promise_date:ids.tomorrow}})}""",ids)
 updated=snapshot();pg.click('[data-priority-refresh]');pg.wait_for_selector('[data-business-priorities]');expand()
 assert pg.locator('[data-priority="cash:'+ids['cash']+'"]').count()==0
 assert pg.locator('[data-priority="collect:'+ids['c']+'"]').count()==0
 assert pg.locator('[data-priority="review:pdf"]').count()==1
 assert snapshot()==updated
 pg.locator('[data-priority="review:pdf"] [data-priority-source]').click();pg.wait_for_selector('[data-pdf-resume]')
 assert '1 bekleyen' in pg.inner_text('[data-pdf-queue]')
 print('PASS refresh distinguishes reported versus confirmed handover and reads rescheduled promises; completed actions clear, pending PDF still opens, no further writes',flush=True)
 # A failed snapshot must never produce reassuring zero totals or a completed plan.
 fault="""()=>{window.__originalTx=IDBDatabase.prototype.transaction;IDBDatabase.prototype.transaction=function(stores,mode,...rest){const a=typeof stores==='string'?[stores]:Array.from(stores);if(mode==='readonly'&&a.includes('customers')&&a.includes('meta'))throw Error('TEST read failure');return window.__originalTx.call(this,stores,mode,...rest)}}"""
 restore="() => {IDBDatabase.prototype.transaction=window.__originalTx}"
 home();pg.evaluate(fault);pg.click('[data-priority-refresh]');pg.get_by_text('Öncelikler okunamadı.',exact=False).wait_for()
 assert pg.locator('[data-business-priorities]').count()==0
 pg.evaluate(restore);pg.click('[data-badv]');pg.wait_for_selector('[data-business-priorities]')
 pg.goto(U+'index.html#/akilli-asistan');pg.wait_for_selector('[data-msg]');pg.evaluate(fault)
 pg.fill('[data-msg]','Önceliklerim');pg.click('[data-ask]');pg.locator('[data-out]').get_by_text('Kayıtlar okunamadı; öneri hazırlanmadı.',exact=False).wait_for()
 assert pg.locator('[data-answer]').count()==0
 pg.evaluate(restore);pg.click('[data-ask]');pg.wait_for_selector('[data-answer]')
 assert snapshot()==updated and not calls
 print('PASS home and assistant show read errors rather than false empty advice; retry restores actual priorities',flush=True)
 c.set_offline(True);home();expand()
 assert pg.locator('[data-priority="review:pdf"]').count()==1
 assert pg.locator('[data-priority="cash:'+ids['cash']+'"]').count()==0
 pg.goto(U+'index.html#/akilli-asistan');pg.wait_for_selector('[data-msg]');pg.fill('[data-msg]','Bugünün öncelikleri');pg.click('[data-ask]');pg.wait_for_selector('[data-answer]')
 assert 'PDF’de 1 satır bekliyor' in pg.inner_text('[data-answer]')
 assert snapshot()==updated and not calls
 assert not errors,errors
 print('PASS real service-worker offline reload and assistant reply preserve all business/audit records; no browser errors or AI requests',flush=True)
 c.set_offline(False)
 fresh=b.new_context(viewport={'width':360,'height':800},service_workers='block');fresh.add_init_script("try{localStorage.setItem('sp_role','boss')}catch(e){}")
 first=fresh.new_page();first.goto(U+'index.html#/musteriler');first.wait_for_selector('[data-customer-directory]');first.goto(U);first.wait_for_selector('[data-badv]');first.click('[data-badv]');first.wait_for_selector('[data-business-priorities]')
 assert first.locator('[data-priority="start:work"]').count()==1
 assert first.locator('[data-priority="start:history"]').count()==1
 assert first.locator('[data-priority="start:history"] [data-priority-source]').get_attribute('data-go')=='#/akilli-asistan/pdf-gecmis'
 print('PASS a new installation offers first-work and historical-PDF entry points without assuming existing business data',flush=True)
 b.close()
