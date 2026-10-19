# Sürüm adayı (#121 + #122 + #123) — PR'lar ARASI etkileşimler, gerçek ekran (TEST VERİSİ; taklit Gemini).
import json, sys
from playwright.sync_api import sync_playwright
U = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8841/"; PIN = "482917"
FAIL = []
def check(c, m):
    print(("  ✓ " if c else "  ✗ ") + m)
    if not c: FAIL.append(m)
with sync_playwright() as p:
    b = p.chromium.launch(); errs = []
    ctx = b.new_context(viewport={'width': 412, 'height': 900}); ctx.add_init_script("try{localStorage.setItem('sp_role','boss');localStorage.setItem('spx_role','boss')}catch(e){}")
    PLANS = []
    def gem(route):
        plan = PLANS.pop(0) if PLANS else {}
        route.fulfill(status=200, content_type="application/json", body=json.dumps({"candidates": [{"content": {"parts": [{"text": json.dumps(plan, ensure_ascii=False)}]}, "finishReason": "STOP"}]}, ensure_ascii=False))
    ctx.route("https://generativelanguage.googleapis.com/**", gem)
    pg = ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(U + "index.html"); pg.wait_for_timeout(5000)
    ev = lambda js, page=None: (page or pg).evaluate(js)
    T = ev("(async()=>(await import('./js/ui.js')).todayStr())()")
    ids = ev("""async()=>{const db=await import('./js/db.js');const c=await import('./js/security-core.js');
      await db.metaSet('gemini_key','K');await db.metaSet('gemini_model','gemini-2.5-flash');await db.metaSet('gemini_consent',true);
      await db.metaSet('sec_lock',{...(await c.hashSecret('482917')),idle_min:30,away_min:15});
      const k=await db.saveNew('customers',{name:'Kılıç Test',fuel_rules:[{id:'r1',per:75,unit:'Sefer',match:'gravak',only_pay:true}]},'t');
      const l=await db.saveNew('customers',{name:'Leda Test'},'t');
      const v=(await db.listActive('vehicles'))[0];
      const w1=await db.saveNew('work_records',{date:'2026-10-09',customer_id:k.id,vehicle_id:v.id,work_type:'Moloz Nakliye',material:'gravak',quantity:5,unit:'Sefer',price_snapshot:{unit_price:3000,amount:15000,kdv_rate:20,kdv_included:false,price_source:'Genel Liste'}},'t');
      return {k:k.id,l:l.id,v:v.id,vn:v.name,w1:w1.id}}""")
    def unlock(page=None):
        page = page or pg
        if page.query_selector("#lock-root [data-pw]"): page.fill("#lock-root [data-pw]", PIN); page.click("#lock-root [data-go-un]"); page.wait_for_timeout(1200)
    pg.reload(); pg.wait_for_timeout(3000); unlock()
    cnt = lambda: ev("""async()=>{const db=await import('./js/db.js');const d=await db.dumpAll();const a=s=>(d[s]||[]).filter(x=>!x.deleted_at).length;
      const ops=(await db.getAll('meta')).filter(m=>String(m.key).startsWith('op:'));return {cash:a('cash_records'),cari:a('cari_movements'),ops:ops.map(m=>m.key)}}""")
    MSG = "Leda Test 7.500 TL ödedi"
    PLAN = {"collections": [{"date": T, "customer_id": ids["l"], "amount": 7500, "method": "Nakit"}]}
    def send():
        PLANS.append(json.loads(json.dumps(PLAN)))
        pg.goto(U + "index.html#/akilli-asistan"); pg.reload(); pg.wait_for_timeout(2500); unlock()
        ev("(()=>{const r=document.querySelector('[data-refine]');if(r)r.checked=false})()")
        pg.fill("[data-msg]", MSG); pg.click("[data-ask]"); pg.wait_for_timeout(3000)
        ev("document.querySelectorAll('[data-out] [data-kind=collection] [data-pick]').forEach(x=>{x.checked=true})")
        pg.click("[data-save]"); pg.wait_for_timeout(2000)
    c0 = cnt(); send(); c1 = cnt()
    key = ev("async()=>{const db=await import('./js/db.js');return (await db.listActive('cash_records'))[0]?.request_id||''}")
    check(c1["cash"] == c0["cash"] + 1 and c1["cari"] == c0["cari"] + 1 and ("op:" + key) in c1["ops"] and key.startswith("col-"),
          f"#122 kaynak anahtarı #121 işlem kaydına yazıldı (op:{key[:12]}…); tek kasa + tek cari")
    send()
    st = pg.inner_text(".sheet") if pg.query_selector(".sheet") else ""
    check("Tekrar mı" in st or "daha önce kaydedildi" in st, "aynı mesaj yeniden: #122 'tekrar mı, yeni ödeme mi' sorusu (#121 kapısı araya girmiyor)")
    bt = next((x for x in pg.query_selector_all(".sheet button") if x.inner_text().strip().startswith("Tekrar")), None)
    if bt: bt.click(); pg.wait_for_timeout(1500)
    for _ in range(4):
        if not pg.query_selector(".sheet"): break
        pg.query_selector_all(".sheet button")[0].click(); pg.wait_for_timeout(800)
    c2 = cnt()
    check(c2["cash"] == c1["cash"] and c2["cari"] == c1["cari"] and len(c2["ops"]) == len(c1["ops"]), f"tekrar seçilince ikinci kayıt ve ikinci işlem kimliği yok ({c2['cash']})")
    # Geri al (#121) → sonra aynı mesaj yeniden: silinmiş kaydın kimliği yeniden kullanılabilir, tahsilat tekrar yazılabilir
    pg.goto(U + "index.html#/akilli-asistan"); pg.reload(); pg.wait_for_timeout(2500); unlock()
    if pg.query_selector("[data-undo]"):
        pg.click("[data-undo]"); pg.wait_for_timeout(1000)
        for _ in range(3):
            bt = pg.query_selector(".sheet button[data-x='1']")
            if not bt: break
            bt.click(); pg.wait_for_timeout(1500)
    c3 = cnt()
    check(c3["cash"] == c0["cash"] and c3["cari"] == c0["cari"], f"#121 geri al: tahsilat ve cari hareket geri alındı ({c3['cash']}/{c3['cari']})")
    send()
    for _ in range(4):
        if not pg.query_selector(".sheet"): break
        pg.query_selector_all(".sheet button")[-1].click(); pg.wait_for_timeout(1000)
    c4 = cnt()
    check(c4["cash"] == c0["cash"] + 1, f"geri alınan tahsilat aynı mesajla yeniden yazılabildi (eski kimlik engellemedi) ({c4['cash']})")
    # #123 düzeltmesi açık iş formunun üzerine yazılmaz (#121 eşzamanlılık): A sekmesi formu açık, B sekmesi mazot düzeltmesi uygular
    pa = ctx.new_page(); pa.on("pageerror", lambda e: errs.append(str(e)))
    pa.goto(U + f"index.html#/isler/{ids['w1']}/edit"); pa.wait_for_timeout(2500); unlock(pa)
    pg.goto(U + f"index.html#/mazot-hesaplari/{ids['k']}"); pg.reload(); pg.wait_for_timeout(2500); unlock()
    pg.check(f"[data-fix='{ids['w1']}']"); pg.check("[data-agree]"); pg.click("[data-fixgo]"); pg.wait_for_timeout(600)
    pg.click(".sheet button[data-x='1']"); pg.wait_for_timeout(2000)
    ev("(()=>{const q=document.querySelector('[name=description]');if(q){q.value='açıklama değişti';q.dispatchEvent(new Event('input'))}})()", pa)
    pa.click("[data-save]"); pa.wait_for_timeout(2500)
    st = pa.inner_text(".sheet") if pa.query_selector(".sheet") else ""
    w = ev(f"async()=>{{const w=await (await import('./js/db.js')).get('work_records','{ids['w1']}');return [w.customer_fuel_allowance_l,w.price_snapshot.price_source,w.price_snapshot.amount]}}")
    check(w == [375, "Mazot karşılığı", 0], f"onaylı mazot düzeltmesi açık formdan gelen kayıtla ezilmedi ({w}; dialog: {st[:60]!r})")
    pa.close()
    # Veri sağlığı (#121 bütünlük denetimi) yeni alanlarla (kaynak kimliği, fuel_fix_op) çalışıyor
    r = ev("""async()=>{try{const d=await (await import('./js/db.js')).dumpAll();const ic=await import('./js/integrity-core.js');const x=ic.integrityCheck(d,{today:'2026-10-18'});return 'ok:'+(Array.isArray(x)?x.length:Object.keys(x||{}).length)}catch(e){return 'HATA:'+e.message}}""")
    check(r.startswith("ok"), f"bütünlük denetimi yeni alanlarla hatasız ({r})")
    pg.goto(U + "index.html#/veri-sagligi"); pg.wait_for_timeout(2500); unlock()
    check(not errs, f"sayfa hatası yok {errs[:2]}")
    b.close()
print("\nSONUÇ:", "BAŞARILI" if not FAIL else f"{len(FAIL)} SORUN")
