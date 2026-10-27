"""Unknown monetary costs remain unknown across real result screens/PDF/CSV.

Local synthetic IndexedDB only; no provider calls or external network.
"""
import argparse
import json
import os
import re
import uuid
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('url',nargs='?',default='http://localhost:8841/')
parser.add_argument('--artifacts',default='/tmp/solo-financial-result-completeness')
args=parser.parse_args()
BASE=args.url.rstrip('/')+'/'
ORIGIN=urlparse(BASE)
assert ORIGIN.scheme=='http' and ORIGIN.hostname in ('localhost','127.0.0.1','::1')
assert not ORIGIN.username and not ORIGIN.password and not ORIGIN.query and not ORIGIN.fragment
out=Path(args.artifacts);out.mkdir(parents=True,exist_ok=True)

def pdf_text(data):
    assert data.startswith(b'%PDF-') and len(data)>1000
    chunks=re.findall(rb'<([0-9a-fA-F]+)>\s*Tj',data)
    assert chunks,'Real PDF text operators required'
    return ' '.join(bytes.fromhex(x.decode()).decode('utf-16-be') for x in chunks)

SNAPSHOT='''async()=>{const d=await import('./js/db.js');return JSON.stringify({data:await d.dumpAll(),audit:await d.getAll('audit_log'),attachments:await d.getAll('attachments'),drafts:await d.getAll('drafts')});}'''
with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),args=['--no-sandbox'])
    ctx=browser.new_context(viewport={'width':390,'height':850},service_workers='block',accept_downloads=True)
    ctx.add_init_script("localStorage.setItem('sp_role','boss')")
    external=[];errors=[]
    def route(request):
        p=urlparse(request.request.url)
        if (p.scheme,p.hostname,p.port)==(ORIGIN.scheme,ORIGIN.hostname,ORIGIN.port):request.continue_()
        else:external.append(request.request.url);request.abort()
    ctx.route('**/*',route)
    page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
    name='financial_unknown_'+uuid.uuid4().hex[:16]
    page.goto(BASE+'index.html?db='+name+'#/daha')
    page.wait_for_selector('#screen[data-view-ready="1"]')
    page.goto(BASE+'README.md?db='+name)
    page.evaluate('''async()=>{
      const d=await import('./js/db.js'),C=await import('./js/core.js'),date=C.todayStr();
      const c=await d.saveNew('customers',{name:'TEST Cost Result Customer'},'TEST');
      const v=await d.saveNew('vehicles',{name:'TEST Cost Result Truck',type:'Kamyon',load_ton:20},'TEST');
      const dump=await d.saveNew('dump_sites',{name:'TEST Cost Result Dump',fee:100,fee_unit:'Ton',fee_effective_from:date},'TEST');
      // Historical fixture: absence of an old estimate must not be backfilled.
      await d.put('work_records',{id:C.uuid(),date,customer_id:c.id,vehicle_id:v.id,dump_site_id:dump.id,quantity:3,unit:'Sefer',work_type:'Hafriyat Nakliye',price_snapshot:{unit_price:5000,amount:15000,kdv_rate:0,kdv_included:false},description:'TEST preserved cost source'});
      await d.put('fuel_records',{id:C.uuid(),date,vehicle_id:v.id,liters:60,total:3000,unit_price:50,fuel_source:'Akaryakıt İstasyonu'});
    }''')
    before=page.evaluate(SNAPSHOT);results=[]
    cases=[('result','#/sonuc','[data-s-pdf]','[data-s-csv]'),
           ('cost','#/maliyet','[data-e-pdf]','[data-e-csv]'),
           ('management','#/raporlar?store=management','[data-pro-pdf]','[data-pro-csv]')]
    for label,route_name,pdf_button,csv_button in cases:
        page.goto(BASE+'index.html?db='+name+route_name)
        page.wait_for_selector('#screen[data-view-ready="1"]')
        text=page.locator('#screen').inner_text()
        assert 'Ekran yüklenirken hata' not in text,text
        assert 'Hesaplanamadı — döküm maliyeti eksik' in text,text
        assert 'sonuç hesaplanamadı' in text,text
        with page.expect_download() as event:page.locator(pdf_button).click()
        pdf=event.value;data=Path(pdf.path()).read_bytes();(out/(label+'.pdf')).write_bytes(data)
        extracted=pdf_text(data)
        assert 'Hesaplanamadı — döküm maliyeti eksik' in extracted,extracted
        assert 'sonuç hesaplanamadı' in extracted,extracted
        with page.expect_download() as event:page.locator(csv_button).click()
        csv=Path(event.value.path()).read_bytes().decode('utf-8-sig')
        (out/(label+'.csv')).write_text(csv)
        assert 'doğrulanmadı' in csv and 'sonuç hesaplanamadı' in csv,csv
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
        assert page.evaluate(SNAPSHOT)==before,'Report/export must not mutate records, audit or drafts'
        results.append({'view':label,'unknown_result_label':True,'pdf_unknown_preserved':True,'csv_warning_preserved':True,'records_unchanged':True})
    assert not external and not errors,{'external':external,'page_errors':errors}
    (out/'result.json').write_text(json.dumps({'local_synthetic_only':True,'results':results,'external_requests':external,'page_errors':errors},ensure_ascii=False,indent=2)+'\n')
    print('PASS financial result completeness: real result/cost/management UI, three PDF/CSV exports, source/audit preservation',flush=True)
    ctx.close();browser.close()
