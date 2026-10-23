# Eski /preview/ (v3.7) servis çalışanı için GERÇEK geçiş testi (test verisi, yerel sunucu).
# Sıra (gerçek hayattaki gibi): eski önizleme geçmişte kurulmuş → canlı uygulama kullanılıyor (kayıt, gönderilmemiş şoför
# fotoğrafı, paylaşım önbelleği) → eski önizleme önbelleği yeniden dolmuş → sitede /preview/ güvenli geçiş dosyalarıyla
# değişiyor → eski önizleme yeniden açılıyor. Canlı veriler korunmalı, eski çalışan yalnız kendini kaldırmalı.
import os, sys, shutil, subprocess, socket, time, tempfile
from playwright.sync_api import sync_playwright
from support.history_fixture import require_git_ref
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
require_git_ref(ROOT, "1eaebf1")
W = tempfile.mkdtemp(prefix="sahapro_eskiprev_")
SITE = W + "/sahapro-cep-temp"
shutil.copytree(ROOT, SITE, ignore=shutil.ignore_patterns(".git", "tests", "tools", "docs", "reports", "research_notes", "preview"))
OLD = SITE + "/preview"
os.makedirs(OLD)
files = subprocess.run(["git", "ls-tree", "-r", "--name-only", "1eaebf1", "preview"], cwd=ROOT, capture_output=True, text=True).stdout.split()
for f in files:
    os.makedirs(os.path.dirname(SITE + "/" + f), exist_ok=True)
    open(SITE + "/" + f, "wb").write(subprocess.run(["git", "show", "1eaebf1:" + f], cwd=ROOT, capture_output=True).stdout)
s = socket.socket(); s.bind(("127.0.0.1", 0)); port = s.getsockname()[1]; s.close()
srv = subprocess.Popen([sys.executable, "-m", "http.server", str(port)], cwd=W, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
U = f"http://localhost:{port}/sahapro-cep-temp/"
FAIL = []
def check(c, m):
    print(("  ✓ " if c else "  ✗ ") + m)
    if not c: FAIL.append(m)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(); ctx = b.new_context(); errs = []
        pg = ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
        regs = lambda: pg.evaluate("navigator.serviceWorker.getRegistrations().then(r=>r.map(x=>x.scope.replace(location.origin,'')))")
        # 1) geçmiş: eski önizleme kurulu
        pg.goto(U + "preview/index.html"); pg.wait_for_timeout(2500)
        pg.evaluate("navigator.serviceWorker.register('./sw.js').then(()=>1)"); pg.wait_for_timeout(2500)
        check(any(r.endswith("/preview/") for r in regs()), "eski önizleme çalışanı kurulu (başlangıç durumu)")
        # 2) canlı kullanım: kayıt, gönderilmemiş şoför fotoğrafı, paylaşım önbelleği, şoför kayıtları
        pg.goto(U + "index.html"); pg.wait_for_timeout(5000); pg.reload(); pg.wait_for_timeout(3000)
        pg.evaluate("""async()=>{const db=await import('./js/db.js');await db.saveNew('customers',{name:'CANLI KAYIT'},'t');
          const c=await caches.open('sahapro-driver');await c.put(new URL('./__drv/e1-0',location.href).href,new Response(new Blob(['FOTO-BAYT'],{type:'image/jpeg'})));
          const s=await caches.open('sahapro-share');await s.put(new URL('./__share/x',location.href).href,new Response('PAYLASIM'));
          localStorage.setItem('sp_driver_entries',JSON.stringify([{id:'e1',ph:1}]))}""")
        live_before = pg.evaluate("caches.keys()")
        # eski önizleme yeniden ziyaret edilir (eski çalışan önbelleğini yeniden doldurur — en kötü durum)
        pg.goto(U + "preview/index.html"); pg.wait_for_timeout(2500)
        pg.goto(U + "preview/js/app.js"); pg.wait_for_timeout(800)
        k_mid = pg.evaluate("caches.keys()")
        print("     geçiş öncesi önbellekler:", sorted(k_mid))
        # 3) sitede güvenli geçiş dosyaları yayımlanır
        shutil.rmtree(OLD); shutil.copytree(ROOT + "/preview", OLD, copy_function=shutil.copyfile)  # yeni dosya = yeni tarih (sunucu 304 demesin)
        # 4) eski önizleme yeniden açılır (eski çalışan hâlâ kayıtlı; tarayıcı güncelleme denetimi yapar)
        pg.goto(U + "preview/index.html"); pg.wait_for_timeout(4000)
        print("     eski sayfadaki durum:", pg.evaluate("navigator.serviceWorker.getRegistrations().then(r=>r.map(x=>[x.scope.replace(location.origin,''),x.active&&x.active.scriptURL.replace(location.origin,''),x.installing&&'installing',x.waiting&&'waiting']))"), "| sayfa:", pg.inner_text("body")[:60].replace("\n"," "))
        # Tarayıcı, kayıtlı çalışanın betiğini gezinmelerde ve en geç 24 saatte bir yeniden denetler. Test birkaç saniye
        # içinde koştuğu için bu denetim burada açıkça tetiklenir (registration.update — tarayıcının yaptığıyla aynı adım).
        if not os.environ.get('NOUPDATE'):
            print('     update:', pg.evaluate("navigator.serviceWorker.getRegistration('./').then(r=>r?r.update().then(()=>'ok:'+(r.installing?'installing':'')+(r.waiting?'waiting':'')+(r.active?r.active.state:'')):'no-reg').catch(e=>'err:'+e)"))
            pg.wait_for_timeout(4000); print('     sw.js:', pg.evaluate("fetch('./sw.js',{cache:'no-store'}).then(r=>r.text()).then(t=>t.slice(0,40))"))
        pg.goto(U + "preview/index.html"); pg.wait_for_timeout(3000)
        k_after = pg.evaluate("caches.keys()")
        r_after = regs()
        print("     geçiş sonrası önbellekler:", sorted(k_after), "· kayıtlar:", r_after)
        check(not any(r.endswith("/preview/") for r in r_after), "eski önizleme çalışanı kendini kaldırdı")
        check(any(r.endswith("/sahapro-cep-temp/") for r in r_after), "canlı uygulamanın çalışanı yerinde")
        check(all(k in k_after for k in live_before if k != "sahapro-solo-v3"), f"canlı önbellekler korundu ({[k for k in live_before if k not in k_after]})")
        check("sahapro-solo-v3" not in k_after, "yalnız eski önizlemenin kendi önbelleği temizlendi")
        check("Bu eski önizleme kaldırıldı" in pg.inner_text("body"), "eski önizleme adresi bilgi sayfasını gösteriyor")
        pg.goto(U + "index.html"); pg.wait_for_timeout(3000)
        r = pg.evaluate("""async()=>{const db=await import('./js/db.js');const c=await caches.open('sahapro-driver');const f=await c.match(new URL('./__drv/e1-0',location.href).href);
          const s=await caches.open('sahapro-share');const sh=await s.match(new URL('./__share/x',location.href).href);
          return {kayit:(await db.listActive('customers')).some(x=>x.name==='CANLI KAYIT'),foto:f?await f.text():null,pay:sh?await sh.text():null,ent:localStorage.getItem('sp_driver_entries')}}""")
        check(r["kayit"], "canlı kayıt duruyor")
        check(r["foto"] == "FOTO-BAYT", "gönderilmemiş şoför fotoğrafı duruyor")
        check(r["pay"] == "PAYLASIM" and r["ent"], "paylaşım önbelleği ve şoför kayıt listesi duruyor")
        b.close()
finally:
    srv.terminate(); shutil.rmtree(W, ignore_errors=True)
print("\nSONUÇ:", "BAŞARILI" if not FAIL else f"{len(FAIL)} SORUN")
