"""An explicit cancel-button focus must survive delayed prompt autofocus."""
import sys,uuid,json
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright
base=(sys.argv[1]if len(sys.argv)>1 else 'http://localhost:8841/').rstrip('/')+'/';assert urlparse(base).hostname in ('localhost','127.0.0.1')
with sync_playwright() as w:
 b=w.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);c=b.new_context(service_workers='block');c.add_init_script("localStorage.setItem('sp_role','boss')");p=c.new_page();p.goto(base+'index.html?db=TEST_prompt109_'+uuid.uuid4().hex+'#/daha');p.wait_for_selector('#screen[data-view-ready="1"]');before=p.evaluate("async()=>await(await import('./js/db.js')).dumpAll()")
 p.evaluate("()=>{window.TEST_prompt=(async()=>await(await import('./js/ui.js')).promptDialog('TEST Amount','TEST Input',''))();}");p.wait_for_selector('.sheet [data-p]');cancel=p.locator('.sheet [data-x="0"]');cancel.focus();p.wait_for_timeout(350)
 assert cancel.evaluate('el=>el===document.activeElement'),'Delayed prompt focus must preserve the user-selected cancel button'
 cancel.click();assert p.evaluate('window.TEST_prompt') is None
 assert p.evaluate("async()=>await(await import('./js/db.js')).dumpAll()")==before
 print(json.dumps({'cancelFocusPreserved':True,'canceled':True,'businessWrites':0}),flush=True);b.close()
