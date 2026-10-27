"""RT-02/RT-03 regressions: actual contract UI and PDF, isolated synthetic IndexedDB.

Only a local server is allowed; all outside requests are blocked. Normal Chromium
launch only. --baseline-proof explicitly demonstrates old v3.9.74 defects.
"""
import argparse
import json
import os
import re
import uuid
from pathlib import Path
from urllib.parse import urlencode, urlparse
from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('url', nargs='?', default='http://localhost:8841/')
parser.add_argument('--baseline-proof', action='store_true')
parser.add_argument('--artifacts', default='/tmp/solo-redteam-finance')
args = parser.parse_args()
URL = args.url.rstrip('/') + '/'
origin = urlparse(URL)
assert origin.scheme == 'http' and origin.hostname in ('localhost', '127.0.0.1', '::1')
assert not origin.username and not origin.password and not origin.query and not origin.fragment
ARTIFACT = Path(args.artifacts)
ARTIFACT.mkdir(parents=True, exist_ok=True)

BOOTSTRAP = r"""async () => {
 const db=await import('./js/db.js'),C=await import('./js/core.js'),date=C.todayStr();
 const customer=await db.saveNew('customers',{name:'TEST redteam customer'},'TEST');
 const person=await db.saveNew('personnel',{name:'TEST redteam operator',daily_wage:100},'TEST');
 const vehicle=await db.saveNew('vehicles',{name:'TEST redteam cost truck',type:'Kamyon',load_ton:20,assignee_id:person.id},'TEST');
 const scale=await db.saveNew('vehicles',{name:'TEST redteam scope truck',type:'Kamyon',load_ton:20},'TEST');
 const dump=await db.saveNew('dump_sites',{name:'TEST redteam dump',fee:100,fee_unit:'Ton',fee_effective_from:date},'TEST');
 const deal={basis:'Sefer',price:5000,kdv_rate:0,kdv_included:false,start_date:date,status:'Açık'};
 const site=await db.saveNew('sites',{name:'TEST unknown dump contract',customer_id:customer.id,deal},'TEST');
 const work={id:C.uuid(),date,customer_id:customer.id,vehicle_id:vehicle.id,personnel_id:person.id,site_id:site.id,dump_site_id:dump.id,quantity:3,unit:'Sefer',description:'TEST preserved original description',price_snapshot:{amount:15000,unit_price:5000,kdv_rate:0,kdv_included:false},created_at:C.nowISO()};
 // Existing historical work, deliberately without a saved estimate; not a migration or real user input.
 await db.put('work_records',work);
 await db.put('fuel_records',{id:C.uuid(),date,vehicle_id:vehicle.id,liters:60,total:3000,unit_price:50});
 const scopes={};
 for (const scope of ['total','per_trip','unknown','mixed']) {
  const s=await db.saveNew('sites',{name:'TEST scope '+scope,customer_id:customer.id,deal:{...deal,basis:'m³',price:100,material:'toprak'}},'TEST');
  const w={id:C.uuid(),date,customer_id:customer.id,vehicle_id:scale.id,site_id:s.id,quantity:2,unit:'Sefer',tonnage:25,tonnage_scope:scope==='mixed'?'total':scope,material:'toprak',description:'TEST scope source '+scope,price_snapshot:{amount:0,unit_price:0,price_source:'Sözleşmeye dahil'},created_at:C.nowISO()};
  await db.put('work_records',w);
  if(scope==='mixed') await db.put('work_records',{...w,id:C.uuid(),tonnage_scope:'unknown'});
  scopes[scope]=s.id;
 }
 return {date,customer:customer.id,vehicle:vehicle.id,scale:scale.id,dump:dump.id,site:site.id,work:work.id,scopes};
}"""
STATE = r"""async ids => {
 const db=await import('./js/db.js'),J=await import('./js/job-core.js'),K=await import('./js/job-cost.js'),F=await import('./js/dump-fees.js'),E=await import('./js/expert-core.js'),A=await import('./js/assistant-core.js');
 const d=await db.dumpAll(),site=d.sites.find(s=>s.id===ids.site),rep=J.jobReport(d,site,{today:ids.date}),c=K.jobCosts(d,site,rep,{today:ids.date,fuelRef:50});
 const scopes=Object.fromEntries(Object.entries(ids.scopes).map(([key,id])=>{const s=d.sites.find(s=>s.id===id),r=J.jobReport(d,s,{today:ids.date});return [key,{report:r,cost:K.jobCosts(d,s,r,{today:ids.date,fuelRef:50})}];}));
 return {cost:c,fee:F.dumpFee(d,d.work_records.find(w=>w.id===ids.work)),scopes,advice:E.vehicleKpis(d,{from:ids.date,to:ids.date}).find(v=>v.id===ids.vehicle),facts:await A.businessFacts(d,ids.date)};
}"""
SNAPSHOT = r"""async () => {const db=await import('./js/db.js'),s=await db.readSnapshot({attachments:true,meta:false,drafts:true});delete s.captured_at;return s;}"""


def pdf_text(path):
    data = path.read_bytes()
    assert data.startswith(b'%PDF-') and len(data) > 1000
    operators = re.findall(rb'1 0 0 1 ([\d.-]+) ([\d.-]+) Tm <([0-9a-fA-F]+)> Tj', data)
    assert operators, 'Real PDF Unicode text operators are required'
    chunks = []
    for x, y, encoded in operators:
        assert 0 <= float(x) < 842 and 0 <= float(y) < 596, (x, y)
        chunks.append(bytes.fromhex(encoded.decode()).decode('utf-16-be'))
    return ' '.join(' '.join(chunks).split())


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH', '/usr/bin/chromium'), args=['--no-sandbox'])
    context = browser.new_context(viewport={'width': 390, 'height': 850}, accept_downloads=True, service_workers='block')
    context.add_init_script("localStorage.setItem('sp_role','boss')")
    errors, external = [], []

    def route(request):
        parsed = urlparse(request.request.url)
        if (parsed.scheme, parsed.hostname, parsed.port) == (origin.scheme, origin.hostname, origin.port):
            request.continue_()
        else:
            external.append(request.request.url)
            request.abort()

    context.route('**/*', route)
    page = context.new_page()
    page.on('pageerror', lambda error: errors.append(str(error)))
    database = 'rtfinance_' + uuid.uuid4().hex[:20]
    base = URL + 'index.html?db=' + database

    def visit(target):
        page.goto(URL + 'README.md?db=' + database)
        page.goto(base + target)
        page.wait_for_selector('#screen[data-view-ready="1"]')
        assert 'Ekran yüklenirken hata' not in page.locator('#screen').inner_text()

    def export(selector, filename):
        with page.expect_download(timeout=60000) as download:
            page.click(selector)
        path = ARTIFACT / filename
        download.value.save_as(path)
        return path

    try:
        visit('#/daha')
        page.goto(URL + 'README.md?db=' + database)
        ids = page.evaluate(BOOTSTRAP)
        state = page.evaluate(STATE, ids)
        before = page.evaluate(SNAPSHOT)
        visit('#/is-sozlesmesi/' + ids['site'])
        hero = page.locator('[data-hero]').inner_text()
        if args.baseline_proof:
            assert state['cost']['profit'] == 11900 and not state['cost']['costIncomplete'], state
            assert '11.900' in hero and 'Kârda' in hero, hero
            assert state['scopes']['total']['report']['ton'] == 50, state
            assert state['scopes']['total']['report']['est'] == 25.6, state
            print('BASELINE ONLY RT02/03: total25 doubled to50 and unknown dump showed 11900 Kârda', flush=True)
        else:
            assert state['cost']['cost'] == 3100 and state['cost']['knownCostSubtotal'] == 3100, state
            assert state['cost']['costIncomplete'] and state['fee']['remaining_estimated_amount'] is None
            for key in ['profit', 'margin', 'profitPerM3', 'costPerM3']:
                assert state['cost'][key] is None, key
            assert 'Hesaplanamadı' in hero and 'döküm maliyeti eksik' in hero and '3.100' in hero, hero
            assert 'Kârda' not in hero and '11.900' not in hero and 'yakıt mutabakat' not in hero, hero
            page.screenshot(path=str(ARTIFACT / 'dump-incomplete-contract.png'), full_page=True)
            visit('#/is-sozlesmeleri')
            listing = page.locator('#screen').inner_text()
            assert 'Hesaplanamadı — döküm maliyeti eksik' in listing and '11.900' not in listing, listing
            for scope, expected in [('total', (25, 12.8, 1280)), ('per_trip', (50, 25.6, 2560))]:
                r, c = state['scopes'][scope]['report'], state['scopes'][scope]['cost']
                assert (r['ton'], r['est'], c['income']) == expected, (scope, r, c)
                visit('#/is-sozlesmesi/' + ids['scopes'][scope])
                assert f'{expected[2]:,}'.replace(',', '.') + ',00' in page.locator('[data-money]').inner_text()
            for scope in ['unknown', 'mixed']:
                r, c = state['scopes'][scope]['report'], state['scopes'][scope]['cost']
                assert r['tonnageUnknown'] == 1 and r['estimationIncomplete'] and r['money'] is None, (scope, r)
                assert c['revenueIncomplete'] and c['income'] is None and c['profit'] is None and not c['targetEst'], c
                visit('#/is-sozlesmesi/' + ids['scopes'][scope])
                assert 'Hesaplanamadı' in page.locator('[data-hero]').inner_text()
                assert 'kapsam' in page.locator('[data-hero]').inner_text()
                assert 'Bilinen ara toplam' in page.locator('[data-est]').inner_text()
                assert 'Hesaplanamadı' in page.locator('[data-money]').inner_text()
            assert state['advice']['kar_TL'] is None and state['advice']['maliyet_dogrulanmadi']
            assert state['facts']['aylik'][-1]['tahmini_kar_TL'] is None
            visit('#/detayli-rapor?' + urlencode({'k': 'arac', 'id': ids['vehicle'], 'p': 'all', 'a': 'internal'}))
            assert 'Hesaplanamadı — döküm maliyeti eksik' in page.locator('#screen').inner_text()
            pdf = pdf_text(export('[data-pdf]', 'incomplete-cost-internal.pdf'))
            assert 'Hesaplanamadı' in pdf and 'döküm maliyeti eksik' in pdf and '12.000' not in pdf, pdf
            assert 'Bilinen gider ara toplamı' in pdf and '3.000' in pdf, pdf
            visit('#/detayli-rapor?' + urlencode({'k': 'arac', 'id': ids['vehicle'], 'p': 'all', 'a': 'customer'}))
            customer_pdf = pdf_text(export('[data-pdf]', 'cost-private-customer.pdf'))
            assert 'döküm maliyeti eksik' not in customer_pdf and 'yakıt mutabakat' not in customer_pdf, customer_pdf
            assert page.evaluate(SNAPSHOT) == before, 'UI/report/PDF/advice reads must preserve all original records, audit and drafts'
            # A later card estimate cannot alter an explicitly recorded total.
            page.evaluate(r"""async ids=>{const db=await import('./js/db.js');await db.saveExisting('vehicles',await db.get('vehicles',ids.scale),{load_ton:9},'TEST later card estimate');}""", ids)
            later = page.evaluate(STATE, ids)
            assert later['scopes']['total']['report']['ton'] == 25 and later['scopes']['total']['report']['est'] == 12.8
            print('PASS RT02/03 real contract/list/PDF/advice, total/per-trip/unknown/mixed scope, vehicle-load invariance and original record preservation', flush=True)
        if args.baseline_proof:
            assert page.evaluate(SNAPSHOT) == before
        assert not errors, errors
        assert not external, external
        (ARTIFACT / 'result.json').write_text(json.dumps({'baseline_only': args.baseline_proof, 'state': state, 'page_errors': errors, 'external_requests': external}, ensure_ascii=False, indent=2))
    except Exception:
        page.screenshot(path=str(ARTIFACT / 'failure.png'), full_page=True)
        (ARTIFACT / 'failure.json').write_text(json.dumps({'url': page.url, 'screen': page.locator('body').inner_text(), 'page_errors': errors, 'external_requests': external}, ensure_ascii=False, indent=2))
        raise
    finally:
        context.close()
        browser.close()
