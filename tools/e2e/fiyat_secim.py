# Eşit öncelikli iki fiyat kuralı: elle iş formu ve hakediş SESSİZ SEÇMEZ; fiyat kuralı geçmişi. TEST VERİSİ.
import sys
from playwright.sync_api import sync_playwright
U = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8846/"
FAIL = []
def check(c, m):
    print(("  ✓ " if c else "  ✗ ") + m)
    if not c: FAIL.append(m)
with sync_playwright() as p:
    b = p.chromium.launch(); errs = []
    ctx = b.new_context(viewport={'width': 360, 'height': 800}); ctx.add_init_script("try{localStorage.setItem('sp_role','boss');localStorage.setItem('spx_role','boss')}catch(e){}")
    pg = ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(U + "index.html"); pg.wait_for_timeout(5000)
    ev = lambda js: pg.evaluate(js)
    ids = ev("""async()=>{const db=await import('./js/db.js');const core=await import('./js/core.js');const T=core.todayStr();
      const l=await db.saveNew('customers',{name:'Leda Test'},'t');const v=(await db.listActive('vehicles'))[0];
      const a=await db.saveNew('price_book',{customer_id:l.id,site_id:null,vehicle_id:null,work_type:'Moloz Nakliye',unit:'Sefer',price:2600,kdv_rate:20,kdv_included:false,valid_from:'2026-01-01',valid_to:null,active:true},'t');
      const b=await db.saveNew('price_book',{customer_id:l.id,site_id:null,vehicle_id:null,work_type:'Moloz Nakliye',unit:'Sefer',price:2800,kdv_rate:20,kdv_included:false,valid_from:'2026-01-01',valid_to:null,active:true},'t');
      await db.saveNew('work_records',{date:T,customer_id:l.id,vehicle_id:v.id,work_type:'Moloz Nakliye',unit:'Sefer',quantity:2},'t');
      return {l:l.id,v:v.id,a:a.id,T}}""")
    works = lambda: ev(f"async()=>(await (await import('./js/db.js')).listActive('work_records')).filter(w=>w.customer_id==='{ids['l']}').map(w=>[Number(w.quantity),w.price_snapshot?.unit_price??null,w.price_snapshot?.price_choice||''])")
    def form(q):
        pg.goto(U + f"index.html#/isler/new?customer_id={ids['l']}"); pg.wait_for_timeout(2500)
        pg.select_option("[data-form] [name=vehicle_id]", ids["v"]); pg.select_option("[data-form] [name=work_type]", "Moloz Nakliye")
        pg.fill("[data-form] [name=quantity]", str(q)); pg.select_option("[data-form] [name=unit]", "Sefer")
        pg.click("[data-save]"); pg.wait_for_timeout(1200)
        return pg.inner_text(".sheet") if pg.query_selector(".sheet") else ""
    t = form(3)
    check("Hangi fiyat kuralı" in t and "2.600" in t and "2.800" in t, f"elle formda iki kural soruldu ({t[:80]!r})")
    [x for x in pg.query_selector_all(".sheet button") if x.inner_text().startswith("Vazgeç")][0].click(); pg.wait_for_timeout(1200)
    check(not any(w[0] == 3 for w in works()), "Vazgeç → iş kaydedilmedi")
    form(4); [x for x in pg.query_selector_all(".sheet button") if x.inner_text().startswith("2.800")][0].click(); pg.wait_for_timeout(2500)
    for _ in range(3):
        if not pg.query_selector(".sheet"): break
        pg.query_selector_all(".sheet button")[-1].click(); pg.wait_for_timeout(600)
    w4 = [w for w in works() if w[0] == 4]
    check(w4 and w4[0][1] == 2800 and "kullanıcı seçti" in w4[0][2], f"seçilen 2.800 uygulandı ve seçim kaydedildi ({w4})")
    # Hakediş: fiyatsız işte kural sessizce seçilmez, adaylar gösterilir
    pg.goto(U + "index.html#/hakedis/new"); pg.wait_for_timeout(2500)
    pg.select_option("[name=customer_id]", ids["l"]); pg.click("[data-fetch]"); pg.wait_for_timeout(1500)
    rows = pg.inner_text("[data-rows]")
    nid = ev(f"async()=>(await (await import('./js/db.js')).listActive('work_records')).find(w=>w.customer_id==='{ids['l']}'&&Number(w.quantity)===2).id")
    val = ev(f"document.querySelector('[data-price=\"{nid}\"]')?.value")
    check("Birden çok fiyat kuralı" in rows and val == "", f"hakedişte fiyat boş, adaylar listelendi ({val!r})")
    pg.click(f"[data-pickprice='{nid}'][data-v='2600']"); pg.wait_for_timeout(500)
    tot = pg.inner_text("[data-total]")
    check(ev(f"document.querySelector('[data-price=\"{nid}\"]').value") == "2600" and "5.200" in tot, f"aday seçilince fiyat ve toplam geldi ({tot[:80]!r})")
    # Fiyat geçmişi
    ev(f"async()=>{{const db=await import('./js/db.js');const r=await db.get('price_book','{ids['a']}');await db.saveExisting('price_book',r,{{price:2700}},'Zam')}}")
    pg.goto(U + f"index.html#/fiyat/{ids['a']}"); pg.wait_for_timeout(2000)
    h = pg.inner_text("[data-pricehist]") if pg.query_selector("[data-pricehist]") else ""
    check("2.600" in h and "Fiyat geçmişi" in h.title() or "FİYAT GEÇMİŞİ" in h, f"fiyat kuralında eski fiyat geçmişte ({h[:80]!r})")
    check(not errs, f"sayfa hatası yok {errs[:2]}")
    b.close()
print("\nSONUÇ:", "BAŞARILI" if not FAIL else f"{len(FAIL)} SORUN")
