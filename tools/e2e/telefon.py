# Telefon kabul adımları 3–5'in ekranda provası (TEST VERİSİ). Adım 1–2 kabul122.py'de.
import sys
from playwright.sync_api import sync_playwright
U = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8841/"; PIN = "482917"
FAIL = []
def check(c, m):
    print(("  ✓ " if c else "  ✗ ") + m)
    if not c: FAIL.append(m)
with sync_playwright() as p:
    b = p.chromium.launch(); errs = []
    ctx = b.new_context(viewport={'width': 412, 'height': 900}); ctx.add_init_script("try{localStorage.setItem('sp_role','boss');localStorage.setItem('spx_role','boss')}catch(e){}")
    pg = ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(U + "index.html"); pg.wait_for_timeout(5000)
    ev = lambda js: pg.evaluate(js)
    T = ev("(async()=>(await import('./js/ui.js')).todayStr())()")
    ids = ev(f"""async()=>{{const db=await import('./js/db.js');const c=await import('./js/security-core.js');
      await db.metaSet('sec_lock',{{...(await c.hashSecret('482917')),idle_min:30,away_min:15}});
      await db.saveNew('customers',{{name:'Diğer Test',fuel_rules:[{{id:'z',per:50,unit:'Sefer',match:'',only_pay:true}}]}},'t');
      const k=await db.saveNew('customers',{{name:'Kılıç Test'}},'t');const v=(await db.listActive('vehicles'))[0];
      // 3. adım hazırlık: kural yokken elle fiyatlı iş (iş formunun yazdığı alanlarla)
      const w=await db.saveNew('work_records',{{date:'{T}',customer_id:k.id,vehicle_id:v.id,work_type:'Moloz Nakliye',material:'gravak',quantity:5,unit:'Sefer',price_snapshot:{{unit_price:3000,kdv_rate:20,kdv_included:false,amount:15000,price_source:'Manuel'}}}},'t');
      await db.saveExisting('customers',k,{{fuel_rules:[{{id:'r1',per:75,unit:'Sefer',match:'gravak',only_pay:true}}]}},'t');
      return {{k:k.id,v:v.id,w:w.id}}}}""")
    def unlock():
        if pg.query_selector("#lock-root [data-pw]"): pg.fill("#lock-root [data-pw]", PIN); pg.click("#lock-root [data-go-un]"); pg.wait_for_timeout(1200)
    st = lambda: ev(f"""async()=>{{const db=await import('./js/db.js');const d=await db.dumpAll();const L=(await import('./js/assistant-rules.js')).customerFuelLedger(d,'{ids['k']}');
      return {{tl:(await import('./js/collect-core.js')).customerBalances(d).bal['{ids['k']}'],earned:L.earned,recv:L.received,bal:L.balance,n:(await db.getAll('audit_log')).length}}}}""")
    pg.reload(); pg.wait_for_timeout(3000); unlock()
    # 3. Yakıt formu: Müşteri Verdi, müşteri boş gelir; seçip 300 L
    pg.goto(U + "index.html#/yakit/new"); pg.wait_for_timeout(2000); unlock()
    pg.select_option("[data-form] [name=fuel_source]", "Müşteri Verdi"); pg.wait_for_timeout(300)
    check(pg.eval_on_selector("[data-fcust] select", "s=>s.value") == "", "3: müşteri alanı boş geliyor")
    pg.select_option("[data-form] [name=vehicle_id]", ids["v"]); pg.fill("[data-form] [name=liters]", "300")
    pg.click("[data-save]"); pg.wait_for_timeout(1500)
    check(st()["recv"] == 0, "3: müşteri seçilmeden kaydedilmedi")
    pg.select_option("[data-fcust] select", ids["k"]); pg.click("[data-save]"); pg.wait_for_timeout(2000)
    s3 = st()
    check(s3["recv"] == 300 and s3["tl"] == 15000, f"3: 300 L Kılıç Test litre hesabına bağlandı; TL alacak değişmedi ({s3})")
    # 4. İnceleme salt okunur
    pg.goto(U + "index.html#/mazot-hesaplari"); pg.wait_for_timeout(2000); unlock()
    check("İnceleme adayı" in pg.inner_text("body"), "4: liste ekranında 'İnceleme adayı'")
    pg.goto(U + f"index.html#/mazot-hesaplari/{ids['k']}"); pg.wait_for_timeout(2000)
    pg.check(f"[data-fix='{ids['w']}']"); pg.wait_for_timeout(300)
    pv = pg.inner_text("[data-fixprev]")
    check(st() == s3, "4: açmak ve önizlemek hiçbir şey yazmadı (audit dahil)")
    check(all(x in pv for x in ["Kayıt:", "O tarihte geçerli anlaşma", "Bugünkü kuraldan fark", "Değişecek:", "15.000 → 0", "0 → 375", "-300 → 75"]), f"4: önizleme içeriği\n{pv}")
    check(pg.is_disabled("[data-fixgo]"), "4: doğrulama işareti olmadan uygulanamıyor")
    # 5. Onaylı düzeltme, tekrar uygulanmaz
    pg.check("[data-agree]"); pg.click("[data-fixgo]"); pg.wait_for_timeout(600); pg.click(".sheet button[data-x='1']"); pg.wait_for_timeout(2500)
    s5 = st()
    check(s5["tl"] == 0 and s5["earned"] == 375 and s5["bal"] == 75, f"5: TL 15.000 düştü, litre 375 / 300 / 75 ({s5})")
    pg.reload(); pg.wait_for_timeout(2500); unlock()
    check(not pg.query_selector(f"[data-fix='{ids['w']}']"), "5: yenileyince iş listede yok (ikinci kez uygulanamaz)")
    check(not errs, f"sayfa hatası yok {errs[:2]}")
    b.close()
print("\nSONUÇ:", "BAŞARILI" if not FAIL else f"{len(FAIL)} SORUN")
