"""Real file draft clear, immediate next operation and new-chat completion using synthetic bytes."""
import argparse,json,uuid
from urllib.parse import urlparse
from io import BytesIO
from pathlib import Path
from PIL import Image
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser();p.add_argument('url');p.add_argument('--output',default='/tmp/solo-assistant-files81-result.json');a=p.parse_args();U=a.url.rstrip('/')+'/'
origin=urlparse(U);assert origin.scheme=='http' and origin.hostname in ('localhost','127.0.0.1','::1')
assert not origin.username and not origin.password and not origin.query and not origin.fragment
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);c=b.new_context(service_workers='block',viewport={'width':390,'height':850});c.add_init_script("localStorage.setItem('sp_role','boss')")
 pg=c.new_page();errors=[];external=[]
 def route(r):
  u=urlparse(r.request.url)
  if (u.scheme,u.hostname,u.port)==(origin.scheme,origin.hostname,origin.port):r.continue_()
  else:external.append(r.request.url);r.abort()
 c.route('**/*',route)
 pg.on('pageerror',lambda e:errors.append(str(e)));pg.goto(U+'index.html?db=clear_probe_'+uuid.uuid4().hex[:12]+'#/akilli-asistan');pg.wait_for_function("()=>document.querySelector('[data-new-chat]')&&!document.querySelector('[data-new-chat]').disabled")
 raw=BytesIO();Image.new('RGB',(32,32),'purple').save(raw,format='PNG')
 pg.set_input_files('[data-photos]',{'name':'TEST-original.png','mimeType':'image/png','buffer':raw.getvalue()})
 pg.wait_for_function("async()=>{const db=await import('./js/db.js');return (await db.draftGet('assistant-pending-files'))?.files?.length===1}")
 before=pg.evaluate("async()=>JSON.stringify(await(await import('./js/db.js')).dumpAll())")
 immediate=pg.evaluate("""async()=>{const db=await import('./js/db.js'),box=document.querySelector('[data-thumbs]');await new Promise(resolve=>{const o=new MutationObserver(()=>{if(!box.querySelector('img')){o.disconnect();resolve()}});o.observe(box,{childList:true});document.querySelector('[data-clearfiles]').click()});const d=await db.draftGet('assistant-pending-files');return d?.files?.length||0}""")
 pg.fill('[data-msg]','Ödemelerim');pg.click('[data-ask]');pg.wait_for_selector('[data-answer]');pg.wait_for_function("()=>!document.querySelector('[data-ask]').disabled")
 after=pg.evaluate("async()=>JSON.stringify(await(await import('./js/db.js')).dumpAll())")
 pg.wait_for_timeout(400);pg.reload();pg.wait_for_function("()=>document.querySelector('[data-new-chat]')&&!document.querySelector('[data-new-chat]').disabled")
 recovered=pg.locator('[data-thumbs] img').count()
 # Empty task files must clear that task only, preserving unrelated originals.
 tasks=pg.evaluate("""async()=>{const db=await import('./js/db.js'),F=await import('./js/assistant-task-files.js');const f=new File(['TEST original'],'TEST.txt',{type:'text/plain'});await F.saveTaskFiles(db,'A',[f]);await F.saveTaskFiles(db,'B',[f]);await F.saveTaskFiles(db,'A',[]);return {A:await db.draftGet('assistant-task-files:A'),B:await(await F.loadTaskFiles(db,'B'))[0].text()}}""")
 result={'pendingAfterVisibleClear':immediate,'businessRecordsUnchanged':before==after,'oldFileReappeared':recovered,'taskAAbsent':tasks['A'] is None,'taskBOriginal':tasks['B']=='TEST original','pageErrors':errors}
 Path(a.output).write_text(json.dumps(result,indent=2));print(json.dumps(result));assert before==after and not errors and not external and immediate==0 and recovered==0 and tasks['A'] is None and tasks['B']=='TEST original',result
 c.close();b.close()
