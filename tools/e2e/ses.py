# Paket 6 — ses: ilk ses kaydında veri aktarımı açıklaması ve onay, sesli okuma yalnız dokununca, duyulan komut önerisi (dokunmadan açılmaz). TEST VERİSİ.
import sys, json, io, wave
from playwright.sync_api import sync_playwright
U = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8846/"; PIN = "482917"
FAIL = []
def check(c, m):
    print(("  ✓ " if c else "  ✗ ") + m)
    if not c: FAIL.append(m)
def wav():
    b = io.BytesIO(); w = wave.open(b, "wb"); w.setnchannels(1); w.setsampwidth(2); w.setframerate(8000); w.writeframes(b"\x00\x01" * 8000); w.close(); return b.getvalue()
SPEECH_MOCK = """(() => { window.__spoken = []; const S = { cancel(){}, speak(u){ window.__spoken.push(u.text); setTimeout(()=>u.onend&&u.onend(), 50); } };
  Object.defineProperty(window, 'speechSynthesis', { value: S, configurable: true }); window.SpeechSynthesisUtterance = function(t){ this.text = t; }; })();"""
with sync_playwright() as p:
    b = p.chromium.launch(args=["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"]); errs = []
    ctx = b.new_context(viewport={'width': 360, 'height': 780}); ctx.add_init_script("try{localStorage.setItem('sp_role','boss');localStorage.setItem('spx_role','boss')}catch(e){}"); ctx.add_init_script(SPEECH_MOCK)
    ctx.grant_permissions(["microphone"])
    PLANS = []
    ctx.route("https://generativelanguage.googleapis.com/**", lambda r: r.fulfill(status=200, content_type="application/json", body=json.dumps({"candidates": [{"content": {"parts": [{"text": json.dumps(PLANS.pop(0) if PLANS else {}, ensure_ascii=False)}]}, "finishReason": "STOP"}]}, ensure_ascii=False)))
    pg = ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(U + "index.html"); pg.wait_for_timeout(5000)
    ev = lambda js: pg.evaluate(js)
    ids = ev("""async()=>{const db=await import('./js/db.js');const c=await import('./js/security-core.js');
      await db.metaSet('sec_lock',{...(await c.hashSecret('482917')),idle_min:30,away_min:15});
      await db.metaSet('gemini_key','K');await db.metaSet('gemini_model','gemini-2.5-flash');await db.metaSet('gemini_consent',true);
      const k=await db.saveNew('customers',{name:'Kılıç Hafriyat',fuel_rules:[{id:'r1',per:75,unit:'Sefer',match:'',only_pay:true}]},'t');return {k:k.id}}""")
    def unlock():
        if pg.query_selector("#lock-root [data-pw]"): pg.fill("#lock-root [data-pw]", PIN); pg.click("#lock-root [data-go-un]"); pg.wait_for_timeout(1200)
    pg.reload(); pg.wait_for_timeout(3000); unlock()
    pg.goto(U + "index.html#/akilli-asistan"); pg.wait_for_timeout(2500); unlock()
    pg.click("[data-rec]"); pg.wait_for_timeout(800)
    st = pg.inner_text(".sheet") if pg.query_selector(".sheet") else ""
    check("Google Gemini'ye gönderilir" in st and "onaylamadan kayıt yazılmaz" in st, "ilk ses kaydında veri aktarımı açıkça yazıyor")
    pg.click(".sheet button[data-x='0']"); pg.wait_for_timeout(600)
    check("Durdur" not in pg.inner_text("[data-rec]") and not ev("async()=>(await (await import('./js/db.js')).metaGet('voice_notice_ok'))"), "Vazgeç → kayıt başlamadı")
    pg.click("[data-rec]"); pg.wait_for_timeout(600); pg.click(".sheet button[data-x='1']"); pg.wait_for_timeout(1500)
    rec_on = pg.inner_text("[data-rec]")
    check(rec_on != "🎤 Sesli not kaydet" and bool(ev("async()=>(await (await import('./js/db.js')).metaGet('voice_notice_ok'))")), f"onaydan sonra kayıt başladı ({rec_on[:30]})")
    pg.click("[data-rec]"); pg.wait_for_timeout(1500)
    pg.click("[data-rec]"); pg.wait_for_timeout(600)
    check(not pg.query_selector(".sheet"), "ikinci kayıtta açıklama tekrar sorulmuyor")
    pg.click("[data-rec]"); pg.wait_for_timeout(800)
    # Duyulan komut: dokunmadan açılmaz
    pg.goto(U + "index.html#/akilli-asistan"); pg.reload(); pg.wait_for_timeout(2500); unlock()
    PLANS.append({"heard_text": "Kılıç'ın kartını aç"})
    pg.set_input_files("[data-photos]", files=[{"name": "ses.wav", "mimeType": "audio/wav", "buffer": wav()}]); pg.wait_for_timeout(500)
    pg.click("[data-ask]"); pg.wait_for_timeout(3500)
    out = pg.inner_text("[data-out]")
    check("Bunu mu demek istediniz?" in out and "akilli-asistan" in pg.url, "duyulan komut öneri olarak geldi; kendiliğinden açılmadı")
    pg.click(f"[data-out] [data-go='#/musteriler/{ids['k']}']"); pg.wait_for_timeout(2000)
    check(f"#/musteriler/{ids['k']}" in pg.url, "öneriye dokununca müşteri kartı açıldı")
    # Sesli okuma yalnız dokununca
    pg.goto(U + "index.html#/akilli-asistan"); pg.wait_for_timeout(2000)
    pg.fill("[data-msg]", "Kılıç’tan kaç litre mazot alacağım kaldı?"); pg.click("[data-ask]"); pg.wait_for_timeout(1500)
    check(ev("window.__spoken.length") == 0, "cevap kendiliğinden sesli okunmadı")
    pg.click("[data-answer] [data-speak]"); pg.wait_for_timeout(400)
    sp = ev("window.__spoken")
    check(len(sp) == 1 and "mazot" in sp[0], f"'🔊 Sesli oku'ya dokununca okundu ({sp[:1]})")
    check(not errs, f"sayfa hatası yok {errs[:2]}")
    b.close()
print("\nSONUÇ:", "BAŞARILI" if not FAIL else f"{len(FAIL)} SORUN")
