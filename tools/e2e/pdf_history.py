"""Real mobile UI/IndexedDB; generated source PDF and mocked Gemini; no user records."""
import json
from playwright.sync_api import sync_playwright
U='http://localhost:8841/'
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 ctx=b.new_context(viewport={'width':412,'height':900},service_workers='block')
 ctx.add_init_script("localStorage.setItem('sp_role','boss')")
 pg=ctx.new_page();errors=[];calls=[]
 pg.on('pageerror',lambda e:errors.append(str(e)))
 pg.goto(U);pg.wait_for_timeout(1200)
 ids=pg.evaluate("""async()=>{const db=await import('./js/db.js');const sec=await import('./js/security-core.js');await db.metaSet('gemini_key','TEST');await db.metaSet('gemini_model','gemini-2.5-flash');await db.metaSet('gemini_consent',true);await db.metaSet('sec_lock',{...(await sec.hashSecret('482917')),idle_min:30,away_min:15});const c=await db.saveNew('customers',{name:'Örnek PDF Müşteri'},'TEST');const v=await db.saveNew('vehicles',{name:'34TEST123',plate:'34TEST123'},'TEST');await db.saveNew('price_book',{customer_id:c.id,unit:'Saat',price:9999,kdv_rate:20,kdv_included:false,active:true},'TEST');return {c:c.id,v:v.id};}""")
 raw={'notes':['Yükleme anlaşmaya dahil; süre belirtilmemiş.'],'totals':[{'kind':'work','unit':'Saat','value':3},{'kind':'fuel','unit':'L','value':210},{'kind':'expense','unit':'TL','value':500}], 'rows':[
 {'kind':'work','page':1,'quote':'11.05.2026 Örnek PDF Müşteri 34TEST123 2 saat kazı','date':'2026-05-11','customer_name':'Örnek PDF Müşteri','vehicle_name':'34TEST123','work_type':'Kazı','unit':'Saat','quantity':2},
 {'kind':'work','page':1,'quote':'11.05.2026 Örnek PDF Müşteri 34TEST123 1 saat tesviye','date':'2026-05-11','customer_name':'Örnek PDF Müşteri','vehicle_name':'34TEST123','work_type':'Tesviye','unit':'Saat','quantity':1},
 {'kind':'fuel','page':2,'quote':'11.05.2026 34TEST123 210 L Şantiye / Depo','date':'2026-05-11','vehicle_name':'34TEST123','liters':210},
 {'kind':'expense','page':2,'quote':'11.05.2026 34TEST123 Lastik 500 TL','date':'2026-05-11','vehicle_name':'34TEST123','amount':500,'category':'Lastik'},
 {'kind':'summary','page':2,'quote':'Genel toplam: 3 saat, 210 litre, 500 TL'},
 {'kind':'note','page':2,'quote':'Yükleme dahil; ayrıca yazılmadı'}]}
 def gem(route):
  body=route.request.post_data_json
  parts=[x for c in body['contents'] for x in c['parts'] if 'inlineData' in x]
  assert len(parts)==1 and parts[0]['inlineData']['mimeType']=='application/pdf'
  assert parts[0]['inlineData']['data'].startswith('JVBERi0')
  calls.append(body)
  route.fulfill(status=200,content_type='application/json',body=json.dumps({'candidates':[{'content':{'parts':[{'text':json.dumps(raw)}]},'finishReason':'STOP'}]}))
 pg.route('https://generativelanguage.googleapis.com/**',gem)
 pg.goto(U+'index.html#/akilli-asistan/pdf-gecmis');pg.wait_for_timeout(1800)
 if pg.locator('#lock-root [data-pw]').count():pg.fill('#lock-root [data-pw]','482917');pg.click('#lock-root [data-go-un]')
 pg.wait_for_selector('[data-pdf-file]')
 def upload():pg.locator('[data-pdf-file]').set_input_files({'name':'TEST-history.pdf','mimeType':'application/pdf','buffer':b'%PDF-1.4\n1 0 obj <</Type /Catalog>> endobj\n%%EOF'})
 def snap():return pg.evaluate("async()=>{const db=await import('./js/db.js');return Object.fromEntries(await Promise.all(['work_records','fuel_records','expense_records','hakedis','cash_records','cari_movements','documents','attachments'].map(async s=>[s,(await db.getAll(s)).length])))}")
 upload();pg.check('[data-pdf-consent]');pg.click('[data-pdf-read]');pg.wait_for_selector('[data-pdf-row]')
 assert pg.locator('[data-pdf-row]').count()==4
 assert pg.locator('[data-pdf-pick]:checked').count()==0
 s0=snap();assert all(v==0 for v in s0.values()),s0
 assert pg.locator('[data-pdf-row="0"] [name=date]').input_value()=='2026-05-11'
 assert pg.locator('[data-pdf-row="0"] [name=unit_price]').input_value()==''
 print('PASS separate work/fuel/expense cards; note/summary ignored; all unchecked; historical date and no current price')
 # Missing source must block the entire selection before archiving/writing.
 pg.locator('[data-pdf-row="2"] [data-pdf-pick]').check();pg.check('[data-pdf-reviewed]');pg.click('[data-pdf-save]')
 pg.locator('[data-pdf-row="2"] [data-pdf-status]').get_by_text('Pozitif litre ve kesin yakıt kaynağı seçin.',exact=False).wait_for()
 assert snap()==s0
 pg.locator('[data-pdf-row="2"] [name=fuel_source]').select_option('Şantiye')
 for pick in pg.locator('[data-pdf-pick]').all():pick.check()
 pg.click('[data-pdf-save]');pg.locator('.sheet [data-x="1"]').wait_for();pg.locator('.sheet [data-x="1"]').click()
 pg.locator('[data-pdf-row="3"] [data-pdf-status]').get_by_text('Kaydedildi',exact=False).wait_for()
 s1=snap();assert s1=={'work_records':2,'fuel_records':1,'expense_records':1,'hakedis':0,'cash_records':0,'cari_movements':0,'documents':1,'attachments':1},s1
 rows=pg.evaluate("async()=>{const db=await import('./js/db.js');return {w:await db.listActive('work_records'),e:await db.listActive('expense_records')}}")
 assert all(x['price_snapshot'] is None and x['source_document_id'] for x in rows['w'])
 assert rows['e'][0]['payment_method'] is None
 print('PASS source PDF archived once; 2 work + fuel + expense; zero hakediş/cash/cari; unknown payment not invented')
 # Full page reload: draft is reused and imported rows remain locked without another model call.
 pg.reload();pg.wait_for_timeout(1000)
 if pg.locator('#lock-root [data-pw]').count():pg.fill('#lock-root [data-pw]','482917');pg.click('#lock-root [data-go-un]')
 pg.wait_for_selector('[data-pdf-file]');upload();pg.click('[data-pdf-read]');pg.wait_for_selector('[data-pdf-row]')
 pg.locator('[data-pdf-row="3"] [data-pdf-pick]:disabled').wait_for(state='attached')
 assert len(calls)==1 and pg.locator('[data-pdf-pick]:disabled').count()==4
 assert snap()==s1
 print('PASS same PDF after reload uses cached review draft; no duplicate records or second Gemini request')
 # A later row may fail (empty tank); successful rows must stay locked on retry.
 raw['rows'][0]['quantity']=7;raw['rows'][0]['quote']='11.05.2026 Örnek PDF Müşteri 34TEST123 7 saat kazı'
 raw['rows'][2]['fuel_source']='Depo Tankı'
 pg.locator('[data-pdf-file]').set_input_files({'name':'TEST-partial.pdf','mimeType':'application/pdf','buffer':b'%PDF-1.4\n% PARTIAL TEST\n%%EOF'})
 pg.check('[data-pdf-consent]');pg.click('[data-pdf-read]');pg.locator('[data-pdf-row="3"]').wait_for()
 pg.locator('[data-pdf-row="0"] [data-pdf-pick]').check();pg.locator('[data-pdf-row="2"] [data-pdf-pick]').check();pg.locator('[data-pdf-row="2"] [data-pdf-separate]').check();pg.check('[data-pdf-reviewed]')
 pg.click('[data-pdf-save]');pg.locator('.sheet [data-x="1"]').wait_for();pg.locator('.sheet [data-x="1"]').click()
 pg.locator('[data-pdf-row="2"] [data-pdf-status]').get_by_text('Tank stokundan fazla',exact=False).wait_for()
 partial=snap();assert partial['work_records']==3 and partial['fuel_records']==1,partial
 assert pg.locator('[data-pdf-row="0"] [data-pdf-pick]').is_disabled()
 pg.locator('[data-pdf-row="2"] [name=fuel_source]').select_option('Şantiye')
 pg.locator('[data-pdf-row="2"] [data-pdf-separate]').check();pg.locator('[data-pdf-row="2"] [data-pdf-pick]').check()
 pg.click('[data-pdf-save]');pg.locator('.sheet [data-x="1"]').wait_for();pg.locator('.sheet [data-x="1"]').click()
 pg.locator('[data-pdf-row="2"] [data-pdf-status]').get_by_text('Kaydedildi',exact=False).wait_for()
 completed=snap();assert completed['work_records']==3 and completed['fuel_records']==2,completed
 print('PASS partial tank failure leaves successful work locked; retry completes only the missing fuel row')
 # Real IndexedDB two callers: identical PDF source identity writes one row, changed payload conflicts.
 result=pg.evaluate("""async()=>{const db=await import('./js/db.js');const P=await import('./js/pdf-history-core.js');const data=await db.dumpAll();const r={...data.work_records[0],id:'race',kind:'work',page:1,quote:'TEST race',vehicle_id:data.work_records[0].vehicle_id,customer_id:data.work_records[0].customer_id,unit:'Saat',work_type:'Kazı',quantity:8,unit_price:null};const args=[db,r,data.work_records[0].source_pdf_hash,data.work_records[0].source_document_id,{confirmed:true,separate:true}];const x=await Promise.all([P.savePdfRow(...args),P.savePdfRow(...args)]);let conflict=false;try{await P.savePdfRow(db,{...r,quantity:9},data.work_records[0].source_pdf_hash,r.source_document_id,{confirmed:true,separate:true})}catch(e){conflict=e.code==='OP_CONFLICT'}return {same:x[0].id===x[1].id,conflict}}""")
 assert result=={'same':True,'conflict':True},result
 provenance=pg.evaluate("async()=>{const db=await import('./js/db.js');return (await db.listActive('work_records')).find(x=>x.source_document_id)}")
 pg.evaluate('(id)=>location.hash="#/isler/"+id',provenance['id']);pg.wait_for_selector('[data-pdf-provenance]')
 pg.locator('[data-pdf-provenance] [data-go]').click();pg.wait_for_url('**#/belgeler/'+provenance['source_document_id'])
 assert not errors,errors
 print('PASS source PDF can be opened from imported work details')
 print('PASS duplicate operation atomicity and different-content conflict; no page errors')
 b.close()
