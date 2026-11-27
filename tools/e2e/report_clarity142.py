"""TEST-only statements: no correction-as-cash, neutral zero, date guards and real exports."""
import sys,uuid,json,csv,io
from pathlib import Path
from playwright.sync_api import sync_playwright
from pypdf import PdfReader
U=sys.argv[1] if len(sys.argv)>1 else 'http://localhost:8841/'
with sync_playwright() as w:
 b=w.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);c=b.new_context(viewport={'width':360,'height':800},accept_downloads=True);c.add_init_script("localStorage.setItem('sp_role','boss')");p=c.new_page();p.set_default_timeout(45000);errors=[];p.on('pageerror',lambda e:errors.append(str(e)));app=U+'index.html?db=TEST_report142_'+uuid.uuid4().hex;p.goto(app+'#/daha');p.wait_for_selector('#screen[data-view-ready="1"]')
 ids=p.evaluate("""async()=>{const d=await import('./js/db.js'),C=await import('./js/core.js'),customer=await d.saveNew('customers',{name:'TEST Report142'},'TEST'),zero=await d.saveNew('customers',{name:'TEST Unpriced142'},'TEST'),v=await d.saveNew('vehicles',{name:'TEST Machine142'},'TEST');for(const [id,date,amount] of [['TEST_B142','2026-11-01',1000],['TEST_A142','2026-11-02',-300]])await d.put('cari_movements',C.newRecord({id,customer_id:customer.id,date,type:'Duzeltme',amount,note:'TEST_PRIVATE_REASON142'}));await d.put('work_records',C.newRecord({id:'TEST_W142',customer_id:zero.id,vehicle_id:v.id,date:C.todayStr(),quantity:3,unit:'Saat',work_type:'Makine Çalışması',price_snapshot:null}));return {customer:customer.id,zero:zero.id};}""");p.wait_for_timeout(200)
 snapshot="async()=>{const s=await(await import('./js/db.js')).readSnapshot({meta:true,drafts:true,attachments:true});delete s.captured_at;return JSON.stringify(s)}";before=p.evaluate(snapshot)
 def nav(h):
  old=p.locator('#screen').element_handle();p.goto(app+h);p.wait_for_function('(e)=>!e.isConnected',arg=old);p.wait_for_selector('#screen[data-view-ready="1"]')
 nav('#/cari/'+ids['customer'])
 with p.expect_download() as dl:p.click('[data-stcsv]')
 csvtext=Path(dl.value.path()).read_text(encoding='utf-8-sig');rows=list(csv.DictReader(io.StringIO(csvtext),delimiter=';'))
 assert 'Diğer azalış' in rows[0],'REPORT_CREDIT_ROLE_MISSING'
 adjustment=next(r for r in rows if r['Tarih']=='02.11.2026');assert not adjustment['Tahsilat'];assert adjustment['Diğer azalış']=='300,00' and adjustment['Bakiye']=='700,00';assert 'TEST_PRIVATE_REASON142' not in csvtext
 result=p.evaluate("""async ids=>{const d=await(await import('./js/db.js')).dumpAll(),S=await import('./js/statement.js'),C=await import('./js/collect-core.js'),R=await import('./js/customer-report.js');return {text:S.statementText('TEST',S.customerStatement(C.customerLedgerMovements(d,ids.customer),ids.customer)),zero:S.statementText('TEST',S.customerStatement(C.customerLedgerMovements(d,ids.zero),ids.zero)),table:R.customerReportSpec(R.customerReportData(d,ids.customer,{to:'2026-11-27',today:'2026-11-27'})).sections.find(s=>s.title==='Cari Ekstre')};}""",ids)
 assert 'Toplam tahsilat: 0,00' in result['text'] and 'Diğer borç azalışları: 300,00' in result['text'];assert 'hesap kapalı' not in result['zero'] and 'Kayıtlı bakiye: 0,00' in result['zero'];assert result['table']['rows'][2][4]=='' and '300,00' in result['table']['rows'][2][5]
 with p.expect_download() as dl:
  p.evaluate("""async id=>{const R=await import('./js/customer-report.js'),d=await(await import('./js/db.js')).dumpAll(),D=await import('./js/document-engine.js');await D.exportDocument(R.customerReportSpec(R.customerReportData(d,id,{to:'2026-11-27',today:'2026-11-27'})),'download');}""",ids['customer'])
 pdf='\n'.join(page.extract_text() or '' for page in PdfReader(dl.value.path()).pages);assert 'Diğer azalış' in pdf and '700,00' in pdf and 'TEST_PRIVATE_REASON142' not in pdf
 nav('#/detayli-rapor?k=musteri&id='+ids['customer']+'&p=custom&from=2026-11-28&to=2026-11-01&a=customer')
 assert 'Başlangıç tarihi bitiş tarihinden sonra olamaz' in p.locator('#screen').inner_text();assert p.locator('[data-pdf],[data-share],[data-csv]').count()==0;assert p.input_value('[data-from]')=='2026-11-28' and p.input_value('[data-to]')=='2026-11-01'
 p.fill('[data-from]','2026-11-01');p.locator('[data-from]').press('Tab');p.wait_for_selector('#screen[data-view-ready="1"] [data-pdf]');assert p.input_value('[data-to]')=='2026-11-01'
 with p.expect_download() as dl:p.click('[data-pdf]')
 recovered='\n'.join(page.extract_text() or '' for page in PdfReader(dl.value.path()).pages);assert '01.11.2026' in recovered
 assert p.evaluate(snapshot)==before,'report source/export/navigation must preserve all records/meta/drafts/attachments'
 for width in [320,360,390,768]:
  p.set_viewport_size({'width':width,'height':800});assert p.evaluate('document.documentElement.scrollWidth<=innerWidth')
 assert not errors,errors
 print(json.dumps({'balance':700,'received':0,'otherDecrease':300,'realCsvPdf':True,'invalidPeriodBlocked':True,'validRecoveryPdf':True,'zeroNotClosure':True,'readonly':True,'errors':errors}));b.close()
