"""Shared local business-draft workflow, real Chromium/IndexedDB/SW. No real user data or AI."""
import json,sys
from playwright.sync_api import sync_playwright
U=sys.argv[1] if len(sys.argv)>1 else 'http://localhost:8841/'
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 c=b.new_context(viewport={'width':360,'height':850});c.add_init_script("localStorage.setItem('sp_role','boss')")
 pg=c.new_page();errors=[];calls=[];reply={}
 pg.on('pageerror',lambda e:errors.append(str(e)))
 def mock(r):
  calls.append(r.request.post_data);r.fulfill(status=200,content_type='application/json',body=json.dumps({'candidates':[{'content':{'parts':[{'text':json.dumps(reply)}]},'finishReason':'STOP'}]}))
 c.route('https://generativelanguage.googleapis.com/**',mock)
 pg.goto(U+'index.html#/musteriler');pg.wait_for_selector('[data-customer-directory]');pg.evaluate('async()=>await navigator.serviceWorker.ready')
 if not pg.evaluate('!!navigator.serviceWorker.controller'):pg.reload();pg.wait_for_selector('[data-customer-directory]')
 ids=pg.evaluate("""async()=>{const db=await import('./js/db.js'),C=await import('./js/core.js');const a=await db.saveNew('customers',{name:'TEST Gürçelik Sürücü Kursu'},'TEST'),z=await db.saveNew('customers',{name:'TEST Kemer Country No 53'},'TEST'),v=await db.saveNew('vehicles',{name:'TEST Manitou',plate:'34ZZ9999'},'TEST'),p=await db.saveNew('personnel',{name:'TEST Soner'},'TEST'),bank=await (await import('./js/enterprise-db.js')).saveBank({name:'TEST Banka',opening_balance:0,opening_date:C.todayStr()});await db.saveNew('fuel_tank_movements',{date:C.todayStr(),move_type:'GİRİŞ',liters:100,total:3000},'TEST');return {a:a.id,z:z.id,v:v.id,p:p.id,bank:bank.id,date:C.todayStr(),yesterday:C.addDays(C.todayStr(),-1)}}""")
 def state():return pg.evaluate("async()=>await (await import('./js/db.js')).dumpAll()")
 def send(text):
  pg.fill('[data-msg]',text);pg.click('[data-ask]');pg.wait_for_function("()=>!document.querySelector('[data-ask]').disabled")
 def save():
  pg.click('[data-save]');pg.locator('[data-out]').get_by_text('Kaydedildi:',exact=False).wait_for()
 pg.goto(U+'index.html#/akilli-asistan');pg.wait_for_function("()=>document.querySelector('[data-new-chat]')&&!document.querySelector('[data-new-chat]').disabled")
 before=state();c.set_offline(True);send('Yeni iş kaydı oluştur');pg.wait_for_selector('[data-draft-workflow]')
 assert pg.input_value('[data-kind=work] [name=date]')=='' and 'Tarih' in pg.locator('[data-draft-status]').locator('..').inner_text() and state()==before
 send('Sohbeti buradan sürdürelim');assert pg.locator('[data-kind=work]').count()==1 and 'taslağınız korunuyor' in pg.locator('[data-draft-reply]').inner_text() and state()==before
 for text in ['Dün','TEST Gürçelik Sürücü Kursu','34ZZ9999','Makine Çalışması','2 saat','birim fiyat 1.500 TL','personel TEST Soner']:send(text)
 card=pg.locator('[data-kind=work]');assert card.locator('[name=customer]').input_value()==ids['a'] and card.locator('[name=vehicle]').input_value()==ids['v'] and card.locator('[name=quantity]').input_value()=='2' and card.locator('[name=unit_price]').input_value()=='1500'
 assert card.locator('[name=date]').input_value()==ids['yesterday'] and '0 eksik' in pg.locator('[data-draft-status]').inner_text() and not card.locator('[data-pick]').is_checked() and state()==before
 send('Onayla');assert state()==before
 card.locator('[data-pick]').check();save();after=state();works=[w for w in after['work_records'] if w.get('customer_id')==ids['a']]
 assert len(works)==1 and works[0]['quantity']==2 and works[0]['unit']=='Saat' and works[0]['price_snapshot']['amount']==3000 and works[0]['personnel_id']==ids['p']
 assert len(after['cash_records'])==len(before['cash_records']) and not calls
 print('PASS offline/no-key work starter asks actual missing fields; bare date/customer/plate/type/quantity and explicit price/personnel complete one card; text approval writes nothing; actual Save writes correct work/price once',flush=True)
 send('Yeni iş kaydı oluştur')
 for text in ['Dün','TEST Kemer Country No 53','34ZZ9999','Makine Çalışması','1 saat','birim fiyat 1.000 TL']:send(text)
 pg.check('[data-kind=work] [data-pick]');save()
 assert len(state()['work_records'])==len(after['work_records'])+1 and any(w.get('customer_id')==ids['z'] and w['quantity']==1 and w['price_snapshot']['amount']==1000 for w in state()['work_records'])
 print('PASS repeated generic starter on the same day creates an independent job; its operation identity does not conflict with the first task',flush=True)
 # The same engine handles collection, expense, maintenance and fuel without interpreting sums as work prices.
 send('Tahsilat gir');baseline=state()
 for text in ['Bugün','TEST Gürçelik Sürücü Kursu','tutar 20.000 TL','ödeme şekli Havale']:send(text)
 assert 'Banka hesabı' in pg.locator('[data-draft-workflow]').inner_text()
 send('banka TEST Banka');assert state()==baseline;pg.check('[data-kind=collection] [data-pick]');save()
 assert any(x.get('customer_id')==ids['a'] and x.get('amount')==20000 and x.get('bank_account_id')==ids['bank'] for x in state()['cash_records'])
 send('Yeni gider ekle')
 for text in ['Bugün','tutar 875 TL','açıklama Yağ alındı']:send(text)
 assert pg.input_value('[data-kind=expense] [name=description]')=='Yağ alındı'
 pg.check('[data-kind=expense] [data-pick]');save();assert any(x.get('amount')==875 for x in state()['expense_records'])
 send('Yeni bakım kaydı oluştur')
 for text in ['Bugün','34ZZ9999','açıklama Hidrolik kaçak kontrolü']:send(text)
 pg.check('[data-kind=maintenance] [data-pick]');save();assert any(x.get('vehicle_id')==ids['v'] and 'Hidrolik' in x.get('description','') for x in state()['maintenance_records'])
 send('Yeni yakıt kaydı oluştur')
 for text in ['Bugün','34ZZ9999','litre 20','kaynak Depo Tankı']:send(text)
 pg.check('[data-kind=fuel] [data-pick]');save();assert any(x.get('vehicle_id')==ids['v'] and x.get('liters')==20 for x in state()['fuel_records'])
 assert not calls
 print('PASS same offline engine completes real collection with required bank, expense description, maintenance and depot fuel; independent Save on each keeps roles distinct; zero model calls',flush=True)
 # Model-created multi-card draft is completed locally; choosing a target affects only that card.
 c.set_offline(False)
 pg.evaluate("""async()=>{const db=await import('./js/db.js');for(const [k,v] of Object.entries({gemini_key:'TEST',gemini_model:'gemini-2.5-flash',gemini_consent:true,gemini_daily_limit:100}))await db.metaSet(k,v)}""")
 pg.reload();pg.wait_for_function("()=>document.querySelector('[data-new-chat]')&&!document.querySelector('[data-new-chat]').disabled")
 reply={'works':[{'date':ids['date'],'customer_id':ids['a'],'vehicle_id':ids['v'],'work_type':'Makine Çalışması','unit':'Saat','quantity':1},{'date':ids['date'],'customer_id':ids['z'],'vehicle_id':ids['v'],'work_type':'Makine Çalışması','unit':'Saat','quantity':2}],'collections':[{'date':ids['date'],'customer_id':ids['z'],'amount':5000,'method':'Nakit'}]}
 send('TEST Gürçelik Sürücü Kursu TEST Manitou 1 saat çalıştı. TEST Kemer Country No 53 TEST Manitou 2 saat çalıştı, 5000 TL ödedi.');pg.wait_for_selector('[data-kind=work][data-i="1"]');assert len(calls)==1
 multi=state();c.set_offline(True);send('3 sefer');assert pg.locator('[data-draft-choice]').count()==2 and pg.input_value('[data-kind=work][data-i="0"] [name=quantity]')=='1' and state()==multi
 pg.locator('[data-draft-choice]').nth(1).click();pg.wait_for_function("()=>document.querySelector('[data-kind=work][data-i=\"1\"] [name=quantity]').value==='3'")
 assert pg.input_value('[data-kind=work][data-i="0"] [name=quantity]')=='1' and pg.input_value('[data-kind=collection] [name=amount]')=='5000'
 send('ikinci iş 4 saat');assert pg.input_value('[data-kind=work][data-i="1"] [name=quantity]')=='4'
 send('tahsilat tutarı 6.000 TL');assert pg.input_value('[data-kind=collection] [name=amount]')=='6000' and state()==multi and len(calls)==1
 send('tarih 31.02.2026');assert state()==multi and pg.input_value('[data-kind=work][data-i="0"] [name=date]')==ids['date']
 print('PASS model-created 2 works + collection completed offline; ambiguous quantity asks target, ordinal changes only second work; cash stays separate; invalid date writes nothing and never calls model',flush=True)
 # Selected-card preflight checks all cards before the first write, using current DB references.
 pg.check('[data-kind=work][data-i="0"] [data-pick]');pg.check('[data-kind=collection] [data-pick]');pg.fill('[data-kind=collection] [name=date]','');pg.click('[data-save]');pg.locator('.toast').get_by_text('Tarih alanını tamamlayın.',exact=False).wait_for();assert state()==multi
 pg.fill('[data-kind=collection] [name=date]',ids['date']);pg.evaluate("async id=>{const db=await import('./js/db.js');await db.softDelete('customers',id,'TEST deleted in another tab')}",ids['a']);deleted=state()
 pg.click('[data-save]');pg.locator('.toast').get_by_text('artık kullanılamıyor',exact=False).wait_for();assert state()==deleted
 for width in [320,360,768]:pg.set_viewport_size({'width':width,'height':850});assert pg.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),width
 c.set_offline(False);send('Ödemelerim');assert pg.locator('[data-answer]').count()==1 and not pg.locator('[data-draft-workflow]').count() and state()==deleted and len(calls)==1
 assert not errors,errors
 print('PASS whole selected batch preflight rejects missing date/deleted customer before any write; 320/360/768px fit; independent local command replaces draft; zero uncaught errors',flush=True)
 c.close();b.close()
