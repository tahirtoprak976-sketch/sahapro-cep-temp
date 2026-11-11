"""Fresh and populated phone menu crawl, named controls, immutable business records."""
import json,uuid,sys
from pathlib import Path
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright
out=Path('/tmp/solo-system108');out.mkdir(exist_ok=True)
base=(sys.argv[1] if len(sys.argv)>1 else 'http://localhost:8841/').rstrip('/')+'/';assert urlparse(base).hostname in ('localhost','127.0.0.1')
with sync_playwright() as w:
 b=w.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);report={'profiles':{},'errors':[]}
 for populated in [False,True]:
  c=b.new_context(viewport={'width':360,'height':850},locale='tr-TR',service_workers='block');c.add_init_script("localStorage.setItem('sp_role','boss')")
  c.route('**/*',lambda r:r.continue_() if urlparse(r.request.url).hostname in ('localhost','127.0.0.1') else r.abort());p=c.new_page();errors=[];p.on('pageerror',lambda e:errors.append(str(e)));app=base+'index.html?db=TEST_audit108_'+uuid.uuid4().hex
  def go(h):
   p.goto(app+h);p.wait_for_selector('#screen[data-view-ready="1"]',timeout=20000)
  go('#/daha')
  if populated:
   p.evaluate("""async()=>{const d=await import('./js/db.js'),C=await import('./js/core.js'),today=C.todayStr(),c=await d.saveNew('customers',{name:'TEST Audit Company'},'TEST'),v=await d.saveNew('vehicles',{name:'TEST Audit Machine',type:'JCB'},'TEST'),p=await d.saveNew('personnel',{name:'TEST Audit Staff',vehicle_id:v.id},'TEST'),s=await d.saveNew('sites',{name:'TEST Audit Site',customer_id:c.id},'TEST');await d.saveNew('work_records',{date:today,customer_id:c.id,site_id:s.id,vehicle_id:v.id,personnel_id:p.id,work_type:'Makine Çalışması',quantity:3,unit:'Saat',price_snapshot:{unit_price:1000,amount:3000,kdv_rate:20,kdv_included:false}},'TEST');await d.saveCashEvent({date:today,customer_id:c.id,personnel_id:p.id,cash_type:'Müşteriden Para Alındı',cash_status:'PERSONELDE',payment_method:'Nakit',amount:500});}""")
  before=p.evaluate("async()=>await(await import('./js/db.js')).dumpAll()")
  targets=['#/daha','#/finans','#/raporlar','#/']
  for menu in ['#/daha','#/finans','#/raporlar','#/']:
   go(menu);targets+=p.locator('#screen [data-go],#screen a[href^="#/"]').evaluate_all('es=>es.map(e=>e.dataset.go||e.getAttribute("href"))')
  targets=sorted(set(h for h in targets if h and h.startswith('#/') and not any(z in h for z in ['/new','/edit','?k=','akilli-asistan?'])))
  rows=[]
  for h in targets:
   try:
    go(h);row=p.evaluate("()=>{const r=document.querySelector('#screen');return {title:r.querySelector('h1,h2')?.textContent,overflow:document.documentElement.scrollWidth>innerWidth,height:Math.round(r.getBoundingClientRect().height),controls:[...r.querySelectorAll('button,a,input,select,textarea,summary')].filter(e=>e.checkVisibility()).length,error:r.innerText.includes('Ekran yüklenirken hata'),unlabelled:[...r.querySelectorAll('input:not([type=hidden]),textarea,select')].filter(e=>e.checkVisibility()&&!e.labels?.length&&!e.getAttribute('aria-label')&&!e.getAttribute('aria-labelledby')&&!e.getAttribute('placeholder')).map(e=>e.name||e.dataset)}}")
    row['route']=h;rows.append(row)
   except Exception as e:rows.append({'route':h,'exception':str(e)[:180]})
  go('#/ayarlar');p.locator('[data-coform] input').first.fill('TEST unsaved company');risk=p.evaluate("async()=>(await import('./js/update-safety.js')).updateRisk(document.querySelector('#screen'))")
  report['profiles']['populated' if populated else 'fresh']={'routes':rows,'updateRiskAfterNavigationAndEdit':risk,'businessDataUnchanged':before==p.evaluate("async()=>await(await import('./js/db.js')).dumpAll()"),'errors':errors}
  assert not errors,errors
  assert all(not r.get('overflow') and not r.get('error') and not r.get('exception') and not r.get('unlabelled') for r in rows),[r for r in rows if r.get('overflow')or r.get('error')or r.get('exception')or r.get('unlabelled')]
  assert report['profiles']['populated' if populated else 'fresh']['businessDataUnchanged'],'Opening a screen must not change business records'
  assert risk['unsaved'],'Settings edits after navigation must stay protected'
  print(json.dumps({'profile':populated,'routes':len(rows),'bad':[x for x in rows if x.get('overflow')or x.get('error')or x.get('exception')],'updateRisk':risk,'errors':errors},ensure_ascii=False),flush=True);c.close()
 (out/'route-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));b.close()
