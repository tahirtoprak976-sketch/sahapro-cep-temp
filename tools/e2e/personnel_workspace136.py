"""Isolated TEST personnel dossier, existing exact-owner forms, no writes."""
import sys,uuid
from playwright.sync_api import sync_playwright
U=sys.argv[1] if len(sys.argv)>1 else 'http://localhost:8841/'
with sync_playwright() as w:
 b=w.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);c=b.new_context(viewport={'width':360,'height':800});c.add_init_script("localStorage.setItem('sp_role','boss')");p=c.new_page();p.set_default_timeout(45000);errors=[];p.on('pageerror',lambda e:errors.append(str(e)));app=U+'index.html?db=TEST_personnel136_'+uuid.uuid4().hex
 p.goto(app+'#/daha');p.wait_for_selector('#screen[data-view-ready="1"]')
 ids=p.evaluate("""async()=>{const d=await import('./js/db.js'),C=await import('./js/core.js'),a=await d.saveNew('personnel',{name:'TEST Person136'},'TEST'),off=await d.saveNew('personnel',{name:'TEST Off136',active:false},'TEST'),v=await d.saveNew('vehicles',{name:'TEST Assigned136',assignee_id:a.id},'TEST');await d.saveNew('vehicles',{name:'TEST Other136',assignee_id:off.id},'TEST');await d.put('work_records',C.newRecord({date:C.todayStr(),personnel_id:a.id,work_type:'TEST Recent136'}));await d.put('work_records',C.newRecord({date:C.todayStr(),personnel_id:off.id,work_type:'TEST OtherWork136'}));return {p:a.id,off:off.id,v:v.id};}""")
 p.wait_for_timeout(200);snap="async()=>{const r=await(await import('./js/db.js')).readSnapshot({attachments:true,drafts:true,meta:true});delete r.captured_at;return JSON.stringify(r)}";before=p.evaluate(snap)
 def nav(h):
  old=p.locator('#screen').element_handle();p.goto(app+h);p.wait_for_function('(e)=>!e.isConnected',arg=old);p.wait_for_selector('#screen[data-view-ready="1"]')
 nav('#/personel/'+ids['p']);assert p.locator('[data-personnel-workspace]').count()==1,'PERSONNEL_WORKSPACE_MISSING'
 assert p.locator('[data-personnel-workspace]').evaluate('(e)=>e.previousElementSibling.classList.contains("appbar")')
 assert p.locator('[data-personnel-action]').count()==4
 assert 'TEST Assigned136' in p.locator('[data-personnel-vehicles]').inner_text() and 'Other136' not in p.locator('[data-personnel-vehicles]').inner_text()
 assert 'TEST Recent136' in p.locator('[data-personnel-recent]').inner_text() and 'OtherWork' not in p.locator('[data-personnel-recent]').inner_text()
 for key,selector in [('leave','[data-person]'),('attendance','[data-person]'),('event','[name=personnel_id]')]:
  href=p.locator('[data-personnel-action="'+key+'"]').get_attribute('href');nav(href);assert p.input_value(selector)==ids['p'];nav('#/personel/'+ids['p'])
 href=p.locator('[data-personnel-action=payroll]').get_attribute('href');nav(href);assert 'TEST Person136' in p.locator('.appbar').inner_text();nav('#/personel/'+ids['p'])
 p.locator('[data-tab=work_records]').click();p.locator('[data-personnel-refresh]').click();assert p.locator('[data-tab=work_records]').evaluate('(e)=>e.classList.contains("on")')
 for width in [320,360,390,768]:
  p.set_viewport_size({'width':width,'height':800});assert p.evaluate('document.documentElement.scrollWidth<=innerWidth')
 nav('#/personel/'+ids['off']);assert p.locator('[data-personnel-action]').count()==0
 assert p.evaluate(snap)==before,'opening dossier or existing forms wrote records/meta/drafts/attachments'
 assert not errors,errors
 print('personnel workspace136 PASS: upper four actions, exact person forms, assigned vehicle/recent work scope, tab preservation, read-only snapshot, inactive links, mobile widths')
 b.close()
