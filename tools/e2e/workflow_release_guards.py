"""Real UI/IDB regression for the five independently reproduced v3.9.76 defects."""
import argparse,io,json,os,uuid
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright
from reportlab.pdfgen import canvas

p=argparse.ArgumentParser(description=__doc__)
p.add_argument('url',nargs='?',default='http://localhost:8841/')
p.add_argument('--artifacts',default='/tmp/solo-workflow-release-guards')
a=p.parse_args();BASE=a.url.rstrip('/')+'/';origin=urlparse(BASE)
assert origin.scheme=='http' and origin.hostname in ('localhost','127.0.0.1','::1')
assert not origin.username and not origin.password and not origin.query and not origin.fragment
out=Path(a.artifacts);out.mkdir(parents=True,exist_ok=True)
buf=io.BytesIO();pdf=canvas.Canvas(buf);pdf.drawString(40,780,'TEST original work document');pdf.save();PDF=buf.getvalue()
results={};external=[];errors=[]
with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),args=['--no-sandbox'])
 ctx=browser.new_context(viewport={'width':390,'height':850},service_workers='block')
 ctx.add_init_script("localStorage.setItem('sp_role','boss')")
 def route(r):
  u=urlparse(r.request.url)
  if (u.scheme,u.hostname,u.port)==(origin.scheme,origin.hostname,origin.port):r.continue_()
  else:external.append(r.request.url);r.abort()
 ctx.route('**/*',route)
 page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
 def fresh(label):
  name='wf_'+label+'_'+uuid.uuid4().hex[:12]
  page.goto(BASE+'README.md?db='+name)
  return name
 seed='''async()=>{
  const db=await import('./js/db.js'),C=await import('./js/core.js'),S=await import('./js/solo-db.js'),date=C.todayStr();
  const c=await db.saveNew('customers',{name:'TEST Review Customer'},'TEST'),v=await db.saveNew('vehicles',{name:'TEST Review Truck',type:'Kamyon'},'TEST'),p=await db.saveNew('personnel',{name:'TEST Review Driver'},'TEST');
  const plan=await S.saveShift({date,customer_id:c.id,vehicle_id:v.id,personnel_id:p.id,task:'TEST plan',start:'08:00',end:'10:00',break_minutes:0},'TEST plan key');
  return {date,c:c.id,v:v.id,p:p.id,plan};
 }'''
 # Real second-tab cancellation before actual Save: there must be no priced work/audit/op residue.
 name=fresh('cancel');ids=page.evaluate(seed)
 page.goto(BASE+'index.html?db='+name+'#/isler/new?plan_id='+ids['plan']['id'])
 page.wait_for_selector('[data-plan-source]');page.fill('[name=manual_price]','100');page.fill('[name=manual_kdv]','0')
 second=ctx.new_page();second.goto(BASE+'README.md?db='+name)
 second.evaluate("async id=>await(await import('./js/solo-db.js')).shiftStatus(id,'İptal','TEST cancellation in second tab')",ids['plan']['id'])
 before=second.evaluate("async()=>JSON.stringify(await(await import('./js/db.js')).dumpAll())")
 page.click('[data-save]');page.wait_for_function("()=>document.body.innerText.includes('Plan artık açık değil')")
 assert second.evaluate("async()=>JSON.stringify(await(await import('./js/db.js')).dumpAll())")==before
 assert page.evaluate("async()=> (await(await import('./js/db.js')).listActive('work_records')).length")==0
 page.screenshot(path=str(out/'cancelled-plan-no-work.png'),full_page=True);second.close()
 results['cancelled_plan_zero_writes']=True

 # Inject an actual store failure AFTER the work add is queued, then exercise retry/race/conflict.
 name=fresh('atomic');ids=page.evaluate(seed)
 atomic=page.evaluate('''async i=>{
  const db=await import('./js/db.js');
  const fields={date:i.date,customer_id:i.c,vehicle_id:i.v,personnel_id:i.p,work_type:'Makine Çalışması',quantity:2,unit:'Saat',plan_assignment_id:i.plan.id,price_snapshot:{unit_price:100,amount:200,kdv_rate:0,kdv_included:false}};
  const before=JSON.stringify(await db.dumpAll()),original=IDBObjectStore.prototype.put;
  let rejected=false;
  IDBObjectStore.prototype.put=function(value,...args){if(this.name==='shift_assignments'&&value.work_record_id)throw new DOMException('TEST plan store failure','UnknownError');return original.call(this,value,...args);};
  try{await db.savePlannedWork(i.plan,fields);}catch(e){rejected=true;}finally{IDBObjectStore.prototype.put=original;}
  const rolledBack=before===JSON.stringify(await db.dumpAll())&&await db.metaGet('op:shift-work:'+i.plan.id)===null;
  const posted=await Promise.all([db.savePlannedWork(i.plan,fields),db.savePlannedWork(i.plan,fields)]);
  const count=(await db.listActive('work_records')).length,plan=await db.get('shift_assignments',i.plan.id);
  let conflict=false;try{await db.savePlannedWork(i.plan,{...fields,price_snapshot:{...fields.price_snapshot,unit_price:150,amount:300}});}catch(e){conflict=e.code==='OP_CONFLICT';}
  let bypass=false;try{await db.saveNew('work_records',fields);}catch{bypass=true;}
  return {rejected,rolledBack,count,sameId:posted[0].id===posted[1].id,existing:posted.filter(x=>x._existing).length,linked:plan.work_record_id===posted[0].id,conflict,bypass};
 }''',ids)
 assert all(atomic[k] for k in ('rejected','rolledBack','sameId','linked','conflict','bypass')),atomic
 assert atomic['count']==1 and atomic['existing']==1,atomic
 results['atomic_plan_failure_retry_race']=atomic

 # Open + recovery tasks must survive real meta transactions with >20 completed history items.
 name=fresh('tasks')
 tasks=page.evaluate('''async()=>{
  const db=await import('./js/db.js'),T=await import('./js/assistant-task.js'),F=await import('./js/assistant-task-files.js');
  await db.metaSet('assistant_conversation_v1',{id:'TEST-OPEN-CHAT',turns:[]});
  const open=await T.saveTaskProposal(db,{epoch:'TEST-OPEN-CHAT',previous:null,result:{goal:'TEST retained open task',plan:{works:[{quantity:1}]}},source:'TEST retained source'});
  const file=new File(['%PDF-1.4\\nstartxref\\n0\\n%%EOF'],'TEST-retained.pdf',{type:'application/pdf'});await F.savePendingFiles(db,[file]);await F.attachFilesToTask(db,open.id);
  const recoveryDraft=await T.saveTaskProposal(db,{epoch:'TEST-OPEN-CHAT',previous:open,result:{goal:'TEST recovery must remain visible',plan:{works:[{quantity:1}]}},source:'TEST recovery'});
  const recoveryApplying=await T.transitionTask(db,recoveryDraft,'applying');
  const recovery=await T.transitionTask(db,recoveryApplying,'review','TEST incomplete result');
  for(let n=0;n<25;n++){
   const chat='TEST-CLOSED-'+n;await db.metaSet('assistant_conversation_v1',{id:chat,turns:[]});
   const draft=await T.saveTaskProposal(db,{epoch:chat,previous:null,result:{goal:chat,plan:{works:[{quantity:1}]}},source:'TEST'});
   const applying=await T.transitionTask(db,draft,'applying');await T.transitionTask(db,applying,'complete','TEST completed');
  }
  const center=await db.metaGet('assistant_tasks_v1');return {id:open.id,recovery:recovery.id,retained:center.items.some(t=>t.id===open.id),closed:center.items.filter(t=>t.status==='complete').length};
 }''')
 assert tasks['retained'] and tasks['closed']==20,tasks
 page.goto(BASE+'index.html?db='+name+'#/akilli-asistan');page.wait_for_selector('[data-task-activate="'+tasks['id']+'"]')
 assert 'TEST incomplete result' in page.locator('[data-task-id="'+tasks['recovery']+'"]').inner_text()
 page.locator('[data-task-activate="'+tasks['id']+'"]').click();page.wait_for_selector('[data-thumbs] img')
 state=page.evaluate("async()=>{const db=await import('./js/db.js');return {id:(await db.metaGet('assistant_task_v1')).id,files:(await db.draftGet('assistant-pending-files')).files.length};}")
 assert state=={'id':tasks['id'],'files':1},state
 results['open_task_and_file_survive_history_and_reload']=True

 # Actual generic-document UI -> owner record -> work-file link -> safe original document detail.
 name=fresh('document');ids=page.evaluate(seed)
 work=page.evaluate("async i=>await(await import('./js/db.js')).saveNew('work_records',{date:i.date,customer_id:i.c,vehicle_id:i.v,work_type:'Makine Çalışması',unit:'Saat',quantity:1},'TEST')",ids)
 page.goto(BASE+'index.html?db='+name+'#/belge-bagla?work_id='+work['id']+'&kind=generic');page.wait_for_selector('[data-link-form]')
 page.select_option('[name=owner_type]','work');page.select_option('[name=owner_id]',work['id']);page.fill('[name=doc_no]','TEST-ORIGINAL-DOC')
 page.set_input_files('[name=document]',{'name':'TEST-original.pdf','mimeType':'application/pdf','buffer':PDF});page.wait_for_function("()=>!document.querySelector('[data-link-save]').disabled");page.click('[data-link-save]')
 page.wait_for_function("()=>location.hash.startsWith('#/belgeler/')")
 document=page.evaluate("async()=>(await(await import('./js/db.js')).listActive('documents'))[0]")
 page.goto(BASE+'index.html?db='+name+'#/isler/'+work['id']);page.wait_for_selector('[data-work-file-documents]')
 assert 'TEST-ORIGINAL-DOC' in page.locator('[data-work-file-documents]').inner_text()
 assert 'Fiş / belge dayanağı var' in page.locator('[data-work-file-status]').inner_text()
 page.locator('[data-work-file-documents] a').click();page.wait_for_function("()=>location.hash==='#/belgeler/"+document['id']+"'")
 original=page.evaluate("async id=>Array.from(new Uint8Array(await(await(await import('./js/db.js')).attachmentsFor('document',id))[0].blob.arrayBuffer()))",document['id'])
 assert bytes(original)==PDF
 results['work_document_visible_and_original_unchanged']=True

 # Explicitly different quote on same site cannot contribute work, claims or payments.
 name=fresh('scope')
 scope=page.evaluate('''async()=>{
  const db=await import('./js/db.js'),C=await import('./js/core.js'),date=C.addDays(C.todayStr(),-2);
  const c=await db.saveNew('customers',{name:'TEST Scope Customer'},'TEST'),site=await db.saveNew('sites',{customer_id:c.id,name:'TEST Shared Site'},'TEST');
  const v1=await db.saveNew('vehicles',{name:'TEST V1'},'TEST'),v2=await db.saveNew('vehicles',{name:'TEST V2'},'TEST'),p1=await db.saveNew('personnel',{name:'TEST P1'},'TEST'),p2=await db.saveNew('personnel',{name:'TEST P2'},'TEST');
  for(const [id,number] of [['Q1',1],['Q2',2]])await db.put('quotes',{id,quote_no:number,customer_id:c.id,site_id:site.id,date,type:'UNIT_PRICE',status:'Kabul'});
  await db.saveNew('work_records',{id:'W1',quote_id:'Q1',date,customer_id:c.id,site_id:site.id,vehicle_id:v1.id,personnel_id:p1.id,work_type:'Makine Çalışması',quantity:1,unit:'Saat'},'TEST');
  await db.saveNew('work_records',{id:'W2',quote_id:'Q2',date,customer_id:c.id,site_id:site.id,vehicle_id:v2.id,personnel_id:p2.id,work_type:'Makine Çalışması',quantity:9,unit:'Saat'},'TEST');
  await db.put('cash_records',{id:'PAY-Q2',cash_type:'Müşteriden Para Alındı',customer_id:c.id,work_record_id:'W2',amount:4000,date});
  return {date,v:v1.id,p:p1.id};
 }''')
 page.goto(BASE+'index.html?db='+name+'#/teklif/Q1');page.wait_for_selector('[data-deal-chain]')
 assert '1 gerçekleşen iş' in page.locator('[data-chain-stage=work]').inner_text()
 assert 'zincire tahsisli değil' in page.locator('[data-chain-stage=payment]').inner_text()
 assert 'PAY-Q2' not in (page.locator('[data-chain-stage=payment] a').get_attribute('href') or '')
 results['separate_quotes_do_not_share_work_or_payment']=True
 page.goto(BASE+'index.html?db='+name+'#/?op_tab=close&op_date='+scope['date']+'&op_vehicle='+scope['v']+'&op_personnel='+scope['p'])
 page.wait_for_selector('[data-scoped-close]')
 assert '1 iş' in page.locator('[data-scoped-close]').inner_text() and '1 Saat' in page.locator('[data-scoped-close]').inner_text()
 assert '2 iş' in page.locator('[data-company-close]').inner_text() and '10 Saat' in page.locator('[data-company-close]').inner_text()
 assert 'Tüm araçlar ve personel' in page.locator('[data-company-close]').inner_text()
 page.screenshot(path=str(out/'filtered-and-company-closing.png'),full_page=True)
 page.locator('[data-company-close] a').click();page.wait_for_selector('[data-e-form] [name=date]')
 assert page.input_value('[data-e-form] [name=date]')==scope['date']
 results['filtered_and_company_closing_separate_with_exact_date']=True
 assert not external and not errors,{'external':external,'errors':errors}
 (out/'result.json').write_text(json.dumps({'synthetic_only':True,'results':results,'external_requests':external,'page_errors':errors},ensure_ascii=False,indent=2)+'\n')
 print(json.dumps(results,ensure_ascii=False,indent=2),flush=True)
 ctx.close();browser.close()
