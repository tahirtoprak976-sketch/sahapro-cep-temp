"""Two actual tabs, stale history stock/chat, and races inside bulk undo. No AI."""
import sys
from playwright.sync_api import sync_playwright
U=(sys.argv[1] if len(sys.argv)>1 else 'http://localhost:8842/').rstrip('/')+'/'
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);c=b.new_context()
 c.add_init_script("localStorage.setItem('sp_role','boss')")
 a=c.new_page();a.goto(U+'index.html#/akilli-asistan');a.wait_for_selector('#screen[data-view-ready="1"]')
 ids=a.evaluate("""async()=>{const d=await import('./js/db.js');const customer=await d.saveNew('customers',{name:'TEST Race'},'TEST'),v=await d.saveNew('vehicles',{name:'TEST JCB'},'TEST');await d.saveNew('fuel_tank_movements',{date:'2026-09-01',move_type:'GİRİŞ',liters:100},'TEST');return {c:customer.id,v:v.id}}""")
 z=c.new_page();z.goto(U+'index.html#/daha');z.wait_for_selector('#screen[data-view-ready="1"]')
 maker="""async ({ids,q,fuel=false})=>{
 const d=await import('./js/db.js'),C=await import('./js/core.js'),K=await import('./js/bulk-entry-core.js'),B=await import('./js/bulk-entry-db.js'),data=await d.dumpAll();
 const w={date:'2026-09-07',customer_id:ids.c,vehicle_id:ids.v,quantity:q,unit:'Saat',work_type:'Makine Çalışması',quote:'TEST Race TEST JCB '+q+' saat çalıştı'};
 const f={date:'2026-09-07',vehicle_id:ids.v,liters:40,source:'Depo Tankı',quote:'TEST JCB depodan 40 litre aldı'};
 const raw={works:[w],fuel:fuel?[f]:[]};
 const draft=await B.saveBulkDraft({version:1,id:C.uuid(),rev:0,chat_id:(await d.metaGet('assistant_conversation_v1')).id,status:'open',rows:K.normalizeBulkRows(raw,w.quote+(fuel?'\\n'+f.quote:''),data,raw),answers:{},excluded:[],deselected:[],tank_confirmed:true},{create:true});
 const plan=K.finalizeBulk(draft,await B.loadBulkData(draft));return {draft,token:K.bulkSelectionToken(plan),writes:plan.writes.length};
 }"""
 fixture=a.evaluate(maker,{'ids':ids,'q':1})
 assert fixture['writes']==1
 start=a.evaluate('Date.now()+250')
 runner="""x=>{window.bulkRace=new Promise(resolve=>setTimeout(async()=>{try{const r=await (await import('./js/bulk-entry-db.js')).commitBulk(x.fixture.draft,x.fixture.token);resolve({ok:true,saved:r.saved.length})}catch(e){resolve({ok:false,code:e.code,message:e.message})}},Math.max(0,x.start-Date.now())));return true}"""
 for page in [a,z]:page.evaluate(runner,{'fixture':fixture,'start':start})
 outcomes=[page.evaluate('async()=>await window.bulkRace') for page in [a,z]]
 assert sum(x['ok'] for x in outcomes)==1 and any(x.get('code')=='BULK_STALE' for x in outcomes),outcomes
 counts=a.evaluate("async()=>{const d=await import('./js/db.js');return {works:(await d.getAll('work_records')).length,ops:(await d.getAll('meta')).filter(x=>x.key.startsWith('op:bulk:')).length}}")
 assert counts=={'works':1,'ops':1},counts
 print('PASS two actual tabs starting together commit one source once; stale sibling has zero writes',flush=True)
 undo=a.evaluate("""async()=>{
 const d=await import('./js/db.js'),C=await import('./js/core.js'),U=await import('./js/undo.js'),target=(await d.getAll('work_records'))[0],base=IDBDatabase.prototype.transaction;
 const results=[];
 for(const kind of ['edit','link']){
  let hit=false,error;
  IDBDatabase.prototype.transaction=function(stores,mode,...rest){
   if(!hit&&mode==='readwrite'&&Array.isArray(stores)&&stores.includes('attachments')){
    hit=true;const t=base.call(this,[kind==='edit'?'work_records':'slips'],'readwrite');
    if(kind==='edit')t.objectStore('work_records').put({...target,description:'TEST concurrent edit'});
    else t.objectStore('slips').put(C.newRecord({id:'TEST-late-link',work_record_id:target.id}));
   }
   return base.call(this,stores,mode,...rest);
  };
  try{await U.applyUndo(d)}catch(e){error=e}finally{IDBDatabase.prototype.transaction=base}
  results.push({kind,hit,rejected:!!error?.message,workPreserved:!!await d.get('work_records',target.id),undoPreserved:!!await d.metaGet('assistant_undo')});
  if(kind==='edit')await d.put('work_records',target);else await d.softDelete('slips','TEST-late-link','TEST clean late relation');
 }
 await U.applyUndo(d);
 return {results,removed:!await d.get('work_records',target.id),tombstone:(await d.getAll('meta')).filter(x=>x.key.startsWith('op:bulk:')).every(x=>x.value.state==='undone')};
 }""")
 assert all(all(r[k] for k in ['hit','rejected','workPreserved','undoPreserved']) for r in undo['results']) and undo['removed'] and undo['tombstone'],undo
 print('PASS edit/relation arriving after Undo preview is rejected under write locks; unmodified undo succeeds and retains source tombstone',flush=True)
 fixture=a.evaluate(maker,{'ids':ids,'q':2,'fuel':True});assert fixture['writes']==2,fixture
 z.evaluate("async ids=>await (await import('./js/db.js')).saveFuelEvent({date:'2026-09-09',vehicle_id:ids.v,liters:80,fuel_source:'Depo Tankı'},'TEST competing actual fuel')",ids)
 stale=a.evaluate("""async f=>{const d=await import('./js/db.js'),B=await import('./js/bulk-entry-db.js');const state=async()=>JSON.stringify({d:await d.dumpAll(),a:await d.getAll('audit_log'),m:await d.getAll('meta')});const before=await state();let e;try{await B.commitBulk(f.draft,f.token)}catch(x){e=x}return {code:e?.code,unchanged:before===await state()}}""",fixture)
 assert stale=={'code':'BULK_STALE','unchanged':True},stale
 a.evaluate("async f=>await (await import('./js/bulk-entry-db.js')).closeBulkDraft(f.draft)",fixture)
 print('PASS a second tab consuming stock invalidates historical selection before any work, stock, audit or op write',flush=True)
 fixture=a.evaluate(maker,{'ids':ids,'q':3});assert fixture['writes']==1
 z.evaluate("async()=>{const d=await import('./js/db.js'),C=await import('./js/core.js');await d.metaSet('assistant_conversation_v1',{version:1,id:C.uuid(),turns:[]})}")
 stale=a.evaluate("""async f=>{const d=await import('./js/db.js');const before=JSON.stringify(await d.dumpAll());let e;try{await (await import('./js/bulk-entry-db.js')).commitBulk(f.draft,f.token)}catch(x){e=x}return {code:e?.code,unchanged:before===JSON.stringify(await d.dumpAll()),resumable:!!await (await import('./js/bulk-entry-db.js')).readBulkDraft()}}""",fixture)
 assert stale=={'code':'BULK_STALE','unchanged':True,'resumable':False},stale
 print('PASS second-tab New Chat revokes the old bulk draft; no business writes or resurrection',flush=True)
 alias=a.evaluate("""async ids=>{
 const d=await import('./js/db.js'),C=await import('./js/core.js'),K=await import('./js/bulk-entry-core.js'),B=await import('./js/bulk-entry-db.js');
 await d.saveNew('aliases',{alias:'TEST Alias',target_type:'customer',target_id:ids.c,active:true},'TEST');
 const w={date:'2026-09-07',new_customer:'TEST Alias',vehicle_id:ids.v,quantity:8,unit:'Saat',work_type:'Makine Çalışması',quote:'TEST Alias TEST JCB 8 saat çalıştı'},data=await d.dumpAll();
 const draft=await B.saveBulkDraft({version:1,id:C.uuid(),rev:0,chat_id:(await d.metaGet('assistant_conversation_v1')).id,status:'open',rows:K.normalizeBulkRows({works:[w]},w.quote,data,{works:[w]}),answers:{},excluded:[],deselected:[]},{create:true});
 const plan=K.finalizeBulk(draft,await B.loadBulkData(draft)),r=await B.commitBulk(draft,K.bulkSelectionToken(plan));
 return {saved:r.saved.length,owner:(await d.get('work_records',r.saved[0].id)).customer_id,questions:plan.questions.length};
 }""",ids)
 assert alias=={'saved':1,'owner':ids['c'],'questions':0},alias
 print('PASS approved alias resolves to the same existing customer in preview and inside the final transaction; no duplicate card or needless question',flush=True)
 b.close()
print('bulk_entry_race browser PASS',flush=True)
