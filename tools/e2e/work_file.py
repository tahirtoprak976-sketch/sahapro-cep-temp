"""DILIM2: exact work-file relations in real browser; read-only screen."""
import argparse,json,os
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser(description=__doc__);p.add_argument('url',nargs='?',default='http://localhost:8841/');p.add_argument('--artifacts',default='/tmp/solo-work-file');a=p.parse_args()
BASE=a.url.rstrip('/')+'/';O=urlparse(BASE);assert O.scheme=='http' and O.hostname in ('localhost','127.0.0.1','::1')
assert not O.username and not O.password and not O.query and not O.fragment
out=Path(a.artifacts);out.mkdir(parents=True,exist_ok=True);errors=[];external=[]
SNAP="""async()=>{const db=await import('./js/db.js');return JSON.stringify({data:await db.dumpAll(),audit:await db.getAll('audit_log'),drafts:await db.getAll('drafts')});}"""
with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),args=['--no-sandbox'])
    ctx=browser.new_context(viewport={'width':390,'height':850},service_workers='block');ctx.add_init_script("localStorage.setItem('sp_role','boss')")
    def route(req):
        u=urlparse(req.request.url)
        if (u.scheme,u.hostname,u.port)==(O.scheme,O.hostname,O.port):req.continue_()
        else:external.append(req.request.url);req.abort()
    ctx.route('**/*',route);page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
    name='work_file_fixture'
    page.goto(BASE+'README.md?db='+name)
    page.evaluate('''async()=>{
      const db=await import('./js/db.js'),date='2026-10-27';
      await db.put('customers',{id:'PARENT',name:'TEST Parent'});await db.put('customers',{id:'C',name:'TEST Child',parent_customer_id:'PARENT'});
      await db.put('sites',{id:'S',name:'TEST Site',customer_id:'C'});await db.put('vehicles',{id:'V',name:'TEST Truck',type:'Kamyon',load_ton:20});await db.put('personnel',{id:'P',name:'TEST Driver',daily_wage:100});await db.put('dump_sites',{id:'D',name:'TEST Dump',fee:100,fee_unit:'Sefer',fee_effective_from:date});
      await db.put('work_records',{id:'W',date,customer_id:'C',site_id:'S',vehicle_id:'V',personnel_id:'P',driver_entry_id:'DRV',work_type:'Hafriyat Nakliye',unit:'Sefer',quantity:1,dump_site_id:'D',slip_id:'DELETED',price_snapshot:{unit_price:1000,amount:1000,kdv_rate:0,kdv_included:false}});
      await db.put('slips',{id:'OTHER',slip_no:1,status:'Taslak'});
      await db.put('dump_entries',{id:'R',kind:'RECEIPT',date,dump_site_id:'D',work_record_id:'W',customer_id:'C',vehicle_id:'V',trips:1,amount:100,payer:'company_account'});
      await db.put('expense_records',{id:'GENERAL',date,vehicle_id:'V',category:'Genel',amount:50});await db.put('expense_records',{id:'DIRECT',date,vehicle_id:'V',work_record_id:'W',category:'Doğrudan',amount:25});
      await db.put('cost_allocations',{id:'ALLOC',status:'Aktif',source_store:'expense_records',source_id:'DIRECT',source_snapshot:{gross:25},targets:[{customer_id:'C',site_id:'S',vehicle_id:'V',gross:25}]});
      await db.put('hakedis',{id:'H',status:'Kesinleşti',customer_id:'C',hakedis_no:7,items:[{work_record_id:'W',amount:1000}]});
      await db.put('cash_records',{id:'DIRECT-CASH',date,customer_id:'C',driver_entry_id:'DRV',cash_type:'Müşteriden Para Alındı',amount:200,cash_status:'PERSONELDE'});
      await db.put('cash_records',{id:'GENERAL-CASH',date,customer_id:'C',cash_type:'Müşteriden Para Alındı',amount:300,cash_status:'KASADA'});
      const file=new File(['%PDF-1.4\\nstartxref\\n0\\n%%EOF'],'safe.pdf',{type:'application/pdf'});await db.addAttachment('work','W',file,{kind:'scan_original'});
    }''')
    page.goto(BASE+'index.html?db='+name+'#/isler/W');page.wait_for_selector('[data-work-file]')
    before=page.evaluate(SNAP)
    parties=page.locator('[data-work-file-parties]').inner_text()
    assert 'TEST Child' in parties and 'TEST Parent' in parties and 'borç buraya aktarılmaz' in parties,parties
    costs=page.locator('[data-work-file-costs]').inner_text()
    assert 'Doğrudan' in costs,costs
    page.locator('[data-work-general-costs] summary').click()
    costs=page.locator('[data-work-file-costs]').inner_text()
    assert 'Genel' in costs and 'kesin iş bağı değil' in costs,costs
    payments=page.locator('[data-work-file-payments]').inner_text()
    assert '200,00' in payments and '300,00' in payments and 'bu işe dağıtılmadı' in payments,payments
    assert 'Bu işe bağlı tahsilat kaydı var' in page.locator('[data-work-file-status]').inner_text()
    assert 'slip_id' in page.locator('[data-work-file-issues]').inner_text()
    assert page.locator('[data-cost-allocation="ALLOC"]').count()==1
    page.screenshot(path=str(out/'work-file-390.png'),full_page=True)
    page.locator('a[href="#/hakedis/H"]').first.click();page.wait_for_function("()=>location.hash==='#/hakedis/H'")
    page.go_back();page.wait_for_selector('[data-work-file]')
    page.locator('a[href="#/kasa/DIRECT-CASH"]').first.click();page.wait_for_function("()=>location.hash==='#/kasa/DIRECT-CASH'")
    page.go_back();page.wait_for_selector('[data-work-file]')
    after=page.evaluate(SNAP)
    if after!=before:
        b=json.loads(before);a2=json.loads(after)
        for section in ('data','audit','drafts'):
            if b[section]!=a2[section]:
                if section=='data':
                    changed=[k for k in b[section] if b[section][k]!=a2[section].get(k)]
                    print('CHANGED STORES',changed,flush=True)
                    for k in changed: print('STORE',k,'BEFORE',b[section][k],'AFTER',a2[section].get(k),flush=True)
                else: print('CHANGED',section,'BEFORE',b[section],'AFTER',a2[section],flush=True)
    assert after==before,'screen open must not mutate records/audit/drafts'
    assert not errors and not external,{'errors':errors,'external':external}
    result={'local_synthetic_only':True,'exact_source_links_opened':['hakedis/H','kasa/DIRECT-CASH'],'general_cost_separate':True,'general_payment_unallocated':True,'deleted_source_visible':True,'records_unchanged':True,'page_errors':errors}
    (out/'result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(json.dumps(result,ensure_ascii=False,indent=2),flush=True)
    ctx.close();browser.close()
