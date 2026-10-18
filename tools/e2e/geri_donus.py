# GERÇEK geri dönüş testi: v3.9.05 ile veri üret → AYNI adreste dosyaları v3.9.04 (canlıdaki, 1eaebf1) ile değiştir →
# tarayıcı güncellemesi → eski kodun yeni veriyle davranışı; sonra yeniden v3.9.05'e ileri dönüş. (Test verisi, yerel sunucu.)
import os, sys, shutil, subprocess, socket, time, tempfile, json, io, tarfile
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OLD_REF = os.environ.get("OLD_REF", "1eaebf1")
W = tempfile.mkdtemp(prefix="sahapro_geri_"); APP = W + "/app"
def put_new():
    if os.path.exists(APP): shutil.rmtree(APP)
    shutil.copytree(ROOT, APP, ignore=shutil.ignore_patterns(".git", "tests", "tools", "docs", "reports", "research_notes"), copy_function=shutil.copyfile)
def put_old():
    if os.path.exists(APP): shutil.rmtree(APP)
    os.makedirs(APP)
    tar = subprocess.run(["git", "archive", OLD_REF], cwd=ROOT, capture_output=True).stdout
    with tarfile.open(fileobj=io.BytesIO(tar)) as t: t.extractall(APP, filter='data')
    now = time.time()
    for dp, _, fs in os.walk(APP):
        for f in fs: os.utime(os.path.join(dp, f), (now, now))
put_new()
s = socket.socket(); s.bind(("127.0.0.1", 0)); port = s.getsockname()[1]; s.close()
srv = subprocess.Popen([sys.executable, "-m", "http.server", str(port)], cwd=W, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
U = f"http://localhost:{port}/app/"
FAIL = []; NOTE = []
def check(c, m):
    print(("  ✓ " if c else "  ✗ ") + m)
    if not c: FAIL.append(m)
def note(m): print("  ⚠ " + m); NOTE.append(m)
def switch(pg, label):
    # Kullanıcının yaptığı gibi: güncelleme bulunur → "Güncelle" (bekleyen çalışana SKIP_WAITING) → uygulama yeniden açılır
    pg.evaluate("navigator.serviceWorker.getRegistration().then(r=>r&&r.update()).catch(()=>0)"); pg.wait_for_timeout(4000)
    st = pg.evaluate("navigator.serviceWorker.getRegistration().then(r=>{const w=r&&(r.waiting||r.installing);if(w)w.postMessage({type:'SKIP_WAITING'});return w?'güncelle':'bekleyen yok'})")
    pg.wait_for_timeout(3000)
    pg.goto(U + "index.html"); pg.wait_for_timeout(4000); pg.reload(); pg.wait_for_timeout(4000)
    print(f"     {label}: Güncelle → {st}")
    v = pg.evaluate("(async()=>(await import('./js/core.js')).APP_VERSION)()")
    caches = pg.evaluate("caches.keys()")
    print(f"     {label}: yüklenen sürüm {v} · önbellekler {caches}")
    return v, caches
try:
    with sync_playwright() as p:
        b = p.chromium.launch(); ctx = b.new_context(); ctx.add_init_script("try{localStorage.setItem('sp_role','boss')}catch(e){}")
        pg = ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto(U + "index.html"); pg.wait_for_timeout(5000)
        v0 = pg.evaluate("(async()=>(await import('./js/core.js')).APP_VERSION)()")
        print("1) v3.9.05 ile veri:", v0)
        made = pg.evaluate("""async()=>{const db=await import('./js/db.js');const sec=await import('./js/security.js');const dc=await import('./js/driver-core.js');const u=await import('./js/undo.js');const b=await import('./js/backup.js');const bc=await import('./js/backup-crypt.js');
          const k=await db.saveNew('customers',{name:'Kaya'},'t');const v=(await db.listActive('vehicles'))[0];const pid=(await db.listActive('personnel'))[0].id;
          // işlem kimlikli iş
          const op={id:await db.opHash({m:'test',row:'#0'}),hash:await db.opHash({q:3})};
          const w1=await db.saveNew('work_records',{date:'2026-10-15',customer_id:k.id,vehicle_id:v.id,work_type:'Kazı',quantity:3,unit:'Saat'},'t',{op});
          // imzalı şoför kaydı (doğrulanmış) + imzalı içerik snapshot'ı
          const {forDriver}=await sec.newDriverLink({pid,name:'Şoför',vid:v.id});
          const msg=await dc.driverMessage([{id:'drv-1',k:'w',date:'2026-10-15',vid:v.id,cid:k.id,wt:'Hafriyat Nakliye',q:4,u:'Sefer',dfs:'DF-9',rcv:'Ali',sgt:new Date().toISOString()}],{...dc.driverConfig(await db.dumpAll(),{personnel_id:pid,vehicle_id:v.id}),lid:forDriver.lid,ls:forDriver.ls});
          const pl=await dc.extractPayloads(msg);await sec.checkPayloads(pl,await db.dumpAll());const pp=dc.payloadsToPlan(pl,await db.dumpAll());
          const w2=await db.saveNew('work_records',{date:'2026-10-15',customer_id:k.id,vehicle_id:v.id,personnel_id:pid,work_type:'Hafriyat Nakliye',quantity:4,unit:'Sefer',driver_entry_id:'drv-1',digital_slip_no:'DF-9',slip_signed_at:pp.meta[0].digital.signed_at,slip_signed_content:pp.meta[0].digital.signed},'t');
          // geri alma planı (kısmi işlem)
          const s0=await u.snapshot(db);await db.saveNew('customers',{name:'Yarım Kart'},'t');await u.saveUndo(db,s0,'yarım');
          await db.metaSet('gemini_daily_limit',50);
          // parçalı yedek
          const parts=await b.backupParts(db,{encrypted:true,budget:100000});const out=[];
          for await(const x of parts){const by=await bc.encodeBackup(x,'Pw-1234');let s='';for(let i=0;i<by.length;i+=8192)s+=String.fromCharCode(...by.subarray(i,i+8192));out.push(btoa(s));}
          return {w1:w1.id,w2:w2.id,k:k.id,v:v.id,parts:out,unsigned:await dc.driverMessage([{id:'drv-x',k:'w',date:'2026-10-15',vid:v.id,cid:k.id,wt:'Hafriyat Nakliye',q:9,u:'Sefer'}],dc.driverConfig(await db.dumpAll(),{personnel_id:pid,vehicle_id:v.id}))}}""")
        print("     yedek parçası:", len(made["parts"]))
        # 2) v3.9.04'e geri dönüş
        print("2) Dosyalar v3.9.04 ile değiştirildi (geri dönüş)")
        put_old(); v1, c1 = switch(pg, "geri dönüş sonrası")
        check("v3.9.04" in v1, f"tarayıcı eski sürüme geçti, modüller tek sürümden ({v1})")
        check(not any("kapilar" in c for c in c1), f"yeni sürümün önbelleği eski çalışanca temizlendi, karışma yok ({c1})")
        r = pg.evaluate(f"""async()=>{{const db=await import('./js/db.js');const w1=await db.get('work_records','{made['w1']}');const w2=await db.get('work_records','{made['w2']}');
          const meta=(await db.getAll('meta')).map(m=>m.key);
          await db.saveExisting('work_records',w2,{{quantity:6}},'eski kodla düzeltme');const w2b=await db.get('work_records','{made['w2']}');
          return {{w1:!!w1,w2:!!w2,ops:meta.filter(k=>k.startsWith('op:')).length,drv:meta.filter(k=>k.startsWith('drv_ok:')).length,undo:meta.includes('assistant_undo'),lim:meta.includes('gemini_daily_limit'),snap:!!(w2b.slip_signed_content&&w2b.slip_signed_content.q===4),q:w2b.quantity}}}}""")
        check(r["w1"] and r["w2"], "kayıtlar eski sürümde görünüyor")
        check(r["ops"] >= 1 and r["drv"] >= 1 and r["undo"] and r["lim"], f"yeni meta kayıtları (işlem kimliği, doğrulama, geri alma planı, sınır) korunuyor ({r})")
        check(r["snap"] and r["q"] == 6, "eski kod iş düzenleyince imzalı içerik snapshot'ı korunuyor")
        # Eski kodun güvenlik açıkları (geri dönüşün bedeli)
        spec = pg.evaluate(f"""async()=>{{const db=await import('./js/db.js');const dc=await import('./js/driver-core.js');const w=await db.get('work_records','{made['w2']}');return JSON.stringify(dc.workSlipSpec(w,{{customers:{{}},sites:{{}},vehicles:{{}},personnel:{{}},dump_sites:{{}}}},{{sigBlob:new Blob(['x'])}}).sections)}}""")
        if '"4 sefer"' in spec: print("  ✓ eski kod da imzalı fişi imzalanan hâliyle basıyor")
        else: note("GERİ DÖNÜŞTE KAYIP: eski kod imzalı fişi güncel miktarla (6) + eski imzayla basıyor (v3.9.05 koruması kalkar)")
        unv = pg.evaluate(f"""async()=>{{const db=await import('./js/db.js');try{{await db.saveNew('work_records',{{date:'2026-10-15',customer_id:'{made['k']}',vehicle_id:'{made['v']}',work_type:'Kazı',quantity:2,unit:'Saat',driver_entry_id:'sahte-1',source:'şoför'}},'t');return 'YAZILDI'}}catch(e){{return e.code||String(e)}}}}""")
        if unv == "YAZILDI": note("GERİ DÖNÜŞTE KAYIP: eski kod doğrulanmamış şoför kimliğiyle kayıt yazdırıyor (veritabanı engeli kalkar)")
        else: print("  ✓ eski kod doğrulanmamış şoför kaydını reddetti")
        lim = pg.evaluate("(async()=>{const g=await import('./js/ai-gemini.js');return typeof g.gatedFetch})()")
        if lim != "function": note("GERİ DÖNÜŞTE KAYIP: Gemini yerel günlük sınırı yok (yalnız sayaç)")
        # Yeni biçimli yedek eski kodla okunuyor mu (temiz telefon)
        c2 = b.new_context(); c2.add_init_script("try{localStorage.setItem('sp_role','boss')}catch(e){}"); p2 = c2.new_page(); p2.goto(U + "index.html"); p2.wait_for_timeout(5000)
        rr = []
        for x in made["parts"]:
            rr.append(p2.evaluate("""async(b64)=>{const b=await import('./js/backup.js');const bc=await import('./js/backup-crypt.js');const db=await import('./js/db.js');
              try{const u=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));const o=await bc.decodeBackup(u,async()=>'Pw-1234');await b.restoreBackup(db,o,false);return 'ok'}catch(e){return String(e.message||e)}}""", x))
        n = p2.evaluate("""async()=>{const db=await import('./js/db.js');return [(await db.listActive('work_records')).length,(await db.getAll('meta')).filter(m=>m.key.startsWith('restore_set:')).length]}""")
        check(all(x == "ok" for x in rr) and n[0] >= 2, f"v3.9.05 parçalı yedeği eski kodla okundu ({rr}, iş {n[0]})")
        if n[1] == 0: note("Eski kod parça setini izlemez: eksik parça yüklenmese de uyarı vermez")
        c2.close()
        # 3) ileri dönüş: tekrar v3.9.05
        print("3) Yeniden v3.9.05 (ileri dönüş)")
        put_new(); v2, c3 = switch(pg, "ileri dönüş sonrası")
        check("v3.9.05" in v2 and not any("denetim-1" in c for c in c3), f"yeni sürüm geri geldi, eski önbellek karışmadı ({v2})")
        r = pg.evaluate(f"""async()=>{{const db=await import('./js/db.js');const ic=await import('./js/integrity-ui.js');const w=await db.get('work_records','{made['w2']}');
          const issues=(await ic.runIntegrity(db)).issues;return {{slip:issues.some(x=>x.code==='slip-changed'),sahte:(await db.listActive('work_records')).some(x=>x.driver_entry_id==='sahte-1'),errs:issues.filter(x=>x.sev==='error').map(x=>x.code)}}}}""")
        check(r["slip"], "ileri dönüşte: eski kodla yapılan imza sonrası değişiklik Veri Sağlığı'nda görünüyor")
        if r["sahte"]: note("Eski sürüm çalışırken doğrulanmamış şoför kimliğiyle yazılan kayıt ileri dönüşte de duruyor (Veri Sağlığı'nda ayrıca işaretlenmiyor)")
        print("     ileri dönüş Veri Sağlığı hataları:", r["errs"])
        check(not [e for e in errs if "v3.9.05" in e], f"sayfa hatası yok {errs[:2]}")
        b.close()
finally:
    srv.terminate(); shutil.rmtree(W, ignore_errors=True)
print("\nSONUÇ:", "BAŞARILI" if not FAIL else f"{len(FAIL)} SORUN", "· geri dönüş bedeli:", len(NOTE), "madde")
