# İş sözleşmesi panosu: sekmeler, tahmini kâr = gelir − gider, göstergeler, gelir–gider tablosu, günlük grafik, araçlar, uyarılar;
# pano kayıt yazmaz; 360 px taşma yok. TEST VERİSİ.
import sys, re
from playwright.sync_api import sync_playwright
U = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8846/"
FAIL = []
def check(c, m):
    print(("  ✓ " if c else "  ✗ ") + m)
    if not c: FAIL.append(m)
num = lambda s: int(re.sub(r"[^\d]", "", s) or 0) * (-1 if "−" in s else 1)
with sync_playwright() as p:
    b = p.chromium.launch(); errs = []
    ctx = b.new_context(viewport={'width': 360, 'height': 800}, timezone_id='Europe/Istanbul'); ctx.add_init_script("try{localStorage.setItem('sp_role','boss');localStorage.setItem('spx_role','boss')}catch(e){}")
    pg = ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(U + "index.html"); pg.wait_for_timeout(5000)
    ev = lambda js: pg.evaluate(js)
    sid = ev("""async()=>{const db=await import('./js/db.js');const core=await import('./js/core.js');const T=core.todayStr();const A=(n)=>core.addDays(T,n);
      await db.metaSet('fuel_ref_price',46);
      const k=await db.saveNew('customers',{name:'Pano Test Yapı'},'t');
      const ps=await db.listActive('personnel');await db.saveExisting('personnel',ps[0],{daily_wage:3000},'t');await db.saveExisting('personnel',ps[1],{salary:52000},'t');
      const V=async(n,a,pi)=>db.saveNew('vehicles',{name:n,type:a?'Kamyon':'Ekskavatör',ownership:'Özmal',axles:a||null,tare_ton:a?13:null,body_m3:a?17:null,assignee_id:ps[pi].id,active:true},'t');
      const v1=await V('Pano Kamyon',4,0),ex=await V('Pano Ekskavatör',0,1);
      const s=await db.saveNew('sites',{name:'Pano Şantiye',customer_id:k.id},'t');
      await db.saveExisting('sites',s,{deal:{basis:'m³',price:800,kdv_rate:20,kdv_included:false,start_date:A(-8),material:'toprak',status:'Açık'}},'t');
      const W=(o)=>db.saveNew('work_records',{customer_id:k.id,site_id:s.id,work_type:'Hafriyat Nakliye',unit:'Sefer',...o,price_snapshot:{unit_price:0,amount:0,kdv_rate:20,kdv_included:false,price_source:'Sözleşmeye dahil'}},'t');
      for(let i=-6;i<=0;i++){ await W({date:A(i),vehicle_id:v1.id,quantity:6,tonnage:19.5}); await W({date:A(i),vehicle_id:ex.id,unit:'Saat',work_type:'Kazı',quantity:8}); }
      for(let i=-30;i<=0;i+=3){ await db.saveNew('fuel_records',{date:A(i),vehicle_id:v1.id,liters:150,unit_price:46,total:6900,fuel_source:'Petrol İstasyonu'},'t'); await db.saveNew('fuel_records',{date:A(i),vehicle_id:ex.id,liters:100,unit_price:46,total:4600,fuel_source:'Petrol İstasyonu'},'t'); }
      await db.saveNew('expense_records',{date:A(-2),category:'Yemek',amount:2400,description:'Şantiye yemek',site_id:s.id,customer_id:k.id},'t');
      await db.saveNew('cash_records',{date:A(-1),customer_id:k.id,cash_type:'Müşteriden Para Alındı',amount:60000,method:'Havale'},'t');
      return s.id}""")
    snap = lambda: ev("async()=>{const db=await import('./js/db.js');const d=await db.dumpAll();return ['work_records','fuel_records','cash_records','cari_movements','sites','expense_records'].map(s=>(d[s]||[]).map(x=>x.id+(x.updated_at||'')).sort().join()).join('|')}")
    s0 = snap()
    pg.goto(U + f"index.html#/is-sozlesmesi/{sid}"); pg.wait_for_timeout(3500)
    check(ev("[...document.querySelectorAll('[data-jt]')].map(b=>b.textContent).join('|')") == "ÖZET|SEFER VE m³|SÖZLEŞME" and pg.is_visible("[data-hero]"), "üç sekme; Özet açık")
    hero = pg.inner_text("[data-hero]")
    m = re.search(r"Gelir ([\d.]+) ₺ − gider ([\d.]+) ₺", hero)
    prof = re.search(r"\n(−?[\d.]+) ₺", hero)
    inc, cost = (num(m.group(1)), num(m.group(2))) if m else (0, 0)
    check(m and prof and num(prof.group(1)) == inc - cost, f"tahmini kâr = gelir − gider ({hero[:110]!r})")
    check("Tahsilat" in hero and "60.000" in hero and "tahmini hakedişe göre" in hero, "tahsilat ilerlemesi tahmini hakedişe göre")
    k = ev("[...document.querySelectorAll('[data-kpis] .card')].map(c=>c.innerText.replace(/\\s+/g,' '))")
    check(len(k) == 6 and k[0].startswith("42 Sefer") and k[2].startswith("56 Makine") and k[3].startswith("7 Çalışılan"), f"göstergeler: 42 sefer, 56 saat, 7 gün ({k[:4]})")
    t = pg.inner_text("[data-moneychart]")
    check(all(x in t for x in ["Mazot", "İşçilik", "Döküm", "Diğer giderler", "2.400", "Tahmini kâr"]), "gelir–gider tablosu kalemleriyle; şantiye gideri 2.400")
    lab = re.search(r"İşçilik.*?− ([\d.]+) ₺", t, re.S)
    check(lab and num(lab.group(1)) == 7 * 3000 + 7 * 2000, f"işçilik = 7 gün × (3.000 yevmiye + 52.000/26) ({lab.group(1) if lab else None})")
    pg.click("[data-day]:last-child"); pg.wait_for_timeout(300)
    check("6 sefer" in pg.inner_text("[data-dayinfo]") and "8 makine saati" in pg.inner_text("[data-dayinfo]"), "günlük grafikte güne dokununca değer")
    check(len(ev("[...document.querySelectorAll('[data-vehtable] tbody tr')]")) == 2, "araç tablosu (2 araç, mazot L ve TL)")
    ov = ev("({sw:document.documentElement.scrollWidth,w:document.documentElement.clientWidth})")
    check(ov["sw"] <= ov["w"], f"360 px taşma yok ({ov})")
    pg.click("[data-jt='kayit']"); pg.wait_for_timeout(300)
    check(pg.is_visible("[data-est]") and not pg.is_visible("[data-hero]"), "Sefer ve m³ sekmesi")
    pg.click("[data-jt='soz']"); pg.wait_for_timeout(300)
    check(pg.is_visible("[data-deal]") and pg.is_visible("[data-measure]") and not pg.is_visible("[data-est]"), "Sözleşme sekmesi: anlaşma ve ölçüm")
    pg.reload(); pg.wait_for_timeout(3000)
    check(pg.is_visible("[data-deal]"), "seçili sekme yenileyince korunuyor")
    pg.goto(U + "index.html#/is-sozlesmeleri"); pg.wait_for_timeout(2500)
    check("kâr ≈" in pg.inner_text("[data-list], #screen"), "iş listesinde tahmini kâr")
    check(snap() == s0, "pano hiçbir kayıt yazmadı")
    check(not errs, f"sayfa hatası yok {errs[:2]}")
    b.close()
print("\nSONUÇ:", "BAŞARILI" if not FAIL else f"{len(FAIL)} SORUN")
