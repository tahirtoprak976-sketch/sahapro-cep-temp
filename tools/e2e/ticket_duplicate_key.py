"""Aynı döküm fişi farklı yazımla (A-133427 / A 133427) ikinci kez kaydedilebiliyor mu? Gerçek Chromium + IndexedDB, taklit Gemini, TEST verisi."""
import json, io, sys, uuid
from urllib.parse import urlparse
from PIL import Image
from playwright.sync_api import sync_playwright
U = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8841/').rstrip('/') + '/'
origin = urlparse(U)
assert origin.scheme == 'http' and origin.hostname in ('localhost', '127.0.0.1', '::1')
assert not origin.username and not origin.password and not origin.query and not origin.fragment
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width': 412, 'height': 900}, service_workers='block')
    ctx.add_init_script("localStorage.setItem('sp_role','boss')")
    pg = ctx.new_page(); errors = []; pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.on('dialog', lambda d: d.accept())
    app = U + 'index.html?db=tdup_' + uuid.uuid4().hex[:10]
    pg.goto(app + '#/'); pg.wait_for_timeout(1500)
    ids = pg.evaluate("""async()=>{const db=await import('./js/db.js');for(const [k,v] of Object.entries({gemini_key:'TEST',gemini_model:'gemini-2.5-flash',gemini_consent:true,gemini_daily_limit:100}))await db.metaSet(k,v);
      const v=await db.saveNew('vehicles',{name:'TEST kamyon',plate:'34TST627',type:'Kamyon'},'TEST');
      const c=await db.saveNew('customers',{name:'TEST Döküm Müşteri'},'TEST');
      const w=await db.saveNew('work_records',{date:'2026-09-05',customer_id:c.id,vehicle_id:v.id,work_type:'Hafriyat Nakliye',quantity:1,unit:'Sefer',slip_no:'A-133427'},'TEST');
      await db.saveNew('documents',{category:'Döküm Fişi',owner_type:'work',owner_id:w.id,date:'2026-09-05',doc_no:'A-133427',title:'Döküm fişi A-133427'},'TEST');
      return {v:v.id,c:c.id};}""")
    plan = {'tickets': [{'photo': 0, 'ticket_no': 'A 133427', 'date': '2026-09-07', 'plate': '34TST627', 'tonnage': 24.85,
                         'text': 'FIS A 133427 07.09.2026 34TST627 NET 24850 kg'}],
            'photo_texts': ['FIS A 133427 07.09.2026 34TST627 NET 24850 kg']}
    def gem(route):
        body = route.request.post_data_json or {}
        txt = json.dumps(body)
        res = {'slips': [{'photo': 0, 'text': 'FIS A 133427 07.09.2026 34TST627 NET 24850 kg', 'slip_no': 'A 133427', 'date': '2026-09-07', 'plate': '34TST627', 'net_ton': 24.85}]} if 'KANTAR, DÖKÜM' in txt else plan
        route.fulfill(status=200, content_type='application/json', body=json.dumps({'candidates': [{'content': {'parts': [{'text': json.dumps(res)}]}, 'finishReason': 'STOP'}]}))
    pg.route('https://generativelanguage.googleapis.com/**', gem)
    pg.goto(app + '#/akilli-asistan')
    pg.wait_for_function("()=>document.querySelector('[data-new-chat]')&&!document.querySelector('[data-new-chat]').disabled")
    buf = io.BytesIO(); Image.new('RGB', (80, 100), 'white').save(buf, format='PNG')
    pg.locator('[data-photos]').set_input_files([{'name': 'TEST-0.png', 'mimeType': 'image/png', 'buffer': buf.getvalue()}])
    pg.fill('[data-msg]', 'Bu kantar fişini kaydet')
    pg.click('[data-ask]'); pg.wait_for_selector('[data-kind=ticket]', timeout=60000)
    card = pg.locator('[data-kind=ticket]').first
    warn = card.inner_text()
    shown_dup = 'zaten kayıtlı' in warn
    print('Önizleme uyarısı "zaten kayıtlı":', shown_dup)
    assert shown_dup and not card.locator('[data-pick]').is_checked(), warn
    # Kullanıcı uyarıya rağmen kartı işaretler, yeni iş için müşteriyi seçer ve kaydeder
    card.locator('[name=customer]').select_option(ids['c'])
    card.locator('[name=link]').select_option('new')
    pk = card.locator('[data-pick]')
    if not pk.is_checked(): pk.check()
    pg.click('[data-save]')
    pg.locator('[data-out]').get_by_text('Kaydedildi:', exact=False).wait_for()
    counts = pg.evaluate("""async()=>{const d=await import('./js/db.js');const docs=(await d.listActive('documents')).filter(x=>x.category==='Döküm Fişi');const works=await d.listActive('work_records');return {docs:docs.map(x=>x.doc_no),works:works.length}}""")
    print('Kayıt sonrası:', counts, 'sayfa hataları:', errors)
    dup = len(counts['docs']) > 1 or counts['works'] > 1
    print('SONUÇ:', 'MÜKERRER KAYIT OLUŞTU' if dup else 'mükerrer engellendi')
    assert counts == {'docs': ['A-133427'], 'works': 1} and not errors, (counts, errors)
    b.close()
    sys.exit(3 if dup else 0)
