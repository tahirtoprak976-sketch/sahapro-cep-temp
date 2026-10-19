# Metraj Paket 1 — filo: dingil / dara / yasal sınır / kasa m³ → araç kartında tahmini sefer başı yerinde m³;
# malzeme katsayıları ekranı; döküm sahasında kantar var/yok. Hiçbir iş/cari/kasa kaydı değişmez. TEST VERİSİ.
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
    ev("""async()=>{const db=await import('./js/db.js');const c=await import('./js/security-core.js');
      await db.metaSet('sec_lock',{...(await c.hashSecret('482917')),idle_min:30,away_min:15});}""")
    snap = lambda: ev("async()=>{const db=await import('./js/db.js');const d=await db.dumpAll();return ['work_records','fuel_records','cash_records','cari_movements'].map(s=>(d[s]||[]).map(x=>x.id+(x.updated_at||'')).sort().join()).join('|')}")
    def unlock():
        if pg.query_selector("#lock-root [data-pw]"): pg.fill("#lock-root [data-pw]", PIN); pg.click("#lock-root [data-go-un]"); pg.wait_for_timeout(1200)
    pg.reload(); pg.wait_for_timeout(3000); unlock()
    s0 = snap()
    def new_vehicle(name, typ, axles, tare, body, load=""):
        pg.goto(U + "index.html#/filo/new"); pg.wait_for_timeout(2000); unlock()
        pg.fill("[data-form] [name=name]", name); pg.select_option("[data-form] [name=type]", typ)
        pg.fill("[data-form] [name=axles]", str(axles)); pg.fill("[data-form] [name=tare_ton]", str(tare)); pg.fill("[data-form] [name=body_m3]", str(body))
        if load: pg.fill("[data-form] [name=load_ton]", str(load))
        pg.click("[data-save]"); pg.wait_for_timeout(2500)
        return pg.url.split("#/filo/")[1]
    v4 = new_vehicle("Test Kamyon 4D", "Kamyon", 4, 13, 17)
    h = pg.inner_text("[data-haul]") if pg.query_selector("[data-haul]") else ""
    check("Yasal toplam ağırlık" in h and "32 t (dingil sayısından)" in h and "Yasal net yük" in h and "19 t" in h, f"4 dingil: yasal 32 t, dara 13 → net 19 t ({h[:120]!r})")
    rows = ev("[...document.querySelectorAll('[data-haul] tbody tr')].map(r=>r.innerText.replace(/\\s+/g,' '))")
    check(any(r.startswith("Toprak (genel)") and "9,7 m³" in r and "ağırlık" in r for r in rows), f"toprak: sefer başı ≈ 9,7 m³ yerinde, ağırlık sınırlıyor ({rows[:1]})")
    check(any(r.startswith("Moloz") and "—" in r and "ton ile izlenir" in r for r in rows), "moloz: yerinde m³ uydurulmuyor (—)")
    check("iki kat fazla" in h and "ölçümcünün" in h, "tahmin olduğu ve kesin miktarın ölçüm olduğu yazıyor")
    v5 = new_vehicle("Test Kamyon 5D", "Tır", 5, 14, 19, 30)
    h = pg.inner_text("[data-haul]")
    check("42 t" in h and "28 t" in h, "5 dingil: yasal 42 t, net 28 t")
    check("yasal net yükün 2 t üstünde" in h and "hiçbir kayıt değişmez" in h, "kartta yazan ortalama yük yasal sınırı aşıyorsa yalnız bilgi notu")
    heads = ev("[...document.querySelectorAll('[data-haul] thead th')].map(t=>t.innerText)")
    rows = ev("[...document.querySelectorAll('[data-haul] tbody tr')].map(r=>r.innerText.replace(/\\s+/g,' '))")
    check(any("Yasal yükle (28 t)" in x for x in heads) and any("Ortalama yükle (30 t)" in x for x in heads), f"iki senaryo sütunu: yasal ve ortalama yük ({heads})")
    check(any(r.startswith("Bitkisel") and "kasa dolar" in r for r in rows), "bitkisel toprakta kasa dolar")
    ov = ev("({sw:document.documentElement.scrollWidth,w:document.documentElement.clientWidth})")
    check(ov["sw"] <= ov["w"], f"araç kartında 360 px taşma yok ({ov})")
    # Malzeme katsayıları
    pg.click("[data-haul] [data-go='#/malzeme-katsayilari']"); pg.wait_for_timeout(2000)
    check("malzeme-katsayilari" in pg.url and len(ev("[...document.querySelectorAll('[data-mat]')]")) == 6, "malzeme katsayıları ekranı açıldı (6 malzeme)")
    pg.fill("[data-mat=toprak] [data-bank]", "1,2"); pg.click("[data-mat=toprak] [data-save]"); pg.wait_for_timeout(800)
    t = " ".join(ev("[...document.querySelectorAll('.toast')].map(t=>t.textContent)"))
    check("küçük olamaz" in t and not ev("async()=>(await (await import('./js/db.js')).metaGet('haul_materials'))"), "yanlış katsayı (yerinde < gevşek) kaydedilmedi")
    pg.fill("[data-mat=toprak] [data-bank]", "2,0"); pg.click("[data-mat=toprak] [data-save]"); pg.wait_for_timeout(2000)
    check("Kabarma payı ≈ %29" in pg.inner_text("[data-mat=toprak]") and "düzeltildi" in pg.inner_text("[data-mat=toprak]"), "düzeltilen katsayı kaydedildi, kabarma yeniden hesaplandı")
    pg.goto(U + "index.html#/filo/" + v4); pg.wait_for_timeout(2500)
    rows = ev("[...document.querySelectorAll('[data-haul] tbody tr')].map(r=>r.innerText.replace(/\\s+/g,' '))")
    check(any(r.startswith("Toprak (genel)") and "9,5 m³" in r for r in rows), f"araç kartı yeni katsayıyla hesaplıyor (19 / 2,0 = 9,5) ({rows[:1]})")
    pg.goto(U + "index.html#/malzeme-katsayilari"); pg.wait_for_timeout(1500); pg.click("[data-mat=toprak] [data-reset]"); pg.wait_for_timeout(1500)
    check("Kabarma payı ≈ %26" in pg.inner_text("[data-mat=toprak]"), "varsayılana dönüldü")
    ov = ev("({sw:document.documentElement.scrollWidth,w:document.documentElement.clientWidth})")
    check(ov["sw"] <= ov["w"], f"katsayı ekranında 360 px taşma yok ({ov})")
    # Döküm sahası kantarı
    pg.goto(U + "index.html#/dokum/new"); pg.wait_for_timeout(2000)
    pg.fill("[data-form] [name=name]", "Test Dolgu Sahası"); pg.select_option("[data-form] [name=has_scale]", "yok"); pg.click("[data-save]"); pg.wait_for_timeout(2000)
    pg.goto(U + "index.html#/dokum"); pg.wait_for_timeout(2000)
    items = ev("[...document.querySelectorAll('[data-list] .li')].map(x=>x.innerText.replace(/\\s+/g,' '))")
    check(any("Test Dolgu Sahası" in x and "kantarsız" in x for x in items), f"döküm sahası 'kantarsız' görünüyor ({[x for x in items if 'Test' in x]})")
    off = [x for x in items if "Test" not in x and "ton" in x.lower()]
    check(not off or all("kantarlı" in x for x in off), f"ton başı ücretli sahalar kantarlı sayılıyor ({off[:1]})")
    # Asıl kayıtlar değişmedi
    check(snap() == s0 and len(CALLS) == 0, "iş / yakıt / kasa / cari kayıtları değişmedi, yapay zekâ çağrılmadı")
    check(not errs, f"sayfa hatası yok {errs[:2]}")
    b.close()
print("\nSONUÇ:", "BAŞARILI" if not FAIL else f"{len(FAIL)} SORUN")
