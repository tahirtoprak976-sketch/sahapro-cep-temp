"""Real report screen and downloaded CSV/PDF; isolated synthetic IndexedDB only.

No browser API substitutes or external AI calls. PDF text is read from the local
document engine's real Unicode text operators, so no PDF dependency is required.
Run with the normal CI Chromium runtime, not the socket-restricted local executor.
"""
import re
import sys
from pathlib import Path
from urllib.parse import urlencode

from playwright.sync_api import sync_playwright


URL = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8841/").rstrip("/") + "/"
ARTIFACT = Path(sys.argv[2] if len(sys.argv) > 2 else "/tmp/solo-report-clarity")
ARTIFACT.mkdir(parents=True, exist_ok=True)
SCOPE = "hakedişe girmemiş işler dahil değildir"


def pdf_text(path):
    payload = path.read_bytes()
    assert payload.startswith(b"%PDF-") and len(payload) > 1000
    operators = re.findall(rb"1 0 0 1 ([\d.-]+) ([\d.-]+) Tm <([0-9a-fA-F]+)> Tj", payload)
    assert operators, "Downloaded PDF must contain actual rendered Unicode text"
    chunks = []
    for x, y, encoded in operators:
        assert 0 <= float(x) < 842 and 0 <= float(y) < 596, (x, y)
        chunks.append(bytes.fromhex(encoded.decode("ascii")).decode("utf-16-be"))
    return " ".join(" ".join(chunks).split())


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(executable_path="/usr/bin/chromium", args=["--no-sandbox"])
    context = browser.new_context(viewport={"width": 360, "height": 850}, accept_downloads=True)
    context.add_init_script("localStorage.setItem('sp_role','boss')")
    page = context.new_page()
    errors, external_calls = [], []
    page.on("pageerror", lambda error: errors.append(str(error)))
    context.route("https://generativelanguage.googleapis.com/**",
                  lambda route: (external_calls.append(route.request.url), route.abort()))
    page.goto(URL + "index.html#/daha")
    page.wait_for_selector('#screen[data-view-ready="1"]')

    ids = page.evaluate("""async()=>{
      const db=await import('./js/db.js'), C=await import('./js/core.js'), date=C.todayStr();
      const customer=await db.saveNew('customers',{name:'TEST Rapor Açıklığı'},'TEST');
      const balance=await db.saveNew('customers',{name:'TEST Cari Kapsamı'},'TEST');
      const vehicle=await db.saveNew('vehicles',{name:'TEST Rapor Kamyonu'},'TEST');
      const common={date,customer_id:customer.id,vehicle_id:vehicle.id,quantity:2,unit:'Sefer',work_type:'Moloz Nakliye'};
      const rows={};
      for(const [key,fields] of [
        ['zero',{price_snapshot:{unit_price:0,amount:0}}],
        ['missing',{}],
        ['included',{price_snapshot:{unit_price:0,amount:0,price_source:'Sözleşmeye dahil'}}],
        ['mixed',{price_snapshot:{unit_price:1000,amount:2000},customer_fuel_allowance_l:150}],
        ['fuel',{customer_fuel_allowance_l:75}],
      ])rows[key]=(await db.saveNew('work_records',{...common,...fields},'TEST')).id;
      const privateReason='PRIVATEWHY <img src=x onerror="window.__reportInjected=1">';
      await db.saveNew('cari_movements',{date,customer_id:customer.id,type:'Duzeltme',amount:100,reason:privateReason,note:'PRIVATENOTE'},'TEST');
      await db.saveNew('cari_movements',{date,customer_id:customer.id,type:'Tahsilat',amount:-25,reason:privateReason,note:'PUBLICNOTE <b>& "metin"</b>'},'TEST');
      await db.saveNew('work_records',{...common,customer_id:balance.id,price_snapshot:{unit_price:1000,amount:2000}},'TEST');
      await db.saveNew('cash_records',{date,customer_id:balance.id,cash_type:'Müşteriden Para Alındı',amount:500,payment_method:'Nakit',cash_status:'KASAYA_TESLIM_EDILDI'},'TEST');
      return {customer:customer.id,balance:balance.id,date,rows};
    }""")
    page.wait_for_timeout(200)  # Consume fixture notifications on this non-refreshable route.

    def snapshot():
        return page.evaluate("""async()=>{
          const db=await import('./js/db.js');
          const s=await db.readSnapshot({attachments:true,meta:false,drafts:true});
          delete s.captured_at;
          return s;
        }""")

    before = snapshot()

    def visit_route(target):
        old = page.query_selector("#screen")
        if page.evaluate("location.hash") == target:
            page.reload()
        else:
            page.evaluate("hash=>location.hash=hash", target)
            page.wait_for_function("old=>!old.isConnected", arg=old)
        page.wait_for_selector('#screen[data-view-ready="1"]')
        assert "Ekran yüklenirken hata" not in page.locator("#screen").inner_text()

    def visit(customer, audience="customer"):
        visit_route("#/detayli-rapor?" + urlencode({"k": "musteri", "id": customer, "p": "all", "a": audience}))
        page.wait_for_selector('#screen[data-view-ready="1"] [data-pdf]')
        assert page.locator("#bottomnav button.on").get_attribute("data-go") == "#/daha"

    def row_cells(key):
        return page.locator('tr[data-go="#/isler/' + ids["rows"][key] + '"] td').all_inner_texts()

    def export(selector, filename):
        with page.expect_download(timeout=60000) as result:
            page.click(selector)
        path = ARTIFACT / filename
        result.value.save_as(path)
        return path

    visit(ids["customer"])
    assert row_cells("zero")[-2:] == ["0,00 ₺", "0,00 ₺"]
    assert row_cells("missing")[-2:] == ["", "Fiyat eksik"]
    assert row_cells("included")[-1] == "Sözleşmeye dahil"
    assert row_cells("mixed")[-1] == "2.000,00 ₺ · 150 L mazot"
    assert row_cells("fuel")[-1] == "75 L mazot"
    work_table = page.locator("table").filter(has=page.locator('tr[data-go="#/isler/' + ids["rows"]["mixed"] + '"]'))
    assert work_table.locator("tr").last.locator("td").last.inner_text() == "2.000,00 ₺ · 225 L mazot"
    text = page.locator("#screen").inner_text()
    assert "Fiyatı eksik iş" in text and "Fiyat eksik, bedelsiz demek değildir" in text
    assert SCOPE in text
    assert "PRIVATEWHY" not in text and "PRIVATENOTE" not in text
    assert 'PUBLICNOTE <b>& "metin"</b>' in text
    assert page.locator("#screen img").count() == 0
    assert page.evaluate("window.__reportInjected||0") == 0
    assert "Döküm Maliyeti" not in work_table.inner_text()
    assert snapshot() == before

    for width in [320, 360, 390, 768]:
        page.set_viewport_size({"width": width, "height": 850})
        assert page.evaluate("document.documentElement.scrollWidth<=innerWidth+1"), width
        page.screenshot(path=str(ARTIFACT / ("customer-" + str(width) + ".png")), full_page=True)
    page.set_viewport_size({"width": 360, "height": 850})
    print("PASS real 320/360/390/768px report: zero/missing/included, mixed TL/litres and total; private reasons absent, HTML inert, no record/audit writes", flush=True)

    csv = export("[data-csv]", "customer.csv").read_text(encoding="utf-8-sig")
    pdf = pdf_text(export("[data-pdf]", "customer.pdf"))
    for output in [csv, pdf]:
        for value in ["Fiyat eksik", "Sözleşmeye dahil", "150 L mazot", "225 L mazot", "2.000,00", SCOPE, "bedelsiz", "PUBLICNOTE"]:
            assert value in output, (value, output)
        assert "PRIVATEWHY" not in output and "PRIVATENOTE" not in output
        assert "2.225,00" not in output
    assert snapshot() == before
    print("PASS actual downloaded customer CSV/PDF contain separate TL/litre values and scope notes, never private reasons; PDF text operators stay on page; no writes", flush=True)

    visit(ids["customer"], "internal")
    text = page.locator("#screen").inner_text()
    assert "PRIVATEWHY" in text and "PUBLICNOTE" not in text, "Internal view retains its original reason-first policy"
    assert page.locator("#screen img").count() == 0
    assert page.evaluate("window.__reportInjected||0") == 0
    csv = export("[data-csv]", "internal.csv").read_text(encoding="utf-8-sig")
    pdf = pdf_text(export("[data-pdf]", "internal.pdf"))
    assert "PRIVATEWHY" in csv and "PRIVATEWHY" in pdf
    assert snapshot() == before

    visit(ids["balance"])
    text = page.locator("#screen").inner_text()
    assert "Kayıtlı cari bakiye" in text and "-500,00 ₺" in text and SCOPE in text
    ledger = page.locator("table").filter(has=page.get_by_role("columnheader", name="Kayıtlı bakiye", exact=True))
    assert ledger.locator("tr").last.locator("td").last.inner_text() == "-500,00 ₺"
    broad = page.evaluate("""async id=>{
      const db=await import('./js/db.js'), CR=await import('./js/customer-report.js');
      return CR.customerReportData(await db.dumpAll(),id).statement.closing;
    }""", ids["balance"])
    assert broad == 1500, "Report clarity must not unify or rewrite the two accounting scopes"
    for output in [export("[data-csv]", "balance.csv").read_text(encoding="utf-8-sig"), pdf_text(export("[data-pdf]", "balance.pdf"))]:
        assert SCOPE in output and "-500,00" in output and "Kayıtlı bakiye" in output
    visit(ids["customer"])
    assert "PRIVATEWHY" not in page.locator("#screen").inner_text(), "Audience switches must not leave stale internal rows"
    for route in ["#/tahsilat", "#/esnaf", "#/bankalar"]:
        visit_route(route)
        assert page.locator("#bottomnav button.on").get_attribute("data-go") == "#/finans", route
    visit(ids["customer"])
    print("PASS real active navigation: collection/supplier/bank screens select Finance; detailed report remains More", flush=True)
    assert snapshot() == before, "All views, audience changes, reloads and exports are read-only, including audit and drafts"
    assert not errors, errors
    assert not external_calls, external_calls
    print("PASS internal provenance preserved; recorded -500 vs broader +1500 remain unchanged with clear scope; returning to customer view removes internal rows; full database/audit/draft equality", flush=True)
    browser.close()
