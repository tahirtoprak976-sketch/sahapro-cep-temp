"""Real PDF upload/form/IndexedDB regression for all displayed contract extras.

All fixtures are visibly TEST and generated at runtime. Gemini responses are
explicitly MOCKED; no real model extraction, keys, external calls or user data.
Requires ordinary CI Chromium, Playwright, ReportLab and DejaVu Sans fonts.
Known local socket restrictions are not retried by this script's authors.
"""
import argparse
import base64
import hashlib
import json
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.pagesizes import A4

parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('url',nargs='?',default='http://localhost:8841/')
parser.add_argument('--baseline-proof',action='store_true',help='Reproduce truncation on unchanged v3.9.71, never a candidate pass')
args=parser.parse_args()
URL=args.url.rstrip('/')+'/'
OUT=Path('/tmp/solo-contract-extra-rates'); OUT.mkdir(parents=True,exist_ok=True)
pdfmetrics.registerFont(TTFont('DejaVu','/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'))
UNITS=['Saat','Yevmiye','Sefer','m³','Ton','Adet']
DATE='2026-10-25'

def fixture(n):
    rates=[{'label':'TEST Ekstra '+str(i+1),'unit':UNITS[i%len(UNITS)],'price':(i+1)*125.5} for i in range(n)]
    plan={'customer_name':'TEST Sözleşme Ekstraları','site_name':'TEST '+str(n)+' Ekstra Sahası',
          'basis':'Götürü','price':120000,'kdv_rate':20,'kdv_included':False,
          'contract_date':DATE,'start_date':DATE,'scope_in':['TEST Ana yıkım işi'],
          'scope_out':['Ruhsat müşteriye ait'],'extra_rates':rates,'scrap':None,
          'payment_plan':'TEST %30 avans planı; henüz ödeme yok.','notes':'TEST İş yapılmadı. Ödeme alınmadı.',
          'quotes':[{'field':'price','text':'Götürü 120.000 TL + KDV %20.'}]}
    path=OUT/('TEST-contract-'+str(n)+'.pdf')
    c=canvas.Canvas(str(path),pagesize=A4,invariant=1)
    c.setTitle('TEST / ÖRNEK - İMZALANMAZ')
    c.setFont('DejaVu',18);c.drawString(42,795,'TEST / ÖRNEK - İMZALANMAZ')
    c.setFont('DejaVu',10);y=765
    lines=[plan['customer_name'],plan['site_name'],'Tarih: '+DATE,
           'Götürü 120.000 TL + KDV %20.','Ana iş: TEST yıkım. Ruhsat müşteriye ait.',
           'Ekstra iş birim fiyatları:']
    lines += [r['label']+': '+str(r['price'])+' TL / '+r['unit'] for r in rates]
    lines += [plan['payment_plan'],'Yalnız yazılım testi. İŞ YAPILMADI. ÖDEME ALINMADI.']
    for text in lines:c.drawString(42,y,text);y-=23
    assert y>65
    c.setFont('DejaVu',9);c.drawString(42,45,'Sentetik test verisi; gerçek işletme kayıtlarına aktarılmaz.');c.save()
    assert path.read_bytes().startswith(b'%PDF-')
    return path,plan

fixtures={n:fixture(n) for n in [6,12]}
events=[]
def passed(text):events.append(text);print('PASS '+text,flush=True)

with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    ctx=browser.new_context(viewport={'width':390,'height':850},service_workers='block')
    ctx.add_init_script("localStorage.setItem('sp_role','boss')")
    queue=[];sent=[];blocked=[];errors=[]
    def route(request):
        u=urlsplit(request.request.url)
        if u.netloc==urlsplit(URL).netloc:return request.continue_()
        if u.hostname=='generativelanguage.googleapis.com':
            assert queue,'Unexpected model call'
            sent.append(request.request.post_data_json)
            return request.fulfill(status=200,content_type='application/json',body=json.dumps({'candidates':[{'content':{'parts':[{'text':json.dumps(queue.pop(0),ensure_ascii=False)}]},'finishReason':'STOP'}]}))
        blocked.append(request.request.url);return request.abort()
    ctx.route('**/*',route)
    page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
    def visit(target):
        old=page.query_selector('#screen');target='#/'+target
        if page.evaluate('location.hash')==target:page.reload()
        else:
            page.evaluate('v=>location.hash=v',target)
            page.wait_for_function('old=>!old.isConnected',arg=old)
        page.wait_for_selector('#screen[data-view-ready="1"]')
        assert 'Ekran yüklenirken hata' not in page.locator('#screen').inner_text()
    def snapshot():
        return page.evaluate("""async()=>{const db=await import('./js/db.js');const s=await db.readSnapshot({attachments:true,meta:false,drafts:false});delete s.captured_at;
          for(const a of s.attachments){if(a.blob){a.bytes=Array.from(new Uint8Array(await a.blob.arrayBuffer()));delete a.blob;}}return s;}""")
    def site(sid):return page.evaluate("async id=>(await import('./js/db.js')).get('sites',id)",sid)
    def confirm_no():
        page.wait_for_selector('.sheet');assert 'cariye' in page.locator('.sheet').inner_text().lower()
        page.click('.sheet [data-x="0"]');page.wait_for_selector('.sheet',state='hidden')
        page.wait_for_selector('[data-deal]',state='attached')
    def edit_save():
        old=page.query_selector('#screen');page.click('[data-save]')
        page.wait_for_function('old=>!old.isConnected',arg=old)
        page.wait_for_selector('#screen[data-view-ready="1"] [data-deal]',state='attached')
        assert page.locator('.sheet').count()==0,'Editing must not post or re-prompt for a charge'
    def assert_finances():
        data=snapshot()['data']
        for name in ['work_records','fuel_records','cash_records','cari_movements','contracts','price_book','receivable_plans']:
            assert data.get(name,[])==baseline.get(name,[]),name
    def assert_pdf(sid,path):
        snap=snapshot();s=next(x for x in snap['data']['sites'] if x['id']==sid)
        doc=next(x for x in snap['data']['documents'] if x['id']==s['deal']['doc_id'])
        assert doc['customer_id']==s['customer_id'] and doc['site_id']==sid
        att=next(x for x in snap['attachments'] if x['record_type']=='document' and x['record_id']==doc['id'])
        assert bytes(att['bytes'])==path.read_bytes()
        return hashlib.sha256(path.read_bytes()).hexdigest()
    try:
        page.goto(URL+'index.html#/daha');page.wait_for_selector('#screen[data-view-ready="1"]')
        if args.baseline_proof:assert page.evaluate("async()=>(await import('./js/core.js')).APP_VERSION")=='SAHAPRO SOLO v3.9.71'
        cid=page.evaluate("""async()=>{const db=await import('./js/db.js');
          await db.metaSet('gemini_key','TEST-ONLY-NOT-A-KEY');await db.metaSet('gemini_model','gemini-2.5-flash');await db.metaSet('gemini_consent',true);
          return(await db.saveNew('customers',{name:'TEST Sözleşme Ekstraları'},'TEST')).id;}""")
        baseline=snapshot()['data'];page.wait_for_timeout(200)
        for n,(path,plan) in fixtures.items():
            visit('is-sozlesmeleri/oku');queue.append(plan)
            page.set_input_files('[data-cfile]',str(path));before=snapshot();page.click('[data-cread]');page.wait_for_selector('[data-cres]')
            assert snapshot()==before,'PDF preview cannot write business records'
            part=next(x['inlineData'] for x in sent[-1]['contents'][0]['parts'] if 'inlineData'in x)
            assert part['mimeType']=='application/pdf' and base64.b64decode(part['data'])==path.read_bytes()
            assert page.input_value('[name=c_customer]')==cid
            page.click('[data-cok]');page.wait_for_selector('[data-fromdoc]')
            sid=page.evaluate("location.hash.split('/')[2].split('?')[0]")
            assert page.locator('[data-rate]').count()==n
            page.screenshot(path=str(OUT/('form-'+str(n)+'.png')),full_page=True)
            if not args.baseline_proof:
                # Invalid last rows must block the entire save, including after row4.
                for label,price,unit in [('TEST','0','Saat'),('','100','Saat'),('TEST','','Saat'),('TEST','-1','Saat'),('TEST','100','')]:
                    page.fill('[name=r_label_'+str(n-1)+']',label);page.fill('[name=r_price_'+str(n-1)+']',price)
                    page.locator('[name=r_unit_'+str(n-1)+']').evaluate('(el,v)=>el.value=v',unit)
                    before=snapshot();page.click('[data-save]');page.wait_for_timeout(150)
                    assert snapshot()==before and not site(sid).get('deal')
                    assert 'Ekstra fiyat satırında' in page.locator('body').inner_text()
                    assert page.locator('.sheet').count()==0
                last=plan['extra_rates'][-1]
                page.fill('[name=r_label_'+str(n-1)+']',last['label']);page.fill('[name=r_price_'+str(n-1)+']',str(last['price']))
                page.select_option('[name=r_unit_'+str(n-1)+']',last['unit'])
            page.click('[data-save]');confirm_no();saved=site(sid)['deal']
            if args.baseline_proof:
                assert saved['extra_rates']==plan['extra_rates'][:4]
                assert_pdf(sid,path);assert_finances()
                print('BASELINE DEFECT REPRODUCED: '+str(n)+' displayed rows -> 4 saved, not a candidate pass',flush=True)
                continue
            assert saved['extra_rates']==plan['extra_rates']
            assert saved['price']==120000 and saved['kdv_rate']==20 and saved['payment_plan']==plan['payment_plan']
            assert not saved.get('charge')
            sha=assert_pdf(sid,path);assert_finances()
            visit('daha');visit('is-sozlesmesi/'+sid+'?duzenle=1')
            assert page.locator('[data-rate]').count()==n
            for i,row in enumerate(plan['extra_rates']):
                assert page.input_value('[name=r_label_'+str(i)+']')==row['label']
                assert float(page.input_value('[name=r_price_'+str(i)+']'))==row['price']
            page.fill('[name=r_price_'+str(n-1)+']','987.65');edit_save()
            expected=[dict(r) for r in plan['extra_rates']];expected[-1]['price']=987.65
            assert site(sid)['deal']['extra_rates']==expected and assert_pdf(sid,path)==sha;assert_finances()
            # Blank rows can be intentionally cleared; zero is never silently blank.
            visit('is-sozlesmesi/'+sid+'?duzenle=1')
            page.fill('[name=r_label_'+str(n-1)+']','');page.fill('[name=r_price_'+str(n-1)+']','');edit_save()
            assert site(sid)['deal']['extra_rates']==expected[:-1];assert_finances();assert_pdf(sid,path)
            passed(str(n)+' real PDF extra rows: invalid/zero guard, complete save, reload, last-row edit and explicit blank removal; original PDF and financial separation preserved')
        if not args.baseline_proof:
            plain_sid=page.evaluate("""async cid=>(await(await import('./js/db.js')).saveNew('sites',{name:'TEST Blank Extras',customer_id:cid},'TEST')).id""",cid)
            visit('is-sozlesmesi/'+plain_sid)
            assert page.locator('[data-rate]').count()==4
            page.fill('[name=price]','1000');page.click('[data-save]');confirm_no()
            assert site(plain_sid)['deal']['extra_rates']==[];assert_finances()
            passed('Default four blank rows remain; blank extras create no fake rates, ledger, payment or performed work')
        assert not errors,errors
        assert not blocked,blocked
        assert not queue
        passed('Real browser/IndexedDB only; mocked model responses; no external calls, no page errors')
    except Exception:
        page.screenshot(path=str(OUT/'failure.png'),full_page=True)
        (OUT/'failure-page.txt').write_text(page.locator('body').inner_text())
        raise
    finally:
        (OUT/'results.json').write_text(json.dumps({'mode':'baseline-defect-proof' if args.baseline_proof else 'candidate-acceptance','gemini':'MOCKED','events':events,'intercepted_requests':len(sent),'unexpected_external':blocked,'page_errors':errors},ensure_ascii=False,indent=2))
        browser.close()
