"""Customer-period readiness and explicit draft handoff; real Chromium/IDB/SW, synthetic data only."""
import argparse,json,uuid
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser();p.add_argument('url',nargs='?',default='http://localhost:8841/');p.add_argument('--artifacts',default='/tmp/solo-hakedis-preparation');a=p.parse_args()
U=a.url.rstrip('/')+'/';origin=urlparse(U);assert origin.scheme=='http' and origin.hostname in ('localhost','127.0.0.1','::1')
assert not origin.username and not origin.password and not origin.query and not origin.fragment
out=Path(a.artifacts);out.mkdir(parents=True,exist_ok=True)
SNAP="""async()=>{const x=await(await import('./js/db.js')).readSnapshot({attachments:true,meta:true,drafts:true});delete x.captured_at;return JSON.stringify(x)}"""
with sync_playwright() as pw:
 b=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);ctx=b.new_context(viewport={'width':390,'height':850});ctx.add_init_script("localStorage.setItem('sp_role','boss')")
 external=[];errors=[]
 def route(r):
  u=urlparse(r.request.url)
  if (u.scheme,u.hostname,u.port)==(origin.scheme,origin.hostname,origin.port):r.continue_()
  else:external.append(r.request.url);r.abort()
 ctx.route('**/*',route);pg=ctx.new_page();pg.on('pageerror',lambda e:errors.append(str(e)))
 app=U+'index.html?db=prep83_'+uuid.uuid4().hex[:10]
 pg.goto(app+'#/hakedis');pg.wait_for_selector('[data-prep-entry]');pg.evaluate('async()=>await navigator.serviceWorker.ready');pg.wait_for_function('()=>!!navigator.serviceWorker.controller')
 ids=pg.evaluate("""async()=>{
  const db=await import('./js/db.js'),C=await import('./js/core.js');const c=await db.saveNew('customers',{name:'TEST Hazırlık <img src=x onerror=window.__prepPwn=1>'},'TEST'),p=await db.saveNew('customers',{name:'TEST Ana Firma'},'TEST'),v=await db.saveNew('vehicles',{name:'TEST Kamyon',plate:'34TST627'},'TEST');
  await db.saveExisting('customers',c,{parent_customer_id:p.id},'TEST');
  const price={unit_price:1000,amount:1000,kdv_rate:20,kdv_included:false};
  const w=extra=>db.saveNew('work_records',{date:'2026-09-07',customer_id:c.id,vehicle_id:v.id,work_type:'Makine Çalışması',quantity:1,unit:'Saat',price_snapshot:price,...extra},'TEST');
  const ready=await w({description:'TEST fiyatlı saat işi'}),zero=await w({quantity:2,price_snapshot:{...price,unit_price:0,amount:0}}),haul=await w({work_type:'Gravak Nakliye',quantity:2,unit:'Sefer',price_snapshot:{...price,unit_price:500,amount:1000}});
  const noPrice=await w({work_type:'Kazı',quantity:3,price_snapshot:null}),noTicket=await w({work_type:'Moloz Nakliye',unit:'Sefer'});
  await w({work_type:'Tesviye',quantity:4});await w({work_type:'Tesviye',quantity:4});
  // Existing imports may contain an undated legacy row. Normal save correctly rejects it.
  const legacy=await w({work_type:'Yıkım'}),connection=await db.openDB();await new Promise((resolve,reject)=>{const tx=connection.transaction('work_records','readwrite');tx.objectStore('work_records').put({...legacy,date:''});tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);});
  await w({work_type:'Yükleme',quantity:5,customer_fuel_allowance_l:150,price_snapshot:{...price,unit_price:0,amount:0,kdv_rate:0,price_source:'Mazot karşılığı'}});
  await w({work_type:'Manitou Çalışması',quantity:6,price_snapshot:{...price,unit_price:0,amount:0,kdv_rate:0,price_source:'Sözleşmeye dahil'}});
  await w({date:'2026-08-10',work_type:'Yükleme',customer_fuel_allowance_l:100,price_snapshot:{...price,unit_price:0,amount:0,kdv_rate:0,price_source:'Mazot karşılığı'}});
  await w({customer_id:p.id,quantity:9});
  const reserved=await w({work_type:'JCB Çalışması'}),t=C.calcHakedisTotals([{work_record_id:reserved.id,date:reserved.date,customer_id:c.id,vehicle_id:v.id,work_type:reserved.work_type,quantity:1,unit:'Saat',...price}]);
  await db.createHakedis({hakedis_no:900,customer_id:c.id,date_from:'2026-09-01',date_to:'2026-09-30',created_date:C.todayStr(),status:'Taslak',items:t.lines,subtotal:t.subtotal,kdv_total:t.kdv,grand_total:t.grand});
  const doc=number=>db.saveNew('documents',{category:'Döküm Fişi',owner_type:'work',owner_id:haul.id,doc_no:number,date:'2026-09-07'},'TEST');await doc('P-1');const second=await doc('P-2');
  await db.saveNew('fuel_records',{date:'2026-08-15',customer_id:c.id,vehicle_id:v.id,fuel_source:'Müşteri Verdi',liters:40},'TEST');await db.saveNew('fuel_records',{date:'2026-09-15',customer_id:c.id,vehicle_id:v.id,fuel_source:'Müşteri Verdi',liters:80},'TEST');
  await db.saveNew('fuel_tank_movements',{date:'2026-09-16',move_type:'GİRİŞ',customer_id:c.id,liters:20},'TEST');
  return {c:c.id,parent:p.id,ready:ready.id,zero:zero.id,haul:haul.id,second:second.id,noPrice:noPrice.id,noTicket:noTicket.id};
 }""")
 prep=app+'#/hakedis/hazirlik?customer_id='+ids['c']+'&date_from=2026-09-01&date_to=2026-09-30'
 before=pg.evaluate(SNAP);pg.goto(prep);pg.wait_for_selector('[data-preparation]')
 for key,n in [('ready',3),('missing',2),('review',3),('agreement',2),('claimed',1)]:assert f'({n})' in pg.locator('[data-prep-tab='+key+']').inner_text(),key
 assert '2.400,00' in pg.locator('[data-prep-totals]').inner_text();assert '110 L' in pg.locator('[data-prep-fuel]').inner_text()
 for tab in ['missing','review','agreement','claimed','ready']:pg.click('[data-prep-tab='+tab+']')
 assert pg.evaluate(SNAP)==before and not pg.evaluate('window.__prepPwn||false')
 for width in [320,390,768]:pg.set_viewport_size({'width':width,'height':850});assert pg.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),width
 pg.set_viewport_size({'width':390,'height':850});pg.evaluate('window.scrollTo(0,0)');pg.screenshot(path=str(out/'preparation-390.png'),full_page=True)
 pg.fill('[name=prep_month]','2026-08');pg.locator('[name=prep_month]').dispatch_event('change');pg.wait_for_function("()=>document.querySelector('[data-prep-tab=agreement]')?.textContent.includes('(1)')")
 assert pg.input_value('[name=prep_from]')=='2026-08-01' and pg.input_value('[name=prep_to]')=='2026-08-31';assert '60 L' in pg.locator('[data-prep-fuel]').inner_text()
 pg.goto(prep);pg.wait_for_selector('[data-prep-open-ready]');pg.click('[data-prep-open-ready]');pg.wait_for_selector('[data-chk]');assert pg.locator('[data-chk]').count()==3
 assert pg.input_value('[name=customer_id]')==ids['c'] and pg.input_value('[name=date_from]')=='2026-09-01'
 assert pg.locator('[data-chk]:checked').count()==0;pg.click('[data-ready-select]');assert pg.locator('[data-chk]:checked').count()==3 and pg.is_enabled('[data-create]');assert pg.evaluate(SNAP)==before
 pg.click('[data-create]');pg.wait_for_selector('.sheet');pg.click('.sheet [data-x="0"]');pg.wait_for_selector('.sheet',state='hidden');assert pg.evaluate(SNAP)==before
 # A ticket removed after selection invalidates the readiness proposal before any claim write.
 pg.evaluate("async id=>await(await import('./js/db.js')).softDelete('documents',id,'TEST stale ticket')",ids['second']);afterDelete=pg.evaluate(SNAP)
 pg.click('[data-create]');pg.wait_for_selector('.sheet');pg.click('.sheet [data-x="1"]');pg.wait_for_function("()=>!document.querySelector('[data-hakedis-error]').hidden")
 assert 'Hazırlık durumu değişti' in pg.locator('[data-hakedis-error]').inner_text() and pg.evaluate(SNAP)==afterDelete
 pg.evaluate("""async id=>await(await import('./js/db.js')).saveNew('documents',{category:'Döküm Fişi',owner_type:'work',owner_id:id,doc_no:'P-2',date:'2026-09-07'},'TEST restore')""",ids['haul'])
 pg.click('[data-fetch]');pg.wait_for_selector('[data-ready-select]:not([hidden])');pg.click('[data-ready-select]');pg.click('[data-create]');pg.wait_for_selector('.sheet');pg.click('.sheet [data-x="1"]');pg.wait_for_selector('[data-pdf]')
 result=pg.evaluate("""async()=>{const db=await import('./js/db.js'),d=await db.dumpAll();return {claims:d.hakedis.map(h=>({status:h.status,total:h.grand_total,ids:h.items.map(x=>x.work_record_id)})),cash:d.cash_records.length,cari:d.cari_movements.length,unlocked:d.work_records.every(w=>!w.price_snapshot?.locked)}}""")
 assert len(result['claims'])==2 and any(set(h['ids'])=={ids['ready'],ids['zero'],ids['haul']} and h['total']==2400 and h['status']=='Taslak' for h in result['claims']),result
 assert result['cash']==0 and result['cari']==0 and result['unlocked'],result
 pg.goto(prep);pg.wait_for_selector('[data-preparation]');assert '(0)' in pg.locator('[data-prep-tab=ready]').inner_text() and '(4)' in pg.locator('[data-prep-tab=claimed]').inner_text()
 # A legacy fuel-only job without recorded entitlement cannot invent zero liters / a false advance.
 pg.evaluate("""async()=>{const db=await import('./js/db.js');const w=(await db.listActive('work_records')).find(w=>w.date==='2026-09-07'&&w.price_snapshot?.price_source==='Mazot karşılığı');await db.saveExisting('work_records',w,{customer_fuel_allowance_l:null},'TEST missing entitlement')}""")
 pg.click('[data-prep-refresh]');pg.wait_for_function("()=>document.querySelector('[data-prep-fuel]')?.textContent.includes('Hesaplanamadı')")
 assert pg.locator('[data-prep-fuel]').inner_text().count('Hesaplanamadı')==4
 ctx.set_offline(True);pg.reload(wait_until='domcontentloaded');pg.wait_for_selector('[data-preparation]');assert '(4)' in pg.locator('[data-prep-tab=claimed]').inner_text()
 assert not errors and not external,(errors,external)
 report={'local_synthetic_only':True,'counts_and_VAT':True,'parent_not_debtor':True,'period_fuel':True,'unknown_fuel_not_zero':True,'read_only_preview_and_cancel':True,'ready_only_handoff':True,'stale_ticket_rejected_before_write':True,'explicit_draft_only':True,'offline':True,'widths':[320,390,768],'page_errors':errors,'external_calls':external}
 (out/'result.json').write_text(json.dumps(report,indent=2));print(json.dumps(report),flush=True);ctx.close();b.close()
