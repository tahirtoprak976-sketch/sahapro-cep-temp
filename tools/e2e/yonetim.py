# Paket 4 — ana ekranda dikkat isteyen işler, günlük iş grafiği, araçlar (birimler ayrı), mazot anlaşmaları; asistanda kayıt temelli cevap. TEST VERİSİ.
import sys
from playwright.sync_api import sync_playwright
U = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8846/"; PIN = "482917"
FAIL = []
def check(c, m):
    print(("  ✓ " if c else "  ✗ ") + m)
    if not c: FAIL.append(m)
with sync_playwright() as p:
    b = p.chromium.launch(); errs = []
    ctx = b.new_context(viewport={'width': 360, 'height': 780}); ctx.add_init_script("try{localStorage.setItem('sp_role','boss');localStorage.setItem('spx_role','boss')}catch(e){}")
    CALLS = []
    ctx.route("https://generativelanguage.googleapis.com/**", lambda r: (CALLS.append(1), r.abort()))
    pg = ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(U + "index.html"); pg.wait_for_timeout(5000)
    ev = lambda js: pg.evaluate(js)
    ids = ev("""async()=>{const db=await import('./js/db.js');const c=await import('./js/security-core.js');const core=await import('./js/core.js');
      await db.metaSet('sec_lock',{...(await c.hashSecret('482917')),idle_min:30,away_min:15});
      const T=core.todayStr(), Y=core.addDays(T,-1);
      const k=await db.saveNew('customers',{name:'Kılıç Test',fuel_rules:[{id:'r1',per:75,unit:'Sefer',match:'',only_pay:true}]},'t');const y=await db.saveNew('customers',{name:'Kaya Test'},'t');
      const v=(await db.listActive('vehicles'))[0];
      await db.saveNew('work_records',{date:T,customer_id:k.id,vehicle_id:v.id,work_type:'Moloz Nakliye',unit:'Sefer',quantity:21,customer_fuel_allowance_l:1575,fuel_rule_id:'r1',price_snapshot:{unit_price:0,amount:0,kdv_rate:0,kdv_included:false,price_source:'Mazot karşılığı'}},'t');
      await db.saveNew('work_records',{date:T,customer_id:y.id,vehicle_id:v.id,work_type:'Kazı',unit:'Saat',quantity:4},'t');
      const w3=await db.saveNew('work_records',{date:Y,customer_id:y.id,vehicle_id:v.id,work_type:'Kazı',unit:'Saat',quantity:2},'t');
      await db.put('work_records',{...(await db.get('work_records',w3.id)),customer_id:null}); // eski / içe aktarılmış müşterisiz kayıt
      await db.saveNew('fuel_records',{date:T,vehicle_id:v.id,liters:525,fuel_source:'Müşteri Verdi',customer_id:k.id,total:null,unit_price:null,receipt:'Müşteri',customer_billable:false},'t');
      return {k:k.id,T,Y,vn:v.name}}""")
    def unlock():
        if pg.query_selector("#lock-root [data-pw]"): pg.fill("#lock-root [data-pw]", PIN); pg.click("#lock-root [data-go-un]"); pg.wait_for_timeout(1200)
    snap = lambda: ev("async()=>{const db=await import('./js/db.js');const d=await db.dumpAll();return ['work_records','fuel_records','cash_records','cari_movements'].map(s=>(d[s]||[]).map(x=>x.id+(x.updated_at||'')).sort().join()).join('|')+(await db.getAll('audit_log')).length}")
    pg.reload(); pg.wait_for_timeout(3000); unlock()
    s0 = snap()
    pg.goto(U + "index.html#/"); pg.wait_for_timeout(3000); unlock()
    t = ev("document.querySelector('[data-yonetim]').textContent")
    check("Dikkat isteyen işler" in t and "işin fiyatı yok" in t and "işte müşteri yok" in t and "Neden:" in t and "Sonraki adım:" in t, "dikkat isteyen işler: neden ve sonraki adımla")
    check(snap() == s0 and len(CALLS) == 0, "ana ekran hiçbir kayıt yazmadı, yapay zekâ çağırmadı")
    bars = ev("[...document.querySelectorAll('[data-daychart] button')].map(b=>b.getAttribute('aria-label'))")
    check(len(bars) == 14 and "2 iş (21 sefer, 4 saat)" in bars[-1] or "2 iş (4 saat, 21 sefer)" in bars[-1], f"14 günlük grafik; bugünün çubuğu iş sayısı ve birimleri ayrı ({bars[-1]})")
    check("Araçlar — bu ay" in t and "Saat" in t and "Sefer" in t and "Yevmiye" in t, "araç tablosunda saat / sefer / yevmiye ayrı sütunlar")
    check("Mazot anlaşmaları" in t and "Hak edilen 1.575 L" in t and "Alınan 525 L" in t and "Kalan 1.050 L" in t, "mazot anlaşmaları litreyle, TL'den ayrı")
    ov = ev("({sw:document.documentElement.scrollWidth,w:document.documentElement.clientWidth})")
    check(ov["sw"] <= ov["w"], f"360 px'te taşma yok ({ov})")
    pg.click("[data-daychart] button:last-child"); pg.wait_for_timeout(2000)
    check(f"from={ids['T']}" in pg.url and len(ev("[...document.querySelectorAll('[data-list] .li')]")) == 2, "çubuğa dokununca o günün işleri açıldı (2 iş)")
    pg.goto(U + "index.html#/"); pg.wait_for_timeout(2500)
    pg.click("[data-attn='musterisiz']"); pg.wait_for_timeout(2000)
    check("f=musterisiz" in pg.url and len(ev("[...document.querySelectorAll('[data-list] .li')]")) == 1, "müşterisiz işler listesi açıldı")
    def say(tx):
        pg.goto(U + "index.html#/akilli-asistan"); pg.wait_for_timeout(2000); unlock()
        pg.fill("[data-msg]", tx); pg.click("[data-ask]"); pg.wait_for_timeout(1500)
    say("Kılıç’tan kaç litre mazot alacağım kaldı?")
    a = pg.inner_text("[data-answer]") if pg.query_selector("[data-answer]") else ""
    check("kalan mazot alacağı 1.050 L" in a and "yapay zekâ üretmedi" in a, "mazot sorusu kayıtlardan cevaplandı")
    say("Bugün hangi araç ne yaptı?")
    a = pg.inner_text("[data-answer]") if pg.query_selector("[data-answer]") else ""
    check(ids["vn"] in a and "21 sefer" in a and "4 saat" in a, f"bugün araçlar: birimler ayrı ({a[:80]})")
    check(len(CALLS) == 0 and snap() == s0, "cevaplar Gemini'ye gitmedi, kayıt değişmedi")
    check(not errs, f"sayfa hatası yok {errs[:2]}")
    b.close()
print("\nSONUÇ:", "BAŞARILI" if not FAIL else f"{len(FAIL)} SORUN")
