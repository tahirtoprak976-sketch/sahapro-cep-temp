"""Responsive workflow screens at 320/360/390/768 and 200% text."""
import argparse,json,os
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser(description=__doc__);p.add_argument('url',nargs='?',default='http://localhost:8841/');p.add_argument('--artifacts',default='/tmp/solo-responsive');a=p.parse_args()
BASE=a.url.rstrip('/')+'/';O=urlparse(BASE);assert O.scheme=='http' and O.hostname in ('localhost','127.0.0.1','::1')
out=Path(a.artifacts);out.mkdir(parents=True,exist_ok=True);errors=[]
with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),args=['--no-sandbox'])
    ctx=browser.new_context(service_workers='block');ctx.add_init_script("localStorage.setItem('sp_role','boss')")
    page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(BASE+'README.md?db=responsive_smoke')
    ids=page.evaluate('''async()=>{const db=await import('./js/db.js'),B=await import('./js/business.js');const c=await db.saveNew('customers',{name:'TEST Responsive Customer'},'TEST'),s=await db.saveNew('sites',{name:'TEST Responsive Site',customer_id:c.id},'TEST'),v=await db.saveNew('vehicles',{name:'TEST Responsive Truck',type:'Kamyon'},'TEST'),p=await db.saveNew('personnel',{name:'TEST Responsive Driver'},'TEST');const w=await db.saveNew('work_records',{date:'2026-10-27',customer_id:c.id,site_id:s.id,vehicle_id:v.id,personnel_id:p.id,work_type:'Hafriyat Nakliye',unit:'Sefer',quantity:1,price_snapshot:{unit_price:1000,amount:1000,kdv_rate:0,kdv_included:false}},'TEST');const q=await db.saveNew('quotes',{quote_no:1,date:'2026-10-20',customer_id:c.id,site_id:s.id,status:'Kabul',type:'UNIT_PRICE',input:{quantity:1,unit:'Sefer',fuel_l:10,fuel_price:50,margin:20}},'TEST');const k=B.contractFromQuote(q,await db.nextSeq('contract'));await db.put('contracts',k);return {customer:c.id,site:s.id,vehicle:v.id,person:p.id,work:w.id,quote:q.id};}''')
    results=[]
    for width in (320,360,390,768):
        page.set_viewport_size({'width':width,'height':850})
        for label,route in [('operation','#/'),('documents','#/belge-bagla?work_id='+ids['work']),('quote','#/teklif/'+ids['quote']),('work','#/isler/'+ids['work'])]:
            page.goto(BASE+'index.html?db=responsive_smoke'+route)
            page.wait_for_selector('#screen[data-view-ready="1"]')
            dims=page.evaluate("()=>({sw:document.documentElement.scrollWidth,iw:innerWidth})")
            assert dims['sw']<=dims['iw']+1,(width,label,dims)
            results.append({'width':width,'screen':label,'scrollWidth':dims['sw']})
        if width==390:
            page.goto(BASE+'index.html?db=responsive_smoke#/');page.wait_for_selector('[data-operation-desk]')
            page.screenshot(path=str(out/'operation-390.png'),full_page=True)
    page.set_viewport_size({'width':390,'height':850})
    page.goto(BASE+'index.html?db=responsive_smoke#/belge-bagla?work_id='+ids['work']);page.wait_for_selector('[data-link-form]')
    page.evaluate("document.body.style.fontSize='200%'")
    dims=page.evaluate("()=>({sw:document.documentElement.scrollWidth,iw:innerWidth})")
    assert dims['sw']<=dims['iw']+1,('large-text',dims)
    page.screenshot(path=str(out/'document-large-text-390.png'),full_page=True)
    assert not errors,errors
    result={'local_synthetic_only':True,'viewports':results,'large_text_200_percent':True,'page_errors':errors}
    (out/'result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(json.dumps(result,ensure_ascii=False,indent=2),flush=True)
    ctx.close();browser.close()
