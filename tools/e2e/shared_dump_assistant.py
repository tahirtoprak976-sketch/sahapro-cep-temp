"""Assistant invoice and deposit preview/save: real UI/DB, mocked model, no real accounts."""
import sys, json, io
from PIL import Image
from playwright.sync_api import sync_playwright
U = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8841/'
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    c = b.new_context(service_workers='block', viewport={'width':360,'height':850})
    c.add_init_script("localStorage.setItem('sp_role','boss')")
    page = c.new_page(); errors=[]; calls=[]; plans=[]
    page.on('pageerror', lambda e:errors.append(str(e)))
    def model(route):
        calls.append(route.request.post_data_json)
        result=plans.pop(0) if plans else {}
        route.fulfill(status=200,content_type='application/json',body=json.dumps({'candidates':[{'content':{'parts':[{'text':json.dumps(result)}]},'finishReason':'STOP'}]}))
    page.route('https://generativelanguage.googleapis.com/**',model)
    page.goto(U+'index.html#/akilli-asistan');page.wait_for_selector('[data-msg]')
    ids=page.evaluate("""async()=>{const db=await import('./js/db.js'),C=await import('./js/core.js');await db.metaSet('gemini_key','TEST');await db.metaSet('gemini_model','gemini-2.5-flash');await db.metaSet('gemini_consent',true);const site=await db.saveNew('dump_sites',{name:'TEST Ortak Saha',fee:200,fee_unit:'Ton',invoice_tax_no:'1234567890'},'TEST');return {site:site.id,date:C.todayStr()}}""")
    page.reload();page.wait_for_selector('[data-msg]')
    image=io.BytesIO();Image.new('RGB',(80,100),'white').save(image,format='PNG')
    source='TEST Ortak Saha Döküm Faturası TEST-INV-59 VKN 1234567890 Hafriyat 5 Ton 200 1000 '+ids['date']
    plans.append({'expenses':[{'date':ids['date'],'amount':1000,'category':'Döküm','company':'TEST Ortak Saha','photo':0,'note':'TEST Döküm Faturası','invoice':{'no':'TEST-INV-59','seller_tax_no':'1234567890','net':1000,'kdv':0,'kdv_rate':0,'items':[{'desc':'Hafriyat','qty':5,'unit':'Ton','unit_price':200,'amount':1000}]}}],'photo_texts':[source]})
    page.set_input_files('[data-photos]',{'name':'TEST-invoice.png','mimeType':'image/png','buffer':image.getvalue()})
    page.fill('[data-msg]','Bu döküm faturasını belge olarak kaydet');page.click('[data-ask]');page.wait_for_selector('[data-kind=expense] [name=dinv_mode]')
    assert page.locator('[name=dinv_mode] option[value=paid], [name=dinv_mode] option[value=exp]').count()==0
    assert page.locator('[name=dinv_mode]').input_value()=='inv'
    assert page.evaluate("async()=>(await(await import('./js/db.js')).listActive('documents')).length")==0
    page.check('[data-kind=expense] [data-pick]');page.click('[data-out] [data-save]')
    page.locator('[data-out]').get_by_text("Kaydedildi:",exact=False).wait_for()
    state=page.evaluate("""async id=>{const db=await import('./js/db.js'),L=await import('./js/dump-ledger-core.js');return {balance:L.sharedDumpBalance(await db.dumpAll(),id).balance,expenses:(await db.listActive('expense_records')).length,entries:(await db.listActive('dump_entries')).length,photos:(await db.getAll('attachments')).length}}""",ids['site'])
    assert state=={'balance':0,'expenses':0,'entries':0,'photos':1},state
    print('PASS actual assistant invoice photo -> comparison document only; no paid mode, expense, credit or debit',flush=True)
    page.goto(U+'index.html#/akilli-asistan');page.reload();page.wait_for_selector('[data-msg]')
    msg='TEST Ortak Saha döküm hesabına 20000 TL para yatırdım'
    plans.append({'expenses':[{'date':ids['date'],'amount':20000,'category':'Döküm','company':'TEST Ortak Saha','payment_method':'Havale','note':msg}]})
    page.fill('[data-msg]',msg);page.click('[data-ask]');page.wait_for_selector('[data-kind=expense]')
    page.check('[data-kind=expense] [data-pick]');page.click('[data-out] [data-save]')
    page.locator('[data-out]').get_by_text("Kaydedildi:",exact=False).wait_for()
    state=page.evaluate("""async id=>{const db=await import('./js/db.js'),L=await import('./js/dump-ledger-core.js'),K=await import('./js/costs-core.js');const d=await db.dumpAll();return {balance:L.sharedDumpBalance(d,id).balance,expenses:d.expense_records.length,entries:d.dump_entries.length,cost:K.costTotals(K.costRows(d)).total}}""",ids['site'])
    assert state=={'balance':20000,'expenses':1,'entries':1,'cost':0},state
    assert not errors,errors
    print('PASS actual assistant topup -> one atomic loading + linked deposit expense; shared balance 20000, operating cost zero; no browser errors',flush=True)
    b.close()
