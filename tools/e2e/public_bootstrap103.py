"""Fresh installation is private; reopening preserves synthetic existing cards and prices."""
import argparse,json,uuid
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright
ap=argparse.ArgumentParser();ap.add_argument('url',nargs='?',default='http://localhost:8841/');a=ap.parse_args();base=a.url.rstrip('/')+'/';assert urlparse(base).hostname in ('localhost','127.0.0.1')
with sync_playwright() as w:
 b=w.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);c=b.new_context(viewport={'width':360,'height':850});c.add_init_script("localStorage.setItem('sp_role','boss')");page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 app=base+'index.html?db=TEST_public103_'+uuid.uuid4().hex
 page.goto(app+'#/daha');page.wait_for_selector('#screen[data-view-ready="1"]')
 data=page.evaluate("async()=>await(await import('./js/db.js')).dumpAll()")
 assert data['vehicles']==[] and data['personnel']==[] and data['aliases']==[]
 assert all(p.get('work_type') for p in data['price_book']),'A missing private vehicle must never create a global hourly/daily tariff'
 before=page.evaluate("""async()=>{const db=await import('./js/db.js');await db.put('vehicles',{id:'TEST_V',name:'TEST existing machine',plate:'34TST001',type:'Ekskavatör',note:'TEST preserved'});await db.put('personnel',{id:'TEST_P',name:'TEST existing operator',vehicle_id:'TEST_V',active:true});await db.put('aliases',{id:'TEST_A',alias:'TEST local alias',target_type:'vehicle',target_id:'TEST_V',active:true});await db.put('price_book',{id:'TEST_PRICE',vehicle_id:'TEST_V',unit:'Saat',price:1234,kdv_rate:0,kdv_included:false});return await db.dumpAll();}""")
 page.reload();page.wait_for_selector('#screen[data-view-ready="1"]');after=page.evaluate("async()=>await(await import('./js/db.js')).dumpAll()")
 assert after==before,'Reopening must preserve every saved business record'
 assert not errors,errors
 print(json.dumps({'fresh_private_catalogues_empty':True,'no_accidental_global_tariff':True,'existing_business_records_preserved':True,'schema':7,'errors':errors}));b.close()
