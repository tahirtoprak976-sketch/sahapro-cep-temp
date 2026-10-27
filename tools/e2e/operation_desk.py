"""DILIM1: real Chromium/IndexedDB operation desk and idempotent plan conversion."""
import argparse, json, os, uuid
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

p=argparse.ArgumentParser(description=__doc__)
p.add_argument('url',nargs='?',default='http://localhost:8841/')
p.add_argument('--artifacts',default='/tmp/solo-operation-desk')
a=p.parse_args();BASE=a.url.rstrip('/')+'/';ORIGIN=urlparse(BASE)
assert ORIGIN.scheme=='http' and ORIGIN.hostname in ('localhost','127.0.0.1','::1')
assert not ORIGIN.username and not ORIGIN.password and not ORIGIN.query and not ORIGIN.fragment
out=Path(a.artifacts);out.mkdir(parents=True,exist_ok=True)
errors=[];external=[]
with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),args=['--no-sandbox'])
    ctx=browser.new_context(viewport={'width':390,'height':850},service_workers='block')
    ctx.add_init_script("localStorage.setItem('sp_role','boss')")
    def route(req):
        u=urlparse(req.request.url)
        if (u.scheme,u.hostname,u.port)==(ORIGIN.scheme,ORIGIN.hostname,ORIGIN.port):req.continue_()
        else:external.append(req.request.url);req.abort()
    ctx.route('**/*',route)
    page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
    name='operation_desk_'+uuid.uuid4().hex[:14]
    page.goto(BASE+'README.md?db='+name)
    ids=page.evaluate('''async()=>{
      const db=await import('./js/db.js'),C=await import('./js/core.js'),S=await import('./js/solo-db.js');
      const date=C.todayStr(),c=await db.saveNew('customers',{name:'TEST Operation Customer'},'TEST');
      const site=await db.saveNew('sites',{name:'TEST Operation Site',customer_id:c.id},'TEST');
      const v=await db.saveNew('vehicles',{name:'TEST Operation Truck',type:'Kamyon'},'TEST');
      const p=await db.saveNew('personnel',{name:'TEST Operation Driver',daily_wage:100},'TEST');
      const plan=await S.saveShift({date,customer_id:c.id,site_id:site.id,vehicle_id:v.id,personnel_id:p.id,task:'TEST two hour plan',start:'08:00',end:'10:00',break_minutes:0},'TEST-plan-key');
      for(let i=0;i<35;i++)await db.saveNew('work_records',{date,customer_id:c.id,site_id:site.id,vehicle_id:v.id,personnel_id:p.id,work_type:'Makine Çalışması',unit:'Saat',quantity:1},'TEST');
      return {date,customer:c.id,site:site.id,vehicle:v.id,person:p.id,plan:plan.id};
    }''')
    query=f"op_date={ids['date']}&op_vehicle={ids['vehicle']}&op_personnel={ids['person']}&op_tab=today"
    page.goto(BASE+'index.html?db='+name+'#/?'+query)
    page.wait_for_selector('[data-operation-desk] [data-op-pane="today"]')
    text=page.locator('[data-operation-desk]').inner_text()
    assert '35' in text and 'gerçekleşen iş' in text.lower(),text
    assert 'İlk 30 gösteriliyor · tüm 35 kaydı' in text,text
    assert 'Planlı görevdir; gerçekleşen iş, gelir veya hakediş değildir.' in text,text
    page.screenshot(path=str(out/'operation-390.png'),full_page=True)
    page.locator('[data-plan-convert="'+ids['plan']+'"]').click()
    page.wait_for_selector('[data-plan-source="'+ids['plan']+'"]')
    assert page.locator('[name=quantity]').input_value()=='2'
    page.locator('[name=manual_price]').fill('100')
    page.locator('[name=manual_kdv]').fill('0')
    page.locator('[data-save]').click()
    page.wait_for_function("()=>location.hash.startsWith('#/isler/') && !location.hash.includes('new')")
    converted=page.evaluate('''async arg=>{
      const db=await import('./js/db.js'),plan=await db.get('shift_assignments',arg.plan),works=await db.listActive('work_records');
      return {plan,count:works.length,work:plan.work_record_id&&await db.get('work_records',plan.work_record_id)};
    }''',ids)
    assert converted['count']==36 and converted['work']['plan_assignment_id']==ids['plan'],converted
    assert converted['work']['quantity']==2 and converted['work']['price_snapshot']['kdv_rate']==0
    assert converted['plan']['status']=='Tamamlandı'
    # Second approval/open must recover the same commit, never a second job.
    page.goto(BASE+'index.html?db='+name+'#/isler/new?plan_id='+ids['plan'])
    page.wait_for_selector('[data-watt]',state='attached')
    assert page.evaluate("async()=> (await (await import('./js/db.js')).listActive('work_records')).length") == 36
    page.goto(BASE+'index.html?db='+name+'#/?'+query)
    page.wait_for_selector('[data-operation-desk] [data-op-pane="today"]')
    assert page.locator('[data-op-vehicle]').input_value()==ids['vehicle']
    page.reload();page.wait_for_selector('[data-operation-desk]')
    assert page.locator('[data-op-personnel]').input_value()==ids['person']

    # Saved close is immutable; changed source is shown as a separate difference.
    page.goto(BASE+'README.md?db='+name)
    close=page.evaluate('''async arg=>{
      const db=await import('./js/db.js'),E=await import('./js/enterprise-db.js');
      const c=await E.closeDay(arg.date,'TEST close','TEST-close-key');
      const w=(await db.listActive('work_records'))[0];await db.saveExisting('work_records',w,{quantity:3},'TEST source changed after close');
      return c.id;
    }''',ids)
    page.goto(BASE+'index.html?db='+name+'#/?'+query.replace('op_tab=today','op_tab=close'))
    page.wait_for_selector('[data-operation-desk]')
    if page.locator('[data-close-diff]').count()==0: print('CLOSE DEBUG URL',page.url,'HASH',page.evaluate('location.hash'),'TEXT',page.locator('[data-operation-desk]').inner_text(),flush=True)
    page.wait_for_selector('[data-close-diff]')
    close_text=page.locator('[data-operation-desk]').inner_text()
    assert 'Kaynak sonradan değişti' in close_text and 'Kaynak kayıt imzası' in close_text,close_text
    saved=page.evaluate("async id=>await (await import('./js/db.js')).get('daily_closings',id)",close)
    assert saved['summary']['work_count']==36 and saved['summary']['units']['Saat']==37,saved

    # Cancellation keeps its reason and never deletes/creates a real job.
    cancelled=page.evaluate('''async arg=>{
      const db=await import('./js/db.js'),S=await import('./js/solo-db.js');
      const p=await S.saveShift({date:arg.date,customer_id:arg.customer,site_id:arg.site,vehicle_id:arg.vehicle,personnel_id:arg.person,task:'TEST cancel plan',start:'10:30',end:'11:00',break_minutes:0},'TEST-cancel-plan');
      const r=await S.shiftStatus(p.id,'İptal','TEST cancellation reason');
      return {r,count:(await db.listActive('work_records')).length};
    }''',ids)
    assert cancelled['r']['status']=='İptal' and cancelled['r']['reason']=='TEST cancellation reason'
    assert cancelled['count']==36
    assert not errors and not external,{'errors':errors,'external':external}
    result={'local_synthetic_only':True,'full_scope_rows':35,'plan_converted_once':True,'second_approval_no_duplicate':True,
            'filters_preserved':True,'saved_close_unchanged':True,'source_difference_visible':True,'cancel_reason_preserved':True,
            'page_errors':errors,'external_requests':external}
    (out/'result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(result,ensure_ascii=False,indent=2),flush=True)
    ctx.close();browser.close()
