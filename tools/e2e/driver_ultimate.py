"""Driver delivery recovery: synthetic records, native sharing mocked. No real messages."""
import sys, io, json
from PIL import Image
from playwright.sync_api import sync_playwright
U=sys.argv[1] if len(sys.argv)>1 else 'http://localhost:8841/'
checks=[]
def check(ok,msg):
    print(('PASS ' if ok else 'FAIL ')+msg,flush=True); checks.append((ok,msg))
def jpg():
    b=io.BytesIO(); Image.new('RGB',(500,700),'white').save(b,'JPEG'); return b.getvalue()
photo={'name':'receipt.jpg','mimeType':'image/jpeg','buffer':jpg()}
MOCK="""(()=>{window.__mode='ok';window.__shares=[];navigator.canShare=()=>window.__mode!=='unsupported';navigator.share=async d=>{if(window.__mode==='cancel')throw new DOMException('Canceled','AbortError');if(window.__mode==='fail')throw new Error('native share failed');window.__shares.push({text:d.text,count:(d.files||[]).length});await new Promise(r=>setTimeout(r,200));};const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(window.__quota&&k==='sp_driver_entries')throw new DOMException('Full','QuotaExceededError');return set.call(this,k,v)};const put=Cache.prototype.put;Cache.prototype.put=function(req,res){if(window.__photoFail)throw new DOMException('Cache full','QuotaExceededError');return put.call(this,req,res)};})()"""
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    ctx=b.new_context(viewport={'width':390,'height':844});ctx.add_init_script(MOCK)
    pg=ctx.new_page();errors=[];pg.on('pageerror',lambda e:errors.append(str(e)))
    pg.goto(U+'sofor.html');pg.wait_for_timeout(500)
    cfg=pg.evaluate("""async()=>{const c=await import('./js/driver-core.js');return await c.pack({v:1,p:['person','Test Şoför'],V:[['v','34TEST001']],veh:'v',C:[['c','Test Müşteri']],S:[],D:[],E:[],Q:[],iss:'2026-10-20',ts:1,co:'TEST'})}""")
    url=U+'sofor.html?k='+cfg
    pg.goto(url);pg.wait_for_selector('[data-cid]');pg.select_option('[data-cid]','c');pg.fill('[data-k=q]','3')
    pg.set_input_files('[data-photo]',photo);pg.wait_for_function("() => !document.querySelector('[data-add]').disabled")
    check(pg.locator('[data-phc] img').count()==1,'photo thumbnail and preparation complete')
    pg.reload();pg.wait_for_selector('[data-draftnote]')
    check('1/1 fotoğraf' in pg.inner_text('[data-draftnote]'),'draft photo survives reload')
    pg.evaluate('window.__quota=true');pg.click('[data-add]');pg.wait_for_timeout(600)
    check(pg.evaluate("JSON.parse(localStorage.getItem('sp_driver_entries')||'[]').length")==0 and pg.input_value('[data-k=q]')=='3','quota failure keeps form, no false saved record')
    pg.evaluate('window.__quota=false;window.__photoFail=true');pg.click('[data-add]');pg.wait_for_timeout(500)
    check(pg.evaluate("JSON.parse(localStorage.getItem('sp_driver_entries')||'[]').length")==0,'photo storage failure does not commit entry')
    pg.evaluate('window.__photoFail=false');pg.evaluate("document.querySelector('[data-add]').click();document.querySelector('[data-add]').click()")
    pg.wait_for_function("() => JSON.parse(localStorage.getItem('sp_driver_entries')||'[]').length===1")
    pg.wait_for_function("() => !document.querySelector('[data-add]').disabled")
    check(pg.evaluate("JSON.parse(localStorage.getItem('sp_driver_entries'))[0].ph")==1,'double tap saves one entry and its photo')
    check(pg.locator('#driver-pending .section-title').count()==1 and 'Gönderim merkezi' in pg.inner_text('#screen'),'date groups and delivery centre')
    for mode in ['cancel','fail','unsupported']:
        pg.evaluate('window.__mode='+json.dumps(mode));pg.click('[data-send]');pg.wait_for_timeout(700)
        check(not pg.evaluate("JSON.parse(localStorage.getItem('sp_driver_entries'))[0].sent||false"),mode+' leaves outbox pending')
    pg.evaluate("async()=>{const e=JSON.parse(localStorage.getItem('sp_driver_entries'))[0];await (await caches.open('sahapro-driver')).delete('./__drv/'+e.id+'-0');window.__mode='ok'}")
    pg.click('[data-send]');pg.wait_for_timeout(600)
    check(pg.evaluate('window.__shares.length')==0,'missing photo blocks sharing, never shifts photo order')
    pg.click('[data-viewphotos]');pg.wait_for_timeout(300)
    check('0/1 fotoğraf' in pg.inner_text('[data-photo-status]'),'missing photo diagnosis visible')
    pg.set_input_files('[data-repair]',photo);pg.wait_for_function("() => !document.querySelector('[data-add]').disabled")
    pg.click('[data-send]');pg.wait_for_timeout(900)
    check(pg.evaluate('window.__shares[0].count')==1 and pg.evaluate("!!JSON.parse(localStorage.getItem('sp_driver_entries'))[0].sent"),'repair restores complete native share')
    pg.click('[data-shared] > summary');pg.click('[data-sendone]');pg.wait_for_timeout(800)
    check(pg.evaluate('window.__shares[0].text===window.__shares[1].text'),'per-record retry preserves identical packet and entry ID')
    # Fuel has its own photo input, and imported work photo remains correctly positioned.
    pg.click('[data-tab=yakit]');pg.fill('[data-f=L]','20');pg.click('[data-src="Akaryakıt İstasyonu"]');pg.fill('[data-f=tl]','900')
    pg.set_input_files('[data-photo]',photo);pg.wait_for_function("() => !document.querySelector('[data-addf]').disabled")
    pg.evaluate("document.querySelector('[data-addf]').click();document.querySelector('[data-addf]').click()")
    pg.wait_for_function("() => JSON.parse(localStorage.getItem('sp_driver_entries')).length===2")
    check(pg.evaluate("JSON.parse(localStorage.getItem('sp_driver_entries'))[1].ph")==1,'fuel double tap saves one receipt-backed entry')
    # Concurrent write transactions in separate tabs must retain all records.
    pg2=ctx.new_page();pg2.goto(url);pg2.wait_for_selector('[data-vid]')
    pg.evaluate("()=>{window.__merge=(async()=>{const m=await import('./js/driver-delivery.js');const a=JSON.parse(localStorage.getItem('sp_driver_entries'));return m.commitEntries('sp_driver_entries',a,[...a,{id:'parallel-1',date:'2026-10-20',q:1,vid:'v',cid:'c',wt:'Hafriyat Nakliye',u:'Sefer'}])})()}")
    pg2.evaluate("async()=>{const m=await import('./js/driver-delivery.js');const a=JSON.parse(localStorage.getItem('sp_driver_entries'));await m.commitEntries('sp_driver_entries',a,[...a,{id:'parallel-2',date:'2026-10-20',q:1,vid:'v',cid:'c',wt:'Hafriyat Nakliye',u:'Sefer'}])}")
    pg.evaluate('window.__merge')
    check(pg.evaluate("JSON.parse(localStorage.getItem('sp_driver_entries')).length")==4,'two tabs retain both concurrent additions')
    pg2.close()
    # New identity must never relabel existing records.
    other=pg.evaluate("async()=>{const c=await import('./js/driver-core.js');const cfg=JSON.parse(localStorage.getItem('sp_driver_cfg'));cfg.p=['other','Başka Kişi'];cfg.ts=Date.now();return c.pack(cfg)}")
    pg.goto(U+'sofor.html?k='+other);pg.wait_for_timeout(700)
    check('başka şoförün kayıtları' in pg.inner_text('#screen') and pg.evaluate("JSON.parse(localStorage.getItem('sp_driver_cfg')).p[0]")=='person','cross-person link rejected without relabeling records')
    pg.goto(url);pg.wait_for_selector('[data-vid]')
    pg.evaluate("async()=>await navigator.serviceWorker.ready")
    if not pg.evaluate('!!navigator.serviceWorker.controller'):
        pg.reload();pg.wait_for_selector('[data-vid]')
    ctx.set_offline(True);pg.reload();pg.wait_for_selector('[data-vid]')
    check(pg.evaluate("JSON.parse(localStorage.getItem('sp_driver_entries')).length")==4 and pg.locator('[data-send]').count()==1,'real service worker offline reload preserves driver outbox and new helper module')
    ctx.set_offline(False)
    pg.evaluate("()=>{const c=JSON.parse(localStorage.getItem('sp_driver_cfg'));c.exp='2020-01-01';c.ts=Date.now();localStorage.setItem('sp_driver_cfg',JSON.stringify(c))}")
    pg.reload();pg.wait_for_selector('[data-send]');pg.click('[data-send]');pg.wait_for_timeout(400)
    check(pg.evaluate('window.__shares.length')==0 and 'Bağlantı süresi doldu' in pg.inner_text('#toast-root'),'expired link cannot open sharing')
    # A missing draft image cannot silently become a photo-less saved record.
    recovery=b.new_context(viewport={'width':390,'height':844});recovery.add_init_script(MOCK)
    rp=recovery.new_page();rp.on('pageerror',lambda e:errors.append(str(e)));rp.goto(url);rp.wait_for_selector('[data-cid]');rp.select_option('[data-cid]','c')
    rp.set_input_files('[data-photo]',photo);rp.wait_for_function("() => !document.querySelector('[data-add]').disabled")
    rp.evaluate("async()=>{const d=JSON.parse(localStorage.getItem('sp_driver_draft'));await(await caches.open('sahapro-driver')).delete('./__drv/'+d.photoId+'-0')}")
    rp.reload();rp.wait_for_selector('[data-forgetmissing]');rp.click('[data-add]');rp.wait_for_timeout(300)
    check(rp.evaluate("JSON.parse(localStorage.getItem('sp_driver_entries')||'[]').length")==0,'missing draft photo blocks commit until explicit decision')
    rp.set_input_files('[data-photo]',photo);rp.wait_for_function("() => !document.querySelector('[data-add]').disabled");rp.reload();rp.wait_for_selector('[data-forgetmissing]')
    check(rp.locator('[data-phc] img').count()==1,'replacement photo survives reload while missing-photo warning remains')
    rp.click('[data-forgetmissing]');rp.click('.sheet button[data-x="1"]');rp.wait_for_selector('[data-forgetmissing]',state='detached')
    rp.click('[data-add]');rp.wait_for_function("() => JSON.parse(localStorage.getItem('sp_driver_entries')||'[]').length===1")
    check(rp.evaluate("JSON.parse(localStorage.getItem('sp_driver_entries'))[0].ph")==1,'explicit recovery saves only visible confirmed photo')
    # Limit one share to 20 attachments; remaining rows stay pending.
    for _ in range(3):
        rp.select_option('[data-cid]','c');rp.set_input_files('[data-photo]',[dict(photo,name=f'proof-{i}.jpg') for i in range(10)])
        rp.wait_for_function("() => !document.querySelector('[data-add]').disabled");rp.click('[data-add]');rp.wait_for_function("() => !document.querySelector('[data-add]').disabled")
    rp.click('[data-send]');rp.wait_for_timeout(900)
    check(rp.evaluate('window.__shares[0].count')<=20 and rp.evaluate("JSON.parse(localStorage.getItem('sp_driver_entries')).some(e=>!e.sent)"),'large photo queue splits into bounded packets and retains remaining rows')
    recovery.close()
    pg.screenshot(path='/tmp/driver-v3928.png',full_page=True)
    check(not errors,'no uncaught browser errors: '+str(errors))
    b.close()
print(f'{sum(ok for ok,_ in checks)}/{len(checks)} PASS',flush=True)
raise SystemExit(any(not ok for ok,_ in checks))
