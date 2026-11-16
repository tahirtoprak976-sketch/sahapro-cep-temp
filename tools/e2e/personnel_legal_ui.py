"""Synthetic mobile HR entry, controlled calendar, PDF and original archive UI."""
import sys,json,uuid,base64,os
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright
from pypdf import PdfReader
from io import BytesIO
base=(sys.argv[1] if len(sys.argv)>1 else 'http://localhost:8857/').rstrip('/')+'/'
assert urlparse(base).hostname in ('localhost','127.0.0.1')
out=Path(os.environ.get('SAHAPRO_LEGAL_OUT','/tmp/personnel-legal-ui'));out.mkdir(exist_ok=True,parents=True)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);c=b.new_context(viewport={'width':360,'height':800},service_workers='allow')
 c.add_init_script("localStorage.setItem('sp_role','boss')")
 page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));token='TEST_lui_'+uuid.uuid4().hex[:8]
 page.goto(base+'robots.txt?db='+token)
 pid=page.evaluate("""async()=>{const d=await import('./js/db.js');return (await d.saveNew('personnel',{name:'TEST Mobil Çalışan',start_date:'2025-01-01',birth_date:'1990-01-01'},'TEST')).id}""")
 page.goto(base+'index.html?db='+token+'#/izin-puantaj?pid='+pid+'&tab=ayar');page.wait_for_selector('[data-profile]')
 page.fill('[data-asof]','2026-08-31');page.fill('[data-yearkey]','2026-01-01');page.fill('[data-days]','14');page.check('[data-confirm]');page.click('[data-profile]')
 page.wait_for_function("""async()=>{const d=await import('./js/db.js');return !!(await d.getAll('personnel'))[0].izinHesapAcilisi}""")
 page.click('[data-tab=izin]');page.wait_for_selector('[data-saveleave]')
 page.select_option('[data-purpose]','actual');page.fill('[data-from]','2026-09-01');page.fill('[data-to]','2026-09-08');page.fill('[data-return]','2026-09-09');page.select_option('[data-year]','2026-01-01')
 assert '10 günlük' in page.locator('[data-preview]').inner_text()
 page.click('[data-saveleave]');page.locator('.sheet').get_by_role('button',name='Kaydet',exact=True).click()
 page.wait_for_selector('.sheet',state='detached');page.wait_for_selector('[data-legal-leave]');assert '7 gün' in page.locator('[data-legal-leave]').inner_text()
 page.click('[data-editleave]');page.fill('[data-site]','TEST Düzeltilen Şantiye');page.click('[data-saveleave]');page.locator('.sheet').get_by_role('button',name='Kaydet',exact=True).click();page.wait_for_selector('.sheet',state='detached')
 page.wait_for_function("""async()=>{const r=(await(await import('./js/db.js')).getAll('izin_kayitlari'))[0];return r.santiyeAdi==='TEST Düzeltilen Şantiye'&&r.balanceSnapshot.remaining===7}""")
 for width in (320,360,768):
  page.set_viewport_size({'width':width,'height':800});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),width
 page.set_viewport_size({'width':360,'height':800});page.screenshot(path=str(out/'mobile.png'),full_page=True)
 with page.expect_download() as dl:page.locator('[data-usepdf]').click()
 download=dl.value;download.save_as(str(out/'izin.pdf'));pdf=PdfReader(BytesIO((out/'izin.pdf').read_bytes()));assert len(pdf.pages)==1,len(pdf.pages)
 text='\n'.join(p.extract_text() for p in pdf.pages);assert 'MÜŞTERİ NÜSHASI' not in text;assert 'İÇ KULLANIM' in text;(out/'izin.txt').write_text(text)
 for expected in ('TEST Mobil Çalışan','İşçi Ad Soyad','İşveren İmza','14','7','ibraname değildir'):
  assert expected in text,expected
 # Archive the signed request, then append signed actual-use evidence without unlocking it.
 with page.expect_download() as dl:page.locator('[data-pdf]').click()
 dl.value.save_as(str(out/'talep.pdf'))
 page.set_input_files('[data-file]',str(out/'talep.pdf'));page.select_option('[data-docpurpose]','talep');page.check('[data-signed]');page.click('[data-archive]');page.wait_for_selector('[data-ackfile]')
 signed=page.evaluate("async()=>JSON.stringify((await(await import('./js/db.js')).getAll('izin_kayitlari'))[0])")
 page.set_input_files('[data-ackfile]',str(out/'izin.pdf'));page.check('[data-acksigned]');page.click('[data-ack]');page.wait_for_selector('[data-ackoriginal]')
 assert page.evaluate("async()=>JSON.stringify((await(await import('./js/db.js')).getAll('izin_kayitlari'))[0])")==signed
 for selector,path in [('[data-original]','talep.pdf'),('[data-ackoriginal]','izin.pdf')]:
  with page.expect_download() as dl:page.locator(selector).click()
  actual=Path(dl.value.path()).read_bytes();assert actual==(out/path).read_bytes(),'download changed wet original bytes'
 page.click('[data-tab=puantaj]');page.wait_for_selector('[data-saveattendance]')
 page.fill('[data-date]','2026-03-20');page.locator('[data-date]').dispatch_event('change');assert page.input_value('[data-daytype]')=='ubgt'
 page.fill('[data-date]','2026-11-15');page.locator('[data-date]').dispatch_event('change');assert page.input_value('[data-daytype]')=='hafta_tatili'
 assert not errors,errors
 print(json.dumps({'mobileWidths':[320,360,768],'ownerSetup':True,'actualWarningPreserved':True,'pdfPages':len(pdf.pages),'twoSignatures':True,'separateSignedUsageEvidence':True,'originalDownloadsExact':True,'calendarAutoDayType':True,'errors':errors}),flush=True);b.close()
