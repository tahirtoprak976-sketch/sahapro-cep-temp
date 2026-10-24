"""Real file/IDB warranty failures and reader cancellation/limits; no external AI."""
import sys
from playwright.sync_api import sync_playwright
U=(sys.argv[1] if len(sys.argv)>1 else 'http://localhost:8842/').rstrip('/')+'/'
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);c=b.new_context();c.add_init_script("localStorage.setItem('sp_role','boss')")
 pg=c.new_page();errors=[];pg.on('pageerror',lambda e:errors.append(str(e)))
 pg.goto(U+'index.html#/daha');pg.wait_for_selector('#screen[data-view-ready="1"]')
 r=pg.evaluate("""async()=>{
 const d=await import('./js/db.js'),P=await import('./js/parts-db.js'),C=await import('./js/core.js');
 const vehicle=await d.saveNew('vehicles',{name:'TEST Warranty Guards'},'TEST');
 const image=async color=>{const c=document.createElement('canvas');c.width=20;c.height=20;c.getContext('2d').fillStyle=color;c.getContext('2d').fillRect(0,0,20,20);const blob=await new Promise(r=>c.toBlob(r,'image/png'));return new File([blob],'test-photo.jpg',{type:''})};
 const file=await image('red'),extra=await image('blue');
 const prepared=await P.preparePartFiles([file]);
 const sniffed=prepared[0].type==='image/png'&&prepared[0].blob.type==='image/png'&&prepared[0].size===file.size;
 const f={vehicle_id:vehicle.id,date:'2026-09-07',description:'TEST Akü',quantity:2,unit_price:1000,cost_mode:'new_expense',warranty_start:'2026-09-07',warranty_until:'2028-09-07'};
 const state=async()=>JSON.stringify({d:await d.dumpAll(),a:await d.getAll('audit_log')});
 const inject=async run=>{const before=await state(),add=IDBObjectStore.prototype.add;let hit=false,error;IDBObjectStore.prototype.add=function(row,...args){const r=add.call(this,row,...args);if(this.name==='attachments'&&!hit){hit=true;add.call(this,row,...args)}return r};try{await run()}catch(e){error=e}finally{IDBObjectStore.prototype.add=add}return {hit,error:error?.message,unchanged:before===await state()}};
 const createAbort=await inject(()=>P.saveSparePart(f,[file],'TEST create abort'));
 const part=await P.saveSparePart(f,[file],'TEST same key');
 const repeat=await P.saveSparePart({...f,allow_shared_document:false},[file],'TEST same key');
 let conflict;try{await P.saveSparePart({...f,quantity:3},[file],'TEST same key')}catch(e){conflict=e.message}
 const before=await state(),denied=[];
 for(const allow of [false,'true','on']){try{await P.saveSparePart({...f,allow_shared_document:allow},[file],'TEST dup '+allow)}catch(e){denied.push(e.message)}}
 const duplicate={rejected:denied.length===3,unchanged:before===await state()};
 const shared=await P.saveSparePart({...f,description:'TEST different battery',cost_mode:'tracking',unit_price:null,allow_shared_document:true},[file],'TEST explicit share');
 const updateAbort=await inject(()=>P.updatePartWarranty(part.id,{...part,warranty_until:'2029-09-07'},part.updated_at,[extra]));
 const current=await P.updatePartWarranty(part.id,{...part,brand:'TEST concurrent'},part.updated_at);
 let stale;const beforeStale=await state();try{await P.updatePartWarranty(part.id,{...part,warranty_until:'2030-09-07'},part.updated_at,[extra])}catch(e){stale=e.message}const staleUnchanged=beforeStale===await state();
 const raceBefore=await d.dumpAll(),race=await Promise.allSettled([P.saveSparePart({...f,description:'TEST race'},[extra],'TEST race 1'),P.saveSparePart({...f,description:'TEST race'},[extra],'TEST race 2')]),raceAfter=await d.dumpAll();
 const raced={success:race.filter(x=>x.status==='fulfilled').length,reject:race.filter(x=>x.status==='rejected').length,parts:raceAfter.maintenance_parts.length-raceBefore.maintenance_parts.length,expenses:raceAfter.expense_records.length-raceBefore.expense_records.length};
 // Read timeout applies to a body that never finishes, not only response headers.
 for(const[k,v]of Object.entries({gemini_key:'TEST',gemini_model:'gemini-2.5-flash',gemini_consent:true,gemini_daily_limit:50}))await d.metaSet(k,v);
 const R=await import('./js/part-document-read.js'),timer=globalThis.setTimeout;let timeout;
 globalThis.setTimeout=(fn,ms,...args)=>timer(fn,ms===45000?5:ms,...args);
 try{await R.readPartDocument(prepared[0],{db:d,data:await d.dumpAll(),fetchImpl:async(url,init)=>new Response(new ReadableStream({start(controller){if(init.signal.aborted)controller.error(new DOMException('abort','AbortError'));else init.signal.addEventListener('abort',()=>controller.error(new DOMException('abort','AbortError')),{once:true})}}),{status:200})})}catch(e){timeout=e.message}finally{globalThis.setTimeout=timer}
 let big;try{await R.readPartDocument(prepared[0],{db:d,data:await d.dumpAll(),fetchImpl:async()=>new Response('X'.repeat(2*1024*1024+1),{status:200})})}catch(e){big=e.code}
 const readsUnchanged=await state();await d.metaSet('gemini_consent',false);let fetches=0,consent;
 try{await R.readPartDocument(prepared[0],{db:d,data:await d.dumpAll(),fetchImpl:async()=>{fetches++;return new Response('{}')}})}catch(e){consent=e.message}
 const B=await import('./js/backup.js'),UI=await import('./js/part-document-ui.js');await UI.stagePartDocuments({db:d,go:()=>{}},[file]);
 const backup=await B.fullBackup(d,{attachments:'base64'});
 return {vid:vehicle.id,pid:part.id,sniffed,createAbort,repeat:repeat.id===part.id,conflict,duplicate,explicitShare:shared.id!==part.id,updateAbort,stale,staleUnchanged,raced,timeout,big,fetches,consent,readBusinessUnchanged:readsUnchanged===await state(),backup,draftCoverage:backup.coverage.parts_draft_files_not_included};
 }""")
 assert r['sniffed'] and r['repeat'] and r['conflict'] and r['explicitShare'],r
 for key in ['createAbort','updateAbort']:assert r[key]['hit'] and r[key]['error'] and r[key]['unchanged'],{key:r[key]}
 assert r['duplicate']=={'rejected':True,'unchanged':True},r['duplicate']
 assert 'başka ekranda' in r['stale'] and r['staleUnchanged'],r['stale']
 assert r['raced']=={'success':1,'reject':1,'parts':1,'expenses':1},r['raced']
 assert '45 saniye' in r['timeout'] and r['big']=='RESPONSE_LIMIT' and r['fetches']==0 and r['consent'] and r['readBusinessUnchanged'],{k:r[k] for k in ['timeout','big','fetches','consent','readBusinessUnchanged']}
 assert r['draftCoverage']==1
 print('PASS content-sniffed MIME and original bytes; real create/update request errors roll back every part/expense/file/audit; retries and explicit sharing; two racing uploads create one part/cost; stale edit rejects; body deadline/response cap/consent failure preserve business data; unsaved source coverage is honest',flush=True)
 pg.goto(U+'index.html#/yedek-parca/'+r['pid']+'/garanti');pg.wait_for_selector('[data-part-reader]');pg.wait_for_function('()=>!document.querySelector("[data-part-form]").inert')
 pg.fill('[name=brand]','TEST local unsaved')
 pg.evaluate("""async pid=>{const d=await import('./js/db.js'),P=await import('./js/parts-db.js'),old=await d.get('maintenance_parts',pid);await P.updatePartWarranty(pid,{...old,brand:'TEST other tab'},old.updated_at)}""",r['pid'])
 pg.locator('[data-part-form] [type=submit]').click();pg.wait_for_selector('[data-part-refresh]');pg.click('[data-part-refresh]')
 pg.wait_for_function('()=>document.querySelector("[name=brand]").value==="TEST other tab"')
 pg.fill('[name=brand]','TEST reviewed');pg.locator('[data-part-form] [type=submit]').click();pg.wait_for_selector('[data-add-files]')
 assert 'TEST reviewed' in pg.inner_text('#screen')
 print('PASS stale warranty UI offers current record recovery, retains document draft, and requires renewed review before saving',flush=True)
 clean=b.new_context();clean.add_init_script("localStorage.setItem('sp_role','boss')");p2=clean.new_page();p2.goto(U+'index.html#/daha');p2.wait_for_selector('#screen[data-view-ready="1"]')
 restored=p2.evaluate("""async backup=>{const d=await import('./js/db.js'),B=await import('./js/backup.js');await B.restoreBackup(d,backup);return {parts:(await d.listActive('maintenance_parts')).length,files:(await d.getAll('attachments')).length,expenses:(await d.listActive('expense_records')).length}}""",r['backup'])
 assert restored=={'parts':3,'files':3,'expenses':2},restored
 assert not errors,errors;b.close()
print('part_document_guards browser PASS',flush=True)
