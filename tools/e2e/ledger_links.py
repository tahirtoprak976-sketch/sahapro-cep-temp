"""Cross-module audit regression: real persistence, synthetic records only."""
import pathlib,json,sys
from playwright.sync_api import sync_playwright
U=sys.argv[1] if len(sys.argv)>1 else 'http://localhost:8841/'
with sync_playwright()as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);c=b.new_context(viewport={'width':360,'height':850});c.add_init_script("localStorage.setItem('sp_role','boss')");pg=c.new_page();errors=[];pg.on('pageerror',lambda e:errors.append(str(e)))
 pg.goto(U+'index.html#/daha');pg.wait_for_function("()=>document.querySelector('#screen')?.textContent.includes('İşletme Defterleri')")
 r=pg.evaluate(pathlib.Path(__file__).with_name('ledger_links_fixture.js').read_text())
 assert r['job_income']['enterprise_net']==r['job_income']['result_net']==r['job_income']['job_net']==10000,r['job_income']
 assert r['tank_cost']['general']==r['tank_cost']['enterprise']==600,r['tank_cost']
 assert r['tank_cost']['balance']==80
 assert r['allocation']['enterprise_site_cost']==r['allocation']['result_site_cost']==500,r['allocation']
 assert len(r['forecast']['forecast'])==2 and {x['amount']for x in r['forecast']['forecast']}=={100,250},r['forecast']
 assert r['maintenance']['plan']['leftHours']==-100 and r['maintenance']['plan']['estimated'],r['maintenance']
 assert r['payroll_missing_method']['accepted'] is False and r['payroll_missing_method']['cash_delta']==0
 assert r['receivable']['firstRemaining']==300 and r['receivable']['newCash']==0 and r['receivable']['newCari']==0 and r['receivable']['newBank']==0,r['receivable']
 assert r['cheque']['status']=='Kapandı' and r['cheque']['newBank']==0 and r['cheque']['newCari']==0
 assert r['purchase']['bill']==r['purchase']['order']==120 and r['purchase']['source']
 assert r['contract']['site_deal_after_document'] is None,'document must not silently change pricing'
 ids=r['ids']
 screens={}
 for target in ['#/sozlesmeler','#/is-sozlesmeleri','#/bakimplani/'+ids['plan'],'#/personel/'+ids['person'],'#/gun-kapanis']:
  pg.goto(U+'index.html'+target);pg.wait_for_function("()=>document.querySelector('#screen')?.children.length>0&&!document.querySelector('#screen .skel')");screens[target]=pg.locator('#screen').inner_text();assert 'Ekran yüklenirken hata' not in screens[target]
 assert pg.locator('#screen').get_by_text('Kaynaklar değişti',exact=True).count()
 assert 'tahmin' in screens['#/bakimplani/'+ids['plan']]
 assert 'tüm dönemler' in screens['#/personel/'+ids['person']] and 'Puantaj / Maaş' in screens['#/personel/'+ids['person']]
 assert 'kendiliğinden' in screens['#/is-sozlesmeleri'] and 'otomatik' in screens['#/sozlesmeler']
 category=pg.evaluate("async name=>{const A=await import('./js/assistant-core.js'),db=await import('./js/db.js'),C=await import('./js/core.js');return A.validatePlan({expenses:[{date:C.todayStr(),amount:100,category:name}]},{message:name+' için bugün 100 TL harcandı',d:await db.dumpAll(),today:C.todayStr()}).expenses[0]}",ids['category'])
 assert category['category']==ids['category'] and category['ok']
 assert not errors,errors
 print('PASS actual goturu charge → net revenue, tank consumption only, allocated site cost in both reports, exact invoice payments/quarry forecast, shared maintenance estimate, payroll method guard, receipt allocation no extra money, closed cheque no extra money, purchase source, contract distinction, stale daily close, assistant custom category; zero browser errors',flush=True)
 print(json.dumps({k:r[k] for k in ['job_income','tank_cost','allocation','payroll_missing_method']},ensure_ascii=False))
 b.close()
