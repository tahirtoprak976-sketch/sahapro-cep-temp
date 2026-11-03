"""Confidence on real controls, exact registry evidence and no writes before Save. Synthetic only."""
import argparse,json,uuid,io
from datetime import date,timedelta
from pathlib import Path
from urllib.parse import urlparse
from PIL import Image
from playwright.sync_api import sync_playwright
ap=argparse.ArgumentParser();ap.add_argument('url',nargs='?',default='http://localhost:8841/');ap.add_argument('--artifacts',default='/tmp/solo-confidence100');a=ap.parse_args();BASE=a.url.rstrip('/')+'/';assert urlparse(BASE).hostname in ('localhost','127.0.0.1')
root=Path(__file__).resolve().parents[2];cards=json.loads((root/'tests/assistant-gold/cards.json').read_text());out=Path(a.artifacts);out.mkdir(parents=True,exist_ok=True);results=[]
work={'date':'2026-11-02','vehicle_id':'TEST_V','work_type':'Makine Çalışması','quantity':2,'unit':'Saat'}
previous={'id':'TEST_PREVIOUS','date':'2026-11-02','customer_id':'TEST_C','vehicle_id':'TEST_V','work_type':'Makine Çalışması','quantity':1,'unit':'Saat'}
with sync_playwright() as pw:
 browser=pw.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 for scenario in ['same-day','site-owner','alias-certain','ambiguous','unknown-quantity','wrong-unit','registered-price','credit-unknown','local-edits','missing-quantity','date-conflict','relative-conflict','header-conflict','photo-date-fuel','photo-date-expense','tank-credit-unknown']:
  patch={};plan={'works':[dict(work)]};message='02.11.2026 JCB 3CX 2 saat çalıştı';photo=False;kind='work'
  if scenario in ['same-day','local-edits']:patch={'work_records':[previous]}
  if scenario=='site-owner':message='02.11.2026 Kuzey Şantiyesi JCB 3CX 2 saat çalıştı'
  if scenario=='alias-certain':
   patch={'aliases':[{'id':'TEST_ALIAS','alias':'Alfacı','target_type':'customer','target_id':'TEST_C','active':True,'confirmed':True}]};message='02.11.2026 Alfacı JCB 3CX 2 saat çalıştı';plan['works'][0].update(customer_id='TEST_C',customer_guess=True)
  if scenario=='ambiguous':message='02.11.2026 Ortak Yapı JCB 3CX 2 saat çalıştı';plan['works'][0]['customer_id']='TEST_TWIN1'
  if scenario=='unknown-quantity':message='02.11.2026 Alfa İnşaat JCB 3CX çalıştı';plan['works'][0]['customer_id']='TEST_C'
  if scenario=='wrong-unit':message='02.11.2026 Alfa İnşaat JCB 3CX 2 saat çalıştı';plan['works'][0].update(customer_id='TEST_C',unit='Sefer')
  if scenario=='registered-price':
   patch={'price_book':[{'id':'TEST_PRICE','customer_id':'TEST_C','unit':'Saat','price':2500,'kdv_rate':0,'kdv_included':True,'active':True}]};message='02.11.2026 Alfa İnşaat JCB 3CX 2 saat çalıştı';plan['works'][0]['customer_id']='TEST_C'
  if scenario=='credit-unknown':
   message='Lastik fişi';photo=True;kind='expense';plan={'photo_texts':['LASTİK TOPLAM 500 TL'],'expenses':[{'amount':500,'category':'Lastik','photo':0,'credit':True,'supplier_id':'TEST_SUP'}]}
  if scenario=='missing-quantity':message='02.11.2026 Alfa İnşaat JCB 3CX çalıştı';plan['works'][0].update(customer_id='TEST_C',quantity=None)
  if scenario in ['date-conflict','relative-conflict','header-conflict']:
   message={'date-conflict':'07.09.2026 Alfa İnşaat JCB 3CX 2 saat çalıştı','relative-conflict':'Dün Alfa İnşaat JCB 3CX 2 saat çalıştı','header-conflict':'[07/09/2026 18:00] Şoför: Alfa İnşaat JCB 3CX 2 saat çalıştı'}[scenario];plan['works'][0].update(customer_id='TEST_C',date=date.today().isoformat())
  if scenario in ['photo-date-fuel','photo-date-expense']:
   case=next(c for c in json.loads((root/'tests/assistant-gold/confidence-cases.json').read_text()) if c['id']=='confidence100-photo-multi-date-'+scenario.rsplit('-',1)[1]);message=case['message'];plan=case['recordedResponse'];photo=True;kind=scenario.rsplit('-',1)[1]
  if scenario=='tank-credit-unknown':
   message='02.11.2026 depoya 100 litre mazot 5000 TL veresiye aldık';plan={'tank_in':[{'date':'2026-11-02','liters':100,'total':5000,'supplier_id':'TEST_SUP','credit':True}]};kind='tank'
  if scenario=='local-edits':
   message+='\n02.11.2026 Alfa İnşaat JCB 3CX 3 saat çalıştı';plan['works'][0]['quote']='02.11.2026 JCB 3CX 2 saat çalıştı';plan['works'].append({**work,'customer_id':'TEST_C','quantity':3,'quote':'02.11.2026 Alfa İnşaat JCB 3CX 3 saat çalıştı'})
  ctx=browser.new_context(viewport={'width':390,'height':850});ctx.add_init_script("localStorage.setItem('sp_role','boss')");page=ctx.new_page();errors=[];requests=[];page.on('pageerror',lambda e:errors.append(str(e)))
  def route(r):
   if r.request.url.startswith('https://generativelanguage.googleapis.com/'):
    requests.append(r.request.url);parts=[{'text':json.dumps(plan)}] if photo else [{'functionCall':{'name':'prepare_plan','args':{'goal':'TEST güven seviyeleri','plan_json':json.dumps(plan)}}}];r.fulfill(status=200,content_type='application/json',body=json.dumps({'candidates':[{'content':{'parts':parts},'finishReason':'STOP'}]}))
   elif urlparse(r.request.url).hostname in ('localhost','127.0.0.1'):r.continue_()
   else:r.abort()
  ctx.route('**/*',route);app=BASE+'index.html?db=conf100_'+uuid.uuid4().hex[:16];page.goto(app+'#/daha');page.wait_for_selector('#screen[data-view-ready="1"]')
  page.evaluate("""async cards=>{const db=await import('./js/db.js');for(const [store,rows]of Object.entries(cards))for(const row of rows)await db.put(store,row);for(const[k,v]of Object.entries({gemini_key:'TEST',gemini_model:'TEST_MODEL',gemini_consent:true,gemini_daily_limit:10,kdv_default:20}))await db.metaSet(k,v);}""",{**cards,**patch})
  def snap():return page.evaluate("async()=>await(await import('./js/db.js')).dumpAll()")
  page.goto(app+'#/akilli-asistan');page.wait_for_selector('#screen[data-view-ready="1"]')
  if photo:
   buff=io.BytesIO();Image.new('RGB',(100,100),'green').save(buff,format='PNG');page.set_input_files('[data-photos]',{'name':'TEST-receipt.png','mimeType':'image/png','buffer':buff.getvalue()});page.wait_for_selector('[data-thumbs] img')
  before=snap();page.fill('[data-msg]',message);page.click('[data-ask]');page.wait_for_function("()=>!document.querySelector('[data-ask]').disabled",timeout=60000);card=page.locator(f'[data-kind={kind}][data-i="0"]');pick=card.locator('[data-pick]');
  try:pick.wait_for()
  except Exception:
   print(scenario,errors,page.locator('#screen').inner_text(),flush=True);raise
  assert snap()==before
  if scenario in ['same-day','site-owner','alias-certain','registered-price','local-edits']:
   assert pick.is_checked(),scenario+' inference should be selected';assert card.locator('[name=customer]').input_value()=='TEST_C';expected='KESIN' if scenario in ['alias-certain','registered-price'] else 'CIKARIM';assert card.locator('[data-field-confidence=customer_id]').get_attribute('data-level')==expected
  if scenario in ['same-day','site-owner']:assert 'Çıkarım:' in card.locator('[data-confidence-reason]').inner_text()
  if scenario=='site-owner':assert card.locator('[name=site]').input_value()=='TEST_SITE'
  if scenario=='ambiguous':assert not pick.is_checked() and card.locator('[name=customer]').input_value()=='TEST_TWIN1' and card.locator('[data-field-confidence=customer_id]').get_attribute('data-level')=='BILINMIYOR'
  if scenario=='unknown-quantity':assert not pick.is_checked() and card.locator('[name=quantity]').input_value()=='2';assert card.locator('[data-field-confidence=quantity]').text_content()=='Doğrulayın' and card.locator('[data-field-confidence=quantity]').get_attribute('data-level')=='BILINMIYOR'
  if scenario=='wrong-unit':assert not pick.is_checked() and card.locator('[name=unit]').input_value()=='Sefer'
  if scenario=='registered-price':
   assert '2.500' in card.locator('[data-record-summary]').inner_text();card.locator('[data-record-summary]').click();assert card.locator('[name=unit_price]').input_value()=='';assert '2.500' in card.locator('[data-confidence-price]').inner_text(),{'price_text':card.locator('[data-confidence-price]').text_content(),'card':card.inner_text()};page.click('[data-save]');page.wait_for_selector('.assistant-receipt');rows=[r for r in snap()['work_records'] if r.get('customer_id')=='TEST_C'];assert len(rows)==1;price=rows[0]['price_snapshot'];assert price['unit_price']==2500 and price['amount']==5000 and price['kdv_rate']==0 and price['kdv_included'] is True;assert price['price_source']!='Manuel';assert 'fieldConfidence' not in rows[0]
  if scenario=='credit-unknown':
   assert not pick.is_checked() and card.locator('[name=supplier]').input_value()=='TEST_SUP';card.locator('[data-record-summary]').click();card.locator('[name=supplier]').select_option('');pick.check();page.click('[data-save]');page.locator('.toast').get_by_text('Veresiye için esnafı doğrulayın',exact=False).wait_for();assert snap()==before
   card.locator('[data-confidence-paid]').click();page.click('[data-save]');page.wait_for_selector('.assistant-receipt');after=snap();assert len(after['expense_records'])==1 and after['expense_records'][0]['amount']==500 and after['payables']==before['payables'];assert 'fieldConfidence' not in after['expense_records'][0]
  if scenario=='local-edits':
   second=page.locator('[data-kind=work][data-i="1"]');second.locator('[data-record-summary]').click();card.locator('[data-record-summary]').click();second.locator('[name=quantity]').fill('9');card.locator('[name=customer]').select_option('TEST_B');assert second.locator('[name=quantity]').input_value()=='9' and second.locator('[name=customer]').input_value()=='TEST_C' and card.locator('[name=customer]').input_value()=='TEST_B';assert snap()==before
  if scenario=='missing-quantity':assert not pick.is_checked() and card.locator('[name=quantity]').input_value()=='' and card.locator('[data-field-confidence=quantity]').get_attribute('data-level')=='BILINMIYOR'
  if scenario in ['date-conflict','relative-conflict','header-conflict']:
   assert not pick.is_checked() and card.locator('[name=date]').input_value()==date.today().isoformat();assert card.locator('[data-field-confidence=date]').get_attribute('data-level')=='BILINMIYOR'
   card.locator('[data-record-summary]').click();suggested=(date.today()-timedelta(days=1)).isoformat() if scenario=='relative-conflict' else '2026-09-07';assert suggested.split('-')[2] in card.locator('[data-confidence-suggest=date]').text_content();card.locator('[data-confidence-suggest=date]').click();assert card.locator('[name=date]').input_value()==suggested and card.locator('[name=quantity]').input_value()=='2' and not pick.is_checked() and snap()==before
  if scenario in ['photo-date-fuel','photo-date-expense']:assert pick.is_checked() and card.locator('[name=date]').input_value()=='2026-11-01' and card.locator('[data-field-confidence=date]').get_attribute('data-level')=='KESIN'
  if scenario=='tank-credit-unknown':
   assert not pick.is_checked() and card.locator('[name=supplier]').input_value()=='TEST_SUP';card.locator('[data-record-summary]').click();card.locator('[name=supplier]').select_option('');pick.check();page.click('[data-save]');page.locator('.toast').get_by_text('Veresiye için esnafı doğrulayın',exact=False).wait_for();assert snap()==before
   card.locator('[name=tank_pay]').select_option('paid');page.click('[data-save]');page.locator('[data-out]').get_by_text('Kaydedildi: 1 depo girişi.',exact=False).wait_for();after=snap();added=[r for r in after['fuel_tank_movements'] if r['id'] not in {b['id'] for b in before['fuel_tank_movements']}];assert len(added)==1 and len(after['fuel_tank_movements'])==len(before['fuel_tank_movements'])+1 and added[0]['liters']==100 and added[0]['total']==5000 and after['payables']==before['payables'];assert 'fieldConfidence' not in added[0]
  assert len(requests)==1,requests;assert not errors,errors;page.screenshot(path=str(out/(scenario+'.png')),full_page=True);results.append({'scenario':scenario,'passed':True});ctx.close()
 browser.close()
(out/'results.json').write_text(json.dumps(results,indent=2));print(json.dumps(results))
