# Ödeme / fiyat karışması — gerçek ekran testi (TEST VERİSİ, taklit Gemini YANLIŞ çıktı verir).
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
    PLANS = []; CALLS = []
    def gem(route):
        CALLS.append(1); plan = PLANS.pop(0) if PLANS else {}
        route.fulfill(status=200, content_type="application/json", body=json.dumps({"candidates": [{"content": {"parts": [{"text": json.dumps(plan, ensure_ascii=False)}]}, "finishReason": "STOP"}]}, ensure_ascii=False))
    pg = ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e))); pg.route("https://generativelanguage.googleapis.com/**", gem)
    pg.goto(U + "index.html"); pg.wait_for_timeout(5000)
    ev = lambda js: pg.evaluate(js)
    T = ev("(async()=>(await import('./js/ui.js')).todayStr())()")
    ids = ev("""async()=>{const db=await import('./js/db.js');const c=await import('./js/security-core.js');
      await db.metaSet('gemini_key','K');await db.metaSet('gemini_model','gemini-2.5-flash');await db.metaSet('gemini_consent',true);
      await db.metaSet('sec_lock',{...(await c.hashSecret('482917')),idle_min:30,away_min:15});
      const k=await db.saveNew('customers',{name:'Kaya İnşaat'},'t');const v=(await db.listActive('vehicles'))[0];
      await db.saveNew('price_book',{customer_id:k.id,site_id:null,vehicle_id:null,work_type:'Moloz Nakliye',unit:'Sefer',price:3200,kdv_rate:20,kdv_included:false,valid_from:'2026-01-01',valid_to:null,active:true},'t');
      // onaylı (hakedişe girmiş, kilitli) eski iş — yeniden hesaplanmamalı
      const w=await db.saveNew('work_records',{date:'2026-10-01',customer_id:k.id,vehicle_id:v.id,work_type:'Moloz Nakliye',quantity:2,unit:'Sefer',price_snapshot:{unit_price:3000,kdv_rate:20,kdv_included:false,amount:6000,price_source:'Manuel'}},'t');
      const core=await import('./js/core.js');const items=[{work_record_id:w.id,date:w.date,customer_id:k.id,work_type:w.work_type,quantity:2,unit:'Sefer',unit_price:3000,kdv_rate:20,kdv_included:false}];const tot=core.calcHakedisTotals(items);
      const h=await db.saveNew('hakedis',{hakedis_no:await db.nextSeq('hakedis'),customer_id:k.id,site_id:null,date_from:w.date,date_to:w.date,created_date:w.date,status:'Taslak',items:tot.lines,subtotal:tot.subtotal,kdv_total:tot.kdv,grand_total:tot.grand},'t');await db.finalizeHakedis(h.id);
      return {k:k.id,v:v.id,vn:v.name,locked:w.id}}""")
    def unlock():
        if pg.query_selector("#lock-root [data-pw]"): pg.fill("#lock-root [data-pw]", PIN); pg.click("#lock-root [data-go-un]"); pg.wait_for_timeout(1200)
    pg.reload(); pg.wait_for_timeout(3000); unlock()
    snap = lambda: ev("""async()=>{const db=await import('./js/db.js');const n=async s=>(await db.listActive(s)).length;return {work:await n('work_records'),cash:await n('cash_records'),cari:await n('cari_movements'),price:await n('price_book'),audit:(await db.getAll('audit_log')).length}}""")
    locked0 = ev(f"""async()=>{{const db=await import('./js/db.js');return JSON.stringify((await db.get('work_records','{ids['locked']}')).price_snapshot)}}""")
    MSG = f"{ids['vn']} Kaya İnşaat 5 sefer moloz yaptık, 20.000 TL ödeme geldi"
    BAD = {"works": [{"date": T, "date_source": "mesaj", "customer_id": ids["k"], "vehicle_id": ids["v"], "work_type": "Moloz Nakliye", "quantity": 5, "unit": "Sefer", "unit_price": 20000, "quote": MSG}],
           "collections": [{"date": T, "customer_id": ids["k"], "amount": 20000, "method": "Nakit"}]}
    def analyze():
        PLANS.append(json.loads(json.dumps(BAD)))
        pg.goto(U + "index.html#/akilli-asistan"); pg.reload(); pg.wait_for_timeout(2500); unlock()
        ev("(()=>{const r=document.querySelector('[data-refine]');if(r)r.checked=false})()")
        pg.fill("[data-msg]", MSG); pg.click("[data-ask]"); pg.wait_for_timeout(3000)
    s0 = snap(); analyze(); s1 = snap()
    check({k: s1[k] for k in ("work", "cash", "cari", "price")} == {k: s0[k] for k in ("work", "cash", "cari", "price")}, f"taslak/önizleme hiçbir finansal kayıt yazmadı ({s0} → {s1})")
    out = pg.inner_text("[data-out]")
    up = ev("(document.querySelector('[data-kind=work] [name=unit_price]')||{}).value")
    picks = ev("[...document.querySelectorAll('[data-out] .card[data-kind]')].map(c=>c.dataset.kind+':'+c.querySelector('[data-pick]').checked)")
    check(up in ("", None), f"yanlış AI çıktısı reddedildi: iş kartında birim fiyat boş ({up!r})")
    check("birim fiyat olarak yazılmamış" in out and "Fiyat listesinden: 3.200" in out, "kartta tutarın anlamı ve fiyat listesi dayanağı ayrı gösteriliyor")
    check(picks == ["work:true", "collection:false"], f"iş işaretli, tahsilat işaretsiz ({picks})")
    pg.click("[data-save]"); pg.wait_for_timeout(2500)
    w = ev(f"""async()=>{{const db=await import('./js/db.js');const w=(await db.listActive('work_records')).find(x=>Number(x.quantity)===5);return w&&[w.price_snapshot.unit_price,w.price_snapshot.amount,w.price_snapshot.price_source]}}""")
    s2 = snap()
    check(w and w[0] == 3200 and w[1] == 16000, f"iş kaydı fiyat listesinden (3.200 × 5 = 16.000), ödeme fiyat olmadı ({w})")
    check(s2["cash"] == s0["cash"] and s2["cari"] == s0["cari"], "onay verilmeyen tahsilat yazılmadı")
    # Kullanıcı tahsilatı işaretleyip kaydeder → bir kez; aynı mesaj yeniden gönderilince ikinci tahsilat yok
    for i in range(2):
        analyze()
        ev("document.querySelectorAll('[data-out] [data-kind=work] [data-pick]').forEach(x=>{x.checked=false})")
        ev("document.querySelectorAll('[data-out] [data-kind=collection] [data-pick]').forEach(x=>{x.checked=true})")
        pg.click("[data-save]"); pg.wait_for_timeout(1500)
        for _ in range(6):  # "Aynı tahsilat kayıtlı olabilir" → Kaydet (kullanıcı ısrar eder); "zaten kaydedildi" → Vazgeç
            if not pg.query_selector(".sheet"): break
            btns = {x.inner_text().strip(): x for x in pg.query_selector_all(".sheet button")}
            (btns.get("Kaydet") or btns.get("Vazgeç") or list(btns.values())[-1]).click()
            pg.wait_for_timeout(1200)
        pg.wait_for_timeout(1000)
    s3 = snap()
    check(s3["cash"] == s0["cash"] + 1 and s3["cari"] == s0["cari"] + 1, f"tekrar gönderim çift tahsilat oluşturmadı (kasa +{s3['cash'] - s0['cash']}, cari +{s3['cari'] - s0['cari']})")
    locked1 = ev(f"""async()=>{{const db=await import('./js/db.js');return JSON.stringify((await db.get('work_records','{ids['locked']}')).price_snapshot)}}""")
    check(locked0 == locked1, "onaylı (hakedişe girmiş) eski iş yeniden hesaplanmadı")
    check(not errs, f"sayfa hatası yok {errs[:2]}")
    b.close()
print("\nSONUÇ:", "BAŞARILI" if not FAIL else f"{len(FAIL)} SORUN")
