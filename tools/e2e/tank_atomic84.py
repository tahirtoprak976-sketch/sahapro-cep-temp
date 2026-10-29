"""Depot merge actual UI, real payable and injected actual request error."""
from pathlib import Path
import json,uuid,argparse
from playwright.sync_api import sync_playwright
parser=argparse.ArgumentParser();parser.add_argument('url',nargs='?',default='http://localhost:8841/');parser.add_argument('--baseline-proof',action='store_true');parser.add_argument('--artifacts',default='/tmp/solo-tank-atomic84');args=parser.parse_args();OUT=Path(args.artifacts);OUT.mkdir(exist_ok=True,parents=True);U=args.url.rstrip('/')+'/';baseline=args.baseline_proof
from urllib.parse import urlparse
assert urlparse(U).hostname in ['localhost','127.0.0.1']
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);c=b.new_context();c.add_init_script("localStorage.setItem('sp_role','boss')");p=c.new_page();errors=[];p.on('pageerror',lambda e:errors.append(str(e)));url=U+'index.html?db=tmerge84_'+uuid.uuid4().hex[:9]
 p.goto(url+'#/daha');p.wait_for_selector('#screen[data-view-ready="1"]')
 ids=p.evaluate("""async()=>{const db=await import('./js/db.js'),E=await import('./js/enterprise-db.js');const supplier=await E.saveSupplier({name:'TEST Fuel Supplier'});const keep=await db.saveNew('fuel_tank_movements',{date:'2026-09-07',move_type:'GİRİŞ',liters:100,total:1000,unit_price:10},'TEST manual'),drop=await db.saveNew('fuel_tank_movements',{date:'2026-09-07',move_type:'GİRİŞ',liters:100,total:1000,unit_price:10,invoice_no:'TEST-INV-83',supplier_id:supplier.id},'TEST invoice');const bill=await E.savePayable({date:'2026-09-07',due_date:'2026-09-30',party_type:'supplier',party_id:supplier.id,document_no:'TEST-INV-83',source_store:'fuel_tank_movements',source_id:drop.id,items:[{description:'TEST Diesel',unit:'L',quantity:100,unit_price:10,kdv_rate:0,kdv_included:false}]});return {keep:keep.id,drop:drop.id,bill:bill.id};}""")
 p.goto(url+'#/depo');p.wait_for_selector('[data-merge]')
 p.evaluate("""id=>{const proto=IDBObjectStore.prototype,old=proto.put;window.__faultHit=false;proto.put=function(row,...args){const req=old.call(this,row,...args);if(this.name==='fuel_tank_movements'&&row.id===id&&!window.__faultHit){window.__faultHit=true;this.add(row);proto.put=old;}return req;}}""",ids['keep'])
 p.click('[data-merge]');p.click('.sheet [data-x="1"]');p.wait_for_function('()=>window.__faultHit');p.wait_for_timeout(300)
 result=p.evaluate("""async ids=>{const db=await import('./js/db.js');return {bill_status:(await db.get('payables',ids.bill)).status,original_intakes_remain:(await db.listActive('fuel_tank_movements')).filter(x=>[ids.keep,ids.drop].includes(x.id)).length,active_supplier_bills:(await db.listActive('payables')).filter(x=>x.status!=='İptal').length};}""",ids)
 report={'vulnerability_confirmed':result=={'bill_status':'İptal','original_intakes_remain':2,'active_supplier_bills':0},'actual_IDB_request_failure':p.evaluate('window.__faultHit'),'supplier_debt_before':1000,'result':result,'page_errors':errors}
 (OUT/'tank-merge-partial.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report));assert result==({'bill_status':'İptal','original_intakes_remain':2,'active_supplier_bills':0} if baseline else {'bill_status':'Onaylandı','original_intakes_remain':2,'active_supplier_bills':1}) and not errors,report
 if not baseline:
  p.click('[data-merge]');p.click('.sheet [data-x="1"]');p.wait_for_function("()=>!document.querySelector('[data-merge]')")
  merged=p.evaluate("""async ids=>{const db=await import('./js/db.js');return {bill_status:(await db.get('payables',ids.bill)).status,bill_source:(await db.get('payables',ids.bill)).source_id,moves:(await db.listActive('fuel_tank_movements')).length};}""",ids)
  assert merged=={'bill_status':'Onaylandı','bill_source':ids['keep'],'moves':1},merged
  report['protection_verified']=True;report['retry']=merged
 (OUT/'tank-merge-partial.json').write_text(json.dumps(report,indent=2)+'\n');b.close()
