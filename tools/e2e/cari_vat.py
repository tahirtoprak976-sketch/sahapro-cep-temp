"""Read-only principal/VAT display in real UI/IndexedDB, with frozen claims and receipts."""
import argparse,json,os,uuid
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

p=argparse.ArgumentParser(description=__doc__)
p.add_argument('url',nargs='?',default='http://localhost:8841/')
p.add_argument('--artifacts',default='/tmp/solo-cari-vat')
a=p.parse_args();BASE=a.url.rstrip('/')+'/';origin=urlparse(BASE)
assert origin.scheme=='http' and origin.hostname in ('localhost','127.0.0.1','::1')
assert not origin.username and not origin.password and not origin.query and not origin.fragment
out=Path(a.artifacts);out.mkdir(parents=True,exist_ok=True)
with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),args=['--no-sandbox'])
    context=browser.new_context(viewport={'width':390,'height':850},service_workers='block')
    context.add_init_script("localStorage.setItem('sp_role','boss')")
    external=[];errors=[]
    def local_only(route):
        u=urlparse(route.request.url)
        if (u.scheme,u.hostname,u.port)==(origin.scheme,origin.hostname,origin.port):route.continue_()
        else:external.append(route.request.url);route.abort()
    context.route('**/*',local_only)
    page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
    name='cari_vat_'+uuid.uuid4().hex[:12];APP=BASE+'index.html?db='+name
    page.goto(APP+'#/');page.wait_for_selector('#screen[data-view-ready="1"] [data-operation-desk]')
    ids=page.evaluate('''async()=>{
      const db=await import('./js/db.js'),C=await import('./js/core.js'),date=C.todayStr();
      const customer=label=>db.saveNew('customers',{name:label},'TEST');
      const mixed=await customer('TEST Yaşa İnşaat'),claimed=await customer('TEST Hakediş'),zero=await customer('TEST KDV %0'),advance=await customer('TEST Avans');
      const vehicle=await db.saveNew('vehicles',{name:'TEST Cari truck',type:'Kamyon'},'TEST');
      const work=(c,amount,rate,included)=>db.saveNew('work_records',{date,customer_id:c.id,vehicle_id:vehicle.id,work_type:'Hafriyat Nakliye',quantity:1,unit:'Sefer',price_snapshot:{amount,unit_price:amount,kdv_rate:rate,kdv_included:included}},'TEST');
      await work(mixed,1000,20,false);await work(mixed,1200,20,true);await work(zero,50,0,false);await work(advance,100,20,true);
      const source=await work(claimed,2000,20,false);
      const item={work_record_id:source.id,date,customer_id:claimed.id,vehicle_id:vehicle.id,work_type:source.work_type,quantity:1,unit:'Sefer',unit_price:2000,kdv_rate:20,kdv_included:false};
      const totals=C.calcHakedisTotals([item]);
      const claim=await db.createHakedis({hakedis_no:1,customer_id:claimed.id,status:'Taslak',created_date:date,date_from:date,date_to:date,items:totals.lines,subtotal:totals.subtotal,kdv_total:totals.kdv,grand_total:totals.grand});
      await db.finalizeHakedis(claim.id);
      for(const [c,amount] of [[mixed,200],[claimed,600],[advance,150]])await db.saveNew('cari_movements',{date,customer_id:c.id,type:'Tahsilat',amount:-amount},'TEST receipt');
      return {mixed:mixed.id,claimed:claimed.id,zero:zero.id,advance:advance.id,vehicle:vehicle.id};
    }''')
    snapshot=lambda:page.evaluate("async()=>JSON.stringify(await(await import('./js/db.js')).dumpAll())")
    before=snapshot()
    page.goto(APP+'#/cari');page.wait_for_selector('[data-cari-total] [data-cari-net]')
    def values(locator):
        return {key:locator.locator('[data-cari-'+key+']').inner_text() for key in ('net','vat','gross','balance')}
    def customer(cid):return page.locator('[data-cari-customer="'+cid+'"]')
    total=values(page.locator('[data-cari-total]'))
    assert total=={'net':'4.050,00 ₺','vat':'800,00 ₺','gross':'4.850,00 ₺','balance':'3.850,00 ₺'},total
    mixed=values(customer(ids['mixed']))
    assert mixed=={'net':'2.000,00 ₺','vat':'400,00 ₺','gross':'2.400,00 ₺','balance':'+2.000,00 ₺'},mixed
    assert customer(ids['mixed']).locator('[data-cari-receipts]').inner_text()=='200,00 ₺'
    assert '200,00 ₺ KDV’si kayıtlı bakiyeye henüz eklenmedi' in customer(ids['mixed']).inner_text()
    assert values(customer(ids['claimed']))=={'net':'2.000,00 ₺','vat':'400,00 ₺','gross':'2.400,00 ₺','balance':'+1.800,00 ₺'}
    assert values(customer(ids['zero']))['vat']=='0,00 ₺'
    assert values(customer(ids['advance']))['balance']=='-50,00 ₺'
    assert snapshot()==before,'Opening the list cannot write or reprice a record'
    layouts=[]
    for width in (320,360,390,768):
        page.set_viewport_size({'width':width,'height':850})
        page.wait_for_selector('[data-cari-customer="'+ids['mixed']+'"]')
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),width
        layouts.append(width)
        if width==390:page.screenshot(path=str(out/'cari-vat-390.png'),full_page=True)
    page.set_viewport_size({'width':390,'height':850})
    customer(ids['mixed']).click();page.wait_for_selector('[data-cari-detail-money]')
    assert page.evaluate('location.hash')=='#/cari/'+ids['mixed']
    assert values(page.locator('[data-cari-detail-money]'))==mixed
    assert 'tahsilat öncesi' in page.locator('[data-cari-detail-money]').inner_text()
    page.evaluate("document.body.style.fontSize='200%'")
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
    page.screenshot(path=str(out/'cari-vat-detail-large-text.png'),full_page=True)
    page.evaluate("document.body.style.fontSize=''")
    assert snapshot()==before,'Detail, resize and back navigation cannot alter the ledger, claims or prices'
    unknown=page.evaluate('''async i=>{
      const db=await import('./js/db.js'),C=await import('./js/core.js');
      const c=await db.saveNew('customers',{name:'TEST <img src=x onerror="window.__vat_xss=1"> eksik KDV'},'TEST');
      await db.saveNew('work_records',{date:C.todayStr(),customer_id:c.id,vehicle_id:i.vehicle,work_type:'Hafriyat Nakliye',quantity:1,unit:'Sefer',price_snapshot:{unit_price:300,amount:300,kdv_rate:null,kdv_included:false}},'TEST legacy unknown rate');
      return c.id;
    }''',ids)
    before_unknown=snapshot();page.goto(APP+'#/cari');page.wait_for_selector('[data-cari-customer="'+unknown+'"]')
    missing=values(customer(unknown))
    assert missing=={'net':'300,00 ₺','vat':'Kontrol gerekli','gross':'Kontrol gerekli','balance':'+300,00 ₺'},missing
    assert values(page.locator('[data-cari-total]'))['vat']=='Kontrol gerekli'
    assert values(page.locator('[data-cari-total]'))['balance']=='4.150,00 ₺'
    assert not page.evaluate('!!window.__vat_xss')
    assert 'oran varsayılmadı' in customer(unknown).inner_text()
    assert snapshot()==before_unknown and not external and not errors,(external,errors)
    report={'synthetic_only':True,'mixed_basis_and_partial_receipts':mixed,'frozen_claim_not_double_counted':True,'zero_vat_valid':True,'advances_excluded_from_positive_total':True,'list_detail_agree':True,'unknown_vat_no_default':missing,'viewports':layouts,'large_text_200_percent':True,'original_business_records_unchanged':True,'page_errors':errors,'external_requests':external}
    (out/'result.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(report,ensure_ascii=False),flush=True)
    context.close();browser.close()
