"""Prepared delivery journey. Real IDB/cache, synthetic records; all sharing mocked."""
import io,json
from PIL import Image
from playwright.sync_api import sync_playwright
U='http://localhost:8841/'
f=io.BytesIO();Image.new('RGB',(500,700),'white').save(f,'JPEG');photo={'name':'receipt.jpg','mimeType':'image/jpeg','buffer':f.getvalue()}
MOCK="""(()=>{window.__shares=[];window.__mode='ok';navigator.canShare=()=>true;navigator.share=d=>{if(window.event?.type!=='click'||!window.event.target.matches('[data-driver-share-go]'))throw Error('share lost original click');if(window.__mode==='cancel')return Promise.reject(new DOMException('cancel','AbortError'));if(window.__mode==='fail')return Promise.reject(Error('native failure'));window.__shares.push({text:d.text,files:d.files?.length||0});return Promise.resolve();};})()"""
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);c=b.new_context(viewport={'width':360,'height':800});c.add_init_script(MOCK)
 pg=c.new_page();errors=[];pg.on('pageerror',lambda e:errors.append(str(e)));pg.goto(U+'sofor.html');pg.wait_for_timeout(600)
 code=pg.evaluate("async()=>await(await import('./js/driver-core.js')).pack({v:1,p:['p','TEST Şoför'],V:[['v','34TEST001']],veh:'v',C:[['c','TEST Müşteri']],S:[],D:[],E:[],Q:[],ts:1})")
 url=U+'sofor.html?k='+code;pg.goto(url);pg.wait_for_selector('[data-cid]');pg.select_option('[data-cid]','c');pg.fill('[data-k=q]','4');pg.set_input_files('[data-photo]',photo);pg.wait_for_function("() => !document.querySelector('[data-add]').disabled");pg.click('[data-add]');pg.wait_for_selector('[data-save-result]')
 assert 'henüz paylaşılmadı' in pg.inner_text('[data-save-result]')
 def pending():return pg.evaluate("!JSON.parse(localStorage.getItem('sp_driver_entries'))[0].sent")
 def prepare(selector='[data-send]'):
  pg.click(selector);pg.wait_for_selector('[data-driver-share-go]',state='attached');assert not pg.locator('[data-driver-share-go]').is_disabled()
 prepare('[data-review-saved]');assert pg.evaluate('window.__shares.length')==0 and pending()
 assert '1 kayıt · 1 fotoğraf · 1 paket' in pg.inner_text('[data-driver-share]');assert pg.locator('[data-driver-share] img').count()==1
 assert pg.locator('#screen').evaluate('(e)=>e.inert')
 assert pg.evaluate("async()=>(await import('./js/update-safety.js')).updateRisk(null).busy")
 assert pg.locator('[data-driver-share] .driver-share-panel').evaluate('(e)=>e.scrollWidth<=e.clientWidth')
 pg.click('[data-driver-share-cancel]');pg.wait_for_function("() => !document.querySelector('[data-driver-share]')");assert pending() and pg.evaluate('window.__shares.length')==0
 assert not pg.evaluate("async()=>(await import('./js/update-safety.js')).updateRisk(null).busy")
 print('PASS save result, explicit preparation, photo preview, mobile sizing, background lock, cancel without sending',flush=True)
 prepare();pg.evaluate("window.__mode='cancel'");pg.locator('[data-driver-share-go]').evaluate('(e)=>e.closest("details").open=true');pg.click('[data-driver-share-go]');pg.wait_for_function("() => document.querySelector('[data-driver-share-status]').textContent.includes('iptal')");assert pending()
 pg.evaluate("window.__mode='fail'");pg.locator('[data-driver-share-go]').evaluate('(e)=>e.closest("details").open=true');pg.click('[data-driver-share-go]');pg.wait_for_function("() => document.querySelector('[data-driver-share-status]').textContent.includes('native failure')");assert pending()
 pg.evaluate("window.__mode='ok'");pg.locator('[data-driver-share-go]').evaluate('(e)=>e.closest("details").open=true');pg.click('[data-driver-share-go]');pg.wait_for_function("() => !!JSON.parse(localStorage.getItem('sp_driver_entries'))[0].sent");assert pg.evaluate('window.__shares.length')==1
 first=pg.evaluate('window.__shares[0]');pg.click('[data-shared]>summary');prepare('[data-sendone]');pg.locator('[data-driver-share-go]').evaluate('(e)=>e.closest("details").open=true');pg.click('[data-driver-share-go]');pg.wait_for_function("() => !document.querySelector('[data-driver-share]')");assert pg.evaluate('window.__shares[1]')==first
 print('PASS cancel/failure retain prepared packet; direct click retry works; successful retry preserves same ID and files',flush=True)
 # Changed underlying record blocks stale payload before any native invocation.
 pg.click('[data-shared]>summary');prepare('[data-sendone]');pg.evaluate("()=>{let a=JSON.parse(localStorage.getItem('sp_driver_entries'));a[0].q=9;localStorage.setItem('sp_driver_entries',JSON.stringify(a))}");pg.locator('[data-driver-share-go]').evaluate('(e)=>e.closest("details").open=true');pg.click('[data-driver-share-go]');pg.wait_for_function("() => document.querySelector('[data-driver-share-status]').textContent.includes('başka sekmede')");assert pg.evaluate('window.__shares.length')==2;pg.click('[data-driver-share-cancel]');pg.reload();pg.wait_for_selector('[data-shared]');pg.click('[data-shared]>summary')
 prepare('[data-sendone]');pg.evaluate("()=>{let c=JSON.parse(localStorage.getItem('sp_driver_cfg'));c.ts=2;localStorage.setItem('sp_driver_cfg',JSON.stringify(c))}");pg.locator('[data-driver-share-go]').evaluate('(e)=>e.closest("details").open=true');pg.click('[data-driver-share-go]');pg.wait_for_function("() => document.querySelector('[data-driver-share-status]').textContent.includes('bağlantısı başka sekmede')");assert pg.evaluate('window.__shares.length')==0;pg.click('[data-driver-share-cancel]')
 print('PASS changed record or link prevents stale packet sharing',flush=True)
 # Fallback: blocked popup must not advance local status.
 pg.reload();pg.wait_for_selector('[data-shared]');pg.click('[data-shared]>summary');prepare('[data-sendone]');pg.evaluate("navigator.share=undefined;navigator.canShare=()=>false");pg.locator('[data-driver-share-go]').evaluate('(e)=>e.closest("details").open=true');pg.click('[data-driver-share-go]');pg.wait_for_function("() => document.querySelector('[data-driver-share-status]').textContent.includes('desteklemiyor')");assert pg.evaluate('window.__shares.length')==0;pg.click('[data-driver-share-cancel]')
 # A zero-photo row exercises text fallback without network/navigation to WhatsApp.
 pg.evaluate("()=>{const a=JSON.parse(localStorage.getItem('sp_driver_entries'));a.push({id:'text-only',date:a[0].date,vid:'v',cid:'c',q:1,u:'Sefer',wt:'Hafriyat Nakliye'});localStorage.setItem('sp_driver_entries',JSON.stringify(a))}");pg.reload();pg.wait_for_selector('[data-send]');prepare();pg.evaluate("navigator.share=undefined;window.open=()=>null");pg.locator('[data-driver-share-go]').evaluate('(e)=>e.closest("details").open=true');pg.click('[data-driver-share-go]');pg.wait_for_function("() => document.querySelector('[data-driver-share-status]').textContent.includes('engellendi')");assert pg.evaluate("!JSON.parse(localStorage.getItem('sp_driver_entries')).find(e=>e.id==='text-only').sent");pg.click('[data-driver-share-cancel]')
 # A completed native handoff followed by storage failure must leave the same ID retryable.
 prepare();pg.evaluate("""()=>{navigator.share=d=>{window.__shares.push({text:d.text,files:0});return Promise.resolve()};const old=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='sp_driver_entries')throw new DOMException('full','QuotaExceededError');return old.call(this,k,v)}}""");pg.locator('[data-driver-share-go]').evaluate('(e)=>e.closest("details").open=true');pg.click('[data-driver-share-go]');pg.wait_for_function("() => !document.querySelector('[data-driver-share]')");assert pg.evaluate("!JSON.parse(localStorage.getItem('sp_driver_entries')).find(e=>e.id==='text-only').sent")
 print('PASS storage failure after native handoff keeps original record pending for safe same-ID retry',flush=True)
 assert not errors,errors
 print('PASS unsupported photo share and blocked text popup never advance delivery status; no uncaught errors',flush=True)
 b.close()
