# Sözleşmeden iş kurma (götürü): PDF → taklit Gemini → önizleme → onay → anlaşma formu (alıntılarla) → Kaydet → bedeli cariye yaz (onay),
# kapsam içi iş 0 ₺, ekstra iş sözleşmedeki ekstra fiyatıyla, hurda satışı, kilitli alanlar, ikinci kez yazılamaz. TEST VERİSİ.
import json, sys
from playwright.sync_api import sync_playwright
U = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8846/"; PIN = "482917"
FAIL = []
def check(c, m):
    print(("  ✓ " if c else "  ✗ ") + m)
    if not c: FAIL.append(m)
PDF = b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF"
with sync_playwright() as p:
    b = p.chromium.launch(); errs = []
    ctx = b.new_context(viewport={'width': 360, 'height': 800}); ctx.add_init_script("try{localStorage.setItem('sp_role','boss');localStorage.setItem('spx_role','boss')}catch(e){}")
    SENT = []; PLANS = []
    def gem(route):
        SENT.append(route.request.post_data or "")
        plan = PLANS.pop(0) if PLANS else {}
        route.fulfill(status=200, content_type="application/json", body=json.dumps({"candidates": [{"content": {"parts": [{"text": json.dumps(plan, ensure_ascii=False)}]}, "finishReason": "STOP"}]}, ensure_ascii=False))
    ctx.route("https://generativelanguage.googleapis.com/**", gem)
    pg = ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(U + "index.html"); pg.wait_for_timeout(5000)
    ev = lambda js: pg.evaluate(js)
    ids = ev("""async()=>{const db=await import('./js/db.js');const c=await import('./js/security-core.js');const core=await import('./js/core.js');
      await db.metaSet('gemini_key','K');await db.metaSet('gemini_model','gemini-2.5-flash');await db.metaSet('gemini_consent',true);
      await db.metaSet('sec_lock',{...(await c.hashSecret('482917')),idle_min:30,away_min:15});
      const k=await db.saveNew('customers',{name:'Örnek İnşaat Test'},'t');
      const v=await db.saveNew('vehicles',{name:'Test Kamyon',type:'Kamyon',ownership:'Özmal',axles:4,tare_ton:13,body_m3:17,active:true},'t');
      const ex=await db.saveNew('vehicles',{name:'Test Ekskavatör',type:'Ekskavatör',ownership:'Özmal',active:true},'t');
      await db.saveNew('price_book',{customer_id:k.id,site_id:null,vehicle_id:null,work_type:'Kırım',unit:'Saat',price:2000,kdv_rate:20,kdv_included:false,valid_from:'2026-01-01',valid_to:null,active:true},'t');
      return {k:k.id,v:v.id,ex:ex.id,T:core.todayStr()}}""")
    T = ids["T"]
    def unlock():
        if pg.query_selector("#lock-root [data-pw]"): pg.fill("#lock-root [data-pw]", PIN); pg.click("#lock-root [data-go-un]"); pg.wait_for_timeout(1200)
    bal = lambda: ev(f"async()=>{{const db=await import('./js/db.js');const cc=await import('./js/collect-core.js');return cc.customerBalances(await db.dumpAll()).bal['{ids['k']}']||0}}")
    pg.reload(); pg.wait_for_timeout(3000); unlock()
    PLANS.append({"basis": "Götürü", "price": 200000, "kdv_rate": 20, "kdv_included": False, "customer_name": "Örnek İnşaat Test", "site_name": "Test Yıkım Kadıköy", "contract_date": T,
                  "scope_in": ["Binanın yıkımı", "Molozun kaldırılması ve dökümü"], "scope_out": ["Yıkım ruhsatı işverene aittir"], "extra_rates": [{"label": "Kırıcı saati", "unit": "Saat", "price": 3000}],
                  "scrap": "ayrica", "payment_plan": "%30 peşin, kalan iş sürerken", "quotes": [{"field": "price", "text": "Toplam bedel 200.000 TL + KDV"}, {"field": "scrap", "text": "Hurda yükleniciye aittir"}]})
    pg.goto(U + "index.html#/is-sozlesmeleri"); pg.wait_for_timeout(2000); unlock()
    pg.click("[data-readlink]"); pg.wait_for_timeout(1500)
    b0, s0 = bal(), ev("async()=>(await (await import('./js/db.js')).listActive('sites')).length")
    pg.set_input_files("[data-cfile]", files=[{"name": "sozlesme.pdf", "mimeType": "application/pdf", "buffer": PDF}]); pg.click("[data-cread]"); pg.wait_for_timeout(3000)
    res = pg.inner_text("[data-cres]")
    check(len(SENT) == 1 and "application/pdf" in SENT[0], "PDF Gemini'ye gönderildi")
    check("Götürü" in res and "200.000" in res and "Kırıcı saati" in res and "Kontrol edin" not in res, f"okunan bilgiler önizlemede ({res[:80]!r})")
    check(ev("async()=>(await (await import('./js/db.js')).listActive('sites')).length") == s0 and bal() == b0, "önizlemede hiçbir kayıt yazılmadı")
    check(ev("document.querySelector('[data-cres] [name=c_customer]').value") == ids["k"], "müşteri kayıtlardan eşleşti")
    pg.click("[data-cok]"); pg.wait_for_timeout(2500)
    check("Sözleşmeden okundu" in pg.inner_text("#screen") and "200.000 TL + KDV" in pg.inner_text("#screen"), "anlaşma formu belgeden dolu, alıntılarla")
    check(ev("document.querySelector('[name=price]').value") == "200000" and ev("document.querySelector('[name=scrap]').value") == "ayrica" and ev("document.querySelector('[name=r_label_0]').value") == "Kırıcı saati", "bedel, hurda, ekstra fiyatı forma geldi")
    check(ev("document.querySelector('[data-matrow]').hidden"), "götürüde malzeme alanı gizli")
    pg.click("[data-save]"); pg.wait_for_timeout(1200)
    st = pg.inner_text(".sheet") if pg.query_selector(".sheet") else ""
    check("240.000" in st and "Sonra değiştirilemez" in st, f"kayıttan sonra bedeli cariye yazma onayı (240.000 brüt) ({st[:90]!r})")
    pg.click(".sheet button[data-x='1']"); pg.wait_for_timeout(2500)
    sid = pg.url.split("#/is-sozlesmesi/")[1].split("?")[0]
    check(abs(bal() - b0 - 240000) < 0.01, f"müşteri carisinde 240.000 ₺ borç ({bal() - b0})")
    info = ev(f"async()=>{{const db=await import('./js/db.js');const s=await db.get('sites','{sid}');const docs=(await db.listActive('documents')).filter(x=>x.id===s.deal.doc_id);return {{src:s.deal.source,doc:docs.length,cat:docs[0]?.category,q:(s.deal.read_quotes||[]).length,ch:!!s.deal.charge}}}}")
    check(info == {"src": "belge", "doc": 1, "cat": "Sözleşme", "q": 2, "ch": True}, f"belge eklendi, alıntılar ve bedel kaydı anlaşmada ({info})")
    again = ev(f"""async()=>{{const db=await import('./js/db.js');try{{await db.saveJobCharge('{sid}',{{gross:1}},{{date:'{T}',customer_id:'{ids['k']}',type:'Hakedis',amount:1,source:'goturu',ref_id:'{sid}'}},'t');return 'yazdı'}}catch(e){{return 'engel'}}}}""")
    check(again == "engel", "bedel ikinci kez cariye yazılamıyor")
    # işler: kapsam içi 0 ₺, ekstra kırıcı sözleşme fiyatıyla (fiyat listesindeki 2.000 değil 3.000)
    def manual(veh, wt, q, unit, scope=None):
        pg.goto(U + f"index.html#/isler/new?customer_id={ids['k']}"); pg.wait_for_timeout(2500)
        pg.select_option("[data-form] [name=vehicle_id]", veh); pg.select_option("[data-form] [name=work_type]", wt)
        pg.fill("[data-form] [name=quantity]", str(q)); pg.select_option("[data-form] [name=unit]", unit); pg.wait_for_timeout(500)
        if scope: pg.select_option("[data-jobbox] [name=job_scope]", scope); pg.wait_for_timeout(300)
        jt = pg.inner_text("[data-jobbox]"); pg.click("[data-save]"); pg.wait_for_timeout(2500)
        for _ in range(3):
            if not pg.query_selector(".sheet"): break
            pg.query_selector_all(".sheet button")[-1].click(); pg.wait_for_timeout(600)
        return jt
    jt = manual(ids["v"], "Moloz Nakliye", 6, "Sefer")
    check("götürü fiyatına DAHİL" in jt and "Binanın yıkımı" in jt, f"kayıttan önce 'dahil' ve sözleşmedeki kapsam görünüyor ({jt[:110]!r})")
    jt = manual(ids["ex"], "Kırım", 2, "Saat", scope="ekstra")
    ws = ev("async()=>(await (await import('./js/db.js')).listActive('work_records')).map(w=>[w.unit,Number(w.quantity),w.price_snapshot?.amount,w.price_snapshot?.price_source,!!w.job_extra])")
    check(["Sefer", 6, 0, "Sözleşmeye dahil", False] in ws and ["Saat", 2, 6000, "Sözleşme ekstra fiyatı", True] in ws, f"seferler dahil, kırıcı ekstra 2 × 3.000 ({ws})")
    check("Kırıcı saati: 3.000" in jt, f"ekstra seçilince sözleşmedeki fiyat gösteriliyor ({jt[:120]!r})")
    # iş ekranı: kalan, hurda, özet, kilit
    pg.goto(U + f"index.html#/is-sozlesmesi/{sid}"); pg.wait_for_timeout(2500)
    ch = pg.inner_text("[data-charge]")
    check("246.000" in ch, f"bu işten kalan ≈ bedel + ekstra − ödemeler ({ch[ch.find('kalan'):][:60]!r})")
    pg.fill("[data-scrap] [name=sc_amount]", "15000"); pg.fill("[data-scrap] [name=sc_buyer]", "Test Hurdacı"); pg.click("[data-scrap-add]"); pg.wait_for_timeout(2000)
    sm = pg.inner_text("[data-summary]")
    check("15.000" in sm and "6.000" in sm and "200.000" in sm, f"iş özeti: gelir, ekstra, hurda ({sm[:140]!r})")
    check(abs(bal() - b0 - 246000) < 0.01, "hurda satışı cariye yazılmadı")
    pg.goto(U + f"index.html#/is-sozlesmesi/{sid}?duzenle=1"); pg.wait_for_timeout(2000)
    dis = ev("['basis','price','kdv_rate','kdv_included'].map(n=>document.querySelector(`[name=${n}]`).disabled)")
    check(dis == [True, True, True, True], "bedeli cariye yazılmış anlaşmada tür, bedel ve KDV kilitli")
    pg.fill("[name=scope_out]", "Ruhsat ve elektrik kesimi işverende"); pg.click("[data-save]"); pg.wait_for_timeout(2000)
    so = ev(f"async()=>(await (await import('./js/db.js')).get('sites','{sid}')).deal")
    check(so["scope_out"].startswith("Ruhsat ve elektrik") and so["price"] == 200000 and so["charge"] and len(so["scrap_sales"]) == 1, "kapsam düzenlendi; bedel, cari kaydı ve hurda korunuyor")
    integ = ev("async()=>{const db=await import('./js/db.js');const ic=await import('./js/integrity-core.js');const core=await import('./js/core.js');return ic.integrityCheck(await db.dumpAll(),{today:core.todayStr()}).issues.filter(x=>x.sev==='error').map(x=>x.code+': '+x.text)}")
    check(not integ, f"Veri Sağlığı hata yok ({integ})")
    # Eksik okunan belge: uyarılar görünür, hiçbir şey yazılmaz
    PLANS.append({"basis": None, "price": None, "customer_name": "Bilinmeyen Firma Test"})
    pg.goto(U + "index.html#/is-sozlesmeleri/oku"); pg.wait_for_timeout(2000)
    pg.set_input_files("[data-cfile]", files=[{"name": "eksik.pdf", "mimeType": "application/pdf", "buffer": PDF}]); pg.click("[data-cread]"); pg.wait_for_timeout(3000)
    r2 = pg.inner_text("[data-cres]")
    check("Kontrol edin" in r2 and "bulunamadı" in r2 and "Yeni müşteri: Bilinmeyen Firma Test" in r2, "eksik belgede uyarılar; bilinmeyen müşteri yeni olarak önerilir")
    ov = ev("({sw:document.documentElement.scrollWidth,w:document.documentElement.clientWidth})")
    check(ov["sw"] <= ov["w"], f"360 px taşma yok ({ov})")
    check(not errs, f"sayfa hatası yok {errs[:2]}")
    b.close()
print("\nSONUÇ:", "BAŞARILI" if not FAIL else f"{len(FAIL)} SORUN")
