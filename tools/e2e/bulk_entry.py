"""Synthetic historical work; real Chromium/IDB/SW/atomic errors, mocked Gemini only."""
import json,sys
from playwright.sync_api import sync_playwright
U=(sys.argv[1] if len(sys.argv)>1 else 'http://localhost:8842/').rstrip('/')+'/'
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 c=b.new_context(viewport={'width':390,'height':850});c.add_init_script("localStorage.setItem('sp_role','boss')")
 pg=c.new_page();errors=[];calls=[];reply={}
 pg.on('pageerror',lambda e:errors.append(str(e)))
 def mock(r):
  calls.append(r.request.post_data);r.fulfill(status=200,content_type='application/json',body=json.dumps({'candidates':[{'content':{'parts':[{'text':json.dumps(reply)}]},'finishReason':'STOP'}]}))
 c.route('https://generativelanguage.googleapis.com/**',mock)
 pg.goto(U+'index.html#/daha');pg.wait_for_selector('#screen[data-view-ready="1"]')
 pg.evaluate("async()=>await Promise.race([navigator.serviceWorker.ready,new Promise((_,r)=>setTimeout(()=>r(Error('SW timeout')),60000))])")
 pg.wait_for_function('!!navigator.serviceWorker.controller')
 ids=pg.evaluate("""async()=>{
 const db=await import('./js/db.js');
 const parent=await db.saveNew('customers',{name:'Ulaş Rondela'},'TEST'),a=await db.saveNew('customers',{name:'TEST Alfa'},'TEST'),v=await db.saveNew('vehicles',{name:'TEST JCB',type:'İş Makinesi'},'TEST');
 await db.saveNew('price_book',{unit:'Saat',price:9000,kdv_rate:20,active:true},'TEST');
 await db.saveNew('fuel_tank_movements',{date:'2026-10-01',move_type:'GİRİŞ',liters:100},'TEST');
 for(const[k,v]of Object.entries({gemini_key:'TEST',gemini_model:'gemini-2.5-flash',gemini_consent:true,gemini_daily_limit:100}))await db.metaSet(k,v);
 return {parent:parent.id,a:a.id,v:v.id};
 }""")
 def state():return pg.evaluate("async()=>{const d=await import('./js/db.js');return {data:await d.dumpAll(),audit:await d.getAll('audit_log')}}")
 def ready():pg.wait_for_function("()=>document.querySelector('[data-new-chat]')&&!document.querySelector('[data-new-chat]').disabled")
 def send(text):
  pg.fill('[data-msg]',text);pg.click('[data-ask]');pg.wait_for_function("()=>!document.querySelector('[data-ask]').disabled")
 def work(name,q):return {'date':'2026-09-07','date_source':'mesaj','new_customer':name,'vehicle_id':ids['v'],'work_type':'Makine Çalışması','unit':'Saat','quantity':q,'quote':f'{name} TEST JCB {q} saat çalıştı','description':f'{name} TEST JCB {q} saat çalıştı'}
 names=['Gürçelik Sürücü Kursu','Kemer Country No 53','Çatıcı (Ulaş Rondela)']
 reply={'works':[work(names[i%3],i+1) for i in range(20)]}
 reply['works'][2]['new_customer_parent_id']=ids['parent']
 message='Bütün işler 7 Eylül 2026 tarihine ait. Fiyatlar beklesin.\n'+'\n'.join(x['quote'] for x in reply['works'])
 pg.goto(U+'index.html#/akilli-asistan');ready();before=state();send(message);pg.wait_for_selector('[data-bulk-start]')
 pg.click('[data-bulk-start]');pg.wait_for_selector('[data-bulk-question]')
 assert pg.locator('[data-bulk-question]').count()==3,pg.inner_text('[data-bulk-review]')
 assert state()==before
 for expected in [2,1,0]:
  q=pg.locator('[data-bulk-question]').first;q.locator('[data-value]').select_option('__create');q.locator('[data-bulk-answer]').click()
  pg.wait_for_function('(n)=>document.querySelectorAll("[data-bulk-question]").length===n',arg=expected)
 assert state()==before
 assert '20 kaydı yaz' in pg.inner_text('[data-bulk-save]')
 for width in [320,390,768]:
  pg.set_viewport_size({'width':width,'height':850});assert pg.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),width
 pg.set_viewport_size({'width':390,'height':850});pg.screenshot(path='/tmp/solo-v3965-bulk-preview.png')
 c.set_offline(True);pg.click('[data-bulk-save]');pg.wait_for_selector('[data-bulk-receipt]')
 after=state();assert len(after['data']['work_records'])==len(before['data']['work_records'])+20
 created=[x for x in after['data']['customers'] if x['id'] not in {y['id'] for y in before['data']['customers']}]
 assert len(created)==3 and next(x for x in created if x['name']=='Çatıcı')['parent_customer_id']==ids['parent']
 assert all(w['price_snapshot'] is None and w.get('price_deferred_by_user') and not w.get('customer_fuel_allowance_l') for w in after['data']['work_records'])
 assert len(calls)==1 and after['data']['cash_records']==before['data']['cash_records'] and after['data']['cari_movements']==before['data']['cari_movements']
 print('PASS 20 works / 3 unknown scoped customers => exactly 3 shared questions, 3 explicitly approved cards, one offline final click; no model/list prices, money or fuel allowances; mobile widths fit',flush=True)

 # One ready job progresses; historical fuel remains durable, then resumes without re-entering work.
 c.set_offline(False)
 w=work('TEST Alfa',99);w.pop('new_customer');w['customer_id']=ids['a']
 f={'date':'2026-09-07','vehicle_id':ids['v'],'liters':40,'source':'Depo Tankı','quote':'TEST JCB depodan 40 litre mazot aldı'}
 reply={'works':[w],'fuel':[f]};send('Bütün işler 7 Eylül 2026 tarihine ait. Fiyatlar beklesin.\n'+w['quote']+'\n'+f['quote'])
 pg.click('[data-bulk-start]');pg.wait_for_selector('[data-bulk-tank]');pg.check('[data-bulk-tank]')
 pg.wait_for_function('()=>document.querySelector("[data-bulk-review]").textContent.includes("2026-09-07 tarihinde depo")')
 assert '1 kaydı yaz' in pg.inner_text('[data-bulk-save]')
 pg.click('[data-bulk-save]');pg.wait_for_selector('[data-bulk-receipt]')
 partial=state();assert len(partial['data']['work_records'])==21 and len(partial['data']['fuel_records'])==0
 c.set_offline(True);pg.reload();ready();pg.click('[data-bulk-resume]');pg.wait_for_selector('[data-bulk-review]')
 assert '1 önceden işlendi' in pg.inner_text('[data-bulk-counts]')
 assert pg.locator('[data-bulk-save]').is_disabled()
 pg.evaluate("async()=>await (await import('./js/db.js')).saveNew('fuel_tank_movements',{date:'2026-09-01',move_type:'GİRİŞ',liters:100},'TEST gerçek geçmiş giriş')")
 pg.click('[data-bulk-refresh]');pg.wait_for_function('()=>!document.querySelector("[data-bulk-save]").disabled')
 pg.click('[data-bulk-save]');pg.wait_for_selector('[data-bulk-receipt]');resumed=state()
 assert len(resumed['data']['work_records'])==21 and len(resumed['data']['fuel_records'])==1
 fuel=resumed['data']['fuel_records'][0];move=next(m for m in resumed['data']['fuel_tank_movements'] if m['id']==fuel['tank_movement_id'])
 assert fuel['event_id']==move['event_id'] and move['fuel_record_id']==fuel['id'] and move['liters']==40
 assert len(calls)==2
 print('PASS future intake cannot fund past fuel; save ready work, reload/resume offline, add actual past intake and save only remaining fuel with one paired stock event and no extra model calls',flush=True)

 # Exercise transaction failures and cross-tab concurrency through the same production adapter.
 c.set_offline(False)
 results=pg.evaluate("""async ids=>{
 const db=await import('./js/db.js'),C=await import('./js/core.js'),K=await import('./js/bulk-entry-core.js'),B=await import('./js/bulk-entry-db.js');
 const snapshot=async()=>JSON.stringify({data:await db.dumpAll(),audit:await db.getAll('audit_log'),meta:await db.getAll('meta')});
 const make=async(name,qty)=>{
  const d=await db.dumpAll(),quote=name+' TEST JCB '+qty+' saat çalıştı';
  const raw={date:'2026-09-08',new_customer:name,vehicle_id:ids.v,quantity:qty,unit:'Saat',work_type:'Makine Çalışması',quote,description:quote};
  let draft=await B.saveBulkDraft({version:1,id:C.uuid(),rev:0,chat_id:(await db.metaGet('assistant_conversation_v1')).id,status:'open',rows:K.normalizeBulkRows({works:[raw]},quote,d,{works:[raw]}),answers:{},excluded:[],deselected:[],tank_confirmed:false},{create:true});
  const p=K.finalizeBulk(draft,await B.loadBulkData(draft));for(const q of p.questions)draft=K.answerBulkQuestions(draft,q.id,{create:true});
  draft=await B.saveBulkDraft(draft);return {draft,token:K.bulkSelectionToken(K.finalizeBulk(draft,await B.loadBulkData(draft)))};
 };
 let {draft,token}=await make('TEST Atomic Fail',115),before=await snapshot(),failure=null,hit=false;
 const add=IDBObjectStore.prototype.add;
 IDBObjectStore.prototype.add=function(row,...args){const req=add.call(this,row,...args);if(this.name==='work_records'&&!hit){hit=true;add.call(this,row,...args)}return req};
 try{await B.commitBulk(draft,token)}catch(e){failure=e}finally{IDBObjectStore.prototype.add=add}
 const atomic={hit,error:failure?.message,unchanged:before===await snapshot()};
 let backupHit=false;failure=null;const open=indexedDB.open.bind(indexedDB);
 indexedDB.open=function(name,...args){if(String(name).endsWith('_recovery')){backupHit=true;throw Error('TEST backup unavailable')}return open(name,...args)};
 try{await B.commitBulk(draft,token)}catch(e){failure=e}finally{indexedDB.open=open}
 const backup={hit:backupHit,error:failure?.message,unchanged:before===await snapshot()};
 const race=await Promise.allSettled([B.commitBulk(draft,token),B.commitBulk(draft,token)]);
 const raceResult={success:race.filter(x=>x.status==='fulfilled').length,stale:race.filter(x=>x.status==='rejected'&&x.reason.code==='BULK_STALE').length,works:(await db.getAll('work_records')).filter(w=>w.description==='TEST Atomic Fail TEST JCB 115 saat çalıştı').length,cards:(await db.getAll('customers')).filter(w=>w.name==='TEST Atomic Fail').length};
 // An unrelated later job is outside this onay's undo plan.
 const extra=await db.saveNew('work_records',{date:'2026-09-09',customer_id:ids.a,vehicle_id:ids.v,work_type:'Makine Çalışması',quantity:2,unit:'Saat',description:'TEST unrelated'},'TEST');
 await (await import('./js/undo.js')).applyUndo(db);
 const receipts=await B.loadBulkData(draft),undone=K.finalizeBulk(draft,receipts);
 const undo={sourcePreserved:undone.writes.length===0&&undone.counts.recorded===1,extraPreserved:!!await db.get('work_records',extra.id),ownRemoved:!(await db.getAll('customers')).some(w=>w.name==='TEST Atomic Fail')};
 ({draft,token}=await make('TEST Stale Ref',117));await db.softDelete('vehicles',ids.v,'TEST stale reference');
 before=await snapshot();failure=null;try{await B.commitBulk(draft,token)}catch(e){failure=e}
 const stale={code:failure?.code,unchanged:before===await snapshot()};
 return {atomic,backup,race:raceResult,undo,stale};
 }""",ids)
 assert results['atomic']['hit'] and results['atomic']['error'] and results['atomic']['unchanged'],results
 assert results['backup']['hit'] and results['backup']['error'] and results['backup']['unchanged'],results
 assert results['race']=={'success':1,'stale':1,'works':1,'cards':1},results
 assert all(results['undo'].values()),results
 assert results['stale']=={'code':'BULK_STALE','unchanged':True},results
 print('PASS real duplicate-key transaction failure rolls back new card/work/audit/op/draft; recovery backup failure writes nothing; concurrent same revision commits once; scoped undo retains unrelated work and source tombstone; deleted reference rejects before writes',flush=True)
 assert not errors,errors
 b.close()
print('bulk_entry browser PASS',flush=True)
