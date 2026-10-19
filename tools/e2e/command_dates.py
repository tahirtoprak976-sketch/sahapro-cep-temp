"""Real mobile UI, no Gemini/key, isolated browser storage, synthetic data only."""
from playwright.sync_api import sync_playwright
U='http://localhost:8841/'
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 ctx=b.new_context(viewport={'width':412,'height':900},service_workers='block')
 ctx.add_init_script("localStorage.setItem('sp_role','boss')")
 pg=ctx.new_page();errors=[];network=[]
 pg.on('pageerror',lambda e:errors.append(str(e)))
 pg.route('https://generativelanguage.googleapis.com/**',lambda r:(network.append(r.request.url),r.abort()))
 pg.goto(U);pg.wait_for_timeout(1200)
 expected=pg.evaluate("""async()=>{const db=await import('./js/db.js');const sec=await import('./js/security-core.js');const {todayStr}=await import('./js/core.js');const {dateWords}=await import('./js/command-router.js');await db.metaSet('sec_lock',{...(await sec.hashSecret('482917')),idle_min:30,away_min:15});return Object.fromEntries(['bu hafta','geçen hafta','bu ay','son 7 gün'].map(t=>[t,dateWords(t,todayStr()).slice(0,2)]));}""")
 pg.goto(U+'index.html#/akilli-asistan');pg.wait_for_timeout(2500)
 if pg.locator('#lock-root [data-pw]').count():
  pg.fill('#lock-root [data-pw]','482917');pg.click('#lock-root [data-go-un]');pg.wait_for_timeout(600)
 for command,key in [('bu haftanın işlerini göster','bu hafta'),('geçen haftanın işlerini göster','geçen hafta'),('bu ayın işlerini göster','bu ay'),('son 7 günün işlerini göster','son 7 gün')]:
  pg.evaluate("location.hash='#/akilli-asistan'");pg.wait_for_selector('textarea[data-msg]');pg.fill('textarea[data-msg]',command);pg.click('[data-ask]')
  fr,to=expected[key];pg.wait_for_url(f'**#/isler?from={fr}&to={to}')
  print('PASS',command,fr,to)
 pg.evaluate("location.hash='#/akilli-asistan'");pg.wait_for_selector('textarea[data-msg]');pg.fill('textarea[data-msg]','31.02.2026 tarihli işleri göster');pg.click('[data-ask]')
 pg.locator("[data-out]").get_by_text("Geçersiz tarih", exact=False).wait_for()
 assert '#/akilli-asistan' in pg.url
 assert not network,network
 counts=pg.evaluate("async()=>{const db=await import('./js/db.js');return [(await db.listActive('work_records')).length,(await db.listActive('cash_records')).length]}")
 assert counts==[0,0],counts
 assert not errors,errors
 print('PASS invalid date remains in assistant; no Gemini requests, no work/cash writes, no page errors')
 b.close()
