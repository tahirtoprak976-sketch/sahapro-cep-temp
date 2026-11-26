"""TEST-only delayed augment proves partial paint is not a ready screen."""
import sys,uuid
from playwright.sync_api import sync_playwright
U=sys.argv[1] if len(sys.argv)>1 else 'http://localhost:8841/'
with sync_playwright() as w:
 b=w.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);c=b.new_context(service_workers='block');c.add_init_script("localStorage.setItem('sp_role','boss')");p=c.new_page();p.set_default_timeout(15000);errors=[];p.on('pageerror',lambda e:(errors.append(str(e)),print('PAGEERROR',str(e),flush=True)))
 def delayed(route):
  response=route.fetch();source=response.text();needle='const rows = await ctx.db.listActive("payroll_entries");';assert source.count(needle)==1
  # Only an extra async wait in TEST delivery. No production source or business rule changes.
  route.fulfill(response=response,body=source.replace(needle,'await new Promise(resolve=>setTimeout(resolve,500));'+needle))
 c.route('**/js/enterprise.js',delayed);app=U+'index.html?db=TEST_ledger_ready137_'+uuid.uuid4().hex;p.goto(app+'#/daha');p.wait_for_selector('#screen[data-view-ready="1"]')
 pid=p.evaluate("async()=>{const d=await import('./js/db.js');return (await d.saveNew('personnel',{name:'TEST Ledger Ready137'},'TEST')).id}");p.wait_for_timeout(100)
 snap="async()=>{const d=await(await import('./js/db.js')).readSnapshot({meta:true,drafts:true,attachments:true});delete d.captured_at;return JSON.stringify(d)}";before=p.evaluate(snap)
 old=p.locator('#screen').element_handle();p.goto(app+'#/personel/'+pid);p.wait_for_function('(e)=>!e.isConnected',arg=old)
 p.wait_for_function("()=>document.querySelector('#screen')?.children.length>0&&!document.querySelector('#screen .skel')")
 early=p.locator('#screen').inner_text();assert 'Ücret defteri bakiyesi (tüm dönemler)' not in early,'delay did not expose the premature-read window';assert p.locator('#screen').get_attribute('data-view-ready')!='1'
 p.wait_for_selector('#screen[data-view-ready="1"]');late=p.locator('#screen').inner_text();assert 'tüm dönemler' in late and 'Puantaj / Maaş' in late
 assert p.evaluate(snap)==before;assert not errors,errors
 print('ledger ready137 PASS: old child/noskel predicate accepts unfinished personnel screen; actual ready waits payroll augmentation, same records, zero errors');b.close()
