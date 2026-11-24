"""Actual schema8 -> schema8 installed SW upgrade, synthetic records and bytes."""
import argparse,functools,hashlib,io,json,shutil,subprocess,tarfile,tempfile,threading,uuid
from pathlib import Path,PurePosixPath
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright
from PIL import Image
ap=argparse.ArgumentParser();ap.add_argument('--source-root',default='.');ap.add_argument('--baseline-version',default='SAHAPRO SOLO v3.10.16');ap.add_argument('--baseline-ref',default='87411c0642bab0ed3f3f1acbaf6f5d5865fc3567');ap.add_argument('--artifacts',default='/tmp/solo-maintenance-upgrade116');a=ap.parse_args();root=Path(a.source_root).resolve();out=Path(a.artifacts);out.mkdir(parents=True,exist_ok=True)
with tempfile.TemporaryDirectory(prefix='solo-maintenance-upgrade116-') as tmp:
 old=Path(tmp)/'old';old.mkdir();archive=subprocess.check_output(['git','archive',a.baseline_ref],cwd=root)
 with tarfile.open(fileobj=io.BytesIO(archive)) as t:
  # Python3.11 in the existing CI image has no extractall(filter=...).
  # Materialize only regular repository files; reject traversal and archive links.
  for member in t.getmembers():
   path=PurePosixPath(member.name)
   if path.is_absolute() or '..' in path.parts:raise ValueError('Unsafe archive path')
   if member.name.startswith('data/transfers/'):continue
   target=old.joinpath(*path.parts)
   if member.isdir():target.mkdir(parents=True,exist_ok=True)
   elif member.isfile():
    target.parent.mkdir(parents=True,exist_ok=True)
    with t.extractfile(member) as stream:target.write_bytes(stream.read())
   else:raise ValueError('Only regular repository files are supported')
 active={'root':old}
 class Handler(SimpleHTTPRequestHandler):
  def __init__(self,*args,**kwargs):super().__init__(*args,directory=str(active['root']),**kwargs)
  def do_GET(self):
   self.directory=str(active['root'])
   if 'If-Modified-Since' in self.headers:del self.headers['If-Modified-Since']
   super().do_GET()
  def log_message(self,*args):pass
  def end_headers(self):self.send_header('Cache-Control','no-store');super().end_headers()
 server=ThreadingHTTPServer(('127.0.0.1',0),Handler);threading.Thread(target=server.serve_forever,daemon=True).start();base=f'http://127.0.0.1:{server.server_port}/'
 with sync_playwright() as w:
  b=w.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);c=b.new_context(viewport={'width':360,'height':850});c.add_init_script("localStorage.setItem('sp_role','boss')");c.route('**/*',lambda r:r.continue_() if urlparse(r.request.url).hostname=='127.0.0.1' else r.abort());p=c.new_page();p.on('console',lambda m: print('CONSOLE',m.type,m.text,flush=True) if m.type=='error' else None);errors=[];p.on('pageerror',lambda e:errors.append(str(e)));app=base+'index.html?db=upgrade116_'+uuid.uuid4().hex[:12]+'#/daha'
  p.goto(app);p.wait_for_selector('#screen[data-view-ready="1"]');assert p.evaluate("async()=>(await import('./js/core.js')).SCHEMA_VERSION")==8
  old_version=p.evaluate("async()=>(await import('./js/core.js')).APP_VERSION");assert old_version==a.baseline_version
  p.evaluate("async()=>{const d=await import('./js/db.js');const v=await d.saveNew('vehicles',{name:'TEST upgrade116',type:'Ekskavatör',machine_hours:4502,meter_date:'2026-01-01'},'TEST');await d.saveNew('maintenance_records',{date:'2026-01-01',vehicle_id:v.id,description:'TEST original maintenance',status:'Tamamlandı',maint_type:'Bakım',cost:77,km_hours:'TEST original note'},'TEST');await d.metaSet('TEST-maintenance116-draft',{text:'TEST unsaved source',untouched:true});}")
  p.evaluate("""async bytes=>{const d=await import('./js/db.js'),m=(await d.getAll('maintenance_records'))[0];await d.addAttachment('maintenance',m.id,new File([new Uint8Array(bytes)],'TEST-original116.png',{type:'image/png'}));await(await import('./js/solo-db.js')).saveMeter({vehicle_id:m.vehicle_id,date:'2026-01-01',kind:'hours',value:4502,note:'TEST original confirmed reading'},'TEST-original-meter116');const c=await d.openDB();await new Promise((ok,no)=>{const t=c.transaction('drafts','readwrite');t.objectStore('drafts').put({form:'TEST-maintenance116-form',values:{description:'TEST original unsaved form'},updated_at:'2026-01-01T00:00:00.000Z'});t.oncomplete=ok;t.onabort=t.onerror=()=>no(t.error);});}""",[137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 3, 0, 0, 0, 3, 8, 2, 0, 0, 0, 217, 74, 34, 232, 0, 0, 0, 23, 73, 68, 65, 84, 120, 156, 99, 148, 179, 137, 98, 96, 96, 96, 96, 96, 96, 98, 128, 1, 4, 11, 0, 19, 236, 0, 186, 88, 29, 151, 108, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130])
  snap="""async()=>{const d=await import('./js/db.js'),x=await d.readSnapshot({meta:true,drafts:true,attachments:true});delete x.captured_at;for(const a of x.attachments)if(a.blob){a.bytes=Array.from(new Uint8Array(await a.blob.arrayBuffer()));delete a.blob;}return x;}"""
  before=p.evaluate(snap);assert len(before['attachments'])==1 and before['attachments'][0]['bytes'] and len(before['drafts'])==1 and len(before['data']['meter_readings'])==1;p.evaluate('async()=>await navigator.serviceWorker.ready');p.reload();p.wait_for_selector('#screen[data-view-ready="1"]');p.wait_for_function('()=>!!navigator.serviceWorker.controller');assert p.evaluate(snap)==before
  p.wait_for_function("()=>typeof window.__swCheck==='function'");p.evaluate('async()=>await window.__swCheck()')
  active['root']=root;registration=p.evaluate_handle('async()=>await navigator.serviceWorker.getRegistration()');p.evaluate('async r=>await r.update()',registration);
  try:p.wait_for_function('r=>!!r.waiting',arg=registration,timeout=60000)
  except Exception:
   print('WORKER DIAGNOSTIC',p.evaluate("async()=>({registrations:(await navigator.serviceWorker.getRegistrations()).map(r=>({scope:r.scope,active:r.active?.state,waiting:r.waiting?.state,installing:r.installing?.state})),caches:await caches.keys(),sw:(await fetch('./sw.js',{cache:'reload'}).then(r=>r.text())).slice(0,200)})"),flush=True);raise
  assert p.evaluate("async()=>(await import('./js/core.js')).APP_VERSION")==old_version
  p.wait_for_selector('#update-bar [data-upd]')
  with p.expect_navigation(wait_until='domcontentloaded'):p.click('#update-bar [data-upd]')
  p.wait_for_selector('#screen[data-view-ready="1"]');assert p.evaluate("async()=>(await import('./js/core.js')).APP_VERSION")=='SAHAPRO SOLO v3.10.22';assert p.evaluate(snap)==before
  assert p.evaluate("async()=>(await import('./js/core.js')).SCHEMA_VERSION")==8
  cached=p.evaluate("async()=>{const names=await caches.keys(),name=names.find(x=>x.includes('busy-recovery-122')),c=await caches.open(name);return {name,files:await Promise.all(['maintenance-review-core.js','maintenance-review-db.js','maintenance-review-ui.js','tank-report.js'].map(async f=>{const r=await c.match('./js/'+f);return {f,text:r?await r.text():null};}))};}")
  for item in cached['files']:assert item['text']==(root/'js'/item['f']).read_text()
  c.set_offline(True);p.reload();p.wait_for_selector('#screen[data-view-ready="1"]');assert p.evaluate(snap)==before;assert not errors,errors;p.screenshot(path=str(out/'offline-upgraded.png'),full_page=True);(out/'result.json').write_text(json.dumps({'old_version':old_version,'new_version':'SAHAPRO SOLO v3.10.22','schema':8,'exact_preservation':True,'offline':True,'worker':cached['name'],'errors':errors},indent=2));print('upgrade maintenance116 PASS: installed schema8 preserved exactly; original records/meta/drafts/attachments untouched; new worker and all3 modules exact; offline reopen',flush=True);b.close()
 server.shutdown()
