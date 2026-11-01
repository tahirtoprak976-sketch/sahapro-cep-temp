"""Exact reported tariff phrase, real assistant/IDB; TEST data, deterministic Gemini only."""
import argparse,json,uuid
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright
ap=argparse.ArgumentParser();ap.add_argument('url',nargs='?',default='http://localhost:8841/');ap.add_argument('--baseline-proof',action='store_true');ap.add_argument('--artifacts',default='/tmp/solo-price93');a=ap.parse_args()
BASE=a.url.rstrip('/')+'/';assert urlparse(BASE).hostname in ('localhost','127.0.0.1')
OUT=Path(a.artifacts);OUT.mkdir(parents=True,exist_ok=True)
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);c=b.new_context(viewport={'width':390,'height':850});c.add_init_script("localStorage.setItem('sp_role','boss');localStorage.setItem('sp_assistant_details_v1','expanded')")
 calls=[];reply={}
 def route(r):
  if r.request.url.startswith('https://generativelanguage.googleapis.com/'):
   calls.append(json.loads(r.request.post_data));r.fulfill(status=200,content_type='application/json',body=json.dumps({'candidates':[{'content':{'parts':[{'text':json.dumps(reply)}]},'finishReason':'STOP'}]}))
  elif urlparse(r.request.url).hostname in ('localhost','127.0.0.1'):r.continue_()
  else:r.abort()
 c.route('**/*',route);p=c.new_page();errors=[];p.on('pageerror',lambda e:errors.append(str(e)))
 app=BASE+'index.html?db=price93_'+uuid.uuid4().hex[:16]
 def view(h):p.goto(app+h);p.wait_for_selector('#screen[data-view-ready="1"]')
 view('#/daha')
 ids=p.evaluate("""async()=>{const d=await import('./js/db.js');
  const a=await d.saveNew('customers',{name:'Ahmet Bey'},'TEST'),b=await d.saveNew('customers',{name:'TEST Diğer93'},'TEST');
  const t=await d.saveNew('sites',{name:'Tarabya',customer_id:a.id},'TEST'),s=await d.saveNew('sites',{name:'Sarıyer',customer_id:a.id},'TEST'),bt=await d.saveNew('sites',{name:'Tarabya',customer_id:b.id},'TEST');
  const v=await d.saveNew('vehicles',{name:'34EC1353',type:'Kamyonet'},'TEST'),v2=await d.saveNew('vehicles',{name:'34TESTV2',type:'Kamyonet'},'TEST'),k=await d.saveNew('vehicles',{name:'34GA2261',type:'Kamyon'},'TEST');
  const w=async(label,fields={})=>await d.saveNew('work_records',{date:'2026-10-21',customer_id:a.id,site_id:t.id,vehicle_id:v.id,work_type:'Moloz Nakliye',unit:'Sefer',quantity:2,description:'TEST '+label,...fields},'TEST');
  const rows={};for(const [label,f] of [['yes',{}],['van2',{vehicle_id:v2.id}],['site',{site_id:s.id}],['customer',{customer_id:b.id,site_id:bt.id}],['truck',{vehicle_id:k.id}],['type',{work_type:'Gravak Nakliye'}],['missing',{site_id:null,from_place:'Tarabya'}],['priced',{price_snapshot:{unit_price:3000,kdv_rate:0,kdv_included:false,amount:6000}}],['locked',{price_snapshot:{unit_price:3000,kdv_rate:20,kdv_included:false,amount:6000,locked:true}}]])rows[label]=(await w(label,f)).id;
  for(const [k,v]of Object.entries({gemini_key:'TEST',gemini_model:'gemini-2.5-flash',gemini_consent:true,gemini_daily_limit:100}))await d.metaSet(k,v);
  return {a:a.id,b:b.id,t:t.id,s:s.id,bt:bt.id,v:v.id,rows};}""")
 def snap():return p.evaluate("async()=>JSON.stringify(await (await import('./js/db.js')).dumpAll())")
 def send(text):
  p.fill('[data-msg]',text);p.click('[data-ask]');p.wait_for_function("()=>!document.querySelector('[data-ask]').disabled");p.wait_for_selector('[data-kind=price]')
 view('#/akilli-asistan');before=json.loads(snap())
 reply={'price_rules':[{'customer_id':ids['a'],'unit':'Sefer','price':7000}]}
 message='Ahmet.bey müşterisin Tarabyadan Kamyonetle alinan moloz seferlerine 7000 TL yap'
 send(message);card=p.locator('[data-kind=price]');assert len(calls)==1
 if a.baseline_proof:
  assert card.locator('[name=price_site]').count()==0
  p.click('[data-save]');p.locator('[data-out]').get_by_text('Kaydedildi:',exact=False).wait_for()
  after=json.loads(snap());rules=[r for r in after['price_book'] if r.get('customer_id')==ids['a']];assert len(rules)==1 and not rules[0].get('site_id') and not rules[0].get('vehicle_group')
  for label in ['site','truck','missing']:
   row=next(r for r in after['work_records'] if r['id']==ids['rows'][label]);assert row['price_snapshot']['unit_price']==7000
  p.screenshot(path=str(OUT/'baseline-overbroad.png'),full_page=True)
  assert not errors,errors
  print('BASELINE PROOF: unchanged v3.9.92 omits site selector and prices other-site, truck and missing-site jobs; TEST only',flush=True)
  c.close();b.close();raise SystemExit(0)
 assert card.locator('[name=price_site]').input_value()==ids['t']
 assert card.locator('[name=scope]').inner_text()=='Moloz Nakliye · Yalnız Kamyonet'
 assert card.locator('[data-n-unpriced]').inner_text()=='(2 iş)' and card.locator('[data-n-differ]').inner_text()=='(1 iş)'
 assert 'Şantiye: Tarabya' in card.inner_text() and '1 işte şantiye seçilmemiş' in card.inner_text()
 assert card.locator('[data-pick]').is_checked() and not card.locator('[name=apply_differ]').is_checked()
 assert json.loads(snap())==before
 for width in [320,390,768]:p.set_viewport_size({'width':width,'height':850});assert p.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
 p.set_viewport_size({'width':390,'height':850});p.screenshot(path=str(OUT/'tarabya-preview.png'),full_page=True)
 p.click('[data-save]');p.locator('[data-out]').get_by_text('Kaydedildi:',exact=False).wait_for()
 after=json.loads(snap());rules=[r for r in after['price_book'] if r.get('customer_id')==ids['a']];assert len(rules)==1
 rule=rules[0];assert rule['site_id']==ids['t'] and rule['vehicle_group']=='VAN' and rule['work_type']=='Moloz Nakliye' and rule['price']==7000
 before_by={r['id']:r for r in before['work_records']};after_by={r['id']:r for r in after['work_records']}
 changed=[k for k in before_by if before_by[k]!=after_by[k]];assert set(changed)=={ids['rows']['yes'],ids['rows']['van2']},changed
 for key in changed:assert after_by[key]['price_snapshot']['amount']==14000 and after_by[key]['price_snapshot']['kdv_rate']==20
 print('PASS exact phrase: model omits site and class; real card resolves Tarabya AND pickup AND rubble; only two matching unpriced works change; unrelated/missing-site/locked/priced records untouched',flush=True)
 # Undo covers this operation's exact rule + two work writes. Retry cannot reapply an undone request.
 undone=p.evaluate("""async()=>{const d=await import('./js/db.js'),u=await import('./js/undo.js');const op=(await d.metaGet('assistant_undo'));await u.applyUndo(d);return op;}""")
 undo_state=json.loads(snap());assert all(next(x for x in undo_state['work_records'] if x['id']==k)==before_by[k] for k in changed)
 assert not any(r['id']==rule['id'] and not r.get('deleted_at') for r in undo_state['price_book'])
 print('PASS exact transaction receipt supports assistant undo',flush=True)
 replay=p.evaluate("""async()=>{const d=await import('./js/db.js'),s=await import('./js/price-rule-db.js'),op=(await d.getAll('meta')).find(x=>x.key.startsWith('assistant_price:')),intent=JSON.parse(op.value.request);let error='';try{await s.saveReviewedPriceRule(intent.rule,intent.options,intent.reviewSignature,op.key.slice('assistant_price:'.length))}catch(e){error=e.message}return error;}""")
 assert 'geri alınmış' in replay

 # API concurrency + fault injection, on the same synthetic rows. A review never authorizes later/new jobs.
 result=p.evaluate("""async(ids)=>{const d=await import('./js/db.js'),pc=await import('./js/price-rule-core.js'),s=await import('./js/price-rule-db.js');const rule={customer_id:ids.a,site_id:ids.t,vehicle_group:'VAN',vehicle_type:null,vehicle_id:null,work_type:'Moloz Nakliye',unit:'Sefer',price:7000,kdv_rate:20,kdv_included:false,valid_from:null,valid_to:null},opts={unpriced:true,differ:false};
  const data=await d.dumpAll(),review=pc.priceRuleReview(data,rule,opts);
  const row=await d.get('work_records',ids.rows.yes);await d.saveExisting('work_records',row,{quantity:3},'TEST');
  let stale='';try{await s.saveReviewedPriceRule(rule,opts,review.signature,'TEST-stale93')}catch(e){stale=e.message}if(!stale.includes('önizlemeden'))throw Error(stale||'stale accepted');
  const fresh=pc.priceRuleReview(await d.dumpAll(),rule,opts),before=JSON.stringify(await d.dumpAll());
  const proto=IDBObjectStore.prototype,original=proto.put;let once=true;proto.put=function(value,...args){if(this.name==='work_records'&&once){once=false;throw Error('TEST injected write failure')}return original.call(this,value,...args)};
  let failure='';try{await s.saveReviewedPriceRule(rule,opts,fresh.signature,'TEST-abort93')}catch(e){failure=e.message}finally{proto.put=original}
  if(failure!=='TEST injected write failure'||JSON.stringify(await d.dumpAll())!==before)throw Error('partial write survived '+failure);
  const both=await Promise.all([s.saveReviewedPriceRule(rule,opts,fresh.signature,'TEST-double93'),s.saveReviewedPriceRule(rule,opts,fresh.signature,'TEST-double93')]);if(both.filter(x=>x._existing).length!==1)throw Error('retry not idempotent');
  let collision='';try{await s.saveReviewedPriceRule({...rule,price:8000},opts,fresh.signature,'TEST-double93')}catch(e){collision=e.message}if(!collision)throw Error('changed payload accepted');
  const stored=await d.get('work_records',ids.rows.yes);if(stored.price_snapshot.amount!==21000)throw Error('quantity missed');
  return {stale,failure,retry:both.filter(x=>x._existing).length,collision};}""",ids)
 print('PASS atomic abort rolls back rule and works; stale quantity blocks save; concurrent retry writes once; reused key with changed scope rejected',flush=True)
 p.evaluate("""async(ids)=>{const d=await import('./js/db.js'),pc=await import('./js/price-rule-core.js'),s=await import('./js/price-rule-db.js');
  const old=(await d.listActive('price_book')).find(x=>x.customer_id===ids.a);await d.saveExisting('price_book',old,{kdv_rate:0},'TEST');
  const rule={customer_id:ids.a,site_id:ids.t,vehicle_group:'VAN',vehicle_type:null,vehicle_id:null,work_type:'Moloz Nakliye',unit:'Sefer',price:8000,kdv_rate:20,kdv_included:false,valid_from:null,valid_to:null},opts={unpriced:true,differ:true},r=pc.priceRuleReview(await d.dumpAll(),rule,opts);
  const result=await s.saveReviewedPriceRule(rule,opts,r.signature,'TEST-differ93');if(result.priced!==3||result.rule.kdv_rate!==0)throw Error('differ/VAT mismatch');
  for(const label of ['yes','van2','priced']){const w=await d.get('work_records',ids.rows[label]);if(w.price_snapshot.unit_price!==8000||w.price_snapshot.kdv_rate!==0)throw Error('past VAT mismatch');}
  const nr={...rule,customer_id:'new:TEST Yeni93',site_id:null,vehicle_group:null},no={unpriced:true,differ:false},review=pc.priceRuleReview(await d.dumpAll(),nr,no);
  const first=await s.saveReviewedPriceRule(nr,no,review.signature,'TEST-newcustomer93'),again=await s.saveReviewedPriceRule(nr,no,review.signature,'TEST-newcustomer93');
  if(!first.customerCreated||first.priced!==0||!again._existing||(await d.listActive('customers')).filter(x=>x.name==='TEST Yeni93').length!==1)throw Error('new customer repeat');
 }""",ids)
 print('PASS undo cannot be replayed; priced past jobs need explicit opt-in; existing VAT 0 retained; new customer + rule are atomic and idempotent',flush=True)

 # A customer change clears site and must require an explicit compatible selection.
 view('#/akilli-asistan');send(message);card=p.locator('[data-kind=price]');card.locator('[name=customer]').select_option(ids['b']);assert card.locator('[name=price_site]').input_value()==''
 stable=snap();card.locator('[data-pick]').check();p.click('[data-save]');assert snap()==stable and 'bu müşteriye ait şantiyeyi' in card.inner_text().lower()
 # Unknown place is blocked rather than expanded customer-wide.
 send(message.replace('Tarabyadan','İstinyeden'));card=p.locator('[data-kind=price]');assert not card.locator('[data-pick]').is_checked() and card.locator('[name=price_site]').input_value()==''
 assert 'şantiye' in card.locator('[data-scopeinfo]').inner_text().lower()
 assert not errors,errors
 (OUT/'result.json').write_text(json.dumps({'version':p.evaluate("async()=>(await import('./js/core.js')).APP_VERSION"),'scope':rule,'guards':result,'errors':errors},ensure_ascii=False,indent=2))
 print('PASS changing customer never drops site to all; unknown site fails closed; no uncaught browser errors; price_scope browser PASS',flush=True)
 c.close();b.close()
