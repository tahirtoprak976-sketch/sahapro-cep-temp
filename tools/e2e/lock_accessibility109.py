"""Synthetic lock: accessible password, wrong PIN still blocked, background inert, correct PIN restores."""
import sys,json,uuid
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright
base=(sys.argv[1]if len(sys.argv)>1 else 'http://localhost:8841/').rstrip('/')+'/';assert urlparse(base).hostname in ('localhost','127.0.0.1')
with sync_playwright() as w:
 b=w.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);c=b.new_context(service_workers='block');c.add_init_script("localStorage.setItem('sp_role','boss')");p=c.new_page();app=base+'index.html?db=TEST_lock109_'+uuid.uuid4().hex+'#/daha';p.goto(app);p.wait_for_selector('#screen[data-view-ready="1"]')
 p.evaluate("""async()=>{const D=await import('./js/db.js'),S=await import('./js/security-core.js');await D.saveNew('customers',{name:'TEST Private Customer'},'TEST');await D.metaSet('sec_lock',{...await S.hashSecret('482917'),idle_min:30,away_min:15});}""")
 before=p.evaluate("async()=>await(await import('./js/db.js')).dumpAll()");p.reload();p.wait_for_selector('#lock-root [data-pw]');lock=p.locator('#lock-root')
 assert p.locator('#lock-root [data-pw]').get_attribute('aria-label')=='Yönetici şifresi','Lock password needs an accessible name and modal keyboard boundary'
 assert lock.get_attribute('role')=='dialog' and lock.get_attribute('aria-modal')=='true';assert p.locator('#screen').evaluate('el=>el.inert')
 p.locator('#lock-root button').last.focus();p.keyboard.press('Tab');assert lock.evaluate('el=>el.contains(document.activeElement)')
 p.fill('#lock-root [data-pw]','938274');p.click('#lock-root [data-go-un]');p.wait_for_function("()=>document.querySelector('#lock-root [data-msg]')?.textContent.includes('Şifre hatalı')")
 assert lock.is_visible() and p.locator('#screen').evaluate('el=>el.inert')
 p.fill('#lock-root [data-pw]','482917');p.click('#lock-root [data-go-un]');p.wait_for_selector('#lock-root',state='detached');p.wait_for_selector('#screen[data-view-ready="1"]')
 assert not p.locator('#screen').evaluate('el=>el.inert');assert p.evaluate("async()=>await(await import('./js/db.js')).dumpAll()")==before
 print(json.dumps({'namedPassword':True,'tabInsideLock':True,'backgroundInert':True,'wrongPinBlocked':True,'correctPinRestoresUI':True,'businessDataUnchanged':True}),flush=True);b.close()
