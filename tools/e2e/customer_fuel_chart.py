"""Real customer dashboard, PNG and PDF; isolated synthetic fuel/TL records."""
import sys
from pathlib import Path
import fitz
from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8841/"
ARTIFACT = sys.argv[2] if len(sys.argv) > 2 else "/tmp/solo-v3961-chart"

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path="/usr/bin/chromium", args=["--no-sandbox"])
    context = browser.new_context(viewport={"width": 390, "height": 844}, accept_downloads=True)
    context.add_init_script("localStorage.setItem('sp_role','boss')")
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(URL + "index.html#/musteriler")
    page.wait_for_selector("[data-customer-directory]")
    ids = page.evaluate("""async()=>{
      const db=await import('./js/db.js'),C=await import('./js/core.js');
      const date=C.todayStr(),prev=new Date(date.slice(0,8)+'01T12:00:00');prev.setMonth(prev.getMonth()-1);
      const old=prev.toISOString().slice(0,7)+'-10';
      const customer=await db.saveNew('customers',{name:'TEST Güneş Grafik',fuel_rules:[{id:'r',per:75,unit:'Sefer',only_pay:true}]},'TEST');
      const vehicle=await db.saveNew('vehicles',{name:'TEST Grafik Kamyonu'},'TEST');
      for(const [when,q] of [[old,3],[date,2]])await db.saveNew('work_records',{customer_id:customer.id,vehicle_id:vehicle.id,date:when,work_type:'Gravak Nakliye',quantity:q,unit:'Sefer',customer_fuel_allowance_l:q*75,price_snapshot:{amount:0,unit_price:0,price_source:'Mazot karşılığı'}},'TEST');
      await db.saveNew('fuel_records',{customer_id:customer.id,vehicle_id:vehicle.id,date:old,liters:200,fuel_source:'Müşteri Verdi'},'TEST');
      await db.saveNew('fuel_tank_movements',{customer_id:customer.id,date,liters:100,move_type:'GİRİŞ'},'TEST');
      // The same tank fuel reaches our own vehicle: it is not another customer receipt.
      await db.saveNew('fuel_records',{customer_id:customer.id,vehicle_id:vehicle.id,date,liters:100,fuel_source:'Depo Tankı'},'TEST');
      return {customer:customer.id,vehicle:vehicle.id,date};
    }""")

    def snapshot():
        return page.evaluate("async()=>{const db=await import('./js/db.js');return JSON.stringify({d:await db.dumpAll(),audit:await db.getAll('audit_log')})}")

    before = snapshot()
    page.goto(URL + "index.html#/musteriler/" + ids["customer"])
    page.wait_for_selector('#screen[data-view-ready="1"] [data-customer-chart="fuel"]')
    page.wait_for_timeout(200)  # Let already-committed fixture notifications finish refreshing the view.
    fuel = page.locator('[data-customer-chart="fuel"]')
    assert "Hak edilen mazot: 375 L" in fuel.inner_text()
    assert "Alınan mazot: 300 L" in fuel.inner_text()
    assert page.locator('[data-customer-chart="money"]').count() == 0
    assert "75 L" in page.locator("[data-fuelpanel]").inner_text()
    assert fuel.locator('[data-series="earned"]').count() == 12
    assert fuel.locator('[data-series="received"]').last.get_attribute("height") != "0"
    assert "100 L" in fuel.locator('[data-series="received"]').last.text_content()
    page.click("[data-dper=month]")
    assert "hak edilen: 150 L · alınan: 100 L" in page.locator("[data-fuelpanel]").inner_text()
    assert "Mazot tahsilatı · Bu ay" in page.locator("[data-custdash]").text_content()
    fuel.locator("summary").click()
    assert fuel.locator("tbody tr").last.locator("td").nth(1).text_content() == "150"
    assert fuel.locator("tbody tr").last.locator("td").nth(2).text_content() == "100"
    assert snapshot() == before, "Reading and filtering must not write financial records or audit"
    for width in [320, 390, 768]:
        page.set_viewport_size({"width": width, "height": 844})
        overflow = page.evaluate("""()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,items:[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1).map(e=>({tag:e.tagName,cls:e.className,text:e.textContent.slice(0,70),right:e.getBoundingClientRect().right})).slice(0,10)})""")
        assert overflow["scroll"] <= width + 1, overflow
    page.set_viewport_size({"width": 390, "height": 844})
    fuel.screenshot(path=ARTIFACT + ".png")
    print("PASS fuel-only customer: earned/received month bars, 375L/300L totals, period 150L/100L, exact monthly table, 75L balance; no double-counting tank output or writes; 320/390/768px", flush=True)

    # Actual canvas values and legend, including small amounts (no rounded '0k').
    png = page.evaluate("""async id=>{
      const CR=await import('./js/customer-report.js'),db=await import('./js/db.js'),C=await import('./js/core.js');
      const R=CR.customerReportData(await db.dumpAll(),id),texts=[],old=CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillText=function(t,...args){texts.push(t);return old.call(this,t,...args)};
      try{const blob=await CR.monthsChartBlob(R.fuelMonths,CR.FUEL_CHART);return {type:blob.type,bytes:blob.size,texts,signature:Array.from(new Uint8Array(await blob.arrayBuffer()).slice(0,8))}}finally{CanvasRenderingContext2D.prototype.fillText=old}
    }""", ids["customer"])
    assert png["signature"] == [137, 80, 78, 71, 13, 10, 26, 10] and png["bytes"] > 1000
    assert all(t in png["texts"] for t in ["150", "100", "Hak edilen mazot (L)", "Alınan mazot (L)"])
    assert not any("₺" in t or t == "0k" for t in png["texts"])

    with page.expect_download() as download:
        page.click('[data-dpdf="customer"]')
    path = ARTIFACT + ".pdf"
    download.value.save_as(path)
    doc = fitz.open(path)
    text = " ".join(" ".join(p.get_text() for p in doc).split())
    assert "hak edilen ve alınan mazot (L)" in text, text
    assert "Mazot tahsilatları (dönem, L)" in text and "Depo" in text and "100 L" in text
    assert "iş tutarı ve tahsilat (TL)" not in text
    assert sum(len(p.get_images()) for p in doc) > 0
    assert snapshot() == before, "Exporting is read-only"
    print("PASS real PNG uses both exact series and L legends; customer PDF downloads with fuel chart, period receipt and no empty money chart; database/audit unchanged", flush=True)

    # An incoming receipt from another open tab refreshes the actual green bar.
    writer = context.new_page()
    writer.goto(URL + "index.html#/daha")
    writer.wait_for_selector('#screen[data-view-ready="1"]')
    writer.evaluate("""async x=>{const db=await import('./js/db.js');await db.saveNew('fuel_records',{customer_id:x.customer,vehicle_id:x.vehicle,date:x.date,liters:25,fuel_source:'Müşteri Verdi'},'TEST receipt')}""", ids)
    page.bring_to_front()
    page.wait_for_function("()=>document.querySelector('[data-customer-chart=fuel]')?.textContent.includes('Alınan mazot: 325 L')")
    assert "on" in page.locator("[data-dper=month]").get_attribute("class")
    assert "125 L" in page.locator('[data-customer-chart=fuel] [data-series=received]').last.text_content()
    assert "50 L" in page.locator("[data-fuelpanel]").inner_text()
    print("PASS new receipt refreshes open chart to 325L received, 125L this month and 50L remaining; period choice preserved", flush=True)

    writer.evaluate("""async x=>{const db=await import('./js/db.js');await db.saveNew('work_records',{customer_id:x.customer,vehicle_id:x.vehicle,date:x.date,work_type:'Makine Çalışması',quantity:1,unit:'Saat',price_snapshot:{unit_price:1200,amount:1200}},'TEST');await db.saveNew('cari_movements',{customer_id:x.customer,date:x.date,type:'Tahsilat',amount:-500},'TEST')}""", ids)
    page.reload()
    page.wait_for_selector('[data-customer-chart="money"]')
    money = page.locator('[data-customer-chart="money"]')
    assert "İş tutarı: 1.200 ₺" in money.inner_text() and "Tahsilat: 500 ₺" in money.inner_text()
    assert "Alınan mazot: 325 L" in page.locator('[data-customer-chart="fuel"]').inner_text()
    assert "700 ₺" in page.locator("[data-custdash]").inner_text()
    with page.expect_download() as download:
        page.click('[data-dpdf="internal"]')
    mixed_path = ARTIFACT + "-mixed.pdf"
    download.value.save_as(mixed_path)
    mixed = fitz.open(mixed_path)
    mixed_text = " ".join(" ".join(p.get_text() for p in mixed).split())
    assert "hak edilen ve alınan mazot (L)" in mixed_text and "iş tutarı ve tahsilat (TL)" in mixed_text
    assert sum(len(p.get_images()) for p in mixed) >= 2
    assert not errors, errors
    assert Path(path).read_bytes().startswith(b"%PDF-")
    print("PASS mixed customer: 1200TL work / 500TL collection / 700TL debt remain separate from 375L earned / 325L received; internal PDF contains both real charts; no browser errors", flush=True)
    browser.close()
