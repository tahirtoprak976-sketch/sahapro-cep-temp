"""Read-only menu crawl, no business records created by opening screens."""
import sys,json
from playwright.sync_api import sync_playwright
U=sys.argv[1] if len(sys.argv)>1 else 'http://localhost:8841/'
with sync_playwright()as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);c=b.new_context(viewport={'width':360,'height':850});c.add_init_script("localStorage.setItem('sp_role','boss')");pg=c.new_page();errors=[];pg.on('pageerror',lambda e:errors.append(str(e)))
 pg.goto(U+'index.html#/daha');pg.wait_for_function("()=>document.querySelector('#screen')?.textContent.includes('İşletme Defterleri')")
 menu=pg.locator('#screen [data-go]').evaluate_all("es=>es.map(e=>e.dataset.go)")
 targets=list(dict.fromkeys(h for h in menu if h.startswith('#/') and 'new' not in h and not h.startswith('#/ayarlar')))
 before=pg.evaluate("async()=>await(await import('./js/db.js')).dumpAll()")
 for target in targets:
  pg.evaluate("async h=>{location.hash=h;await(await import('./js/app.js')).renderCurrent()}",target)
  pg.wait_for_function("()=>document.querySelector('#screen')?.children.length>0&&!document.querySelector('#screen .skel')")
  assert 'Ekran yüklenirken hata' not in pg.locator('#screen').inner_text(),target
  assert pg.locator('#screen h1').count(),target
 after=pg.evaluate("async()=>await(await import('./js/db.js')).dumpAll()")
 assert before==after,'opening a menu changed business records'
 assert not errors,errors
 assert '#/yedek-parca' in targets
 print('PASS '+str(len(targets))+' menu routes; zero business writes and browser errors',flush=True)
 b.close()
