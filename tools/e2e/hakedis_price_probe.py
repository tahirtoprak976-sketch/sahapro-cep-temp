"""Read-only-code redteam probe; synthetic browser/IDB writes only.

Run in the repository's APPROVED CI browser runtime, not the restricted dot host:
  python tools/e2e/hakedis_price_probe.py http://localhost:8841/
  python tools/e2e/hakedis_price_probe.py http://localhost:8841/ --require-fixed

The first mode reports whether the current vulnerable path reproduces. The second
requires both UI and direct-DB missing-price guards. No production URL accepted.
"""
import json
import sys
import uuid
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

base = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8841/").rstrip("/") + "/"
require_fixed = "--require-fixed" in sys.argv[2:]
assert urlparse(base).hostname in ("localhost", "127.0.0.1", "::1"), "Local synthetic server only"
database = "hp_" + uuid.uuid4().hex[:24]  # dbName permits at most 32 characters.
output = {}

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path="/usr/bin/chromium", args=["--no-sandbox"])
    context = browser.new_context(viewport={"width": 360, "height": 800}, service_workers="block")
    context.add_init_script("localStorage.setItem('sp_role','boss')")
    context.route("**/*", lambda route: route.continue_() if route.request.url.startswith(base) else route.abort())
    page = context.new_page()
    page.goto(base + "README.md?db=" + database)
    ids = page.evaluate("""async () => {
      const db=await import('./js/db.js'),core=await import('./js/core.js');
      const customer=await db.saveNew('customers',{name:'SYNTHETIC PRICE PROBE'});
      const vehicle=await db.saveNew('vehicles',{name:'SYNTHETIC VEHICLE'});
      const work=await db.saveNew('work_records',{date:core.todayStr(),customer_id:customer.id,
        vehicle_id:vehicle.id,work_type:'Makine Çalışması',quantity:3,unit:'Saat',price_snapshot:null});
      return {customer:customer.id,vehicle:vehicle.id,work:work.id,date:work.date};
    }""")
    page.goto(base + "index.html?db=" + database + "#/hakedis/new")
    page.wait_for_selector("[data-fetch]")
    page.select_option("[name=customer_id]", ids["customer"])
    page.click("[data-fetch]")
    price = '[data-price="' + ids["work"] + '"]'
    page.wait_for_selector(price)
    assert page.input_value(price) == "", "Fixture must genuinely have no price"
    page.check('[data-chk="' + ids["work"] + '"]')
    output["ui_blocks_blank_selected_price"] = page.is_disabled("[data-create]")
    if not output["ui_blocks_blank_selected_price"]:
        page.click("[data-create]")
        page.click('.sheet [data-x="1"]')
        page.wait_for_selector("[data-final]")
        output["draft"] = page.evaluate("""async id => {
          const db=await import('./js/db.js'),collect=await import('./js/collect-core.js');
          const w=await db.get('work_records',id),h=(await db.getAll('hakedis')).find(h=>h.items.some(i=>i.work_record_id===id));
          return {id:h.id,status:h.status,item:h.items[0],total:h.grand_total,
            sourceSnapshot:w.price_snapshot,missingPrice:collect.missingCustomerWorkPrice(w)};
        }""", ids["work"])
        if not require_fixed:
            page.click("[data-final]")
            page.click('.sheet [data-x="1"]')
            page.wait_for_function("""async id => (await (await import('./js/db.js')).get('hakedis',id)).status==='Kesinleşti'""", arg=output["draft"]["id"])
            output["finalized"] = page.evaluate("""async ids => {
              const db=await import('./js/db.js'),collect=await import('./js/collect-core.js');
              const w=await db.get('work_records',ids.work);
              let correctionError=null;try{await db.saveExisting('work_records',w,{price_snapshot:{unit_price:500,amount:1500,kdv_rate:0}},'SYNTHETIC TEST');}catch(e){correctionError=e.message;}
              return {snapshot:w.price_snapshot,missingPrice:collect.missingCustomerWorkPrice(w),
                cari:(await db.getAll('cari_movements')).filter(m=>m.customer_id===ids.customer),correctionError};
            }""", ids)
    output["direct_db"] = page.evaluate("""async ids => {
      const db=await import('./js/db.js'),core=await import('./js/core.js');
      const w=await db.saveNew('work_records',{date:ids.date,customer_id:ids.customer,
        vehicle_id:ids.vehicle,work_type:'Makine Çalışması',quantity:2,unit:'Saat',price_snapshot:null});
      const item={work_record_id:w.id,quantity:2,unit:'Saat',unit_price:null,kdv_rate:20,kdv_included:false};
      const totals=core.calcHakedisTotals([item]);
      const fields={hakedis_no:999,customer_id:ids.customer,date_from:ids.date,date_to:ids.date,
        created_date:ids.date,status:'Taslak',items:totals.lines,subtotal:totals.subtotal,kdv_total:totals.kdv,grand_total:totals.grand};
      let h=null,stage='create';
      try{h=await db.createHakedis(fields);stage='finalize';await db.finalizeHakedis(h.id);stage='accepted';}
      catch(e){return {blockedAt:stage,error:e.message,work:await db.get('work_records',w.id),hakedis:h&&await db.get('hakedis',h.id)};}
      return {blockedAt:null,work:await db.get('work_records',w.id),hakedis:await db.get('hakedis',h.id),
        cari:(await db.getAll('cari_movements')).filter(m=>m.ref_id===h.id)};
    }""", ids)
    if require_fixed:
        assert output["ui_blocks_blank_selected_price"], "Blank selected price must be blocked"
        assert page.locator('[data-hakedis-row-error="' + ids["work"] + '"]').is_visible()
        assert "0 TL sayılmaz" in page.inner_text("[data-total]")
        page.fill(price, "-1")
        assert page.is_disabled("[data-create]")
        page.fill(price, "0")
        assert not page.is_disabled("[data-create]"), "Explicit zero is valid, not missing"
        page.click("[data-create]")
        page.click('.sheet [data-x="1"]')
        page.wait_for_selector("[data-final]")
        page.click("[data-final]")
        page.click('.sheet [data-x="1"]')
        page.wait_for_function("""async id => (await (await import('./js/db.js')).get('work_records',id)).price_snapshot?.locked===true""", arg=ids["work"])
        output["ui_explicit_zero_saved"] = page.evaluate("""async id => (await (await import('./js/db.js')).get('work_records',id)).price_snapshot.unit_price===0""", ids["work"])

        # Exercise real transaction rollback, including old malformed pending drafts
        # inserted as legacy fixtures. Never change an already finalized record.
        output["transaction_matrix"] = page.evaluate("""async ids => {
          const db=await import('./js/db.js'),core=await import('./js/core.js');
          const check=(ok,message)=>{if(!ok)throw Error(message);};
          const state=async()=>JSON.stringify(await Promise.all(['hakedis','cari_movements','work_records'].map(s=>db.getAll(s))));
          const source=async extra=>db.saveNew('work_records',{date:ids.date,customer_id:ids.customer,vehicle_id:ids.vehicle,
            work_type:'Makine Çalışması',quantity:2,unit:'Saat',price_snapshot:null,...extra});
          const line=(w,extra={})=>({work_record_id:w.id,date:w.date,quantity:w.quantity,unit:w.unit,unit_price:100,kdv_rate:20,kdv_included:false,...extra});
          const fields=items=>{const t=core.calcHakedisTotals(items);return {customer_id:ids.customer,date_from:ids.date,date_to:ids.date,created_date:ids.date,
            hakedis_no:1000,status:'Taslak',items:t.lines.map((x,i)=>({...x,...items[i]})),subtotal:t.subtotal,kdv_total:t.kdv,grand_total:t.grand};};
          const finalizedBefore=JSON.stringify(await db.get('work_records',ids.work));
          const invalid=[{unit_price:null},{unit_price:''},{unit_price:true},{quantity:null},{quantity:0},{kdv_rate:null},{kdv_rate:101},
            {formula:'CRANE_FIRST_HOUR',unit_price:null,first_hour_price:null,next_hour_price:100},
            {formula:'CRANE_FIRST_HOUR',unit_price:null,first_hour_price:500,next_hour_price:null}];
          for(const bad of invalid){
            const a=await source(),b=await source(),f=fields([line(a),line(b,bad)]),before=await state();
            let error;try{await db.createHakedis(f);}catch(e){error=e;}
            check(error?.code==='HAKEDIS_INCOMPLETE','create must reject '+JSON.stringify(bad));
            check(await state()===before,'create changed data on invalid mixed selection');
            const legacy=core.newRecord(f);await db.put('hakedis',legacy);const old=await state();
            error=null;try{await db.finalizeHakedis(legacy.id);}catch(e){error=e;}
            check(error?.code==='HAKEDIS_INCOMPLETE','finalize must reject legacy '+JSON.stringify(bad));
            check(await state()===old,'finalize changed draft, work or ledger despite invalid item');
          }
          const valid=[
            {name:'explicit-zero',item:{unit_price:0,price_source:'Manuel'}},
            {name:'legacy-zero',item:{unit_price:0}},
            {name:'positive-cents',item:{unit_price:123.45,kdv_rate:10}},
            {name:'VAT-included',item:{unit_price:120,kdv_rate:20,kdv_included:true}},
            {name:'included',item:{unit_price:0,price_source:'Sözleşmeye dahil'}},
            {name:'internal',item:{unit_price:0,price_source:'İç iş (kendi depo)'}},
            {name:'fuel-only',source:{customer_fuel_allowance_l:75},item:{unit_price:0,kdv_rate:0,price_source:'Mazot karşılığı'}},
            {name:'money-plus-fuel',source:{customer_fuel_allowance_l:75},item:{unit_price:100}},
            {name:'crane-first-hour',source:{quantity:1},item:{formula:'CRANE_FIRST_HOUR',unit_price:null,first_hour_price:500,next_hour_price:null}},
            {name:'crane-more-hours',source:{quantity:3},item:{formula:'CRANE_FIRST_HOUR',unit_price:null,first_hour_price:500,next_hour_price:100}},
            {name:'crane-explicit-zero',item:{formula:'CRANE_FIRST_HOUR',unit_price:null,first_hour_price:0,next_hour_price:0}}
          ];
          const results=[];
          for(const test of valid){
            const w=await source(test.source||{}),f=fields([line(w,test.item)]),h=await db.createHakedis(f);
            check((await db.get('work_records',w.id)).price_snapshot===null,'draft must not lock source');
            const finalized=await db.finalizeHakedis(h.id),after=await db.get('work_records',w.id),moves=(await db.getAll('cari_movements')).filter(m=>m.ref_id===h.id);
            check(finalized.status==='Kesinleşti'&&after.price_snapshot.locked&&moves.length===1&&moves[0].amount===f.grand_total,'valid case failed '+test.name);
            check(after.customer_fuel_allowance_l===w.customer_fuel_allowance_l,'fuel rights changed '+test.name);
            results.push({name:test.name,total:finalized.grand_total});
          }
          const zero=await source(),paid=await source({customer_fuel_allowance_l:25});
          const mixed=fields([line(zero,{unit_price:0,price_source:'Sözleşmeye dahil'}),line(paid,{unit_price:100})]);
          const mixedH=await db.createHakedis(mixed);await db.finalizeHakedis(mixedH.id);
          check((await db.get('hakedis',mixedH.id)).grand_total===240,'mixed zero + TL total changed');
          check(JSON.stringify(await db.get('work_records',ids.work))===finalizedBefore,'previously finalized source changed');
          // Keep an incomplete legacy pending draft for the actual detail-screen error check.
          const oldWork=await source(),legacy=core.newRecord(fields([line(oldWork,{unit_price:null})]));await db.put('hakedis',legacy);
          return {invalidMixedCreateAndFinalize:invalid.length,valid:results,mixedTotal:240,legacy:legacy.id};
        }""", ids)

        # A malformed old pending draft cannot bypass the guard through its detail UI.
        page.goto(base + "index.html?db=" + database + "#/hakedis/" + output["transaction_matrix"]["legacy"])
        page.wait_for_selector("[data-final]")
        page.click("[data-final]")
        page.click('.sheet [data-x="1"]')
        page.wait_for_selector("[data-hakedis-final-error]:not([hidden])")
        assert "Hiçbir kayıt kesinleştirilmedi" in page.inner_text("[data-hakedis-final-error]")

        # Mixed selection, unselecting the incomplete row, and existing crane settings.
        ui = page.evaluate("""async ids=>{const db=await import('./js/db.js');
          const make=extra=>db.saveNew('work_records',{date:ids.date,customer_id:ids.customer,vehicle_id:ids.vehicle,work_type:'Makine Çalışması',quantity:2,unit:'Saat',price_snapshot:null,...extra});
          const paid=await make({price_snapshot:{unit_price:100,amount:200,kdv_rate:20,kdv_included:false}}),blank=await make({});
          const crane=await make({work_type:'Vinç Çalışması',price_snapshot:{formula:'CRANE_FIRST_HOUR',first_hour_price:null,next_hour_price:null,kdv_rate:20,kdv_included:false}});
          await db.metaSet('crane_first_hour',500);await db.metaSet('crane_next_hour',null);
          return {paid:paid.id,blank:blank.id,crane:crane.id};}""", ids)
        def fetch_ui():
            page.goto(base + "index.html?db=" + database + "#/hakedis/new")
            page.wait_for_selector("[data-fetch]")
            page.select_option("[name=customer_id]", ids["customer"])
            page.click("[data-fetch]")
            page.wait_for_selector('[data-chk="' + ui["paid"] + '"]')
        fetch_ui()
        page.check('[data-chk="' + ui["paid"] + '"]')
        assert not page.is_disabled("[data-create]")
        page.check('[data-chk="' + ui["blank"] + '"]')
        assert page.is_disabled("[data-create]")
        page.uncheck('[data-chk="' + ui["blank"] + '"]')
        assert not page.is_disabled("[data-create]")
        page.uncheck('[data-chk="' + ui["paid"] + '"]')
        page.check('[data-chk="' + ui["crane"] + '"]')
        assert page.is_disabled("[data-create]"), "Two-hour crane needs next-hour tariff"
        page.evaluate("async()=>await(await import('./js/db.js')).metaSet('crane_next_hour',100)")
        fetch_ui()
        page.check('[data-chk="' + ui["crane"] + '"]')
        assert not page.is_disabled("[data-create]"), "Existing valid settings fallback must work"
        for width in [320, 360, 768]:
            page.set_viewport_size({"width": width, "height": 800})
            assert page.evaluate("document.documentElement.scrollWidth<=innerWidth+1"), width
        output["ui_mixed_and_crane_settings"] = True

        pending = page.evaluate("""async ids=>{const db=await import('./js/db.js'),core=await import('./js/core.js');
          const w=await db.saveNew('work_records',{date:ids.date,customer_id:ids.customer,vehicle_id:ids.vehicle,work_type:'Makine Çalışması',quantity:2,unit:'Saat'});
          const t=core.calcHakedisTotals([{work_record_id:w.id,quantity:2,unit:'Saat',unit_price:100,kdv_rate:20,kdv_included:false}]);
          const h=await db.createHakedis({hakedis_no:2000,customer_id:ids.customer,date_from:ids.date,date_to:ids.date,created_date:ids.date,status:'Taslak',items:t.lines,subtotal:t.subtotal,kdv_total:t.kdv,grand_total:t.grand});return h.id;}""", ids)
        def financial_state():
            return page.evaluate("async()=>{const db=await import('./js/db.js');return JSON.stringify(await Promise.all(['hakedis','cari_movements','work_records'].map(s=>db.getAll(s))))}")
        before = financial_state()
        page.goto(base + "index.html?db=" + database + "#/hakedis/" + pending)
        page.wait_for_selector("[data-final]")
        page.evaluate("()=>{const button=document.querySelector('[data-final]');button.click();button.click()}")
        assert page.locator(".sheet").count() == 1, "Double click must open one confirmation"
        page.evaluate("location.hash='#/isler'")
        page.wait_for_function("document.querySelector('#screen')?.textContent.includes('İş Kayıtları')")
        page.click('.sheet [data-x="1"]')
        assert financial_state() == before, "Departed view must not finalize or mutate any financial record"
        page.goto(base + "index.html?db=" + database + "#/hakedis/" + pending)
        page.wait_for_selector("[data-final]")
        page.click("[data-final]")
        page.click('.sheet [data-x="0"]')
        assert not page.is_disabled("[data-final]")
        assert financial_state() == before, "Cancel must preserve all financial records"
        output["stale_and_cancelled_confirmation"] = True
    print(json.dumps(output, ensure_ascii=False, indent=2))
    browser.close()

if require_fixed:
    assert output["ui_blocks_blank_selected_price"], "UI still converts a blank selected price to zero"
    assert output["direct_db"]["blockedAt"] in ("create", "finalize"), "Direct DB finalizes missing price"
    assert output["ui_explicit_zero_saved"] and output["ui_mixed_and_crane_settings"] and output["stale_and_cancelled_confirmation"]
    print("PASS: blank-price prevention, atomic mixed rejection, old pending draft guard, explicit/legacy zero, positive/VAT, crane, fuel/included and mobile UI")
else:
    assert not output["ui_blocks_blank_selected_price"], "UI no longer reproduces; inspect output"
    assert output["draft"]["item"]["unit_price"] == 0 and output["draft"]["sourceSnapshot"] is None
    assert output["finalized"]["snapshot"]["locked"] is True
    assert output["finalized"]["snapshot"]["unit_price"] == 0
    assert output["finalized"]["missingPrice"] is False
    assert output["finalized"]["correctionError"], "Locked correction unexpectedly permitted"
    assert output["direct_db"]["blockedAt"] is None
    print("REPRODUCED: blank UI price and null DB price finalize as locked zero-value work")
