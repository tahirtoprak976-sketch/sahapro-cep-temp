"""Keep the composer noneditable throughout async setup, including before the saved draft read."""
import argparse,asyncio,json,sys,uuid
from pathlib import Path
from urllib.parse import urlparse
from playwright.async_api import async_playwright
ap=argparse.ArgumentParser();ap.add_argument('url',nargs='?',default='http://localhost:8841/');ap.add_argument('--source-root',type=Path,default=Path(__file__).resolve().parents[2]);args=ap.parse_args()
base=args.url.rstrip('/')+'/';assert urlparse(base).hostname in ('localhost','127.0.0.1')
source=(args.source_root/'js/db.js').read_text()
for needle,extra in [
 ('  const row = await wrap(tx(db, "drafts", "readonly").get(form));',"\n  if(form==='assistant-pending-files'&&globalThis.TEST_setupGate){globalThis.TEST_setupWaiting=true;await globalThis.TEST_setupGate;}"),
 ('  const row = await wrap(tx(db, "meta", "readonly").get(key));',"\n  if(key==='assistant_draft'&&globalThis.TEST_draftGate){globalThis.TEST_draftWaiting=true;await globalThis.TEST_draftGate;}")]:
 assert source.count(needle)==1;source=source.replace(needle,needle+extra)
async def main():
 async with async_playwright()as w:
  b=await w.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);c=await b.new_context(service_workers='block');await c.add_init_script("localStorage.setItem('sp_role','boss')")
  async def route(r):
   if urlparse(r.request.url).path.endswith('/js/db.js'):await r.fulfill(status=200,content_type='text/javascript',body=source)
   elif urlparse(r.request.url).hostname in ('localhost','127.0.0.1'):await r.continue_()
   else:await r.abort()
  await c.route('**/*',route);p=await c.new_page();errors=[];p.on('pageerror',lambda e:errors.append(str(e)));app=base+'index.html?db=TEST_ready109_'+uuid.uuid4().hex
  await p.goto(app+'#/daha');await p.wait_for_selector('#screen[data-view-ready="1"]');before=await p.evaluate("async()=>{const d=await import('./js/db.js');await d.metaSet('assistant_draft','TEST previous draft');return await d.dumpAll();}")
  await p.evaluate("()=>{TEST_setupGate=new Promise(r=>globalThis.TEST_releaseSetup=r);TEST_draftGate=new Promise(r=>globalThis.TEST_releaseDraft=r);location.hash='#/akilli-asistan';}");await p.wait_for_function('()=>globalThis.TEST_setupWaiting===true')
  box=p.locator('[data-msg]');fill=None
  try:
   assert await box.evaluate('e=>e.readOnly'),'Composer must be readonly from first paint, before async file and draft setup completes'
   fill=asyncio.create_task(box.fill('TEST Equal kartını aç'));await asyncio.wait({fill},timeout=.2);assert not fill.done()
   await p.evaluate('TEST_releaseSetup()');await p.wait_for_function('()=>globalThis.TEST_draftWaiting===true');assert await box.evaluate('e=>e.readOnly');assert not fill.done()
  finally:
   await p.evaluate('TEST_releaseSetup();TEST_releaseDraft()')
   if fill:await fill
  assert await box.input_value()=='TEST Equal kartını aç';assert not await box.evaluate('e=>e.readOnly');assert await p.evaluate("async()=>await(await import('./js/db.js')).dumpAll()")==before;assert not errors,errors
  print(json.dumps({'readonlyBeforeDraftRead':True,'readonlyDuringDraftRead':True,'onlyTypedMessage':True,'unlockedAfterSetup':True,'businessWrites':0,'pageErrors':errors}),flush=True);await b.close()
asyncio.run(main())
