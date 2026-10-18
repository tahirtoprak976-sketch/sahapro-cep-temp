# Paket 1 — görünüm: ilk ekranda asistan, alt menüde asistan (yüzen düğme yok), tarih gruplu iş listesi. Telefon genişliği, TEST VERİSİ.
import sys, json
from playwright.sync_api import sync_playwright
U = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8846/"; PIN = "482917"
FAIL = []
def check(c, m):
    print(("  ✓ " if c else "  ✗ ") + m)
    if not c: FAIL.append(m)
with sync_playwright() as p:
    b = p.chromium.launch(); errs = []
    ctx = b.new_context(viewport={'width': 360, 'height': 740}); ctx.add_init_script("try{localStorage.setItem('sp_role','boss');localStorage.setItem('spx_role','boss')}catch(e){}")
    CALLS = []
    def gem(route):
        CALLS.append(1)
        route.fulfill(status=200, content_type="application/json", body=json.dumps({"candidates": [{"content": {"parts": [{"text": "{}"}]}, "finishReason": "STOP"}]}))
    ctx.route("https://generativelanguage.googleapis.com/**", gem)
    pg = ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(U + "index.html"); pg.wait_for_timeout(5000)
    ev = lambda js: pg.evaluate(js)
    ev("""async()=>{const db=await import('./js/db.js');const c=await import('./js/security-core.js');
      await db.metaSet('sec_lock',{...(await c.hashSecret('482917')),idle_min:30,away_min:15});
      const k=await db.saveNew('customers',{name:'Kaya Test İnşaat Taahhüt Limited Şirketi'},'t');const v=(await db.listActive('vehicles'))[0];
      const add=(date,q)=>db.saveNew('work_records',{date,customer_id:k.id,vehicle_id:v.id,work_type:'Moloz Nakliye',quantity:q,unit:'Sefer'},'t');
      for (let i=0;i<25;i++) await add('2026-10-16',1+i%3);
      for (let i=0;i<10;i++) await add('2026-10-15',2);
      await add('2026-10-14',4);
      const w=await add('2026-10-13',5); await db.put('work_records',{...(await db.get('work_records',w.id)),date:''});
    }""")
    def unlock():
        if pg.query_selector("#lock-root [data-pw]"): pg.fill("#lock-root [data-pw]", PIN); pg.click("#lock-root [data-go-un]"); pg.wait_for_timeout(1200)
    pg.reload(); pg.wait_for_timeout(3000); unlock()
    pg.goto(U + "index.html#/"); pg.wait_for_timeout(2500); unlock()
    hb = pg.query_selector("[data-assist-hero]").bounding_box()
    check(hb and hb["y"] < 740 and "Ne yapmak istiyorsunuz?" in pg.inner_text("[data-assist-hero]"), f"asistan alanı ilk ekranda (y={hb and round(hb['y'])})")
    chips = pg.inner_text("[data-assist-hero]")
    check(all(x in chips for x in ["Mesaj yapıştır", "Sesle anlat", "Fiş / fotoğraf", "İş ekle", "Tahsilat gir", "Rapor sor"]), "altı hızlı seçenek var")
    check(len(CALLS) == 0, "ana ekran açılışı yapay zekâ çağrısı yapmadı")
    check(not pg.query_selector("#ai-fab"), "yüzen asistan düğmesi yok (içeriği örtmez)")
    nav = ev("(()=>{const n=document.querySelector('#bottomnav');const w=document.documentElement.clientWidth;return {t:n.innerText.replace(/\\s+/g,' '),out:[...n.querySelectorAll('button')].filter(b=>b.getBoundingClientRect().right>w+1||b.getBoundingClientRect().left<-1).length,sw:document.documentElement.scrollWidth,w}})()")
    check("ASİSTAN" in nav["t"].upper() and nav["out"] == 0 and nav["sw"] <= nav["w"], f"alt menüde ASİSTAN, 360 px'te taşma yok ({nav})")
    # Anahtar yokken: metin asistana taşınır, gönderilmez
    pg.fill("[data-hero-msg]", "Kaya Test 3 sefer moloz"); pg.click("[data-hero-go]"); pg.wait_for_timeout(2500); unlock()
    check("akilli-asistan" in pg.url and pg.input_value("[data-msg]") == "Kaya Test 3 sefer moloz" and len(CALLS) == 0, "anahtar yokken metin asistana taşındı, istek gitmedi")
    # Anahtar varken: kullanıcının gönder dokunuşuyla tek istek
    ev("async()=>{const db=await import('./js/db.js');await db.metaSet('gemini_key','K');await db.metaSet('gemini_model','gemini-2.5-flash');await db.metaSet('gemini_consent',true)}")
    pg.goto(U + "index.html#/"); pg.wait_for_timeout(2500); unlock()
    check(len(CALLS) == 0, "anahtar varken de ana ekran açılışı istek yapmadı")
    pg.fill("[data-hero-msg]", "Kaya Test 3 sefer moloz"); pg.click("[data-hero-go]"); pg.wait_for_timeout(4000); unlock()
    check(len(CALLS) == 1, f"'Asistana gönder' tek istek ({len(CALLS)})")
    # İş listesi: tarih grupları
    pg.goto(U + "index.html#/isler"); pg.wait_for_timeout(2500); unlock()
    heads = ev("[...document.querySelectorAll('[data-dgroup]')].map(h=>[...h.children].map(c=>c.textContent.trim()).join(' | '))")
    check(heads[:2] == ["16 Ekim 2026 · Cuma | 25 iş", "15 Ekim 2026 · Perşembe | 10 iş"], f"en yeni tarih üstte, sayılar doğru ({heads})")
    first = pg.query_selector("[data-list] .li")
    check(first and "Kaya Test İnşaat" in first.inner_text() and "sefer" in first.inner_text().lower(), "müşteri adı üst satırda, miktar ve birim görünüyor")
    pg.click("[data-more]"); pg.wait_for_timeout(500)
    heads = ev("[...document.querySelectorAll('[data-dgroup]')].map(h=>[...h.children].map(c=>c.textContent.trim()).join(' | '))")
    check(heads[2:] == ["14 Ekim 2026 · Çarşamba | 1 iş", "Tarih belirtilmemiş | 1 iş"] and len(heads) == len(set(heads)), f"devamında grup bölünmeden; tarihsiz en altta ({heads[2:]})")
    pg.goto(U + "index.html#/isler?f=all&q=" + "Kaya"); pg.wait_for_timeout(2000)
    check(len(ev("[...document.querySelectorAll('[data-dgroup]')]")) >= 1, "aramada tarih grupları korunuyor")
    # Son kayıt sabit düğme / menü altında kalmıyor
    pg.click("[data-more]") if pg.query_selector("[data-more]") else None
    pg.evaluate("window.scrollTo(0, document.body.scrollHeight)"); pg.wait_for_timeout(500)
    cov = ev("""(()=>{const items=[...document.querySelectorAll('[data-list] .li')];const last=items[items.length-1].getBoundingClientRect();
      const bars=[...document.querySelectorAll('.actionbar, #bottomnav')].filter(e=>!e.hidden&&getComputedStyle(e).position==='fixed').map(e=>e.getBoundingClientRect().top);
      return {lastBottom:Math.round(last.bottom),barTop:Math.round(Math.min(...bars))}})()""")
    check(cov["lastBottom"] <= cov["barTop"], f"en alttaki iş sabit düğmenin/menünün üstünde görünüyor ({cov})")
    check(not errs, f"sayfa hatası yok {errs[:2]}")
    if len(sys.argv) > 2:
        pg.goto(U + "index.html#/"); pg.wait_for_timeout(2500); pg.screenshot(path=sys.argv[2])
        pg.goto(U + "index.html#/isler"); pg.wait_for_timeout(2500); pg.screenshot(path=sys.argv[2].replace(".png", "_isler.png"))
    b.close()
print("\nSONUÇ:", "BAŞARILI" if not FAIL else f"{len(FAIL)} SORUN")
