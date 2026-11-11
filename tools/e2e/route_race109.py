"""Queued real hash events must preserve a message on a rapid away-and-back navigation."""
import sys,uuid,json
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright
base=(sys.argv[1]if len(sys.argv)>1 else 'http://localhost:8841/').rstrip('/')+'/';assert urlparse(base).hostname in ('localhost','127.0.0.1')
with sync_playwright() as w:
 b=w.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);c=b.new_context(service_workers='block');c.add_init_script("""localStorage.setItem('sp_role','boss');window.TEST_hold=false;window.TEST_routes=[];const native=window.addEventListener;window.addEventListener=function(type,fn,...options){if(type==='hashchange'){return native.call(this,type,event=>{if(TEST_hold)TEST_routes.push(()=>fn(event));else return fn(event)},...options);}return native.call(this,type,fn,...options);};""")
 p=c.new_page();errors=[];p.on('pageerror',lambda e:errors.append(str(e)));p.goto(base+'index.html?db=TEST_route109_'+uuid.uuid4().hex+'#/akilli-asistan');p.wait_for_selector('#screen[data-view-ready="1"]')
 p.evaluate("async()=>{const d=await import('./js/db.js');for(let i=1;i<=2;i++)await d.put('vehicles',{id:'TEST_V'+i,name:'TEST Equal'});}")
 before=p.evaluate("async()=>await(await import('./js/db.js')).dumpAll()")
 p.evaluate("TEST_hold=true;location.hash='#/filo'");p.wait_for_function('TEST_routes.length===1');p.evaluate("location.hash='#/akilli-asistan'");p.wait_for_function('TEST_routes.length===2')
 p.fill('[data-msg]','TEST Equal kartını aç')
 p.evaluate("async()=>{TEST_hold=false;const queue=TEST_routes.splice(0);await Promise.all(queue.map(fn=>fn()));}")
 p.wait_for_selector('#screen[data-view-ready="1"]')
 assert p.locator('[data-msg]').input_value()=='TEST Equal kartını aç','Queued route events must not erase a message after rapid away-and-back navigation'
 p.click('[data-ask]');p.locator('[data-out]').get_by_text('Hangi araç?',exact=True).wait_for();assert p.locator('[data-out] [data-go]').count()==2
 assert p.evaluate("async()=>await(await import('./js/db.js')).dumpAll()")==before
 assert p.evaluate("async()=>{const previous=document.querySelector('#screen');await(await import('./js/app.js')).renderCurrent();return previous!==document.querySelector('#screen');}"),'Explicit same-route reload must still refresh the screen'
 p.evaluate("location.hash='#/filo'");p.wait_for_selector('#screen[data-view-ready="1"]');p.wait_for_selector('[data-msg]',state='detached');assert not errors,errors
 print(json.dumps({'queuedNativeRouteEvents':2,'messagePreserved':True,'duplicateVehiclesStillRequireChoice':True,'explicitReloadWorks':True,'actualNavigationWorks':True,'businessWrites':0,'pageErrors':errors}),flush=True);b.close()
