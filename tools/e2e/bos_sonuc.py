# Gemini boş döndüğünde: "bulunamadı" yerine yerel okumanın gördüğü satırlar; formlar dolu açılır, eksikler seçtirilir. TEST VERİSİ.
import sys, json
from playwright.sync_api import sync_playwright
U = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8846/"; PIN = "482917"
FAIL = []
def check(c, m):
    print(("  ✓ " if c else "  ✗ ") + m)
    if not c: FAIL.append(m)
MSG = "[05.09.2026 15:44] Tahir Toprak: (medya dışa aktarılmamış)\n[05.09.2026 17:06] Niyazi Abi: Eski kato kemer mustafa bey yıkım yapıldı. 160lt mazot alındı\nşantiyeden"
with sync_playwright() as p:
    b = p.chromium.launch(); errs = []
    ctx = b.new_context(viewport={'width': 360, 'height': 780}); ctx.add_init_script("try{localStorage.setItem('sp_role','boss');localStorage.setItem('spx_role','boss')}catch(e){}")
    BODIES = []
    def gem(route):
        BODIES.append(route.request.post_data or "")
        route.fulfill(status=200, content_type="application/json", body=json.dumps({"candidates": [{"content": {"parts": [{"text": "{}"}]}, "finishReason": "STOP"}]}))
    ctx.route("https://generativelanguage.googleapis.com/**", gem)
    pg = ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(U + "index.html"); pg.wait_for_timeout(5000)
    ev = lambda js: pg.evaluate(js)
    ids = ev("""async()=>{const db=await import('./js/db.js');const c=await import('./js/security-core.js');
      await db.metaSet('sec_lock',{...(await c.hashSecret('482917')),idle_min:30,away_min:15});
      await db.metaSet('gemini_key','K');await db.metaSet('gemini_model','gemini-2.5-flash');await db.metaSet('gemini_consent',true);
      const m=await db.saveNew('customers',{name:'Mustafa Bey'},'t');const s=await db.saveNew('sites',{name:'Eski Kato Kemer',customer_id:m.id},'t');
      return {m:m.id,s:s.id}}""")
    def unlock():
        if pg.query_selector("#lock-root [data-pw]"): pg.fill("#lock-root [data-pw]", PIN); pg.click("#lock-root [data-go-un]"); pg.wait_for_timeout(1200)
    cnt = lambda: ev("async()=>{const db=await import('./js/db.js');const d=await db.dumpAll();return ['work_records','fuel_records','cash_records'].map(s=>(d[s]||[]).filter(x=>!x.deleted_at).length).join(',')}")
    pg.reload(); pg.wait_for_timeout(3000); unlock()
    c0 = cnt()
    def send(text):
        pg.goto(U + "index.html#/akilli-asistan"); pg.wait_for_timeout(2500); unlock()
        pg.fill("[data-msg]", text); pg.click("[data-ask]"); pg.wait_for_timeout(3000)
    send(MSG)
    fb = pg.query_selector("[data-fallback]")
    t = fb.inner_text() if fb else pg.inner_text("[data-out]")
    check(fb is not None and "Gemini bu mesajdan kayıt çıkarmadı (0 satır döndü)" in t, "boş Gemini yanıtı açıkça söyleniyor (0 satır)")
    check("Mustafa Bey · Eski Kato Kemer · Yıkım" in t and "05.09.2026" in t and "miktar" in t, "yerel okuma yıkım işini (tarih, müşteri, şantiye) ve eksik miktarı gösteriyor")
    check("160 L yakıt" in t and "hangi araca" in t and "doğrulayın" in t, "160 L yakıt satırı, eksik araç ve kaynak doğrulama notuyla")
    check("Kaydedilecek bir şey bulunamadı" not in t and cnt() == c0, "kayıt yazılmadı, 'bulunamadı' denmedi")
    # Önceki sonuç varken aynı WhatsApp dışa aktarımı yeniden: düzeltme sayılmaz (yeni mesaj)
    n0 = len(BODIES)
    pg.fill("[data-msg]", MSG + "\n[05.09.2026 18:00] Niyazi Abi: tamam"); pg.check("[data-refine]") if pg.query_selector("[data-refine]") else None
    pg.click("[data-ask]"); pg.wait_for_timeout(3000)
    check(len(BODIES) == n0 + 1 and "[DÜZELTME]" not in BODIES[-1], "WhatsApp biçimli yeni metin, düzeltme kutusu işaretliyken de yeni mesaj olarak gitti")
    # İş formu dolu açılır
    pg.click("[data-fb-work='0']"); pg.wait_for_timeout(2500)
    vals = ev("(()=>{const f=n=>(document.querySelector(`[name=${n}]`)||{}).value;return [f('date'),f('customer_id'),f('site_id'),f('work_type'),f('quantity')]})()")
    check(vals[0] == "2026-09-05" and vals[1] == ids["m"] and vals[2] == ids["s"] and vals[3] == "Yıkım" and vals[4] in ("", None), f"iş formu tarih, müşteri, şantiye, iş türü dolu; miktar boş ({vals})")
    # Yakıt formu: litre ve tarih dolu, kaynak seçtirilir
    send(MSG)
    pg.click("[data-fb-fuel='0']"); pg.wait_for_timeout(2500)
    fv = ev("(()=>{const f=n=>(document.querySelector(`[data-form] [name=${n}]`)||{}).value;return [f('liters'),f('date'),f('fuel_source')]})()")
    check(fv == ["160", "2026-09-05", ""], f"yakıt formu: 160 L, tarih dolu, kaynak boş ({fv})")
    vid = ev("(document.querySelector('[data-form] [name=vehicle_id] option:nth-child(2)')||{}).value")
    pg.select_option("[data-form] [name=vehicle_id]", vid); pg.click("[data-save]"); pg.wait_for_timeout(1500)
    check(cnt() == c0, "kaynak seçilmeden yakıt kaydedilmedi")
    pg.select_option("[data-form] [name=fuel_source]", "Müşteri Verdi"); pg.wait_for_timeout(300)
    opts = ev("[...document.querySelectorAll('[data-fcust] select option')].map(o=>o.textContent)")
    check("Mustafa Bey" in opts, f"mesajdaki müşteri, mazot kuralı olmasa da listede seçilebilir ({opts})")
    check(not errs, f"sayfa hatası yok {errs[:2]}")
    b.close()
print("\nSONUÇ:", "BAŞARILI" if not FAIL else f"{len(FAIL)} SORUN")
