"""Dump cost regressions in normal Chromium and real IndexedDB; TEST fixtures only.

Run against a local checkout in the repository's normal GitHub Actions browser
runtime. --baseline-proof reproduces the old bugs; it is never a candidate pass.
No provider calls, credentials, production URLs or historical data are used.
"""
import argparse
import json
import os
import uuid
from pathlib import Path
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("url", nargs="?", default="http://localhost:8841/")
parser.add_argument("--baseline-proof", action="store_true")
parser.add_argument("--artifacts", default="/tmp/solo-dump-cost-reliability")
args = parser.parse_args()
URL = args.url.rstrip("/") + "/"
origin = urlparse(URL)
assert origin.scheme == "http" and origin.hostname in ("localhost", "127.0.0.1", "::1"), "Local synthetic server only"
assert not origin.username and not origin.password and not origin.query and not origin.fragment
ARTIFACT = Path(args.artifacts)
ARTIFACT.mkdir(parents=True, exist_ok=True)

BOOTSTRAP = r"""async () => {
  const db=await import('./js/db.js'),C=await import('./js/core.js'),D=await import('./js/dump-ledger-db.js');
  const date=C.todayStr(),customer=await db.saveNew('customers',{name:'TEST Dump Customer'},'TEST'),
    vehicle=await db.saveNew('vehicles',{name:'TEST Dump Truck',type:'Kamyon',load_ton:20},'TEST'),
    site=await db.saveNew('dump_sites',{name:'TEST Dump Site',fee:100,fee_unit:'Ton',fee_effective_from:date},'TEST');
  const work=await db.saveNew('work_records',{date,customer_id:customer.id,vehicle_id:vehicle.id,dump_site_id:site.id,
    work_type:'TEST Hafriyat',unit:'Sefer',quantity:3,tonnage:null,tonnage_scope:'unknown',
    price_snapshot:{unit_price:5000,amount:15000,kdv_rate:0,kdv_included:false}},'TEST');
  await D.saveDumpEntry({kind:'TOPUP',date,dump_site_id:site.id,amount:10000,reference:'TEST-DEPOSIT',payment_method:'Havale'},[],'TEST-DEPOSIT');
  return {date,customer:customer.id,vehicle:vehicle.id,site:site.id,work:work.id,snapshot:work.dump_estimate_snapshot||null};
}"""

STATE = r"""async ids => {
  const db=await import('./js/db.js'),C=await import('./js/core.js'),F=await import('./js/dump-fees.js'),
    K=await import('./js/costs-core.js'),M=await import('./js/finance-chart.js'),A=await import('./js/dump-account.js'),
    E=await import('./js/enterprise-core.js');
  const d=await db.dumpAll(),w=d.work_records.find(x=>x.id===ids.work),f=F.dumpFee(d,w),rows=K.costRows(d),
    monthly=M.monthlySeries(d,{today:ids.date,months:1})[0],account=A.dumpAccounts(d,{today:ids.date,siteId:ids.site})[0];
  return {fee:f,work:w,total:K.costTotals(rows).total,chart:monthly.cost,ledger:E.costLedger(d).reduce((n,r)=>n+r.gross,0),
    balance:account.balance,pending:account.usedEst,unknown:account.pending_unknown,
    receiptIds:d.dump_entries.filter(e=>C.isActive(e)&&e.kind==='RECEIPT').map(e=>e.id),
    cash:d.cash_records.length,cari:d.cari_movements.length,rows};
}"""

RECEIPT = r"""async ({ids,extra}) => {
  const D=await import('./js/dump-ledger-db.js');
  return D.saveDumpEntry({kind:'RECEIPT',date:ids.date,dump_site_id:ids.site,vehicle_id:ids.vehicle,
    work_record_id:ids.work,amount:2500,trips:1,tonnage:25,payer:'company_account',receipt_no:'TEST-RECEIPT',...extra});
}"""

READONLY = r"""async () => {
  const db=await import('./js/db.js');const d=await db.readSnapshot({attachments:true,meta:false,drafts:true});delete d.captured_at;return JSON.stringify(d);
}"""

BASELINE = r"""async ids => {
  const db=await import('./js/db.js'),F=await import('./js/dump-fees.js'),K=await import('./js/costs-core.js'),
    M=await import('./js/finance-chart.js'),D=await import('./js/dump-ledger-db.js');
  const value=async()=>{const d=await db.dumpAll(),w=await db.get('work_records',ids.work);return {fee:F.dumpFee(d,w).amount,cost:K.costTotals(K.costRows(d)).total,chart:M.monthlySeries(d,{today:ids.date,months:1})[0].cost};};
  const initial=await value();
  await db.saveExisting('vehicles',await db.get('vehicles',ids.vehicle),{load_ton:15},'TEST later load');const drift=await value();
  await db.saveExisting('vehicles',await db.get('vehicles',ids.vehicle),{load_ton:20},'TEST restore load');
  const e=await db.saveNew('expense_records',{date:ids.date,vehicle_id:ids.vehicle,dump_site_id:ids.site,category:'Döküm',amount:2500,payment_method:'Nakit'},'TEST');
  const r=await D.saveDumpEntry({kind:'RECEIPT',date:ids.date,dump_site_id:ids.site,vehicle_id:ids.vehicle,work_record_id:ids.work,
    amount:2500,trips:1,tonnage:25,payer:'company_account',receipt_no:'TEST-BASELINE',expense_id:e.id});
  const partial=await value(),d=await db.dumpAll();
  d.work_records=[];d.expense_records=[];d.dump_entries=[{...r,work_record_id:null}];
  return {initial,drift,partial,unassigned:{cost:K.costTotals(K.costRows(d)).total,chart:M.monthlySeries(d,{today:ids.date,months:1})[0].cost}};
}"""

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(executable_path=os.environ.get("CHROMIUM_PATH", "/usr/bin/chromium"), args=["--no-sandbox"])
    errors, external_calls, results, failures = [], [], {}, []

    def profile():
        context = browser.new_context(viewport={"width": 390, "height": 850}, service_workers="block")
        context.add_init_script("localStorage.setItem('sp_role','boss')")

        def route(request):
            parsed = urlparse(request.request.url)
            if (parsed.scheme, parsed.hostname, parsed.port) == (origin.scheme, origin.hostname, origin.port):
                request.continue_()
            else:
                external_calls.append(request.request.url)
                request.abort()

        context.route("**/*", route)
        page = context.new_page()
        page.on("pageerror", lambda error: errors.append(str(error)))
        database = "dump_" + uuid.uuid4().hex[:24]
        page.goto(URL + "index.html?db=" + database + "#/daha")
        page.wait_for_selector('#screen[data-view-ready="1"]')
        page.goto(URL + "README.md?db=" + database)
        ids = page.evaluate(BOOTSTRAP)
        return context, page, database, ids

    def visit(page, database, route):
        page.goto(URL + "README.md?db=" + database)
        page.goto(URL + "index.html?db=" + database + route)
        page.wait_for_selector('#screen[data-view-ready="1"]')
        assert "Ekran yüklenirken hata" not in page.locator("#screen").inner_text()

    def record(name, operation):
        try:
            result = operation()
            results[name] = result
            print("PASS " + name + ": " + json.dumps(result, ensure_ascii=False), flush=True)
        except Exception as error:
            failures.append({"name": name, "error": str(error)})
            print("FAIL " + name + ": " + str(error), flush=True)

    def check_totals(state, actual, pending, total, balance):
        f = state["fee"]
        assert [f["confirmed_amount"], f["remaining_estimated_amount"], f["amount"]] == [actual, pending, total], state
        assert [state["total"], state["chart"], state["ledger"]] == [total] * 3, state
        assert state["balance"] == balance, state
        assert state["pending"] == pending, state
        assert state["cash"] == 0 and state["cari"] == 0, "Dump estimates/receipts never create customer debt or cash records"

    if args.baseline_proof:
        context, page, _, ids = profile()
        try:
            old = page.evaluate(BASELINE, ids)
            assert old == {
                "initial": {"fee": 6000, "cost": 6000, "chart": 6000},
                "drift": {"fee": 4500, "cost": 4500, "chart": 4500},
                "partial": {"fee": 2500, "cost": 2500, "chart": 5000},
                "unassigned": {"cost": 2500, "chart": 0},
            }, old
            results["BASELINE_ONLY_defects_reproduced"] = old
            print("BASELINE ONLY: load drift, dropped remaining estimate, linked expense double count, missing unassigned receipt reproduced", flush=True)
        finally:
            context.close()
    else:
        def work_form_and_repeat():
            context, page, database, ids = profile()
            try:
                visit(page, database, "#/isler/new?customer_id=" + ids["customer"])
                page.wait_for_selector('[data-form]')
                page.select_option('[name="vehicle_id"]', ids["vehicle"])
                page.select_option('[name="work_type"]', "Moloz Nakliye")
                page.select_option('[name="unit"]', "Sefer")
                page.select_option('[name="dump_site_id"]', ids["site"])
                page.fill('[name="quantity"]', "2")
                page.fill('[name="manual_price"]', "5000")
                page.fill('[name="manual_kdv"]', "0")
                page.click('[data-save]')
                page.wait_for_selector('[data-dump-cost-breakdown]')
                work = page.evaluate(r"""async()=>{
                  const db=await import('./js/db.js');return (await db.getAll('work_records')).find(w=>w.work_type==='Moloz Nakliye');
                }""")
                assert work and [work["dump_estimate_snapshot"]["load_ton"], work["dump_estimate_snapshot"]["amount"]] == [20, 4000], work
                assert work["tonnage"] is None and work["dump_estimate_snapshot"]["provenance"] == "saved_estimate"
                page.evaluate(r"""async ids=>{const db=await import('./js/db.js');await db.saveExisting('vehicles',await db.get('vehicles',ids.vehicle),{load_ton:10},'TEST new estimate for future work')}""", ids)
                visit(page, database, "#/isler/new?repeat=" + work["id"])
                page.wait_for_selector('[data-repeat-info]')
                assert page.input_value('[name="quantity"]') == "" and page.input_value('[name="tonnage"]') == ""
                page.fill('[name="quantity"]', "1")
                page.fill('[name="manual_price"]', "5000")
                page.fill('[name="manual_kdv"]', "0")
                page.click('[data-save]')
                page.wait_for_selector('[data-dump-cost-breakdown]')
                saved = page.evaluate(r"""async id=>{
                  const db=await import('./js/db.js'),ws=await db.getAll('work_records');return {old:ws.find(w=>w.id===id),fresh:ws.find(w=>w.work_type==='Moloz Nakliye'&&w.id!==id)};
                }""", work["id"])
                assert saved["old"]["dump_estimate_snapshot"] == work["dump_estimate_snapshot"], saved
                assert [saved["fresh"]["dump_estimate_snapshot"]["load_ton"], saved["fresh"]["dump_estimate_snapshot"]["amount"]] == [10, 1000], saved
                page.screenshot(path=str(ARTIFACT / "new-repeat-estimate.png"), full_page=True)
                return {"UIWorkEstimate": 4000, "repeatUsesNewLoad": 1000, "oldSnapshotPreserved": True}
            finally:
                context.close()
        record("real_work_form_and_repeat_capture_new_assumptions", work_form_and_repeat)

        def snapshot_and_partial_ui():
            context, page, database, ids = profile()
            try:
                snapshot = ids["snapshot"]
                assert snapshot and [snapshot["load_ton"], snapshot["fee"], snapshot["amount"]] == [20, 100, 6000], snapshot
                check_totals(page.evaluate(STATE, ids), 0, 6000, 6000, 10000)
                after = page.evaluate(r"""async ids=>{
                  const db=await import('./js/db.js');
                  await db.saveExisting('vehicles',await db.get('vehicles',ids.vehicle),{load_ton:15},'TEST later vehicle load');
                  await db.saveExisting('dump_sites',await db.get('dump_sites',ids.site),{fee:200,fee_unit:'Ton',fee_effective_from:ids.date},'TEST later tariff');
                  return db.saveExisting('work_records',await db.get('work_records',ids.work),{description:'TEST harmless note'},'TEST note');
                }""", ids)
                assert after["dump_estimate_snapshot"] == snapshot, "Ordinary edit must not recapture mutable assumptions"
                check_totals(page.evaluate(STATE, ids), 0, 6000, 6000, 10000)
                visit(page, database, "#/isler/" + ids["work"])
                text = page.locator("[data-dump-cost-breakdown]").inner_text()
                assert all(x in text for x in ["Kesinleşen", "Kalan tahmin", "Beklenen toplam", "6.000,00", "Araç kartı tahmini", "20 ton / sefer"]), text
                visit(page, database, "#/dokum-hesap/" + ids["site"])
                page.click('[data-work-receipt="' + ids["work"] + '"]')
                page.fill('.sheet [name="amount"]', "2500")
                page.fill('.sheet [name="receipt_no"]', "TEST-UI-PARTIAL")
                page.fill('.sheet [name="tonnage"]', "25")
                before_cancel = page.evaluate(READONLY)
                page.click('.sheet [data-close]')
                assert page.evaluate(READONLY) == before_cancel, "Dismissed receipt creates no records"
                page.click('[data-work-receipt="' + ids["work"] + '"]')
                page.fill('.sheet [name="amount"]', "2500")
                page.fill('.sheet [name="receipt_no"]', "TEST-UI-PARTIAL")
                page.fill('.sheet [name="tonnage"]', "25")
                page.check('.sheet [data-confirm]')
                page.evaluate("""()=>{const f=document.querySelector('.sheet form');f.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));f.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));}""")
                page.wait_for_function(r"""async id=>(await(await import('./js/db.js')).getAll('dump_entries')).filter(e=>!e.deleted_at&&e.kind==='RECEIPT'&&e.work_record_id===id).length===1""", arg=ids["work"])
                page.wait_for_selector('.sheet', state="detached")
                state = page.evaluate(STATE, ids)
                check_totals(state, 2500, 4000, 6500, 7500)
                assert len(state["receiptIds"]) == 1, "Repeated submit is one receipt"
                for route, selector in [("#/isler/" + ids["work"], "[data-dump-cost-breakdown]"), ("#/gider", "[data-dump-cost-summary]"), ("#/finans", "[data-dump-cost-summary]")]:
                    visit(page, database, route)
                    text = page.locator(selector).inner_text()
                    assert all(x in text for x in ["Kesinleşen", "Kalan tahmin", "Beklenen toplam", "2.500,00", "4.000,00", "6.500,00"]), text
                    assert "Fişli gerçek maliyet" not in text, "Mixed total must not be labelled wholly confirmed"
                    for width in [320, 390, 768]:
                        page.set_viewport_size({"width": width, "height": 850})
                        assert page.evaluate("()=>document.documentElement.scrollWidth<=innerWidth+1"), (route, width)
                page.screenshot(path=str(ARTIFACT / "partial-finance.png"), full_page=True)
                visit(page, database, "#/")
                home = page.locator('[data-monthly-costs]').inner_text()
                assert all(x in home for x in ["6.500,00", "2.500,00", "4.000,00"]), home
                assert page.locator('[data-dump-review]').count() == 0, home
                visit(page, database, "#/dokum-hareket/" + state["receiptIds"][0])
                page.click('[data-cancel-entry]')
                page.fill('.sheet [name="reason"]', "TEST receipt cancellation")
                page.click('.sheet [type="submit"]')
                page.wait_for_function(r"""async id=>!!(await(await import('./js/db.js')).get('dump_entries',id)).deleted_at""", arg=state["receiptIds"][0])
                check_totals(page.evaluate(STATE, ids), 0, 6000, 6000, 10000)
                assert (page.evaluate(STATE, ids))["work"]["dump_estimate_snapshot"] == snapshot
                return {"newSnapshot": [20, 100, 6000], "partial": [2500, 4000, 6500], "cancelReturnsEstimate": 6000, "duplicateSubmitReceipts": 1, "fourScreens": True}
            finally:
                context.close()
        record("immutable_snapshot_partial_receipt_UI_and_cancellation", snapshot_and_partial_ui)

        def linked_and_unassigned():
            context, page, database, ids = profile()
            try:
                page.evaluate(r"""async ids=>{
                  const db=await import('./js/db.js');await db.saveExisting('work_records',await db.get('work_records',ids.work),{quantity:1},'TEST one trip');
                }""", ids)
                expense = page.evaluate(r"""async ids=>{
                  const db=await import('./js/db.js');return db.saveNew('expense_records',{date:ids.date,vehicle_id:ids.vehicle,dump_site_id:ids.site,category:'Döküm',amount:2200,payment_method:'Nakit'},'TEST');
                }""", ids)
                page.evaluate(RECEIPT, {"ids": ids, "extra": {"amount": 2200, "tonnage": 22, "expense_id": expense["id"], "receipt_no": "TEST-LINKED"}})
                check_totals(page.evaluate(STATE, ids), 2200, 0, 2200, 7800)
                page.evaluate(RECEIPT, {"ids": ids, "extra": {"amount": 1300, "tonnage": 13, "work_record_id": None, "receipt_no": "TEST-UNASSIGNED"}})
                state = page.evaluate(STATE, ids)
                assert [state["total"], state["chart"], state["ledger"], state["balance"]] == [3500, 3500, 3500, 6500], state
                assert len([r for r in state["rows"] if r["kind"] == "dokum"]) == 2 and not [r for r in state["rows"] if r["kind"] == "gider"], state
                visit(page, database, "#/gider")
                text = page.locator("[data-dump-cost-summary]").inner_text()
                assert "3.500,00" in text and "0,00" in text and "hesaplanamayan" not in text, text
                page.screenshot(path=str(ARTIFACT / "receipt-deduplication.png"), full_page=True)
                return {"costChartLedger": [3500, 3500, 3500], "linkedExpenseCountedOnce": True, "unassignedReceiptIncluded": 1300}
            finally:
                context.close()
        record("linked_expense_and_unassigned_receipt_once", linked_and_unassigned)

        def payers_and_completion():
            context, page, _, ids = profile()
            try:
                direct = page.evaluate(RECEIPT, {"ids": ids, "extra": {"amount": 2300, "payer": "company_direct", "receipt_no": "TEST-DIRECT"}})
                page.evaluate(RECEIPT, {"ids": ids, "extra": {"amount": 9999, "payer": "customer", "receipt_no": "TEST-CUSTOMER"}})
                check_totals(page.evaluate(STATE, ids), 2300, 2000, 4300, 10000)
                page.evaluate(RECEIPT, {"ids": ids, "extra": {"amount": 2100, "receipt_no": "TEST-LAST"}})
                check_totals(page.evaluate(STATE, ids), 4400, 0, 4400, 7900)
                page.evaluate(r"""async id=>(await import('./js/dump-ledger-db.js')).cancelDumpEntry(id,'TEST cancel direct')""", direct["id"])
                check_totals(page.evaluate(STATE, ids), 2100, 2000, 4100, 7900)
                return {"mixedPayers": [2300, 2000, 4300], "allCovered": [4400, 0, 4400], "directCancellation": [2100, 2000, 4100]}
            finally:
                context.close()
        record("customer_direct_payers_complete_and_cancel", payers_and_completion)

        def legacy_unknown():
            context, page, database, ids = profile()
            try:
                legacy = page.evaluate(r"""async ids=>{
                  const db=await import('./js/db.js'),w=await db.get('work_records',ids.work);
                  delete w.dump_estimate_snapshot;delete w.dump_tariff_snapshot;w.tonnage=24;w.tonnage_scope='unknown';
                  await db.put('work_records',w);return w;
                }""", ids)
                page.evaluate(RECEIPT, {"ids": ids, "extra": {"amount": 2500, "receipt_no": "TEST-LEGACY-PARTIAL"}})
                before = page.evaluate(READONLY)
                state = page.evaluate(STATE, ids)
                assert state["fee"]["confirmed_amount"] == 2500 and state["fee"]["remaining_estimated_amount"] is None and state["fee"]["unverified"], state
                assert [state["total"], state["chart"], state["ledger"]] == [2500] * 3, state
                for route, selector in [("#/isler/" + ids["work"], "[data-dump-cost-breakdown]"), ("#/gider", "[data-dump-cost-summary]"), ("#/finans", "[data-dump-cost-summary]"), ("#/dokum-hesap/" + ids["site"], "[data-pending]")]:
                    visit(page, database, route)
                    text = page.locator(selector).inner_text()
                    assert "2.500,00" in text and ("doğrula" in text or "doğrulan" in text) and ("eksik" in text or "bilinmeyen" in text), text
                assert "Hesaplanamadı — kalan tahmin eksik" in page.locator('#screen').inner_text()
                page.screenshot(path=str(ARTIFACT / "legacy-unverified.png"), full_page=True)
                visit(page, database, "#/")
                warning = page.locator('[data-dump-review]').inner_text()
                assert "sıfır maliyet değildir" in warning and "tahmini kâr fazla" in warning, warning
                assert "2.500,00" in page.locator('[data-home-dump]').inner_text()
                visit(page, database, "#/yonetici")
                assert "sıfır maliyet değildir" in page.locator('[data-dump-review]').inner_text()
                assert page.evaluate(READONLY) == before, "Reads must not repair legacy fields, evidence, audit or notes"
                saved = page.evaluate(r"""async ids=>(await import('./js/db.js')).get('work_records',ids.work)""", ids)
                assert saved == legacy, "Legacy work remains byte-for-byte equivalent JSON"
                return {"confirmedPreserved": 2500, "remainingUnknown": True, "sixScreensWarn": True, "legacyUnchanged": True}
            finally:
                context.close()
        record("legacy_unknown_provenance_visible_without_rewrite", legacy_unknown)

    results["failures"] = failures
    results["browser_errors"] = errors
    results["external_attempts_blocked"] = external_calls
    (ARTIFACT / ("baseline.json" if args.baseline_proof else "results.json")).write_text(json.dumps(results, ensure_ascii=False, indent=2))
    browser.close()
    assert not errors, errors
    assert not external_calls, external_calls
    assert not failures, failures
    print("BASELINE EVIDENCE COMPLETE" if args.baseline_proof else "dump_cost_reliability browser PASS: real IDB, immutable estimates, partial replacement, provenance and cost parity", flush=True)
