"""Actual assistant UI, synthetic model response, actual second-write IDB failure."""
import json,io,uuid,argparse
from pathlib import Path
from PIL import Image
from playwright.sync_api import sync_playwright
parser=argparse.ArgumentParser();parser.add_argument('url',nargs='?',default='http://localhost:8841/');parser.add_argument('--baseline-proof',action='store_true');parser.add_argument('--artifacts',default='/tmp/solo-ticket-atomic84');args=parser.parse_args();OUT=Path(args.artifacts);OUT.mkdir(exist_ok=True,parents=True);U=args.url.rstrip('/')+'/';baseline=args.baseline_proof
from urllib.parse import urlparse
assert urlparse(U).hostname in ['localhost','127.0.0.1']
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);c=b.new_context(service_workers='block');c.add_init_script("localStorage.setItem('sp_role','boss')")
 pg=c.new_page();errors=[];pg.on('pageerror',lambda e:errors.append(str(e)));app=U+'index.html?db=tpartial83_'+uuid.uuid4().hex[:8]
 pg.goto(app+'#/daha');pg.wait_for_selector('#screen[data-view-ready="1"]')
 ids=pg.evaluate("""async()=>{const db=await import('./js/db.js');for(const[k,v]of Object.entries({gemini_key:'TEST-NOT-A-REAL-KEY',gemini_model:'gemini-2.5-flash',gemini_consent:true,gemini_daily_limit:100}))await db.metaSet(k,v);const v=await db.saveNew('vehicles',{name:'TEST Truck',plate:'34TST627',type:'Kamyon'},'TEST'),c=await db.saveNew('customers',{name:'TEST Ticket Customer'},'TEST');return {v:v.id,c:c.id};}""")
 plan={'tickets':[{'photo':0,'ticket_no':'RT-83001','date':'2026-09-07','plate':'34TST627','tonnage':24.85,'text':'FIS RT-83001 07.09.2026 34TST627 NET 24850 kg'}],'photo_texts':['FIS RT-83001 07.09.2026 34TST627 NET 24850 kg']}
 calls=[]
 def gem(r):
  calls.append('mocked');text=json.dumps(r.request.post_data_json or {});res={'slips':[{'photo':0,'text':'FIS RT-83001 07.09.2026 34TST627 NET 24850 kg','slip_no':'RT-83001','date':'2026-09-07','plate':'34TST627','net_ton':24.85}]} if 'KANTAR, DÖKÜM' in text else plan
  r.fulfill(status=200,content_type='application/json',body=json.dumps({'candidates':[{'content':{'parts':[{'text':json.dumps(res)}]},'finishReason':'STOP'}]}))
 pg.route('https://generativelanguage.googleapis.com/**',gem)
 pg.goto(app+'#/akilli-asistan');pg.wait_for_function("()=>document.querySelector('[data-new-chat]')&&!document.querySelector('[data-new-chat]').disabled")
 buf=io.BytesIO();Image.new('RGB',(80,100),'white').save(buf,format='PNG');pg.locator('[data-photos]').set_input_files([{'name':'TEST.png','mimeType':'image/png','buffer':buf.getvalue()}]);pg.fill('[data-msg]','Bu kantar fişini kaydet');pg.click('[data-ask]');pg.wait_for_selector('[data-kind=ticket]',timeout=60000)
 card=pg.locator('[data-kind=ticket]').first;card.locator('[name=customer]').select_option(ids['c']);card.locator('[name=link]').select_option('new');card.locator('[data-pick]').check()
 pg.evaluate("""()=>{const proto=IDBObjectStore.prototype,old=proto.put;window.__faultHit=false;proto.put=function(row,...args){const request=old.call(this,row,...args);if(this.name==='documents'&&!window.__faultHit){window.__faultHit=true;this.add(row);proto.put=old;}return request;};}""")
 pg.click('[data-save]');card.get_by_text('Bu kart kaydedilirken hata oldu:',exact=False).wait_for();pg.wait_for_function("()=>!document.querySelector('[data-save]').disabled")
 state="""async()=>{const db=await import('./js/db.js');return {works:(await db.listActive('work_records')).filter(x=>x.slip_no==='RT-83001').length,documents:(await db.listActive('documents')).filter(x=>x.doc_no==='RT-83001').length};}"""
 first=pg.evaluate(state);warning=card.inner_text();pg.screenshot(path=str(OUT/'ticket-partial-first.png'),full_page=True)
 card.locator('[data-pick]').check();pg.click('[data-save]');pg.locator('[data-out]').get_by_text('Kaydedildi:',exact=False).wait_for();second=pg.evaluate(state)
 report={'baseline_proof':baseline,'vulnerability_confirmed':second=={'works':2,'documents':1},'actual_IDB_constraint_error':pg.evaluate('window.__faultHit'),'after_failure':first,'after_retry':second,'partial_warning_shown':'Bu kart kaydedilirken hata oldu:' in warning,'model_calls_all_mocked':len(calls),'real_model_calls':0,'page_errors':errors}
 if not baseline:
  race=pg.evaluate("""async ids=>{const db=await import('./js/db.js'),f={date:'2026-09-07',customer_id:ids.c,vehicle_id:ids.v,work_type:'Hafriyat Nakliye',quantity:1,unit:'Sefer'},base={date:f.date,ticket_vehicle_id:ids.v,ticket_tonnage:10};const r=await Promise.all(['RT-83002','rt 83002'].map(doc_no=>db.saveTicketEvent({document:{...base,doc_no},work:{...f,slip_no:doc_no}})));return {same_work:r[0].work_record_id===r[1].work_record_id,existing:r.filter(x=>x._existing).length,works:(await db.listActive('work_records')).length,docs:(await db.listActive('documents')).length};}""",ids)
  assert race=={'same_work':True,'existing':1,'works':2,'docs':2},race
  report['canonical_two_call_retry']=race
 report['protection_verified']=not baseline and second=={'works':1,'documents':1};(OUT/'ticket-partial-retry.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report));assert first=={'works':1 if baseline else 0,'documents':0} and second=={'works':2 if baseline else 1,'documents':1} and not errors,report;b.close()
