"""DILIM5: real quote chain and customer TL/L source links."""
import argparse,json,os
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser(description=__doc__);p.add_argument('url',nargs='?',default='http://localhost:8841/');p.add_argument('--artifacts',default='/tmp/solo-deal-chain');a=p.parse_args()
BASE=a.url.rstrip('/')+'/';O=urlparse(BASE);assert O.scheme=='http' and O.hostname in ('localhost','127.0.0.1','::1')
assert not O.username and not O.password and not O.query and not O.fragment
out=Path(a.artifacts);out.mkdir(parents=True,exist_ok=True);errors=[];external=[]
with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),args=['--no-sandbox'])
    ctx=browser.new_context(viewport={'width':390,'height':850},service_workers='block');ctx.add_init_script("localStorage.setItem('sp_role','boss')")
    def route(req):
        u=urlparse(req.request.url)
        if (u.scheme,u.hostname,u.port)==(O.scheme,O.hostname,O.port):req.continue_()
        else:external.append(req.request.url);req.abort()
    ctx.route('**/*',route);page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
    name='deal_chain_e2e';page.goto(BASE+'README.md?db='+name)
    ids=page.evaluate('''async()=>{const db=await import('./js/db.js'),B=await import('./js/business.js'),S=await import('./js/solo-db.js');
      const c=await db.saveNew('customers',{name:'TEST Chain Customer'},'TEST'),site=await db.saveNew('sites',{name:'TEST Chain Site',customer_id:c.id},'TEST'),v=await db.saveNew('vehicles',{name:'TEST Chain Truck',type:'Kamyon'},'TEST'),person=await db.saveNew('personnel',{name:'TEST Chain Driver'},'TEST');
      const quote=await db.saveNew('quotes',{quote_no:4,date:'2026-10-20',customer_id:c.id,site_id:site.id,status:'Kabul',type:'UNIT_PRICE',input:{quantity:2,unit:'Sefer',fuel_l:10,fuel_price:50,extra:25,margin:20}},'TEST');
      const contract=B.contractFromQuote(quote,await db.nextSeq('contract'));await db.put('contracts',contract);
      const plan=await S.saveShift({quote_id:quote.id,date:'2026-10-21',customer_id:c.id,site_id:site.id,vehicle_id:v.id,personnel_id:person.id,task:'TEST chain plan',start:'08:00',end:'10:00',break_minutes:0},'TEST-chain-plan');
      const work=await db.saveNew('work_records',{quote_id:quote.id,date:'2026-10-21',customer_id:c.id,site_id:site.id,vehicle_id:v.id,personnel_id:person.id,work_type:'Hafriyat Nakliye',unit:'Sefer',quantity:1,customer_fuel_allowance_l:75,price_snapshot:{unit_price:1000,amount:1000,kdv_rate:0,kdv_included:false}},'TEST');
      await db.saveNew('work_records',{date:'2026-10-19',customer_id:c.id,site_id:site.id,vehicle_id:v.id,work_type:'Hafriyat Nakliye',unit:'Sefer',quantity:1},'TEST');
      await db.put('hakedis',{id:'H',status:'Kesinleşti',customer_id:c.id,hakedis_no:8,items:[{work_record_id:work.id,amount:1000}]});
      await db.put('cash_records',{id:'PAY',date:'2026-10-22',customer_id:c.id,cash_type:'Müşteriden Para Alındı',ref_id:work.id,amount:500,cash_status:'KASADA'});
      await db.put('cash_records',{id:'GENERAL',date:'2026-10-22',customer_id:c.id,cash_type:'Müşteriden Para Alındı',amount:900,cash_status:'KASADA'});
      await db.saveNew('fuel_records',{date:'2026-10-22',customer_id:c.id,vehicle_id:v.id,liters:300,total:0,fuel_source:'Müşteri Verdi'},'TEST');
      return {customer:c.id,site:site.id,vehicle:v.id,person:person.id,quote:quote.id,contract:contract.id,plan:plan.id,work:work.id};
    }''')
    page.goto(BASE+'index.html?db='+name+'#/teklif/'+ids['quote']);page.wait_for_selector('[data-deal-chain]')
    text=page.locator('[data-deal-chain]').inner_text()
    assert '1 gerçekleşen iş' in text and 'Bağlı tahsilat var' in text and '1 sözleşme' in text,text
    page.locator('[data-quote-scenario] summary').click()
    text=page.locator('[data-deal-chain]').inner_text()
    assert '10 L × 50 ₺' in text and 'Teklif maliyet senaryosu' in text,text
    page.screenshot(path=str(out/'deal-chain-390.png'),full_page=True)
    page.locator('[data-chain-stage="work"] a').click();page.wait_for_function("()=>location.hash==='#/isler/"+ids['work']+"'")
    page.go_back();page.wait_for_selector('[data-deal-chain]')

    page.goto(BASE+'index.html?db='+name+'#/musteriler/'+ids['customer']);page.wait_for_selector('[data-customer-chart="fuel"]')
    assert page.locator('[data-customer-chart="money"]').count()==1
    href=page.locator('[data-customer-chart="fuel"] a.btn').get_attribute('href')
    assert 'customer_id='+ids['customer'] in href and 'from=' in href and 'to=' in href
    page.locator('[data-customer-chart="money"] a.btn').click();page.wait_for_function("()=>location.hash.startsWith('#/isler?customer_id=')")
    assert 'from=' in page.evaluate('location.hash') and 'to=' in page.evaluate('location.hash')
    assert not errors and not external,{'errors':errors,'external':external}
    result={'local_synthetic_only':True,'quote_contract_plan_work_claim_payment_chain':True,'older_work_excluded':True,'general_payment_unallocated':True,'scenario_separate':True,'tl_fuel_charts_separate':True,'source_links_opened':True,'page_errors':errors}
    (out/'result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(json.dumps(result,ensure_ascii=False,indent=2),flush=True)
    ctx.close();browser.close()
