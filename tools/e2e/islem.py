# Paket 2 — asistanla ekran açma, listeleme, düzeltilecek kaydı bulma, bağlam, mevcut kayda fotoğraf. TEST VERİSİ, taklit Gemini.
import sys, json, base64, os
from playwright.sync_api import sync_playwright
U = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8846/"; PIN = "482917"
FAIL = []
def check(c, m):
    print(("  ✓ " if c else "  ✗ ") + m)
    if not c: FAIL.append(m)
PNG = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==")
with sync_playwright() as p:
    b = p.chromium.launch(executable_path=os.environ.get("CHROMIUM_PATH"), args=["--no-sandbox"]); errs = []
    ctx = b.new_context(viewport={'width': 360, 'height': 780}); ctx.add_init_script("try{localStorage.setItem('sp_role','boss');localStorage.setItem('spx_role','boss')}catch(e){}")
    CALLS = []
    ctx.route("https://generativelanguage.googleapis.com/**", lambda r: (CALLS.append(1), r.fulfill(status=200, content_type="application/json", body=json.dumps({"candidates": [{"content": {"parts": [{"text": "{}"}]}, "finishReason": "STOP"}]}))))
    pg = ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(U + "index.html"); pg.wait_for_timeout(5000)
    ev = lambda js: pg.evaluate(js)
    ids = ev("""async()=>{const db=await import('./js/db.js');const c=await import('./js/security-core.js');const core=await import('./js/core.js');
      await db.metaSet('sec_lock',{...(await c.hashSecret('482917')),idle_min:30,away_min:15});
      await db.metaSet('gemini_key','K');await db.metaSet('gemini_model','gemini-2.5-flash');await db.metaSet('gemini_consent',true);
      const k=await db.saveNew('customers',{name:'Kılıç Hafriyat',fuel_rules:[{id:'r1',per:75,unit:'Sefer',match:'',only_pay:true}]},'t');const y=await db.saveNew('customers',{name:'Kaya İnşaat'},'t');
      const v=(await db.listActive('vehicles'))[0];const m=await db.saveNew('personnel',{name:'Mahir Yılmaz'},'t');
      const dun=core.addDays(core.todayStr(),-1);
      const w1=await db.saveNew('work_records',{date:dun,customer_id:y.id,vehicle_id:v.id,personnel_id:m.id,work_type:'Kazı',quantity:3,unit:'Saat'},'t');
      const w2=await db.saveNew('work_records',{date:dun,customer_id:k.id,vehicle_id:v.id,personnel_id:m.id,work_type:'Yükleme',quantity:2,unit:'Saat'},'t');
      return {k:k.id,y:y.id,w1:w1.id,w2:w2.id,dun}}""")
    def unlock():
        if pg.query_selector("#lock-root [data-pw]"): pg.fill("#lock-root [data-pw]", PIN); pg.click("#lock-root [data-go-un]"); pg.wait_for_timeout(1200)
    snap = lambda: ev("async()=>{const db=await import('./js/db.js');const d=await db.dumpAll();return ['work_records','fuel_records','cash_records','attachments'].map(s=>(d[s]||[]).filter(x=>!x.deleted_at).map(x=>x.id+(x.updated_at||'')).sort().join()).join('|')}")
    pg.reload(); pg.wait_for_timeout(3000); unlock()
    s0 = snap()
    def say(t):
        pg.goto(U + "index.html#/akilli-asistan"); pg.wait_for_timeout(2000); unlock()
        pg.fill("[data-msg]", t); pg.click("[data-ask]"); pg.wait_for_timeout(1800)
    ctx.set_offline(True)
    say("Kılıç’ın kartını aç")
    check(f"#/musteriler/{ids['k']}" in pg.url, "internetsiz: 'Kılıç'ın kartını aç' müşteri kartını açtı")
    say("mazot hesabını göster")
    check(f"#/musteriler/{ids['k']}" in pg.url and pg.query_selector("[data-fuelpanel]") is not None, "bağlam: 'mazot hesabını göster' aynı müşterinin mazot hesabını açtı")
    say("Bu müşterinin ekstresini hazırla")
    check(f"#/cari/{ids['k']}" in pg.url, "bağlam: 'bu müşterinin ekstresi' → cari ekstre")
    pg.goto(U + "index.html#/akilli-asistan"); pg.wait_for_timeout(2000)
    check("Kılıç Hafriyat" in (pg.inner_text("[data-ctxchip]") if pg.query_selector("[data-ctxchip]") else ""), "asistanda bağlam görünüyor ve temizlenebilir")
    say("Kaya İnşaat kartını aç")
    check(f"#/musteriler/{ids['y']}" in pg.url, "yeni müşteri adı geçince eski bağlam taşınmadı")
    say("Bugünkü işleri göster")
    check("#/isler?from=" in pg.url, "bugünkü işler listesi açıldı")
    say("Eksik fiyatlı işleri bul")
    check("f=fiyatsiz" in pg.url, "eksik fiyatlı işler listesi açıldı")
    say("Yedekleme ekranını aç")
    check("tab=yedek" in pg.url, "yedek ekranı açıldı")
    say("Mahir Bey’in dünkü işindeki süreyi 2,5 saat olarak düzelt")
    items = ev("[...document.querySelectorAll('[data-work-choice]')].map(e=>e.dataset.workId)")
    check(sorted(items) == sorted([ids['w1'], ids['w2']]) and "Hangi işi değiştirelim?" in pg.inner_text("[data-out]"), f"iki aday listelendi, rastgele seçilmedi ({len(items)})")
    check(pg.query_selector('[data-work-confirm]') is None, "aday seçilmeden uygulama onayı üretilmedi")
    check(snap() == s0, "komutlar hiçbir kayıt değiştirmedi")
    check(len(CALLS) == 0, f"yerel komutlar Gemini'ye gitmedi ({len(CALLS)})")
    ctx.set_offline(False)
    # Bu kayda fiş fotoğrafı: son açılan kayıt
    pg.goto(U + f"index.html#/isler/{ids['w1']}"); pg.wait_for_timeout(2000); unlock()
    say("Bu kayda fiş fotoğrafı ekle")
    check(f"#/isler/{ids['w1']}" in pg.url and "foto=1" in pg.url, "'bu kayda fiş fotoğrafı ekle' son açılan işi açtı")
    for i in range(2):  # aynı fotoğraf iki kez → tek ek
        pg.set_input_files("[data-watt]", files=[{"name": "fis.png", "mimeType": "image/png", "buffer": PNG}]); pg.wait_for_timeout(2000)
    n_att = ev(f"async()=>(await (await import('./js/db.js')).attachmentsFor('work','{ids['w1']}')).length")
    check(n_att == 1, f"aynı fotoğrafın yeniden eklenmesi mükerrer ek oluşturmadı ({n_att})")
    # Kayıt içerikli mesaj Gemini'ye gider
    say("Kaya’dan 20 bin lira tahsil ettim")
    check(len(CALLS) == 1, "kayıt içerikli mesaj Gemini'ye gitti (yerel yönlendirici almadı)")
    check(not errs, f"sayfa hatası yok {errs[:2]}")
    b.close()
print("\nSONUÇ:", "BAŞARILI" if not FAIL else f"{len(FAIL)} SORUN")

raise SystemExit(bool(FAIL))
