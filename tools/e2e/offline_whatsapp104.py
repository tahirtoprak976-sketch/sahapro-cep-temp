"""Real offline route, shared safe review and Save. TEST-only data, no Gemini."""
import argparse,json,uuid
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright
ap=argparse.ArgumentParser();ap.add_argument('url',nargs='?',default='http://localhost:8841/');a=ap.parse_args();base=a.url.rstrip('/')+'/';assert urlparse(base).hostname in ('localhost','127.0.0.1')
SETUP="""async()=>{const db=await import('./js/db.js');for(const[k,rows]of Object.entries({customers:[{id:'TEST_C',name:'Kuzey Yapı'},{id:'TEST_D',name:'Güney Yapı'}],vehicles:[{id:'TEST_V',name:'JCB 3CX',type:'JCB',assignee_id:'TEST_P'}],personnel:[{id:'TEST_P',name:'Operatör A',vehicle_id:'TEST_V'}],price_book:[{id:'TEST_PRICE',customer_id:'TEST_C',unit:'Saat',price:2500,kdv_rate:0,kdv_included:false,active:true}],fuel_tank_movements:[{id:'TEST_STOCK',date:'2026-01-01',move_type:'GİRİŞ',liters:1000,total:20000}]}))for(const r of rows)await db.put(k,r);return await db.dumpAll();}"""
with sync_playwright() as w:
 b=w.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 for scenario in ['continuation','spaced-year-save','fuel-only-replay','missing-date','invalid-date','non-job-notes']:
  c=b.new_context(viewport={'width':360,'height':850});c.add_init_script("localStorage.setItem('sp_role','boss')");p=c.new_page();errors=[];external=[];p.on('pageerror',lambda e:errors.append(str(e)))
  def route(r):
   if urlparse(r.request.url).hostname in ('localhost','127.0.0.1'):r.continue_()
   else:external.append(r.request.url);r.abort()
  c.route('**/*',route);app=base+'index.html?db=TEST_offline104_'+uuid.uuid4().hex
  p.goto(app+'#/daha');p.wait_for_selector('#screen[data-view-ready="1"]');before=p.evaluate(SETUP)
  p.goto(app+'#/whatsapp');p.wait_for_selector('#screen[data-view-ready="1"]')
  def snap():return p.evaluate("async()=>await(await import('./js/db.js')).dumpAll()")
  def parse(text):
   p.fill('[data-raw]',text);p.click('[data-parse]');p.wait_for_function("()=>!document.querySelector('[data-parse]').disabled")
  if scenario=='continuation':
   parse('[31/10/2026 18:00] Operatör A: Kuzey Yapı JCB 3CX 3 saat çalıştı\nGüney Yapı 2 saat çalıştı')
   cards=p.locator('[data-kind=work]');assert cards.count()==2
   for card in cards.all():assert card.locator('[name=date]').input_value()=='2026-10-31' and card.locator('[name=vehicle]').input_value()=='TEST_V' and card.locator('[name=personnel]').input_value()=='TEST_P'
   assert p.locator('[data-kind=fuel]').count()==0 and snap()==before
  if scenario=='spaced-year-save':
   parse('[02/11/2026 18:00] Operatör A: 30.10 2026 Kuzey Yapı JCB 3CX 3 saat çalıştı')
   card=p.locator('[data-kind=work]');assert card.count()==1 and card.locator('[name=date]').input_value()=='2026-10-30';assert card.locator('[data-pick]').is_checked();assert snap()==before
   p.evaluate("()=>{const b=document.querySelector('[data-save]');b.dispatchEvent(new MouseEvent('click',{bubbles:true}));b.dispatchEvent(new MouseEvent('click',{bubbles:true}));}")
   p.wait_for_selector('.assistant-receipt');after=snap();assert len(after['work_records'])==1 and after['work_records'][0]['date']=='2026-10-30' and after['work_records'][0]['quantity']==3
   price=after['work_records'][0]['price_snapshot'];assert price['unit_price']==2500 and price['amount']==7500 and price['kdv_rate']==0
   assert p.evaluate("async()=>await(await import('./js/db.js')).metaGet('ai_examples')") is None
   assert p.evaluate("async()=>await(await import('./js/db.js')).metaGet('ai_quality')") is None
  if scenario=='fuel-only-replay':
   text='[03/11/2026 18:00] Operatör A: JCB 3CX 140 litre mazot depodan alındı';parse(text)
   assert p.locator('[data-kind=work]').count()==0;fuel=p.locator('[data-kind=fuel]');assert fuel.count()==1 and fuel.locator('[name=liters]').input_value()=='140';assert snap()==before
   p.click('[data-save]');p.wait_for_selector('.assistant-receipt');after=snap();assert len(after['work_records'])==0 and len(after['fuel_records'])==1 and after['fuel_records'][0]['liters']==140
   parse(text);p.click('[data-save]');p.locator('[data-x="0"]').click();p.wait_for_function("()=>!document.querySelector('[data-save]')||!document.querySelector('[data-save]').disabled")
   assert len(snap()['fuel_records'])==1,'Replaying the same source must not consume tank stock twice'
  if scenario=='missing-date':
   parse('Kuzey Yapı JCB 3CX 2 saat çalıştı');card=p.locator('[data-kind=work]');assert not card.locator('[data-pick]').is_checked()
   p.get_by_text('Hazır iş kartlarını seç',exact=True).click();assert not card.locator('[data-pick]').is_checked(),'Ready-all must not confirm an unwritten date'
   assert card.locator('[data-field-confidence=date]').get_attribute('data-level')=='BILINMIYOR'
   q=p.locator('[data-question="work:0:date"]');assert q.count()==1;q.locator('input').fill('2026-10-31');q.locator('[data-answer]').click();assert card.locator('[name=date]').input_value()=='2026-10-31' and not card.locator('[data-pick]').is_checked()
   assert snap()==before
  if scenario=='invalid-date':
   parse('[31/02/2026 18:00] Operatör A: Kuzey Yapı JCB 3CX 2 saat çalıştı');card=p.locator('[data-kind=work]');assert card.count()==1 and not card.locator('[data-pick]').is_checked();assert card.locator('[name=date]').input_value()=='';assert snap()==before
  if scenario=='non-job-notes':
   parse('02.11.2026\n31 Ekim Perşembe\nPatron gönderdi ödeme onda\n20 bin ödeyecek');assert p.locator('[data-kind]').count()==0;assert snap()==before
  assert not errors,errors
  assert not [u for u in external if 'generativelanguage.googleapis.com' in u],external
  assert p.evaluate('document.documentElement.scrollWidth<=innerWidth'),'Phone layout must not overflow'
  print('PASS offline',scenario,'no Gemini',flush=True);c.close()
 b.close()
