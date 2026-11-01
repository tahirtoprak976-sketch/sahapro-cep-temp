"""Reported old-job price + November zero dashboard. Real mobile UI/IDB; TEST only."""
import argparse,json,uuid
from datetime import datetime,timezone
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright
ap=argparse.ArgumentParser();ap.add_argument('url',nargs='?',default='http://localhost:8841/');ap.add_argument('--baseline-proof',action='store_true');ap.add_argument('--artifacts',default='/tmp/solo-price95');a=ap.parse_args()
BASE=a.url.rstrip('/')+'/';assert urlparse(BASE).hostname in ('localhost','127.0.0.1');OUT=Path(a.artifacts);OUT.mkdir(parents=True,exist_ok=True)
with sync_playwright() as w:
 b=w.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);c=b.new_context(viewport={'width':390,'height':850},timezone_id='Europe/Istanbul');c.add_init_script("localStorage.setItem('sp_role','boss');localStorage.setItem('sp_assistant_details_v1','expanded')")
 p=c.new_page();p.clock.install(time=datetime(2026,11,1,12,0,tzinfo=timezone.utc));errors=[];p.on('pageerror',lambda e:errors.append(str(e)));ids={};reply={}
 def route(r):
  if r.request.url.startswith('https://generativelanguage.googleapis.com/'):
   r.fulfill(status=200,content_type='application/json',body=json.dumps({'candidates':[{'content':{'parts':[{'text':json.dumps(reply)}]},'finishReason':'STOP'}]}))
  elif urlparse(r.request.url).hostname in ('localhost','127.0.0.1'):r.continue_()
  else:r.abort()
 c.route('**/*',route);app=BASE+'index.html?db=application95_'+uuid.uuid4().hex[:14]
 def view(h):p.clock.run_for(120);p.goto(app+h);p.wait_for_selector('#screen[data-view-ready="1"]')
 def snap():return p.evaluate("async()=>await(await import('./js/db.js')).dumpAll()")
 def send(text):p.fill('[data-msg]',text);p.click('[data-ask]');p.wait_for_function("()=>!document.querySelector('[data-ask]').disabled")
 view('#/daha');ids=p.evaluate("""async()=>{const d=await import('./js/db.js');
  const customer=await d.saveNew('customers',{name:'Ahmet Bey'},'TEST'),other=await d.saveNew('customers',{name:'TEST Other95'},'TEST'),t=await d.saveNew('sites',{name:'Tarabya',customer_id:customer.id},'TEST'),k=await d.saveNew('sites',{name:'Kemer',customer_id:customer.id},'TEST'),v=await d.saveNew('vehicles',{name:'34EC1353',type:'Kamyonet'},'TEST'),truck=await d.saveNew('vehicles',{name:'34GA2261',type:'Kamyon'},'TEST');
  const work=async(name,f={})=>await d.saveNew('work_records',{date:'2026-10-27',customer_id:customer.id,site_id:t.id,vehicle_id:v.id,work_type:'Moloz Nakliye',unit:'Sefer',quantity:1,description:'TEST '+name,...f},'TEST');
  const rows={};for(const[name,f]of [['unpriced',{}],['priced',{quantity:2,price_snapshot:{unit_price:3000,kdv_rate:20,kdv_included:false,amount:6000}}],['origin',{site_id:null,from_place:'Tarabya',price_snapshot:{unit_price:2000,kdv_rate:20,kdv_included:false,amount:2000}}],['text',{site_id:null,description:'Tarabya moloz alındı TEST'}],['kemer',{site_id:k.id}],['truck',{vehicle_id:truck.id}],['locked',{price_snapshot:{unit_price:1500,kdv_rate:20,kdv_included:false,amount:1500,locked:true}}]])rows[name]=(await work(name,f)).id;
  const priceRule=await d.saveNew('price_book',{customer_id:customer.id,site_id:t.id,work_type:'Moloz Nakliye',vehicle_group:'VAN',unit:'Sefer',price:3000,kdv_rate:20,kdv_included:false,active:true},'TEST');
  const receipt=await d.saveCashEvent({date:'2026-10-28',customer_id:customer.id,cash_type:'Müşteriden Para Alındı',cash_status:'KASAYA_TESLIM_EDILDI',payment_method:'Nakit',amount:1000});
  await d.saveNew('expense_records',{date:'2026-10-28',category:'Diğer',amount:3223150,description:'TEST large expense95'},'TEST');
  for(const[k,v]of Object.entries({gemini_key:'TEST',gemini_model:'gemini-2.5-flash',gemini_consent:true,gemini_daily_limit:100}))await d.metaSet(k,v);
  return {customer:customer.id,other:other.id,t:t.id,k:k.id,v:v.id,rule:priceRule.id,rows};}""")
 before=snap();view('#/finans')
 if a.baseline_proof:
  assert all(p.locator('.finance-stat .v').nth(i).inner_text()=='0,00' for i in range(3)) and p.locator('[data-finance-month]').count()==0
  p.screenshot(path=str(OUT/'baseline-november-zero.png'),full_page=True)
  view('#/akilli-asistan');reply={'price_rules':[{'customer_id':ids['customer'],'site_id':ids['t'],'work_type':'Moloz Nakliye','price':7000,'unit':'Sefer'}]};send('Ahmet Bey Tarabyadan kamyonetle alınan moloz seferlerine 7000 TL yap');p.wait_for_selector('[data-kind=price]');assert not p.locator('[data-kind=price] [name=apply_differ]').is_checked()
  p.click('[data-save]');p.locator('[data-out]').get_by_text('Kaydedildi:',exact=False).wait_for();after=snap();by={r['id']:r for r in after['work_records']}
  assert by[ids['rows']['priced']]['price_snapshot']['unit_price']==3000 and by[ids['rows']['origin']]['price_snapshot']['unit_price']==2000
  assert not by[ids['rows']['origin']].get('site_id') and not by[ids['rows']['text']].get('price_snapshot')
  print('BASELINE PROOF v3.9.94: November finance all zero without month selector; price Save changes only one already-linked unpriced job, leaves old prices and Tarabya origins untouched',flush=True);c.close();b.close();raise SystemExit(0)
 assert 'Ekim 2026' in p.locator('[data-finance-period]').inner_text() and p.locator('.finance-stat[href="#/cari"] .v').inner_text()=='9.500,00'
 assert p.locator('.finance-stat[href="#/kasa"] .v').inner_text()=='1.000,00' and p.locator('.finance-stat[href="#/gider"] .v').inner_text()=='3.223.150,00'
 assert p.locator('[data-finance-general]').count()==1 and snap()==before
 p.screenshot(path=str(OUT/'finance-latest-october.png'),full_page=True)
 p.locator('a[href="#/isler?f=fiyatsiz&period=all"]').click();p.wait_for_selector('.work-explorer-row');assert p.locator('.work-explorer-row').count()==4;assert 'f=fiyatsiz' in p.url and 'Fiyatsız' in p.locator('#screen').inner_text();assert snap()==before
 view('#/finans?period=month');assert p.locator('.finance-stat[href="#/cari"] .v').inner_text()=='0,00' and 'Kasım 2026' in p.locator('[data-finance-period]').inner_text()
 view('#/finans?period=all');assert p.locator('.finance-stat[href="#/cari"] .v').inner_text()=='9.500,00'
 print('PASS November empty current month opens clearly-labelled last recorded October; explicit current/all filters work; general receivable independent; read-only',flush=True)
 view('#/akilli-asistan');reply={'price_rules':[{'customer_id':ids['customer'],'site_id':ids['t'],'work_type':'Moloz Nakliye','price':7000,'unit':'Sefer'}]};send('Ahmet Bey Tarabyadan kamyonetle alınan moloz seferlerine 7000 TL yap');p.wait_for_selector('[data-kind=price]');card=p.locator('[data-kind=price]')
 assert card.locator('[name=apply_differ]').is_checked() and not card.locator('[name=rule_only]').is_checked()
 assert card.locator('[data-price-work="'+ids['rows']['origin']+'"] [data-price-bind]').is_checked()
 assert not card.locator('[data-price-work="'+ids['rows']['text']+'"] [data-price-bind]').is_checked()
 card.locator('[data-price-work="'+ids['rows']['text']+'"] [data-price-bind]').check()
 assert '4 işin fiyatı değişecek' in card.locator('[data-scopeinfo]').inner_text() and snap()==before
 p.screenshot(path=str(OUT/'four-real-work-preview.png'),full_page=True)
 p.evaluate("""async id=>{const d=await import('./js/db.js'),P=await import('./js/price-rule-db.js'),review=document.querySelector('[data-kind=price]')._priceReview,before=JSON.stringify(await d.dumpAll()),proto=IDBObjectStore.prototype,old=proto.put;proto.put=function(v,...args){if(this.name==='work_records'&&v.id===id)throw Error('TEST binding quota');return old.call(this,v,...args)};let error='';try{await P.saveReviewedPriceRule(review.rule,review.options,review.signature,'TEST-binding-quota95')}catch(e){error=e.message}finally{proto.put=old}if(error!=='TEST binding quota'||JSON.stringify(await d.dumpAll())!==before)throw Error('Partial binding survived '+error);}""",ids['rows']['origin'])
 p.click('[data-save]');p.wait_for_selector('[data-price-application-receipt]');assert '4 işe fiyat uygulandı' in p.locator('[data-price-application-receipt]').inner_text()
 after=snap();old={r['id']:r for r in before['work_records']};new={r['id']:r for r in after['work_records']};changed=[id for id in old if old[id]!=new[id]]
 assert set(changed)=={ids['rows'][k] for k in ('unpriced','priced','origin','text')},changed
 for k in ('unpriced','priced','origin','text'):assert new[ids['rows'][k]]['price_snapshot']['unit_price']==7000 and new[ids['rows'][k]]['site_id']==ids['t']
 assert sum(new[ids['rows'][k]]['price_snapshot']['amount'] for k in ('unpriced','priced','origin','text'))==35000
 for store in ('cash_records','cari_movements','expense_records','hakedis','slips'):assert before[store]==after[store],store
 # Follow the actual source record and customer page, then the period financial page.
 view('#/isler/'+ids['rows']['priced']);p.wait_for_selector('[data-work-price]');assert '14.000' in p.locator('[data-work-price]').inner_text() and '16.800' in p.locator('[data-work-price]').inner_text()
 view('#/cari/'+ids['customer']);assert '35.500' in p.locator('[data-cari-balance]').inner_text() # + locked 1500 - receipt 1000
 view('#/finans');assert p.locator('.finance-stat[href="#/cari"] .v').inner_text()=='36.500,00'
 p.screenshot(path=str(OUT/'finance-after-actual-reprice.png'),full_page=True)
 print('PASS same confirmed operation reprices existing + unpriced jobs, binds two previewed Tarabya sources; 5 trips ×7000=35000; source work/customer balance/October dashboard reflect commit; protected scopes untouched',flush=True)
 # The operation receipt undoes only the four priced/bound jobs and its rule.
 p.evaluate("async()=>await(await import('./js/undo.js')).applyUndo(await import('./js/db.js'))")
 undone=snap();assert all(next(r for r in undone['work_records'] if r['id']==id)==old[id] for id in changed)
 # An alternate generic model action must reach the exact same price/work preview.
 view('#/akilli-asistan');reply={'actions':[{'op':'update','store':'price_book','id':ids['rule'],'fields':{'price':7000}}]};stable=snap();send('Ahmet Bey Tarabyadan kamyonetle alınan moloz seferlerine 7000 TL yap');p.wait_for_selector('[data-kind=price]');assert p.locator('[data-kind=action]').count()==0 and p.locator('[data-kind=price] [name=apply_differ]').is_checked() and snap()==stable
 print('PASS alternate generic price-book model edit is promoted to the same scoped work preview; no direct rule-only edit or business write',flush=True)
 # Refuse an existing-work request that matches no usable jobs; allow explicit list-only intent.
 view('#/akilli-asistan');reply={'price_rules':[{'customer_id':ids['other'],'work_type':'Moloz Nakliye','unit':'Sefer','price':7000}]};send('TEST Other95 moloz seferlerini 7000 TL yap');p.wait_for_selector('[data-kind=price]');card=p.locator('[data-kind=price]');stable=snap()
 assert 'fiyatı değişecek iş yok' in card.locator('[data-scopeinfo]').inner_text();p.click('[data-save]');assert snap()==stable and not p.locator('[data-price-application-receipt]').count()
 card.locator('[name=rule_only]').check();p.click('[data-save]');p.wait_for_selector('[data-price-application-receipt]');assert 'Yalnız fiyat listesine kaydedildi' in p.locator('[data-price-application-receipt]').inner_text()
 # Another tab updates an old work while Finance is open: a read view refreshes after commit.
 view('#/finans?period=all');p.evaluate('()=>document.activeElement?.blur()');other=c.new_page();other.goto(BASE+'README.md?db='+app.split('?db=')[1].split('#')[0]);other.evaluate("""async id=>{const d=await import('./js/db.js'),row=await d.get('work_records',id);await d.saveExisting('work_records',row,{price_snapshot:{unit_price:9000,kdv_rate:20,kdv_included:false,amount:9000}},'TEST cross-tab update');}""",ids['rows']['unpriced'])
 p.clock.run_for(150);p.wait_for_function("()=>document.querySelector('.finance-stat[href=\"#/cari\"] .v')?.textContent==='18.500,00'");other.close()
 for width in (320,390,768):
  p.set_viewport_size({'width':width,'height':850});assert p.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),width
  assert p.locator('.finance-stat[href="#/gider"] .v').inner_text()=='3.223.150,00'
  assert p.locator('.finance-stat[href="#/gider"] .v').evaluate('el=>{const r=document.createRange();r.selectNodeContents(el);return r.getClientRects().length===1}'),width
 assert not errors,errors
 (OUT/'result.json').write_text(json.dumps({'only_synthetic':True,'actual_four_work_apply':True,'trip_total':35000,'finance_october_total_after':36500,'no_op_blocked':True,'binding_undo':True,'cross_tab_finance_refresh':True,'errors':errors},indent=2))
 print('PASS receipt restores original prices/sites with Undo; zero-work existing request writes nothing; explicit list-only choice is labelled; finance updates after another-tab commit; narrow layouts; price_application_finance browser PASS',flush=True)
 c.close();b.close()
