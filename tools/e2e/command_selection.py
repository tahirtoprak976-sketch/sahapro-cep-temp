"""Real Chromium + IndexedDB; synthetic entities; no Gemini requests permitted."""
from playwright.sync_api import sync_playwright
import json,os
from pathlib import Path
U='http://localhost:8841/'
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 ctx=b.new_context(viewport={'width':412,'height':900},service_workers='block')
 ctx.add_init_script("localStorage.setItem('sp_role','boss')")
 pg=ctx.new_page();errors=[];network=[];console_errors=[]
 pg.on('console',lambda m:console_errors.append(m.text)if m.type=='error'else None)
 pg.on('pageerror',lambda e:errors.append(str(e)))
 pg.route('https://generativelanguage.googleapis.com/**',lambda r:(network.append(r.request.url),r.abort()))
 pg.goto(U);pg.wait_for_timeout(1500)
 ids=pg.evaluate("""async()=>{const db=await import('./js/db.js');const sec=await import('./js/security-core.js');await db.metaSet('sec_lock',{...(await sec.hashSecret('482917')),idle_min:30,away_min:15});const c=await db.saveNew('customers',{name:'Örnek müşteri'},'TEST');const vs=[];for(const name of ['TEST JCB','TEST JCB 2','TEST Equal','TEST Equal'])vs.push((await db.saveNew('vehicles',{name},'TEST')).id);return {c:c.id,vs};}""")
 pg.goto(U+'index.html#/akilli-asistan');pg.wait_for_timeout(1800)
 if pg.locator('#lock-root [data-pw]').count():
  pg.fill('#lock-root [data-pw]','482917');pg.click('#lock-root [data-go-un]');pg.wait_for_timeout(600)
 def ask(message):
  pg.evaluate("location.hash='#/akilli-asistan'")
  pg.wait_for_selector('textarea[data-msg]');pg.fill('textarea[data-msg]',message);pg.click('[data-ask]')
 pg.evaluate('(c)=>sessionStorage.setItem("sp_asst_ctx",JSON.stringify({customer_id:c,at:Date.now()}))',ids['c'])
 ask('kart TEST JCB 2 aç');pg.wait_for_url('**#/filo/'+ids['vs'][1]);print('PASS longest vehicle name wins over prior customer context')
 try:
  ask('TEST Equal kartını aç');pg.locator('[data-out]').get_by_text('Hangi araç?',exact=True).wait_for()
 except Exception:
  prefix=Path(os.environ.get('COMMAND_SELECTION_DIAGNOSTICS','/tmp/solo-command-selection-diagnostics/command_selection'));prefix.parent.mkdir(parents=True,exist_ok=True)
  try:
   state=pg.evaluate("""()=>({url:location.href,out:document.querySelector('[data-out]')?.innerText,message:document.querySelector('[data-msg]')?.value,buttonDisabled:document.querySelector('[data-ask]')?.disabled,viewReady:document.querySelector('#screen')?.dataset.viewReady,screenInert:document.querySelector('#screen')?.inert,activeElement:document.activeElement?.outerHTML,serviceWorkerController:navigator.serviceWorker.controller?{state:navigator.serviceWorker.controller.state,scriptURL:navigator.serviceWorker.controller.scriptURL}:null})""")
   state.update(pageErrors=errors,consoleErrors=console_errors,providerRequests=network)
   prefix.with_suffix('.json').write_text(json.dumps(state,ensure_ascii=False,indent=2));print('COMMAND_SELECTION_DIAGNOSTICS '+json.dumps(state,ensure_ascii=False),flush=True)
   pg.screenshot(path=str(prefix.with_suffix('.png')),full_page=True)
  except Exception as diagnostic_error:print('COMMAND_SELECTION_DIAGNOSTICS_ERROR '+str(diagnostic_error),flush=True)
  raise
 opts=pg.locator('[data-out] [data-go]');assert opts.count()==2
 assert sorted(opts.evaluate_all('(xs)=>xs.map(x=>x.dataset.go)'))==sorted(['#/filo/'+x for x in ids['vs'][2:]])
 print('PASS duplicate vehicle names require explicit choice')
 ask('mazot hesabını göster');pg.wait_for_url('**#/musteriler/'+ids['c']);print('PASS explicit follow-up retains customer context')
 assert not network,network
 assert not errors,errors
 print('PASS no Gemini calls or page errors')
 b.close()
