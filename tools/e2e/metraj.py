# Metraj paket 2–3 — iş sözleşmesi (m³): açma, kapsam içi / ekstra (elle form + asistan), çift fiyatlama koruması, tahmini m³,
# ölçüm → cariye metraj hakedişi (tek işlem, tekrar yazılmaz), katsayı öğrenme, kapatma, ana ekran uyarısı. TEST VERİSİ; taklit Gemini.
import json, sys
from playwright.sync_api import sync_playwright
U = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8846/"; PIN = "482917"
FAIL = []
def check(c, m):
    print(("  ✓ " if c else "  ✗ ") + m)
    if not c: FAIL.append(m)
with sync_playwright() as p:
    b = p.chromium.launch(); errs = []
    ctx = b.new_context(viewport={'width': 360, 'height': 800}); ctx.add_init_script("try{localStorage.setItem('sp_role','boss');localStorage.setItem('spx_role','boss')}catch(e){}")
    PLANS = []
    def gem(route):
        plan = PLANS.pop(0) if PLANS else {}
        route.fulfill(status=200, content_type="application/json", body=json.dumps({"candidates": [{"content": {"parts": [{"text": json.dumps(plan, ensure_ascii=False)}]}, "finishReason": "STOP"}]}, ensure_ascii=False))
    ctx.route("https://generativelanguage.googleapis.com/**", gem)
    pg = ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(U + "index.html"); pg.wait_for_timeout(5000)
    ev = lambda js: pg.evaluate(js)
    ids = ev("""async()=>{const db=await import('./js/db.js');const c=await import('./js/security-core.js');const core=await import('./js/core.js');
      await db.metaSet('gemini_key','K');await db.metaSet('gemini_model','gemini-2.5-flash');await db.metaSet('gemini_consent',true);
      await db.metaSet('sec_lock',{...(await c.hashSecret('482917')),idle_min:30,away_min:15});
      const T=core.todayStr();
      const k=await db.saveNew('customers',{name:'Test Yapı'},'t');const k2=await db.saveNew('customers',{name:'Test Başka'},'t');
      const v=await db.saveNew('vehicles',{name:'Test Kamyon 4D',type:'Kamyon',ownership:'Özmal',axles:4,tare_ton:13,body_m3:17,active:true},'t');
      const ex=await db.saveNew('vehicles',{name:'Test Ekskavatör',type:'Ekskavatör',ownership:'Özmal',active:true},'t');
      await db.saveNew('price_book',{customer_id:k.id,site_id:null,vehicle_id:null,work_type:'Kazı',unit:'Saat',price:2000,kdv_rate:20,kdv_included:false,valid_from:'2026-01-01',valid_to:null,active:true},'t');
      await db.saveNew('price_book',{customer_id:k.id,site_id:null,vehicle_id:null,work_type:'Hafriyat Nakliye',unit:'Sefer',price:1500,kdv_rate:20,kdv_included:false,valid_from:'2026-01-01',valid_to:null,active:true},'t');
      return {k:k.id,k2:k2.id,v:v.id,ex:ex.id,T,S:core.addDays(T,-5),O:core.addDays(T,-15)}}""")
    T = ids["T"]
    def unlock():
        if pg.query_selector("#lock-root [data-pw]"): pg.fill("#lock-root [data-pw]", PIN); pg.click("#lock-root [data-go-un]"); pg.wait_for_timeout(1200)
    def settle():
        for _ in range(5):
            if not pg.query_selector(".sheet"): break
            bs = pg.query_selector_all(".sheet button"); (bs[-1] if bs else None).click(); pg.wait_for_timeout(700)
    bal = lambda: ev(f"async()=>{{const db=await import('./js/db.js');const cc=await import('./js/collect-core.js');return cc.customerBalances(await db.dumpAll()).bal['{ids['k']}']||0}}")
    works = lambda: ev("async()=>(await (await import('./js/db.js')).listActive('work_records')).map(w=>({q:Number(w.quantity),u:w.unit,s:w.site_id,x:!!w.job_extra,a:w.price_snapshot?.amount??null,src:w.price_snapshot?.price_source||null}))")
    pg.reload(); pg.wait_for_timeout(3000); unlock()
    # 1) İş sözleşmesi aç
    pg.goto(U + "index.html#/is-sozlesmeleri"); pg.wait_for_timeout(2000); unlock()
    pg.select_option("[data-newjob] [name=customer_id]", ids["k"]); pg.wait_for_timeout(300)
    pg.fill("[data-newjob] [name=site_name]", "Test Şantiye"); pg.click("[data-next]"); pg.wait_for_timeout(2000)
    pg.select_option("[data-form] [name=basis]", "m³"); pg.fill("[data-form] [name=price]", "100"); pg.fill("[data-form] [name=kdv_rate]", "20"); pg.fill("[data-form] [name=start_date]", ids["S"])
    pg.click("[data-save]"); pg.wait_for_timeout(2000)
    sid = pg.url.split("#/is-sozlesmesi/")[1].split("?")[0]
    check("Metreküp" in pg.inner_text("[data-deal]") and "100" in pg.inner_text("[data-deal]"), "m³ iş sözleşmesi açıldı")
    b0 = bal()
    # 2) Elle iş: ekskavatör 8 saat → DAHİL (fiyat listesindeki 2000 ₺/saat uygulanmaz)
    def manual(veh, wt, q, unit, scope=None, ton=None):
        pg.goto(U + f"index.html#/isler/new?customer_id={ids['k']}"); pg.wait_for_timeout(2500)
        pg.select_option("[data-form] [name=vehicle_id]", veh); pg.select_option("[data-form] [name=work_type]", wt)
        pg.fill("[data-form] [name=quantity]", str(q)); pg.select_option("[data-form] [name=unit]", unit); pg.wait_for_timeout(500)
        if ton: pg.fill("[data-form] [name=tonnage]", str(ton))
        if scope: pg.select_option("[data-jobbox] [name=job_scope]", scope); pg.wait_for_timeout(300)
        jt = pg.inner_text("[data-jobbox]")
        pg.click("[data-save]"); pg.wait_for_timeout(2500); settle()
        return jt
    jt = manual(ids["ex"], "Kazı", 8, "Saat")
    w = [x for x in works() if x["q"] == 8][0]
    check("DAHİL" in jt and "Test Şantiye" in jt, f"elle formda kayıttan önce 'sözleşmeye dahil' yazıyor ({jt[:80]})")
    check(w["s"] == sid and w["a"] == 0 and w["src"] == "Sözleşmeye dahil", f"ekskavatör saati fiyata dahil, 2000 ₺/saat yazılmadı ({w})")
    jt = manual(ids["ex"], "Kazı", 2, "Saat", scope="ekstra")
    w = [x for x in works() if x["q"] == 2 and x["u"] == "Saat"][0]
    check("EKSTRA" in jt and w["x"] and w["a"] == 4000, f"ekstra seçilen 2 saat fiyat listesinden 4.000 ₺ ({w})")
    manual(ids["v"], "Hafriyat Nakliye", 1, "Sefer", ton=20.5)
    # 3) Asistan: 2 sefer → dahil; aynı mesaj ekstra işaretli → fiyat listesi
    def assist(q, extra=False):
        PLANS.append({"works": [{"date": T, "date_source": "mesaj", "customer_id": ids["k"], "vehicle_id": ids["v"], "work_type": "Hafriyat Nakliye", "quantity": q, "unit": "Sefer", "quote": f"Test Kamyon {q} sefer hafriyat Test Yapı"}]})
        pg.goto(U + "index.html#/akilli-asistan"); pg.reload(); pg.wait_for_timeout(2500); unlock()
        ev("(()=>{const r=document.querySelector('[data-refine]');if(r)r.checked=false})()")
        pg.fill("[data-msg]", f"Test Kamyon {q} sefer hafriyat Test Yapı"); pg.click("[data-ask]"); pg.wait_for_timeout(3000)
        if extra: pg.check("[data-kind=work] [name=job_extra]"); pg.wait_for_timeout(300)
        pv = pg.inner_text("[data-kind=work] [data-price-preview]")
        pg.click("[data-save]"); pg.wait_for_timeout(2500); settle()
        return pv
    pv = assist(4)
    w = [x for x in works() if x["q"] == 4][0]
    check("DAHİL" in pv and w["a"] == 0 and w["s"] == sid, f"asistan: önizleme 'dahil', kayıt 0 ₺ ve şantiyeye bağlı ({pv[:70]}; {w})")
    pv = assist(3, extra=True)
    w = [x for x in works() if x["q"] == 3][0]
    check(w["x"] and w["a"] == 4500 and "Fiyat listesinden" in pv, f"asistan: ekstra işaretli 3 sefer fiyat listesinden 4.500 ₺ ({w})")
    check(abs(bal() - b0 - 8500) < 0.01, f"cariye yalnız ekstralar yazıldı (+8.500) ({bal() - b0})")
    # 4) İş ekranı: tahmin
    pg.goto(U + f"index.html#/is-sozlesmesi/{sid}"); pg.wait_for_timeout(2500)
    pg.click("[data-jt='kayit']"); pg.wait_for_timeout(300)
    est = pg.inner_text("[data-est]")
    check("kantar fişli" in est and "kantar ortalamasıyla" in est and "Toplam ≈" in est, f"tahmini m³ kaynağıyla ({est[est.find('Toplam'):][:120]!r})")
    pg.click("[data-jt='soz']"); pg.wait_for_timeout(300)
    check("cariye yazılmaz" in pg.inner_text("[data-money]"), "tahmini hakediş cariye yazılmıyor")
    ov = ev("({sw:document.documentElement.scrollWidth,w:document.documentElement.clientWidth})")
    check(ov["sw"] <= ov["w"], f"iş ekranında 360 px taşma yok ({ov})")
    # 5) Ölçüm → cari
    pg.fill("[data-measure] [name=m_m3]", "50"); pg.wait_for_timeout(300)
    mp = pg.inner_text("[data-mprev]")
    check("6.000" in mp and "5.000" in mp, f"ölçüm önizlemesi net 5.000 + KDV = 6.000 brüt ({mp[:90]})")
    pg.click("[data-msave]"); pg.wait_for_timeout(800)
    check("Sonra değiştirilemez" in pg.inner_text(".sheet"), "cariye yazmadan önce onay soruluyor")
    pg.click(".sheet button[data-x='1']"); pg.wait_for_timeout(2500)
    st = ev(f"async()=>{{const db=await import('./js/db.js');const s=await db.get('sites','{sid}');const m=(await db.listActive('cari_movements')).filter(x=>x.source==='metraj');return {{st:s.deal.status,n:m.length,a:m[0]?.amount,ref:m[0]?.ref_id,id:s.deal.measurement?.cari_id===m[0]?.id}}}}")
    check(st == {"st": "Ölçüldü", "n": 1, "a": 6000, "ref": sid, "id": True}, f"ölçüm kaydedildi, cariye tek metraj hakedişi 6.000 ₺ ({st})")
    check(abs(bal() - b0 - 14500) < 0.01, f"müşteri bakiyesi ekstralar + hakediş (+14.500) ({bal() - b0})")
    again = ev(f"""async()=>{{const db=await import('./js/db.js');const r=await Promise.allSettled([db.saveJobMeasurement('{sid}',{{m3:1}},{{date:'{T}',customer_id:'{ids['k']}',type:'Hakedis',amount:1,source:'metraj',ref_id:'{sid}'}},'t'),db.saveJobMeasurement('{sid}',{{m3:1}},{{date:'{T}',customer_id:'{ids['k']}',type:'Hakedis',amount:1,source:'metraj',ref_id:'{sid}'}},'t')]);
      return [r.map(x=>x.status),(await db.listActive('cari_movements')).filter(x=>x.source==='metraj').length]}}""")
    check(again == [["rejected", "rejected"], 1], f"ölçüm ikinci kez (iki sekme) yazılamıyor ({again})")
    lock = ev(f"""async()=>{{const db=await import('./js/db.js');const s=await db.get('sites','{sid}');const out=[];
      try{{await db.saveExisting('sites',s,{{deal:{{...s.deal,measurement:{{...s.deal.measurement,m3:99}}}}}},'t');out.push('degisti')}}catch(e){{out.push('engel')}}
      try{{await db.softDelete('sites','{sid}','t');out.push('silindi')}}catch(e){{out.push('engel')}}return out}}""")
    check(lock == ["engel", "engel"], f"cariye yazılmış ölçüm değiştirilemiyor, şantiye silinemiyor ({lock})")
    integ = ev("async()=>{const db=await import('./js/db.js');const ic=await import('./js/integrity-core.js');const core=await import('./js/core.js');return ic.integrityCheck(await db.dumpAll(),{today:core.todayStr()}).issues.filter(x=>x.sev==='error').map(x=>x.code+': '+x.text)}")
    check(not integ, f"Veri Sağlığı hata yok ({integ})")
    # 6) Katsayı öğren + kapat
    pg.goto(U + f"index.html#/is-sozlesmesi/{sid}"); pg.wait_for_timeout(2500)
    pg.click("[data-jt='soz']"); pg.wait_for_timeout(300)
    check(pg.query_selector("[data-calsave]") is not None, "ölçümden sonra katsayı önerisi görünüyor")
    pg.click("[data-calsave]"); pg.wait_for_timeout(2000)
    cal = ev(f"async()=>(await (await import('./js/db.js')).metaGet('haul_calib'))")
    check(cal and f"{ids['v']}|toprak" in cal and cal[f"{ids['v']}|toprak"]["m3_per_trip"] > 0, f"katsayı onayla kaydedildi ({cal})")
    pg.click("[data-close]"); pg.wait_for_timeout(800)
    if pg.query_selector(".sheet button[data-x='1']"): pg.click(".sheet button[data-x='1']")
    pg.wait_for_timeout(2000)
    st2 = ev(f"async()=>(await (await import('./js/db.js')).get('sites','{sid}')).deal.status")
    check(st2 == "Kapandı", f"iş kapandı ({st2})")
    n0 = len(works()); manual(ids["ex"], "Kazı", 5, "Saat")
    w = [x for x in works() if x["q"] == 5][0]
    check(w["a"] == 10000 and not w["s"], f"kapanan işten sonra yeni iş normal fiyatlanıyor ({w})")
    # 7) Ölçüm bekleyen m³ işi ana ekranda
    ev(f"""async()=>{{const db=await import('./js/db.js');const s=await db.saveNew('sites',{{name:'Test Eski Şantiye',customer_id:'{ids['k2']}'}},'t');
      await db.saveExisting('sites',s,{{deal:{{basis:'m³',price:90,kdv_rate:20,kdv_included:false,start_date:'{ids['O']}',material:'toprak',status:'Açık'}}}},'t');
      await db.saveNew('work_records',{{date:'{ids['O']}',customer_id:'{ids['k2']}',site_id:s.id,vehicle_id:'{ids['v']}',work_type:'Hafriyat Nakliye',unit:'Sefer',quantity:2}},'t')}}""")
    pg.goto(U + "index.html#/"); pg.wait_for_timeout(3000)
    y = ev("document.querySelector('[data-yonetim]')?.textContent||''")
    check("ölçüm bekliyor" in y and "Test Eski Şantiye" in y, "ana ekranda 'ölçüm bekliyor' uyarısı")
    check(not errs, f"sayfa hatası yok {errs[:2]}")
    b.close()
print("\nSONUÇ:", "BAŞARILI" if not FAIL else f"{len(FAIL)} SORUN")
