"""Real Chromium/IndexedDB: review parity, resumable PDF and safe price completion.
All data are synthetic. No external AI, messages or real documents are sent.
"""
from playwright.sync_api import sync_playwright
U='http://localhost:8841/'
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 ctx=b.new_context(viewport={'width':360,'height':800},service_workers='block')
 ctx.add_init_script("try{localStorage.setItem('sp_role','boss')}catch(e){}")
 pg=ctx.new_page();errors=[];external=[]
 pg.on('pageerror',lambda e:errors.append(str(e)))
 pg.route('https://generativelanguage.googleapis.com/**',lambda r:(external.append(r.request.url),r.abort()))
 pg.goto(U+'index.html#/musteriler');pg.wait_for_selector('[data-customer-directory]')
 ids=pg.evaluate("""async()=>{
  const db=await import('./js/db.js');
  const c=await db.saveNew('customers',{name:'TEST review customer'},'TEST');
  const i=await db.saveNew('customers',{name:'TEST internal',internal:true},'TEST');
  const v=await db.saveNew('vehicles',{name:'TEST review vehicle'},'TEST');
  const w=(label,extra={})=>db.saveNew('work_records',{date:'2026-10-20',customer_id:c.id,vehicle_id:v.id,quantity:2,unit:'Saat',work_type:'Kazı',description:label,...extra},'TEST');
  const a=await w('missing A'),z=await w('zero',{price_snapshot:{unit_price:0}}),h=await w('billed');
  const l=await w('locked');await db.put('work_records',{...l,price_snapshot:{locked:true}});
  const d=await w('missing draft');
  await db.put('hakedis',{id:'TEST-final',status:'Kesinleşti',items:[{work_record_id:h.id}]});
  await db.put('hakedis',{id:'TEST-draft',status:'Taslak',items:[{work_record_id:d.id}]});
  await w('fuel',{customer_fuel_allowance_l:75,price_snapshot:{amount:0,price_source:'Mazot karşılığı'}});
  await w('internal',{customer_id:i.id});
  await w('included',{price_snapshot:{amount:0,price_source:'Sözleşmeye dahil'}});
  const legacy=await w('legacy unit price');await db.put('work_records',{...legacy,price_snapshot:{unit_price:125.25}});
  const removed=await db.saveNew('expense_records',{date:'2026-10-20',category:'Diğer',amount:5},'TEST');await db.softDelete('expense_records',removed.id,'TEST');
  const hash='a'.repeat(64),base={date:'2026-10-20',customer_id:c.id,vehicle_id:v.id,quantity:2,unit:'Saat',work_type:'Kazı',page:1,quote:'TEST 2 saat kazı'};
  await db.metaSet('pdf_history_draft:'+hash,{version:1,_file_name:'TEST-review.pdf',rows:[{...base,id:'0',kind:'work'},{...base,id:'1',kind:'fuel',liters:10},{...base,id:'2',kind:'expense',amount:5},{...base,id:'3',kind:'work'}],notes:[],totals:[]});
  for(const [row,store,record_id] of [['0','work_records',z.id],['1','work_records',z.id],['2','expense_records',removed.id]])await db.metaSet('op:pdf-history:'+hash+':'+row,{store,record_id});
  return {c:c.id,v:v.id,a:a.id,z:z.id,h:h.id,l:l.id,d:d.id,hash};
 }""")
 def snapshot():return pg.evaluate("async()=>{const db=await import('./js/db.js');return {data:await db.dumpAll(),audit:await db.getAll('audit_log')}}")
 before=snapshot()
 pg.goto(U);pg.wait_for_selector('[data-attn="pdf"]')
 assert '3 satır bekliyor' in pg.inner_text('[data-attn="pdf"]')
 assert '2 işin fiyatı yok' in pg.inner_text('[data-attn="fiyatsiz"]')
 pg.locator('[data-yonetim]').screenshot(path='/tmp/solo-review-v3946.png')
 pg.click('[data-attn="fiyatsiz"]');pg.wait_for_selector('.work-explorer-row')
 assert pg.locator('.work-explorer-row').count()==2
 links=pg.locator('.work-explorer-row').evaluate_all('(rows)=>rows.map(r=>r.getAttribute("href"))')
 assert set(links)=={'#/isler/'+ids['a'],'#/isler/'+ids['d']},links
 pg.goto(U+'index.html#/cari/'+ids['c']);pg.wait_for_selector('[data-gp]')
 assert 'Fiyatı girilmemiş işler (2)' in pg.text_content('#screen')
 pg.goto(U+'index.html#/isletme-panosu');pg.wait_for_selector('[data-overview-inspector]')
 pg.click('[data-overview-source="missing"]');assert pg.locator('[data-overview-inspector] .ultimate-source').count()==2
 pg.click('[data-overview-source="works"]')
 assert 'Hakedişe dahil' in pg.inner_text('[data-overview-inspector]')
 assert 'Fiyat kilitli' in pg.inner_text('[data-overview-inspector]')
 assert snapshot()==before,'review screens must not write data or audit'
 print('PASS home/list/cari/overview agree on two missing prices; zero/locked/finalized/fuel/internal jobs protected; no writes',flush=True)
 pg.goto(U);pg.wait_for_selector('[data-attn="pdf"]');pg.click('[data-attn="pdf"]')
 pg.wait_for_selector('[data-pdf-resume]');assert '3 bekleyen' in pg.inner_text('[data-pdf-queue]')
 pg.click('[data-pdf-resume]');pg.wait_for_selector('[data-pdf-row="3"]')
 assert pg.locator('[data-pdf-row="0"] [data-pdf-pick]').is_disabled()
 blocked=pg.locator('[data-pdf-row="1"]')
 assert blocked.get_attribute('data-pdf-blocked')=='1'
 assert 'işlem türüyle uyuşmuyor' in blocked.inner_text()
 assert blocked.locator('[data-pdf-pick]').is_disabled()
 assert not pg.locator('[data-pdf-row="2"] [data-pdf-pick]').is_disabled()
 assert not pg.locator('[data-pdf-row="3"] [data-pdf-pick]').is_disabled()
 assert snapshot()==before and not external
 print('PASS home opens the resumable PDF; deleted targets remain pending, wrong-kind links require review; no AI or business writes',flush=True)
 # Changing an originally missing price in another tab must not be overwritten.
 pg.goto(U+'index.html#/cari/'+ids['c']);pg.wait_for_selector('[data-gp]')
 other=ctx.new_page();other.goto(U+'index.html#/musteriler');other.wait_for_selector('[data-customer-directory]')
 changed=other.evaluate("""async ids=>{
  const db=await import('./js/db.js'),a=await db.get('work_records',ids.a);
  await db.saveExisting('work_records',a,{price_snapshot:{unit_price:0}},'TEST other tab deliberate zero');
  const fresh=await db.saveNew('work_records',{date:'2026-10-20',customer_id:ids.c,vehicle_id:ids.v,quantity:2,unit:'Saat',work_type:'Kazı',description:'TEST after list opened'},'TEST');
  return fresh.id;
 }""",ids)
 protected=snapshot()
 pg.uncheck('[data-gsave]');pg.fill('[data-gp="0"]','100.5');pg.click('[data-gapply="0"]')
 pg.get_by_text('1 işe fiyat yazıldı',exact=True).wait_for()
 after=snapshot();old={w['id']:w for w in protected['data']['work_records']};new={w['id']:w for w in after['data']['work_records']}
 assert new[ids['d']]['price_snapshot']['amount']==201
 for key in old:
  if key!=ids['d']:assert new[key]==old[key],key
 assert not new[changed].get('price_snapshot')
 assert new[ids['a']]['price_snapshot']['amount']==0
 for store in protected['data']:
  if store not in ['work_records','audit_log']:assert after['data'][store]==protected['data'][store],store
 assert len(after['audit'])==len(protected['audit'])+1
 pg.wait_for_selector('[data-gp]');assert 'Fiyatı girilmemiş işler (1)' in pg.text_content('#screen')
 print('PASS fresh price check preserves another tab’s explicit zero, ignores newly added jobs, writes only the originally selected missing job',flush=True)
 # Resolve the synthetic PDF links with correctly typed active targets.
 pg.evaluate("""async ids=>{
  const db=await import('./js/db.js');
  const f=await db.saveNew('fuel_records',{date:'2026-10-20',vehicle_id:ids.v,liters:10,fuel_source:'Müşteri Verdi',customer_id:ids.c},'TEST');
  const e=await db.saveNew('expense_records',{date:'2026-10-20',category:'Diğer',amount:5},'TEST');
  for(const [row,store,record_id] of [['1','fuel_records',f.id],['2','expense_records',e.id],['3','work_records',ids.d]])await db.metaSet('op:pdf-history:'+ids.hash+':'+row,{store,record_id});
 }""",ids)
 pg.goto(U);pg.wait_for_selector('[data-yonetim] [data-attn="fiyatsiz"]')
 assert pg.locator('[data-attn="pdf"]').count()==0
 pg.goto(U+'index.html#/akilli-asistan/pdf-gecmis');pg.wait_for_selector('[data-pdf-resume]')
 assert '0 bekleyen' in pg.inner_text('[data-pdf-queue]')
 pg.click('[data-pdf-resume]');pg.wait_for_selector('[data-pdf-row="3"]')
 assert pg.locator('[data-pdf-row] [data-pdf-pick]:disabled').count()==4
 assert not errors,errors
 assert not external,external
 print('PASS correctly completed rows clear the home task and PDF queue together; no browser errors or external AI calls',flush=True)
 b.close()
