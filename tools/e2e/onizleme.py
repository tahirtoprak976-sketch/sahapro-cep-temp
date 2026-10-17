# İzole önizleme doğrulaması: canlı ve önizleme AYNI kökende (aynı github.io gibi) çalışırken veri/önbellek/ayar paylaşılmaz.
# Kullanım: python3 tools/e2e/onizleme.py   (kendi geçici sunucusunu açar)
import os, sys, shutil, subprocess, socket, time, tempfile
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
W = tempfile.mkdtemp(prefix="sahapro_iki_")
shutil.copytree(ROOT, W + "/live", ignore=shutil.ignore_patterns(".git", "tests", "tools", "docs", "reports", "research_notes"))
subprocess.run([sys.executable, ROOT + "/tools/preview/build.py", W + "/onizleme"], check=True)
s = socket.socket(); s.bind(("127.0.0.1", 0)); port = s.getsockname()[1]; s.close()
srv = subprocess.Popen([sys.executable, "-m", "http.server", str(port)], cwd=W, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
U = f"http://localhost:{port}/"
FAIL = []
def check(c, m):
    print(("  ✓ " if c else "  ✗ ") + m)
    if not c: FAIL.append(m)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(); ctx = b.new_context(); errs = []
        live = ctx.new_page(); live.on("pageerror", lambda e: errs.append("live " + str(e)))
        live.goto(U + "live/index.html"); live.wait_for_timeout(5000)
        live.evaluate("""async()=>{const db=await import('./js/db.js');await db.saveNew('customers',{name:'CANLI MÜŞTERİ'},'t');localStorage.setItem('sp_role','boss');sessionStorage.setItem('solo_unlocked','1')}""")
        live.reload(); live.wait_for_timeout(3000)
        lk = live.evaluate("caches.keys()")
        prev = ctx.new_page(); prev.on("pageerror", lambda e: errs.append("prev " + str(e)))
        prev.goto(U + "onizleme/index.html"); prev.wait_for_timeout(5000); prev.reload(); prev.wait_for_timeout(3000)
        names = prev.evaluate("""async()=>{const db=await import('./js/db.js');return (await db.listActive('customers')).map(c=>c.name)}""")
        check("CANLI MÜŞTERİ" not in names, f"önizleme canlı müşteriyi görmüyor ({len(names)} müşteri)")
        prev.evaluate("""async()=>{const db=await import('./js/db.js');await db.saveNew('customers',{name:'TEST MÜŞTERİ'},'t')}""")
        check(prev.evaluate("localStorage.getItem('spx_role')") is None and prev.evaluate("localStorage.getItem('sp_role')") == "boss", "önizleme canlının rol ayarını kullanmıyor (ayrı anahtar)")
        check("ÖNİZLEME" in prev.inner_text("body"), "önizlemede 'ÖNİZLEME' şeridi görünüyor")
        dbs = prev.evaluate("indexedDB.databases().then(x=>x.map(d=>d.name))")
        check("sahapro_cep_db" in dbs and "sahapro_onizleme_db" in dbs, f"ayrı veritabanları ({dbs})")
        live.reload(); live.wait_for_timeout(3000)
        ln = live.evaluate("""async()=>{const db=await import('./js/db.js');return (await db.listActive('customers')).map(c=>c.name)}""")
        check("CANLI MÜŞTERİ" in ln and "TEST MÜŞTERİ" not in ln, "canlı veri yerinde, test verisi canlıya karışmadı")
        k2 = live.evaluate("caches.keys()")
        check(all(k in k2 for k in lk if k.startswith("sahapro-solo-")), f"önizleme canlının önbelleğini silmedi ({[k for k in lk if k not in k2]})")
        pk = [k for k in k2 if k.startswith("sahapro-onizleme-")]
        check(len(pk) >= 1, f"önizleme önbelleği ayrı önekte ({pk})")
        sw = live.evaluate("navigator.serviceWorker.getRegistrations().then(r=>r.map(x=>x.scope))")
        check(any(x.endswith("/live/") for x in sw) and any(x.endswith("/onizleme/") for x in sw), f"servis çalışanları ayrı kapsamlarda ({sw})")
        check(not errs, f"sayfa hatası yok {errs[:3]}")
        b.close()
finally:
    srv.terminate(); shutil.rmtree(W, ignore_errors=True)
print("\nSONUÇ:", "BAŞARILI" if not FAIL else f"{len(FAIL)} SORUN")
