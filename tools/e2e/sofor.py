# Paket 5 — şoför / personel: yarım form taslağı, fotoğraf hazırlama ve sınırlar, çift basma, dürüst paylaşım durumu,
# tekrar paylaşımda aynı kimlik (patronda tek kayıt), geçersiz paket reddi. TEST VERİSİ; gerçek WhatsApp yok (paylaşım taklit).
import sys, json, io
from playwright.sync_api import sync_playwright
from PIL import Image
U = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8841/"; PIN = "482917"
FAIL = []
def check(c, m):
    print(("  ✓ " if c else "  ✗ ") + m)
    if not c: FAIL.append(m)
SHARE_MOCK = """(() => { const toB64 = (f) => new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(String(fr.result).split(',')[1]); fr.readAsDataURL(f); });
  navigator.canShare = () => true;
  navigator.share = async (d) => { const files = []; for (const f of d.files || []) files.push({ name: f.name, type: f.type, b64: await toB64(f) });
    (window.__shares ||= []).push({ text: d.text, files }); }; })();"""
def jpg(w=800, h=1000):
    b = io.BytesIO(); Image.new("RGB", (w, h), (240, 240, 240)).save(b, "JPEG"); return b.getvalue()
with sync_playwright() as p:
    b = p.chromium.launch(); errs = []
    boss = b.new_context(viewport={'width': 390, 'height': 844}); boss.add_init_script("try{localStorage.setItem('sp_role','boss')}catch(e){}")
    boss.grant_permissions(["clipboard-read", "clipboard-write"], origin=U.rstrip("/"))
    pg = boss.new_page(); pg.on("pageerror", lambda e: errs.append("BOSS " + str(e)))
    pg.goto(U + "index.html"); pg.wait_for_timeout(5000)
    ids = pg.evaluate("""async()=>{const db=await import('./js/db.js');const c=await import('./js/security-core.js');
      await db.metaSet('sec_lock',{...(await c.hashSecret('482917')),idle_min:30,away_min:15});
      const k=await db.saveNew('customers',{name:'Kaya Test'},'t');const ps=await db.listActive('personnel');const vs=await db.listActive('vehicles');
      await db.saveExisting('vehicles',vs[0],{assignee_id:ps[0].id},'t');
      return {k:k.id,pid:ps[0].id,pn:ps[0].name,vid:vs[0].id}}""")
    def unlock(page):
        if page.query_selector("#lock-root [data-pw]"): page.fill("#lock-root [data-pw]", PIN); page.click("#lock-root [data-go-un]"); page.wait_for_timeout(1200)
    pg.reload(); pg.wait_for_timeout(3000); unlock(pg)
    pg.goto(U + "index.html#/sofor-kur?pid=" + ids["pid"]); pg.reload(); pg.wait_for_timeout(2500); unlock(pg)
    pg.click("[data-copy]"); pg.wait_for_selector("#lock-root [data-pw]"); pg.fill("#lock-root [data-pw]", PIN); pg.click("#lock-root [data-go-un]"); pg.wait_for_timeout(1500)
    url = pg.evaluate("navigator.clipboard.readText()")
    dc = b.new_context(viewport={'width': 390, 'height': 844}); dc.add_init_script(SHARE_MOCK)
    dp = dc.new_page(); dp.on("pageerror", lambda e: errs.append("DRV " + str(e)))
    dp.goto(url); dp.wait_for_timeout(3500)
    check("şoför ekranı" in dp.inner_text("#screen").lower(), "şoför ekranı açıldı")
    # 1) Yarım form + fotoğraf → uygulama kapanıp açılıyor → taslak geri geliyor
    dp.select_option("[data-cid]", ids["k"]); dp.wait_for_timeout(300)
    dp.fill("[data-k=q]", "4"); dp.fill("[data-k=slip]", "F-778"); dp.fill("[data-k=note]", "taslak notu")
    dp.wait_for_timeout(900)
    check("10 fotoğraf" in dp.inner_text("#screen") and "MB" in dp.inner_text("#screen"), "fotoğraf sınırları işlem başlamadan yazıyor")
    dp.set_input_files("[data-photo]", files=[{"name": "fis1.jpg", "mimeType": "image/jpeg", "buffer": jpg()}, {"name": "belge.pdf", "mimeType": "application/pdf", "buffer": b"%PDF-1.4"}])
    dp.wait_for_timeout(2000)
    ph = dp.inner_text("[data-phc]")
    check("1 fotoğraf hazır" in ph and "belge.pdf: fotoğraf değil" in ph, f"fotoğraf hazırlandı; desteklenmeyen dosya anlaşılır hatayla ayrıldı ({ph[:90]})")
    dp.wait_for_timeout(800)
    dp.goto("about:blank"); dp.wait_for_timeout(300); dp.goto(url.split("#")[0] + "#/sofor"); dp.wait_for_timeout(3500)
    note = dp.inner_text("[data-draftnote]") if dp.query_selector("[data-draftnote]") else ""
    vals = dp.evaluate("[document.querySelector('[data-k=q]')?.value, document.querySelector('[data-k=slip]')?.value, document.querySelector('[data-k=note]')?.value, document.querySelector('[data-cid]')?.value]")
    check("Yarım kalan form geri yüklendi" in note and "1/1 fotoğraf" in note and vals == ["4", "F-778", "taslak notu", ids["k"]], f"uygulama kapanıp açılınca taslak ve fotoğraf geri geldi ({vals}; {note[:60]})")
    # 2) Fotoğraf kaldırma
    dp.set_input_files("[data-photo]", files=[{"name": "fis2.jpg", "mimeType": "image/jpeg", "buffer": jpg(600, 900)}]); dp.wait_for_timeout(1500)
    dp.click("[data-phrm='1']"); dp.wait_for_timeout(600)
    check("1 fotoğraf hazır" in dp.inner_text("[data-phc]"), "fotoğraf önizlemeden kaldırılabildi")
    # 3) Çift basma → tek kayıt
    dp.evaluate("(()=>{const b=document.querySelector('[data-add]');b.click();b.click();})()"); dp.wait_for_timeout(2000)
    n = dp.evaluate("JSON.parse(localStorage.getItem('sp_driver_entries')||'[]').length")
    check(n == 1, f"kaydet'e iki kez basmak tek kayıt oluşturdu ({n})")
    t = " ".join(dp.evaluate("[...document.querySelectorAll('.toast')].map(t=>t.textContent)"))
    check("patrona henüz gitmedi" in t and not dp.query_selector("[data-draftnote]") and not dp.evaluate("localStorage.getItem('sp_driver_draft')"), "kayıt sonrası durum dürüst ('telefonda kaydedildi'), taslak temizlendi")
    check("henüz paylaşılmadı (1)" in dp.evaluate("document.querySelector('#screen').textContent"), "'telefonda bekleyen — henüz paylaşılmadı' bölümü")
    # 4) Paylaş: dürüst durum, fotoğraflar tekrar paylaşım için kalır
    dp.click("[data-send]"); dp.wait_for_selector("[data-driver-share-go]"); dp.click("[data-driver-share-go]"); dp.wait_for_timeout(1200)
    t = " ".join(dp.evaluate("[...document.querySelectorAll('.toast')].map(t=>t.textContent)")); dp.wait_for_timeout(1500)
    sh1 = dp.evaluate("(window.__shares||[]).at(-1)")
    check("Paylaşım ekranı açıldı" in t and "Gönderildi ✓" not in t, "paylaşım sonrası 'gönderildi' denmiyor; 'paylaşım ekranı açıldı'")
    check("doğrulanamaz" in dp.inner_text("#screen"), "paylaşılanlar 'patronun aldığı doğrulanamaz' notuyla")
    dp.click("details summary") if dp.query_selector("details summary") else None
    dp.click("[data-resend]"); dp.wait_for_selector("[data-driver-share-go]"); dp.click("[data-driver-share-go]"); dp.wait_for_timeout(3000)
    sh2 = dp.evaluate("(window.__shares||[]).at(-1)")
    check(sh1 and sh2 and len(sh2["files"]) == len(sh1["files"]) == 1, f"tekrar paylaşımda fotoğraf hâlâ var ({len(sh1['files']) if sh1 else 0} → {len(sh2['files']) if sh2 else 0})")
    # 5) Patron aynı paketi iki kez içe alır → tek kayıt
    import re
    def boss_take(share):
        pg.goto(U + "index.html#/akilli-asistan"); pg.reload(); pg.wait_for_timeout(2500); unlock(pg)
        pg.evaluate("(()=>{const r=document.querySelector('[data-refine]');if(r)r.checked=false})()")
        pg.fill("[data-msg]", share["text"])
        if share["files"]:
            import base64
            pg.set_input_files("[data-photos]", files=[{"name": f["name"], "mimeType": f["type"], "buffer": base64.b64decode(f["b64"])} for f in share["files"]])
        pg.click("[data-ask]"); pg.wait_for_timeout(3500)
        if pg.query_selector("[data-save]"): pg.click("[data-save]"); pg.wait_for_timeout(3000)
        for _ in range(4):
            if not pg.query_selector(".sheet"): break
            pg.query_selector_all(".sheet button")[0].click(); pg.wait_for_timeout(800)
        return pg.evaluate("async()=>(await (await import('./js/db.js')).listActive('work_records')).filter(w=>w.driver_entry_id).length")
    w1 = boss_take(sh1); w2 = boss_take(sh2)
    check(w1 == 1 and w2 == 1, f"patron aynı bildirimi iki kez içe aldı → tek iş ({w1}, {w2})")
    att = pg.evaluate("async()=>{const db=await import('./js/db.js');const w=(await db.listActive('work_records')).find(w=>w.driver_entry_id);return w?(await db.attachmentsFor('work',w.id)).length:-1}")
    check(att == 1, f"fotoğraf doğru işe tek kez eklendi ({att})")
    # 6) Değiştirilmiş paket reddedilir; geçerli bağlantı çalışmaya devam eder
    bad = re.sub(r"SP1:([A-Za-z0-9_-]{10})", lambda m: "SP1:" + ("A" if m.group(1)[0] != "A" else "B") + m.group(1)[1:], sh1["text"], count=1)
    pg.goto(U + "index.html#/akilli-asistan"); pg.reload(); pg.wait_for_timeout(2500); unlock(pg)
    pg.fill("[data-msg]", bad); pg.click("[data-ask]"); pg.wait_for_timeout(3000)
    out = (pg.inner_text(".sheet") if pg.query_selector(".sheet") else "") + pg.inner_text("[data-out]")
    if pg.query_selector(".sheet"): pg.click(".sheet button[data-x='0']"); pg.wait_for_timeout(1500)
    out += pg.inner_text("[data-out]")
    n_after = pg.evaluate("async()=>(await (await import('./js/db.js')).listActive('work_records')).length")
    check(n_after == w2 and ("redd" in out.lower() or "kod" in out.lower() or "açılam" in out.lower() or "kesil" in out.lower()), f"değiştirilmiş paketten kayıt oluşmadı ({out[:80]})")
    dp.goto(url.split("#")[0] + "#/sofor"); dp.wait_for_timeout(2500)
    check("şoför ekranı" in dp.inner_text("#screen").lower(), "geçerli şoför bağlantısı çalışmaya devam ediyor")
    check(not errs, f"sayfa hatası yok {errs[:2]}")
    b.close()
print("\nSONUÇ:", "BAŞARILI" if not FAIL else f"{len(FAIL)} SORUN")

raise SystemExit(bool(FAIL))
