"""Generic legacy vehicle card versus transport price group: real mobile UI/IDB."""
import argparse,json,uuid
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright
ap=argparse.ArgumentParser();ap.add_argument('url',nargs='?',default='http://localhost:8841/');ap.add_argument('--baseline-proof',action='store_true');ap.add_argument('--artifacts',default='/tmp/solo-vehicle96');a=ap.parse_args()
BASE=a.url.rstrip('/')+'/';assert urlparse(BASE).hostname in ('localhost','127.0.0.1');OUT=Path(a.artifacts);OUT.mkdir(parents=True,exist_ok=True)
with sync_playwright() as w:
 b=w.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);c=b.new_context(viewport={'width':390,'height':850});c.add_init_script("localStorage.setItem('sp_role','boss');localStorage.setItem('sp_assistant_details_v1','expanded')")
 p=c.new_page();errors=[];p.on('pageerror',lambda e:errors.append(str(e)));reply={}
 def route(r):
  if r.request.url.startswith('https://generativelanguage.googleapis.com/'):
   r.fulfill(status=200,content_type='application/json',body=json.dumps({'candidates':[{'content':{'parts':[{'text':json.dumps(reply)}]},'finishReason':'STOP'}]}))
  elif urlparse(r.request.url).hostname in ('localhost','127.0.0.1'):r.continue_()
  else:r.abort()
 c.route('**/*',route);app=BASE+'index.html?db=vehicle96_'+uuid.uuid4().hex[:14]
 def view(h):p.goto(app+h);p.wait_for_selector('#screen[data-view-ready="1"]')
 def snap():return p.evaluate("async()=>await(await import('./js/db.js')).dumpAll()")
 def send(text):p.fill('[data-msg]',text);p.click('[data-ask]');p.wait_for_function("()=>!document.querySelector('[data-ask]').disabled");p.wait_for_selector('[data-kind=price]')
 view('#/daha');ids=p.evaluate("""async()=>{const d=await import('./js/db.js');
 const c=await d.saveNew('customers',{name:'Ahmet Bey'},'TEST'),t=await d.saveNew('sites',{name:'Tarabya',customer_id:c.id},'TEST'),k=await d.saveNew('sites',{name:'Kemer',customer_id:c.id},'TEST');
 const vehicles={};for(const[key,name,type]of [['legacy','Kamyonet','Araç/Makine'],['other','Mitsubishi kamyonet','Diğer'],['typed','34 TEST 03','Kamyonet'],['truck','34 TEST 04','Kamyon'],['tir','34 TEST 05','Tır'],['unknown','34 TEST 06','Araç/Makine'],['conflict','Kamyonet','Kamyon']])vehicles[key]=(await d.saveNew('vehicles',{name,type},'TEST')).id;
 const rows={};for(const[name,f]of [['empty',{}],['priced',{quantity:2,price_snapshot:{unit_price:3000,amount:6000,kdv_rate:20,kdv_included:false}}],['origin',{site_id:null,from_place:'Tarabya'}],['kemer',{site_id:k.id,description:'Kemer kantri mimar Ahmet beye toprak ve saksı götürüldü',price_snapshot:{unit_price:3500,amount:3500}}],['other',{vehicle_id:vehicles.other}],['typed',{vehicle_id:vehicles.typed}],['truck',{vehicle_id:vehicles.truck}],['tir',{vehicle_id:vehicles.tir}],['unknown',{vehicle_id:vehicles.unknown,description:'Kamyonetle moloz alındı TEST'}],['conflict',{vehicle_id:vehicles.conflict}],['locked',{price_snapshot:{unit_price:1500,amount:1500,locked:true}}],['otherwork',{work_type:'Çöp Nakliye'}]])rows[name]=(await d.saveNew('work_records',{date:'2026-10-30',customer_id:c.id,site_id:t.id,vehicle_id:vehicles.legacy,work_type:'Moloz Nakliye',unit:'Sefer',quantity:1,description:'TEST '+name,...f},'TEST')).id;
 for(const[key,value]of Object.entries({gemini_key:'TEST',gemini_model:'gemini-2.5-flash',gemini_consent:true,gemini_daily_limit:100}))await d.metaSet(key,value);
 return {customer:c.id,t:t.id,k:k.id,vehicles,rows};}""")
 before=snap();reply={'price_rules':[{'customer_id':ids['customer'],'site_id':ids['t'],'work_type':'Moloz Nakliye','price':7000,'unit':'Sefer'}]}
 view('#/akilli-asistan');send('Ahmet Bey Tarabyadan kamyonetle alınan moloz seferlerine 7000 TL yapalım');card=p.locator('[data-kind=price]')
 if a.baseline_proof:
  assert all('Araç türü farklı' in card.locator('[data-price-work="'+ids['rows'][k]+'"]').inner_text() for k in ('empty','priced','origin','other'))
  assert '1 işin fiyatı değişecek' in card.locator('[data-scopeinfo]').inner_text();assert snap()==before
  p.screenshot(path=str(OUT/'baseline-legacy-rejected.png'),full_page=True)
  print('BASELINE PROOF v3.9.95: legacy Kamyonet Araç/Makine and Diğer cards incorrectly excluded from VAN group; no writes',flush=True);b.close();raise SystemExit(0)
 assert not card.locator('[name=rule_only]').is_checked() and card.locator('[name=apply_differ]').is_checked()
 assert '5 işin fiyatı değişecek' in card.locator('[data-scopeinfo]').inner_text()
 assert 'araç adından; kart türü: Araç/Makine' in card.locator('[data-price-work="'+ids['rows']['empty']+'"] [data-price-vehicle]').inner_text()
 for name,reason in [('kemer','Başka şantiye'),('truck','kapsam dışında'),('tir','kapsam dışında'),('unknown','doğrulanamadı'),('conflict','çelişiyor'),('locked','Hakedişe bağlı'),('otherwork','İş türü farklı')]:assert reason in card.locator('[data-price-work="'+ids['rows'][name]+'"]').inner_text(),name
 card.locator('[name=rule_only]').check();assert 'mevcut işler değişmeyecek' in card.locator('[data-scopeinfo]').inner_text();assert card.locator('[name=apply_differ]').is_disabled()
 card.locator('[name=rule_only]').uncheck();assert '5 işin fiyatı değişecek' in card.locator('[data-scopeinfo]').inner_text();assert snap()==before
 p.screenshot(path=str(OUT/'legacy-preview.png'),full_page=True)
 # A real card-type change between preview and commit invalidates the transaction.
 p.evaluate("""async id=>{const d=await import('./js/db.js'),P=await import('./js/price-rule-db.js'),v=await d.get('vehicles',id),r=document.querySelector('[data-kind=price]')._priceReview;await d.saveExisting('vehicles',v,{type:'Kamyon'},'TEST');const before=JSON.stringify(await d.dumpAll());let rejected=false;try{await P.saveReviewedPriceRule(r.rule,r.options,r.signature,'TEST-stale-kind96')}catch{rejected=true}if(!rejected||JSON.stringify(await d.dumpAll())!==before)throw Error('stale kind wrote data');await d.saveExisting('vehicles',await d.get('vehicles',id),{type:v.type},'TEST');}""",ids['vehicles']['legacy'])
 p.click('[data-save]');p.wait_for_selector('[data-price-application-receipt]');assert '5 işe fiyat uygulandı' in p.locator('[data-price-application-receipt]').inner_text()
 after=snap();old={r['id']:r for r in before['work_records']};new={r['id']:r for r in after['work_records']};changed=[i for i in old if old[i]!=new[i]]
 assert set(changed)=={ids['rows'][k] for k in ('empty','priced','origin','other','typed')},changed
 for key in ('empty','priced','origin','other','typed'):assert new[ids['rows'][key]]['price_snapshot']['unit_price']==7000 and new[ids['rows'][key]]['site_id']==ids['t']
 for store in ('cash_records','cari_movements','expense_records','hakedis','slips'):assert before[store]==after[store],store
 view('#/isler/'+ids['rows']['priced']);assert '14.000' in p.locator('[data-work-price]').inner_text() and '16.800' in p.locator('[data-work-price]').inner_text()
 # Future manual job really uses the newly saved group rule for this generic card.
 view('#/isler/new?customer_id='+ids['customer']);p.select_option('[name=site_id]',ids['t']);p.select_option('[name=vehicle_id]',ids['vehicles']['legacy']);p.select_option('[name=work_type]','Moloz Nakliye');p.select_option('[name=unit]','Sefer');p.fill('[name=quantity]','1');p.fill('[name=date]','2026-11-01');p.fill('[name=description]','TEST future legacy96');p.click('[data-save]')
 p.wait_for_function("()=>!document.querySelector('[name=description]')||document.querySelector('[name=description]').value!=='TEST future legacy96'")
 final=snap();future=[r for r in final['work_records'] if r.get('description')=='TEST future legacy96'];assert len(future)==1 and future[0]['price_snapshot']['unit_price']==7000,future
 assert not future[0].get('vehicle_name'),'context must not leak into saved work'
 assert not errors,errors
 (OUT/'results.json').write_text(json.dumps({'changed':len(changed),'future_unit_price':future[0]['price_snapshot']['unit_price'],'errors':errors},indent=2))
 print('PASS vehicle price96: legacy generic and explicit vans; preview/atomic save/future manual job agree; card change invalidates review; unrelated site/truck/TIR/conflict/unknown/work/locked preserved; rule-only remains explicit',flush=True);c.close();b.close()
