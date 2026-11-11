"""Force user typing before delayed dialog autofocus; native keyboard and form validity."""
import sys,uuid,json
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright
base=(sys.argv[1] if len(sys.argv)>1 else 'http://localhost:8841/').rstrip('/')+'/';assert urlparse(base).hostname in ('localhost','127.0.0.1')
with sync_playwright() as w:
 b=w.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);c=b.new_context(service_workers='block');c.add_init_script("localStorage.setItem('sp_role','boss')");p=c.new_page();errors=[];p.on('pageerror',lambda e:errors.append(str(e)));p.goto(base+'index.html?db=TEST_focus108_'+uuid.uuid4().hex+'#/daha');p.wait_for_selector('#screen[data-view-ready="1"]')
 for attempt in range(6):
  p.evaluate("""async()=>{const ui=await import('./js/ui.js');window.TEST_nativeRaf=requestAnimationFrame;window.TEST_focusFrames=[];window.requestAnimationFrame=f=>{TEST_focusFrames.push(f);return TEST_focusFrames.length;};const dialog=ui.sheet('<h3>TEST Receipt</h3><form><label>Date<input type=date name=date value=2026-11-11 required></label><label>Amount<input type=number name=amount required></label><button type=button data-test-close>Close</button></form>',{modal:true});dialog.classList.add('show');document.querySelector('.sheet-overlay').classList.add('show');dialog.querySelector('[data-test-close]').onclick=()=>ui.sheetClose(true);}""")
  amount=p.locator('.sheet [name=amount]');amount.focus()
  p.evaluate("()=>{const pending=window.TEST_focusFrames;window.requestAnimationFrame=window.TEST_nativeRaf;for(const f of pending)f(performance.now());}")
  p.keyboard.insert_text('3000')
  assert amount.input_value()=='3000','Delayed autofocus must not steal user input from the chosen amount field'
  assert p.locator('.sheet [name=date]').input_value()=='2026-11-11';assert p.locator('.sheet form').evaluate('e=>e.checkValidity()')
  p.click('[data-test-close]');p.wait_for_selector('.sheet',state='detached')
 assert not errors,errors;print(json.dumps({'forcedAutofocusRaces':6,'amount':3000,'datePreserved':True,'formValid':True,'errors':errors}),flush=True);b.close()
