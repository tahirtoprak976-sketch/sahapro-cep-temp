"""Default patron share must not build optional ZIP/PDF. Synthetic records only."""
import io
from PIL import Image
from playwright.sync_api import sync_playwright
U='http://localhost:8841/'
image=io.BytesIO();Image.new('RGB',(250,350),'green').save(image,'JPEG')
photo={'name':'TEST-fis.jpg','mimeType':'image/jpeg','buffer':image.getvalue()}
MOCK="""(()=>{
window.__shares=[];window.__reads=0;window.__mode='ok';
const original=File.prototype.arrayBuffer;
File.prototype.arrayBuffer=function(){window.__reads++;if(window.__holdFiles)return new Promise(r=>window.__release=()=>r(original.call(this)));return original.call(this)};
navigator.canShare=()=>true;
navigator.share=d=>{
 if(window.event?.type!=='click')throw Error('lost user activation');
 if(window.__mode==='denied')return Promise.reject(new DOMException('Permission denied','NotAllowedError'));
 window.__shares.push({text:d.text,names:(d.files||[]).map(f=>f.name)});return Promise.resolve();
};
})()"""
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 c=b.new_context(viewport={'width':360,'height':800},service_workers='block');c.add_init_script(MOCK)
 pg=c.new_page();errors=[];fonts=[]
 pg.on('pageerror',lambda e:errors.append(str(e)))
 pg.on('request',lambda r:fonts.append(r.url) if '/vendor/DejaVuSans' in r.url else None)
 pg.goto(U+'sofor.html')
 code=pg.evaluate("async()=>(await import('./js/driver-core.js')).pack({v:1,p:['p','TEST Soner'],V:[['v','TEST Manitou']],veh:'v',C:[['c','Çatıcı (Ulaş Rondela)']],S:[],D:[],E:[],Q:[],lid:'link',ls:'secret'})")
 pg.goto(U+'sofor.html?k='+code);pg.wait_for_selector('[data-cid]');pg.select_option('[data-cid]','c')
 pg.click('[data-wt="Makine Çalışması"]');pg.fill('[data-k=q]','1');pg.fill('[data-k=cash]','2500')
 pg.set_input_files('[data-photo]',photo);pg.wait_for_function("() => !document.querySelector('[data-add]').disabled")
 pg.click('[data-add]');pg.wait_for_selector('[data-save-result]')
 def prepare(selector='[data-send]'):
  if selector=='[data-sendone]':pg.locator('[data-shared]').evaluate('(e)=>e.open=true')
  pg.click(selector);pg.wait_for_selector('[data-driver-share-go]')
 def optional():
  pg.locator('[data-driver-files-prepare]').evaluate('(e)=>e.closest("details").open=true')
  pg.click('[data-driver-files-prepare]')
 def pending():return pg.evaluate("!JSON.parse(localStorage.getItem('sp_driver_entries'))[0].sent")
 pg.evaluate('window.__reads=0;window.__holdFiles=true')
 prepare();assert pg.evaluate('window.__reads')==0 and not fonts
 assert not pg.locator('[data-driver-share-go]').is_disabled()
 assert pg.locator('[data-driver-share-pdf]').is_disabled() and pg.locator('[data-driver-share-download]').is_disabled()
 pg.click('[data-driver-share-go]');pg.wait_for_function("() => !document.querySelector('[data-driver-share]')")
 first=pg.evaluate('window.__shares[0]');assert 'SP1:' in first['text'] and '2500 TL nakit alındı' in first['text']
 assert first['names']==[photo['name']] and pg.evaluate('window.__reads')==0 and not fonts
 print('PASS default signed message + original photo + cash uses no File reads, PDF font fetch or optional file generation',flush=True)
 # Slow optional generation is explicitly requested and never starts native sharing.
 pg.click('[data-shared]>summary');prepare('[data-sendone]');optional()
 pg.wait_for_function('() => !!window.__release')
 assert pg.locator('[data-driver-share-go]').is_disabled() and pg.locator('[data-driver-share-cancel]').is_disabled()
 pg.keyboard.press('Escape');assert pg.locator('[data-driver-share]').count()==1
 pg.evaluate("document.querySelector('[data-driver-files-prepare]').onclick()")
 assert pg.evaluate('window.__reads')==1 and pg.evaluate('window.__shares.length')==1
 pg.evaluate('window.__holdFiles=false;window.__release()')
 pg.wait_for_function("() => !document.querySelector('[data-driver-share-go]').disabled")
 assert not pg.locator('[data-driver-share-pdf]').is_disabled() and not pg.locator('[data-driver-share-download]').is_disabled()
 assert pg.evaluate('window.__shares.length')==1 and fonts
 assert 'SAHAPRO-' in pg.inner_text('[data-driver-file-name]')
 pg.click('[data-driver-share-cancel]')
 print('PASS only explicit optional preparation reads files; slow preparation locks close/double-click; native sharing still needs a fresh click',flush=True)
 # A derived PDF failure must not disable the original signed packet.
 prepare('[data-sendone]');pg.evaluate("()=>{HTMLCanvasElement.prototype.toBlob=()=>{throw Error('TEST PDF failure')}}");optional()
 pg.wait_for_function("() => !document.querySelector('[data-driver-share-go]').disabled")
 assert pg.locator('[data-driver-share-pdf]').is_disabled() and not pg.locator('[data-driver-share-clean]').is_disabled()
 assert 'TEST PDF failure' in pg.inner_text('[data-driver-pdf-error]')
 pg.click('[data-driver-share-go]');pg.wait_for_function("() => !document.querySelector('[data-driver-share]')")
 assert pg.evaluate('window.__shares[1]')==first
 print('PASS optional PDF failure leaves identical signed source and original photo available',flush=True)
 # Permissions failure does not silently generate files, download or mark a new row sent.
 pg.evaluate("()=>{const a=JSON.parse(localStorage.getItem('sp_driver_entries'));delete a[0].sent;localStorage.setItem('sp_driver_entries',JSON.stringify(a))}")
 pg.reload();pg.wait_for_selector('[data-send]');pg.evaluate("window.__mode='denied'");prepare()
 reads=pg.evaluate('window.__reads');pg.click('[data-driver-share-go]')
 pg.wait_for_function("() => document.querySelector('[data-driver-share-status]').textContent.includes('izni reddedildi')")
 assert pending() and pg.evaluate('window.__reads')==reads and pg.locator('[data-driver-files-prepare]').is_visible()
 assert 'önce dosya seçeneklerini' in pg.inner_text('[data-driver-share-status]')
 pg.click('[data-driver-share-cancel]')
 # Optional generation is also protected against changed source records.
 prepare();pg.evaluate("()=>{const a=JSON.parse(localStorage.getItem('sp_driver_entries'));a[0].q=9;localStorage.setItem('sp_driver_entries',JSON.stringify(a))}")
 reads=pg.evaluate('window.__reads');optional()
 assert 'başka sekmede' in pg.inner_text('[data-driver-files-status]') and pg.evaluate('window.__reads')==reads
 pg.click('[data-driver-share-cancel]');assert pending()
 assert not errors,errors
 print('PASS permission failure stays pending without auto-generation; changed source blocks optional processing; no browser errors',flush=True)
 b.close()
