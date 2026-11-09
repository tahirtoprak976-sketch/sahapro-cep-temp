"""Optional claim VAT, read-only unpriced PDF and safe bank round trip. TEST only."""
import argparse,json,uuid,io
from pathlib import Path
from urllib.parse import urlparse
from pypdf import PdfReader
from playwright.sync_api import sync_playwright
ap=argparse.ArgumentParser();ap.add_argument('url',nargs='?',default='http://localhost:8842/');args=ap.parse_args();base=args.url.rstrip('/')+'/';assert urlparse(base).hostname in ('localhost','127.0.0.1')
out=Path('/tmp/solo-vat105');out.mkdir(exist_ok=True)
with sync_playwright() as w:
 b=w.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 for included,with_vat in [(False,False),(False,True),(True,False),(True,True)]:
  c=b.new_context(viewport={'width':360,'height':850},accept_downloads=True);c.add_init_script("localStorage.setItem('sp_role','boss')");p=c.new_page();errors=[];external=[];p.on('pageerror',lambda e:errors.append(str(e)))
  def route(r):
   if urlparse(r.request.url).hostname in ('localhost','127.0.0.1'):r.continue_()
   else:external.append(r.request.url);r.abort()
  c.route('**/*',route);app=base+'index.html?db=TEST_vat105_'+uuid.uuid4().hex;p.goto(app+'#/daha');p.wait_for_selector('#screen[data-view-ready="1"]')
  ids=p.evaluate('''async included=>{const db=await import('./js/db.js'),C=await import('./js/core.js'),date=C.todayStr();const c=await db.saveNew('customers',{name:'TEST Çığ Şantiye'},'TEST'),v=await db.saveNew('vehicles',{name:'TEST Araç'},'TEST');const price=included?1200:4500,q=included?3:6;const work=await db.saveNew('work_records',{date,customer_id:c.id,vehicle_id:v.id,work_type:'Makine Çalışması',quantity:q,unit:'Saat',price_snapshot:{unit_price:price,amount:price*q,kdv_rate:20,kdv_included:included}},'TEST');await db.saveNew('cari_movements',{date,customer_id:c.id,type:'Tahsilat',amount:included?-1000:-20000},'TEST');return {c:c.id,w:work.id,date,source:work.price_snapshot};}''',included)
  principal=3000 if included else 27000;paid=1000 if included else 20000;tax=principal*.2 if with_vat else 0
  def snap():return p.evaluate("async()=>await(await import('./js/db.js')).dumpAll()")
  def bal():return p.evaluate("async id=>(await import('./js/collect-core.js')).customerBalances(await(await import('./js/db.js')).dumpAll()).bal[id]",ids['c'])
  assert bal()==principal-paid
  p.goto(app+'#/hakedis/new');p.wait_for_selector('[data-fetch]');p.select_option('[name=customer_id]',ids['c']);p.click('[data-fetch]');p.wait_for_selector('[data-chk]');assert not p.locator('[data-claim-vat]').is_checked()
  if with_vat:p.check('[data-claim-vat]')
  p.check('[data-chk]');assert p.locator('[data-create]').is_enabled();before=snap()
  with p.expect_download() as dl:p.click('[data-unpriced]')
  path=out/('unpriced-'+str(included)+'.pdf');dl.value.save_as(path);doc=PdfReader(path);text=' '.join(page.extract_text() for page in doc.pages)
  assert 'Mutabakat' in text and 'Çığ Şantiye' in text and 'Araç' in text
  assert not any(token in text for token in ['27.000','4.500','32.400','5.400','3.600','1.200','20.000']),text
  assert snap()==before,'Unpriced export must not create a priced zero claim or any other record'
  p.click('[data-create]');p.wait_for_selector('.sheet');assert p.locator('[data-claim-vat]').is_disabled();p.locator('.sheet [data-x="1"]').click();p.wait_for_selector('[data-final]')
  draft=snap();h=draft['hakedis'][0];assert [h['subtotal'],h['kdv_total'],h['grand_total']]==[principal,tax,principal+tax],h
  assert h['items'][0]['source_price_snapshot']==ids['source'];assert bal()==principal-paid
  p.click('[data-final]');p.wait_for_selector('.sheet');assert ('KDV '+('5.400' if tax==5400 else '600' if tax==600 else '0')) in p.locator('.sheet').inner_text();p.locator('.sheet [data-x="1"]').click()
  p.wait_for_function("()=>!document.querySelector('[data-final]')");assert bal()==principal+tax-paid
  saved=snap();assert len(saved['hakedis'])==1 and len([m for m in saved['cari_movements'] if m['type']=='Hakedis'])==1
  with p.expect_download() as dl:p.click('[data-pdf]')
  path=out/('priced-'+str(included)+'-'+str(with_vat)+'.pdf');dl.value.save_as(path);doc=PdfReader(path);text=' '.join(page.extract_text() for page in doc.pages)
  assert len(doc.pages)==1 and path.stat().st_size<1000000,'Simple claim must be a readable lightweight single page'
  assert 'KDV hariç' in text and 'Genel toplam' in text and 'Çığ Şantiye' in text and 'Müşteri güncel cari bakiyesi' in text
  spec=p.evaluate("async id=>{const d=await(await import('./js/db.js')).dumpAll(),R=await import('./js/customer-report.js');const r=R.customerReportData(d,id);return {account:r.account,statement:r.statement,spec:R.customerReportSpec(r)};}",ids['c'])
  assert spec['account']['vat']==tax and spec['statement']['closing']==principal+tax-paid
  assert snap()==saved and not errors and not external,(errors,external)
  assert p.evaluate('document.documentElement.scrollWidth<=innerWidth');print('PASS VAT',included,with_vat,'PDF bytes',path.stat().st_size,flush=True);c.close()
 # Unknown VAT never defaults to 20; explicit rate and cent/basis review.
 c=b.new_context(viewport={'width':360,'height':850});c.add_init_script("localStorage.setItem('sp_role','boss')");p=c.new_page();app=base+'index.html?db=TEST_rate105_'+uuid.uuid4().hex;p.goto(app+'#/daha');p.wait_for_selector('#screen[data-view-ready="1"]')
 ids=p.evaluate("""async()=>{const db=await import('./js/db.js'),C=await import('./js/core.js'),date=C.todayStr(),c=await db.saveNew('customers',{name:'TEST Rate'},'TEST'),v=await db.saveNew('vehicles',{name:'TEST Vehicle'},'TEST');for(const [id,price,rate,inc]of [['TEST_UNKNOWN',100,null,false],['TEST_CENT',100,20,true],['TEST_BASIS',100,20,null]])await db.put('work_records',{id,date,customer_id:c.id,vehicle_id:v.id,work_batch_id:'TEST_HOURS',work_type:'TEST İş',quantity:3,unit:'Saat',price_snapshot:{unit_price:price,amount:price*3,kdv_rate:rate,kdv_included:inc}});return {c:c.id,date};}""")
 p.goto(app+'#/hakedis/new');p.wait_for_selector('[data-fetch]');p.select_option('[name=customer_id]',ids['c']);p.click('[data-fetch]');p.wait_for_selector('[data-chk]');p.check('[data-claim-vat]');p.check('[data-chk="TEST_UNKNOWN"]');assert p.locator('[data-create]').is_disabled() and p.locator('[data-rate="TEST_UNKNOWN"]').input_value()==''
 p.fill('[data-rate="TEST_UNKNOWN"]','20');assert p.locator('[data-create]').is_enabled();p.uncheck('[data-chk="TEST_UNKNOWN"]');p.uncheck('[data-claim-vat]');p.check('[data-chk="TEST_CENT"]');assert p.locator('[data-create]').is_disabled() and 'kuruşa' in p.locator('[data-hakedis-row-error="TEST_CENT"]').inner_text();p.uncheck('[data-chk="TEST_CENT"]');p.check('[data-chk="TEST_BASIS"]');assert p.locator('[data-create]').is_disabled() and 'temeli kayıtlı değil' in p.locator('[data-hakedis-row-error="TEST_BASIS"]').inner_text()
 data=p.evaluate("async()=>await(await import('./js/db.js')).dumpAll()");assert not data['hakedis'] and not data['cari_movements'];print('PASS explicit missing rate, cent and unknown basis require review with no write',flush=True);p.goto(app+'#/fisler/new?work=TEST_UNKNOWN&batch=1');p.wait_for_selector('[data-save]');assert 'Toplam 9 saat' in p.locator('#screen').inner_text() and 'Toplam 9 sefer' not in p.locator('#screen').inner_text();assert p.evaluate("async()=>await(await import('./js/db.js')).dumpAll()")==data,'Hour batch preview cannot write source jobs';print('PASS linked hour batch labels its actual unit',flush=True);c.close()
 # A new bank account is created only through its existing screen. Cash values
 # survive navigation; opening-date and custody validation remain in DB code.
 c=b.new_context(viewport={'width':360,'height':850});c.add_init_script("localStorage.setItem('sp_role','boss')");p=c.new_page();app=base+'index.html?db=TEST_bank105_'+uuid.uuid4().hex;p.goto(app+'#/finans/kasa/new');p.wait_for_selector('[name=amount]');p.fill('[name=amount]','1234');p.fill('[name=description]','TEST draft note');p.select_option('[name=payment_method]','Havale');p.click('[data-new-bank]');p.wait_for_selector('[name=opening_date]');assert 'eski tarihli' in p.locator('#screen').inner_text();p.fill('[name=name]','TEST Banka');p.fill('[name=opening_date]','2026-01-01');p.click('[data-e-save]');p.wait_for_selector('[data-new-bank]');assert p.locator('[name=amount]').input_value()=='1234' and p.locator('[name=description]').input_value()=='TEST draft note' and p.locator('[name=bank_account_id]').input_value()
 p.click('[data-save]');p.wait_for_selector('.toast.err');assert p.locator('#toast-root').bounding_box()['y']+p.locator('#toast-root').bounding_box()['height']<=p.locator('[data-save]').bounding_box()['y'],'Error toast must stay above Save';data=p.evaluate("async()=>await(await import('./js/db.js')).dumpAll()");assert len(data['bank_accounts'])==1 and not data['cash_records'] and not data['cari_movements'];print('PASS bank round trip preserves unsaved cash values, toast clears Save, no cash write',flush=True);c.close();b.close()
