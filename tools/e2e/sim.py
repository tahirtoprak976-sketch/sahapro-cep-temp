# SAHAPRO işletme simülasyonu: 3 şoför telefonu + patron telefonu, birkaç gün; gerçek ekranlar üzerinden.
# Sonunda: Veri Sağlığı = 0 hata, sayılar tutarlı, yedek → başka telefona geri yükleme birebir.
import json, base64, os, sys, random
from playwright.sync_api import sync_playwright
U = "http://localhost:8841/"
PIN = "482917"
OUT = os.environ.get("SIM_OUT", "/tmp/sahapro_sim"); os.makedirs(OUT, exist_ok=True)
random.seed(int(sys.argv[1]) if len(sys.argv) > 1 else 7)
FAIL = []
SHEETS = []
def check(cond, msg):
    print(("  ✓ " if cond else "  ✗ ") + msg)
    if not cond: FAIL.append(msg)

SHARE_MOCK = """
(() => { const toB64 = (f) => new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(String(fr.result).split(',')[1]); fr.readAsDataURL(f); });
  navigator.canShare = () => true;
  navigator.share = async (d) => { const files = []; for (const f of d.files || []) files.push({ name: f.name, type: f.type, b64: await toB64(f) });
    (window.__shares ||= []).push({ text: d.text, files }); }; })();"""

def unlock_if(pg):
    if pg.query_selector("#lock-root [data-pw]"):
        pg.fill("#lock-root [data-pw]", PIN); pg.click("#lock-root [data-go-un]"); pg.wait_for_timeout(1200)

def prompt(pg, val):
    pg.wait_for_selector(".sheet [data-p]"); pg.fill(".sheet [data-p]", val); pg.click(".sheet [data-x='1']"); pg.wait_for_timeout(500)

def toast(pg): return pg.evaluate("[...document.querySelectorAll('.toast')].map(t=>t.textContent)")

with sync_playwright() as p:
    b = p.chromium.launch(); errs = []
    # ---------------- Patron telefonu ----------------
    boss = b.new_context(viewport={'width': 412, 'height': 900}); boss.add_init_script("try{localStorage.setItem('sp_role','boss')}catch(e){}")
    boss.grant_permissions(["clipboard-read", "clipboard-write"], origin="http://localhost:8841")
    PLANS = []
    def gem(route):
        plan = PLANS.pop(0) if PLANS else {}
        route.fulfill(status=200, content_type="application/json", body=json.dumps({"candidates": [{"content": {"parts": [{"text": json.dumps(plan, ensure_ascii=False)}]}, "finishReason": "STOP"}]}, ensure_ascii=False))
    pg = boss.new_page(); pg.on("pageerror", lambda e: errs.append("BOSS " + str(e)))
    pg.route("https://generativelanguage.googleapis.com/**", gem)
    pg.goto(U + "index.html"); pg.wait_for_timeout(5000)
    TODAY = pg.evaluate("(async()=>(await import('./js/ui.js')).todayStr())()")
    def day(n):
        import datetime; return (datetime.date.fromisoformat(TODAY) - datetime.timedelta(days=n)).isoformat()
    ids = pg.evaluate("""async()=>{const db=await import('./js/db.js');const c=await import('./js/security-core.js');
      await db.metaSet('gemini_key','K');await db.metaSet('gemini_model','gemini-2.5-flash');await db.metaSet('gemini_consent',true);
      await db.metaSet('sec_lock',{...(await c.hashSecret('482917')),idle_min:30,away_min:15});
      const k=await db.saveNew('customers',{name:'Kaya İnşaat'},'sim');const h=await db.saveNew('customers',{name:'Hisar Polat'},'sim');
      const s=await db.saveNew('sites',{name:'Göktürk Villa',customer_id:k.id},'sim');
      const ps=await db.listActive('personnel');const vs=await db.listActive('vehicles');const pick=(n)=>ps.find(x=>x.name===n);
      const drivers=['Soner','Olcay','Bayram'].map(pick);
      for(let i=0;i<3;i++){await db.saveExisting('vehicles',vs[i],{assignee_id:drivers[i].id,load_ton:25},'sim');await db.saveExisting('personnel',drivers[i],{salary:30000,pay_type:'Aylık',start_date:'2022-01-10'},'sim');}
      return {k:k.id,h:h.id,s:s.id,drivers:drivers.map(x=>[x.id,x.name]),vehicles:vs.slice(0,3).map(v=>[v.id,v.name])}}""")
    pg.reload(); pg.wait_for_timeout(3000); unlock_if(pg)
    print("Kurulum: bugün", TODAY, "· şoförler", [d[1] for d in ids["drivers"]])

    # Depo: başlangıç 5000 L (Depo Tankı ekranından)
    pg.goto(U + "index.html#/depo"); pg.wait_for_timeout(1500)
    pg.fill("[name=date]", day(10)); pg.fill("[name=liters]", "5000"); pg.fill("[name=total]", "450950"); pg.click("[data-add]"); pg.wait_for_timeout(1500)

    def mklink(pid):
        pg.goto(U + "index.html#/sofor-kur?pid=" + pid); pg.reload(); pg.wait_for_timeout(2500); unlock_if(pg)
        pg.click("[data-copy]"); pg.wait_for_selector("#lock-root [data-pw]"); pg.fill("#lock-root [data-pw]", PIN); pg.click("#lock-root [data-go-un]"); pg.wait_for_timeout(1500)
        return pg.evaluate("navigator.clipboard.readText()")

    # ---------------- Şoför telefonları ----------------
    phones = {}
    for pid, name in ids["drivers"]:
        url = mklink(pid)
        c = b.new_context(viewport={'width': 390, 'height': 844}); c.add_init_script(SHARE_MOCK)
        dp = c.new_page(); dp.on("pageerror", lambda e, n=name: errs.append(n + " " + str(e)))
        dp.goto(url); dp.wait_for_timeout(3500)
        check("şoför ekranı" in dp.inner_text("#screen"), f"{name}: şoför uygulaması açıldı")
        phones[name] = dp
    with open(OUT + "/fis.jpg", "wb") as f:
        from PIL import Image; Image.new("RGB", (800, 1000), (250, 250, 250)).save(f, "JPEG")

    expected = {"works": 0, "fuelL": 0, "fuel": 0}
    def driver_work(dp, date, cust_label, qty, slip, ton, dump_label="Bolluca", photo=False):
        dp.click("[data-tab=is]") if dp.query_selector("[data-tab=is]") else None; dp.wait_for_timeout(200)
        dp.fill("[data-k=date]", date)
        dp.select_option("[data-cid]", label=cust_label); dp.wait_for_timeout(300)
        dp.fill("[data-k=q]", str(qty)); dp.select_option("[data-ds]", label=dump_label); dp.wait_for_timeout(300)
        dp.fill("[data-k=slip]", slip); dp.fill("[data-k=ton]", str(ton))
        if photo: dp.set_input_files("[data-photo]", [OUT + "/fis.jpg"]); dp.wait_for_timeout(800)
        dp.click("[data-add]"); dp.wait_for_timeout(500)
    def driver_fuel(dp, date, L):
        dp.click("[data-tab=yakit]"); dp.wait_for_timeout(300)
        dp.fill("[data-k=date]", date); dp.fill("[data-f=L]", str(L)); dp.click("[data-src='Depo Tankı']") if dp.query_selector("[data-src='Depo Tankı']") else None
        dp.fill("[data-f=km]", str(random.randint(100000, 200000))); dp.click("[data-addf]"); dp.wait_for_timeout(500)
        dp.click("[data-tab=is]"); dp.wait_for_timeout(200)
    def driver_send(dp):
        n0 = dp.evaluate("(window.__shares||[]).length")
        dp.click("[data-send]"); dp.wait_for_timeout(2500)
        sh = dp.evaluate("(window.__shares||[]).at(-1)") if dp.evaluate("(window.__shares||[]).length") > n0 else None
        return sh

    def boss_process(share, label):
        files = []
        for i, f in enumerate(share["files"]):
            path = f"{OUT}/{label}-{i}-{f['name']}"; open(path, "wb").write(base64.b64decode(f["b64"])); files.append(path)
        pg.goto(U + "index.html#/akilli-asistan"); pg.reload(); pg.wait_for_timeout(2500); unlock_if(pg)
        pg.evaluate("(()=>{const r=document.querySelector('[data-refine]');if(r)r.checked=false})()")
        if files: pg.set_input_files("[data-photos]", files); pg.wait_for_timeout(500)
        pg.fill("[data-msg]", share["text"]); pg.click("[data-ask]"); pg.wait_for_timeout(3000)
        out = pg.inner_text("[data-out]")
        rej = "İŞLENMEDİ" in out
        picked = pg.evaluate("[...document.querySelectorAll('[data-out] [data-pick]')].filter(x=>x.checked).length")
        unchecked = pg.evaluate("[...document.querySelectorAll('[data-out] [data-kind=work]')].filter(c=>!c.querySelector('[data-pick]').checked).map(c=>c.innerText.split('\\n').filter(l=>/⚠|uyar|zaten|aynı|benzer|eksik/i.test(l)).join(' | '))")
        if unchecked and not label.endswith("tekrar"): print("     işaretsiz iş kartları:", unchecked)
        if pg.query_selector("[data-save]"): pg.click("[data-save]"); pg.wait_for_timeout(3000)
        if pg.query_selector(".sheet"):
            print("     ONAY PENCERESİ:", pg.inner_text(".sheet").replace("\n", " | ")[:300]); SHEETS.append((label, pg.inner_text(".sheet")[:300]))
            for x in pg.query_selector_all(".sheet button"):
                if x.get_attribute("data-x") == "0" or x.inner_text().strip() == "Vazgeç": x.click(); break
            pg.wait_for_timeout(800)
        return rej, picked, pg.inner_text("[data-out]")[:200].replace("\n", " ")

    def count(store, extra="true"):
        return pg.evaluate(f"async()=>{{const db=await import('./js/db.js');return (await db.listActive('{store}')).filter(r=>{extra}).length}}")

    # ---------------- Günler ----------------
    custs = ["Kaya İnşaat", "Hisar Polat"]
    slipn = 1000
    for dn in [3, 2, 1]:
        date = day(dn)
        print(f"Gün {date}")
        for name, dp in phones.items():
            k = random.randint(1, 3)
            for j in range(k):
                slipn += 1
                driver_work(dp, date, random.choice(custs), random.randint(1, 6), f"B{slipn}", random.choice([24.5, 26, 27.3]), photo=(j == 0))
                expected["works"] += 1
            if random.random() < 0.7:
                L = random.choice([80, 120, 150, 200]); driver_fuel(dp, date, L); expected["fuelL"] += L; expected["fuel"] += 1
            ent_before = dp.evaluate("JSON.parse(localStorage.getItem('sp_driver_entries')||'[]').filter(e=>!e.sent).map(e=>(e.k||'w')+':'+(e.slip||''))")
            sh = driver_send(dp)
            ent_after = dp.evaluate("JSON.parse(localStorage.getItem('sp_driver_entries')||'[]').filter(e=>!e.sent).length")
            print("     şoför telefonunda gönderilmemiş:", ent_before, "→ gönderimden sonra kalan", ent_after, "| toast:", toast(dp)[-1:] )
            check(sh is not None and "SP1:" in sh["text"], f"{name}: Patrona gönder → mesaj + {len(sh['files']) if sh else 0} fotoğraf")
            rej, picked, out = boss_process(sh, f"{name}-{dn}")
            check(not rej and "Kaydedildi" in out, f"{name}: patron işledi ({picked} kart) → {out[:90]}")
            # Aynı mesaj ikinci kez yapıştırılırsa hiçbir şey çift yazılmamalı
            w0 = count("work_records")
            rej2, picked2, out2 = boss_process(sh, f"{name}-{dn}-tekrar")
            check(count("work_records") == w0, f"{name}: aynı mesaj tekrar yapıştırıldı → çift kayıt yok ({picked2} kart seçiliydi)")

    check(count("work_records", "!!r.driver_entry_id") == expected["works"], f"iş sayısı: beklenen {expected['works']}, kayıtta {count('work_records', '!!r.driver_entry_id')}")
    check(count("fuel_records") == expected["fuel"], f"yakıt kaydı: beklenen {expected['fuel']}, kayıtta {count('fuel_records')}")
    bal = pg.evaluate("async()=>{const db=await import('./js/db.js');const c=await import('./js/core.js');return c.calcTankBalance(await db.listActive('fuel_tank_movements')).remaining}")
    check(abs(bal - (5000 - expected["fuelL"])) < 0.01, f"depo stoku {bal} L = 5000 − {expected['fuelL']}")
    att = pg.evaluate("async()=>{const db=await import('./js/db.js');return (await db.getAll('attachments')).filter(a=>a.record_type==='work').length}")
    check(att >= 9, f"iş fişi fotoğrafları kayda bağlandı ({att})")

    # ---------------- İzin formları ----------------
    def leave(pid, a, bdate, approve):
        pg.goto(U + f"index.html#/izinler/form/new?pid={pid}"); pg.reload(); pg.wait_for_timeout(2000); unlock_if(pg)
        pg.select_option("[data-k]", "Yıllık izin"); pg.fill("[data-a]", a); pg.dispatch_event("[data-a]", "change"); pg.fill("[data-b]", bdate); pg.dispatch_event("[data-b]", "change")
        pg.click("[data-save]"); pg.wait_for_timeout(1500)
        pg.fill("[data-apn]", "Mahir Toprak")
        if approve:
            pg.click("[data-ok]"); pg.wait_for_timeout(600)
            for x in pg.query_selector_all(".sheet button"):
                if x.inner_text().strip() == "Onayla": x.click(); break
        else:
            pg.click("[data-rej]"); prompt(pg, "İş yoğun")
        pg.wait_for_timeout(1500)
        return pg.inner_text("#screen")
    import datetime
    nx = lambda n: (datetime.date.fromisoformat(TODAY) + datetime.timedelta(days=n)).isoformat()
    t = leave(ids["drivers"][1][0], nx(10), nx(14), True); check("Onaylandı" in t, "Olcay izin formu onaylandı")
    t = leave(ids["drivers"][2][0], nx(10), nx(12), False); check("Reddedildi" in t, "Bayram izin formu reddedildi")
    lv = count("personnel_events", f"r.personnel_id==='{ids['drivers'][2][0]}'&&r.event_type==='İzin'")
    check(lv == 0, "reddedilen formun günleri puantaja yazılmadı")

    # ---------------- Mazot faturası (Gemini sahte) ----------------
    T = "AYANGİL PETROL VKN: 7870325721 Fatura No: AYG2026000009999 İrsaliye No: IRS2026000009999 Motorin 5.000,0 lt 375.791,67 TL KDV 75.158,33 TL Ödenecek Tutar 450.950,00 TL"
    PLANS.append({"photo_texts": [T], "tank_in": [{"date": day(1), "liters": 5000, "unit_price": 75.15833333, "total": 450950, "credit": True, "photo": None,
        "company": "AYANGİL PETROL", "irsaliye_no": "IRS2026000009999", "invoice_no": "AYG2026000009999", "seller_tax_no": "7870325721", "net": 375791.67, "kdv": 75158.33}]})
    pg.goto(U + "index.html#/akilli-asistan"); pg.reload(); pg.wait_for_timeout(2500); unlock_if(pg)
    pg.set_input_files("[data-photos]", [OUT + "/fis.jpg"]); pg.wait_for_timeout(400); pg.click("[data-ask]"); pg.wait_for_timeout(3000)
    if pg.query_selector("[name=tank_link]"): pg.select_option("[name=tank_link]", "new")
    pg.click("[data-save]"); pg.wait_for_timeout(3000)
    tk = pg.evaluate("async()=>{const db=await import('./js/db.js');const m=(await db.listActive('fuel_tank_movements')).find(x=>x.invoice_no==='AYG2026000009999');return m?[m.unit_price,m.total,(await db.attachmentsFor('tank',m.id)).length]:null}")
    check(tk and tk[0] == 90.19 and tk[2] == 1, f"mazot faturası: KDV dahil 90,19 ₺/L, fotoğraf bağlı ({tk})")

    # ---------------- Şoför gideri (cebinden) + arıza (lastikçi), fotoğraflı ----------------
    dp = phones["Soner"]
    dp.click("[data-tab=gider]"); dp.wait_for_timeout(300)
    dp.fill("[data-k=date]", day(1)); dp.click("[data-x-kind='Yemek']"); dp.wait_for_timeout(200)
    dp.fill("[data-x=tl]", "350"); dp.click("[data-x-pay='cep']"); dp.wait_for_timeout(200)
    dp.set_input_files("[data-photo]", [OUT + "/fis.jpg"]); dp.wait_for_timeout(700); dp.click("[data-addx]"); dp.wait_for_timeout(500)
    dp.click("[data-tab=ariza]"); dp.wait_for_timeout(300)
    dp.fill("[data-k=date]", day(1)); dp.click("[data-x-kind='Lastik']"); dp.wait_for_timeout(200)
    dp.fill("[data-x=desc]", "sol arka lastik patladı"); dp.click("[data-x-st='Tamamlandı']"); dp.wait_for_timeout(200)
    dp.fill("[data-x=tl]", "1500"); dp.select_option("[data-x-sup]", "__new"); dp.wait_for_timeout(300); dp.fill("[data-x=sn]", "Lastikçi Mesut")
    dp.click("[data-x-pay='cep']"); dp.wait_for_timeout(200)
    dp.set_input_files("[data-photo]", [OUT + "/fis.jpg"]); dp.wait_for_timeout(700); dp.click("[data-addx]"); dp.wait_for_timeout(500)
    dp.click("[data-tab=is]"); dp.wait_for_timeout(300)
    sh = driver_send(dp)
    check(sh is not None and len(sh["files"]) == 2, f"Soner gider+arıza gönderdi ({len(sh['files']) if sh else 0} fotoğraf)")
    rej, picked, out = boss_process(sh, "soner-gider")
    check("1 gider" in out and "1 arıza/bakım" in out, f"patron gider + arızayı kaydetti → {out[:80]}")
    g = pg.evaluate("""async(pid)=>{const db=await import('./js/db.js');const e=(await db.listActive('expense_records')).find(x=>x.amount==350);const m=(await db.listActive('maintenance_records')).find(x=>x.cost==1500);
      return {e:e&&[e.personnel_id===pid,e.reimbursement_status,(await db.attachmentsFor('expense',e.id)).length],m:m&&[m.paid_by_personnel_id===pid,m.reimbursement_status,(await db.attachmentsFor('maintenance',m.id)).length]}}""", ids["drivers"][0][0])
    check(g["e"] == [True, "Bekliyor", 1], f"gider: Soner cebinden, iade bekliyor, fiş bağlı ({g['e']})")
    check(g["m"] == [True, "Bekliyor", 1], f"arıza: Soner cebinden, iade bekliyor, fotoğraf bağlı ({g['m']})")
    # ---------------- Maaş: puantajda iade görünür, ay kapatılır ----------------
    per = TODAY[:7]
    pg.goto(U + f"index.html#/puantaj/{ids['drivers'][0][0]}?ay={per}"); pg.reload(); pg.wait_for_timeout(2500); unlock_if(pg)
    ptxt = pg.inner_text("#screen")
    check("Masraf iadesi" in ptxt, "puantajda Soner'in cebinden ödediği masraflar iade olarak görünüyor")
    pg.on("dialog", lambda d: d.accept())
    pg.click("[data-pay]"); pg.wait_for_timeout(700)
    for x in pg.query_selector_all(".sheet button"):
        if x.inner_text().strip() == "Devam": x.click(); break
    pg.wait_for_timeout(700); prompt(pg, "0"); pg.wait_for_timeout(1500)
    acc = pg.evaluate(f"async()=>{{const db=await import('./js/db.js');return (await db.getAll('payroll_entries')).filter(r=>!r.deleted_at&&r.kind==='Ücret Tahakkuku'&&r.period==='{per}').length}}")
    check(acc == 1, f"Soner'in {per} maaşı kapatıldı (tahakkuk {acc})")
    # ---------------- Geri al: yanlış işlenen mesaj ----------------
    dp = phones["Bayram"]
    driver_work(dp, day(1), "Kaya İnşaat", 2, "B9999", 25)
    sh = driver_send(dp)
    w0 = count("work_records"); rej, picked, out = boss_process(sh, "bayram-geri")
    check(count("work_records") == w0 + 1, "yanlış iş kaydedildi")
    undo = pg.query_selector("[data-undo]") or pg.query_selector("text=Yanlış oldu")
    if undo:
        undo.click(); pg.wait_for_timeout(600)
        for x in pg.query_selector_all(".sheet button"):
            if x.inner_text().strip() in ("Geri al", "Evet, geri al"): x.click(); break
        pg.wait_for_timeout(2000)
    check(count("work_records") == w0, f"geri alındı → iş sayısı eski haline döndü ({count('work_records')} / {w0})")
    expected["works"] = count("work_records", "!!r.driver_entry_id")
    rej, picked, out = boss_process(sh, "bayram-geri-2")
    check(count("work_records") == w0 + 1, "geri alınan şoför kaydı yeniden yapıştırılınca tekrar alınabiliyor")

    # ---------------- Veri sağlığı ----------------
    r = pg.evaluate("async()=>{const db=await import('./js/db.js');const m=await import('./js/integrity-ui.js');const r=await m.runIntegrity(db);return {e:r.errors,w:r.warns,list:r.issues.map(x=>x.sev+': '+x.text)}}")
    check(r["e"] == 0, f"Veri Sağlığı: {r['e']} hata, {r['w']} uyarı")
    for x in r["list"][:15]: print("     ·", x)
    pg.goto(U + "index.html#/veri-sagligi"); pg.wait_for_timeout(2500); pg.screenshot(path=OUT + "/veri-sagligi.png", full_page=True)

    # ---------------- Yedek → yeni telefona geri yükleme ----------------
    snap = """async()=>{const db=await import('./js/db.js');const d=await db.dumpAll();const out={};for(const [k,v] of Object.entries(d)){if(Array.isArray(v))out[k]=v.filter(r=>!r.deleted_at).length}
      const a=await db.getAll('attachments');out._att=a.length;out._attBytes=a.reduce((n,x)=>n+(x.blob?.size||0),0);return out}"""
    before = pg.evaluate(snap)
    bk = pg.evaluate("async()=>{const db=await import('./js/db.js');const b=await import('./js/backup.js');const e=await import('./js/backup-crypt.js');const o=await b.fullBackup(db);const by=await e.encodeBackup(o,'yedekSifre1');let s='';for(let i=0;i<by.length;i+=0x8000)s+=String.fromCharCode(...by.subarray(i,i+0x8000));return btoa(s)}")
    new = b.new_context(); new.add_init_script("try{localStorage.setItem('sp_role','boss')}catch(e){}")
    np = new.new_page(); np.on("pageerror", lambda e: errs.append("NEW " + str(e))); np.goto(U + "index.html"); np.wait_for_timeout(4000)
    res = np.evaluate("""async(b64)=>{const db=await import('./js/db.js');const b=await import('./js/backup.js');const e=await import('./js/backup-crypt.js');
      const by=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));const o=await e.decodeBackup(by,async()=>'yedekSifre1');try{await b.restoreBackup(db,o,true);return 'ok'}catch(x){return 'ERR '+x.message}}""", bk)
    check(res == "ok", f"şifreli yedek yeni telefona geri yüklendi ({res})")
    after = np.evaluate(snap)
    diff = {k: (before.get(k), after.get(k)) for k in set(before) | set(after) if before.get(k) != after.get(k) and k not in ("audit_log", "meta")}
    check(not diff, f"geri yükleme birebir (kayıt ve dosya sayıları, dosya baytları) {diff if diff else ''}")
    r2 = np.evaluate("async()=>{const db=await import('./js/db.js');const m=await import('./js/integrity-ui.js');const r=await m.runIntegrity(db);return [r.errors,r.issues.filter(x=>x.sev==='error').map(x=>x.text)]}")
    check(r2[0] == 0, f"yeni telefonda Veri Sağlığı: {r2[0]} hata {r2[1][:3]}")

    check(not errs, f"sayfa hataları: {errs[:5]}")
    print("\nSONUÇ:", "BAŞARILI" if not FAIL else f"{len(FAIL)} SORUN"); [print("  -", f) for f in FAIL]
    b.close()
