# Müşteri panosu sunumu — gerçek ekran, telefon genişliği (TEST VERİSİ). Kayıt yazmaz, hesap değiştirmez.
import sys
from playwright.sync_api import sync_playwright
U = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8846/"; PIN = "482917"
FAIL = []
def check(c, m):
    print(("  ✓ " if c else "  ✗ ") + m)
    if not c: FAIL.append(m)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']); errs = []
    ctx = b.new_context(viewport={'width': 360, 'height': 800}); ctx.add_init_script("try{localStorage.setItem('sp_role','boss');localStorage.setItem('spx_role','boss')}catch(e){}")
    pg = ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(U + "index.html"); pg.wait_for_timeout(5000)
    ev = lambda js: pg.evaluate(js)
    k = ev("""async()=>{const db=await import('./js/db.js');const c=await import('./js/security-core.js');
      await db.metaSet('sec_lock',{...(await c.hashSecret('482917')),idle_min:30,away_min:15});
      const k=await db.saveNew('customers',{name:'Kılıç Test',fuel_rules:[{id:'r1',per:75,unit:'Sefer',match:'',only_pay:true}]},'t');const v=(await db.listActive('vehicles'))[0];
      const y=new Date().getFullYear();
      for (const [dt,q] of [[(y-1)+'-12-10',6],[y+'-03-05',7],[y+'-09-20',8]]) await db.saveNew('work_records',{date:dt,customer_id:k.id,vehicle_id:v.id,work_type:'Moloz Nakliye',quantity:q,unit:'Sefer',customer_fuel_allowance_l:q*75,fuel_rule_id:'r1',price_snapshot:{unit_price:0,amount:0,kdv_rate:0,kdv_included:false,price_source:'Mazot karşılığı'}},'t');
      for (const L of [300,225]) await db.saveNew('fuel_records',{date:y+'-06-01',vehicle_id:v.id,liters:L,fuel_source:'Müşteri Verdi',customer_id:k.id,total:null,unit_price:null,receipt:'Müşteri',customer_billable:false},'t');
      return k.id}""")
    def unlock():
        if pg.query_selector("#lock-root [data-pw]"): pg.fill("#lock-root [data-pw]", PIN); pg.click("#lock-root [data-go-un]"); pg.wait_for_timeout(1200)
    snap = lambda: ev("async()=>{const db=await import('./js/db.js');const d=await db.dumpAll();return JSON.stringify(['work_records','fuel_records','cari_movements','cash_records','customers'].map(s=>(d[s]||[]).map(x=>x.id+':'+(x.updated_at||'')).sort()))+(await db.getAll('audit_log')).length}")
    pg.reload(); pg.wait_for_timeout(3000); unlock()
    s0 = snap()
    pg.goto(U + f"index.html#/musteriler/{k}"); pg.wait_for_timeout(3000); unlock()
    fp = pg.query_selector("[data-fuelpanel]")
    t = fp.inner_text() if fp else ""
    check("Hak edilen mazot" in t and "1.575 L" in t and "21 sefer × 75 L" in t, "hak edilen 1.575 L (21 sefer × 75 L) ayrı satırda")
    check("Alınan mazot" in t and "525 L" in t, "alınan 525 L ayrı satırda")
    check("Kalan mazot alacağı" in t and "1.050 L" in t, "kalan mazot alacağı 1.050 L ayrı ve yazıyla")
    check("Bu işler mazotla ödenir. TL bakiye, mazot alacağını içermez." in t and "hesabın kapandığı anlamına gelmez" in t, "yalnız mazot açıklaması; 0 ₺ 'kapandı' sanılmıyor")
    pt = ev("document.querySelector('[data-custdash]').textContent")
    check(pt.index("Kalan mazot alacağı") < pt.index("Güncel TL bakiye"), "kalan mazot TL bakiyeden önce (öncelikli)")
    check("Seçili dönem: Bu yıl" in pt and "Güncel durum" in pt and "dönem seçiminden bağımsız" in pt and "Seçili dönemde (Bu yıl) hak edilen: 1.125 L" in t, "dönem toplamları (bu yıl 1.125 L) tüm zamanlardan ayrı yazılıyor")
    check("Mazot karşılığı\n" not in pt and "KDV dahil alacak" not in pt.replace('"KDV dahil alacak" değildir', ""), "belirsiz 'Mazot karşılığı' kutusu ve yanlış KDV etiketi yok")
    wb = pg.inner_text("[data-custworks]") if pg.query_selector("[data-custworks]") else ""
    check("TL bakiye 0 ₺" in wb and "1.050 L mazot alacağı" in wb, "'Yapılan işler' rozetinde TL bakiye ve mazot alacağı birlikte")
    ov = ev("(()=>{const w=document.documentElement.clientWidth;const bad=[...document.querySelectorAll('[data-custdash] *, [data-custworks] *')].filter(e=>e.getBoundingClientRect().right>w+1).map(e=>e.className||e.tagName);return {sw:document.documentElement.scrollWidth,w,bad:bad.slice(0,3)}})()")
    check(ov["sw"] <= ov["w"] and not ov["bad"], f"360 px genişlikte taşma yok ({ov})")
    for per in ["Bu ay", "Tümü"]:
        pg.click(f"[data-custdash] [data-dper]:text-is('{per}')"); pg.wait_for_timeout(500)
        t2 = pg.inner_text("[data-fuelpanel]")
        check("1.050 L" in t2, f"'{per}' seçilince de güncel kalan 1.050 L değişmiyor")
    check("referans" not in pg.inner_text("[data-fuelpanel]").lower(), "litre hesabı için referans TL fiyatı istenmiyor")
    check(snap() == s0, "pano hiçbir kayıt yazmadı (audit dahil)")
    check(not errs, f"sayfa hatası yok {errs[:2]}")
    if len(sys.argv) > 2:  # isteğe bağlı ekran görüntüsü
        pg.click("[data-custdash] [data-dper]:text-is('Bu yıl')"); pg.wait_for_timeout(400)
        pg.query_selector("[data-custdash]").screenshot(path=sys.argv[2])
    b.close()
print("\nSONUÇ:", "BAŞARILI" if not FAIL else f"{len(FAIL)} SORUN")
