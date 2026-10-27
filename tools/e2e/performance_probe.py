"""Measure current full-scope reads/render at 1,000 and 10,000 synthetic work rows."""
import argparse,json,os,time
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser(description=__doc__);p.add_argument('url',nargs='?',default='http://localhost:8841/');p.add_argument('--artifacts',default='/tmp/solo-performance');a=p.parse_args()
BASE=a.url.rstrip('/')+'/';O=urlparse(BASE);assert O.scheme=='http' and O.hostname in ('localhost','127.0.0.1','::1')
out=Path(a.artifacts);out.mkdir(parents=True,exist_ok=True)
with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),args=['--no-sandbox'])
    ctx=browser.new_context(service_workers='block',viewport={'width':390,'height':850});ctx.add_init_script("localStorage.setItem('sp_role','boss')")
    page=ctx.new_page();results=[]
    for count in (1000,10000):
        name='performance_'+str(count)
        page.goto(BASE+'README.md?db='+name)
        page.evaluate('''async count=>{const db=await import('./js/db.js'),C=await import('./js/core.js');const c=await db.saveNew('customers',{name:'PERF'},'TEST'),v=await db.saveNew('vehicles',{name:'PERF',type:'Kamyon'},'TEST');const date=C.todayStr(),conn=await db.openDB();await new Promise((resolve,reject)=>{const t=conn.transaction('work_records','readwrite'),s=t.objectStore('work_records');for(let i=0;i<count;i++)s.add({id:'W'+i,date,customer_id:c.id,vehicle_id:v.id,work_type:'Makine Çalışması',unit:'Saat',quantity:1});t.oncomplete=resolve;t.onerror=t.onabort=()=>reject(t.error);});}''',count)
        started=time.perf_counter()
        metrics=page.evaluate('''async()=>{const db=await import('./js/db.js'),F=await import('./js/field-stream.js'),O=await import('./js/operation-core.js'),C=await import('./js/core.js'),t0=performance.now(),d=await db.dumpAll(),t1=performance.now(),stream=F.fieldStream(d,{date:C.todayStr()}),t2=performance.now(),model=O.operationModel(d,{date:C.todayStr(),meta:d.meta||[]}),t3=performance.now();return {dumpAllMs:t1-t0,fieldStreamMs:t2-t1,operationModelMs:t3-t2,rows:model.stream.rows.length,works:model.stream.counts.work,units:model.stream.units.Saat};}''')
        page.goto(BASE+'index.html?db='+name+'#/')
        page.wait_for_selector('[data-operation-desk]',timeout=120000)
        metrics['navigationReadyMs']=round((time.perf_counter()-started)*1000,2)
        metrics['records']=count
        assert metrics['rows']==count and metrics['works']==count and metrics['units']==count,metrics
        results.append(metrics)
    (out/'result.json').write_text(json.dumps({'local_synthetic_only':True,'measurements':results,'note':'Current candidate timings; no unmeasured speedup claim.'},ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(results,ensure_ascii=False,indent=2),flush=True)
    ctx.close();browser.close()
