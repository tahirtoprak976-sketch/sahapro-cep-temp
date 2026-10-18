# Patron kendi telefonunda şoför bağlantısını denedi: çıkış kodu yerine bu telefonun yönetici şifresiyle de çıkabilir.
# Şoför telefonunda (yönetici kilidi yok) yalnız çıkış kodu sorulur. Yanlış şifre çıkış yaptırmaz. TEST VERİSİ.
import sys
from playwright.sync_api import sync_playwright
U = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8846/"; PIN = "482917"
FAIL = []
def check(c, m):
    print(("  ✓ " if c else "  ✗ ") + m)
    if not c: FAIL.append(m)
with sync_playwright() as p:
    b = p.chromium.launch(); errs = []
    boss = b.new_context(viewport={'width': 390, 'height': 844}); boss.add_init_script("try{if(!sessionStorage.getItem('x')){sessionStorage.setItem('x',1)}}catch(e){}")
    boss.grant_permissions(["clipboard-read", "clipboard-write"], origin=U.rstrip("/"))
    pg = boss.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(U + "index.html"); pg.wait_for_timeout(5000)
    pg.evaluate("()=>{localStorage.setItem('sp_role','boss')}")
    ids = pg.evaluate("""async()=>{const db=await import('./js/db.js');const c=await import('./js/security-core.js');
      await db.metaSet('sec_lock',{...(await c.hashSecret('482917')),idle_min:30,away_min:15});
      const k=await db.saveNew('customers',{name:'Kaya Test'},'t');const ps=await db.listActive('personnel');return {pid:ps[0].id}}""")
    def unlock(page):
        if page.query_selector("#lock-root [data-pw]"): page.fill("#lock-root [data-pw]", PIN); page.click("#lock-root [data-go-un]"); page.wait_for_timeout(1200)
    pg.reload(); pg.wait_for_timeout(3000); unlock(pg)
    pg.goto(U + "index.html#/sofor-kur?pid=" + ids["pid"]); pg.reload(); pg.wait_for_timeout(2500); unlock(pg)
    pg.click("[data-copy]"); pg.wait_for_selector("#lock-root [data-pw]"); pg.fill("#lock-root [data-pw]", PIN); pg.click("#lock-root [data-go-un]"); pg.wait_for_timeout(1500)
    url = pg.evaluate("navigator.clipboard.readText()")
    # Patron aynı telefonda bağlantıyı açar → şoför modu
    pg.goto(url); pg.wait_for_timeout(3500); unlock(pg)
    check("şoför ekranı" in pg.inner_text("#screen").lower(), "patron telefonu şoför moduna girdi")
    pg.goto(U + "index.html#/"); pg.wait_for_timeout(2500); unlock(pg)
    check("şoför ekranı" in pg.inner_text("#screen").lower(), "yönetici ekranına geçilemiyor (şoför modu)")
    def exit_with(choice, secret):
        pg.evaluate("document.querySelectorAll('details').forEach(d=>d.open=true)"); pg.click("[data-exit]"); pg.wait_for_timeout(700)
        txt = pg.inner_text(".sheet") if pg.query_selector(".sheet") else ""
        btn = [x for x in pg.query_selector_all(".sheet button") if x.inner_text().startswith(choice)]
        if btn: btn[0].click(); pg.wait_for_timeout(900)
        if pg.query_selector("#lock-root [data-pw]"):
            pg.fill("#lock-root [data-pw]", secret); pg.click("#lock-root [data-go-un]"); pg.wait_for_timeout(1800)
            if pg.query_selector("#lock-root [data-cancel], #lock-root [data-x]"):
                c = pg.query_selector("#lock-root [data-cancel], #lock-root [data-x]"); c.click(); pg.wait_for_timeout(600)
        return txt
    t = exit_with("Bu telefonun yönetici şifresi", "111111")
    check("yönetici şifresi" in t and "8 haneli" in t, "çıkışta iki seçenek: yönetici şifresi ya da çıkış kodu")
    pg.wait_for_timeout(500)
    check(pg.evaluate("localStorage.getItem('sp_role')") != "boss" or "şoför ekranı" in pg.inner_text("#screen").lower(), "yanlış şifreyle çıkılamadı")
    if pg.query_selector("#lock-root"): pg.evaluate("document.querySelector('#lock-root')?.remove()")
    pg.goto(url.split("#")[0] + "#/sofor"); pg.wait_for_timeout(3500); unlock(pg)
    exit_with("Bu telefonun yönetici şifresi", PIN); pg.wait_for_timeout(2500); unlock(pg)
    n = pg.evaluate("async()=>(await (await import('./js/db.js')).listActive('customers')).filter(c=>c.name==='Kaya Test').length")
    check("guvenlik" in pg.url and pg.evaluate("localStorage.getItem('sp_role')") == "boss" and n == 1, f"yönetici şifresiyle çıkıldı, patron verileri yerinde ({pg.url[-20:]})")
    # Gerçek şoför telefonu: yönetici kilidi yok → yalnız çıkış kodu
    dc = b.new_context(viewport={'width': 390, 'height': 844}); dp = dc.new_page(); dp.on("pageerror", lambda e: errs.append("DRV " + str(e)))
    dp.goto(url); dp.wait_for_timeout(3500)
    dp.evaluate("document.querySelectorAll('details').forEach(d=>d.open=true)"); dp.click("[data-exit]"); dp.wait_for_timeout(700)
    st = dp.inner_text(".sheet") if dp.query_selector(".sheet") else ""
    check("8 haneli" in st and "yönetici şifresi" not in st, "şoför telefonunda yalnız çıkış kodu soruluyor")
    dp.fill(".sheet input", "12345678"); dp.query_selector_all(".sheet button")[-1].click(); dp.wait_for_timeout(1500)
    check("şoför ekranı" in dp.inner_text("#screen").lower(), "yanlış çıkış koduyla şoför modunda kalındı")
    check(not errs, f"sayfa hatası yok {errs[:2]}")
    b.close()
print("\nSONUÇ:", "BAŞARILI" if not FAIL else f"{len(FAIL)} SORUN")
