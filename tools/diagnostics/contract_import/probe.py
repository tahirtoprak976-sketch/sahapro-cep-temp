"""Diagnostic of unchanged SOLO v3.9.71, synthetic PDFs and mocked Gemini only.

Known current defects are recorded as OBSERVED, not advertised as feature passes.
All browser storage is disposable; the external request interception never sends
documents, keys or requests to Google. No product source is modified.
"""
import base64
import hashlib
import json
import sys
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright

URL = sys.argv[1].rstrip('/') + '/'
FIXTURES = Path(sys.argv[2])
OUT = Path(sys.argv[3]); OUT.mkdir(parents=True, exist_ok=True)
plans = json.loads((FIXTURES / 'mock-plans.json').read_text())
events, sent, blocked, errors, queue = [], [], [], [], []

def record(kind, name, evidence=None):
    row = {'kind': kind, 'name': name, 'evidence': evidence}
    events.append(row)
    print(kind + ' ' + name + (': ' + json.dumps(evidence, ensure_ascii=False) if evidence is not None else ''), flush=True)

with sync_playwright() as pw:
    browser = pw.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    context = browser.new_context(viewport={'width': 390, 'height': 850}, service_workers='block')
    context.add_init_script("localStorage.setItem('sp_role','boss')")
    def intercept(route):
        u = urlsplit(route.request.url)
        if u.netloc == urlsplit(URL).netloc:
            return route.continue_()
        if u.hostname == 'generativelanguage.googleapis.com':
            request = route.request.post_data_json
            sent.append(request)
            assert queue, 'Unexpected model request: no mock queued'
            value = queue.pop(0)
            return route.fulfill(status=200, content_type='application/json', body=json.dumps({'candidates':[{'content':{'parts':[{'text':json.dumps(value, ensure_ascii=False)}]},'finishReason':'STOP'}]}))
        blocked.append(route.request.url)
        return route.abort()
    context.route('**/*', intercept)
    page = context.new_page()
    page.on('pageerror', lambda e: errors.append(str(e)))
    def visit(target):
        target = '#/' + target
        old = page.query_selector('#screen')
        if page.evaluate('location.hash') == target:
            page.reload()
        else:
            page.evaluate('v=>location.hash=v', target)
            if old: page.wait_for_function('v=>!v.isConnected', arg=old)
        page.wait_for_selector('#screen[data-view-ready="1"]')
        assert 'Ekran yüklenirken hata' not in page.locator('#screen').inner_text()
    def snapshot():
        return page.evaluate("""async()=>{
          const db=await import('./js/db.js'), s=await db.readSnapshot({attachments:true,meta:false,drafts:false});
          delete s.captured_at;
          for(const a of s.attachments){if(a.blob){a.bytes=Array.from(new Uint8Array(await a.blob.arrayBuffer()));delete a.blob;}}
          return s;
        }""")
    def all_data(): return snapshot()['data']
    def no_work_or_payments(data):
        for store in ['work_records','fuel_records','cash_records','receivable_plans','contracts','price_book']:
            assert len(data.get(store, [])) == baseline_counts.get(store, 0), (store, data.get(store))
    def choose(yes):
        page.wait_for_selector('.sheet')
        page.click('.sheet [data-x="' + ('1' if yes else '0') + '"]')
        page.wait_for_selector('.sheet', state='hidden')
    def read_pdf(name):
        visit('is-sozlesmeleri/oku')
        queue.append(plans[name])
        page.set_input_files('[data-cfile]', str(FIXTURES / (name + '.pdf')))
        before = snapshot()
        n = len(sent)
        page.click('[data-cread]')
        page.wait_for_selector('[data-cres]')
        assert len(sent) == n + 1 and not queue
        parts = sent[-1]['contents'][0]['parts']
        inline = next(p['inlineData'] for p in parts if 'inlineData' in p)
        assert inline['mimeType'] == 'application/pdf'
        assert base64.b64decode(inline['data']) == (FIXTURES / (name + '.pdf')).read_bytes()
        assert snapshot() == before, 'Read/preview must not write business data'
        return page.locator('[data-cres]').inner_text()
    def approve():
        page.click('[data-cok]')
        page.wait_for_selector('[data-fromdoc]')
        return page.evaluate("location.hash.split('/')[2].split('?')[0]")
    def get_site(sid):
        return page.evaluate("async id=>(await import('./js/db.js')).get('sites',id)", sid)
    def save_cancel():
        page.click('[data-save]')
        page.wait_for_selector('.sheet')
        text = page.locator('.sheet').inner_text()
        assert 'cariye' in text.lower()
        choose(False)
        page.wait_for_selector('[data-deal]', state='attached')
        return text
    def original_attachment(sid, name):
        s = snapshot(); site = next(x for x in s['data']['sites'] if x['id'] == sid)
        docid = site.get('deal', {}).get('doc_id')
        docs = [d for d in s['data']['documents'] if d.get('site_id') == sid]
        assert len(docs) == 1
        if docid: assert docid == docs[0]['id']
        atts = [a for a in s['attachments'] if a['record_type'] == 'document' and a['record_id'] == docs[0]['id']]
        assert len(atts) == 1
        raw = bytes(atts[0]['bytes']); expected = (FIXTURES / (name + '.pdf')).read_bytes()
        assert raw == expected
        return hashlib.sha256(raw).hexdigest()
    try:
        page.goto(URL + 'index.html#/daha')
        page.wait_for_selector('#screen[data-view-ready="1"]')
        assert page.evaluate("async()=>(await import('./js/core.js')).APP_VERSION") == 'SAHAPRO SOLO v3.9.71'
        customer = page.evaluate("""async name=>{
          const db=await import('./js/db.js');
          return (await db.saveNew('customers',{name},'TEST contract probe')).id;
        }""", plans['goturu']['customer_name'])
        baseline = snapshot(); baseline_counts = {k:len(v) for k,v in baseline['data'].items()}
        # Existing-site collision is deliberate test fixture, never real business data.
        existing = page.evaluate("""async p=>(await (await import('./js/db.js')).saveNew('sites',
          {name:p.name,customer_id:p.customer},'TEST pre-existing site')).id""", {'name':plans['goturu']['site_name'],'customer':customer})
        page.wait_for_timeout(250)
        visit('is-sozlesmeleri/oku')
        page.set_input_files('[data-cfile]', str(FIXTURES / 'goturu.pdf'))
        before = snapshot(); page.click('[data-cread]'); page.wait_for_timeout(250)
        assert not sent and snapshot() == before
        assert 'Gemini anahtarını' in page.locator('body').inner_text()
        record('PASS', 'Without configured model key and consent, no extraction or business writes')
        page.evaluate("""async()=>{const db=await import('./js/db.js');
          await db.metaSet('gemini_key','TEST-NOT-A-REAL-KEY');
          await db.metaSet('gemini_model','gemini-2.5-flash');
          await db.metaSet('gemini_consent',true);
        }""")
        text = read_pdf('goturu')
        assert 'Götürü' in text and '200.000' in text and 'Kırıcı' in text and '30' in text
        assert page.input_value('[name=c_customer]') == customer
        page.screenshot(path=str(OUT/'goturu-preview.png'), full_page=True)
        before = snapshot(); visit('daha'); assert snapshot() == before
        record('PASS', 'Real PDF bytes reach mocked transport; preview and leaving preview do not save')
        read_pdf('goturu'); before = snapshot(); sid = approve()
        after = snapshot()
        assert len(after['data']['sites']) == len(before['data']['sites']) + 1
        assert sid != existing and get_site(sid).get('deal') is None
        assert original_attachment(sid, 'goturu')
        no_work_or_payments(after['data'])
        assert after['data'].get('cari_movements',[]) == before['data'].get('cari_movements',[])
        assert page.input_value('[name=price]') == '200000'
        assert page.input_value('[name=payment_plan]') == plans['goturu']['payment_plan']
        assert page.input_value('[name=kdv_rate]') == '20' and page.input_value('[name=kdv_included]') == '0'
        record('OBSERVED', 'Approval always creates a new site even when same-named site exists; original PDF already archived before final Save', {'existing_site':existing,'created_site':sid})
        approved = snapshot(); visit('daha'); assert snapshot() == approved
        record('OBSERVED', 'Leaving agreement form after first approval leaves the new site and archive, but no deal or accounting')
        # Session prefill survives navigation; return and explicitly save the agreement.
        visit('is-sozlesmesi/' + sid)
        assert page.input_value('[name=price]') == '200000'
        confirmation = save_cancel(); assert '240.000' in confirmation
        site = get_site(sid); deal = site['deal']
        assert deal['basis']=='Götürü' and deal['price']==200000 and deal.get('charge') is None
        assert deal['payment_plan'] == plans['goturu']['payment_plan']
        assert original_attachment(sid,'goturu')
        d = all_data(); no_work_or_payments(d); assert not d.get('cari_movements')
        record('PASS', 'Final Save stores plan and PDF linkage; cancelling separate ledger dialog creates no debt, payment or performed work')
        visit('is-sozlesmesi/' + sid + '?duzenle=1')
        assert page.input_value('[name=price]') == '200000'
        visit('is-sozlesmesi/' + sid)
        page.click('[data-jt="soz"]')
        page.click('[data-charge-go]'); page.wait_for_selector('.sheet')
        assert '240.000' in page.locator('.sheet').inner_text()
        choose(True); page.wait_for_timeout(300)
        d = all_data(); charges = d['cari_movements']
        assert len(charges)==1 and charges[0]['amount']==240000 and charges[0]['type']=='Hakedis' and charges[0]['source']=='goturu'
        no_work_or_payments(d)
        duplicate = page.evaluate("""async id=>{const db=await import('./js/db.js');try{
          await db.saveJobCharge(id,{gross:1},{amount:1},'TEST duplicate');return 'WRITTEN';
        }catch(e){return e.message;}}""",sid)
        assert 'zaten' in duplicate and len(all_data()['cari_movements'])==1
        record('PASS', 'Only separate explicit charge approval posts exactly 240000 debt once, not a performed job or cash advance')
        # Reimport same original document: current absence of package/PDF idempotence.
        read_pdf('goturu'); before = snapshot(); sid2 = approve(); after = snapshot()
        assert sid2 not in [sid,existing]
        assert len(after['data']['documents']) == len(before['data']['documents']) + 1
        assert original_attachment(sid2,'goturu') == original_attachment(sid,'goturu')
        visit('daha')
        record('OBSERVED', 'Repeated same PDF creates another site and duplicate archive; no source-hash dedupe', {'same_original_sha256':original_attachment(sid2,'goturu')})
        read_pdf('extras-six'); sid3=approve()
        assert page.locator('[data-rate]').count()==6
        assert page.input_value('[name=r_label_5]') == plans['extras-six']['extra_rates'][5]['label']
        page.screenshot(path=str(OUT/'six-extras-form.png'),full_page=True)
        save_cancel(); saved = get_site(sid3)['deal']['extra_rates']
        assert saved == plans['extras-six']['extra_rates'][:4]
        record('OBSERVED', 'Six extracted extra rows are displayed but final Save persists only first four', {'displayed':6,'saved':len(saved),'lost_labels':[r['label'] for r in plans['extras-six']['extra_rates'][4:]]})
        text=read_pdf('hourly-only')
        assert 'bulunamadı' in text and 'Kontrol edin' in text
        sid4=approve()
        assert page.input_value('[name=basis]')=='Götürü' and page.input_value('[name=price]')==''
        before=snapshot(); page.click('[data-save]'); page.wait_for_timeout(250)
        assert snapshot()==before and get_site(sid4).get('deal') is None
        assert 'Sözleşme bedeli pozitif olmalı' in page.locator('body').inner_text()
        no_work_or_payments(all_data())
        record('OBSERVED', 'Hourly/day-only contract is not a main supported deal; preview warns, form falls back to Götürü, blank price prevents save, no machine price rules created')
        assert len(all_data()['cari_movements'])==1
        assert not errors, errors
        assert not blocked, blocked
        record('PASS', 'No page errors; no unexpected outbound requests; model responses mocked; all business data synthetic')
    except Exception as e:
        record('FAIL','Diagnostic stopped',{'error':repr(e),'url':page.url,'page_errors':errors,'blocked':blocked})
        page.screenshot(path=str(OUT/'failure.png'),full_page=True)
        (OUT/'failure-page.txt').write_text(page.locator('body').inner_text())
        raise
    finally:
        (OUT/'results.json').write_text(json.dumps({'baseline':'32e42155bc58c7a52daa152f66acb04e2ae7f110','gemini':'MOCKED_NO_EXTERNAL_MODEL_CALL','events':events,'intercepted_requests':len(sent),'blocked_requests':blocked,'page_errors':errors},ensure_ascii=False,indent=2))
        browser.close()
