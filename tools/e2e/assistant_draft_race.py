"""Delay only assistant_draft's real IndexedDB read; race it with actual Playwright fill.
Synthetic isolated databases; no model calls, business writes, or relaxed assertions.
"""
import argparse,asyncio,uuid
from pathlib import Path
from urllib.parse import urlparse
from playwright.async_api import async_playwright
ap=argparse.ArgumentParser();ap.add_argument('url',nargs='?',default='http://localhost:8841/');ap.add_argument('--source-root',type=Path,default=Path(__file__).resolve().parents[2]);a=ap.parse_args()
base=a.url.rstrip('/')+'/';assert urlparse(base).hostname in ('localhost','127.0.0.1')
source=(a.source_root/'js/db.js').read_text()
needle='  const row = await wrap(tx(db, "meta", "readonly").get(key));'
assert source.count(needle)==1
# Preserve the real request/value. Hold its return while the user starts filling.
source=source.replace(needle,needle+"\n  if(key==='assistant_draft'&&globalThis.__draftGate){globalThis.__draftReading=true;await globalThis.__draftGate;}")
async def main():
 async with async_playwright() as w:
  browser=await w.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  for attempt in range(6):
   ctx=await browser.new_context(service_workers='block');await ctx.add_init_script("localStorage.setItem('sp_role','boss')")
   async def route(r):
    if urlparse(r.request.url).path.endswith('/js/db.js'):await r.fulfill(status=200,content_type='text/javascript',body=source)
    elif urlparse(r.request.url).hostname in ('localhost','127.0.0.1'):await r.continue_()
    else:await r.abort()
   await ctx.route('**/*',route);page=await ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   app=base+'index.html?db=TEST_draft_race_'+uuid.uuid4().hex
   await page.goto(app+'#/daha');await page.wait_for_selector('#screen[data-view-ready="1"]')
   before=await page.evaluate("""async()=>{const db=await import('./js/db.js');await db.metaSet('assistant_draft','TEST previous work 1 sefer moloz');const data=await db.dumpAll();globalThis.__draftGate=new Promise(resolve=>globalThis.__releaseDraft=resolve);location.hash='#/akilli-asistan';return data;}""")
   await page.wait_for_function('()=>globalThis.__draftReading===true')
   box=page.locator('[data-msg]');fill=asyncio.create_task(box.fill('Ödemelerim'))
   try:
    await asyncio.wait({fill},timeout=0.2)
    assert await box.evaluate('e=>e.readOnly'),'Draft restoration must lock editing until the delayed read finishes'
    assert not fill.done(),'Fill must wait for draft restoration, rather than typing into an unfinished input'
   finally:
    await page.evaluate('()=>globalThis.__releaseDraft()')
    await fill
   assert await box.input_value()=='Ödemelerim','Restored draft must never prefix the newly typed message'
   assert not await box.evaluate('e=>e.readOnly'),'Input must unlock after reading the saved draft'
   assert await page.evaluate("async()=>await(await import('./js/db.js')).dumpAll()")==before
   assert not errors,errors
   await ctx.close();print(f'PASS delayed real draft read vs fill {attempt+1}/6: only new text, unlocked, no business writes',flush=True)
  await browser.close()
asyncio.run(main())
