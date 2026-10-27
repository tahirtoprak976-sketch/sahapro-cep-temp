"""DILIM4: common document link, exact/similar dedupe, safe bytes and file races."""
import argparse,json,os
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser(description=__doc__);p.add_argument('url',nargs='?',default='http://localhost:8841/');p.add_argument('--artifacts',default='/tmp/solo-document-link');a=p.parse_args()
BASE=a.url.rstrip('/')+'/';O=urlparse(BASE);assert O.scheme=='http' and O.hostname in ('localhost','127.0.0.1','::1')
assert not O.username and not O.password and not O.query and not O.fragment
out=Path(a.artifacts);out.mkdir(parents=True,exist_ok=True);errors=[];external=[]
PDF=b'%PDF-1.4\nstartxref\n0\n%%EOF'
with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),args=['--no-sandbox'])
    ctx=browser.new_context(viewport={'width':390,'height':850},service_workers='block');ctx.add_init_script("localStorage.setItem('sp_role','boss')")
    def route(req):
        u=urlparse(req.request.url)
        if (u.scheme,u.hostname,u.port)==(O.scheme,O.hostname,O.port):req.continue_()
        else:external.append(req.request.url);req.abort()
    ctx.route('**/*',route);page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
    name='document_link_e2e';page.goto(BASE+'README.md?db='+name)
    ids=page.evaluate('''async()=>{const db=await import('./js/db.js'),date='2026-10-27';
      const c=await db.saveNew('customers',{name:'TEST Document Customer'},'TEST'),v=await db.saveNew('vehicles',{name:'TEST Document Truck',type:'Kamyon',load_ton:20},'TEST');
      const dump=await db.saveNew('dump_sites',{name:'TEST Document Dump',fee:100,fee_unit:'Sefer',fee_effective_from:date},'TEST');
      const w=await db.saveNew('work_records',{date,customer_id:c.id,vehicle_id:v.id,dump_site_id:dump.id,work_type:'Hafriyat Nakliye',unit:'Sefer',quantity:3,price_snapshot:{unit_price:1000,amount:3000,kdv_rate:0,kdv_included:false}},'TEST');
      return {customer:c.id,vehicle:v.id,dump:dump.id,work:w.id,date};
    }''')
    def open_link():
        page.goto(BASE+'index.html?db='+name+'#/belge-bagla?work_id='+ids['work']+'&kind=dump_receipt')
        page.wait_for_selector('[data-link-form]')
    def choose_pdf(buffer=PDF,filename='receipt.pdf'):
        page.locator('[name=document]').set_input_files({'name':filename,'mimeType':'application/pdf','buffer':buffer})
        page.wait_for_function("()=>!document.querySelector('[data-link-save]').disabled")
    open_link();choose_pdf()
    page.locator('[name=receipt_no]').fill('F-1');page.locator('[name=amount]').fill('100');page.locator('[name=trips]').fill('1');page.locator('[name=tonnage]').fill('25')
    page.screenshot(path=str(out/'document-link-390.png'),full_page=True)
    page.locator('[data-link-save]').click();page.wait_for_function("()=>location.hash.startsWith('#/dokum-hareket/')")
    entry=page.evaluate("""async()=>{const db=await import('./js/db.js');const rows=await db.getAll('dump_entries');const e=rows[0],a=(await db.attachmentsFor('dump_entries',e.id))[0];return {id:e.id,trips:e.trips,amount:e.amount,work:e.work_record_id,bytes:await a.blob.text(),attachments:rows.length};}""")
    assert entry['trips']==1 and entry['amount']==100 and entry['work']==ids['work']
    assert entry['bytes']==PDF.decode(),entry['bytes']

    # Exact duplicate is read-only; similar receipt needs a separate explicit approval.
    open_link();choose_pdf();page.locator('[name=receipt_no]').fill('F-1')
    assert 'zaten bağlı' in page.locator('[data-duplicate]').inner_text()
    page.locator('[data-link-save]').click();page.wait_for_function("()=>document.querySelector('[data-duplicate]').textContent.includes('Kesin tekrar')")
    assert page.evaluate("async()=>(await (await import('./js/db.js')).getAll('dump_entries')).length")==1
    open_link();choose_pdf(PDF.replace(b'startxref',b'SECOND FILE\nstartxref'),'second.pdf');page.locator('[name=receipt_no]').fill('F-1');page.locator('[name=amount]').fill('100');page.locator('[name=trips]').fill('1')
    page.locator('[data-link-save]').click();page.locator('[name=allow_similar]').check();page.locator('[data-link-save]').click()
    page.wait_for_selector('[data-link-error] .notice')
    assert 'aynı tarih ve fiş numarası' in page.locator('[data-link-error]').inner_text()
    assert page.evaluate("async()=>(await (await import('./js/db.js')).getAll('dump_entries')).length")==1
    page.locator('[name=receipt_no]').fill('F-2');page.locator('[data-link-save]').click()
    page.wait_for_function("()=>location.hash.startsWith('#/dokum-hareket/')")
    assert page.evaluate("async()=>(await (await import('./js/db.js')).getAll('dump_entries')).length")==2

    # Slow A can never replace quick B.
    page.evaluate("""()=>{const original=File.prototype.arrayBuffer;File.prototype.arrayBuffer=function(){if(this.name==='slow.pdf')return new Promise(resolve=>setTimeout(()=>original.call(this).then(resolve),500));return original.call(this);};}""")
    open_link();page.locator('[name=document]').set_input_files({'name':'slow.pdf','mimeType':'application/pdf','buffer':PDF})
    page.locator('[name=document]').set_input_files({'name':'fast.pdf','mimeType':'application/pdf','buffer':PDF})
    page.wait_for_function("()=>!document.querySelector('[data-link-save]').disabled")
    assert 'fast.pdf' in page.locator('[data-file-preview]').inner_text()

    # Active SVG is rejected before any entry/attachment write.
    before=page.evaluate("async()=>(await (await import('./js/db.js')).getAll('dump_entries')).length")
    open_link();page.locator('[name=document]').set_input_files({'name':'bad.svg','mimeType':'image/svg+xml','buffer':b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'})
    page.wait_for_selector('[data-link-error] .notice')
    assert page.locator('[data-link-save]').is_disabled()
    assert page.evaluate("async()=>(await (await import('./js/db.js')).getAll('dump_entries')).length")==before

    # Generic document is linked to its owner, never to a payment.
    page.goto(BASE+'index.html?db='+name+'#/belge-bagla?kind=generic');page.wait_for_selector('[data-link-form]')
    page.locator('[name=category]').select_option('Sözleşme');page.locator('[name=owner_type]').select_option('customer');page.locator('[name=owner_id]').select_option(ids['customer'])
    choose_pdf(PDF.replace(b'startxref',b'GENERIC\nstartxref'),'contract.pdf');page.locator('[name=doc_no]').fill('DOC-1');page.locator('[data-link-save]').click()
    page.wait_for_function("()=>location.hash.startsWith('#/belgeler/')")
    generic=page.evaluate("""async()=>{const db=await import('./js/db.js');const docs=await db.listActive('documents'),a=(await db.attachmentsFor('document',docs[0].id))[0];return {count:docs.length,owner:docs[0].owner_id,bytes:await a.blob.text(),cash:(await db.getAll('cash_records')).length};}""")
    assert generic['count']==1 and generic['owner']==ids['customer'] and generic['cash']==0
    assert generic['bytes']==PDF.decode().replace('startxref','GENERIC\nstartxref')
    assert not errors and not external,{'errors':errors,'external':external}
    result={'local_synthetic_only':True,'dump_linked':True,'exact_no_duplicate':True,'similar_requires_approval':True,'file_race_latest_wins':True,'svg_rejected':True,'generic_owner_linked_no_payment':True,'original_bytes_preserved':True,'page_errors':errors}
    (out/'result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(json.dumps(result,ensure_ascii=False,indent=2),flush=True)
    ctx.close();browser.close()
