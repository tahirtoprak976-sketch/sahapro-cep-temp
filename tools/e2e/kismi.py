# Tek işlemde yazılmayan (kısmi kalabilen) yollar + geri alma (TEST VERİSİ, taklit Gemini).
# Her senaryoda son kart (arıza kaydı) kayıttan hemen önce silinen araca bağlanarak hata verdirilir; öncesinde yazılanlar
# görülür, "Yarım kalan kaydı geri al" denenir. Ayrıca: bağlanmış kayıtta geri alma, iki kez geri alma, kapat-aç sonrası
# geri alma, iki sekmede aynı anda geri alma, yarım izin onayı.
import json
from playwright.sync_api import sync_playwright
U = "http://localhost:8841/"; PIN = "482917"
FAIL = []
def check(c, m):
    print(("  ✓ " if c else "  ✗ ") + m)
    if not c: FAIL.append(m)
with sync_playwright() as p:
    b = p.chromium.launch(); errs = []
    ctx = b.new_context(viewport={'width': 412, 'height': 900}); ctx.add_init_script("try{localStorage.setItem('sp_role','boss')}catch(e){}")
    PLANS = []
    def gem(route):
        plan = PLANS.pop(0) if PLANS else {}
        route.fulfill(status=200, content_type="application/json", body=json.dumps({"candidates": [{"content": {"parts": [{"text": json.dumps(plan, ensure_ascii=False)}]}, "finishReason": "STOP"}]}, ensure_ascii=False))
    pg = ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e))); pg.route("https://generativelanguage.googleapis.com/**", gem)
    pg.goto(U + "index.html"); pg.wait_for_timeout(5000)
    ev = lambda js, *a: pg.evaluate(js, *a)
    T = ev("(async()=>(await import('./js/ui.js')).todayStr())()")
    ids = ev("""async()=>{const db=await import('./js/db.js');const c=await import('./js/security-core.js');const e=await import('./js/enterprise-db.js');
      await db.metaSet('gemini_key','K');await db.metaSet('gemini_model','gemini-2.5-flash');await db.metaSet('gemini_consent',true);
      await db.metaSet('sec_lock',{...(await c.hashSecret('482917')),idle_min:30,away_min:15});
      const k=await db.saveNew('customers',{name:'Kaya İnşaat'},'t');const vs=await db.listActive('vehicles');
      const bank=await e.saveBank({name:'Ziraat',opening_date:'2026-01-01',opening_balance:0});
      const sup=await e.saveSupplier({name:'Usta Ahmet',type:'Servis'});
      for(let i=0;i<3;i++)await db.saveNew('work_records',{date:'2026-10-0'+(i+1),customer_id:k.id,vehicle_id:vs[0].id,work_type:'Kazı',quantity:2,unit:'Saat'},'t');
      return {k:k.id,v:vs[0].id,vn:vs[0].name,bank:bank.id,sup:sup.id,ps:(await db.listActive('personnel'))[0].id}}""")
    def unlock():
        if pg.query_selector("#lock-root [data-pw]"): pg.fill("#lock-root [data-pw]", PIN); pg.click("#lock-root [data-go-un]"); pg.wait_for_timeout(1200)
    pg.reload(); pg.wait_for_timeout(3000); unlock()
    def fresh_vehicle():
        return ev("""async()=>{const db=await import('./js/db.js');return (await db.saveNew('vehicles',{name:'Geçici '+Math.random().toString(36).slice(2,6),type:'Kamyon'},'t')).id}""")
    def run(msg, plan, fail_vid):
        PLANS.append(plan)
        pg.goto(U + "index.html#/akilli-asistan"); pg.reload(); pg.wait_for_timeout(2500); unlock()
        ev("(()=>{const r=document.querySelector('[data-refine]');if(r)r.checked=false})()")
        pg.fill("[data-msg]", msg); pg.click("[data-ask]"); pg.wait_for_timeout(3000)
        ev("document.querySelectorAll('[data-out] .card[data-kind] [data-pick]').forEach(x=>{if(!x.disabled)x.checked=true})")
        ev(f"""async()=>{{const db=await import('./js/db.js');await db.softDelete('vehicles','{fail_vid}','test: hata üret')}}""")
        pg.click("[data-save]"); pg.wait_for_timeout(1500)
        while pg.query_selector(".sheet"):
            for x in pg.query_selector_all(".sheet button"):
                if x.inner_text().strip() in ("Kaydet", "Farklı, kaydet", "Farklı bir iş, kaydet", "Farklı iş, kaydet"): x.click(); break
            else: break
            pg.wait_for_timeout(1200)
        pg.wait_for_timeout(1500)
        return pg.inner_text("[data-out]")
    def undo_click(confirm="Geri al"):
        btn = pg.query_selector("[data-undo]")
        if not btn: return "düğme yok"
        btn.click(); pg.wait_for_timeout(800)
        if pg.query_selector(".sheet"):
            for x in pg.query_selector_all(".sheet button"):
                if x.inner_text().strip() == confirm: x.click(); break
        pg.wait_for_timeout(1500)
        return " | ".join(ev("[...document.querySelectorAll('.toast')].map(t=>t.textContent)")[-2:])
    cnt = lambda store, cond="true": ev(f"async()=>{{const db=await import('./js/db.js');return (await db.listActive('{store}')).filter(r=>{cond}).length}}")
    def maint(fv): return [{"date": T, "vehicle_id": fv, "maint_type": "Arıza", "description": "fren sesi", "status": "Açık"}]

    # A) Havale tahsilatı yazıldı, sonraki kart hata verdi → yarım; geri al → banka hareketi ve cari dahil hepsi geri
    print("A) Havale tahsilatı")
    fv = fresh_vehicle()
    out = run("Kaya İnşaat 30.000 TL havale yaptı. Fren sesi var", {"collections": [{"date": T, "customer_id": ids["k"], "amount": 30000, "method": "Havale", "bank_account_id": ids["bank"]}], "maintenance": maint(fv)}, fv)
    a1 = [cnt("cash_records", "r.payment_method==='Havale'"), cnt("bank_movements"), cnt("cari_movements", "r.type==='Tahsilat'")]
    check(a1 == [1, 1, 1] and "kaydedilirken hata oldu" in out, f"hata öncesi havale yazılmış kaldı (kasa/banka/cari {a1}) ve kullanıcıya gösterildi")
    t = undo_click()
    a2 = [cnt("cash_records", "r.payment_method==='Havale'"), cnt("bank_movements"), cnt("cari_movements", "r.type==='Tahsilat'")]
    check(a2 == [0, 0, 0], f"geri al: havale, banka hareketi ve cari birlikte geri alındı ({a2}) [{t}]")
    # B) Esnaf veresiye borcu + hata
    print("B) Esnaf borcu")
    fv = fresh_vehicle()
    out = run("Usta Ahmet'e 4.500 TL veresiye tamir. Fren sesi var", {"expenses": [{"date": T, "amount": 4500, "category": "Tamir", "supplier_id": ids["sup"], "credit": True, "note": "tamir"}], "maintenance": maint(fv)}, fv)
    b1 = cnt("payables")
    check(b1 == 1, f"hata öncesi esnaf borcu yazılmış kaldı ({b1})")
    undo_click(); b2 = cnt("payables")
    check(b2 == 0, f"geri al: esnaf borcu geri alındı ({b2})")
    # C) Yeni kart (müşteri) + iş + hata; geri almadan önce iş hakedişe bağlanırsa geri alma reddedilir
    print("C) Yeni kart + bağlanmış kayıt")
    fv = fresh_vehicle()
    out = run(f"{ids['vn']} Yılmaz Yapı 3 saat kazı. Fren sesi var", {"works": [{"date": T, "date_source": "mesaj", "new_customer": "Yılmaz Yapı", "vehicle_id": ids["v"], "work_type": "Kazı", "quantity": 3, "unit": "Saat", "unit_price": None, "quote": f"{ids['vn']} Yılmaz Yapı 3 saat kazı"}], "maintenance": maint(fv)}, fv)
    c1 = [cnt("customers", "r.name==='Yılmaz Yapı'"), cnt("work_records", "r.quantity===3")]
    check(c1 == [1, 1], f"hata öncesi yeni müşteri kartı ve iş yazılmış kaldı ({c1})")
    ev("""async()=>{const db=await import('./js/db.js');const core=await import('./js/core.js');const c=(await db.listActive('customers')).find(x=>x.name==='Yılmaz Yapı');
      const w=(await db.listActive('work_records')).find(x=>x.customer_id===c.id);
      const items=[{work_record_id:w.id,date:w.date,customer_id:c.id,work_type:w.work_type,quantity:3,unit:'Saat',unit_price:1000,kdv_rate:20,kdv_included:false}];const tot=core.calcHakedisTotals(items);
      await db.saveNew('hakedis',{hakedis_no:await db.nextSeq('hakedis'),customer_id:c.id,site_id:null,date_from:w.date,date_to:w.date,created_date:w.date,status:'Taslak',items:tot.lines,subtotal:tot.subtotal,kdv_total:tot.kdv,grand_total:tot.grand},'t')}""")
    pg.goto(U + "index.html#/akilli-asistan"); pg.reload(); pg.wait_for_timeout(2500); unlock()
    t = undo_click()
    c2 = [cnt("customers", "r.name==='Yılmaz Yapı'"), cnt("work_records", "r.quantity===3"), cnt("hakedis")]
    check(c2 == [1, 1, 1] and "bağlandı" in t, f"iş hakedişe bağlandıktan sonra geri alma reddedildi, hiçbir şey silinmedi ({c2}) [{t[:90]}]")
    ev("""async()=>{const db=await import('./js/db.js');for(const h of await db.listActive('hakedis'))await db.softDelete('hakedis',h.id,'t')}""")
    # D) Kapat-aç sonrası geri alma (ana ekrandaki "Son asistan kaydı → Geri al") + iki kez geri alma
    print("D) Kapat-aç sonrası ve iki kez geri alma")
    pg.goto(U + "index.html#/akilli-asistan"); pg.reload(); pg.wait_for_timeout(2500); unlock()
    t = undo_click()
    c3 = [cnt("customers", "r.name==='Yılmaz Yapı'"), cnt("work_records", "r.quantity===3")]
    check(c3 == [0, 0], f"uygulama yeniden açıldıktan sonra geri alma çalıştı ({c3})")
    pg.reload(); pg.wait_for_timeout(2500); unlock()
    t2 = undo_click()
    check(t2 == "düğme yok" or "Geri alınacak kayıt yok" in t2, f"ikinci geri alma: yapılacak bir şey yok ({t2[:60]})")
    # E) Eski işlere fiyat uygulama + hata → geri alma eski fiyatsız hâle döndürür
    print("E) Eski işlere fiyat uygulama")
    fv = fresh_vehicle()
    run("Kaya İnşaat kazı saati 2.000 TL olsun. Fren sesi var", {"price_rules": [{"customer_id": ids["k"], "work_type": "Kazı", "unit": "Saat", "price": 2000}], "maintenance": maint(fv)}, fv)
    e1 = cnt("work_records", "r.price_snapshot&&r.price_snapshot.unit_price===2000")
    check(e1 >= 3, f"hata öncesi fiyat {e1} eski işe uygulanmış kaldı")
    undo_click(); e2 = cnt("work_records", "r.price_snapshot&&r.price_snapshot.unit_price===2000"); e3 = cnt("price_book", "r.price===2000")
    check(e2 == 0 and e3 == 0, f"geri al: eski işler ve fiyat kuralı eski hâline döndü ({e2}, {e3})")
    # F) İki sekmede aynı anda geri alma → yalnız biri uygular
    print("F) İki sekmede geri alma")
    fv = fresh_vehicle()
    run(f"{ids['vn']} Kaya İnşaat 7 saat kazı. Fren sesi var", {"works": [{"date": T, "date_source": "mesaj", "customer_id": ids["k"], "vehicle_id": ids["v"], "work_type": "Kazı", "quantity": 7, "unit": "Saat", "quote": f"{ids['vn']} Kaya İnşaat 7 saat kazı"}], "maintenance": maint(fv)}, fv)
    r = ev("""async()=>{const db=await import('./js/db.js');const u=await import('./js/undo.js');const res=await Promise.allSettled([u.applyUndo(db),u.applyUndo(db)]);return res.map(x=>x.status)}""")
    check(sorted(r) == ["fulfilled", "rejected"] and cnt("work_records", "r.quantity===7") == 0, f"aynı anda iki geri alma: biri uyguladı ({r})")
    # G) Yarım izin onayı: form onaylı, günlerin bir kısmı yazılmamış → Veri Sağlığı hata
    print("G) Yarım izin onayı")
    ev(f"""async()=>{{const db=await import('./js/db.js');const f=await db.saveNew('documents',{{category:'İzin Formu',doc_no:'IZ-K1',date:'2026-10-05',owner_type:'personnel',owner_id:'{ids['ps']}',personnel_id:'{ids['ps']}',status:'Onaylandı',leave:{{kind:'Yıllık izin',from:'2026-10-05',to:'2026-10-08'}}}},'t');
      await db.saveNew('personnel_events',{{date:'2026-10-05',personnel_id:'{ids['ps']}',event_type:'İzin',leave_form_id:f.id,leave_group:f.id,hours_days:1}},'t')}}""")
    r = ev("""async()=>{const db=await import('./js/db.js');const ic=await import('./js/integrity-ui.js');return (await ic.runIntegrity(db)).issues.filter(x=>x.code==='leave-partial').map(x=>x.text)}""")
    check(bool(r), f"yarım izin onayı Veri Sağlığı'nda hata ({r[:1]})")
    check(not errs, f"sayfa hatası yok {errs[:2]}")
    b.close()
print("\nSONUÇ:", "BAŞARILI" if not FAIL else f"{len(FAIL)} SORUN")
