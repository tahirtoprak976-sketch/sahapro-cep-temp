# Mazot (sefer başı litre) hesabı incelemesi — gerçek ekran (TEST VERİSİ, gerçek kayıt yok).
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
      const v=(await db.listActive('vehicles'))[0];
      const ps=(a)=>({unit_price:3000,amount:3000*a,kdv_rate:20,kdv_included:false,price_source:'Genel Liste'});
      const w1=await db.saveNew('work_records',{date:'2026-10-09',customer_id:k.id,vehicle_id:v.id,work_type:'Moloz Nakliye',material:'gravak',quantity:5,unit:'Sefer',price_snapshot:ps(5)},'t');
      const w2=await db.saveNew('work_records',{date:'2026-10-10',customer_id:k.id,vehicle_id:v.id,work_type:'Moloz Nakliye',material:'moloz',quantity:2,unit:'Sefer',price_snapshot:ps(2)},'t');
      // doğru kaydedilmiş, litre hakkı olan eski iş (o günkü kural 70 L idi) — bugünkü kuralla yeniden hesaplanmamalı
      const w3=await db.saveNew('work_records',{date:'2026-10-02',customer_id:k.id,vehicle_id:v.id,work_type:'Moloz Nakliye',material:'gravak',quantity:2,unit:'Sefer',customer_fuel_allowance_l:140,fuel_rule_id:'r1',price_snapshot:{unit_price:0,amount:0,kdv_rate:0,kdv_included:false,price_source:'Mazot karşılığı',fuel_liters_per_unit:70}},'t');
      await db.saveNew('fuel_records',{date:'2026-10-11',vehicle_id:v.id,liters:200,fuel_source:'Müşteri Verdi',customer_id:k.id,total:null,unit_price:null,receipt:'Müşteri',customer_billable:false},'t');
      // 300 L: müşteri verdi ama müşterisi boş kalmış mevcut kayıt
      const f3=await db.saveNew('fuel_records',{date:'2026-10-12',vehicle_id:v.id,liters:300,fuel_source:'Müşteri Verdi',customer_id:null,total:null,unit_price:null,receipt:'Müşteri',customer_billable:false,description:'Kılıç Hafriyat 300 litre'},'t');
      return {k:k.id,w1:w1.id,w2:w2.id,w3:w3.id,f3:f3.id}}""")
    def unlock(page=None):
        page = page or pg
        if page.query_selector("#lock-root [data-pw]"): page.fill("#lock-root [data-pw]", PIN); page.click("#lock-root [data-go-un]"); page.wait_for_timeout(1200)
    state = lambda page=None: ev(f"""async()=>{{const db=await import('./js/db.js');const d=await db.dumpAll();const cc=await import('./js/collect-core.js');const r=await import('./js/assistant-rules.js');
      const L=r.customerFuelLedger(d,'{ids['k']}');const a=await db.getAll('audit_log');return {{tl:cc.customerBalances(d).bal['{ids['k']}'],earned:L.earned,recv:L.received,bal:L.balance,
      fixes:a.filter(x=>/Mazot incelemesi: kural/.test(x.reason||'')).length,links:a.filter(x=>/Mazot incelemesi: mevcut yakıt/.test(x.reason||'')).length,
      fuel:(d.fuel_records||[]).filter(x=>!x.deleted_at).length,cash:(d.cash_records||[]).filter(x=>!x.deleted_at).length,cari:(d.cari_movements||[]).filter(x=>!x.deleted_at).length,audit:a.length}}}}""", page)
    pg.reload(); pg.wait_for_timeout(3000); unlock()
    s0 = state()
    check(s0["tl"] == 21000 and s0["earned"] == 140 and s0["recv"] == 200 and s0["bal"] == -60, f"başlangıç: TL 21.000, litre 140 hak / 200 alındı / −60 ({s0})")
    pg.goto(U + "index.html#/mazot-hesaplari"); pg.wait_for_timeout(2000); unlock()
    t = pg.inner_text("body")
    check("İnceleme adayı" in t and "hata olduğu kesin değil" in t and "Denetim:" not in t, "liste ekranında 'inceleme adayı' etiketi (kesin hata değil)")
    pg.goto(U + f"index.html#/mazot-hesaplari/{ids['k']}"); pg.wait_for_timeout(2000); unlock()
    t = pg.inner_text("body")
    check(state() == s0, "inceleme ekranlarını açmak hiçbir kayıt yazmadı (audit dahil)")
    check("1. Bugünkü kurala uyan" in t and "2. Bugünkü kurala uymayan" in t and "Olası neden" in t and "doğrulanmaz" in t, "adaylar ayrı ve 'olası neden' olarak gösteriliyor; sözleşme modeli açık bırakılıyor")
    pg.check(f"[data-fix='{ids['w1']}']"); pg.wait_for_timeout(300)
    pv = pg.inner_text("[data-fixprev]")
    check(all(x in pv for x in ["Kayıt:", "09.10.2026".split(".")[0] and "2026-10-09", "O tarihte geçerli anlaşma", "Bugünkü kuraldan fark", "Değişecek:", "21.000 → 6.000", "140 → 515", "Alınan: 200 L", "-60 → 315"]), f"önizleme: kayıt, o tarihteki anlaşma, fark, TL ve litre eski/yeni, değişecek alanlar\n{pv}")
    check(pg.is_disabled("[data-fixgo]"), "anlaşma doğrulanmadan uygula düğmesi kapalı")
    check(state() == s0, "önizleme hiçbir şey yazmadı")
    # İki sekmeden onay → tek düzeltme
    pg2 = ctx.new_page(); pg2.on("pageerror", lambda e: errs.append(str(e)))
    pg2.goto(U + f"index.html#/mazot-hesaplari/{ids['k']}"); pg2.wait_for_timeout(2500); unlock(pg2)
    for page in (pg, pg2):
        page.check(f"[data-fix='{ids['w1']}']"); page.check("[data-agree]")
    pg.click("[data-fixgo]"); pg2.click("[data-fixgo]"); pg.wait_for_timeout(800)
    for page in (pg, pg2):
        bt = page.query_selector(".sheet button[data-x='1']")
        if bt: bt.click()
    pg.wait_for_timeout(2500)
    s1 = state()
    check(s1["tl"] == 6000 and s1["earned"] == 515 and s1["bal"] == 315 and s1["fixes"] == 1, f"onaylı düzeltme: TL 6.000, hak 515, kalan 315; iki sekmeden tek düzeltme ({s1})")
    pg2.close()
    pg.goto(U + f"index.html#/mazot-hesaplari/{ids['k']}"); pg.reload(); pg.wait_for_timeout(2500); unlock()
    check(not pg.query_selector(f"[data-fix='{ids['w1']}']"), "uygulanan düzeltme yeniden listelenmiyor (tekrar uygulanamaz)")
    # 300 L mevcut kayıt: bağla (yeni yakıt / tahsilat yok)
    pg.click(f"[data-link='fuel_records|{ids['f3']}']"); pg.wait_for_timeout(600)
    st = pg.inner_text(".sheet")
    check("300 L" in st and "Yeni yakıt / tahsilat kaydı açılmaz" in st and "315 → 15" in st, f"bağlama önizlemesi: mevcut kayıt, değişecek alan, kalan litre ({st[:200]})")
    pg.click(".sheet button[data-x='1']"); pg.wait_for_timeout(2000)
    s2 = state()
    check(s2["bal"] == 15 and s2["recv"] == 500 and s2["fuel"] == s0["fuel"] and s2["cash"] == s0["cash"] and s2["cari"] == s0["cari"], f"300 L mevcut kayda bağlandı; ikinci yakıt / tahsilat / cari yok ({s2})")
    # Eski litre hakkı: kural 75→80 değişse de işi düzenleyip kaydetmek eski hakkı değiştirmez
    ev(f"""async()=>{{const db=await import('./js/db.js');const c=await db.get('customers','{ids['k']}');await db.saveExisting('customers',c,{{fuel_rules:[{{...c.fuel_rules[0],per:80}}]}},'t')}}""")
    pg.goto(U + f"index.html#/isler/{ids['w3']}/edit"); pg.wait_for_timeout(2500); unlock()
    pg.click("[data-save]"); pg.wait_for_timeout(2500)
    for _ in range(3):
        bt = pg.query_selector(".sheet button[data-x='1']")
        if not bt: break
        bt.click(); pg.wait_for_timeout(1200)
    w3 = ev(f"async()=>{{const w=await (await import('./js/db.js')).get('work_records','{ids['w3']}');return [w.customer_fuel_allowance_l,w.price_snapshot&&w.price_snapshot.price_source]}}")
    check(w3 == [140, "Mazot karşılığı"], f"düzenlemede eski litre hakkı bugünkü kuralla yeniden hesaplanmadı ({w3})")
    # Müşteri kartında toplu uygulama yok, inceleme ekranına gider
    pg.goto(U + f"index.html#/musteriler/{ids['k']}"); pg.wait_for_timeout(2500); unlock()
    check(not pg.query_selector("[data-fuelapply]") and pg.query_selector(f"[data-go='#/mazot-hesaplari/{ids['k']}']") is not None, "müşteri kartında toplu kural uygulama yok; incelemeye yönlendiriyor")
    pg.goto(U + "index.html#/yakit/new"); pg.wait_for_timeout(2000); unlock()
    sel = ev("(()=>{const s=document.querySelector('[data-fcust] select');return s?s.value:'YOK'})()")
    check(sel == "", f"yakıt formunda 'mazotu veren müşteri' ön seçili değil ({sel!r})")
    check(not errs, f"sayfa hatası yok {errs[:2]}")
    b.close()
print("\nSONUÇ:", "BAŞARILI" if not FAIL else f"{len(FAIL)} SORUN")
