"""Real Chromium/IndexedDB. Synthetic PDF/data; all Gemini responses mocked."""
import json,time
from playwright.sync_api import sync_playwright
U='http://localhost:8841/'
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 ctx=b.new_context(viewport={'width':412,'height':900},service_workers='block');ctx.add_init_script("localStorage.setItem('sp_role','boss')")
 pg=ctx.new_page();errors=[];calls=[];pg.on('pageerror',lambda e:errors.append(str(e)))
 pg.goto(U);pg.wait_for_timeout(1300)
 ids=pg.evaluate("""async()=>{const db=await import('./js/db.js');const sec=await import('./js/security-core.js');await db.metaSet('gemini_key','TEST');await db.metaSet('gemini_model','gemini-2.5-flash');await db.metaSet('gemini_consent',true);await db.metaSet('sec_lock',{...(await sec.hashSecret('482917')),idle_min:30,away_min:15});const c=await db.saveNew('customers',{name:'Örnek İnşaat'},'TEST');const v=await db.saveNew('vehicles',{name:'34FLOW123',plate:'34FLOW123'},'TEST');const p=await db.saveNew('personnel',{name:'Deneme Operatör'},'TEST');const w=await db.saveNew('work_records',{date:'2026-05-11',customer_id:c.id,vehicle_id:v.id,personnel_id:p.id,unit:'Saat',quantity:3,work_type:'Kazı',price_snapshot:{unit_price:1500,kdv_rate:20,kdv_included:false,amount:4500,locked:true}},'TEST');return {c:c.id,v:v.id,p:p.id,w:w.id};}""")
 base={'kind':'work','date':'2026-05-11','customer_name':'Örnek Şirket','personnel_name':'Deneme Abi','vehicle_name':'34FLOW123','page':1,'unit':'Saat','work_type':'Kazı'}
 raw={'rows':[{**base,'quantity':2,'quote':'Örnek Şirket Deneme Abi 2 saat kazı'},{**base,'quantity':3,'quote':'Örnek Şirket Deneme Abi 3 saat kazı'},{'kind':'fuel','date':'2026-05-11','vehicle_name':'34FLOW123','page':2,'liters':210,'quote':'210 litre mazot alındı'}],'notes':[],'totals':[]}
 def gem(r):
  calls.append(1);r.fulfill(status=200,content_type='application/json',body=json.dumps({'candidates':[{'content':{'parts':[{'text':json.dumps(raw)}]},'finishReason':'STOP'}]}))
 pg.route('https://generativelanguage.googleapis.com/**',gem)
 def unlock():
  if pg.locator('#lock-root [data-pw]').count():pg.fill('#lock-root [data-pw]','482917');pg.click('#lock-root [data-go-un]')
 pg.goto(U+'index.html#/akilli-asistan/pdf-gecmis');pg.wait_for_timeout(1700);unlock();pg.wait_for_selector('[data-pdf-file]')
 pg.locator('[data-pdf-file]').set_input_files({'name':'TEST-flow.pdf','mimeType':'application/pdf','buffer':b'%PDF-1.4\n% WORKFLOW TEST\n%%EOF'})
 pg.check('[data-pdf-consent]');pg.click('[data-pdf-read]');pg.locator('[data-pdf-row="2"]').wait_for()
 def card(i):return pg.locator('[data-pdf-row="'+str(i)+'"]')
 for field,target in [('customer_id',ids['c']),('personnel_id',ids['p'])]:
  card(0).locator('[name='+field+']').select_option(target);card(0).locator('[data-pdf-map-apply]').wait_for();card(0).locator('[data-pdf-map-apply]').click();pg.locator('.sheet [data-x="1"]').wait_for();pg.locator('.sheet [data-x="1"]').click()
  pg.wait_for_timeout(250);assert card(1).locator('[name='+field+']').input_value()==target
 assert pg.evaluate("async()=>{const d=await import('./js/db.js');return (await d.listActive('work_records')).length}")==1
 print('PASS one approved mapping fills repeated blank customer/personnel aliases; no work writes')
 card(2).locator('[data-pdf-guide-open]').click();card(2).locator('[data-pdf-answer]').wait_for()
 card(2).locator('[data-pdf-answer]').select_option('Müşteri Verdi');card(2).locator('[data-pdf-answer-next]').click()
 card(2).get_by_text('Mazotu hangi müşteri verdi?',exact=True).wait_for()
 card(2).locator('[data-pdf-answer]').select_option(ids['c']);card(2).locator('[data-pdf-answer-next]').click()
 card(2).get_by_text('Zorunlu alanlar tamam.',exact=False).wait_for()
 assert card(2).locator('[name=fuel_source]').input_value()=='Müşteri Verdi'
 assert card(2).locator('[name=customer_id]').input_value()==ids['c']
 print('PASS short guided source/customer questions fill only the draft')
 # Unarchived PDF must reopen from the draft-file store, not from an archive fallback.
 pg.reload();pg.wait_for_timeout(1300);unlock();pg.locator('[data-pdf-resume]').wait_for();pg.locator('[data-pdf-resume]').first.click();card(2).wait_for()
 assert len(calls)==1 and pg.locator('[data-pdf-result] a').get_attribute('href').startswith('blob:')
 assert card(0).locator('[name=personnel_id]').input_value()==ids['p']
 print('PASS unarchived file and draft answers survive reload without selecting the PDF again')
 before=pg.evaluate('(id)=>import("./js/db.js").then(d=>d.get("work_records",id))',ids['w'])
 card(1).locator('summary').filter(has_text='Yeni iş açmadan').click();card(1).locator('[data-pdf-find-existing]').click()
 pg.wait_for_timeout(300);card(1).locator('[data-pdf-existing]').select_option(ids['w']);card(1).locator('[data-pdf-link]').click();pg.locator('.sheet [data-x="1"]').wait_for();pg.locator('.sheet [data-x="1"]').click()
 card(1).get_by_text('PDF mevcut işe bağlandı',exact=False).wait_for()
 after=pg.evaluate('(id)=>import("./js/db.js").then(d=>d.get("work_records",id))',ids['w'])
 for k,v in before.items():
  if k!='updated_at':assert after[k]==v,(k,after[k],v)
 assert len(after['source_pdf_links'])==1
 counts=pg.evaluate("async()=>{const d=await import('./js/db.js');return [(await d.listActive('work_records')).length,(await d.listActive('cash_records')).length,(await d.listActive('cari_movements')).length]}")
 assert counts==[1,0,0],counts
 print('PASS source linked to locked work; quantity/price/lock preserved; no new work or financial movement')
 # Reload and reopen from queue without selecting a file or contacting Gemini.
 pg.reload();pg.wait_for_timeout(1500);unlock();pg.locator('[data-pdf-resume]').wait_for();pg.locator('[data-pdf-resume]').first.click();card(2).wait_for()
 assert len(calls)==1
 assert card(0).locator('[name=personnel_id]').input_value()==ids['p']
 assert card(2).locator('[name=fuel_source]').input_value()=='Müşteri Verdi'
 assert card(1).locator('[data-pdf-pick]').is_disabled()
 assert '2 bekleyen' in pg.locator('[data-pdf-queue]').inner_text()
 assert '1 mevcut işe bağlanan' in pg.locator('[data-pdf-queue]').inner_text()
 print('PASS queue restores file, mappings, guided answers and linked status after reload without Gemini')
 # Create a second pending draft to verify the queue lists multiple files independently.
 pg.locator('[data-pdf-file]').set_input_files({'name':'TEST-second.pdf','mimeType':'application/pdf','buffer':b'%PDF-1.4\n% SECOND TEST\n%%EOF'})
 pg.check('[data-pdf-consent]');pg.click('[data-pdf-read]');card(2).wait_for();pg.wait_for_timeout(250)
 assert pg.locator('[data-pdf-resume]').count()==2
 print('PASS multiple PDFs retain separate queue entries')
 # Two real pages link the same source row concurrently: one source link + one audit.
 data=pg.evaluate("async()=>{const db=await import('./js/db.js');const rows=(await db.listActive('work_records'));const w=rows[0];return {w,doc:w.source_pdf_links[0]}}")
 other=ctx.new_page();other.goto(U);other.wait_for_timeout(600)
 row={**base,'id':'race','customer_id':ids['c'],'vehicle_id':ids['v'],'personnel_id':ids['p'],'quantity':3,'unit_price':None,'quote':'TEST race source'}
 schedule="""({row,doc,start})=>{window.__race=(async()=>{const db=await import('./js/db.js'),P=await import('./js/pdf-history-core.js');await new Promise(r=>setTimeout(r,Math.max(0,start-Date.now())));try{return (await P.linkPdfWork(db,row,doc.hash,doc.document_id,window.__workId,{confirmed:true})).id}catch(e){return e.code||e.message}})();return true}"""
 start=int(time.time()*1000)+800
 for page in [pg,other]:page.evaluate('(id)=>window.__workId=id',ids['w']);page.evaluate(schedule,{'row':row,'doc':data['doc'],'start':start})
 results=[page.evaluate('async()=>await window.__race') for page in [pg,other]];assert results==[ids['w'],ids['w']],results
 final=pg.evaluate('(id)=>import("./js/db.js").then(async d=>({w:await d.get("work_records",id),audit:(await d.getAll("audit_log")).filter(a=>a.entity_id===id&&a.action==="pdf_source_link")}))',ids['w'])
 assert len(final['w']['source_pdf_links'])==2 and len(final['audit'])==2
 print('PASS concurrent same-source links have one metadata update/audit per source row')
 # A linked source cannot later create a new work, even with an explicit separate flag.
 guards=pg.evaluate("""async({row,doc,id})=>{const db=await import('./js/db.js'),P=await import('./js/pdf-history-core.js');let duplicate=false,stale=false;try{const r=await P.savePdfRow(db,row,doc.hash,doc.document_id,{confirmed:true,separate:true});duplicate=r.id===id&&r._existing===true}catch(e){duplicate=true}const old=await db.get('work_records',id);await db.saveExisting('work_records',old,{description:'Changed in another tab'},'TEST');try{await P.linkPdfWork(db,{...row,id:'stale'},doc.hash,doc.document_id,id,{confirmed:true,expected:old})}catch(e){stale=e.code==='STALE'}return {duplicate,stale,count:(await db.listActive('work_records')).length,links:(await db.get('work_records',id)).source_pdf_links.length}}""",{'row':row,'doc':data['doc'],'id':ids['w']})
 assert guards=={'duplicate':True,'stale':True,'count':1,'links':2},guards
 print('PASS linked source cannot create another work; stale confirmation rejects without adding a source')
 assert not errors,errors
 print('PASS no page errors')
 b.close()
