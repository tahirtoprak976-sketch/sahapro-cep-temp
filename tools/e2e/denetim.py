# SAHAPRO denetim e2e (v3.9.04): gerçek ekranlar + taklit Gemini. TEST VERİSİ kullanır (temiz tarayıcı profili).
# Çalıştırma: python3 -m http.server 8841 (depo kökünde) açıkken  python3 tools/e2e/denetim.py
import json, os, sys
from playwright.sync_api import sync_playwright
U = "http://localhost:8841/"
PIN = "482917"
OUT = os.environ.get("SIM_OUT", "/tmp/sahapro_sim") + "/denetim"; os.makedirs(OUT, exist_ok=True)
FAIL = []
def check(cond, msg):
    print(("  ✓ " if cond else "  ✗ ") + msg)
    if not cond: FAIL.append(msg)

def unlock_if(pg):
    if pg.query_selector("#lock-root [data-pw]"):
        pg.fill("#lock-root [data-pw]", PIN); pg.click("#lock-root [data-go-un]"); pg.wait_for_timeout(1200)

with sync_playwright() as p:
    b = p.chromium.launch(); errs = []
    ctx = b.new_context(viewport={'width': 412, 'height': 900}); ctx.add_init_script("try{localStorage.setItem('sp_role','boss')}catch(e){}")
    PLANS = []; CALLS = []
    def gem(route):
        CALLS.append(route.request.url)
        plan = PLANS.pop(0) if PLANS else {}
        route.fulfill(status=200, content_type="application/json", body=json.dumps({"candidates": [{"content": {"parts": [{"text": json.dumps(plan, ensure_ascii=False)}]}, "finishReason": "STOP"}]}, ensure_ascii=False))
    pg = ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.route("https://generativelanguage.googleapis.com/**", gem)
    pg.goto(U + "index.html"); pg.wait_for_timeout(5000)
    TODAY = pg.evaluate("(async()=>(await import('./js/ui.js')).todayStr())()")
    ids = pg.evaluate("""async()=>{const db=await import('./js/db.js');const c=await import('./js/security-core.js');
      await db.metaSet('gemini_key','K');await db.metaSet('gemini_model','gemini-2.5-flash');await db.metaSet('gemini_consent',true);
      await db.metaSet('sec_lock',{...(await c.hashSecret('482917')),idle_min:30,away_min:15});
      const k=await db.saveNew('customers',{name:'Kaya İnşaat'},'test');const h=await db.saveNew('customers',{name:'Hisar Polat'},'test');
      const s=await db.saveNew('sites',{name:'Kemerburgaz',customer_id:h.id},'test');
      const ps=await db.listActive('personnel');const vs=await db.listActive('vehicles');
      return {k:k.id,h:h.id,s:s.id,p:ps[0].id,pn:ps[0].name,v:vs[0].id,vn:vs[0].name,v2:vs[1].id}}""")
    pg.reload(); pg.wait_for_timeout(3000); unlock_if(pg)
    def ev(js): return pg.evaluate(js)
    def count(store): return ev(f"async()=>{{const db=await import('./js/db.js');return (await db.listActive('{store}')).length}}")
    def assistant(msg, plan=None):
        if plan is not None: PLANS.append(plan)
        pg.goto(U + "index.html#/akilli-asistan"); pg.reload(); pg.wait_for_timeout(2500); unlock_if(pg)
        ev("(()=>{const r=document.querySelector('[data-refine]');if(r)r.checked=false})()")
        pg.fill("[data-msg]", msg); pg.click("[data-ask]"); pg.wait_for_timeout(3000)
    print("Kurulum:", TODAY)

    # ---- 1) Yarım kalan kayıt: tekrar Kaydet çift kayıt yapmamalı ----
    print("1) Yarım kalan kayıt + tekrar Kaydet")
    w0, e0 = count("work_records"), count("expense_records")
    msg = f"{ids['vn']} Kaya İnşaat 3 sefer hafriyat. Yemek 450 TL"
    assistant(msg, {"works": [{"date": TODAY, "date_source": "mesaj", "customer_id": ids["k"], "vehicle_id": ids["v"], "work_type": "Hafriyat Nakliye", "quantity": 3, "unit": "Sefer", "quote": f"{ids['vn']} Kaya İnşaat 3 sefer hafriyat"}],
                    "expenses": [{"date": TODAY, "amount": 450, "category": "Yemek", "vehicle_id": ids["v2"]}]})
    # Gider kartındaki aracı, kayıttan hemen önce silinmiş bir araca çevir → gider kaydı hata verir (iş kaydedilmiş olur)
    ev(f"""async()=>{{const db=await import('./js/db.js');const v=await db.get('vehicles','{ids['v2']}');await db.softDelete('vehicles','{ids['v2']}','test');}}""")
    ev("(()=>{const s=document.querySelector('[data-kind=expense] [name=vehicle]'); if(s){ if(![...s.options].some(o=>o.value===s.value)) return; }})()")
    picked = ev("[...document.querySelectorAll('[data-out] [data-pick]')].filter(x=>x.checked).length")
    pg.click("[data-save]"); pg.wait_for_timeout(3000)
    w1, e1 = count("work_records"), count("expense_records")
    print("     ilk Kaydet: iş", w1 - w0, "gider", e1 - e0, "| seçiliydi", picked)
    if pg.query_selector("[data-save]") and not pg.is_disabled("[data-save]"):
        pg.click("[data-save]"); pg.wait_for_timeout(3000)
        if pg.query_selector(".sheet"):
            for x in pg.query_selector_all(".sheet button"):
                if x.inner_text().strip() in ("Kaydet",): x.click(); break
            pg.wait_for_timeout(1500)
    w2 = count("work_records")
    check(w1 - w0 == 1, f"hata öncesi iş kaydedildi ({w1 - w0})")
    check(w2 == w1, f"tekrar Kaydet aynı işi ikinci kez yazmadı ({w2 - w0})")

    # ---- 2) KDV %0 korunur ----
    print("2) KDV %0")
    pg.goto(U + "index.html#/ayarlar"); pg.wait_for_timeout(1500); unlock_if(pg)
    pg.fill("[name=kdv]", "0"); pg.click("[data-finset]"); pg.wait_for_timeout(1200)
    kd = ev("""async()=>{const db=await import('./js/db.js');return await db.metaGet('kdv_default')}""")
    check(kd == 0, f"ayarlarda varsayılan KDV 0 kaydedildi ({kd})")
    pg.fill("[name=kdv]", ""); pg.click("[data-finset]"); pg.wait_for_timeout(1200)
    kd2 = ev("""async()=>{const db=await import('./js/db.js');return await db.metaGet('kdv_default')}""")
    check(kd2 == 0, f"boş KDV kaydedilmedi, sessizce 20 olmadı ({kd2})")
    msg = f"{ids['vn']} Kaya İnşaat 2 saat kazı saati 1500 TL"
    assistant(msg, {"works": [{"date": TODAY, "date_source": "mesaj", "customer_id": ids["k"], "vehicle_id": ids["v"], "work_type": "Kazı", "quantity": 2, "unit": "Saat", "unit_price": 1500, "quote": msg}]})
    pg.click("[data-save]"); pg.wait_for_timeout(2500)
    if pg.query_selector(".sheet"):
        for x in pg.query_selector_all(".sheet button"):
            if x.inner_text().strip() == "Kaydet": x.click(); break
        pg.wait_for_timeout(1500)
    snap = ev("""async()=>{const db=await import('./js/db.js');const w=(await db.listActive('work_records')).find(x=>x.work_type==='Kazı'&&Number(x.quantity)===2);return w&&w.price_snapshot}""")
    check(bool(snap) and snap.get("kdv_rate") == 0, f"asistan elle fiyat: KDV %0 korundu ({snap and snap.get('kdv_rate')})")
    ev("""async()=>{const db=await import('./js/db.js');await db.metaSet('kdv_default',20)}""")

    # ---- 3) Asistan fiyat kuralı güncellemesi: eski kural KDV dahil ise ----
    print("3) Fiyat kuralı güncelleme (eski kural KDV dahil)")
    ev(f"""async()=>{{const db=await import('./js/db.js');await db.saveNew('price_book',{{customer_id:'{ids['h']}',site_id:null,vehicle_id:null,work_type:'Hafriyat Nakliye',unit:'Sefer',price:4800,kdv_rate:20,kdv_included:true,valid_from:null,valid_to:null,active:true}},'test')}}""")
    msg = "Hisar Polat hafriyat sefer fiyatı 4000 TL olsun"
    assistant(msg, {"price_rules": [{"customer_id": ids["h"], "work_type": "Hafriyat Nakliye", "unit": "Sefer", "price": 4000, "quote": msg}]})
    pg.click("[data-save]"); pg.wait_for_timeout(2500)
    rule = ev(f"""async()=>{{const db=await import('./js/db.js');return (await db.listActive('price_book')).filter(r=>r.customer_id==='{ids['h']}'&&r.unit==='Sefer').map(r=>[r.price,r.kdv_included,r.kdv_rate])}}""")
    check(rule == [[4000, False, 20]], f"kural tek ve 'KDV hariç 4000' oldu ({rule})")

    # (4) cevap metriği denetimi birim testte: tests/ai-trust.test.mjs

    # ---- 5) Gemini onay metni gönderilen veriyi anlatıyor ----
    print("5) Gemini onay metni")
    pg.goto(U + "index.html#/yapay-zeka"); pg.wait_for_timeout(1500)
    unlock_if(pg); txt = ev("document.querySelector('#screen').textContent")
    check(("müşteri" in txt.lower() and "bakiye" in txt.lower()), "onay metni müşteri listesi ve bakiyelerin de gittiğini söylüyor")

    # ---- 6) İnternet yokken yerel kayıt ----
    print("6) İnternetsiz")
    ctx.set_offline(True)
    n0 = count("work_records")
    ok = ev(f"""async()=>{{const db=await import('./js/db.js');try{{await db.saveNew('work_records',{{date:'{TODAY}',customer_id:'{ids['k']}',vehicle_id:'{ids['v']}',work_type:'Kazı',quantity:1,unit:'Saat'}},'test');return true}}catch(e){{return String(e)}}}}""")
    check(ok is True and count("work_records") == n0 + 1, "internetsiz iş kaydı yazıldı (veritabanı yerel)")
    pg.goto(U + "index.html#/is-ekle"); pg.wait_for_timeout(1500)
    check(pg.query_selector("form") is not None or "İş" in pg.inner_text("#screen"), "internetsiz iş formu açıldı")
    ctx.set_offline(False)

    # ---- 7) Şoför kodu: imzasız / tanınmayan bağlantı → kartlar işaretsiz; imzalı → işaretli ----
    print("7) Şoför kodu doğrulama")
    mk = ev(f"""async()=>{{const sec=await import('./js/security.js');const dc=await import('./js/driver-core.js');const db=await import('./js/db.js');
      const d=await db.dumpAll();
      const {{link,forDriver}}=await sec.newDriverLink({{pid:'{ids['p']}',name:'{ids['pn']}',vid:'{ids['v']}'}});
      const base=dc.driverConfig(d,{{personnel_id:'{ids['p']}',vehicle_id:'{ids['v']}'}});
      const e=(id,q,extra={{}})=>({{id,k:'w',date:'{TODAY}',vid:'{ids['v']}',cid:'{ids['k']}',wt:'Hafriyat Nakliye',q,u:'Sefer',...extra}});
      const signed=await dc.driverMessage([e('ent-sig-1',4,{{dfs:'DF-77',rcv:'Mehmet Usta',sgt:new Date().toISOString(),sv:[[10,10,5,5,5,5]]}})],{{...base,lid:forDriver.lid,ls:forDriver.ls}});
      const unsigned=await dc.driverMessage([e('ent-uns-1',2)],{{...base}});
      const unknown=await dc.driverMessage([e('ent-unk-1',3)],{{...base,lid:'XXXXXXXXXXXX',ls:'c2VjcmV0c2VjcmV0c2VjcmV0'}});
      return {{signed,unsigned,unknown}}}}""")
    for key in ["unsigned", "unknown"]:
        n0 = len(CALLS)
        assistant(mk[key])
        st = ev("[...document.querySelectorAll('[data-out] [data-kind=work] [data-pick]')].map(x=>x.checked)")
        out = pg.inner_text("[data-out]") if pg.query_selector("[data-out]") else ""
        check(st == [] and "İŞLENMEDİ" in out, f"{key}: paket reddedildi, kart hiç oluşmadı ({st})")
        check(len(CALLS) == n0, f"{key}: reddedilen paket Gemini'ye gitmedi")
        check("yeni imzalı bağlantı oluştur" in out, f"{key}: 'yeni imzalı bağlantı' yolu gösterildi")
        # Ekran atlatılsa bile: kayıt fonksiyonu doğrudan çağrılır → yazılmaz
        r = ev(f"""async()=>{{const db=await import('./js/db.js');try{{await db.saveNew('work_records',{{date:'{TODAY}',customer_id:'{ids['k']}',vehicle_id:'{ids['v']}',work_type:'Hafriyat Nakliye',quantity:2,unit:'Sefer',driver_entry_id:'ent-{key[:3]}-1',source:'şoför'}},'saldırı');return 'YAZILDI'}}catch(e){{return e.code||String(e)}}}}""")
        check(r == "UNVERIFIED_DRIVER", f"{key}: kayıt fonksiyonu doğrudan çağrılınca da yazılmadı ({r})")
        r = ev(f"""async()=>{{const db=await import('./js/db.js');try{{await db.saveNew('fuel_records',{{date:'{TODAY}',vehicle_id:'{ids['v']}',liters:5,fuel_source:'Akaryakıt İstasyonu',driver_entry_id:'ent-{key[:3]}-f'}},'saldırı');return 'YAZILDI'}}catch(e){{return e.code||String(e)}}}}""")
        check(r == "UNVERIFIED_DRIVER", f"{key}: doğrulanmamış şoför yakıtı da yazılmadı ({r})")
    assistant(mk["signed"])
    st = ev("[...document.querySelectorAll('[data-out] [data-kind=work] [data-pick]')].map(x=>x.checked)")
    check(st == [True], f"imzalı paket: kart işaretli geldi ({st})")
    pg.click("[data-save]"); pg.wait_for_timeout(2500)
    r = ev(f"""async()=>{{const db=await import('./js/db.js');const w=await db.listActive('work_records');const x=w.find(r=>r.driver_entry_id==='ent-sig-1');if(!x)return 'yok';try{{await db.saveExisting('work_records',x,{{driver_entry_id:'ent-baska'}},'t');return 'DEĞİŞTİ'}}catch(e){{return 'engellendi'}}}}""")
    check(r == "engellendi", f"şoför kaydı kimliği sonradan değiştirilemez ({r})")
    # 7b) İptal edilmiş bağlantının mesajı: kod reddedilir; yazıdan çıkarılan iş de işaretsiz gelir
    rv = ev(f"""async()=>{{const sec=await import('./js/security.js');const dc=await import('./js/driver-core.js');const db=await import('./js/db.js');
      const d=await db.dumpAll();const {{link,forDriver}}=await sec.newDriverLink({{pid:'{ids['p']}',name:'{ids['pn']}',vid:'{ids['v']}'}});
      const base=dc.driverConfig(d,{{personnel_id:'{ids['p']}',vehicle_id:'{ids['v']}'}});
      const m=await dc.driverMessage([{{id:'ent-rev-1',k:'w',date:'{TODAY}',vid:'{ids['v']}',cid:'{ids['k']}',wt:'Hafriyat Nakliye',q:7,u:'Sefer'}}],{{...base,lid:forDriver.lid,ls:forDriver.ls}});
      await sec.revokeLink(forDriver.lid,'test');return m}}""")
    extra = f"{ids['vn']} Kaya İnşaat 7 sefer hafriyat"
    assistant(rv + "\n" + extra, {"works": [{"date": TODAY, "date_source": "mesaj", "customer_id": ids["k"], "vehicle_id": ids["v"], "work_type": "Hafriyat Nakliye", "quantity": 7, "unit": "Sefer", "quote": extra}]})
    st = ev("[...document.querySelectorAll('[data-out] [data-kind=work] [data-pick]')].map(x=>x.checked)")
    out = pg.inner_text("[data-out]")
    check("İŞLENMEDİ" in out and st == [] and "diğer yazı da işlenmedi" in out, f"iptal edilmiş bağlantı: kod ve mesajdaki yazı işlenmedi, kart yok ({st})")
    # ---- 8) İmzalı dijital fiş: imzadan sonra miktar değişirse PDF imzalanan hâli gösterir, uyarı çıkar ----
    print("8) İmzalı fiş sonradan değişti")
    wid = ev("""async()=>{const db=await import('./js/db.js');const w=(await db.listActive('work_records')).find(x=>x.digital_slip_no==='DF-77');return w&&w.id}""")
    check(bool(wid), "imzalı şoför işi kaydedildi")
    if wid:
        sc = ev(f"""async()=>{{const db=await import('./js/db.js');const w=await db.get('work_records','{wid}');return w.slip_signed_content}}""")
        check(bool(sc) and sc.get("q") == 4, f"imzalanan içerik saklandı ({sc and sc.get('q')})")
        ev(f"""async()=>{{const db=await import('./js/db.js');const w=await db.get('work_records','{wid}');await db.saveExisting('work_records',w,{{quantity:6}},'test: düzeltme')}}""")
        spec = ev(f"""async()=>{{const db=await import('./js/db.js');const dc=await import('./js/driver-core.js');const w=await db.get('work_records','{wid}');
          const s=dc.workSlipSpec(w,{{customers:{{}},sites:{{}},vehicles:{{}},personnel:{{}},dump_sites:{{}}}});return JSON.stringify(s.sections)}}""")
        check('"4 sefer' in spec.lower() or "4 Sefer" in spec or '"4"' in spec, "PDF imzalanan miktarı (4) gösteriyor, sonradan yazılan 6'yı değil")
        check("6 sefer" not in spec.lower(), "PDF'de imzalanmamış miktar yok")
        pg.goto(U + f"index.html#/isler/{wid}"); pg.reload(); pg.wait_for_timeout(2000); unlock_if(pg)
        check("imzaladığı fişten SONRA değiştirildi" in pg.inner_text("#screen"), "iş detayında 'imzadan sonra değişti' uyarısı")
        pg.goto(U + "index.html#/veri-sagligi"); pg.reload(); pg.wait_for_timeout(2500); unlock_if(pg)
        check("imzalı dijital fişten" in pg.inner_text("#screen"), "Veri Sağlığı imza sonrası değişikliği gösteriyor")
    # ---- 9) Yedek: şifresizde şoför anahtarı yok, şifrelide var; PIN özeti hiç yok ----
    print("9) Yedek gizli bilgiler")
    r = ev("""async()=>{const db=await import('./js/db.js');const b=await import('./js/backup.js');await db.metaSet('pin_hash','abc');
      const plain=await b.fullBackup(db,{encrypted:false});const enc=await b.fullBackup(db,{encrypted:true});
      const keys=(o)=>o.meta.map(m=>m.key);const s=JSON.stringify(plain);
      const links=(await db.metaGet('driver_links'))||[];
      return {pl:keys(plain).includes('driver_links'),en:keys(enc).includes('driver_links'),pin:keys(plain).includes('pin_hash')||keys(enc).includes('pin_hash'),
        leak:links.some(l=>s.includes(l.secret)||s.includes(l.exit)),gk:keys(plain).includes('gemini_key')||keys(enc).includes('gemini_key')}}""")
    check(not r["pl"] and not r["leak"], f"şifresiz yedekte şoför bağlantı anahtarı yok ({r})")
    check(r["en"], "şifreli yedekte şoför bağlantıları var (yeni telefonda imzalar doğrulanır)")
    check(not r["pin"] and not r["gk"], "PIN özeti ve Gemini anahtarı hiçbir yedekte yok")

    # ---- 10) Kalıcı işlem kimliği: kapat-aç + aynı mesaj, foto tamamlama, farklı içerik, ayrı kayıt, iki sekme ----
    print("10) İşlem kimliği")
    PLANS.clear()  # (7b'de Gemini çağrılmadığı için kuyrukta kalan taklit plan)
    from PIL import Image
    Image.new("RGB", (640, 480), (200, 180, 160)).save(OUT + "/fis.jpg", "JPEG")
    M = f"{ids['vn']} Hisar Polat 4 sefer moloz"
    PW = {"works": [{"date": TODAY, "date_source": "mesaj", "customer_id": ids["h"], "vehicle_id": ids["v"], "work_type": "Moloz Nakliye", "quantity": 4, "unit": "Sefer", "quote": M}]}
    def wcount(): return ev(f"""async()=>{{const db=await import('./js/db.js');return (await db.listActive('work_records')).filter(w=>w.work_type==='Moloz Nakliye'&&w.customer_id==='{ids['h']}').length}}""")
    def acount(): return ev(f"""async()=>{{const db=await import('./js/db.js');const w=(await db.listActive('work_records')).filter(w=>w.work_type==='Moloz Nakliye'&&w.customer_id==='{ids['h']}');let n=0;for(const x of w)n+=(await db.attachmentsFor('work',x.id)).length;return n}}""")
    def answer_sheet(btn):
        pg.wait_for_timeout(800)
        if pg.query_selector(".sheet"):
            txt = pg.inner_text(".sheet")
            for x in pg.query_selector_all(".sheet button"):
                if x.inner_text().strip() == btn: x.click(); break
            pg.wait_for_timeout(1500); return txt
        return ""
    # a) ilk kayıt fotoğrafsız; ekran sonucu göstermeden "kapandı" (sayfa yenilenir)
    assistant(M, json.loads(json.dumps(PW)))
    pg.click("[data-save]")
    for _ in range(50):  # iş veritabanına yazılır yazılmaz (ekran sonucu göstermeden) sayfa kapanır
        if wcount() == 1: break
        pg.wait_for_timeout(50)
    pg.reload(); pg.wait_for_timeout(2500); unlock_if(pg)
    c1 = wcount(); check(c1 == 1, f"ilk kayıt yazıldı ({c1})")
    # b) uygulama yeniden açıldı, aynı mesaj + bu kez fotoğrafla tekrar: iş yeniden yazılmaz, eksik foto tamamlanır
    PW2 = json.loads(json.dumps(PW)); PW2["works"][0]["photos"] = [0]
    pg.goto(U + "index.html#/akilli-asistan"); pg.reload(); pg.wait_for_timeout(2500); unlock_if(pg)
    ev("(()=>{const r=document.querySelector('[data-refine]');if(r)r.checked=false})()")
    PLANS.append(PW2); pg.set_input_files("[data-photos]", [OUT + "/fis.jpg"]); pg.wait_for_timeout(500)
    pg.fill("[data-msg]", M); pg.click("[data-ask]"); pg.wait_for_timeout(3000)
    pg.click("[data-save]"); sh = answer_sheet("Vazgeç"); pg.wait_for_timeout(1500)
    check("zaten kaydedildi" in sh, "aynı mesaj tekrar: 'bu satır zaten kaydedildi' soruldu")
    check(wcount() == 1, f"aynı mesaj tekrar: iş yeniden oluşturulmadı ({wcount()})")
    a1 = acount(); check(a1 == 1, f"eksik fotoğraf mevcut işe eklendi ({a1})")
    # c) aynı mesaj + aynı fotoğraf bir kez daha: fotoğraf da çiftlenmez
    pg.goto(U + "index.html#/akilli-asistan"); pg.reload(); pg.wait_for_timeout(2500); unlock_if(pg)
    ev("(()=>{const r=document.querySelector('[data-refine]');if(r)r.checked=false})()")
    PLANS.append(json.loads(json.dumps(PW2))); pg.set_input_files("[data-photos]", [OUT + "/fis.jpg"]); pg.wait_for_timeout(500)
    pg.fill("[data-msg]", M); pg.click("[data-ask]"); pg.wait_for_timeout(3000)
    pg.click("[data-save]"); answer_sheet("Vazgeç"); pg.wait_for_timeout(1000)
    check(wcount() == 1 and acount() == 1, f"üçüncü kez: iş ve fotoğraf tek ({wcount()}, {acount()})")
    # d) aynı satır, kartta miktar değiştirilmiş → çakışma, yazılmaz
    assistant(M, json.loads(json.dumps(PW)))
    pg.fill("[data-kind=work] [name=quantity]", "6"); pg.click("[data-save]"); pg.wait_for_timeout(2500)
    check(wcount() == 1, f"aynı kimlik + farklı içerik: çakışma, yazılmadı ({wcount()})")
    # e) bilerek ayrı kayıt
    assistant(M, json.loads(json.dumps(PW))); pg.click("[data-save]"); answer_sheet("Ayrı kayıt olarak kaydet"); pg.wait_for_timeout(1500)
    check(wcount() == 2, f"kullanıcı 'ayrı kayıt' derse yazılır ({wcount()})")
    # f) iki sekme aynı yeni mesajı aynı anda kaydeder
    M2 = f"{ids['vn']} Hisar Polat 9 sefer moloz"
    P2 = {"works": [{**PW["works"][0], "quantity": 9, "quote": M2}]}
    pg2 = ctx.new_page(); pg2.route("https://generativelanguage.googleapis.com/**", gem); pg2.on("pageerror", lambda e: errs.append("TAB2 " + str(e)))
    for pp in (pg, pg2):
        PLANS.append(json.loads(json.dumps(P2)))
        pp.goto(U + "index.html#/akilli-asistan"); pp.reload(); pp.wait_for_timeout(2500); unlock_if(pp)
        pp.evaluate("(()=>{const r=document.querySelector('[data-refine]');if(r)r.checked=false})()")
        pp.fill("[data-msg]", M2); pp.click("[data-ask]"); pp.wait_for_timeout(3000)
    pg.evaluate("document.querySelector('[data-save]').click()"); pg2.evaluate("document.querySelector('[data-save]').click()"); pg.wait_for_timeout(3500)
    n9 = ev(f"""async()=>{{const db=await import('./js/db.js');return (await db.listActive('work_records')).filter(w=>w.work_type==='Moloz Nakliye'&&Number(w.quantity)===9).length}}""")
    check(n9 == 1, f"iki sekme aynı anda: iş bir kez yazıldı ({n9})")
    pg2.close()

    print("\nsayfa hataları:", errs[:5])
    check(not errs, "sayfa hatası yok")
    b.close()
print("\nSONUÇ:", "BAŞARILI" if not FAIL else f"{len(FAIL)} SORUN")
for f in FAIL: print("  -", f)
