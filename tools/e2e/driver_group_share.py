"""Separate group summary versus signed patron transfer. Native sharing mocked."""
import json
from playwright.sync_api import sync_playwright
U='http://localhost:8841/'
MOCK="""(()=>{
window.__shares=[];window.__popups=[];window.__mode='ok';navigator.canShare=()=>true;
navigator.share=d=>{
 if(window.event?.type!=='click')throw Error('lost click activation');
 if(window.__mode==='cancel')return Promise.reject(new DOMException('cancel','AbortError'));
 if(window.__mode==='denied')throw new DOMException('Permission denied','NotAllowedError');
 window.__shares.push({text:d.text,keys:Object.keys(d),files:d.files?.length||0});
 if(window.__mode==='wait')return new Promise(r=>window.__finish=r);
 return Promise.resolve();
};
window.open=url=>{if(window.__mode==='blocked')return null;window.__popups.push(url);return {opener:null}};
})()"""
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 c=b.new_context(viewport={'width':360,'height':800});c.add_init_script(MOCK)
 pg=c.new_page();errors=[];pg.on('pageerror',lambda e:errors.append(str(e)))
 pg.goto(U+'sofor.html')
 cfg={'v':1,'p':['p','TEST Soner'],'V':[['v','TEST Manitou']],'veh':'v','C':[['c','Çatıcı (Ulaş Rondela)']],'S':[],'D':[],'E':[],'Q':[],'ts':1,'lid':'secret-link','ls':'secret-key'}
 code=pg.evaluate("async c=>(await import('./js/driver-core.js')).pack(c)",cfg)
 pg.goto(U+'sofor.html?k='+code);pg.wait_for_selector('[data-cid]')
 work={'id':'w1','date':'2026-10-19','vid':'v','cid':'c','wt':'Makine Çalışması','q':1,'u':'Saat','note':'Çatıya OCB verildi','cash':2500,'cash_date':'2026-10-19','ph':1}
 rows=[work,{**work,'id':'w2','ph':0,'note':'Mermer indirildi','sent':'2026-10-19T13:00:00Z'},{**work,'id':'old','date':'2026-10-18','ph':0,'note':'Eski iş'},{**work,'id':'fuel','k':'f','L':80,'src':'Depo Tankı'},{**work,'id':'expense','k':'g','cat':'Yemek'},{**work,'id':'maintenance','k':'m','mt':'Arıza'}]
 pg.evaluate("r=>localStorage.setItem('sp_driver_entries',JSON.stringify(r))",rows);pg.reload();pg.wait_for_selector('[data-group-share]')
 original=pg.evaluate("localStorage.getItem('sp_driver_entries')")
 pg.fill('[data-k=note]','Kaydedilmemiş taslak')
 def open_group():
  pg.click('[data-group-share]');pg.wait_for_selector('[data-group-review]')
 def close_group():
  pg.click('[data-group-close]');pg.wait_for_function("() => !document.querySelector('[data-group-review]')")
 def unchanged():assert pg.evaluate("localStorage.getItem('sp_driver_entries')")==original
 open_group()
 assert pg.input_value('[data-group-date]')=='2026-10-19'
 assert pg.locator('[data-group-rows] input').count()==2
 preview=pg.inner_text('[data-group-preview]')
 assert 'Çatıcı (Ulaş Rondela)' in preview and 'Mermer indirildi' in preview
 for v in ['SP1:','2500','secret-key','secret-link','📷','litre','Yemek','Arıza']:assert v not in preview,v
 assert pg.locator('[data-group-review] .driver-share-panel').evaluate('(e)=>e.scrollWidth<=e.clientWidth')
 assert pg.locator('#screen').evaluate('(e)=>e.inert')
 assert pg.evaluate("async()=>(await import('./js/update-safety.js')).updateRisk(null).busy")
 pg.locator('[data-group-rows] input').nth(1).uncheck();assert 'Mermer indirildi' not in pg.inner_text('[data-group-preview]')
 pg.evaluate("window.__mode='wait'");pg.click('[data-group-send]')
 assert pg.locator('[data-group-send]').is_disabled() and pg.locator('[data-group-close]').is_disabled()
 assert pg.locator('[data-group-date]').is_disabled();unchanged()
 pg.evaluate('window.__finish()');pg.wait_for_function("() => !document.querySelector('[data-group-close]').disabled")
 sent=pg.evaluate('window.__shares[0]');assert sent['keys']==['text'] and sent['files']==0 and sent['text']==pg.inner_text('[data-group-preview]')
 assert 'durumu değişmedi' in pg.inner_text('[data-group-status]');unchanged();close_group()
 assert not pg.evaluate("async()=>(await import('./js/update-safety.js')).updateRisk(null).busy")
 assert pg.input_value('[data-k=note]')=='Kaydedilmemiş taslak'
 print('PASS work/date selection, subcontractor, private/financial fields excluded, text-only native click, double-click lock, no pending/sent changes',flush=True)
 open_group();pg.select_option('[data-group-date]','2026-10-18');assert 'Eski iş' in pg.inner_text('[data-group-preview]')
 pg.locator('[data-group-rows] input').uncheck();assert pg.locator('[data-group-send]').is_disabled();pg.locator('[data-group-rows] input').check()
 pg.evaluate("window.__mode='cancel'");pg.click('[data-group-send]');pg.wait_for_function("() => document.querySelector('[data-group-status]').textContent.includes('iptal')");unchanged()
 pg.evaluate("window.__mode='denied'");pg.click('[data-group-send]');pg.wait_for_function("() => document.querySelector('[data-group-status]').textContent.includes('Permission denied')");unchanged()
 pg.evaluate("window.__mode='ok'");pg.click('[data-group-link]');pg.wait_for_function("() => window.__popups.length===1")
 link=pg.evaluate('decodeURIComponent(window.__popups[0])');assert link.startswith('https://wa.me/?text=') and 'Eski iş' in link and 'SP1:' not in link;unchanged()
 pg.evaluate("window.__mode='blocked'");pg.click('[data-group-link]');assert 'engellendi' in pg.inner_text('[data-group-status]');unchanged();close_group()
 print('PASS past-day and empty selection, cancellation/permission error preserve records, explicit WhatsApp fallback and popup blocking',flush=True)
 open_group();pg.evaluate("()=>{const r=JSON.parse(localStorage.getItem('sp_driver_entries'));r[0].q=9;localStorage.setItem('sp_driver_entries',JSON.stringify(r))}")
 pg.click('[data-group-send]');assert 'başka sekmede' in pg.inner_text('[data-group-status]');assert pg.evaluate('window.__shares.length')==1;close_group()
 pg.evaluate("r=>localStorage.setItem('sp_driver_entries',JSON.stringify(r))",rows);pg.reload();pg.wait_for_selector('[data-group-share]');open_group()
 pg.evaluate("()=>{const c=JSON.parse(localStorage.getItem('sp_driver_cfg'));c.ts=2;localStorage.setItem('sp_driver_cfg',JSON.stringify(c))}")
 pg.click('[data-group-send]');assert 'bağlantısı başka sekmede' in pg.inner_text('[data-group-status]');assert pg.evaluate('window.__shares.length')==0;close_group()
 print('PASS stale record and changed driver identity blocked before sharing',flush=True)
 # Long messages require explicit smaller selections; never truncate a work silently.
 longrows=[{**work,'id':'long'+str(i),'ph':0,'note':'Uzun açıklama '*40} for i in range(8)]
 pg.evaluate("r=>localStorage.setItem('sp_driver_entries',JSON.stringify(r))",longrows);pg.reload();pg.wait_for_selector('[data-group-share]');open_group()
 assert pg.locator('[data-group-send]').is_disabled() and 'Mesaj uzun' in pg.inner_text('[data-group-count]')
 for el in pg.locator('[data-group-rows] input').all()[1:]:el.uncheck()
 assert not pg.locator('[data-group-send]').is_disabled();close_group()
 # Patron's main option remains the signed SP1 message, not a PDF.
 clean={**work,'ph':0};pg.evaluate("r=>localStorage.setItem('sp_driver_entries',JSON.stringify([r]))",clean);pg.reload();pg.wait_for_selector('[data-send]');pg.click('[data-send]');pg.wait_for_selector('[data-driver-share-go]')
 assert pg.locator('[data-driver-share-go]').evaluate('(e)=>!e.closest("details")')
 assert 'Patrona gönder' in pg.inner_text('[data-driver-share-go]')
 pg.click('[data-driver-share-go]');pg.wait_for_function("() => !document.querySelector('[data-driver-share]')")
 message=pg.evaluate('window.__shares[0]');assert 'SP1:' in message['text'] and message['files']==0 and '2500 TL nakit alındı' in message['text']
 decoded=pg.evaluate("async t=>(await import('./js/driver-core.js')).extractPayloads(t)",message['text'])
 assert decoded[0]['e'][0]['cash']==2500 and decoded[0]['e'][0]['id']=='w1' and decoded[0]['_sig']
 expected=pg.evaluate("async code=>(await import('./js/security-core.js')).hmac('secret-key',code)",decoded[0]['_code']);assert decoded[0]['_sig']==expected
 assert pg.evaluate("!!JSON.parse(localStorage.getItem('sp_driver_entries'))[0].sent")
 print('PASS long-message guard; patron default preserves cash, source ID, signed SP1 and independent outbox state',flush=True)
 assert not errors,errors
 b.close()
