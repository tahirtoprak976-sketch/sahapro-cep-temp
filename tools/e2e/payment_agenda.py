"""Synthetic payment obligations in real Chromium/IndexedDB. No messages or AI.
The agenda, priorities, local assistant and CSV must agree without writing money.
"""
from playwright.sync_api import sync_playwright
U='http://localhost:8841/'
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 c=b.new_context(viewport={'width':360,'height':850},service_workers='allow');c.add_init_script("try{localStorage.setItem('sp_role','boss')}catch(e){}")
 pg=c.new_page();errors=[];calls=[];pg.on('pageerror',lambda e:errors.append(str(e)))
 pg.route('https://generativelanguage.googleapis.com/**',lambda r:(calls.append(r.request.url),r.abort()))
 pg.goto(U+'index.html#/musteriler');pg.wait_for_selector('[data-customer-directory]');pg.evaluate('async()=>await navigator.serviceWorker.ready')
 if not pg.evaluate('!!navigator.serviceWorker.controller'):
  pg.reload();pg.wait_for_selector('[data-customer-directory]')
 ids=pg.evaluate("""async()=>{
  const db=await import('./js/db.js'),E=await import('./js/enterprise-db.js'),C=await import('./js/core.js'),today=C.todayStr();
  const s=await E.saveSupplier({name:'TEST Lastikçi <img src=x onerror="window.__xss=1">'}),other=await E.saveSupplier({name:'TEST Petrolcü'});
  const create=(no,amount,due,sid=s.id)=>E.savePayable({date:C.addDays(today,-10),due_date:due,party_type:'supplier',party_id:sid,document_no:no,items:[{description:'TEST alış '+no,quantity:1,unit:'Adet',unit_price:amount,kdv_rate:0}]});
  const late=await create('TEST-LATE',1000.25,C.addDays(today,-1));
  await E.paySupplier({payable_id:late.id,date:today,amount:250.10,method:'Nakit'});
  const now=await create('TEST-TODAY',100,today);await E.paySupplier({payable_id:now.id,date:C.addDays(today,1),amount:100,method:'Nakit'});
  const soon=await create('TEST-SOON',50.55,C.addDays(today,7)),later=await create('TEST-LATER',99.99,C.addDays(today,8));
  for(let i=0;i<33;i++)await create('TEST-BULK-'+i,1.1,today,other.id);
  const settled=await create('TEST-SETTLED',10,today);await E.paySupplier({payable_id:settled.id,date:today,amount:10,method:'Nakit'});
  await db.put('payables',C.newRecord({id:'legacy-no-due',date:today,party_type:'supplier',party_id:s.id,document_no:'TEST-NO-DUE',gross_total:20,status:'Onaylandı'}));
  await db.put('payables',C.newRecord({id:'bad-payment',date:today,due_date:today,party_type:'supplier',party_id:s.id,document_no:'TEST-BAD-PAY',gross_total:20,status:'Onaylandı'}));
  await db.put('supplier_payments',C.newRecord({id:'bad-pay',payable_id:'bad-payment',date:today,party_type:'supplier',party_id:other.id,amount:5}));
  const q=await E.saveInstrument({date:today,due_date:C.addDays(today,1),party_type:'supplier',party_id:s.id,direction:'Verilen',kind:'Çek',document_no:'TEST-CHEQUE',amount:750.15});
  await db.metaSet('gemini_key','TEST');await db.metaSet('gemini_consent',true);await db.metaSet('gemini_model','gemini-2.5-flash');
  return {late:late.id,now:now.id,soon:soon.id,later:later.id,s:s.id,other:other.id,q:q.id};
 }""")
 def snapshot():return pg.evaluate("async()=>{const db=await import('./js/db.js');return {data:await db.dumpAll(),drafts:await db.getAll('drafts')}}")
 def agenda():pg.goto(U+'index.html#/odeme-takibi');pg.wait_for_selector('[data-payment-list]')
 def rec(id):return pg.locator('[data-payment-record="'+id+'"]')
 def expand_priorities():
  while pg.locator('[data-priority-more]').count():pg.click('[data-priority-more]')
 before=snapshot();pg.goto(U+'index.html#/finans');pg.locator('[data-go="#/odeme-takibi"]').click();pg.wait_for_selector('[data-payment-list]')
 assert '750,15 ₺' in pg.locator('[data-payment-bucket=overdue]').text_content()
 assert '136,30 ₺' in pg.locator('[data-payment-bucket=today]').text_content()
 assert '50,55 ₺' in pg.locator('[data-payment-bucket=soon]').text_content()
 assert '2 belge' in pg.locator('[data-payment-bucket=review]').text_content()
 assert pg.locator('[data-payment-record]').count()==30 and '39 belge' in pg.locator('[data-payment-count]').text_content()
 pg.click('[data-payment-more]');assert pg.locator('[data-payment-record]').count()==39
 assert '1 ileri tarihli ödeme' in rec(ids['now']).text_content() and 'Kalan 100,00 ₺' in rec(ids['now']).text_content()
 assert '750,15 ₺' in rec(ids['late']).text_content() and '250,10 ₺' in rec(ids['late']).text_content()
 assert 'açık çek/senet' in rec(ids['late']).text_content() and rec(ids['late']).locator('a[href="#/ceksenet/'+ids['q']+'"]').count()==1
 assert 'varsayılmadı' in rec('legacy-no-due').text_content() and 'Hesaplanmadı' in rec('bad-payment').text_content()
 assert not pg.evaluate('!!window.__xss')
 for width in [320,360,768]:
  pg.set_viewport_size({'width':width,'height':850});assert pg.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),width
 pg.set_viewport_size({'width':360,'height':850})
 assert snapshot()==before
 pg.screenshot(path='/tmp/solo-v3951-payment-agenda.png',full_page=True)
 print('PASS finance entry, source-linked partial/future payments, overdue/today/7-day totals, review-only malformed data, cheque caution, escaping and mobile layout; no writes',flush=True)
 # Full-filter CSV must include all 39 rows, then only the selected overdue row.
 pg.evaluate("()=>{navigator.canShare=()=>true;navigator.share=async p=>{window.__csv=await p.files[0].text()}}")
 pg.click('[data-payment-csv]');pg.wait_for_function('()=>!!window.__csv');assert len(pg.evaluate('window.__csv').splitlines())==40
 pg.fill('[data-payment-query]','TEST-LATE');pg.click('[data-payment-bucket=overdue]');assert pg.locator('[data-payment-record]').count()==1 and 'q=TEST-LATE' in pg.url
 assert '750,15 ₺' in pg.locator('[data-payment-bucket=overdue]').text_content() and '0,00 ₺' in pg.locator('[data-payment-bucket=today]').text_content()
 pg.evaluate("()=>{navigator.canShare=()=>true;navigator.share=async p=>{window.__filtered=await p.files[0].text()}}")
 pg.click('[data-payment-csv]');pg.wait_for_function('()=>!!window.__filtered');assert len(pg.evaluate('window.__filtered').splitlines())==2
 rec(ids['late']).get_by_text('Belge ve ödemeleri incele',exact=False).click();pg.wait_for_url('**#/alislar/'+ids['late']);pg.wait_for_selector('[data-cancel-bill]')
 assert '750,15' in pg.locator('#screen').text_content()
 assert snapshot()==before
 print('PASS all-page CSV and intersecting search/bucket scope agree with exact source debt/remaining amount; source navigation makes no payments',flush=True)
 pg.goto(U);pg.wait_for_selector('[data-badv]');pg.click('[data-badv]');pg.wait_for_selector('[data-business-priorities]');expand_priorities()
 priority=pg.locator('[data-priority="payable:'+ids['late']+'"]');assert '750,15 ₺' in priority.text_content() and 'açık çek/senet' in priority.text_content()
 assert priority.locator('[data-priority-source]').get_attribute('data-go')=='#/alislar/'+ids['late']
 assert pg.locator('[data-priority="payable:legacy-no-due"]').count()==0
 pg.goto(U+'index.html#/akilli-asistan');pg.wait_for_selector('[data-msg]');pg.fill('[data-msg]','Kime ödeme yapacağım?');pg.click('[data-ask]');pg.wait_for_selector('[data-answer]')
 answer=pg.locator('[data-answer]').text_content();assert '750,15 ₺' in answer and '136,30 ₺' in answer and 'Vade / kayıt kontrolü: 2 belge' in answer
 assert pg.locator('[data-go="#/odeme-takibi"]').count()>0 and not calls,calls
 assert snapshot()==before
 print('PASS home priorities and actual local assistant agree on remaining debt, recorded dates and cheque caution without Gemini despite TEST key; no business writes',flush=True)
 # An explicit source payment is the only business mutation; refreshing clears the settled obligation.
 pg.evaluate("""async id=>{const E=await import('./js/enterprise-db.js'),C=await import('./js/core.js');await E.paySupplier({payable_id:id,date:C.todayStr(),amount:750.15,method:'Nakit'})}""",ids['late'])
 paid=snapshot();agenda();assert rec(ids['late']).count()==0 and '0,00 ₺' in pg.locator('[data-payment-bucket=overdue]').text_content()
 # Refresh existing UI after another local screen changes a different bill.
 pg.evaluate("""async id=>{const E=await import('./js/enterprise-db.js'),C=await import('./js/core.js');await E.paySupplier({payable_id:id,date:C.todayStr(),amount:50.55,method:'Nakit'})}""",ids['soon'])
 paid=snapshot();pg.click('[data-payment-refresh]');pg.wait_for_function("()=>document.querySelector('[data-payment-bucket=soon]')?.textContent.includes('0,00 ₺')")
 assert '0,00 ₺' in pg.locator('[data-payment-bucket=soon]').text_content()
 c.set_offline(True);pg.reload();pg.wait_for_selector('[data-payment-list]');assert rec(ids['late']).count()==0 and rec(ids['soon']).count()==0;c.set_offline(False)
 assert snapshot()==paid
 print('PASS real source payments clear the relevant agenda rows after fresh read/refresh; real SW offline reload preserves data with no extra financial writes',flush=True)
 # Read errors must not yield fabricated zero debts, in both the screen and assistant.
 fault="""()=>{window.__tx=IDBDatabase.prototype.transaction;IDBDatabase.prototype.transaction=function(stores,mode,...rest){if(mode==='readonly'&&(Array.from(typeof stores==='string'?[stores]:stores).includes('payables')))throw Error('TEST read unavailable');return window.__tx.call(this,stores,mode,...rest)}}"""
 pg.evaluate(fault);pg.click('[data-payment-refresh]');pg.get_by_text('Ödeme kayıtları okunamadı;',exact=False).wait_for();assert pg.locator('[data-payment-bucket]').count()==0
 pg.evaluate("()=>{IDBDatabase.prototype.transaction=window.__tx}");pg.click('[data-payment-retry]');pg.wait_for_selector('[data-payment-list]')
 # Inject a read failure into a fully mounted assistant, not its async initialization.
 pg.goto(U+'index.html#/akilli-asistan');pg.wait_for_selector('#screen[data-view-ready="1"] [data-msg]');pg.evaluate(fault);pg.fill('[data-msg]','Ödemelerim');pg.click('[data-ask]');pg.locator('[data-out]').get_by_text('Kayıtlar okunamadı; öneri hazırlanmadı.',exact=False).wait_for();assert pg.locator('[data-answer]').count()==0
 pg.evaluate("()=>{IDBDatabase.prototype.transaction=window.__tx}");pg.click('[data-ask]');pg.wait_for_selector('[data-answer]')
 assert snapshot()==paid and not errors and not calls,(errors,calls)
 print('PASS failed reads hide totals in agenda/assistant and retry succeeds; no uncaught browser errors or external AI requests',flush=True)
 c.close();b.close()
