# Genel tarama: zengin TEST VERİSİ kurulur, her ekran (liste, kart, yeni form) 360 px'te açılır.
# Sayfa hatası, konsol hatası, "Ekran yüklenirken hata", yatay taşma ve boş ekran raporlanır. Gemini ağı kapalı (abort).
import sys, json, os
from playwright.sync_api import sync_playwright
U = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8846/"; PIN = "482917"
ROUTES = "ara arsiv asistan ayarlar bakim bakim-takvimi bakimplani banka-aktarim banka-tahsilat banka-transfer belgeler cari ceksenet cop daha dagitim depo detayli-rapor dokum dokum-hesap duruslar esnaf fatura filo finans fisler fiyat fiyat-saglik gecmis gider gun-kapanis gunsonu guvenlik hakedis is-sozlesmeleri is-sozlesmeleri/oku isler izinler kart-birlestir kasa kendi-depo kime-kontrol maliyet malzeme-katsayilari mazot-hesaplari mesaj-hafizasi mesajlar musteri-paketi musteriler nakit ocak odemeler parcalar personel puantaj qr raporlar santiyeler saticicari satinalma sayac sayim sofor-kur sozlesmeler tahsilat takipler tara taseron teklif teklif-hesap teklif-karsilastir ucretler vadeler vardiya veri-sagligi whatsapp whatsapp-toplu yakit yapay-zeka yaslandirma yonetici zimmet akilli-asistan alislar".split()
NEW = "isler fisler yakit gider kasa tahsilat bakim belgeler teklif hakedis fiyat musteriler santiyeler dokum ocak filo personel taseron sozlesmeler".split()
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=os.environ.get("CHROMIUM_PATH", "/usr/bin/chromium"), args=["--no-sandbox"])
    ctx = b.new_context(viewport={'width': 360, 'height': 780}, timezone_id='Europe/Istanbul', locale='tr-TR'); ctx.add_init_script("try{localStorage.setItem('sp_role','boss');localStorage.setItem('spx_role','boss')}catch(e){}")
    ctx.route("https://generativelanguage.googleapis.com/**", lambda r: r.abort())
    pg = ctx.new_page()
    errs = []; cur = {"r": ""}
    pg.on("pageerror", lambda e: errs.append((cur["r"], "PAGE " + str(e)[:200])))
    pg.on("console", lambda m: errs.append((cur["r"], "CONSOLE " + m.text[:200])) if m.type == "error" and "net::ERR" not in m.text and "Failed to load resource" not in m.text else None)
    pg.goto(U + "index.html"); pg.wait_for_timeout(5000)
    ids = pg.evaluate("""async()=>{const db=await import('./js/db.js');const core=await import('./js/core.js');const T=core.todayStr();
      const k=await db.saveNew('customers',{name:'Tarama Yapı',phone:'05320000000'},'t');const k2=await db.saveNew('customers',{name:'Tarama İnşaat'},'t');
      const s=await db.saveNew('sites',{name:'Tarama Şantiye',customer_id:k.id},'t');
      await db.saveExisting('sites',s,{deal:{basis:'m³',price:100,kdv_rate:20,kdv_included:false,start_date:core.addDays(T,-10),material:'toprak',status:'Açık'}},'t');
      const s2=await db.saveNew('sites',{name:'Tarama Götürü',customer_id:k2.id},'t');
      await db.saveExisting('sites',s2,{deal:{basis:'Götürü',price:50000,kdv_rate:20,kdv_included:false,start_date:T,status:'Açık',scope_in:'yıkım',scrap:'ayrica'}},'t');
      const vs=await db.listActive('vehicles');const v=vs[0];await db.saveExisting('vehicles',v,{axles:4,tare_ton:13,body_m3:17},'t');
      await db.saveNew('price_book',{customer_id:k2.id,site_id:null,vehicle_id:null,work_type:'Hafriyat Nakliye',unit:'Sefer',price:1500,kdv_rate:20,kdv_included:false,valid_from:'2026-01-01',valid_to:null,active:true},'t');
      const w=await db.saveNew('work_records',{date:T,customer_id:k2.id,vehicle_id:v.id,work_type:'Hafriyat Nakliye',unit:'Sefer',quantity:3,price_snapshot:{unit_price:1500,amount:4500,kdv_rate:20,kdv_included:false,price_source:'Fiyat listesi'}},'t');
      await db.saveNew('work_records',{date:T,customer_id:k.id,site_id:s.id,vehicle_id:v.id,work_type:'Hafriyat Nakliye',unit:'Sefer',quantity:5,tonnage:20,price_snapshot:{unit_price:0,amount:0,kdv_rate:20,kdv_included:false,price_source:'Sözleşmeye dahil'}},'t');
      const f=await db.saveNew('fuel_records',{date:T,vehicle_id:v.id,liters:200,unit_price:45,total:9000,fuel_source:'Petrol İstasyonu'},'t');
      const c=await db.saveNew('cash_records',{date:T,customer_id:k2.id,cash_type:'Müşteriden Para Alındı',amount:2000,method:'Nakit'},'t');
      const e=await db.saveNew('expense_records',{date:T,category:(core.EXPENSE_CATEGORIES||['Diğer'])[0],amount:300,description:'Tarama gider'},'t').catch(x=>({id:null,err:String(x)}));
      const ds=(await db.listActive('dump_sites'))[0];const ps=(await db.listActive('personnel'))[0];
      const pb=(await db.listActive('price_book'))[0];
      return {k:k.id,k2:k2.id,s:s.id,s2:s2.id,v:v.id,w:w.id,f:f.id,c:c.id,e:e.id,eerr:e.err||null,ds:ds?.id,p:ps?.id,pb:pb.id}}""")
    print("veri:", json.dumps(ids)[:300])
    pg.reload(); pg.wait_for_timeout(3000)
    rows = []
    def visit(r):
        cur["r"] = r; n0 = len(errs)
        try:
            pg.goto(U + "index.html#/" + r); pg.wait_for_timeout(1300)
            if pg.query_selector(".sheet"): pg.keyboard.press("Escape")
            t = pg.evaluate("document.querySelector('#screen')?.innerText||''")
            ov = pg.evaluate("({sw:document.documentElement.scrollWidth,w:document.documentElement.clientWidth})")
            bad = []
            if "Ekran yüklenirken hata" in t: bad.append("EKRAN HATASI: " + t[t.find("Ekran yüklenirken hata"):][:150])
            if ov["sw"] > ov["w"] + 1: bad.append(f"taşma {ov['sw']}>{ov['w']}")
            if len(t.strip()) < 15: bad.append("boş ekran")
            bad += [x[1] for x in errs[n0:]]
            if bad: rows.append((r, bad))
        except Exception as ex: rows.append((r, ["GEZİNME " + str(ex)[:150]]))
    for r in ROUTES: visit(r)
    for r in NEW: visit(r + "/new")
    for r in [f"isler/{ids['w']}", f"isler/{ids['w']}/edit", f"musteriler/{ids['k']}", f"musteriler/{ids['k2']}", f"santiyeler/{ids['s']}", f"filo/{ids['v']}", f"filo/{ids['v']}/edit",
              f"is-sozlesmesi/{ids['s']}", f"is-sozlesmesi/{ids['s']}/bagla", f"is-sozlesmesi/{ids['s2']}", f"is-sozlesmesi/{ids['s']}?duzenle=1", f"cari/{ids['k2']}", f"yakit/{ids['f']}", f"kasa/{ids['c']}",
              f"dokum/{ids['ds']}", f"dokum/{ids['ds']}/edit", f"dokum-hesap/{ids['ds']}", f"personel/{ids['p']}", f"fiyat/{ids['pb']}", f"fiyat/{ids['pb']}/edit", f"bakim-takvimi/{ids['v']}",
              "isler?f=musterisiz", f"is-sozlesmeleri?customer_id={ids['k']}", "kart-birlestir?tur=santiye", "kart-birlestir?tur=arac", "ayarlar?tab=yedek", "detayli-rapor?k=musteri&id=" + ids['k2'] + "&p=all"]:
        visit(r)
    if ids.get("e"): visit(f"gider/{ids['e']}")
    print(f"\n{len(ROUTES) + len(NEW) + 28} ekran tarandı, {len(rows)} sorunlu")
    for r, bad in rows: print(" ✗", r, "→", " | ".join(bad)[:400])
    b.close()

raise SystemExit(bool(rows))
