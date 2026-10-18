# Şantiye kartı birleştirme ekranı — TEST VERİSİ
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
    ids = ev("""async()=>{const db=await import('./js/db.js');
      const c=await db.saveNew('customers',{name:'Test Yapı'},'t');const c2=await db.saveNew('customers',{name:'Diğer Test'},'t');
      const s1=await db.saveNew('sites',{name:'Kadıköy Yıkım',customer_id:c.id},'t');const s2=await db.saveNew('sites',{name:'Kadıköy',customer_id:c.id,phone:'0532'},'t');
      const s3=await db.saveNew('sites',{name:'Kadıköy Peyzaj',customer_id:c2.id},'t');
      const v=(await db.listActive('vehicles'))[0];
      for(const s of [s1,s2,s2]) await db.saveNew('work_records',{date:'2026-10-10',customer_id:c.id,site_id:s.id,vehicle_id:v.id,work_type:'Hafriyat Nakliye',unit:'Sefer',quantity:1},'t');
      return {s1:s1.id,s2:s2.id,s3:s3.id}}""")
    pg.goto(U + "index.html#/kart-birlestir?tur=santiye"); pg.wait_for_timeout(2500)
    t = pg.inner_text("#screen")
    check("Şantiye" in t and "Yalnız aynı müşterinin" in t, "Kartları Birleştir ekranında Şantiye sekmesi")
    grp = ev("[...document.querySelectorAll('[data-group]')].map(x=>x.innerText)")
    check(len(grp) == 1 and "Kadıköy Peyzaj" not in grp[0], f"benzer şantiyeler yalnız aynı müşteride öneriliyor ({grp})")
    pg.click("[data-group='0']"); pg.wait_for_timeout(500)
    check(ev("document.querySelector('[data-target]').value") == ids["s2"] or ev("document.querySelector('[data-target]').value") == ids["s1"], "öneri seçildi")
    pg.select_option("[data-target]", ids["s1"])
    ev(f"document.querySelectorAll('[data-src]').forEach(c=>c.checked=c.value==='{ids['s3']}')")
    pg.click("[data-preview]"); pg.wait_for_timeout(500)
    check("Farklı müşterilerin" in pg.inner_text("[data-out]"), "farklı müşterinin şantiyesiyle birleştirme engellendi")
    ev(f"document.querySelectorAll('[data-src]').forEach(c=>c.checked=c.value==='{ids['s2']}')")
    pg.click("[data-preview]"); pg.wait_for_timeout(500)
    o = pg.inner_text("[data-out]")
    check("İş kaydı: 2" in o and "0532" in o, f"önizleme: 2 iş taşınacak, telefon tamamlanacak ({o[:120]!r})")
    pg.click("[data-apply]"); pg.wait_for_timeout(600); pg.click(".sheet button[data-x='1']"); pg.wait_for_timeout(2500)
    r = ev(f"""async()=>{{const db=await import('./js/db.js');const w=await db.listActive('work_records');const s2=await db.get('sites','{ids['s2']}');const s1=await db.get('sites','{ids['s1']}');
      const a=(await db.listActive('aliases')).filter(x=>x.target_type==='site'&&x.target_id==='{ids['s1']}').map(x=>x.alias);
      return {{n:w.filter(x=>x.site_id==='{ids['s1']}').length,del:!!s2.deleted_at,ph:s1.phone,a}}}}""")
    check(r == {"n": 3, "del": True, "ph": "0532", "a": ["Kadıköy"]}, f"işler kalan şantiyede, eski kart çöpte, eski ad hafızada ({r})")
    check(not errs, f"sayfa hatası yok {errs[:2]}")
    b.close()
print("\nSONUÇ:", "BAŞARILI" if not FAIL else f"{len(FAIL)} SORUN")
