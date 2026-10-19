# PR #122 birleşme öncesi kabul — gerçek ekran (TEST VERİSİ; taklit Gemini). Gerçek kayıt kullanılmaz.
# Tahsilat kimliği (tekrar / yeni ödeme / çakışma / iki sekme / aynı mesajda iki ödeme / WhatsApp satırı),
# tutarın sahibi (Kaya / Leda), fiyat listesi önizlemesi ve belirsiz kuralda seçim.
import json, sys
from playwright.sync_api import sync_playwright
U = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8841/"; PIN = "482917"
FAIL = []
def check(c, m):
    print(("  ✓ " if c else "  ✗ ") + m)
    if not c: FAIL.append(m)
with sync_playwright() as p:
    b = p.chromium.launch(); errs = []
    ctx = b.new_context(viewport={'width': 412, 'height': 900}); ctx.add_init_script("try{localStorage.setItem('sp_role','boss');localStorage.setItem('spx_role','boss')}catch(e){}")
    PLANS = []
    def gem(route):
        plan = PLANS.pop(0) if PLANS else {}
        route.fulfill(status=200, content_type="application/json", body=json.dumps({"candidates": [{"content": {"parts": [{"text": json.dumps(plan, ensure_ascii=False)}]}, "finishReason": "STOP"}]}, ensure_ascii=False))
    ctx.route("https://generativelanguage.googleapis.com/**", gem)
    pg = ctx.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(U + "index.html"); pg.wait_for_timeout(5000)
    ev = lambda js, page=None: (page or pg).evaluate(js)
    T = ev("(async()=>(await import('./js/ui.js')).todayStr())()")
    ids = ev("""async()=>{const db=await import('./js/db.js');const c=await import('./js/security-core.js');
      await db.metaSet('gemini_key','K');await db.metaSet('gemini_model','gemini-2.5-flash');await db.metaSet('gemini_consent',true);
      await db.metaSet('sec_lock',{...(await c.hashSecret('482917')),idle_min:30,away_min:15});
      const k=await db.saveNew('customers',{name:'Kaya İnşaat'},'t');const l=await db.saveNew('customers',{name:'Leda Yapı'},'t');const v=(await db.listActive('vehicles'))[0];
      await db.saveNew('price_book',{customer_id:k.id,site_id:null,vehicle_id:null,work_type:'Moloz Nakliye',unit:'Sefer',price:3200,kdv_rate:20,kdv_included:false,valid_from:'2026-01-01',valid_to:null,active:true},'t');
      // Leda: aynı öncelikte iki farklı kural (belirsiz) — sessizce seçilmemeli
      await db.saveNew('price_book',{customer_id:l.id,site_id:null,vehicle_id:null,work_type:'Moloz Nakliye',unit:'Sefer',price:2600,kdv_rate:20,kdv_included:false,valid_from:'2026-01-01',valid_to:null,active:true},'t');
      await db.saveNew('price_book',{customer_id:l.id,site_id:null,vehicle_id:null,work_type:'Moloz Nakliye',unit:'Sefer',price:2800,kdv_rate:20,kdv_included:false,valid_from:'2026-01-01',valid_to:null,active:true},'t');
      return {k:k.id,l:l.id,v:v.id,vn:v.name}}""")
    def unlock(page=None):
        page = page or pg
        if page.query_selector("#lock-root [data-pw]"): page.fill("#lock-root [data-pw]", PIN); page.click("#lock-root [data-go-un]"); page.wait_for_timeout(1200)
    pg.reload(); pg.wait_for_timeout(3000); unlock()
    cash = lambda: ev("""async()=>{const db=await import('./js/db.js');return (await db.listActive('cash_records')).map(x=>({id:x.id,c:x.customer_id,a:x.amount,rk:x.request_id,q:x.source_quote||'',ref:x.source_ref||'',rep:x.repeat_of||null,why:x.new_payment_reason||'',sim:x.similar_to||null}))}""")
    cari = lambda: ev("async()=>(await (await import('./js/db.js')).listActive('cari_movements')).length")
    def analyze(msg, plan, page=None):
        page = page or pg
        PLANS.append(json.loads(json.dumps(plan)))
        page.goto(U + "index.html#/akilli-asistan"); page.reload(); page.wait_for_timeout(2500); unlock(page)
        ev("(()=>{const r=document.querySelector('[data-refine]');if(r)r.checked=false})()", page)
        page.fill("[data-msg]", msg); page.click("[data-ask]"); page.wait_for_timeout(3000)
    def pick(kinds, page=None):  # yalnız verilen kart türleri (ve sırası) işaretli
        ev(f"""(()=>{{const want={json.dumps(kinds)};document.querySelectorAll('[data-out] .card[data-kind]').forEach((c,i)=>{{const p=c.querySelector('[data-pick]');if(p)p.checked=want.includes(c.dataset.kind+':'+c.dataset.i)||want.includes(c.dataset.kind)}})}})()""", page)
    def sheet_text(page=None):
        el = (page or pg).query_selector(".sheet"); return el.inner_text() if el else ""
    def answer(label, page=None, reason=None):
        page = page or pg
        if reason is not None: page.fill(".sheet [data-reason]", reason)
        btns = {x.inner_text().strip(): x for x in page.query_selector_all(".sheet button")}
        hit = next((v for k, v in btns.items() if k.startswith(label)), None)
        if hit: hit.click(); page.wait_for_timeout(1200)
        return bool(hit)
    def settle(label="Vazgeç", page=None):
        page = page or pg
        for _ in range(6):
            if not page.query_selector(".sheet"): break
            if not answer(label, page): answer("Vazgeç", page)
        page.wait_for_timeout(800)

    # ---- 3. Tutarın sahibi: Kaya fiyatı 3000, ödeme Leda'nın ----
    MSG = f"{ids['vn']} Kaya’ya 5 sefer moloz, seferi 3000; Leda’dan 20000 ödeme geldi."
    PLAN = {"works": [{"date": T, "date_source": "mesaj", "customer_id": ids["k"], "vehicle_id": ids["v"], "work_type": "Moloz Nakliye", "quantity": 5, "unit": "Sefer", "unit_price": 3000, "quote": f"{ids['vn']} Kaya’ya 5 sefer moloz, seferi 3000"}],
            "collections": [{"date": T, "customer_id": ids["k"], "amount": 20000, "method": "Nakit"}, {"date": T, "customer_id": ids["l"], "amount": 20000, "method": "Nakit"}]}
    c0, r0 = cash(), cari()
    analyze(MSG, PLAN)
    up = ev("document.querySelector('[data-kind=work] [name=unit_price]').value")
    outs = ev("[...document.querySelectorAll('[data-out] .card[data-kind=collection]')].map(c=>c.innerText)")
    picks = ev("[...document.querySelectorAll('[data-out] .card[data-kind]')].map(c=>c.dataset.kind+':'+c.querySelector('[data-pick]').checked)")
    check(up == "3000", f"Kaya işinin birim fiyatı 3000 ({up})")
    check("Leda Yapı ödemesi" in outs[0] and "kartta Kaya İnşaat seçili" in outs[0], "20.000 Kaya'ya tahsilat yazılmak istenince kartta uyarı var")
    check(picks == ["work:true", "collection:false", "collection:false"], f"iş işaretli, tahsilatlar işaretsiz ({picks})")
    pv = ev("document.querySelector('[data-kind=work] [data-price-preview]').innerText")
    check("3.000" in pv and "15.000" in pv, f"kayıttan önce fiyat görünüyor: {pv[:90]}")
    pick(["work", "collection:1"]); pg.click("[data-save]"); pg.wait_for_timeout(2500); settle()
    w = ev("""async()=>{const db=await import('./js/db.js');const w=(await db.listActive('work_records')).find(x=>Number(x.quantity)===5);return w&&[w.customer_id,w.price_snapshot.unit_price,w.price_snapshot.amount]}""")
    c1 = cash(); new = [x for x in c1 if x["id"] not in {y["id"] for y in c0}]
    check(w == [ids["k"], 3000, 15000], f"Kaya işi 5 × 3.000 = 15.000 ({w})")
    check(len(new) == 1 and new[0]["c"] == ids["l"] and new[0]["a"] == 20000, f"tek tahsilat: Leda 20.000 ({[(x['c'] == ids['l'], x['a']) for x in new]})")
    check(new and "Leda’dan 20000 ödeme geldi" in new[0]["q"] and new[0]["ref"] == "elle yapıştırılan mesaj", f"tahsilatta kaynak alıntı ve kaynak türü tutuluyor ({new[0]['q'] if new else ''})")
    first = new[0] if new else {}

    # ---- 2a. Aynı mesaj yeniden: 'tekrar mı yeni ödeme mi' açıkça soruluyor; Tekrar → yazılmaz ----
    analyze(MSG, PLAN); pick(["collection:1"]); pg.click("[data-save]"); pg.wait_for_timeout(1500)
    st = sheet_text()
    check("daha önce kaydedildi" in st and "Tekrar" in st and "Yeni ödeme" in st, "aynı mesaj yeniden kaydedilince tekrar / yeni ödeme seçimi açıkça soruluyor")
    answer("Tekrar"); settle()
    check(len(cash()) == len(c1), "Tekrar seçilince ikinci tahsilat yazılmadı")

    # ---- 2b. Aynı metin ama gerçekten yeni ödeme: gerekçe zorunlu, ilişki tutulur ----
    analyze(MSG, PLAN); pick(["collection:1"]); pg.click("[data-save]"); pg.wait_for_timeout(1500)
    answer("Yeni ödeme"); still = bool(pg.query_selector(".sheet")) and "gerekçe yazın" in sheet_text()
    check(still, "gerekçesiz 'yeni ödeme' kabul edilmiyor")
    answer("Yeni ödeme", reason="ikinci taksit (test)"); settle()
    c2 = cash(); add = [x for x in c2 if x["id"] not in {y["id"] for y in c1}]
    check(len(add) == 1 and add[0]["rep"] == first.get("id") and add[0]["why"] == "ikinci taksit (test)" and add[0]["rk"].endswith(":yeni:1"),
          f"yeni ödeme ayrı yazıldı; ilk kayda bağlı ve gerekçeli ({[(x['rep'] == first.get('id'), x['why'], x['rk'][-7:]) for x in add]})")

    # ---- 2c. Aynı kaynak, farklı tutar → çakışma ----
    analyze(MSG, PLAN); pick(["collection:1"])
    ev("(()=>{const i=document.querySelectorAll('[data-out] [data-kind=collection] [name=amount]')[1];i.value='21000';i.dispatchEvent(new Event('input'))})()")
    pg.click("[data-save]"); pg.wait_for_timeout(1800); settle()
    check(len(cash()) == len(c2), "aynı kaynak satırı farklı tutarla: çakışma, yazılmadı")

    # ---- 2d. Aynı mesajda aynı tutarda iki ödeme → ikisi de ----
    M2 = "Leda Yapı sabah 5.000 TL ödedi, akşam 5.000 TL daha ödedi"
    P2 = {"collections": [{"date": T, "customer_id": ids["l"], "amount": 5000, "method": "Nakit"}, {"date": T, "customer_id": ids["l"], "amount": 5000, "method": "Nakit"}]}
    analyze(M2, P2); pick(["collection"]); pg.click("[data-save]"); pg.wait_for_timeout(2000)
    # İkinci kartta "aynı gün aynı tutarda tahsilat var" sorulur (ilki az önce yazıldı) → kullanıcı "yeni ödeme" der
    if "aynı tutarda" in sheet_text(): answer("Yeni ödeme", reason="")
    settle()
    c3 = cash(); add = [x for x in c3 if x["id"] not in {y["id"] for y in c2}]
    check(len(add) == 2 and len({x["rk"] for x in add}) == 2, f"aynı mesajdaki iki 5.000 ödeme iki ayrı kayıt ({len(add)})")

    # ---- 2e. WhatsApp satırı: iki gerçek ödeme (ayrı saat) ikisi de; aynı dışa aktarım yeniden → kesin tekrar ----
    M3 = "12.10.2026 09:10 - Ali: Kaya İnşaat 7.500 TL ödedi\n12.10.2026 17:45 - Ali: Kaya İnşaat 7.500 TL ödedi"
    P3 = {"collections": [{"date": T, "customer_id": ids["k"], "amount": 7500, "method": "Nakit"}, {"date": T, "customer_id": ids["k"], "amount": 7500, "method": "Nakit"}]}
    analyze(M3, P3); pick(["collection"]); pg.click("[data-save]"); pg.wait_for_timeout(2000)
    if "aynı tutarda" in sheet_text(): answer("Yeni ödeme", reason="")
    settle()
    c4 = cash(); add = [x for x in c4 if x["id"] not in {y["id"] for y in c3}]
    check(len(add) == 2 and all(x["ref"].startswith("wa:12.10.2026") for x in add), f"WhatsApp'ta iki ayrı satırdaki eşit ödeme ikisi de yazıldı ({[x['ref'] for x in add]})")
    analyze(M3, P3); pick(["collection"]); pg.click("[data-save]"); pg.wait_for_timeout(2000)
    asked = bool(pg.query_selector(".sheet")); settle()
    check(len(cash()) == len(c4) and not asked, "aynı WhatsApp dışa aktarımı yeniden: soru sorulmadan kesin tekrar, yazılmadı")

    # ---- 2f. İki sekme aynı anda onay → tek tahsilat ----
    M4 = "Leda Yapı 4.250 TL ödedi"
    P4 = {"collections": [{"date": T, "customer_id": ids["l"], "amount": 4250, "method": "Nakit"}]}
    pg2 = ctx.new_page(); pg2.on("pageerror", lambda e: errs.append(str(e)))
    analyze(M4, P4, pg); analyze(M4, P4, pg2)
    pick(["collection"], pg); pick(["collection"], pg2)
    c5 = cash(); k5 = cari()
    ev("document.querySelector('[data-save]').click()", pg); ev("document.querySelector('[data-save]').click()", pg2)
    pg.wait_for_timeout(2500); settle("Tekrar", pg); settle("Tekrar", pg2)
    add = [x for x in cash() if x["id"] not in {y["id"] for y in c5}]
    check(len(add) == 1 and cari() == k5 + 1, f"iki sekmeden eşzamanlı onay: tek tahsilat, tek cari hareket (kasa +{len(add)}, cari +{cari() - k5})")
    pg2.close()

    # ---- 4. Fiyat listesi: belirsiz kural sessizce seçilmez ----
    M5 = f"{ids['vn']} Leda Yapı 3 sefer moloz"
    P5 = {"works": [{"date": T, "date_source": "mesaj", "customer_id": ids["l"], "vehicle_id": ids["v"], "work_type": "Moloz Nakliye", "quantity": 3, "unit": "Sefer", "quote": M5}]}
    analyze(M5, P5)
    pv = ev("document.querySelector('[data-kind=work] [data-price-preview]').innerText")
    check("Fiyat seçimi gerekli" in pv, f"eşit öncelikli iki kural: kartta seçim gerekli yazıyor ({pv[:70]})")
    pick(["work"]); pg.click("[data-save]"); pg.wait_for_timeout(1500)
    st = sheet_text()
    check("Hangi fiyat kuralı" in st and "2.600" in st and "2.800" in st, "kaydederken iki kural da gösterilip soruluyor")
    answer("2.800"); settle()
    w = ev("""async()=>{const db=await import('./js/db.js');const w=(await db.listActive('work_records')).find(x=>Number(x.quantity)===3);return w&&[w.price_snapshot?.unit_price,w.price_snapshot?.amount,w.price_snapshot?.price_choice||'']}""")
    check(w and w[0] == 2800 and w[1] == 8400 and "kullanıcı seçti" in w[2], f"seçilen kural uygulandı ve seçim kayda geçti ({w})")
    M6 = f"{ids['vn']} Kaya İnşaat 4 sefer moloz"
    P6 = {"works": [{"date": T, "date_source": "mesaj", "customer_id": ids["k"], "vehicle_id": ids["v"], "work_type": "Moloz Nakliye", "quantity": 4, "unit": "Sefer", "quote": M6}]}
    analyze(M6, P6)
    pv = ev("document.querySelector('[data-kind=work] [data-price-preview]').innerText")
    check(all(s in pv for s in ["Müşteriye Özel Fiyat", "İş tarihi " + T, "Birim 3.200", "KDV hariç %20", "4 × 3.200 = 12.800"]), f"mesajda fiyat yok → fiyat listesi önizlemesi: {pv[:160]}")
    ev("(()=>{const q=document.querySelector('[data-kind=work] [name=quantity]');q.value='6';q.dispatchEvent(new Event('input'))})()")
    pv2 = ev("document.querySelector('[data-kind=work] [data-price-preview]').innerText")
    check("6 × 3.200 = 19.200" in pv2, "kartta miktar değişince önizleme güncelleniyor")
    check(not errs, f"sayfa hatası yok {errs[:2]}")
    b.close()
print("\nSONUÇ:", "BAŞARILI" if not FAIL else f"{len(FAIL)} SORUN")
