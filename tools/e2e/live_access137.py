"""Isolated synthetic browser proof; never reads the owner's phone or public mailbox."""
import json,uuid,argparse
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright
ap=argparse.ArgumentParser();ap.add_argument('url',nargs='?',default='http://127.0.0.1:8872/');a=ap.parse_args();BASE=a.url.rstrip('/')+'/'
assert urlsplit(BASE).hostname in ('localhost','127.0.0.1','::1')
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);c=b.new_context(viewport={'width':360,'height':800});c.add_init_script("localStorage.setItem('sp_role','boss')")
 requests=[];responses={};pending=[];errors=[]
 def route(r):
  u=urlsplit(r.request.url)
  if u.hostname=='oumoklilsujvjikjvtwu.supabase.co':
   body=r.request.post_data_json;requests.append(body)
   if body['action']=='poll':r.fulfill(json={'messages':[x for x in pending if x['id'] not in responses]});return
   if body['action']=='respond':responses[body['id']]=body['response'];r.fulfill(json={'ok':True});return
   r.fulfill(json={'ok':True});return
  if '/data/remote-inbox/' in u.path:r.fulfill(status=404);return
  if u.netloc==urlsplit(BASE).netloc and '/data/transfers/' not in u.path:r.continue_()
  else:r.abort()
 c.route('**/*',route);p=c.new_page();p.on('pageerror',lambda e:errors.append(str(e)));p.goto(BASE+'index.html?db=TEST_live137_'+uuid.uuid4().hex[:10]+'#/gecmis');p.wait_for_selector('#screen[data-view-ready="1"]');p.wait_for_selector('[data-live-form]')
 assert not p.locator('[name=read_consent]').is_checked();assert not p.locator('[name=allow_writes]').is_checked();assert not requests
 p.click('[data-remote-enable]');p.wait_for_selector('[data-x="1"]');p.click('[data-x="1"]');p.wait_for_selector('[data-remote-code]');channel=p.input_value('[data-remote-code]').split('.')[1]
 p.evaluate("""async()=>{const d=await import('./js/db.js');await d.saveNew('customers',{id:crypto.randomUUID(),name:'TEST client137',active:true,api_key:'TEST-SECRET-DO-NOT-SHARE'},'TEST');const client=(await d.getAll('customers')).find(x=>x.name==='TEST client137');await d.saveNew('sites',{name:'TEST site137',customer_id:client.id,deal:{basis:'Sefer',status:'Açık',price:137,kdv_rate:20,start_date:'2026-01-01'},active:true},'TEST');}""")
 before=p.evaluate("async()=>JSON.stringify(await(await import('./js/db.js')).dumpAll())")
 token='A'*43;p.fill('[name=live_code]','SPAL1.'+channel+'.'+token);p.check('[name=read_consent]');p.click('[data-live-form] button');p.wait_for_timeout(1000);assert p.locator('[data-live-stop]').count(), (p.locator('[data-live-status]').all_text_contents(), errors, len(requests))
 def queue(body):
  entry=p.evaluate("""async value=>{const a=await(await import('./js/remote-approved-db.js')).remoteAuthority(),m=await import('./js/live-access-core.js'),id=crypto.randomUUID();return {id,request:await m.sealLive(value,a,id,'request')};}""",body);pending.append(entry);return entry['id']
 def tick():p.evaluate("async()=>await(await import('./js/live-access-runner.js')).checkLiveAccess()")
 def result(id):return p.evaluate("""async({id,box})=>await(await import('./js/live-access-core.js')).openLive(box,await(await import('./js/remote-approved-db.js')).remoteAuthority(),id,'response')""",{'id':id,'box':responses[id]})
 first=queue({'type':'catalog','store':'sites'});tick();got=result(first);assert got['ok'];assert any(x.get('deal',{}).get('price')==137 for x in got['result']['rows'])
 second=queue({'type':'catalog','store':'customers'});tick();assert 'TEST-SECRET-DO-NOT-SHARE' not in json.dumps(result(second));assert 'TEST client137' not in json.dumps(requests)
 denied=queue({'type':'catalog','store':'meta'});tick();assert not result(denied)['ok']
 write=queue({'type':'approved_packet','packet':{}});tick();assert not result(write)['ok'] and 'izni kapalı' in result(write)['error']
 busy=queue({'type':'catalog','store':'sites'});p.evaluate("async()=>{window.TEST_release=(await import('./js/update-safety.js')).startActivity('TEST live137')} ");tick();assert busy not in responses;p.evaluate('window.TEST_release()');tick();assert result(busy)['ok']
 driver=queue({'type':'catalog','store':'personnel'});p.evaluate("localStorage.setItem('sp_driver','1')");tick();assert driver not in responses;p.evaluate("localStorage.removeItem('sp_driver')");tick();assert result(driver)['ok']
 assert p.evaluate("async()=>JSON.stringify(await(await import('./js/db.js')).dumpAll())")==before,'read bridge changed business records'
 backup=p.evaluate("async()=>JSON.stringify(await(await import('./js/backup.js')).fullBackup(await import('./js/db.js')))");assert token not in backup
 p.click('[data-live-stop]');p.wait_for_selector('[data-live-form]');assert p.evaluate("async()=>await(await import('./js/secure-transfer-db.js')).getLiveAccess()") is None
 count=len(requests);queue({'type':'catalog','store':'sites'});tick();assert len(requests)==count
 assert not errors,errors;assert p.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
 print('live access137 PASS: explicit unchecked consent; encrypted contract and catalog replies; no business writes; allowlist; read-only denies writes; busy/driver guards; no credentials in backup; revoke stops traffic; 360px; no page errors')
 b.close()
