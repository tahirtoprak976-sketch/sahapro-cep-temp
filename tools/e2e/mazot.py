# Mazot (sefer başı litre) hesabı denetimi — gerçek ekran (TEST VERİSİ, gerçek kayıt yok).
import sys
from playwright.sync_api import sync_playwright
U = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8843/"; PIN = "482917"
FAIL = []
def check(c, m):
    print(("  ✓ " if c else "  ✗ ") + m)
    if not c: FAIL.append(m)
with sync_playwright() as p:
    b = p.chromium.launch(); errs = []
    ctx = b.new_context(viewport={'width': 412, 'height': 900}); ctx.add_init_script("try{localStorage.setItem('sp_role','boss');localStorage.setItem('spx_role','boss')}catch(e){}")
    pg = ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(U + "index.html"); pg.wait_for_timeout(5000)
    ev = lambda js, page=None: (page or pg).evaluate(js)
    ids = ev("""async()=>{const db=await import('./js/db.js');const c=await import('./js/security-core.js');
      await db.metaSet('sec_lock',{...(await c.hashSecret('482917')),idle_min:30,away_min:15});
      const k=await db.saveNew('customers',{name:'Kılıç Test',fuel_rules:[{id:'r1',per:75,unit:'Sefer',match:'gravak',only_pay:true}]},'t');
      const o=await db.saveNew('customers',{name:'Diğer Test',fuel_rules:[{id:'r2',per:50,unit:'Sefer',match:'',only_pay:true}]},'t');
      const v=(await db.listActive('vehicles'))[0];
      const ps=(a)=>({unit_price:3000,amount:3000*a,kdv_rate:20,kdv_included:false,price_source:'Genel Liste'});
      // kurala uyan ama TL yazılmış (kural sonradan eklenmiş gibi) + kurala uymayan TL iş + doğru iş
      const w1=await db.saveNew('work_records',{date:'2026-10-09',customer_id:k.id,vehicle_id:v.id,work_type:'Moloz Nakliye',material:'gravak',quantity:5,unit:'Sefer',price_snapshot:ps(5)},'t');
      const w2=await db.saveNew('work_records',{date:'2026-10-10',customer_id:k.id,vehicle_id:v.id,work_type:'Moloz Nakliye',material:'moloz',quantity:2,unit:'Sefer',price_snapshot:ps(2)},'t');
      await db.saveNew('fuel_records',{date:'2026-10-11',vehicle_id:v.id,liters:200,fuel_source:'Müşteri Verdi',customer_id:k.id,total:null,unit_price:null,receipt:'Müşteri',customer_billable:false},'t');
      await db.saveNew('fuel_tank_movements',{date:'2026-10-11',move_type:'GİRİŞ',liters:100,note:'Kılıç Test mazot getirdi'},'t');
      return {k:k.id,o:o.id,w1:w1.id,w2:w2.id}}""")
    def unlock(page=None):
        page = page or pg
        if page.query_selector("#lock-root [data-pw]"): page.fill("#lock-root [data-pw]", PIN); page.click("#lock-root [data-go-un]"); page.wait_for_timeout(1200)
    state = lambda page=None: ev(f"""async()=>{{const db=await import('./js/db.js');const d=await db.dumpAll();const cc=await import('./js/collect-core.js');const r=await import('./js/assistant-rules.js');
      const L=r.customerFuelLedger(d,'{ids['k']}');return {{tl:cc.customerBalances(d).bal['{ids['k']}'],earned:L.earned,recv:L.received,bal:L.balance,
      audit:(await db.getAll('audit_log')).filter(a=>/Mazot denetimi/.test(a.reason||'')).length}}}}""", page)
    pg.reload(); pg.wait_for_timeout(3000); unlock()
    s0 = state()
    check(s0["tl"] == 21000 and s0["bal"] == -200, f"başlangıç (hata görüntüsü): TL alacak 21.000, litre −200 ({s0})")
    pg.goto(U + "index.html#/mazot-hesaplari"); pg.wait_for_timeout(2000); unlock()
    t = pg.inner_text("#app") if pg.query_selector("#app") else pg.inner_text("body")
    check("Denetim:" in t and "2 iş TL fiyatla yazılmış" in t and "21.000" in t and "1 yakıt kaydı" in t, "liste ekranında denetim uyarısı (TL iş ve bağlanmamış yakıt)")
    check(state() == s0, "ekranı açmak hiçbir şey yazmadı")
    pg.goto(U + f"index.html#/mazot-hesaplari/{ids['k']}"); pg.wait_for_timeout(2000); unlock()
    t = pg.inner_text("body")
    check("1. Kurala uyan ama TL fiyatla yazılmış" in t and "2. Kurala uymayan TL işler" in t and '"gravak" kelimesi yok' in t, "ayrıntıda nedenler ayrı ayrı gösteriliyor")
    pg.check(f"[data-fix='{ids['w1']}']"); pg.wait_for_timeout(300)
    pv = pg.inner_text("[data-fixprev]")
    check("21.000 → 6.000" in pv and "0 → 375" in pv and "-200 → 175" in pv, f"önizleme: eski/yeni TL ve litre ({pv})")
    # İki sekme aynı anda onaylar → tek düzeltme
    pg2 = ctx.new_page(); pg2.on("pageerror", lambda e: errs.append(str(e)))
    pg2.goto(U + f"index.html#/mazot-hesaplari/{ids['k']}"); pg2.wait_for_timeout(2500); unlock(pg2)
    pg2.check(f"[data-fix='{ids['w1']}']")
    pg.click("[data-fixgo]"); pg2.click("[data-fixgo]"); pg.wait_for_timeout(800)
    for page in (pg, pg2):
        btn = page.query_selector(".sheet button[data-x='1']")
        if btn: btn.click()
    pg.wait_for_timeout(2500)
    s1 = state()
    check(s1["tl"] == 6000 and s1["earned"] == 375 and s1["bal"] == 175, f"düzeltme sonrası: TL 6.000 (kurala uymayan iş duruyor), litre 375/200/175 ({s1})")
    check(s1["audit"] == 1, f"iki sekmeden onay: tek düzeltme kaydı ({s1['audit']})")
    pg2.close()
    pg.goto(U + f"index.html#/mazot-hesaplari/{ids['k']}"); pg.reload(); pg.wait_for_timeout(2500); unlock()
    check(not pg.query_selector(f"[data-fix='{ids['w1']}']"), "düzeltilen iş listeden çıktı (yeniden işlemede ikinci düzeltme yok)")
    # Bağlanmamış depo girişi: onayla bağlanır
    pg.click("[data-link]"); pg.wait_for_timeout(600)
    st = pg.inner_text(".sheet")
    check("175 → 75" in st, f"bağlama önizlemesi kalan litreyi gösteriyor ({st[:120]})")
    pg.click(".sheet button[data-x='1']"); pg.wait_for_timeout(2000)
    check(state()["bal"] == 75, "depo girişi bağlandı: kalan 75 L")
    # Toplu "kuralı geçmiş işlere uygula": önce onay; Vazgeç → yazılmaz; mevcut litre hakkı silinmez
    ev(f"""async()=>{{const db=await import('./js/db.js');const v=(await db.listActive('vehicles'))[0];
      await db.saveNew('work_records',{{date:'2026-10-12',customer_id:'{ids['o']}',vehicle_id:v.id,work_type:'Moloz Nakliye',quantity:4,unit:'Sefer',price_snapshot:{{unit_price:3000,amount:12000,kdv_rate:20,kdv_included:false,price_source:'Genel Liste'}}}},'t')}}""")
    pg.goto(U + f"index.html#/musteriler/{ids['o']}"); pg.wait_for_timeout(2500); unlock()
    btn = pg.query_selector("[data-fuelapply]")
    if btn:
        btn.click(); pg.wait_for_timeout(800)
        st = pg.inner_text(".sheet") if pg.query_selector(".sheet") else ""
        check("1 iş değişecek" in st and "12.000 → 0" in st, f"toplu uygulama önce önizleme gösteriyor ({st[:100]})")
        pg.click(".sheet button[data-x='0']"); pg.wait_for_timeout(1200)
        tl = ev(f"async()=>(await import('./js/collect-core.js')).customerBalances(await (await import('./js/db.js')).dumpAll()).bal['{ids['o']}']")
        check(tl == 12000, "Vazgeç → hiçbir iş değişmedi")
    else:
        check(False, "müşteri kartında 'kuralı uygula' düğmesi bulunamadı")
    # Yakıt formu: müşteri ön seçili gelmez
    pg.goto(U + "index.html#/yakit/new"); pg.wait_for_timeout(2000); unlock()
    sel = ev("(()=>{const s=document.querySelector('[data-fcust] select');return s?s.value:'YOK'})()")
    check(sel == "", f"yakıt formunda 'mazotu veren müşteri' ön seçili değil ({sel!r})")
    check(not errs, f"sayfa hatası yok {errs[:2]}")
    b.close()
print("\nSONUÇ:", "BAŞARILI" if not FAIL else f"{len(FAIL)} SORUN")
